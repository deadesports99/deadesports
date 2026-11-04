package com.tourney.core.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// ─── Staff / Sub-Admin management (ADMIN only) ───────────────────────────
// GET    /auth/admin/staff       -> list hired staff + permissions
// POST   /auth/admin/staff       -> hire (phone-login account, no password)
// PATCH  /auth/admin/staff/:id   -> update permissions / details / active flag
// DELETE /auth/admin/staff/:id   -> deactivate (soft delete)

@JsonClass(generateAdapter = true)
data class StaffMember(
    val id: String,
    val name: String? = null,
    val email: String? = null,
    val phoneNumber: String,
    val role: Role = Role.SUB_ADMIN,
    val permissions: StaffPermissions = StaffPermissions.NONE,
    @Json(name = "isBanned") val isBanned: Boolean = false,
    @Json(name = "adminId") val adminId: String? = null,
) {
    val isActive: Boolean get() = !isBanned

    /** Compact chips shown on the staff card (🎮 Create / 🔑 Room / ...). */
    val permissionChips: List<String> get() = buildList {
        if (permissions.canCreateMatch) add("🎮 Create")
        if (permissions.canUpdateRoomId) add("🔑 Room")
        if (permissions.canDistributePrize) add("🏆 Prizes")
        if (permissions.canManageWallet) add("💳 Wallet")
    }
}

@JsonClass(generateAdapter = true)
data class StaffListResponse(
    val staff: List<StaffMember> = emptyList(),
    val count: Int = 0,
)

/** POST /auth/admin/staff body — the phone number is the staff login. */
@JsonClass(generateAdapter = true)
data class CreateStaffRequest(
    val name: String,
    val email: String,
    val phoneNumber: String,
    val permissions: StaffPermissions,
)

/** PATCH /auth/admin/staff/:id body — null fields are omitted by Moshi. */
@JsonClass(generateAdapter = true)
data class UpdateStaffRequest(
    val name: String? = null,
    val email: String? = null,
    val permissions: StaffPermissions? = null,
    @Json(name = "isActive") val isActive: Boolean? = null,
)

/** PATCH / DELETE response wrapper. */
@JsonClass(generateAdapter = true)
data class StaffActionResponse(
    val staff: StaffMember,
)
