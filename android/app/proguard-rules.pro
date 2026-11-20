# Keep Kotlin Serialization models used for assets & Gemini JSON payloads
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.SerializationKt
-keep,includedescriptorclasses class com.agroguard.field.model.**$$serializer { *; }
-keepclassmembers class com.agroguard.field.model.** {
    *** Companion;
}
-keep class com.agroguard.field.model.** { *; }
-keep class com.agroguard.field.network.** { *; }

# Keep Room database entities & generated implementations
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
-dontwarn androidx.room.paging.**

# OkHttp & Kotlin Coroutines
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
