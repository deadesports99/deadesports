package com.tourney.player.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.theme.ThemeMode
import com.tourney.core.ui.formatMoney
import com.tourney.player.PlayerViewModel
import com.tourney.player.UiState
import com.tourney.player.ui.common.DemoMessage
import com.tourney.player.ui.common.DemoTextField
import com.tourney.player.ui.common.GoldButton
import com.tourney.player.ui.common.SpartanCrest
import com.tourney.player.ui.theme.DemoColors
import com.tourney.player.ui.theme.DemoRadius
import com.tourney.player.ui.theme.DemoText

/**
 * Profile tab — demo design over the real API:
 * `GET /auth/me` for identity, `GET /players/me/stats` for career numbers and
 * `PATCH /players/me/game-profile` for the Free Fire IGN/UID the organiser needs.
 */
@Composable
fun ProfileScreen(
    viewModel: PlayerViewModel,
    themeMode: ThemeMode,
    onSetThemeMode: (ThemeMode) -> Unit,
    onLogout: () -> Unit,
    onToast: (String) -> Unit,
) {
    val context = LocalContext.current
    val meState = viewModel.meUi
    val statsState = viewModel.statsUi
    val me = (meState as? UiState.Success)?.data
    val stats = (statsState as? UiState.Success)?.data

    var ign by remember(me?.inGameName) { mutableStateOf(me?.inGameName.orEmpty()) }
    var uid by remember(me?.inGameUid) { mutableStateOf(me?.inGameUid.orEmpty()) }
    var saveError by remember { mutableStateOf<String?>(null) }
    var saved by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { viewModel.loadProfile() }

    val ignOk = ign.trim().length in 2..30
    val uidOk = uid.trim().length in 6..12 && uid.all { it.isDigit() }
    val dirty = ign.trim() != me?.inGameName.orEmpty() || uid.trim() != me?.inGameUid.orEmpty()

    Column(modifier = Modifier.fillMaxSize()) {
        // ── Header ───────────────────────────────────────────────────────
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(DemoColors.Canvas.copy(alpha = 0.92f))
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SpartanCrest()
            Spacer(Modifier.width(10.dp))
            Text(
                "Player Profile",
                fontSize = DemoText.Title,
                fontWeight = FontWeight.Black,
                color = DemoColors.TextPrimary,
            )
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // ── Identity card ────────────────────────────────────────────
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(DemoRadius.Card))
                        .background(DemoColors.Card.copy(alpha = 0.92f))
                        .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Card))
                        .padding(16.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(52.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(DemoColors.CardElevated)
                                .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(16.dp)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                Icons.Filled.Phone,
                                contentDescription = null,
                                tint = DemoColors.TextSecondary,
                                modifier = Modifier.size(22.dp),
                            )
                        }
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .padding(start = 12.dp),
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    me?.name ?: "Spartan Player",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Black,
                                    color = DemoColors.TextPrimary,
                                )
                                Spacer(Modifier.width(8.dp))
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(DemoColors.TextPrimary.copy(alpha = 0.06f))
                                        .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(6.dp))
                                        .padding(horizontal = 6.dp, vertical = 2.dp),
                                ) {
                                    Text(
                                        "VERIFIED",
                                        fontSize = 8.sp,
                                        fontWeight = FontWeight.Black,
                                        color = DemoColors.TextSecondary,
                                    )
                                }
                            }
                            Text(
                                "+91 ${me?.phoneNumber ?: "—"}",
                                fontSize = DemoText.Body,
                                fontWeight = FontWeight.Bold,
                                color = DemoColors.TextSecondary,
                                modifier = Modifier.padding(top = 2.dp),
                            )
                            Text(
                                "Player ID: ${me?.playerCode ?: "—"}",
                                fontSize = DemoText.Tiny,
                                color = DemoColors.TextFaint,
                                modifier = Modifier.padding(top = 2.dp),
                            )
                        }
                    }

                    // Career numbers.
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 14.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        StatBox("Matches", "${stats?.matchesJoined ?: 0}", Modifier.weight(1f))
                        StatBox("Booyahs", "${stats?.booyahs ?: 0}", Modifier.weight(1f))
                        StatBox("Kills", "${stats?.totalKills ?: 0}", Modifier.weight(1f))
                        StatBox("Winnings", "₹${formatMoney(stats?.totalWinnings ?: 0.0)}", Modifier.weight(1f))
                    }

                    if (meState is UiState.Error) {
                        Box(modifier = Modifier.padding(top = 10.dp)) {
                            DemoMessage((meState as UiState.Error).message)
                        }
                    }
                }
            }

            // ── Free Fire identity (editable) ────────────────────────────
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(DemoRadius.Card))
                        .background(DemoColors.Card.copy(alpha = 0.85f))
                        .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Card))
                        .padding(16.dp),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "YOUR FREE FIRE DETAILS",
                            fontSize = DemoText.Tiny,
                            fontWeight = FontWeight.Black,
                            color = DemoColors.TextMuted,
                        )
                        if (saved) {
                            Text(
                                "Saved ✓",
                                fontSize = DemoText.Tiny,
                                fontWeight = FontWeight.Black,
                                color = DemoColors.Success,
                            )
                        }
                    }

                    DemoTextField(
                        value = ign,
                        onValueChange = { ign = it; saved = false },
                        label = "In-Game Name (IGN)",
                        placeholder = "e.g. SpartanOP",
                        enabled = !viewModel.isUpdatingProfile,
                        maxLength = 30,
                        isError = ign.isNotEmpty() && !ignOk,
                        modifier = Modifier.padding(top = 12.dp),
                    )
                    DemoTextField(
                        value = uid,
                        onValueChange = { uid = it; saved = false },
                        label = "Free Fire UID",
                        placeholder = "6-12 digit UID",
                        enabled = !viewModel.isUpdatingProfile,
                        digitsOnly = true,
                        maxLength = 12,
                        isError = uid.isNotEmpty() && !uidOk,
                        modifier = Modifier.padding(top = 10.dp),
                    )

                    if (saveError != null) {
                        Box(modifier = Modifier.padding(top = 10.dp)) {
                            DemoMessage(saveError ?: "")
                        }
                    }

                    GoldButton(
                        text = when {
                            viewModel.isUpdatingProfile -> "Saving..."
                            dirty -> "Save Free Fire details"
                            else -> "Saved to your profile"
                        },
                        onClick = {
                            saveError = null
                            viewModel.updateGameProfile(ign, uid) { ok, message ->
                                if (ok) {
                                    saved = true
                                    onToast("Free Fire details saved.")
                                } else {
                                    saveError = message ?: "Could not save your details"
                                }
                            }
                        },
                        enabled = ignOk && uidOk && dirty && !viewModel.isUpdatingProfile,
                        loading = viewModel.isUpdatingProfile,
                        height = 44.dp,
                        modifier = Modifier
                            .padding(top = 14.dp)
                            .fillMaxWidth(),
                    )
                }
            }

            // ── Support ──────────────────────────────────────────────────
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(DemoRadius.Card))
                        .background(DemoColors.Card.copy(alpha = 0.85f))
                        .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Card))
                        .clickable {
                            runCatching {
                                context.startActivity(
                                    android.content.Intent(
                                        android.content.Intent.ACTION_VIEW,
                                        android.net.Uri.parse("https://wa.me/919999900001?text=Help%20with%20Tournament"),
                                    )
                                )
                            }
                        }
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Icons.Filled.Chat,
                        contentDescription = null,
                        tint = DemoColors.TextSecondary,
                        modifier = Modifier.size(18.dp),
                    )
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .padding(start = 10.dp),
                    ) {
                        Text(
                            "Tournament Support & Helpdesk",
                            fontSize = DemoText.Body,
                            fontWeight = FontWeight.Black,
                            color = DemoColors.TextPrimary,
                        )
                        Text(
                            "${stats?.matchesJoined ?: 0} matches joined • 24/7 organiser support",
                            fontSize = DemoText.Micro,
                            color = DemoColors.TextFaint,
                        )
                    }
                    Text("Open →", fontSize = DemoText.Tiny, fontWeight = FontWeight.Black, color = DemoColors.TextSecondary)
                }
            }

            // ── Appearance + sign out ────────────────────────────────────
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(DemoRadius.Card))
                        .background(DemoColors.Card.copy(alpha = 0.85f))
                        .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Card))
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Icons.Filled.Shield,
                        contentDescription = null,
                        tint = DemoColors.TextSecondary,
                        modifier = Modifier.size(18.dp),
                    )
                    Text(
                        "Appearance",
                        fontSize = DemoText.Body,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.TextPrimary,
                        modifier = Modifier
                            .weight(1f)
                            .padding(start = 10.dp),
                    )
                    ThemeChip("Dark", themeMode == ThemeMode.DARK) { onSetThemeMode(ThemeMode.DARK) }
                    Spacer(Modifier.width(6.dp))
                    ThemeChip("Light", themeMode == ThemeMode.LIGHT) { onSetThemeMode(ThemeMode.LIGHT) }
                }
            }

            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(DemoRadius.Card))
                        .background(DemoColors.Card.copy(alpha = 0.85f))
                        .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Card))
                        .clickable(onClick = onLogout)
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Icons.Filled.Logout,
                        contentDescription = null,
                        tint = DemoColors.Danger,
                        modifier = Modifier.size(18.dp),
                    )
                    Text(
                        "Sign out",
                        fontSize = DemoText.Body,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.Danger,
                        modifier = Modifier.padding(start = 10.dp),
                    )
                }
            }

            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

@Composable
private fun StatBox(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(DemoRadius.Field))
            .background(DemoColors.Field)
            .border(1.dp, DemoColors.BorderFaint, RoundedCornerShape(DemoRadius.Field))
            .padding(vertical = 8.dp, horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(value, fontSize = 13.sp, fontWeight = FontWeight.Black, color = DemoColors.TextPrimary)
        Text(
            label.uppercase(),
            fontSize = 8.sp,
            fontWeight = FontWeight.Bold,
            color = DemoColors.TextMuted,
            modifier = Modifier.padding(top = 2.dp),
        )
    }
}

@Composable
private fun ThemeChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(if (selected) DemoColors.TextPrimary else DemoColors.Field)
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 5.dp),
    ) {
        Text(
            label,
            fontSize = DemoText.Tiny,
            fontWeight = FontWeight.Black,
            color = if (selected) DemoColors.Canvas else DemoColors.TextSecondary,
        )
    }
}
