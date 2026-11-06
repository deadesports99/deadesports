package com.tourney.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.LoadingState

/**
 * Room ID screen:
 * - Locked: "the organiser has not published the room yet" (no countdown — the
 *   room appears only when an admin/sub-admin publishes it).
 * - Published: Room ID + Password with 1-tap copy + haptic feedback.
 * Only registered slot holders (or staff) ever get here.
 */
@Composable
fun RoomScreen(
    tournamentId: String,
    viewModel: MatchViewModel,
    onBack: () -> Unit,
) {
    val state = viewModel.roomState
    val clipboard = LocalClipboardManager.current
    val haptics = LocalHapticFeedback.current
    var copiedLabel by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(tournamentId) {
        viewModel.loadRoom(tournamentId)
        copiedLabel = null
    }

    // Nothing unlocks on a clock any more: quietly re-poll so the room shows up
    // as soon as the admin/sub-admin publishes it.
    LaunchedEffect(tournamentId, state is RoomState.Locked) {
        while (viewModel.roomState is RoomState.Locked) {
            kotlinx.coroutines.delay(15_000)
            viewModel.refreshRoom(tournamentId)
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        AppTopBar(title = "Custom Room", onBack = onBack)

        when (state) {
            RoomState.Idle, RoomState.Loading -> LoadingState("Checking room release…")
            is RoomState.Error -> ErrorState(state.message) { viewModel.loadRoom(tournamentId) }
            is RoomState.Locked -> Column(
                modifier = Modifier.fillMaxSize().padding(28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text("🔒", fontSize = 44.sp)
                Spacer(Modifier.height(12.dp))
                Text(
                    "Room ID not published yet",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    state.message,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    "The organiser publishes the Room ID & Password when the custom room is ready. " +
                        "This screen checks again automatically.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
                Spacer(Modifier.height(16.dp))
                AppButton(
                    text = "🔄 Check again",
                    onClick = { viewModel.refreshRoom(tournamentId) },
                )
            }
            is RoomState.Ready -> Column(
                modifier = Modifier.fillMaxSize().padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                val roomId = state.credentials.roomId ?: "Unavailable"
                val roomPassword = state.credentials.roomPassword ?: "Unavailable"
                Text(
                    "Match Lobby Open ✅",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    "Join this code inside Free Fire → Custom → Room. " +
                        "Do NOT share it outside the tournament.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                CredentialCard(
                    label = "Room ID",
                    value = roomId,
                    onCopy = {
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        clipboard.setText(AnnotatedString(roomId))
                        copiedLabel = "Room ID copied"
                    },
                )
                CredentialCard(
                    label = "Room Password",
                    value = roomPassword,
                    onCopy = {
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        clipboard.setText(AnnotatedString(roomPassword))
                        copiedLabel = "Password copied"
                    },
                )

                copiedLabel?.let {
                    Text(it, color = MaterialTheme.colorScheme.tertiary, fontSize = 13.sp)
                }
            }
        }
    }
}

@Composable
private fun CredentialCard(label: String, value: String, onCopy: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    value,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(end = 8.dp),
                )
                AppButton(text = "Copy", onClick = onCopy, modifier = Modifier.padding(start = 8.dp))
            }
        }
    }
}
