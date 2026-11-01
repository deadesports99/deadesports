import groovy.json.JsonSlurper
import java.io.File

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

/** Same 10-minute re-branding engine as :app-player, but admin identity. */
val clientConfigFile = File(projectDir, "src/main/assets/client_config.json")
val clientCfg = if (clientConfigFile.exists()) {
    JsonSlurper().parse(clientConfigFile) as Map<*, *>
} else {
    mapOf(
        "client_name" to "Thunder eSports",
        "application_id" to "com.tourney.admin",
        "app_name" to "Thunder eSports Admin",
    )
}
val clientAppId = (clientCfg["application_id"] as? String) ?: "com.tourney.admin"
val clientAppName = (clientCfg["app_name"] as? String) ?: "Thunder eSports Admin"

android {
    namespace = "com.tourney.admin"
    compileSdk = 36

    defaultConfig {
        applicationId = clientAppId
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"

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
}

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