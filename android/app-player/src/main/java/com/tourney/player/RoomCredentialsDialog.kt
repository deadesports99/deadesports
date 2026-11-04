package com.tourney.player

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.BasicAlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.RoomCredentials
import com.tourney.core.network.ApiClient
import com.tourney.core.network.apiCall
import com.tourney.core.ui.AppButton
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * 🔑 POP-UP ROOM CREDENTIALS MODAL
 *
 * Direct in-place pop-up requested by the user:
 * Shows Custom Room ID & Password with 1-tap copy buttons, haptic feedback,
 * and a "Copy Both" shortcut to easily join in Free Fire.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RoomCredentialsDialog(
    tournamentId: String,
    tournamentTitle: String,
    initialRoom: RoomCredentials? = null,
    onDismiss: () -> Unit,
) {
    val clipboard = LocalClipboardManager.current
    val haptics = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()

    var credentials by remember { mutableStateOf(initialRoom) }
    var isLoading by remember { mutableStateOf(initialRoom?.roomId == null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    var copiedId by remember { mutableStateOf(false) }
    var copiedPass by remember { mutableStateOf(false) }
    var copiedBoth by remember { mutableStateOf(false) }

    // Fetch credentials if not already available in memory
    LaunchedEffect(tournamentId) {
        if (credentials?.roomId != null && credentials?.roomPassword != null) {
            isLoading = false
            return@LaunchedEffect
        }
        isLoading = true
        errorMessage = null
        try {
            val fresh = apiCall { ApiClient.tourneyApi.roomCredentials(tournamentId) }
            credentials = fresh
        } catch (e: Exception) {
            errorMessage = e.message ?: "Failed to fetch room credentials"
        } finally {
            isLoading = false
        }
    }

    BasicAlertDialog(
        onDismissRequest = onDismiss,
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
    ) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 8.dp,
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.35f), RoundedCornerShape(20.dp)),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.weight(1f),
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                imageVector = Icons.Default.Key,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(20.dp),
                            )
                        }
                        Column {
                            Text(
                                "Custom Room Details",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.ExtraBold,
                            )
                            Text(
                                tournamentTitle,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1,
                            )
                        }
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "Close", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }

                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))

                when {
                    isLoading -> {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(36.dp),
                                color = MaterialTheme.colorScheme.primary,
                                strokeWidth = 3.dp,
                            )
                            Text(
                                "Fetching Room ID & Password…",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }

                    errorMessage != null -> {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            Text("⚠️", fontSize = 32.sp)
                            Text(
                                errorMessage ?: "Unable to load credentials",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.error,
                            )
                            AppButton(
                                text = "Retry",
                                onClick = {
                                    scope.launch {
                                        isLoading = true
                                        errorMessage = null
                                        try {
                                            credentials = apiCall { ApiClient.tourneyApi.roomCredentials(tournamentId) }
                                        } catch (e: Exception) {
                                            errorMessage = e.message
                                        } finally {
                                            isLoading = false
                                        }
                                    }
                                },
                            )
                        }
                    }

                    credentials != null -> {
                        val roomId = credentials?.roomId?.takeIf { it.isNotBlank() } ?: "Pending"
                        val roomPass = credentials?.roomPassword?.takeIf { it.isNotBlank() } ?: "Pending"

                        // Room ID Box
                        CredentialRowBox(
                            label = "ROOM ID",
                            value = roomId,
                            isCopied = copiedId,
                            onCopy = {
                                haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                                clipboard.setText(AnnotatedString(roomId))
                                copiedId = true
                                scope.launch {
                                    delay(2000L)
                                    copiedId = false
                                }
                            },
                        )

                        // Password Box
                        CredentialRowBox(
                            label = "PASSWORD",
                            value = roomPass,
                            isCopied = copiedPass,
                            onCopy = {
                                haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                                clipboard.setText(AnnotatedString(roomPass))
                                copiedPass = true
                                scope.launch {
                                    delay(2000L)
                                    copiedPass = false
                                }
                            },
                        )

                        // "Copy Both" button for fastest entry in Free Fire
                        AppButton(
                            text = if (copiedBoth) "✅ Both Copied to Clipboard!" else "📋 Copy Both ID & Password",
                            onClick = {
                                haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                                val combined = "Room ID: $roomId | Pass: $roomPass"
                                clipboard.setText(AnnotatedString(combined))
                                copiedBoth = true
                                scope.launch {
                                    delay(2000L)
                                    copiedBoth = false
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                        )

                        // Instruction Helper Card
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                                .padding(12.dp),
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(
                                    "🎮 How to Join in Free Fire:",
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary,
                                )
                                Text(
                                    "1. Open Free Fire ➔ Modes ➔ Custom Room\n2. Paste Room ID & Password to enter lobby\n3. Sit in your registered slot and get ready for Booyah!",
                                    style = MaterialTheme.typography.bodySmall,
                                    fontSize = 11.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    lineHeight = 15.sp,
                                )
                            }
                        }

                        // Close button
                        AppButton(
                            text = "Done / Open Free Fire 🚀",
                            onClick = onDismiss,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CredentialRowBox(
    label: String,
    value: String,
    isCopied: Boolean,
    onCopy: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f))
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f), RoundedCornerShape(14.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = label,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    letterSpacing = 1.sp,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = value,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.ExtraBold,
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 0.5.sp,
                    maxLines = 1,
                )
            }

            AppButton(
                text = if (isCopied) "✅ Copied!" else "Copy",
                onClick = onCopy,
                modifier = Modifier.height(38.dp),
            )
        }
    }
}
