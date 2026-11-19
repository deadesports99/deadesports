package com.tourney.core.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import com.tourney.core.util.TimeAuthority

enum class GameMode { BATTLE_ROYALE, CLASH_SQUAD }

enum class MatchType { SOLO, DUO, SQUAD }

enum class MapType { BERMUDA, PURGATORY, KALAHARI, ALPINE, NEXTERRA }

enum class TournamentStatus {
    DRAFT, UPCOMING, OPEN, SLOTS_FULL, ROOM_REVEALED,
    /**
     * Kickoff time has passed but the organiser has NOT started the match yet.
     * Players see "starting shortly / please wait" — never "LIVE".
     */
    STARTING_SOON,
    LIVE, UNDER_REVIEW, COMPLETED, CANCELLED,
}

/** Tournament summary as returned by GET /tournaments & GET /tournaments/:id. */
@JsonClass(generateAdapter = true)
data class Tournament(
    val id: String,
    /** Auto-generated title ("Bermuda Solo #12") — players/admin see map+mode+#N instead. */
    val title: String,
    /** Auto-increment match number per tenant (1, 2, 3 …). */
    @Json(name = "matchNumber") val matchNumber: Int? = null,
    @Json(name = "gameMode") val gameMode: GameMode,
    @Json(name = "matchType") val matchType: MatchType,
    @Json(name = "mapType") val mapType: MapType,
    @Json(name = "entryFee") val entryFee: String,       // Decimal arrives as string
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
    val perKillValue: Double get() = (perKillPrize ?: "0").toDoubleOrNull() ?: 0.0
    val remainingSlots: Int get() = (totalSlots - slotsBooked).coerceAtLeast(0)

    /**
     * Kickoff has arrived but the organiser has not pressed "Go live".
     * The card shows "starting shortly — please wait" instead of a countdown.
     */
    val isAwaitingStart: Boolean get() = status == TournamentStatus.STARTING_SOON

    /** Human map label, e.g. "Bermuda". */
    val mapLabel: String
        get() = when (mapType) {
            MapType.BERMUDA -> "Bermuda"
            MapType.PURGATORY -> "Purgatory"
            MapType.KALAHARI -> "Kalahari"
            MapType.ALPINE -> "Alpine"
            MapType.NEXTERRA -> "Nexterra"
        }

    /** Human mode label, e.g. "Solo" / "Duo" / "Squad". */
    val matchTypeLabel: String
        get() = when (matchType) {
            MatchType.SOLO -> "Solo"
            MatchType.DUO -> "Duo"
            MatchType.SQUAD -> "Squad"
        }

    /**
     * What the player/admin sees instead of a custom title:
     * "50 | Bermuda • Solo" (auto match number, then map + mode).
     * The number comes first so the admin and staff can say "match 50" directly.
     */
    val displayName: String
        get() = buildString {
            if (matchNumber != null) {
                append(matchNumber)
                append(" | ")
            }
            append(mapLabel)
            append(" • ")
            append(matchTypeLabel)
        }

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
     * The room is published by staff — never by a clock. `roomRevealsAt` is only
     * set by older backends; the local fallback (matchTime - roomRevealMinutes)
     * used to hand the code to players before the admin published anything.
     */
    fun roomRevealAtEpochMs(): Long? =
        roomRevealsAt?.let { at -> runCatching { java.time.Instant.parse(at).toEpochMilli() }.getOrNull() }

    /** True only after an admin/sub-admin published the Room ID & Password. */
    fun isRoomUnlockedNow(nowEpochMs: Long = TimeAuthority.currentTimeMillis()): Boolean {
        if (roomUnlocked == true) return true
        return room != null
    }

    /** Returns true if the room reveal window is open (admin-controlled, not fixed T-15). */
    fun isWithin15MinWindow(nowEpochMs: Long = TimeAuthority.currentTimeMillis()): Boolean {
        return isRoomUnlockedNow(nowEpochMs)
    }

    /** Returns true if room credentials can be shown right now to a joined player. */
    fun isRoomReadyToView(nowEpochMs: Long = TimeAuthority.currentTimeMillis()): Boolean {
        if (mySlot == null) return false
        val published = isRoomUnlockedNow(nowEpochMs)
        val hasCreds = room != null || hasRoomCredentials == true
        return published && hasCreds
    }

    /** No countdown any more: 0 when published, [Long.MAX_VALUE] while it is not. */
    fun secondsUntilRoomReveal(nowEpochMs: Long = TimeAuthority.currentTimeMillis()): Long =
        if (isRoomUnlockedNow(nowEpochMs)) 0L else Long.MAX_VALUE

    /**
     * Entry closes 1 minute before kickoff (mirrors the backend rule), so a 6:00 PM
     * match cannot be joined from 5:59 PM.
     */
    fun isJoinClosed(nowEpochMs: Long = TimeAuthority.currentTimeMillis()): Boolean =
        secondsUntilMatch(nowEpochMs) <= 60L

    /** Seconds until match kicks off. */
    fun secondsUntilMatch(nowEpochMs: Long = TimeAuthority.currentTimeMillis()): Long {
        val matchEpoch = try {
            java.time.Instant.parse(matchTime).toEpochMilli()
        } catch (e: Exception) {
            return Long.MAX_VALUE
        }
        return if (nowEpochMs >= matchEpoch) 0L else (matchEpoch - nowEpochMs) / 1000L
    }

    /** True when staff already published the room credentials. */
    fun isRoomUnlockTime(nowEpochMs: Long = TimeAuthority.currentTimeMillis()): Boolean =
        isRoomUnlockedNow(nowEpochMs)

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
    /** How many players actually hold a seat — publish response only. */
    @Json(name = "seatedPlayers") val seatedPlayers: Int? = null,
    /** Server guard-rail text shown after a publish (e.g. nobody has joined). */
    @Json(name = "warning") val warning: String? = null,
)

