package com.tourney.core.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * 🎁 REWARDS — referral · daily bonus · tasks.
 *
 * Backed by `GET /rewards/summary`, which returns the whole Rewards tab in one
 * round trip. Every block is nullable: a module switched off server-side comes
 * back as `null` (and its endpoints 404), so an old APK renders nothing instead
 * of an error.
 *
 * All money here is NON-WITHDRAWABLE play money credited to the deposit balance.
 */

@JsonClass(generateAdapter = true)
data class RewardsFeatures(
    @Json(name = "daily_bonus") val dailyBonus: Boolean = false,
    val tasks: Boolean = false,
    val referral: Boolean = false,
    @Json(name = "earn_hub") val earnHub: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class RewardsConfig(
    @Json(name = "dailyLadder") val dailyLadder: List<Double> = emptyList(),
    @Json(name = "referralPerFriend") val referralPerFriend: Double = 0.0,
    @Json(name = "referralFriendReward") val referralFriendReward: Double = 0.0,
    @Json(name = "referralMinMatches") val referralMinMatches: Int = 0,
)

@JsonClass(generateAdapter = true)
data class DailyBonusState(
    val available: Boolean = false,
    @Json(name = "claimedToday") val claimedToday: Boolean = false,
    val amount: Double = 0.0,
    val streakDay: Int = 1,
    val streakTarget: Int = 7,
    val ladder: List<Double> = emptyList(),
    /** "CLAIMED_TODAY" | "MIN_MATCHES" | null */
    @Json(name = "blockedReason") val blockedReason: String? = null,
    @Json(name = "minMatches") val minMatches: Int = 0,
    @Json(name = "matchesPlayed") val matchesPlayed: Int = 0,
    @Json(name = "nextClaimInSeconds") val nextClaimInSeconds: Long = 0L,
) {
    val waitLabel: String
        get() {
            if (nextClaimInSeconds <= 0) return ""
            val hours = nextClaimInSeconds / 3600
            val minutes = (nextClaimInSeconds % 3600) / 60
            return if (hours > 0) "${hours}h ${minutes}m" else "${minutes}m"
        }
}

@JsonClass(generateAdapter = true)
data class RewardTask(
    val id: String = "",
    val code: String = "",
    val title: String = "",
    val description: String? = null,
    val reward: Double = 0.0,
    val progress: Int = 0,
    val target: Int = 1,
    val claimable: Boolean = false,
    val claimed: Boolean = false,
    /** Repeatable tasks reset every N days; one-time tasks never come back. */
    val repeatable: Boolean = false,
) {
    val fraction: Float
        get() = if (target <= 0) 0f else (progress.toFloat() / target).coerceIn(0f, 1f)
}

@JsonClass(generateAdapter = true)
data class ReferralInvitee(
    val ign: String? = null,
    /** PENDING | QUALIFIED | PAID | VOID */
    val status: String = "PENDING",
    @Json(name = "joinedAt") val joinedAt: String? = null,
    @Json(name = "qualifiedAt") val qualifiedAt: String? = null,
)

@JsonClass(generateAdapter = true)
data class ReferralInfo(
    val code: String = "",
    @Json(name = "shareText") val shareText: String = "",
    val invited: Int = 0,
    val qualified: Int = 0,
    val paid: Int = 0,
    val earned: Double = 0.0,
    @Json(name = "pendingCount") val pendingCount: Int = 0,
    @Json(name = "rewardPerFriend") val rewardPerFriend: Double = 0.0,
    @Json(name = "friendReward") val friendReward: Double = 0.0,
    @Json(name = "minMatches") val minMatches: Int = 0,
    /** True once this player has used someone else's code. */
    val applied: Boolean = false,
    val invitees: List<ReferralInvitee> = emptyList(),
)

/** GET /rewards/summary */
@JsonClass(generateAdapter = true)
data class RewardsSummary(
    val features: RewardsFeatures = RewardsFeatures(),
    val config: RewardsConfig = RewardsConfig(),
    @Json(name = "dailyBonus") val dailyBonus: DailyBonusState? = null,
    val tasks: List<RewardTask> = emptyList(),
    val referral: ReferralInfo? = null,
) {
    val claimableTasks: Int
        get() = tasks.count { it.claimable }

    val hasAnyClaim: Boolean
        get() = (dailyBonus?.available == true) || claimableTasks > 0

    val allTasksDone: Boolean
        get() = tasks.isNotEmpty() && tasks.all { it.claimed }
}

/** Response of a successful claim — the new balances are enough for the UI. */
@JsonClass(generateAdapter = true)
data class RewardClaimAck(
    val credited: Double = 0.0,
    @Json(name = "depositBalance") val depositBalance: Double = 0.0,
    @Json(name = "winningBalance") val winningBalance: Double = 0.0,
)

@JsonClass(generateAdapter = true)
data class ApplyReferralRequest(
    val code: String,
)
