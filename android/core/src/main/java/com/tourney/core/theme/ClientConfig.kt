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
    val apiBaseUrl: String,           // backend root, e.g. https://api.example.com/api/v1
    val primaryColorHex: String,
    val buttonColorHex: String,
    val accentColorHex: String,
    val cornerRadiusDp: Int,          // 4 = Sharp, 12 = Rounded, 999 = Pill
    val fontStyle: String,            // "rajdhani" | "orbitron" | "inter" | "poppins" | "default"
    val enableDarkMode: Boolean,
    val upiId: String,                // client's collection UPI ID (Add Cash QR / intent)
    val upiName: String,              // payee name shown in GPay / PhonePe / Paytm
    val minDeposit: Int,              // minimum top-up in ₹
    val supportWhatsapp: String,      // client support number (wa.me deep link), digits only
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
            apiBaseUrl = "http://localhost:5000/api/v1",
            primaryColorHex = "#FF5722",
            buttonColorHex = "#FF7043",
            accentColorHex = "#FFB300",
            cornerRadiusDp = 12,
            fontStyle = "default",
            enableDarkMode = true,
            upiId = "thunderesports@okaxis",
            upiName = "Thunder eSports",
            minDeposit = 10,
            supportWhatsapp = "",
        )

        /**
         * Parse assets/client_config.json.
         *
         * TWO schemas are supported:
         *  1. Flat (v1) — `{"app_name": "...", "primary_color": "..."}`
         *  2. Nested (v2, used by `clients/<slug>/client_config.json`) —
         *     `{"client": {...}, "theme": {...}, "backend": {...}, "payments": {...}}`
         *
         * Nested values win; flat keys stay as a backward-compatible fallback,
         * so old client builds keep working without a code change.
         */
        fun fromJson(json: JSONObject): ClientConfig {
            val client = json.optJSONObject("client")
            val theme = json.optJSONObject("theme")
            val backend = json.optJSONObject("backend")
            val payments = json.optJSONObject("payments")

            fun pick(nested: JSONObject?, key: String, legacyKey: String, fallback: String): String =
                nested?.optString(key)?.takeIf { it.isNotBlank() }
                    ?: json.optString(legacyKey, "").takeIf { it.isNotBlank() }
                    ?: fallback

            fun pickInt(nested: JSONObject?, key: String, legacyKey: String, fallback: Int): Int {
                nested?.let { if (it.has(key)) return it.optInt(key, fallback) }
                return if (json.has(legacyKey)) json.optInt(legacyKey, fallback) else fallback
            }

            fun pickBool(nested: JSONObject?, key: String, legacyKey: String, fallback: Boolean): Boolean {
                nested?.let { if (it.has(key)) return it.optBoolean(key, fallback) }
                return if (json.has(legacyKey)) json.optBoolean(legacyKey, fallback) else fallback
            }

            return ClientConfig(
                clientName = pick(client, "name", "client_name", DEFAULT.clientName),
                applicationId = pick(client, "application_id", "application_id", DEFAULT.applicationId),
                appName = pick(client, "app_name", "app_name", DEFAULT.appName),
                tenantId = pick(backend, "tenant_id", "tenant_id", DEFAULT.tenantId),
                apiBaseUrl = pick(backend, "api_base_url", "api_base_url", DEFAULT.apiBaseUrl),
                primaryColorHex = pick(theme, "primary_color", "primary_color", DEFAULT.primaryColorHex),
                buttonColorHex = pick(theme, "button_color", "button_color", DEFAULT.buttonColorHex),
                accentColorHex = pick(theme, "accent_color", "accent_color", DEFAULT.accentColorHex),
                cornerRadiusDp = pickInt(theme, "corner_radius_dp", "corner_radius_dp", DEFAULT.cornerRadiusDp),
                fontStyle = pick(theme, "font_style", "font_style", DEFAULT.fontStyle),
                enableDarkMode = pickBool(theme, "enable_dark_mode", "enable_dark_mode", DEFAULT.enableDarkMode),
                upiId = pick(payments, "upi_id", "upi_id", DEFAULT.upiId),
                upiName = pick(payments, "upi_name", "upi_name", DEFAULT.upiName),
                minDeposit = pickInt(payments, "min_deposit", "min_deposit", DEFAULT.minDeposit),
                supportWhatsapp = pick(payments, "support_whatsapp", "support_whatsapp", DEFAULT.supportWhatsapp),
            )
        }

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
