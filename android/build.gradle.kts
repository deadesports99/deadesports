// Root build — declares plugins for all modules (applied per-module).
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.ksp) apply false
    // Firebase FCM: applied by an app module ONLY when google-services.json is present.
    id("com.google.gms.google-services") version "4.4.2" apply false
}