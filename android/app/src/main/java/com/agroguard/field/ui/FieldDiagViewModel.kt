package com.agroguard.field.ui

import android.app.Application
import android.graphics.Bitmap
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.agroguard.field.data.FieldCaseEntity
import com.agroguard.field.data.LocalKnowledgeRepository
import com.agroguard.field.data.PendingCaseDatabase
import com.agroguard.field.data.deleteCaseCompletelyFromMemory
import com.agroguard.field.ml.LocalDiagnosticEngine
import com.agroguard.field.model.AbioticCondition
import com.agroguard.field.model.AnalysisDecision
import com.agroguard.field.model.BoundingBoxNormalized
import com.agroguard.field.model.CropEntry
import com.agroguard.field.model.DiagnosisOutput
import com.agroguard.field.model.FarmerContextInput
import com.agroguard.field.network.GeminiCloudFallbackClient
import com.agroguard.field.network.NetworkPriorityManager
import com.agroguard.field.network.PriorityNetworkState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File
import java.util.UUID

sealed class PromptModalState {
    data object None : PromptModalState()
    data class AskAnalyzeViaGemini(
        val caseId: String,
        val reason: String,
        val signalLabel: String,
        val roiBytes: ByteArray
    ) : PromptModalState()

    data class AskDeleteUnresolvedFromMemory(
        val caseId: String,
        val localImagePath: String?,
        val reason: String
    ) : PromptModalState()
}

class FieldDiagViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = LocalKnowledgeRepository(application)
    private val engine = LocalDiagnosticEngine(repository)
    private val db = PendingCaseDatabase.getInstance(application)
    private val dao = db.fieldCaseDao()
    private val networkManager = NetworkPriorityManager(application)
    private val cloudClient = GeminiCloudFallbackClient()

    val networkState: StateFlow<PriorityNetworkState> = networkManager.state
    val savedCases = dao.observeAllCases()

    val allCrops: List<CropEntry> by lazy { repository.getAll30Crops() }
    val allAbioticCauses: List<AbioticCondition> by lazy { repository.getAbioticCauses() }

    private val _diagnosis = MutableStateFlow<DiagnosisOutput?>(null)
    val diagnosis: StateFlow<DiagnosisOutput?> = _diagnosis.asStateFlow()

    private val _promptState = MutableStateFlow<PromptModalState>(PromptModalState.None)
    val promptState: StateFlow<PromptModalState> = _promptState.asStateFlow()

    private val _statusBanner = MutableStateFlow<String?>(null)
    val statusBanner: StateFlow<String?> = _statusBanner.asStateFlow()

    private val _isCloudLoading = MutableStateFlow(false)
    val isCloudLoading: StateFlow<Boolean> = _isCloudLoading.asStateFlow()

    private var pendingImagePath: String? = null
    private var pendingContext: FarmerContextInput = FarmerContextInput()

    init {
        networkManager.startListening()
    }

    override fun onCleared() {
        networkManager.stopListening()
        super.onCleared()
    }

    fun showStatus(message: String) {
        _statusBanner.value = message
    }

    fun clearBanner() {
        _statusBanner.value = null
    }

    fun analyzeCapturedImage(
        bitmap: Bitmap,
        box: BoundingBoxNormalized,
        context: FarmerContextInput
    ) {
        pendingContext = context
        _statusBanner.value = null
        viewModelScope.launch {
            val decision = withContext(Dispatchers.Default) {
                engine.analyze(bitmap, box, context)
            }
            when (decision) {
                is AnalysisDecision.ConfidentOffline -> {
                    _diagnosis.value = decision.output
                    _promptState.value = PromptModalState.None
                    val thumbPath = if (decision.roiJpegBytes.isNotEmpty()) {
                        withContext(Dispatchers.IO) {
                            saveTempRoiToDisk(decision.output.caseId, decision.roiJpegBytes)
                        }
                    } else {
                        null
                    }
                    persistDiagnosedCase(decision.output, thumbPath)
                }
                is AnalysisDecision.UnresolvedNeedCloud -> {
                    val filePath = withContext(Dispatchers.IO) {
                        saveTempRoiToDisk(decision.tempCaseId, decision.roiJpegBytes)
                    }
                    pendingImagePath = filePath

                    val net = networkState.value
                    if (net.isAvailable) {
                        _promptState.value = PromptModalState.AskAnalyzeViaGemini(
                            caseId = decision.tempCaseId,
                            reason = decision.reason,
                            signalLabel = net.humanReadableSignal,
                            roiBytes = decision.roiJpegBytes
                        )
                    } else {
                        _promptState.value = PromptModalState.AskDeleteUnresolvedFromMemory(
                            caseId = decision.tempCaseId,
                            localImagePath = filePath,
                            reason = "${decision.reason} No internet signal right now."
                        )
                    }
                }
            }
        }
    }

    fun askGeminiSecondOpinion(
        bitmap: Bitmap,
        box: BoundingBoxNormalized,
        context: FarmerContextInput
    ) {
        pendingContext = context
        val net = networkState.value
        viewModelScope.launch {
            val jpegBytes = withContext(Dispatchers.Default) {
                engine.extractRoiJpegBytes(bitmap, box)
            }
            val tempId = UUID.randomUUID().toString()
            val filePath = withContext(Dispatchers.IO) {
                saveTempRoiToDisk(tempId, jpegBytes)
            }
            pendingImagePath = filePath

            if (net.isAvailable) {
                _promptState.value = PromptModalState.AskAnalyzeViaGemini(
                    caseId = tempId,
                    reason = "Check online for a second opinion on this leaf photo?",
                    signalLabel = net.humanReadableSignal,
                    roiBytes = jpegBytes
                )
            } else {
                _promptState.value = PromptModalState.AskDeleteUnresolvedFromMemory(
                    caseId = tempId,
                    localImagePath = filePath,
                    reason = "No Wi-Fi or mobile signal right now to check online."
                )
            }
        }
    }

    fun retryGeminiForSavedCase(entity: FieldCaseEntity) {
        val net = networkState.value
        if (!net.isAvailable) {
            _statusBanner.value = "Cannot check online right now: no Wi-Fi or mobile signal."
            return
        }
        val file = File(entity.imageFilePath)
        if (!file.exists()) {
            _statusBanner.value = "Saved photo was not found on this phone."
            return
        }
        viewModelScope.launch {
            _isCloudLoading.value = true
            runCatching {
                val bytes = withContext(Dispatchers.IO) { file.readBytes() }
                cloudClient.analyzeViaGemini(
                    caseId = entity.id,
                    roiJpegBytes = bytes,
                    context = pendingContext,
                    networkState = net
                )
            }.onSuccess { result ->
                _isCloudLoading.value = false
                _diagnosis.value = result
                persistDiagnosedCase(result, entity.imageFilePath)
                _statusBanner.value = "Updated from online check (${result.transportUsed})."
            }.onFailure { err ->
                _isCloudLoading.value = false
                _statusBanner.value = "Online check failed: ${err.message}"
            }
        }
    }

    fun deleteSavedCase(entity: FieldCaseEntity) {
        viewModelScope.launch {
            deleteCaseCompletelyFromMemory(
                dao = dao,
                caseId = entity.id,
                localImagePath = entity.imageFilePath.ifBlank { null }
            )
            _statusBanner.value = "Photo deleted from phone."
        }
    }

    fun onUserRespondsGeminiPrompt(proceedYes: Boolean) {
        val current = _promptState.value as? PromptModalState.AskAnalyzeViaGemini ?: return
        if (proceedYes) {
            _promptState.value = PromptModalState.None
            val net = networkState.value
            viewModelScope.launch {
                _isCloudLoading.value = true
                runCatching {
                    cloudClient.analyzeViaGemini(
                        caseId = current.caseId,
                        roiJpegBytes = current.roiBytes,
                        context = pendingContext,
                        networkState = net
                    )
                }.onSuccess { result ->
                    _isCloudLoading.value = false
                    _diagnosis.value = result
                    persistDiagnosedCase(result, pendingImagePath)
                    _statusBanner.value = "Checked online using ${result.transportUsed}"
                }.onFailure { err ->
                    _isCloudLoading.value = false
                    _statusBanner.value = "Online check error: ${err.message}"
                    _promptState.value = PromptModalState.AskDeleteUnresolvedFromMemory(
                        caseId = current.caseId,
                        localImagePath = pendingImagePath,
                        reason = "Could not connect online (${err.message})."
                    )
                }
            }
        } else {
            _promptState.value = PromptModalState.AskDeleteUnresolvedFromMemory(
                caseId = current.caseId,
                localImagePath = pendingImagePath,
                reason = "Online check was skipped."
            )
        }
    }

    fun onUserRespondsDeletePrompt(deleteYes: Boolean) {
        val current = _promptState.value as? PromptModalState.AskDeleteUnresolvedFromMemory ?: return
        _promptState.value = PromptModalState.None
        viewModelScope.launch {
            if (deleteYes) {
                deleteCaseCompletelyFromMemory(dao, current.caseId, current.localImagePath)
                pendingImagePath = null
                _statusBanner.value = "Photo deleted from your phone."
            } else {
                val cropLabel = if (pendingContext.suspectedCropId == "auto") {
                    "Unknown Crop"
                } else {
                    allCrops.firstOrNull { it.id == pendingContext.suspectedCropId }?.commonName
                        ?: pendingContext.suspectedCropId
                }
                dao.upsertCase(
                    FieldCaseEntity(
                        id = current.caseId,
                        createdAtEpochMs = System.currentTimeMillis(),
                        status = "UNRESOLVED_SAVED",
                        cropCommonName = cropLabel,
                        cropScientificName = "Not Yet Identified",
                        diagnosisName = "Needs Online Check",
                        pathogenScientificName = "Saved for Later",
                        probabilityPercent = 0,
                        recommendationJson = "",
                        imageFilePath = current.localImagePath.orEmpty(),
                        contextSummary = "${pendingContext.plantPart} / ${pendingContext.primarySymptom}"
                    )
                )
                _statusBanner.value = "Photo saved on phone to check later."
            }
        }
    }

    private suspend fun persistDiagnosedCase(output: DiagnosisOutput, imagePath: String?) {
        dao.upsertCase(
            FieldCaseEntity(
                id = output.caseId,
                createdAtEpochMs = System.currentTimeMillis(),
                status = if (output.source == "GEMINI_CLOUD") "DIAGNOSED_GEMINI" else "DIAGNOSED_OFFLINE",
                cropCommonName = output.cropCommonName,
                cropScientificName = output.cropScientificName,
                diagnosisName = output.diagnosisName,
                pathogenScientificName = output.pathogenScientificName,
                probabilityPercent = output.probabilityPercent,
                recommendationJson = Json.encodeToString(output.recommendations),
                imageFilePath = imagePath.orEmpty(),
                contextSummary = output.summary
            )
        )
    }

    private fun saveTempRoiToDisk(caseId: String, bytes: ByteArray): String {
        val dir = File(getApplication<Application>().filesDir, "field_cases").apply { mkdirs() }
        val file = File(dir, "$caseId.jpg")
        file.writeBytes(bytes)
        return file.absolutePath
    }
}
