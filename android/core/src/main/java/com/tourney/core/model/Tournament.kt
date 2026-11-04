package com.tourney.core.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import com.tourney.core.util.TimeAuthority

enum class GameMode { BATTLE_ROYALE, CLASH_SQUAD }

enum class MatchType { SOLO, DUO, SQUAD }

enum class MapType { BERMUDA, PURGATORY, KALAHARI, ALPINE, NEXTERRA }

enum class TournamentStatus {
    DRAFT, UPCOMING, OPEN, SLOTS_FULL, ROOM_REVEALED, LIVE, UNDER_REVIEW, COMPLETED, CANCELLED,
}

/** Tournament summary as returned by GET /tournaments & GET /tournaments/:id. */
@JsonClass(generateAdapter = true)
data class Tournament(
    val id: String,
    val title: String,
    @Json(name = "gameMode") val gameMode: GameMode,
    @Json(name = "matchType") val matchType: MatchType,
    @Json(name = "mapType") val mapType: MapType,
    @Json(name = "entryFee") val entryFee: String,       // Decimal arrives as string
    @Json(name = "prizePool") val prizePool: String,
    @Json(name = "perKillPrize") val perKillPrize: String? = null,
    @Json(name = "totalSlots") val totalSlots: Int = 48,
    @Json(name = "matchTime") val matchTime: String,     // ISO-8601
    val status: TournamentStatus,
    @Json(name = "slotsBooked") val slotsBooked: Int = 0,
    @Json(name = "mySlot") val mySlot: MySlot? = null,
    /** Staff-only: published custom room (players never receive it). */
    val room: RoomCredentials? = null,
) {
    val entryFeeValue: Double get() = entryFee.toDoubleOrNull() ?: 0.0
    val prizePoolValue: Double get() = prizePool.toDoubleOrNull() ?: 0.0
    val perKillValue: Double get() = (perKillPrize ?: "0").toDoubleOrNull() ?: 0.0
    val remainingSlots: Int get() = (totalSlots - slotsBooked).coerceAtLeast(0)

    /** Slots-progress fraction for progress bars (0f..1f). */
    val fillFraction: Float
        get() = if (totalSlots > 0) (slotsBooked.toFloat() / totalSlots).coerceIn(0f, 1f) else 0f

    /** 15-minute countdown helper: time until room creds unlock (Authoritative IST Server Time). */
    fun secondsUntilRoomReveal(nowEpochMs: Long = TimeAuthority.currentTimeMillis()): Long {
        val matchEpoch = try {
            java.time.Instant.parse(matchTime).toEpochMilli()
        } catch (e: Exception) {
            return Long.MAX_VALUE
        }
        val unlockTime = matchEpoch - 15 * 60 * 1000L
        return if (nowEpochMs >= unlockTime) 0L else (unlockTime - nowEpochMs) / 1000L
    }

    /** Seconds until match kicks off. */
    fun secondsUntilMatch(nowEpochMs: Long = TimeAuthority.currentTimeMillis()): Long {
        val matchEpoch = try {
            java.time.Instant.parse(matchTime).toEpochMilli()
        } catch (e: Exception) {
            return Long.MAX_VALUE
        }
        return if (nowEpochMs >= matchEpoch) 0L else (matchEpoch - nowEpochMs) / 1000L
    }

    /** Returns true if server time has crossed the 15-minute room reveal threshold. */
    fun isRoomUnlockTime(nowEpochMs: Long = TimeAuthority.currentTimeMillis()): Boolean {
        return secondsUntilRoomReveal(nowEpochMs) == 0L
    }

    /** Returns true if server time has reached or passed match start. */
    fun isMatchStarted(nowEpochMs: Long = TimeAuthority.currentTimeMillis()): Boolean {
        return secondsUntilMatch(nowEpochMs) == 0L
    }
}

/** GET /tournaments list envelope. */
@JsonClass(generateAdapter = true)
data class TournamentListResponse(
    val items: List<Tournament> = emptyList(),
    val pagination: TournamentPagination = TournamentPagination(),
)

@JsonClass(generateAdapter = true)
data class TournamentPagination(
    val page: Int = 1,
    val limit: Int = 10,
    val total: Int = 0,
    @Json(name = "totalPages") val totalPages: Int = 0,
)

@JsonClass(generateAdapter = true)
data class MySlot(
    @Json(name = "slotNumber") val slotNumber: Int,
    @Json(name = "teamId") val teamId: String? = null,
)

/** GET /tournaments/:id/slots — 48-seat grid. */
@JsonClass(generateAdapter = true)
data class SlotsResponse(
    @Json(name = "totalSlots") val totalSlots: Int = 48,
    val booked: Int = 0,
    val slots: List<SlotEntry> = emptyList(),
)

/** Seat list item. */
@JsonClass(generateAdapter = true)
data class SlotEntry(
    @Json(name = "slotNumber") val slotNumber: Int,
    @Json(name = "teamId") val teamId: String? = null,
    val player: SlotPlayer? = null,
) {
    val isBooked: Boolean get() = player != null

    @JsonClass(generateAdapter = true)
    data class SlotPlayer(
        val id: String,
        @Json(name = "inGameName") val inGameName: String?,
        @Json(name = "inGameUid") val inGameUid: String?,
    )
}

/** POST /tournaments/:id/join request — slotNumber optional (auto-assigned by backend if omitted). */
@JsonClass(generateAdapter = true)
data class JoinRequest(
    @Json(name = "slotNumber") val slotNumber: Int? = null,
    @Json(name = "teamCode") val teamCode: String? = null,
    @Json(name = "inGameName") val inGameName: String? = null,
    @Json(name = "inGameUid") val inGameUid: String? = null,
    @Json(name = "saveAsDefault") val saveAsDefault: Boolean? = true,
)

/** POST /tournaments/:id/join response. teamCode only returned to squad leader. */
@JsonClass(generateAdapter = true)
data class JoinResult(
    @Json(name = "slotNumber") val slotNumber: Int,
    @Json(name = "teamId") val teamId: String? = null,
    @Json(name = "teamCode") val teamCode: String? = null,
    @Json(name = "entryFee") val entryFee: String,
    @Json(name = "balanceAfter") val balanceAfter: String,
    @Json(name = "tournamentStatus") val tournamentStatus: String,
)

/** POST /tournaments — create match (requires canCreateMatch). */
@JsonClass(generateAdapter = true)
data class CreateTournamentRequest(
    val title: String,
    @Json(name = "gameMode") val gameMode: GameMode,
    @Json(name = "matchType") val matchType: MatchType,
    @Json(name = "mapType") val mapType: MapType,
    @Json(name = "entryFee") val entryFee: Double,
    @Json(name = "prizePool") val prizePool: Double,
    @Json(name = "perKillPrize") val perKillPrize: Double? = null,
    @Json(name = "matchTime") val matchTime: String,     // ISO-8601, future
    @Json(name = "totalSlots") val totalSlots: Int? = 48,
)

/** Room credentials payload (GET /tournaments/:id/room success; staff-only on details). */
@JsonClass(generateAdapter = true)
data class RoomCredentials(
    @Json(name = "roomId") val roomId: String? = null,
    @Json(name = "roomPassword") val roomPassword: String? = null,
    @Json(name = "roomRevealedAt") val roomRevealedAt: String? = null,
    @Json(name = "matchTime") val matchTime: String? = null,
    @Json(name = "secondsUntilReveal") val secondsUntilReveal: Long = 0,
)

/** PATCH /tournaments/:id/room — publish custom room ID + password. */
@JsonClass(generateAdapter = true)
data class PublishRoomRequest(
    @Json(name = "roomId") val roomId: String,
    @Json(name = "roomPassword") val roomPassword: String,
)