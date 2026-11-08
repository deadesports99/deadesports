package com.tourney.admin

import android.content.Intent
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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.DeviceAccount
import com.tourney.core.model.DeviceGroup
import com.tourney.core.model.DeviceGroupDetail
import com.tourney.core.model.DeviceSharedMatch
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.GlassCard
import com.tourney.core.ui.LoadingState
import com.tourney.core.ui.formatMoney
import androidx.core.content.FileProvider

private val DangerRed = Color(0xFFE53935)
private val GoodGreen = Color(0xFF00C853)
private val WarnAmber = Color(0xFFFF9800)

/**
 * Phase 12.5 — One phone, many accounts.
 *
 * The list shows every device with 2+ accounts; opening one shows all its
 * accounts side by side with the matches where they met each other, plus a
 * single ban action for the whole device.
 */
@Composable
fun AdminDeviceGroupsScreen(
    viewModel: AdminViewModel,
    onBack: () -> Unit,
    onOpenDevice: (String) -> Unit = {},
) {
    LaunchedEffect(Unit) {
        viewModel.clearDeviceGroupFeedback()
        viewModel.loadDeviceGroups()
    }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize()) {
            AppTopBar(title = "📱 Device Accounts", onBack = onBack)

            when (val state = viewModel.deviceGroupsUi) {
                AdminUi.Idle, AdminUi.Loading -> LoadingState("Scanning devices…")
                is AdminUi.Error -> ErrorState(state.message) { viewModel.loadDeviceGroups() }
                is AdminUi.Success -> {
                    val groups = state.data.groups
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        item {
                            Text(
                                if (groups.isEmpty()) {
                                    "No device has more than one account"
                                } else {
                                    "${groups.size} device(s) with 2+ accounts out of " +
                                        "${state.data.totalDevices} seen"
                                },
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        items(groups, key = { it.deviceId }) { group ->
                            DeviceGroupCard(group) {
                                viewModel.openDeviceGroup(group.deviceId)
                                onOpenDevice(group.deviceId)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DeviceGroupCard(group: DeviceGroup, onClick: () -> Unit) {
    val accent = if (group.highRisk) DangerRed else WarnAmber
    Surface(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier.size(34.dp).background(accent.copy(alpha = 0.18f), CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        group.accountCount.toString(),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        color = accent,
                    )
                }
                Spacer(Modifier.width(9.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "${group.accountCount} accounts on one device",
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                    )
                    Text(
                        group.shortDeviceId,
                        fontSize = 9.5.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                if (group.bannedCount > 0) {
                    Text("🚫 ${group.bannedCount}", fontSize = 10.sp, color = DangerRed)
                }
            }
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (group.collidedMatchCount > 0) {
                    Text(
                        "⚔️ played together in ${group.collidedMatchCount} match(es)",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = DangerRed,
                    )
                }
                Text(
                    "won ₹${formatMoney(group.totalWinnings)}",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (group.accounts.isNotEmpty()) {
                Spacer(Modifier.height(3.dp))
                Text(
                    group.accounts.joinToString(" · ") { it.displayName },
                    fontSize = 9.5.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

/** One device in full — every account, the matches they met in, one ban action. */
@Composable
fun AdminDeviceGroupDetailScreen(
    viewModel: AdminViewModel,
    onBack: () -> Unit,
    onOpenPlayer: (String) -> Unit,
) {
    var banConfirm by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { viewModel.clearDeviceGroupFeedback() }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize()) {
            AppTopBar(title = "📱 Device Accounts", onBack = onBack)

            viewModel.deviceGroupMessage?.let {
                Text(
                    it,
                    fontSize = 11.sp,
                    color = GoodGreen,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
            }
            viewModel.deviceGroupError?.let {
                Text(
                    "⚠️ $it",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
            }

            when (val state = viewModel.deviceGroupUi) {
                AdminUi.Idle, AdminUi.Loading -> LoadingState("Loading device…")
                is AdminUi.Error -> ErrorState(state.message) {
                    viewModel.loadDeviceGroup(showSpinner = true)
                }
                is AdminUi.Success -> DeviceDetailBody(
                    viewModel = viewModel,
                    data = state.data,
                    busy = viewModel.deviceGroupBusy,
                    onOpenPlayer = onOpenPlayer,
                    onBanClick = { banConfirm = true },
                )
            }
        }
    }

    val detail = (viewModel.deviceGroupUi as? AdminUi.Success)?.data
    if (banConfirm && detail != null) {
        val allBanned = detail.totals.bannedCount == detail.totals.accountCount
        AlertDialog(
            onDismissRequest = { banConfirm = false },
            title = {
                Text(
                    if (allBanned) "✅ Unban all ${detail.totals.accountCount} accounts?"
                    else "🚫 Ban all ${detail.totals.accountCount} accounts?",
                    fontWeight = FontWeight.Bold,
                )
            },
            text = {
                Text(
                    if (allBanned) {
                        "All accounts on this device will be able to log in again."
                    } else {
                        "This bans every account on device ${detail.deviceId.take(12)}… at once: " +
                            detail.accounts.joinToString(", ") { it.displayName } +
                            ".\n\nTheir sessions stop immediately. Balances and history are kept."
                    },
                    fontSize = 12.sp,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    banConfirm = false
                    viewModel.banDevice(!allBanned)
                }) {
                    Text(
                        if (allBanned) "Unban All" else "Ban All ${detail.totals.accountCount}",
                        color = if (allBanned) GoodGreen else DangerRed,
                        fontWeight = FontWeight.Bold,
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { banConfirm = false }) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun DeviceDetailBody(
    viewModel: AdminViewModel,
    data: DeviceGroupDetail,
    busy: Boolean,
    onOpenPlayer: (String) -> Unit,
    onBanClick: () -> Unit,
) {
    val context = LocalContext.current
    val totals = data.totals
    val allBanned = totals.accountCount > 0 && totals.bannedCount == totals.accountCount

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            GlassCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 14.dp, contentPadding = 14.dp) {
                Text(
                    data.deviceId,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(6.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Stat("Accounts", totals.accountCount.toString())
                    Stat("Played together", "${totals.collidedMatchCount} match")
                    Stat("Banned", "${totals.bannedCount}")
                }
                Spacer(Modifier.height(6.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Stat("Total won", "₹${formatMoney(totals.totalWinnings)}")
                    Stat("Added", "₹${formatMoney(totals.totalDeposited)}")
                    Stat("Withdrew", "₹${formatMoney(totals.totalWithdrawn)}")
                }
                if (totals.netOut > 0) {
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "⚠️ This device took out ₹${formatMoney(totals.netOut)} more than it paid in",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = DangerRed,
                    )
                }
                Spacer(Modifier.height(10.dp))
                AppButton(
                    text = if (allBanned) {
                        "✅ Unban all ${totals.accountCount} accounts"
                    } else {
                        "🚫 Ban all ${totals.accountCount} accounts"
                    },
                    onClick = { if (!busy) onBanClick() },
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    AppButton(
                        text = if (viewModel.deviceExporting) "⏳ …" else "⬇ CSV",
                        onClick = {
                            val label = data.deviceId.take(16)
                            viewModel.exportDeviceCsv(data.deviceId, label) { result ->
                                result.onSuccess { file ->
                                    val uri = FileProvider.getUriForFile(
                                        context,
                                        context.packageName + ".fileprovider",
                                        file,
                                    )
                                    val share = Intent(Intent.ACTION_SEND).apply {
                                        type = "text/csv"
                                        putExtra(Intent.EXTRA_STREAM, uri)
                                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                    }
                                    context.startActivity(
                                        Intent.createChooser(share, "Share device CSV"),
                                    )
                                }
                            }
                        },
                        modifier = Modifier.weight(1f),
                    )
                    AppButton(
                        text = "🔭 Watch",
                        onClick = { viewModel.watchDeviceById(data.deviceId) },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }

        item {
            Text(
                "👥 Accounts on this device (${data.accounts.size})",
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
            )
        }
        items(data.accounts, key = { it.userId }) { account ->
            AccountRow(account) { onOpenPlayer(account.userId) }
        }

        if (data.sharedMatches.isNotEmpty()) {
            item {
                Spacer(Modifier.height(4.dp))
                Text(
                    "⚔️ Matches they played together (${data.sharedMatches.size})",
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                    color = DangerRed,
                )
            }
            items(data.sharedMatches, key = { it.tournamentId }) { match ->
                SharedMatchRow(match)
            }
        }
    }
}

@Composable
private fun AccountRow(account: DeviceAccount, onClick: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        account.displayName,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (account.isBanned) {
                        Spacer(Modifier.width(4.dp))
                        Text("🚫", fontSize = 9.sp)
                    }
                    if (account.collidedMatches > 0) {
                        Spacer(Modifier.width(4.dp))
                        Text(
                            "⚔️${account.collidedMatches}",
                            fontSize = 9.sp,
                            color = DangerRed,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
                Text(
                    "${account.matchesJoined} match  •  won ₹${formatMoney(account.totalWinnings)}" +
                        if (account.inGameUid != null) "  •  UID ${account.inGameUid}" else "  •  no UID",
                    fontSize = 9.5.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Text(
                (if (account.netOut >= 0) "+₹" else "-₹") +
                    formatMoney(kotlin.math.abs(account.netOut)),
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Bold,
                color = if (account.netOut >= 0) DangerRed else GoodGreen,
            )
        }
    }
}

@Composable
private fun SharedMatchRow(match: DeviceSharedMatch) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = DangerRed.copy(alpha = 0.10f),
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 7.dp)) {
            Text(match.displayName, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold)
            Text(
                "${match.status.replace('_', ' ')}  •  ${match.accountCodes.joinToString(", ")}",
                fontSize = 9.5.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun Stat(label: String, value: String) {
    Column {
        Text(label, fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}
