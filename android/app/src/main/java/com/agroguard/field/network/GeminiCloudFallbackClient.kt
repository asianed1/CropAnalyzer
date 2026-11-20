package com.agroguard.field.network

import android.util.Base64
import com.agroguard.field.BuildConfig
import com.agroguard.field.model.ConditionRecommendation
import com.agroguard.field.model.DiagnosisOutput
import com.agroguard.field.model.FarmerContextInput
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

@Serializable
private data class CloudDiagnoseRequest(
    val imageBase64: String,
    val mimeType: String = "image/jpeg",
    val transportUsed: String,
    val context: CloudContextPayload
)

@Serializable
private data class CloudContextPayload(
    val suspectedCropId: String,
    val plantPart: String,
    val primarySymptom: String,
    val growthStage: String,
    val fieldCondition: String,
    val soilMoisture: String,
    val sunlightExposure: String,
    val recentInputs: String
)

@Serializable
private data class CloudDiagnoseApiResponse(
    val cropCommonName: String,
    val cropScientificName: String,
    val diagnosisName: String,
    val pathogenScientificName: String,
    val category: String,
    val probabilityPercent: Int,
    val reasoning: String,
    val recommendations: ConditionRecommendation
)

/**
 * Executes the ~5% Gemini cloud fallback request bound explicitly to the prioritized
 * Network (Wi-Fi first; Telco Cellular only if Wi-Fi is unavailable).
 */
class GeminiCloudFallbackClient {

    private val json = Json { ignoreUnknownKeys = true }

    suspend fun analyzeViaGemini(
        caseId: String,
        roiJpegBytes: ByteArray,
        context: FarmerContextInput,
        networkState: PriorityNetworkState
    ): DiagnosisOutput = withContext(Dispatchers.IO) {
        val network = networkState.prioritizedNetwork
            ?: throw IllegalStateException("No Wi-Fi or Telco signal available")

        val client = OkHttpClient.Builder()
            .socketFactory(network.socketFactory)
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(45, TimeUnit.SECONDS)
            .build()

        val payload = CloudDiagnoseRequest(
            imageBase64 = Base64.encodeToString(roiJpegBytes, Base64.NO_WRAP),
            transportUsed = networkState.preferredTransport.name,
            context = CloudContextPayload(
                suspectedCropId = context.suspectedCropId,
                plantPart = context.plantPart,
                primarySymptom = context.primarySymptom,
                growthStage = context.growthStage,
                fieldCondition = context.fieldCondition,
                soilMoisture = context.soilMoisture,
                sunlightExposure = context.sunlightExposure,
                recentInputs = context.recentInputs
            )
        )

        val requestBody = json.encodeToString(CloudDiagnoseRequest.serializer(), payload)
            .toRequestBody("application/json; charset=utf-8".toMediaType())

        val request = Request.Builder()
            .url("${BuildConfig.CLOUD_FALLBACK_BASE_URL}/api/cloud-diagnose")
            .post(requestBody)
            .build()

        client.newCall(request).execute().use { response ->
            val bodyString = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException("Gemini cloud request failed (${response.code}): $bodyString")
            }
            val parsed = json.decodeFromString<CloudDiagnoseApiResponse>(bodyString)
            DiagnosisOutput(
                caseId = caseId,
                cropCommonName = parsed.cropCommonName,
                cropScientificName = parsed.cropScientificName,
                diagnosisName = parsed.diagnosisName,
                pathogenScientificName = parsed.pathogenScientificName,
                category = parsed.category,
                probabilityPercent = parsed.probabilityPercent,
                summary = parsed.reasoning,
                recommendations = parsed.recommendations,
                source = "GEMINI_CLOUD",
                transportUsed = networkState.preferredTransport.name
            )
        }
    }
}
