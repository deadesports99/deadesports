package com.tourney.admin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.tourney.core.model.AdminPlayer
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.GlassCard
import com.tourney.core.ui.LoadingState
import com.tourney.core.ui.formatMoney

/**
 * 👥 Player Management (owner only) — search a player by Player ID / phone /
 * IGN / Free Fire UID and ban/unban the account. A ban kills their existing
 * session instantly (backend invalidates the auth cache).
 */
@Composable
fun AdminPlayersScreen(
    viewModel: AdminViewModel,
    onBack: () -> Unit,
) {
    var search by remember { mutableStateOf("") }
    var banTarget by remember { mutableStateOf<AdminPlayer?>(null) }

    LaunchedEffect(Unit) {
        viewModel.clearPlayerAdminFeedback()
        viewModel.loadPlayers()
    }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize()) {
            AppTopBar(title = "Player Management", onBack = onBack)

            Column(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = search,
                        onValueChange = { search = it.take(64) },
                        label = { Text("Search Player ID / phone / IGN / FF UID") },
                        placeholder = { Text("APX-0001 or 9876543210") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
                        modifier = Modifier.weight(1f),
                    )
                    AppButton(
                        text = "🔍",
                        onClick = { viewModel.loadPlayers(search) },
                        modifier = Modifier.height(52.dp),
                    )
                }
                viewModel.playerAdminMessage?.let {
                    Text(it, fontSize = 12.sp, color = Color(0xFF00C853), fontWeight = FontWeight.SemiBold)
                }
                viewModel.playerAdminError?.let {
                    Text("⚠️ $it", fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
                }
            }

            when (val state = viewModel.playersUi) {
                AdminUi.Idle, AdminUi.Loading -> LoadingState("Loading players…")
                is AdminUi.Error -> ErrorState(state.message) { viewModel.loadPlayers(search) }
                is AdminUi.Success -> {
                    val players = state.data.players
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        item {
                            Text(
                                "👥 Players (${state.data.total})",
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                            )
                        }
                        if (players.isEmpty()) {
                            item {
                                GlassCard(modifier = Modifier.fillMaxWidth()) {
                                    Text("No players found", fontWeight = FontWeight.Bold)
                                    Text(
                                        "Try another Player ID, phone, IGN or Free Fire UID.",
                                        fontSize = 12.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }
                        items(players, key = { it.id }) { player ->
                            PlayerAdminCard(
                                player = player,
                                busy = viewModel.playerBanBusyId == player.id,
                                onToggleBan = { banTarget = player },
                            )
                        }
                    }
                }
            }
        }
    }

    banTarget?.let { player ->
        val banning = !player.isBanned
        AlertDialog(
            onDismissRequest = { banTarget = null },
            title = {
                Text(
                    if (banning) "🚫 Ban ${player.displayName}?" else "✅ Unban ${player.displayName}?",
                    fontWeight = FontWeight.Bold,
                )
            },
            text = {
                Text(
                    if (banning) {
                        "This immediately blocks the player from logging in / using the app. " +
                            "Existing sessions stop working on their next request. Balance and history stay intact."
                    } else {
                        "The player will be able to log in and join matches again."
                    },
                    fontSize = 13.sp,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    val id = player.id
                    banTarget = null
                    viewModel.setPlayerBanned(id, banning)
                }) {
                    Text(
                        if (banning) "Ban Player" else "Unban Player",
                        color = if (banning) MaterialTheme.colorScheme.error else Color(0xFF00C853),
                        fontWeight = FontWeight.Bold,
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { banTarget = null }) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun PlayerAdminCard(
    player: AdminPlayer,
    busy: Boolean,
    onToggleBan: () -> Unit,
) {
    GlassCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 14.dp, contentPadding = 14.dp) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        player.playerCode ?: "No ID",
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    if (player.isBanned) {
                        Text(
                            "🚫 BANNED",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.error,
                        )
                    }
                }
                Text(
                    listOfNotNull(
                        player.inGameName?.takeIf { it.isNotBlank() },
                        player.name?.takeIf { it.isNotBlank() },
                    ).joinToString(" • ").ifBlank { "Unnamed player" },
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    "📱 ${player.phoneNumber}  •  🎮 UID: ${player.inGameUid ?: "-"}  •  ${player.matchesJoined} match(es)",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    "Deposit ₹${formatMoney(player.depositValue)}  •  Winning ₹${formatMoney(player.winningValue)}",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            Spacer(Modifier.height(0.dp))
        }
        Spacer(Modifier.height(8.dp))
        AppButton(
            text = when {
                busy -> "⏳ Please wait…"
                player.isBanned -> "✅ Unban Player"
                else -> "🚫 Ban Player"
            },
            enabled = !busy,
            onClick = onToggleBan,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
