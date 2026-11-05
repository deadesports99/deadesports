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
    /** Admin's player-feed visibility window (null = listed immediately). */
    @Json(name = "visibilityHours") val visibilityHours: Int? = null,
    /** Server-computed instant when the match becomes visible to players. */
    @Json(name = "visibleFrom") val visibleFrom: String? = null,
    @Json(name = "isListedNow") val isListedNow: Boolean? = null,
    @Json(name = "secondsUntilListed") val secondsUntilListed: Long = 0,
    /** Staff or revealed custom room credentials. */
    val room: RoomCredentials? = null,
    @Json(name = "hasRoomCredentials") val hasRoomCredentials: Boolean? = null,
    @Json(name = "isRoomReady") val isRoomReady: Boolean? = null,
    /** Admin-chosen auto-reveal window for Room ID & Password (minutes before start). */
    @Json(name = "roomRevealMinutes") val roomRevealMinutes: Int = 15,
    /** Server-computed instant when the room credentials auto-reveal (IST). */
    @Json(name = "roomRevealsAt") val roomRevealsAt: String? = null,
    /** True when the admin already revealed (or the auto window has opened) the room. */
    @Json(name = "roomUnlocked") val roomUnlocked: Boolean? = null,
) {
    val entryFeeValue: Double get() = entryFee.toDoubleOrNull() ?: 0.0
    val prizePoolValue: Double get() = prizePool.toDoubleOrNull() ?: 0.0
    val perKillValue: Double get() = (perKillPrize ?: "0").toDoubleOrNull() ?: 0.0
    val remainingSlots: Int get() = (totalSlots - slotsBooked).coerceAtLeast(0)

    /** Slots-progress fraction for progress bars (0f..1f). */
    val fillFraction: Float
        get() = if (totalSlots > 0) (slotsBooked.toFloat() / totalSlots).coerceIn(0f, 1f) else 0f

    /** Epoch-ms when the admin's visibility window opens (null = immediately). */
    fun listedFromEpochMs(): Long? = visibleFrom?.let {
        runCatching { java.time.Instant.parse(it).toEpochMilli() }.getOrNull()
    }

    /** True if the visibility window has no restriction (admin chose "Always"). */
    val isAlwaysListed: Boolean get() = listedFromEpochMs() == null

    /** Schedule-only check — does the admin's window allow listing right now? */
    fun isListedBySchedule(nowEpochMs: Long = TimeAuthority.currentTimeMillis()): Boolean {
        val from = listedFromEpochMs() ?: return true
        return nowEpochMs >= from
    }

    /**
     * Should this match appear in the player feed right now? A player who has
     * already booked a seat always keeps seeing their match, even if the admin
     * tightened the window afterwards.
     */
    fun isVisibleInPlayerFeed(nowEpochMs: Long = TimeAuthority.currentTimeMillis()): Boolean {
        if (mySlot != null) return true
        return isListedBySchedule(nowEpochMs)
    }

    /** Seconds until the match becomes visible to players (0 when already listed). */
    fun secondsUntilListed(nowEpochMs: Long = TimeAuthority.currentTimeMillis()): Long {
        val from = listedFromEpochMs() ?: return 0L
        return if (nowEpochMs >= from) 0L else (from - nowEpochMs) / 1000L
    }

    /**
     * When the Room ID & Password become visible to joined players:
     * the admin decides per match (default 15 minutes before start), or the
     * admin can press "Reveal Now" (server sets roomRevealedAt -> roomUnlocked).
     */
    fun roomRevealAtEpochMs(): Long? {
        roomRevealsAt?.let { at ->
            runCatching { java.time.Instant.parse(at).toEpochMilli() }.getOrNull()?.let { return it }
        }
        val matchEpoch = runCatching { java.time.Instant.parse(matchTime).toEpochMilli() }.getOrNull()
        return matchEpoch?.minus(roomRevealMinutes.toLong() * 60_000L)
    }

    /** True when players may see the Room ID & Password right now. */
    fun isRoomUnlockedNow(nowEpochMs: Long = TimeAuthority.currentTimeMillis()): Boolean {
        if (roomUnlocked == true) return true
        if (room != null) return true
        val revealAt = roomRevealAtEpochMs() ?: return false
        return nowEpochMs >= revealAt
    }

    /** Returns true if the room reveal window is open (admin-controlled, not fixed T-15). */
    fun isWithin15MinWindow(nowEpochMs: Long = TimeAuthority.currentTimeMillis()): Boolean {
        return isRoomUnlockedNow(nowEpochMs)
    }

    /** Returns true if room credentials can be shown right now to a joined player. */
    fun isRoomReadyToView(nowEpochMs: Long = TimeAuthority.currentTimeMillis()): Boolean {
        if (mySlot == null) return false
        val unlocked = isRoomUnlockedNow(nowEpochMs) ||
            status == TournamentStatus.ROOM_REVEALED || status == TournamentStatus.LIVE
        val hasCreds = room != null || hasRoomCredentials == true || status == TournamentStatus.ROOM_REVEALED
        return unlocked && hasCreds
    }

    /** Countdown until the admin's room reveal time (0 when credentials are visible). */
    fun secondsUntilRoomReveal(nowEpochMs: Long = TimeAuthority.currentTimeMillis()): Long {
        if (isRoomUnlockedNow(nowEpochMs)) return 0L
        val revealAt = roomRevealAtEpochMs() ?: return Long.MAX_VALUE
        return if (nowEpochMs >= revealAt) 0L else (revealAt - nowEpochMs) / 1000L
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

    /** Returns true if server time has crossed the admin's room reveal threshold. */
    fun isRoomUnlockTime(nowEpochMs: Long = TimeAuthority.currentTimeMillis()): Boolean {
        return isRoomUnlockedNow(nowEpochMs)
    }

    /** "15 min before start", "2h before start", "1h 30m before start". */
    fun roomRevealLabel(): String {
        val m = roomRevealMinutes.coerceAtLeast(1)
        return when {
            m < 60 -> "$m min before start"
            m % 60 == 0 -> "${m / 60}h before start"
            else -> "${m / 60}h ${m % 60}m before start"
        }
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
    /** null = list immediately; N = show players only in the last N hours. */
    @Json(name = "visibilityHours") val visibilityHours: Int? = null,
    /** Room ID & Password auto-reveal: N minutes before match start (default 15). */
    @Json(name = "roomRevealMinutes") val roomRevealMinutes: Int? = null,
)

/** PATCH /tournaments/:id/visibility — admin tunes the player-feed window. */
@JsonClass(generateAdapter = true)
data class UpdateVisibilityRequest(
    /** null = list immediately; N = show players only in the last N hours. */
    @Json(name = "visibilityHours") val visibilityHours: Int? = null,
)

/** Room credentials payload (GET /tournaments/:id/room success; staff-only on details). */
@JsonClass(generateAdapter = true)
data class RoomCredentials(
    @Json(name = "roomId") val roomId: String? = null,
    @Json(name = "roomPassword") val roomPassword: String? = null,
    @Json(name = "roomRevealedAt") val roomRevealedAt: String? = null,
    @Json(name = "matchTime") val matchTime: String? = null,
    @Json(name = "secondsUntilReveal") val secondsUntilReveal: Long = 0,
    @Json(name = "roomRevealMinutes") val roomRevealMinutes: Int? = null,
    @Json(name = "roomRevealsAt") val roomRevealsAt: String? = null,
    @Json(name = "roomUnlocked") val roomUnlocked: Boolean? = null,
    val status: String? = null,
)

/** PATCH /tournaments/:id/room — publish custom room ID + password. */
@JsonClass(generateAdapter = true)
data class PublishRoomRequest(
    @Json(name = "roomId") val roomId: String,
    @Json(name = "roomPassword") val roomPassword: String,
    /** true = reveal to players immediately instead of waiting for the window. */
    @Json(name = "revealNow") val revealNow: Boolean? = null,
)

/** PATCH /tournaments/:id/room-reveal — admin decides WHEN players see the room. */
@JsonClass(generateAdapter = true)
data class RoomRevealRequest(
    /** Auto-reveal window in minutes before match start (1..10080). */
    @Json(name = "roomRevealMinutes") val roomRevealMinutes: Int? = null,
    /** Reveal to players immediately (requires published credentials). */
    @Json(name = "revealNow") val revealNow: Boolean? = null,
)