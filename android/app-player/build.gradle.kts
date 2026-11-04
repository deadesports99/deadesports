import groovy.json.JsonSlurper
import java.io.File

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

/**
 * Firebase Cloud Messaging — the client drops their own google-services.json
 * into this module and push (room reveal / prize / refund alerts) turns on.
 * Without the file the app builds and works; only push is disabled.
 */
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
    logger.lifecycle("[fcm] google-services.json found — Firebase push enabled for ${project.name}")
}

/**
 * 🔥 10-MINUTE RE-BRANDING ENGINE (build-time):
 * Reads src/main/assets/client_config.json and bakes applicationId + app name
 * into the APK — Play-Store-safe unique identity per client.
 */
val clientConfigFile = File(projectDir, "src/main/assets/client_config.json")
val clientCfg = if (clientConfigFile.exists()) {
    JsonSlurper().parse(clientConfigFile) as Map<*, *>
} else {
    mapOf(
        "client_name" to "Thunder eSports",
        "application_id" to "com.tourney.player",
        "app_name" to "Thunder eSports",
    )
}
val clientAppId = (clientCfg["application_id"] as? String) ?: "com.tourney.player"
val clientAppName = (clientCfg["app_name"] as? String) ?: "Thunder eSports"
// Optional per-client release versioning (falls back to the repo defaults).
val clientVersionName = (clientCfg["version_name"] as? String) ?: "1.0.0"
val clientVersionCode = (clientCfg["version_code"] as? Number)?.toInt() ?: 1

// Production builds can override the bundled API URL without editing or
// committing client branding: ./gradlew ... -PapiBaseUrl=https://api.example.com/api/v1
val apiBaseUrlOverride = providers.gradleProperty("apiBaseUrl")
    .orElse(providers.environmentVariable("API_BASE_URL"))
    .orNull
    ?.trim()
    ?.takeIf { it.isNotEmpty() }

val generatedApiConfigDir = layout.buildDirectory.dir("generated/api-config")
val generateApiConfig = tasks.register("generateApiConfig") {
    inputs.file(clientConfigFile)
    inputs.property("apiBaseUrlOverride", apiBaseUrlOverride ?: "")
    outputs.dir(generatedApiConfigDir)
    doLast {
        val output = generatedApiConfigDir.get().asFile.resolve("client_config.json")
        val source = clientConfigFile.readText()
        val rewritten = apiBaseUrlOverride?.let { url ->
            require(Regex("^https?://[^\\s]+/api/v1$").matches(url)) {
                "apiBaseUrl must be an HTTP or HTTPS URL ending in /api/v1"
            }
            Regex("(\"api_base_url\"\\s*:\\s*)\"[^\"]*\"")
                .replace(source) { match -> "${match.groupValues[1]}\"$url\"" }
        } ?: source
        output.parentFile.mkdirs()
        output.writeText(rewritten)
    }
}

android {
    namespace = "com.tourney.player"
    compileSdk = 36

    defaultConfig {
        applicationId = clientAppId
        minSdk = 24
        targetSdk = 36
        versionCode = clientVersionCode
        versionName = clientVersionName

        // App label comes straight from the client config.
        resValue("string", "app_name", clientAppName)

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }

    // Use the generated directory as the complete asset source so the
    // override never creates duplicate client_config.json entries.
    sourceSets["main"].assets.setSrcDirs(listOf(generatedApiConfigDir))
}

tasks.named("preBuild").configure { dependsOn(generateApiConfig) }

dependencies {
    implementation(project(":core"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)
    implementation(libs.androidx.navigation.compose)
    debugImplementation(libs.androidx.ui.tooling)
}
