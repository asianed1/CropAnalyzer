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
import com.agroguard.field.model.AnalysisDecision
import com.agroguard.field.model.BoundingBoxNormalized
import com.agroguard.field.model.DiagnosisOutput
import com.agroguard.field.model.FarmerContextInput
import com.agroguard.field.network.GeminiCloudFallbackClient
import com.agroguard.field.network.NetworkPriorityManager
import com.agroguard.field.network.PriorityNetworkState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

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

    private val _diagnosis = MutableStateFlow<DiagnosisOutput?>(null)
    val diagnosis: StateFlow<DiagnosisOutput?> = _diagnosis.asStateFlow()

    private val _promptState = MutableStateFlow<PromptModalState>(PromptModalState.None)
    val promptState: StateFlow<PromptModalState> = _promptState.asStateFlow()

    private val _statusBanner = MutableStateFlow<String?>(null)
    val statusBanner: StateFlow<String?> = _statusBanner.asStateFlow()

    private var pendingRoiBytes: ByteArray? = null
    private var pendingImagePath: String? = null
    private var pendingContext: FarmerContextInput = FarmerContextInput()

    init {
        networkManager.startListening()
    }

    override fun onCleared() {
        networkManager.stopListening()
        super.onCleared()
    }

    fun analyzeCapturedImage(
        bitmap: Bitmap,
        box: BoundingBoxNormalized,
        context: FarmerContextInput
    ) {
        pendingContext = context
        viewModelScope.launch {
            when (val decision = engine.analyze(bitmap, box, context)) {
                is AnalysisDecision.ConfidentOffline -> {
                    _diagnosis.value = decision.output
                    _promptState.value = PromptModalState.None
                    persistDiagnosedCase(decision.output, null)
                }
                is AnalysisDecision.UnresolvedNeedCloud -> {
                    pendingRoiBytes = decision.roiJpegBytes
                    val filePath = saveTempRoiToDisk(decision.tempCaseId, decision.roiJpegBytes)
                    pendingImagePath = filePath

                    val net = networkState.value
                    if (net.isAvailable) {
                        // Signal is available (Wi-Fi prioritized first, else Telco): ask Y/N
                        _promptState.value = PromptModalState.AskAnalyzeViaGemini(
                            caseId = decision.tempCaseId,
                            reason = decision.reason,
                            signalLabel = net.humanReadableSignal,
                            roiBytes = decision.roiJpegBytes
                        )
                    } else {
                        // Offline: save unresolved or delete from memory
                        _promptState.value = PromptModalState.AskDeleteUnresolvedFromMemory(
                            caseId = decision.tempCaseId,
                            localImagePath = filePath,
                            reason = "${decision.reason} No Wi-Fi or Telco signal is available."
                        )
                    }
                }
            }
        }
    }

    fun onUserRespondsGeminiPrompt(proceedYes: Boolean) {
        val current = _promptState.value as? PromptModalState.AskAnalyzeViaGemini ?: return
        if (proceedYes) {
            _promptState.value = PromptModalState.None
            val net = networkState.value
            viewModelScope.launch {
                runCatching {
                    cloudClient.analyzeViaGemini(
                        caseId = current.caseId,
                        roiJpegBytes = current.roiBytes,
                        context = pendingContext,
                        networkState = net
                    )
                }.onSuccess { result ->
                    _diagnosis.value = result
                    persistDiagnosedCase(result, pendingImagePath)
                    _statusBanner.value = "Analyzed via Gemini using ${result.transportUsed}"
                }.onFailure { err ->
                    _statusBanner.value = "Gemini fallback error: ${err.message}"
                    _promptState.value = PromptModalState.AskDeleteUnresolvedFromMemory(
                        caseId = current.caseId,
                        localImagePath = pendingImagePath,
                        reason = "Cloud request failed (${err.message})."
                    )
                }
            }
        } else {
            // User chose NO: do NOT proceed to Gemini; ask whether to delete case from memory
            _promptState.value = PromptModalState.AskDeleteUnresolvedFromMemory(
                caseId = current.caseId,
                localImagePath = pendingImagePath,
                reason = "Gemini cloud analysis declined."
            )
        }
    }

    fun onUserRespondsDeletePrompt(deleteYes: Boolean) {
        val current = _promptState.value as? PromptModalState.AskDeleteUnresolvedFromMemory ?: return
        _promptState.value = PromptModalState.None
        viewModelScope.launch {
            if (deleteYes) {
                deleteCaseCompletelyFromMemory(dao, current.caseId, current.localImagePath)
                pendingRoiBytes = null
                pendingImagePath = null
                _statusBanner.value = "Unresolved case deleted from local memory."
            } else {
                dao.upsertCase(
                    FieldCaseEntity(
                        id = current.caseId,
                        createdAtEpochMs = System.currentTimeMillis(),
                        status = "UNRESOLVED_SAVED",
                        cropCommonName = if (pendingContext.suspectedCropId == "auto") "Unidentified Crop" else pendingContext.suspectedCropId,
                        cropScientificName = "Pending Review",
                        diagnosisName = "Unresolved Pest / Disease",
                        pathogenScientificName = "Awaiting Online Search",
                        probabilityPercent = 0,
                        recommendationJson = "",
                        imageFilePath = current.localImagePath.orEmpty(),
                        contextSummary = "${pendingContext.plantPart} / ${pendingContext.primarySymptom}"
                    )
                )
                _statusBanner.value = "Case retained in local field memory for later review."
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
