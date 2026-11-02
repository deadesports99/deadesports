plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.tourney.core"
    compileSdk = 36

    defaultConfig {
        minSdk = 24
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        // AGP 8.4+ minifies local library deps together with the APP's own R8 run.
        // A library must NOT minify itself in isolation — it doesn't know which
        // classes the app uses → R8 strips them → app fails with "Missing classes".
        // Keep rules ship to the app via consumer-rules below.
        release {
            isMinifyEnabled = false
            consumerProguardFiles("proguard-rules.pro")
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
    implementation(libs.androidx.core.ktx)
    implementation(libs.kotlinx.coroutines.android)

    // Compose — Material 3 + dynamic system
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)
    debugImplementation(libs.androidx.ui.tooling)

    // Session: Jetpack DataStore (JWT + role + permissions, zero-delay dashboard)
    implementation(libs.androidx.datastore.preferences)

    // Networking: Retrofit + Moshi codegen (compile-time adapters, R8-safe)
    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.moshi)
    implementation(libs.moshi)
    ksp(libs.moshi.codegen)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)

    // FCM: high-priority push (room reveal / prize won / match cancelled)
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)

    // UPI deposit QR rendering (dynamic amount QR for Add Cash)
    implementation(libs.zxing.core)
}