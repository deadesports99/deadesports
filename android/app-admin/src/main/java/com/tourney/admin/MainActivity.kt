package com.tourney.admin

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.MeetingRoom
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.datastore.SessionManager
import com.tourney.core.datastore.SessionState
import com.tourney.core.model.Role
import com.tourney.core.model.StaffPermissions
import com.tourney.core.theme.ClientConfig
import com.tourney.core.theme.ClientTheme
import com.tourney.core.theme.LocalClientConfig
import com.tourney.core.ui.GlassCard

/**
 * Admin App — DYNAMIC dashboard.
 * - ADMIN   -> every card (analytics/management control)
 * - SUB_ADMIN -> only the cards granted by their granular permissions
 * - USER     -> blocked with a warning (wrong app)
 */
class MainActivity : ComponentActivity() {

    private val sessionManager: SessionManager by lazy { SessionManager(applicationContext) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val config = ClientConfig.load(applicationContext)

        setContent {
            ClientTheme(config = config) {
                var session by remember { mutableStateOf(SessionState()) }
                var checked by remember { mutableStateOf(false) }

                LaunchedEffect(Unit) {
                    session = sessionManager.current()
                    checked = true
                }

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .statusBarsPadding()
                        .verticalScroll(rememberScrollState())
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    DashboardHeader(session = session, checked = checked)
                    when (session.role) {
                        Role.ADMIN -> AdminBoard()
                        Role.SUB_ADMIN -> SubAdminBoard(session.permissions)
                        Role.USER -> WrongAppCard()
                        null -> if (checked) WrongAppCard() else Spacer(Modifier.height(1.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun DashboardHeader(session: SessionState, checked: Boolean) {
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "🛡️ ${LocalClientConfig.current.appName}",
            style = MaterialTheme.typography.headlineLarge,
        )
        Text(
            text = if (!checked) "Loading session…"
            else "Role: ${session.role?.name ?: "NOT LOGGED IN"}",
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.tertiary,
        )
    }
}

private data class FeatureCardSpec(
    val title: String,
    val subtitle: String,
    val icon: ImageVector,
)

private val ALL_FEATURES = listOf(
    FeatureCardSpec("Match Creation", "Create Free Fire tournaments (Bermuda/Purgatory, Solo/Duo/Squad)", Icons.Filled.SportsEsports),
    FeatureCardSpec("Room ID Control", "Publish & reveal custom room credentials (T-15 min)", Icons.Filled.MeetingRoom),
    FeatureCardSpec("Spectator Scorecard", "Enter verified kills & ranks, 1-click payout", Icons.Filled.EmojiEvents),
    FeatureCardSpec("Wallet & Withdrawals", "Deposits, withdrawals, KYC approvals", Icons.Filled.AccountBalanceWallet),
)

@Composable
private fun FeatureCard(spec: FeatureCardSpec) {
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            Icon(
                imageVector = spec.icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.padding(horizontal = 6.dp))
            Column {
                Text(spec.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text(
                    spec.subtitle,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 13.sp,
                )
            }
        }
    }
}

/** Full control — the Client Owner. */
@Composable
private fun AdminBoard() {
    Text("Full Analytics & Control", style = MaterialTheme.typography.titleLarge)
    ALL_FEATURES.forEach { FeatureCard(it) }
}

/** Only the cards the admin granted. */
@Composable
private fun SubAdminBoard(permissions: StaffPermissions) {
    Text(
        "Your Granted Permissions",
        style = MaterialTheme.typography.titleLarge,
        modifier = Modifier.padding(bottom = 4.dp),
    )
    if (permissions.canCreateMatch) FeatureCard(ALL_FEATURES[0])
    if (permissions.canUpdateRoomId) FeatureCard(ALL_FEATURES[1])
    if (permissions.canDistributePrize) FeatureCard(ALL_FEATURES[2])
    if (permissions.canManageWallet) FeatureCard(ALL_FEATURES[3])
}

@Composable
private fun WrongAppCard() {
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Text("⛔ Player app", style = MaterialTheme.typography.titleLarge)
        Text(
            "This is the Owner/Staff app. Players should use the Player app.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}