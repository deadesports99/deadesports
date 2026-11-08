package com.tourney.admin

import com.tourney.core.model.SlotEntry

/**
 * Builds the spectator-scorer roster from a tournament's seat list.
 *
 * The backend always answers with **all 48 seats**, empty ones carrying
 * `player = null`. Only booked seats belong in the scorer, and every row needs a
 * stable, unique id: an empty seat used to map to `userId = ""` and the Compose
 * list key `""` was reused 46 times, which crashed the console with
 * `Key "" was already used`. Seats without a player are therefore dropped, and a
 * blank player id falls back to `slot-<n>` so the key stays unique.
 *
 * @param slots seat list as returned by `GET /tournaments/:id/slots`
 * @return booked participants in seat order. Every field starts empty: `rank = 0`
 *         (unranked), `verifiedKills = 0`, `isDone = false` — the spectator fills them in.
 */
fun scorerRoster(slots: List<SlotEntry>): List<ScorerPlayer> =
    slots
        .filter { it.player != null }
        .sortedBy { it.slotNumber }
        .map { slot ->
            val player = slot.player
            val userId = player?.id?.takeIf { it.isNotBlank() } ?: "slot-${slot.slotNumber}"
            ScorerPlayer(
                userId = userId,
                slotNumber = slot.slotNumber,
                inGameName = player?.inGameName?.takeIf { it.isNotBlank() } ?: "Player $userId",
                inGameUid = player?.inGameUid?.takeIf { it.isNotBlank() } ?: "-",
                verifiedKills = 0,
                // Nothing is pre-ranked: an untouched player submits with no rank, so a
                // half-finished console can never invent a Booyah winner.
                rank = 0,
                disqualified = false,
                isDone = false,
            )
        }
