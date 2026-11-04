package com.tourney.player

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.res.stringResource
import com.tourney.core.model.User
import com.tourney.core.security.DeviceTrust
import com.tourney.core.security.SecurityChecker
import com.tourney.core.theme.ThemeMode
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.GlassCard

/**
 * Player Profile — identity card (IGN / UID / phone with copy), career stats,
 * In-Game Free Fire Profile Editor, Light/Dark switcher, WhatsApp support and logout.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    viewModel: PlayerViewModel,
    themeMode: ThemeMode,
    onSetThemeMode: (ThemeMode) -> Unit,
    onLogout: () -> Unit,
) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val haptics = LocalHapticFeedback.current
    val settings = viewModel.liveSettings
    var showLogoutDialog by remember { mutableStateOf(false) }

    val meState = viewModel.meUi
    val user: User? = (meState as? UiState.Success)?.data

    // Phase 6B — device trust badge (emulator / rooted devices are flagged).
    val trust = SecurityChecker.getDeviceTrustStatus()
    val trustLabel = when (trust) {
        DeviceTrust.SECURE -> "✅ Verified Mobile Device"
        DeviceTrust.EMULATOR -> "⚠️ Emulator — Joining Blocked"
        DeviceTrust.ROOTED -> "⚠️ Rooted Device"
    }
    val trustColor = when (trust) {
        DeviceTrust.SECURE -> Color(0xFF00C853)
        else -> Color(0xFFE53935)
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background,
    ) {
        PullToRefreshBox(
            isRefreshing = viewModel.isProfileRefreshing,
            onRefresh = {
                haptics.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress)
                viewModel.loadProfile()
            },
            modifier = Modifier.fillMaxSize(),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                // ─── Hero / identity ─────────────────────────────────────
                GlassCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 20.dp) {
                    val isGoogle = !user?.email.isNullOrBlank()

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(58.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.primaryContainer),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                Icons.Filled.Person,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(30.dp),
                            )
                        }
                        Spacer(Modifier.width(14.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                user?.name?.takeIf { it.isNotBlank() } ?: "Player",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Text(
                                if (isGoogle) "Google Verified Account" else "Mobile Verified Account",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.primary,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium,
                            )
                        }
                        Text(
                            trustLabel,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = trustColor,
                            maxLines = 2,
                        )
                    }

                    Spacer(Modifier.height(14.dp))

                    CopyRow(
                        label = "Login Method",
                        value = if (isGoogle) "🚀 Google Account" else "📱 Mobile OTP",
                        showCopy = false,
                    )

                    if (isGoogle) {
                        Spacer(Modifier.height(8.dp))
                        CopyRow(
                            label = "Google Email",
                            value = user!!.email!!,
                            showCopy = true,
                            onCopy = { clipboard.setText(AnnotatedString(it)) },
                        )
                    }

                    val phone = user?.phoneNumber
                    if (!phone.isNullOrBlank() && !phone.startsWith("G")) {
                        Spacer(Modifier.height(8.dp))
                        CopyRow(
                            label = "Registered Phone",
                            value = phone,
                            showCopy = true,
                            onCopy = { clipboard.setText(AnnotatedString(it)) },
                        )
                    }
                }

                // ─── Appearance (light / dark) ───────────────────────────
                GlassCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 18.dp) {
                    Text(
                        "🎨 Appearance",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        "Switch instantly — no restart, saved on this device.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(top = 2.dp, bottom = 10.dp),
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ThemeChip(
                            label = "🌙 Dark",
                            selected = themeMode == ThemeMode.DARK,
                            onClick = { onSetThemeMode(ThemeMode.DARK) },
                            modifier = Modifier.weight(1f),
                        )
                        ThemeChip(
                            label = "☀️ Light",
                            selected = themeMode == ThemeMode.LIGHT,
                            onClick = { onSetThemeMode(ThemeMode.LIGHT) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    ThemeChip(
                        label = "🔄 Follow phone setting",
                        selected = themeMode == ThemeMode.SYSTEM,
                        onClick = { onSetThemeMode(ThemeMode.SYSTEM) },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }

                // ─── Support + logout ────────────────────────────────────
                GlassCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 18.dp) {
                    Text(
                        "💬 Need help?",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        "Deposits, withdrawals or room issues — message the organizer directly.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(top = 2.dp, bottom = 10.dp),
                    )
                    val whatsapp = settings.supportWhatsapp.filter { it.isDigit() }
                    AppButton(
                        text = if (whatsapp.isBlank()) "Support not configured" else "Contact WhatsApp Support",
                        enabled = whatsapp.isNotBlank(),
                        onClick = {
                            runCatching {
                                context.startActivity(
                                    Intent(
                                        Intent.ACTION_VIEW,
                                        Uri.parse("https://wa.me/$whatsapp"),
                                    )
                                )
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }

                OutlinedButton(
                    onClick = { showLogoutDialog = true },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.ExitToApp,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error,
                    )
                    Spacer(Modifier.width(8.dp))
                    Text("Logout", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.SemiBold)
                }

                Text(
                    settings.brandName,
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
                Text(
                    stringResource(com.tourney.player.R.string.play_store_disclaimer),
                    fontSize = 9.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
            }
        }
    }

    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            title = { Text("Logout?") },
            text = { Text("Your session and cached data will be cleared on this device.") },
            confirmButton = {
                TextButton(onClick = {
                    showLogoutDialog = false
                    onLogout()
                }) {
                    Text("Logout", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutDialog = false }) { Text("Stay") }
            },
        )
    }
}

@Composable
private fun CopyRow(
    label: String,
    value: String,
    showCopy: Boolean = true,
    onCopy: (String) -> Unit = {},
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f))
            .padding(horizontal = 12.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(label, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(
                value,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
        if (showCopy && value != "Not set" && value != "—") {
            IconButton(onClick = { onCopy(value) }, modifier = Modifier.size(32.dp)) {
                Icon(
                    Icons.Filled.ContentCopy,
                    contentDescription = "Copy $label",
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(16.dp),
                )
            }
        }
    }
}

@Composable
private fun ThemeChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val bg = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
    val fg = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(bg)
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = fg, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}
