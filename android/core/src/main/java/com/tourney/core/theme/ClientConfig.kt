package com.tourney.core.theme

import android.content.Context
import org.json.JSONObject

/**
 * 🔥 Central white-label configuration — the single source of truth that makes
 * every client build visually unique (Play-Store-safe differentiation).
 *
 * The SAME file (`client_config.json`, bundled in each app's assets) is read
 * at BUILD TIME by the Gradle script (applicationId + app name) and at RUNTIME
 * by this class (theme tokens).
 */
data class ClientConfig(
    val clientName: String,
    val applicationId: String,
    val appName: String,
    val tenantId: String,             // white-label tenant bound into this client build
    val apiBaseUrl: String,           // backend root, e.g. http://10.0.2.2:5000/api/v1
    val primaryColorHex: String,
    val buttonColorHex: String,
    val accentColorHex: String,
    val cornerRadiusDp: Int,          // 4 = Sharp, 12 = Rounded, 999 = Pill
    val fontStyle: String,            // "rajdhani" | "orbitron" | "inter" | "poppins" | "default"
    val enableDarkMode: Boolean,
) {
    /** Corner radius as Float for Compose RoundedCornerShape (clamped to a sane max). */
    val cornerRadius: Float = cornerRadiusDp.coerceIn(0, 48).toFloat()

    companion object {
        /** Fallback used when assets/client_config.json is missing (dev safety net). */
        val DEFAULT = ClientConfig(
            clientName = "Thunder eSports",
            applicationId = "com.thunderesports.player",
            appName = "Thunder eSports",
            tenantId = "22f27d39-f104-41b8-a435-befab60349ae",
            apiBaseUrl = "http://10.0.2.2:5000/api/v1",
            primaryColorHex = "#FF5722",
            buttonColorHex = "#FF7043",
            accentColorHex = "#FFB300",
            cornerRadiusDp = 12,
            fontStyle = "default",
            enableDarkMode = true,
        )

        /** Parse assets/client_config.json (org.json — no extra dependency). */
        fun fromJson(json: JSONObject): ClientConfig = ClientConfig(
            clientName = json.optString("client_name", DEFAULT.clientName),
            applicationId = json.optString("application_id", DEFAULT.applicationId),
            appName = json.optString("app_name", DEFAULT.appName),
            tenantId = json.optString("tenant_id", DEFAULT.tenantId),
            apiBaseUrl = json.optString("api_base_url", DEFAULT.apiBaseUrl),
            primaryColorHex = json.optString("primary_color", DEFAULT.primaryColorHex),
            buttonColorHex = json.optString("button_color", DEFAULT.buttonColorHex),
            accentColorHex = json.optString("accent_color", DEFAULT.accentColorHex),
            cornerRadiusDp = json.optInt("corner_radius_dp", DEFAULT.cornerRadiusDp),
            fontStyle = json.optString("font_style", DEFAULT.fontStyle),
            enableDarkMode = json.optBoolean("enable_dark_mode", DEFAULT.enableDarkMode),
        )

        /** Convenience: load from this app's bundled asset file. */
        fun load(context: Context): ClientConfig = try {
            context.assets.open("client_config.json").bufferedReader().use { reader ->
                fromJson(JSONObject(reader.readText()))
            }
        } catch (e: Exception) {
            // Asset missing → safe default (still builds and renders).
            DEFAULT
        }
    }
}