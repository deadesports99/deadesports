package com.tourney.admin

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.MeetingRoom
import androidx.compose.material.icons.filled.FactCheck
import androidx.compose.material.icons.filled.PeopleAlt
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.datastore.SessionState
import com.tourney.core.model.Role
import com.tourney.core.model.StaffPermissions
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.GlassCard

private data class AdminFeature(
    val title: String,
    val subtitle: String,
    val icon: ImageVector,
    val enabled: Boolean,
    val route: String,
)

/**
 * Role + permission-driven dashboard. ADMIN sees everything; SUB_ADMIN sees
 * exactly the cards their granular permissions grant; USER is blocked.
 *
 * Pull down to re-sync the match list, withdrawal queue and deposit queue.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminDashboardScreen(
    session: SessionState,
    viewModel: AdminViewModel,
    onOpenRoute: (String) -> Unit,
) {
    val isAdmin = session.role == Role.ADMIN
    val perms = session.permissions
    val haptics = androidx.compose.ui.platform.LocalHapticFeedback.current

    val features = buildList {
        add(
            AdminFeature(
                "Create Match",
                "Schedule Free Fire tournaments (48 slots, prizes, maps)",
                Icons.Filled.SportsEsports,
                isAdmin || perms.canCreateMatch,
                "create",
            )
        )
        add(
            AdminFeature(
                "Publish Room ID",
                "Release custom room credentials (players see at your chosen reveal time)",
                Icons.Filled.MeetingRoom,
                isAdmin || perms.canUpdateRoomId,
                "room",
            )
        )
        add(
            AdminFeature(
                "Spectator Scorer",
                "Verified kills, ranks, anti-hacker flags & 1-click payout",
                Icons.Filled.EmojiEvents,
                isAdmin || perms.canDistributePrize,
                "scorer",
            )
        )
        add(
            AdminFeature(
                "Manage Matches",
                "Sweep lifecycle • full match history • cancel & auto-refund seats",
                Icons.Filled.FactCheck,
                isAdmin || perms.canCreateMatch,
                "matches",
            )
        )
        add(
            AdminFeature(
                "Wallet Console",
                "Deposits (Add Cash UTR) + withdrawals (UPI payouts) in one queue",
                Icons.Filled.AccountBalanceWallet,
                isAdmin || perms.canManageWallet,
                "wallet",
            )
        )
        // Owner-only: hiring + granular permissions for sub-admins.
        if (isAdmin) {
            add(
                AdminFeature(
                    "Player Management",
                    "Search by Player ID / phone / IGN / FF UID • ban or unban accounts",
                    Icons.Filled.PeopleAlt,
                    true,
                    "players",
                )
            )
            add(
                AdminFeature(
                    "Staff Management",
                    "Hire sub-admins, edit permissions, remove staff (owner only)",
                    Icons.Filled.PeopleAlt,
                    true,
                    "staff",
                )
            )
            // Owner-only: runtime UPI / WhatsApp / min deposit (no APK rebuild).
            add(
                AdminFeature(
                    "App Settings",
                    "Change the collecting UPI ID, payee name, support number & min deposit (owner only)",
                    Icons.Filled.Settings,
                    true,
                    "settings",
                )
            )
            add(
                AdminFeature(
                    "Daily Settlement",
                    "Collections, payouts, net margin and CSV export (owner only)",
                    Icons.Filled.Assessment,
                    true,
                    "settlement",
                )
            )
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        AppTopBar(title = "Dashboard")

        PullToRefreshBox(
            isRefreshing = viewModel.isDashboardRefreshing,
            onRefresh = {
                haptics.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress)
                viewModel.refreshDashboard()
            },
            modifier = Modifier.weight(1f),
        ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            GlassCard(modifier = Modifier.fillMaxWidth()) {
                Text(
                    "Logged in: ${session.role?.name ?: "-"}" + if (isAdmin) " (Owner)" else " (Staff)",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                if (!isAdmin && session.role == Role.SUB_ADMIN) {
                    Text(
                        "Permissions: ${permissionsLabel(perms)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            if (session.role == Role.USER) {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Text("⛔ Player app", style = MaterialTheme.typography.titleLarge)
                    Text(
                        "This is the Owner/Staff app. Players should use the Player app.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                return@Column
            }

            features.forEach { feature ->
                GlassCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        // Whole card is tappable (not just the tiny "Open" label).
                        .then(
                            if (feature.enabled) {
                                Modifier.clickable { onOpenRoute(feature.route) }
                            } else {
                                Modifier
                            }
                        ),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Icon(
                            feature.icon,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(feature.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                            Text(
                                feature.subtitle,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                fontSize = 12.sp,
                            )
                        }
                        if (feature.enabled) {
                            TextButton(onClick = { onOpenRoute(feature.route) }) { Text("Open") }
                        } else {
                            Text("🔒", fontSize = 16.sp)
                        }
                    }
                }
            }

            Spacer(Modifier.height(8.dp))

            TextButton(
                onClick = { viewModel.logout() },
                modifier = Modifier.align(Alignment.CenterHorizontally),
            ) {
                Text("Logout", color = MaterialTheme.colorScheme.error)
            }
        }
        }
    }
}

private fun permissionsLabel(p: StaffPermissions): String = buildList {
    if (p.canCreateMatch) add("Create")
    if (p.canUpdateRoomId) add("Room")
    if (p.canDistributePrize) add("Prizes")
    if (p.canManageWallet) add("Wallet")
}.joinToString(", ").ifEmpty { "View only" }
