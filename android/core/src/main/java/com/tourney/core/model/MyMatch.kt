package com.tourney.core.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * 🕘 MY MATCHES — one seat from the player's own history.
 *
 * The lobby hides finished matches, so this is the only record of a match the
 * player paid for: the seat, the spectator-verified result and the money
 * outcome. Everything is derived server-side from TournamentSlot + MatchResult
 * + WalletLedger; nothing on this screen is invented by the app.
 */
@JsonClass(generateAdapter = true)
data class MyMatchResult(
    val rank: Int? = null,
    val kills: Int = 0,
    @Json(name = "prizeWon") val prizeWon: Double = 0.0,
    @Json(name = "isApproved") val isApproved: Boolean = false,
    @Json(name = "isDisqualified") val isDisqualified: Boolean = false,
    @Json(name = "disqualifyReason") val disqualifyReason: String? = null,
)

@JsonClass(generateAdapter = true)
data class MyMatch(
    val id: String,
    @Json(name = "matchNumber") val matchNumber: Int? = null,
    val title: String = "",
    @Json(name = "matchType") val matchType: MatchType = MatchType.SOLO,
    @Json(name = "mapType") val mapType: MapType = MapType.BERMUDA,
    /** ISO-8601 kickoff (formatted in IST by the card). */
    @Json(name = "matchTime") val matchTime: String = "",
    val status: String = "",
    /** "upcoming" | "live" | "completed" | "cancelled" — decides the status pill. */
    val phase: String = "upcoming",
    @Json(name = "entryFee") val entryFee: Double = 0.0,
    @Json(name = "perKillPrize") val perKillPrize: Double = 0.0,
    @Json(name = "slotNumber") val slotNumber: Int = 0,
    @Json(name = "joinedAt") val joinedAt: String = "",
    @Json(name = "inGameNameSnapshot") val inGameNameSnapshot: String? = null,
    @Json(name = "inGameUidSnapshot") val inGameUidSnapshot: String? = null,
    @Json(name = "isBannedFromMatch") val isBannedFromMatch: Boolean = false,
    @Json(name = "banReason") val banReason: String? = null,
    @Json(name = "roomUnlocked") val roomUnlocked: Boolean = false,
    val room: RoomCredentials? = null,
    val result: MyMatchResult? = null,
    val refunded: Boolean = false,
    @Json(name = "refundAmount") val refundAmount: Double = 0.0,
    /** prize + refund − entry fee; null until the match is settled. */
    val net: Double? = null,
) {
    val mapLabel: String
        get() = when (mapType) {
            MapType.BERMUDA -> "Bermuda"
            MapType.PURGATORY -> "Purgatory"
            MapType.KALAHARI -> "Kalahari"
            MapType.ALPINE -> "Alpine"
            MapType.NEXTERRA -> "Nexterra"
        }

    val matchTypeLabel: String
        get() = when (matchType) {
            MatchType.SOLO -> "Solo"
            MatchType.DUO -> "Duo"
            MatchType.SQUAD -> "Squad"
        }

    /** "3 | Bermuda • Solo" — same identity the lobby card shows. */
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

    /** Published room that THIS seated player may open right now. */
    val canOpenRoom: Boolean
        get() = roomUnlocked && !room?.roomId.isNullOrBlank()

    /**
     * Kickoff time has arrived but the organiser has not started the match.
     * The server parks these rows in STARTING_SOON ("starting shortly"), so the
     * card must never claim LIVE or show a frozen countdown.
     */
    val isAwaitingStart: Boolean
        get() = status.uppercase() == "STARTING_SOON"

    val isSettled: Boolean
        get() = phaseEnum == MyMatchPhase.COMPLETED || phaseEnum == MyMatchPhase.CANCELLED

    val phaseEnum: MyMatchPhase
        get() = when (phase.lowercase()) {
            "live" -> MyMatchPhase.LIVE
            // Submitted for payout / auto-parked after kickoff: scoring is over,
            // so the player sees it as a finished match with "Result pending".
            "under_review" -> MyMatchPhase.COMPLETED
            "completed" -> MyMatchPhase.COMPLETED
            "cancelled" -> MyMatchPhase.CANCELLED
            else -> MyMatchPhase.UPCOMING
        }
}

enum class MyMatchPhase { UPCOMING, LIVE, COMPLETED, CANCELLED }

/** What the card's action button does — never "Join". */
enum class MyMatchActionKind {
    /** Custom room published — opens the Room ID sheet. */
    ROOM,

    /** Read-only scoreboard: live placement, kills and the final prize split. */
    STATUS,

    /** Nothing the player can do yet (kickoff passed, result awaited…). */
    PENDING,

    NONE,
}

/** The status pill on a history card (colour is chosen by the screen). */
enum class MyMatchTone { CYAN, AMBER, ROSE, EMERALD, GOLD, SLATE }

data class MyMatchPill(val label: String, val tone: MyMatchTone)

data class MyMatchAction(val label: String, val kind: MyMatchActionKind)

/** Single source of truth for the pill — the same rules on every screen. */
fun myMatchPill(match: MyMatch): MyMatchPill {
    if (match.isBannedFromMatch) return MyMatchPill("BANNED", MyMatchTone.ROSE)
    if (match.result?.isDisqualified == true) return MyMatchPill("DISQUALIFIED", MyMatchTone.ROSE)

    return when (match.phaseEnum) {
        MyMatchPhase.UPCOMING ->
            when {
                match.isAwaitingStart -> MyMatchPill("STARTING SOON", MyMatchTone.AMBER)
                match.canOpenRoom -> MyMatchPill("ROOM READY", MyMatchTone.AMBER)
                else -> MyMatchPill("JOINED", MyMatchTone.CYAN)
            }
        MyMatchPhase.LIVE -> MyMatchPill("LIVE", MyMatchTone.ROSE)
        MyMatchPhase.COMPLETED -> {
            val result = match.result
            when {
                result == null -> MyMatchPill("RESULT PENDING", MyMatchTone.SLATE)
                result.rank == 1 -> MyMatchPill("BOOYAH", MyMatchTone.GOLD)
                result.rank != null -> MyMatchPill("RANK #${result.rank}", MyMatchTone.EMERALD)
                else -> MyMatchPill("PLAYED", MyMatchTone.SLATE)
            }
        }
        MyMatchPhase.CANCELLED ->
            if (match.refunded) MyMatchPill("REFUNDED", MyMatchTone.SLATE)
            else MyMatchPill("CANCELLED", MyMatchTone.SLATE)
    }
}

/**
 * The replacement for the lobby's Join button: a room sheet, or **View Status**.
 *
 * Every match a player already paid for can be inspected — live (running
 * placement + kills), settled (final rank / kills / prize) and cancelled
 * (refund). Only a not-yet-started match without a room keeps a dead label,
 * because there is nothing to show but "wait".
 */
fun myMatchAction(match: MyMatch): MyMatchAction {
    // A ban or a DQ is exactly the thing a player wants to read in detail.
    if (match.isBannedFromMatch) return MyMatchAction("View Status", MyMatchActionKind.STATUS)
    if (match.result?.isDisqualified == true) return MyMatchAction("View Status", MyMatchActionKind.STATUS)

    return when (match.phaseEnum) {
        MyMatchPhase.UPCOMING, MyMatchPhase.LIVE ->
            when {
                match.canOpenRoom -> MyMatchAction("View Room ID", MyMatchActionKind.ROOM)
                // Kickoff passed, organiser has not gone live yet: keep the seat open.
                match.isAwaitingStart -> MyMatchAction("Please wait", MyMatchActionKind.PENDING)
                match.phaseEnum == MyMatchPhase.LIVE -> MyMatchAction("View Status", MyMatchActionKind.STATUS)
                else -> MyMatchAction("Joined — awaiting room", MyMatchActionKind.PENDING)
            }

        // Finished matches always keep their scoreboard reachable — before the
        // payout (declared) and after it (paid, with every player's prize).
        MyMatchPhase.COMPLETED -> MyMatchAction("View Status", MyMatchActionKind.STATUS)

        MyMatchPhase.CANCELLED -> MyMatchAction("View Status", MyMatchActionKind.STATUS)
    }
}

/** "+₹50" / "−₹20" / "₹0" — the money outcome on a settled card. */
fun formatMyMatchNet(net: Double?): String {
    if (net == null) return "—"
    val abs = formatMyMatchMoney(kotlin.math.abs(net))
    return when {
        net > 0 -> "+₹$abs"
        net < 0 -> "−₹$abs"
        else -> "₹0"
    }
}

/** "1,250.50" → "1,250.5" style: no trailing .0, Indian grouping. */
fun formatMyMatchMoney(amount: Double): String {
    val rounded = kotlin.math.round(amount * 100) / 100
    return if (rounded % 1.0 == 0.0) {
        String.format(java.util.Locale.US, "%,.0f", rounded)
    } else {
        String.format(java.util.Locale.US, "%,.2f", rounded)
    }
}

/**
 * Short "when" line under the seat: "in 2h 10m", "in 45m", "starting now",
 * "in progress", or "" when the kickoff time cannot be parsed.
 *
 * Pure on purpose — [nowMs] is passed in so the card stays testable.
 */
fun myMatchTiming(matchTimeIso: String, nowMs: Long, phase: MyMatchPhase): String {
    if (phase == MyMatchPhase.LIVE) return "in progress"
    val startMs = try {
        java.time.Instant.parse(matchTimeIso).toEpochMilli()
    } catch (e: Exception) {
        return ""
    }
    val deltaMs = startMs - nowMs
    // Kickoff passed but the match is not LIVE: the organiser has not started it
    // yet (backend status STARTING_SOON). Never read as "live" or "in progress".
    if (deltaMs <= 0) return "starting shortly"
    val minutes = (deltaMs + 59_999) / 60_000
    return when {
        minutes < 60 -> "in ${minutes}m"
        minutes < 24 * 60 -> "in ${minutes / 60}h ${minutes % 60}m"
        else -> "in ${minutes / (24 * 60)}d"
    }
}

/** The history filters — the API does the filtering, the chip just names it. */
enum class MyMatchBucket(val query: String, val label: String) {
    ALL("all", "All"),
    UPCOMING("upcoming", "Upcoming"),
    LIVE("live", "Live"),
    COMPLETED("completed", "Completed"),
    CANCELLED("cancelled", "Cancelled"),
}

/** Career strip counters (superset of the Profile stats payload). */
@JsonClass(generateAdapter = true)
data class MyMatchesSummary(
    @Json(name = "matchesJoined") val matchesJoined: Int = 0,
    @Json(name = "matchesPlayed") val matchesPlayed: Int = 0,
    val booyahs: Int = 0,
    @Json(name = "totalKills") val totalKills: Int = 0,
    @Json(name = "totalWinnings") val totalWinnings: Double = 0.0,
    @Json(name = "bestRank") val bestRank: Int? = null,
    @Json(name = "upcomingCount") val upcomingCount: Int = 0,
    @Json(name = "liveCount") val liveCount: Int = 0,
    @Json(name = "completedCount") val completedCount: Int = 0,
    @Json(name = "cancelledCount") val cancelledCount: Int = 0,
)

@JsonClass(generateAdapter = true)
data class MyMatchesResponse(
    val items: List<MyMatch> = emptyList(),
    val pagination: TournamentPagination = TournamentPagination(),
    val summary: MyMatchesSummary = MyMatchesSummary(),
)
