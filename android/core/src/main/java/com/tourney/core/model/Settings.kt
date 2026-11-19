package com.tourney.core.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Runtime tenant settings — owned by the client and read by every player
 * device. This is what makes the Add-Cash QR + WhatsApp support link
 * changeable without shipping a new APK.
 */
@JsonClass(generateAdapter = true)
data class TenantSettings(
    val brandName: String = "",
    @Json(name = "upiId") val upiId: String = "",
    @Json(name = "upiName") val upiName: String = "",
    @Json(name = "supportWhatsapp") val supportWhatsapp: String = "",
    @Json(name = "minDeposit") val minDeposit: Int = 10,
    /** Player sign-in methods. Email/OTP sign-in has been removed from the app. */
    @Json(name = "allowPhoneAuth") val allowPhoneAuth: Boolean = true,
    @Json(name = "allowGoogleAuth") val allowGoogleAuth: Boolean = true,
    /**
     * Server-side reward-module kill switch. Absent key = no opinion (the APK's
     * build flag decides); `false` hides the module without a new release.
     */
    val features: Map<String, Boolean> = emptyMap(),
) {
    /** Never render a blank payee name. */
    val payeeName: String get() = upiName.ifBlank { brandName }
}

/** GET /players/me/stats — career card in the Profile tab. */
@JsonClass(generateAdapter = true)
data class PlayerStats(
    @Json(name = "matchesJoined") val matchesJoined: Int = 0,
    @Json(name = "matchesPlayed") val matchesPlayed: Int = 0,
    val booyahs: Int = 0,
    @Json(name = "totalKills") val totalKills: Int = 0,
    @Json(name = "totalWinnings") val totalWinnings: Double = 0.0,
    @Json(name = "bestRank") val bestRank: Int? = null,
)


