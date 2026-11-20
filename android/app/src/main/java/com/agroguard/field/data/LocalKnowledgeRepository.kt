package com.agroguard.field.data

import android.content.Context
import com.agroguard.field.model.AbioticCondition
import com.agroguard.field.model.CropEntry
import kotlinx.serialization.json.Json

class LocalKnowledgeRepository(private val context: Context) {

    private val jsonParser = Json { ignoreUnknownKeys = true }

    @Volatile
    private var cachedCrops: List<CropEntry>? = null

    @Volatile
    private var cachedAbiotic: List<AbioticCondition>? = null

    fun getAll30Crops(): List<CropEntry> {
        cachedCrops?.let { return it }
        val jsonString = context.assets.open("crops_30_sea_kb.json")
            .bufferedReader()
            .use { it.readText() }
        val parsed = jsonParser.decodeFromString<List<CropEntry>>(jsonString)
        cachedCrops = parsed
        return parsed
    }

    fun getAbioticCauses(): List<AbioticCondition> {
        cachedAbiotic?.let { return it }
        val jsonString = context.assets.open("abiotic_causes_kb.json")
            .bufferedReader()
            .use { it.readText() }
        val parsed = jsonParser.decodeFromString<List<AbioticCondition>>(jsonString)
        cachedAbiotic = parsed
        return parsed
    }
}
