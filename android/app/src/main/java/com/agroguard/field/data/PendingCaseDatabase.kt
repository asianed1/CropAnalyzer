package com.agroguard.field.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.Database
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow
import java.io.File

@Entity(tableName = "field_cases")
data class FieldCaseEntity(
    @PrimaryKey val id: String,
    val createdAtEpochMs: Long,
    val status: String, // "DIAGNOSED_OFFLINE", "DIAGNOSED_GEMINI", "UNRESOLVED_SAVED"
    val cropCommonName: String,
    val cropScientificName: String,
    val diagnosisName: String,
    val pathogenScientificName: String,
    val probabilityPercent: Int,
    val recommendationJson: String,
    val imageFilePath: String,
    val contextSummary: String
)

@Dao
interface FieldCaseDao {
    @Query("SELECT * FROM field_cases ORDER BY createdAtEpochMs DESC")
    fun observeAllCases(): Flow<List<FieldCaseEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertCase(entity: FieldCaseEntity)

    @Query("SELECT * FROM field_cases WHERE id = :caseId LIMIT 1")
    suspend fun getCaseById(caseId: String): FieldCaseEntity?

    @Query("DELETE FROM field_cases WHERE id = :caseId")
    suspend fun deleteCaseById(caseId: String)
}

@Database(entities = [FieldCaseEntity::class], version = 1, exportSchema = false)
abstract class PendingCaseDatabase : RoomDatabase() {
    abstract fun fieldCaseDao(): FieldCaseDao

    companion object {
        @Volatile
        private var INSTANCE: PendingCaseDatabase? = null

        fun getInstance(context: Context): PendingCaseDatabase {
            return INSTANCE ?: synchronized(this) {
                Room.databaseBuilder(
                    context.applicationContext,
                    PendingCaseDatabase::class.java,
                    "agroguard_cases.db"
                ).build().also { INSTANCE = it }
            }
        }
    }
}

/**
 * Deletes both the SQLite Room entry and the locally cached cropped ROI photo
 * when the farmer chooses NO to Gemini analysis and confirms deletion from memory.
 */
suspend fun deleteCaseCompletelyFromMemory(
    dao: FieldCaseDao,
    caseId: String,
    localImagePath: String?
) {
    dao.deleteCaseById(caseId)
    localImagePath?.let { path ->
        runCatching {
            val file = File(path)
            if (file.exists()) file.delete()
        }
    }
}
