package com.tourney.admin

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.WatchedDevice
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.GlassCard
import com.tourney.core.ui.LoadingState
import com.tourney.core.ui.formatMoney

private val DangerRed = Color(0xFFE53935)
private val GoodGreen = Color(0xFF00C853)
private val WarnAmber = Color(0xFFFF9800)

/**
 * Phase 12.6 — Watchlist. Devices flagged once, then every new account that
 * plays from them raises an alert. Catches a banned farmer on the first match
 * of his comeback instead of the twentieth.
 */
@Composable
fun AdminWatchlistScreen(
    viewModel: AdminViewModel,
    onBack: () -> Unit,
    onOpenDevice: (String) -> Unit,
) {
    LaunchedEffect(Unit) {
        viewModel.clearWatchlistFeedback()
        viewModel.loadWatchlist()
    }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize()) {
            AppTopBar(title = "🔭 Watchlist", onBack = onBack)

            viewModel.watchlistMessage?.let {
                Text(
                    it,
                    fontSize = 11.sp,
                    color = GoodGreen,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
            }
            viewModel.watchlistError?.let {
                Text(
                    "⚠️ $it",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
            }

            when (val state = viewModel.watchlistUi) {
                AdminUi.Idle, AdminUi.Loading -> LoadingState("Loading watchlist…")
                is AdminUi.Error -> ErrorState(state.message) { viewModel.loadWatchlist() }
                is AdminUi.Success -> {
                    val data = state.data
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        item {
                            Text(
                                if (data.devices.isEmpty()) {
                                    "No devices on the watchlist yet"
                                } else {
                                    "${data.totalWatched} device(s) watched" +
                                        if (data.totalAlerts > 0) {
                                            " · 🚨 ${data.totalAlerts} new alert(s)"
                                        } else {
                                            " · no new alerts"
                                        }
                                },
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = if (data.totalAlerts > 0) DangerRed else
                                    MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }

                        if (data.devices.isEmpty()) {
                            item {
                                GlassCard(modifier = Modifier.fillMaxWidth()) {
                                    Text(
                                        "How this works",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp,
                                    )
                                    Text(
                                        "Open 📱 Devices, tap a device, then press 🔭 Watch. From then on, " +
                                            "any new account that joins a match from that device raises an " +
                                            "alert here — even if the account is brand new.",
                                        fontSize = 11.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }

                        items(data.devices, key = { it.id }) { device ->
                            WatchCard(
                                device = device,
                                onOpen = { onOpenDevice(device.deviceId) },
                                onAck = { viewModel.acknowledgeWatch(device.deviceId) },
                                onRemove = { viewModel.unwatchDevice(device.deviceId) },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun WatchCard(
    device: WatchedDevice,
    onOpen: () -> Unit,
    onAck: () -> Unit,
    onRemove: () -> Unit,
) {
    val alerting = device.alertCount > 0
    Surface(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onOpen),
        shape = RoundedCornerShape(12.dp),
        color = if (alerting) DangerRed.copy(alpha = 0.12f)
        else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (alerting) {
                            Text("🚨 ", fontSize = 11.sp)
                            Text(
                                "${device.alertCount} new",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Black,
                                color = DangerRed,
                            )
                            Spacer(Modifier.width(6.dp))
                        }
                        Text(
                            device.shortDeviceId,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    Text(
                        "${device.accountCount} account(s)  •  ⚔️ played together ${device.collidedMatchCount}" +
                            "  •  won ₹${formatMoney(device.totalWinnings)}" +
                            if (device.bannedCount > 0) "  •  🚫 ${device.bannedCount}" else "",
                        fontSize = 9.5.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    device.note?.takeIf { it.isNotBlank() }?.let { note ->
                        Text(
                            "📝 $note",
                            fontSize = 9.5.sp,
                            color = WarnAmber,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
            Spacer(Modifier.height(2.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                if (alerting) {
                    TextButton(onClick = onAck) {
                        Text("✅ Seen", fontSize = 10.sp, color = GoodGreen)
                    }
                }
                TextButton(onClick = onOpen) {
                    Text("Open", fontSize = 10.sp)
                }
                TextButton(onClick = onRemove) {
                    Text("🗑 Remove", fontSize = 10.sp, color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}
