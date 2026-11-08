package com.tourney.admin

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import android.content.Intent
import androidx.core.content.FileProvider
import com.tourney.core.model.MatchParticipant
import com.tourney.core.model.MatchRosterResponse
import com.tourney.core.model.ParticipantFlag
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.LoadingState
import com.tourney.core.ui.formatMoney

private val FlagRed = Color(0xFFE53935)
private val OkGreen = Color(0xFF00C853)

/**
 * Phase 12 — Match roster. Opened by tapping a match number / "Players" row in
 * Manage Matches. One line per player (search + filter), tap a line to reward or
 * ban. Server computes the cheat flags; the app only renders them.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminMatchRosterScreen(
    viewModel: AdminViewModel,
    onBack: () -> Unit,
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    var actionTarget by remember { mutableStateOf<MatchParticipant?>(null) }
    var flagTarget by remember { mutableStateOf<Pair<MatchParticipant, ParticipantFlag>?>(null) }

    LaunchedEffect(Unit) { viewModel.clearRosterFeedback() }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize()) {
            val roster = (viewModel.rosterUi as? AdminUi.Success)?.data
            val title = roster?.match?.matchNumber?.let { "$it Players" } ?: "Match Players"
            AppTopBar(title = title, onBack = onBack)

            Column(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                roster?.let { SummaryStrip(it) }

                OutlinedTextField(
                    value = viewModel.rosterSearch,
                    onValueChange = {
                        viewModel.updateRosterSearch(it)
                        viewModel.refilterRoster()
                    },
                    label = { Text("Search player") },
                    placeholder = { Text("Player ID / IGN / FF UID / phone / slot number") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
                    modifier = Modifier.fillMaxWidth(),
                )

                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    RosterFilterChip(viewModel, "all", "👥 All")
                    RosterFilterChip(viewModel, "flagged", "🚨 Flagged")
                    RosterFilterChip(viewModel, "unpaid", "🎁 Unpaid")
                    RosterFilterChip(viewModel, "banned", "🚫 Banned")
                }

                // Phase 12.2 — keep a copy of the roster (identity + rewards + flags).
                val rosterForExport = (viewModel.rosterUi as? AdminUi.Success)?.data
                var exportError by remember { mutableStateOf<String?>(null) }
                if (rosterForExport != null && rosterForExport.match.slotsBooked > 0) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(
                            enabled = !viewModel.rosterExporting,
                            onClick = {
                                exportError = null
                                val label = rosterForExport.match.matchNumber?.let { "$it" }
                                    ?: rosterForExport.match.id.take(8)
                                viewModel.exportRosterCsv(rosterForExport.match.id, label) { file, error ->
                                    exportError = error
                                    if (file != null) {
                                        val uri = FileProvider.getUriForFile(
                                            context,
                                            "${context.packageName}.fileprovider",
                                            file,
                                        )
                                        val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                            type = "text/csv"
                                            putExtra(Intent.EXTRA_STREAM, uri)
                                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                        }
                                        context.startActivity(
                                            Intent.createChooser(shareIntent, "Share roster CSV"),
                                        )
                                    }
                                }
                            },
                        ) {
                            Text(
                                if (viewModel.rosterExporting) "⏳ Preparing CSV…" else "⬇ Share / Download CSV",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    }
                }
                exportError?.let {
                    Text("⚠️ $it", fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
                }

                viewModel.rosterMessage?.let {
                    Text(it, fontSize = 11.sp, color = OkGreen, fontWeight = FontWeight.SemiBold)
                }
                viewModel.rosterError?.let {
                    Text("⚠️ $it", fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
                }
            }

            when (val state = viewModel.rosterUi) {
                AdminUi.Idle, AdminUi.Loading -> LoadingState("Loading players…")
                is AdminUi.Error -> ErrorState(state.message) { viewModel.loadRoster(showSpinner = true) }
                is AdminUi.Success -> {
                    val players = state.data.participants
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        if (players.isEmpty()) {
                            item {
                                Text(
                                    if (state.data.match.slotsBooked == 0) {
                                        "No player has joined this match yet."
                                    } else {
                                        "No player matches this search / filter."
                                    },
                                    fontSize = 12.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                        items(players, key = { it.userId }) { player ->
                            ParticipantRow(
                                player = player,
                                busy = viewModel.rosterBusyUserId == player.userId,
                                onClick = {
                                    viewModel.clearRosterFeedback()
                                    actionTarget = player
                                },
                                onFlagClick = { flag -> flagTarget = player to flag },
                            )
                        }
                    }
                }
            }
        }
    }

    actionTarget?.let { player ->
        ParticipantActionSheet(
            viewModel = viewModel,
            participant = player,
            onDismiss = { actionTarget = null },
        )
    }

    flagTarget?.let { (player, flag) ->
        AlertDialog(
            onDismissRequest = { flagTarget = null },
            title = { Text("🚨 ${flagLabel(flag.code)}", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(flag.detail.ifBlank { "Suspicious activity detected." }, fontSize = 13.sp)
                    Text(
                        "${player.displayName} • UID ${player.inGameUid ?: "-"} • Slot ${player.slotNumber}",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    flagTarget = null
                    actionTarget = player
                }) { Text("Review player", fontWeight = FontWeight.Bold) }
            },
            dismissButton = {
                TextButton(onClick = { flagTarget = null }) { Text("Close") }
            },
        )
    }
}

@Composable
private fun RosterFilterChip(viewModel: AdminViewModel, value: String, label: String) {
    FilterChip(
        selected = viewModel.rosterFilter == value,
        onClick = {
            viewModel.updateRosterFilter(value)
            viewModel.refilterRoster()
        },
        label = { Text(label, fontSize = 11.sp) },
    )
}

@Composable
private fun SummaryStrip(roster: MatchRosterResponse) {
    val s = roster.summary
    val m = roster.match
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(
            buildString {
                append(m.mapType.lowercase().replaceFirstChar { it.uppercase() })
                append(" • ")
                append(m.matchType.lowercase().replaceFirstChar { it.uppercase() })
                append(" • ")
                append(m.status.replace('_', ' '))
            },
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.primary,
        )
        Text(
            "👥 ${m.slotsBooked}/${m.totalSlots} joined • 💰 ₹${formatMoney(s.totalEntryCollected.toDoubleOrNull() ?: 0.0)} collected" +
                " • 🎁 ₹${formatMoney(s.totalPrizePaid.toDoubleOrNull() ?: 0.0)} paid of ₹${formatMoney(m.prizePool.toDoubleOrNull() ?: 0.0)}",
            fontSize = 10.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (s.flagged > 0 || s.noUid > 0) {
            Text(
                "🚨 ${s.flagged} flagged • ${s.noUid} without FF UID",
                fontSize = 10.sp,
                color = FlagRed,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

/** One compact line per player (kept short on purpose — the boss asked for no big cards). */
@Composable
private fun ParticipantRow(
    player: MatchParticipant,
    busy: Boolean,
    onClick: () -> Unit,
    onFlagClick: (ParticipantFlag) -> Unit,
) {
    val paid = player.result?.isApproved == true
    Surface(
        modifier = Modifier.fillMaxWidth().clickable(enabled = !busy, onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(26.dp)
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.15f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text("${player.slotNumber}", fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.width(8.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        player.displayName,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                    if (player.isAccountBannedOrMatchBanned) {
                        Spacer(Modifier.width(4.dp))
                        Text("🚫", fontSize = 10.sp)
                    }
                    if (paid) {
                        Spacer(Modifier.width(4.dp))
                        Text("✓", fontSize = 10.sp, color = OkGreen, fontWeight = FontWeight.Bold)
                    }
                }
                Text(
                    "IGN ${player.inGameName ?: "-"} • UID ${player.inGameUid ?: "—"}",
                    fontSize = 9.5.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                player.flags.firstOrNull()?.let { flag ->
                    Text(
                        "🚨 ${flagLabel(flag.code)}",
                        fontSize = 9.sp,
                        color = FlagRed,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.clickable { onFlagClick(flag) },
                    )
                }
            }
            Spacer(Modifier.width(6.dp))
            Column(horizontalAlignment = Alignment.End) {
                val prize = player.result?.prizeValue ?: 0.0
                Text(
                    if (paid) "₹${formatMoney(prize)}" else "🎁 Pay",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (paid) OkGreen else MaterialTheme.colorScheme.primary,
                )
                player.result?.rank?.let {
                    Text("Rank $it", fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ParticipantActionSheet(
    viewModel: AdminViewModel,
    participant: MatchParticipant,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var rankText by remember { mutableStateOf(participant.result?.rank?.toString() ?: "1") }
    var killsText by remember { mutableStateOf(participant.result?.verifiedKills?.toString() ?: "0") }
    var completeMatch by remember { mutableStateOf(false) }
    var banSheet by remember { mutableStateOf(false) }

    val rank = rankText.toIntOrNull()?.takeIf { it in 1..99 }
    val kills = killsText.toIntOrNull()?.coerceIn(0, 99) ?: 0
    val busy = viewModel.rosterBusyUserId == participant.userId
    val alreadyPaid = participant.result?.isApproved == true
    val expected = viewModel.expectedPrize(rank, kills)

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp).padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                "${participant.displayName} • Slot ${participant.slotNumber}",
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
            )
            Text(
                "IGN ${participant.inGameName ?: "-"} • UID ${participant.inGameUid ?: "—"} • 📱 ${participant.phoneNumber}",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            participant.flags.forEach { flag ->
                Text(
                    "🚨 ${flagLabel(flag.code)} — ${flag.detail}",
                    fontSize = 10.sp,
                    color = FlagRed,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            HorizontalDivider()

            if (alreadyPaid) {
                Text(
                    "✅ Already paid ₹${formatMoney(participant.result?.prizeValue ?: 0.0)}" +
                        (participant.result?.rank?.let { " (rank $it)" } ?: "") +
                        " — ${participant.result?.verifiedKills ?: 0} kill(s)",
                    fontSize = 12.sp,
                    color = OkGreen,
                    fontWeight = FontWeight.SemiBold,
                )
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = rankText,
                    onValueChange = { rankText = it.filter { c -> c.isDigit() }.take(2) },
                    label = { Text("Rank") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                )
                OutlinedTextField(
                    value = killsText,
                    onValueChange = { killsText = it.filter { c -> c.isDigit() }.take(2) },
                    label = { Text("Kills") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                )
            }
            Text(
                "🎁 Prize preview: ₹${formatMoney(expected)}  (rank ${rank ?: "-"} + $kills kill)",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.primary,
            )

            Row(
                modifier = Modifier.fillMaxWidth().clickable { completeMatch = !completeMatch },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(if (completeMatch) "☑" else "☐", fontSize = 14.sp)
                Spacer(Modifier.width(6.dp))
                Text("Complete the match after paying", fontSize = 11.sp)
            }

            AppButton(
                text = when {
                    busy -> "⏳ Please wait…"
                    alreadyPaid -> "✅ Already paid"
                    participant.isAccountBannedOrMatchBanned -> "🚫 Banned player"
                    else -> "✅ Pay ₹${formatMoney(expected)}"
                },
                enabled = !busy && !alreadyPaid && !participant.isAccountBannedOrMatchBanned,
                onClick = {
                    viewModel.payParticipant(participant, rank, kills, completeMatch)
                    onDismiss()
                },
                modifier = Modifier.fillMaxWidth(),
            )

            if (participant.isAccountBannedOrMatchBanned) {
                AppButton(
                    text = if (busy) "⏳ Please wait…" else "✅ Unban",
                    enabled = !busy,
                    onClick = {
                        viewModel.banRosterParticipant(
                            participant,
                            isBanned = false,
                            reason = null,
                            banAccount = participant.accountBanned,
                        )
                        onDismiss()
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
            } else {
                AppButton(
                    text = "🚫 Ban",
                    enabled = !busy,
                    onClick = { banSheet = true },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }

    if (banSheet) {
        BanParticipantDialog(
            participant = participant,
            busy = busy,
            onDismiss = { banSheet = false },
            onConfirm = { reason, banAccount ->
                viewModel.banRosterParticipant(participant, true, reason, banAccount)
                banSheet = false
                onDismiss()
            },
        )
    }
}

@Composable
private fun BanParticipantDialog(
    participant: MatchParticipant,
    busy: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (reason: String, banAccount: Boolean) -> Unit,
) {
    var reason by remember { mutableStateOf("") }
    var banAccount by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("🚫 Ban ${participant.displayName}?", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "Choose how far this ban reaches. Both are reversible from this screen.",
                    fontSize = 12.sp,
                )
                Row(
                    modifier = Modifier.fillMaxWidth().clickable { banAccount = false },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(if (!banAccount) "☑" else "☐", fontSize = 14.sp)
                    Spacer(Modifier.width(6.dp))
                    Column {
                        Text("This match only", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        Text(
                            "Blocks the reward for this match. The account keeps playing elsewhere.",
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                Row(
                    modifier = Modifier.fillMaxWidth().clickable { banAccount = true },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(if (banAccount) "☑" else "☐", fontSize = 14.sp)
                    Spacer(Modifier.width(6.dp))
                    Column {
                        Text("Whole account", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        Text(
                            "Logs the player out instantly and blocks every match.",
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it.take(120) },
                    label = { Text("Reason (optional)") },
                    placeholder = { Text("Teaming / hacking / fake UID") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            TextButton(
                enabled = !busy,
                onClick = { onConfirm(reason.trim().ifBlank { "Banned by admin" }, banAccount) },
            ) {
                Text(
                    if (banAccount) "Ban Account" else "Ban from Match",
                    color = FlagRed,
                    fontWeight = FontWeight.Bold,
                )
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !busy) { Text("Cancel") }
        },
    )
}

private fun flagLabel(code: String): String = when (code) {
    "NO_FF_UID" -> "No FF UID"
    "UID_MISMATCH" -> "FF UID changed after joining"
    "SAME_DEVICE" -> "Same device in this match"
    "SAME_DEVICE_CROSS" -> "Same device in other matches"
    "ACCOUNT_BANNED" -> "Account banned"
    "DISQUALIFIED" -> "Disqualified"
    else -> code
}

