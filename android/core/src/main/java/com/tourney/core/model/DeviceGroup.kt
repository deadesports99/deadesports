package com.tourney.core.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * 📱 Device groups — one phone, many accounts. This is where prize-farming
 * actually shows: a single device fills several seats in the same room.
 */
@JsonClass(generateAdapter = true)
data class DeviceGroupsResponse(
    val groups: List<DeviceGroup> = emptyList(),
    val totalDevices: Int = 0,
    val minAccounts: Int = 2,
)

@JsonClass(generateAdapter = true)
data class DeviceGroup(
    @Json(name = "deviceId") val deviceId: String = "",
    @Json(name = "accountCount") val accountCount: Int = 0,
    @Json(name = "collidedMatchCount") val collidedMatchCount: Int = 0,
    @Json(name = "totalWinnings") val totalWinnings: Double = 0.0,
    @Json(name = "netOut") val netOut: Double = 0.0,
    @Json(name = "bannedCount") val bannedCount: Int = 0,
    val accounts: List<DeviceGroupAccount> = emptyList(),
) {
    val shortDeviceId: String
        get() = if (deviceId.length > 12) deviceId.take(8) + "…" + deviceId.takeLast(4) else deviceId

    /** Accounts meeting each other in the same match is the strongest signal. */
    val highRisk: Boolean get() = collidedMatchCount > 0 && accountCount >= 3
}

@JsonClass(generateAdapter = true)
data class DeviceGroupAccount(
    @Json(name = "userId") val userId: String = "",
    @Json(name = "playerCode") val playerCode: String? = null,
    @Json(name = "inGameName") val inGameName: String? = null,
    @Json(name = "isBanned") val isBanned: Boolean = false,
) {
    val displayName: String get() = playerCode ?: inGameName ?: userId.take(8)
}

/** GET /admin/players/devices/:deviceId */
@JsonClass(generateAdapter = true)
data class DeviceGroupDetail(
    @Json(name = "deviceId") val deviceId: String = "",
    val accounts: List<DeviceAccount> = emptyList(),
    @Json(name = "sharedMatches") val sharedMatches: List<DeviceSharedMatch> = emptyList(),
    val totals: DeviceGroupTotals = DeviceGroupTotals(),
)

@JsonClass(generateAdapter = true)
data class DeviceAccount(
    @Json(name = "userId") val userId: String = "",
    @Json(name = "playerCode") val playerCode: String? = null,
    @Json(name = "inGameName") val inGameName: String? = null,
    val name: String? = null,
    @Json(name = "phoneNumber") val phoneNumber: String = "",
    @Json(name = "inGameUid") val inGameUid: String? = null,
    @Json(name = "isBanned") val isBanned: Boolean = false,
    @Json(name = "matchesJoined") val matchesJoined: Int = 0,
    @Json(name = "collidedMatches") val collidedMatches: Int = 0,
    @Json(name = "totalWinnings") val totalWinnings: Double = 0.0,
    @Json(name = "totalDeposited") val totalDeposited: Double = 0.0,
    @Json(name = "totalWithdrawn") val totalWithdrawn: Double = 0.0,
    @Json(name = "netOut") val netOut: Double = 0.0,
    @Json(name = "createdAt") val createdAt: String? = null,
    @Json(name = "lastPlayedAt") val lastPlayedAt: String? = null,
) {
    val displayName: String get() = playerCode ?: inGameName ?: name ?: phoneNumber
}

@JsonClass(generateAdapter = true)
data class DeviceSharedMatch(
    @Json(name = "tournamentId") val tournamentId: String = "",
    @Json(name = "matchNumber") val matchNumber: Int? = null,
    @Json(name = "mapType") val mapType: String = "",
    @Json(name = "matchType") val matchType: String = "",
    val status: String = "",
    @Json(name = "accountCodes") val accountCodes: List<String> = emptyList(),
) {
    val displayName: String
        get() = buildString {
            if (matchNumber != null) {
                append(matchNumber)
                append(" | ")
            }
            append(mapType.lowercase().replaceFirstChar { it.uppercase() })
            append(" • ")
            append(matchType.lowercase().replaceFirstChar { it.uppercase() })
        }
}

@JsonClass(generateAdapter = true)
data class DeviceGroupTotals(
    val accountCount: Int = 0,
    val bannedCount: Int = 0,
    @Json(name = "collidedMatchCount") val collidedMatchCount: Int = 0,
    @Json(name = "totalWinnings") val totalWinnings: Double = 0.0,
    @Json(name = "totalDeposited") val totalDeposited: Double = 0.0,
    @Json(name = "totalWithdrawn") val totalWithdrawn: Double = 0.0,
    @Json(name = "netOut") val netOut: Double = 0.0,
)

/** PATCH /admin/players/devices/:deviceId/ban */
@JsonClass(generateAdapter = true)
data class DeviceBanRequest(
    @Json(name = "isBanned") val isBanned: Boolean,
)

@JsonClass(generateAdapter = true)
data class DeviceBanResponse(
    @Json(name = "deviceId") val deviceId: String = "",
    val requested: Int = 0,
    val updated: Int = 0,
    val accounts: List<String> = emptyList(),
)
