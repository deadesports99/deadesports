package com.tourney.core.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** Mirrors the backend Role enum exactly. */
enum class Role {
    ADMIN,      // client / tournament owner
    SUB_ADMIN,  // staff hired by the admin
    USER,       // gamer / player
}

/** Granular staff permissions (SUB_ADMIN only; ADMIN implicitly has all). */
@JsonClass(generateAdapter = true)
data class StaffPermissions(
    @Json(name = "canCreateMatch") val canCreateMatch: Boolean = false,
    @Json(name = "canUpdateRoomId") val canUpdateRoomId: Boolean = false,
    @Json(name = "canDistributePrize") val canDistributePrize: Boolean = false,
    @Json(name = "canManageWallet") val canManageWallet: Boolean = false,
) {
    companion object {
        val ALL = StaffPermissions(
            canCreateMatch = true,
            canUpdateRoomId = true,
            canDistributePrize = true,
            canManageWallet = true,
        )
        val NONE = StaffPermissions()
    }
}

/** Authenticated user profile (matches GET /auth/me). */
@JsonClass(generateAdapter = true)
data class User(
    val id: String,
    @Json(name = "tenantId") val tenantId: String,
    @Json(name = "phoneNumber") val phoneNumber: String,
    val email: String? = null,
    val name: String? = null,
    @Json(name = "inGameName") val inGameName: String? = null,
    @Json(name = "inGameUid") val inGameUid: String? = null,
    val role: Role,
    val permissions: StaffPermissions = StaffPermissions.NONE,
    @Json(name = "adminId") val adminId: String? = null,
    @Json(name = "depositBalance") val depositBalance: String? = null, // Decimal-as-string
    @Json(name = "winningBalance") val winningBalance: String? = null,
    @Json(name = "isBanned") val isBanned: Boolean = false,
) {
    val depositValue: Double get() = (depositBalance ?: "0").toDoubleOrNull() ?: 0.0
    val winningValue: Double get() = (winningBalance ?: "0").toDoubleOrNull() ?: 0.0

    /** Dynamic dashboard helper: does this user have the permission? */
    fun can(permission: Boolean): Boolean = when (role) {
        Role.ADMIN -> true
        Role.SUB_ADMIN -> permission
        Role.USER -> false
    }
}