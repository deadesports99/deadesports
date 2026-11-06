package com.tourney.player.ui.settings

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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.tourney.core.theme.ThemeMode
import com.tourney.player.UiState
import com.tourney.player.ui.common.DemoBackground
import com.tourney.player.PlayerViewModel

/**
 * 1:1 port of the demo's `SettingsScreen.tsx` (Telegram-style rows, coloured icon
 * badges, inline theme segmented control, notification toggle, account and fair
 * play modals, log out row and the version footnote).
 */
private object S {
    val Card = Color(0xFF0C121E)
    val Slate950 = Color(0xFF020617)
    val Slate900 = Color(0xFF0F172A)
    val Slate400 = Color(0xFF94A3B8)
    val Slate500 = Color(0xFF64748B)
    val White10 = Color(0x1AFFFFFF)
    val White15 = Color(0x26FFFFFF)
    val White5 = Color(0x0DFFFFFF)
    val Blue = Color(0xFF2AABEE)
    val Violet = Color(0xFF8B5CF6)
    val Red = Color(0xFFEF4444)
    val Amber = Color(0xFFF59E0B)
    val Green = Color(0xFF22C55E)
    val Emerald = Color(0xFF10B981)
    val Rose500 = Color(0xFFF43F5E)
    val Amber400 = Color(0xFFFBBF24)
}

@Composable
fun SettingsScreen(
    viewModel: PlayerViewModel,
    themeMode: ThemeMode,
    onSetThemeMode: (ThemeMode) -> Unit,
    onSignOut: () -> Unit,
    onToast: (String) -> Unit,
) {
    var accountOpen by remember { mutableStateOf(false) }
    var fairPlayOpen by remember { mutableStateOf(false) }
    var notificationsEnabled by remember { mutableStateOf(true) }

    val me = (viewModel.meUi as? UiState.Success)?.data
    val playerName = me?.name ?: "Spartan Player"
    val playerPhone = me?.phoneNumber?.let { "+91 $it" } ?: "+91 98765 43210"
    val isDark = themeMode != ThemeMode.LIGHT

    // Same dark canvas as the Matches/Wallet tabs so the light app theme cannot
    // wash this page out; the port is dark-first by design.
    DemoBackground {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(start = 16.dp, end = 16.dp, bottom = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // Top left title: Settings (text-2xl font-black)
        Text(
            "Settings",
            fontSize = 24.sp,
            fontWeight = FontWeight.Black,
            color = Color.White,
            letterSpacing = (-0.5).sp,
            modifier = Modifier.padding(top = 2.dp, bottom = 0.dp),
        )

        // ── SECTION 1: main settings card ───────────────────────────────
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(S.Card)
                .border(1.dp, S.White10, RoundedCornerShape(16.dp)),
        ) {
            SettingsRow(
                badgeColor = S.Blue,
                icon = Icons.Filled.Person,
                title = "Account",
                subtitle = "$playerName • $playerPhone",
                onClick = { accountOpen = true },
                showChevron = true,
            )
            SettingsDivider()

            // Appearance & theme
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    modifier = Modifier
                        .weight(1f)
                        .padding(end = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Badge(S.Violet) {
                        Icon(
                            if (isDark) Icons.Filled.DarkMode else Icons.Filled.LightMode,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                    Column(modifier = Modifier.padding(start = 14.dp)) {
                        Text("Appearance", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        Text(
                            if (isDark) "Dark Mode" else "Light Mode",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = S.Slate400,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                }

                // Inline segmented switch
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(S.Slate950)
                        .border(1.dp, S.White10, RoundedCornerShape(12.dp))
                        .padding(4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    ThemeSegment(
                        label = "Dark",
                        icon = Icons.Filled.DarkMode,
                        selected = isDark,
                        onClick = { onSetThemeMode(ThemeMode.DARK) },
                    )
                    ThemeSegment(
                        label = "Light",
                        icon = Icons.Filled.LightMode,
                        selected = !isDark,
                        onClick = { onSetThemeMode(ThemeMode.LIGHT) },
                    )
                }
            }
            SettingsDivider()

            // Notifications
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    modifier = Modifier
                        .weight(1f)
                        .padding(end = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Badge(S.Red) {
                        Icon(
                            Icons.Filled.Notifications,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                    Column(modifier = Modifier.padding(start = 14.dp)) {
                        Text("Notifications", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        Text(
                            "Match Alerts & Room ID",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = S.Slate400,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                }
                DemoToggle(checked = notificationsEnabled) {
                    notificationsEnabled = !notificationsEnabled
                    onToast(if (notificationsEnabled) "Match alerts enabled" else "Match alerts muted")
                }
            }
        }

        // ── SECTION 2: rules & support ──────────────────────────────────
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(S.Card)
                .border(1.dp, S.White10, RoundedCornerShape(16.dp)),
        ) {
            SettingsRow(
                badgeColor = S.Amber,
                icon = Icons.Filled.VerifiedUser,
                title = "Fair Play Rules",
                subtitle = "Anti-cheat & scrim guidelines",
                onClick = { fairPlayOpen = true },
                showChevron = true,
            )
            SettingsDivider()
            SettingsRow(
                badgeColor = S.Green,
                icon = Icons.Filled.Chat,
                title = "Support",
                subtitle = "24/7 WhatsApp helpdesk",
                onClick = { onToast("Opening WhatsApp support channel...") },
                showChevron = true,
            )
        }

        // ── SECTION 3: log out ──────────────────────────────────────────
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(S.Card)
                .border(1.dp, S.White10, RoundedCornerShape(16.dp)),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onSignOut)
                    .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Badge(S.Red) {
                    Icon(
                        Icons.Filled.Logout,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(20.dp),
                    )
                }
                Text(
                    "Log Out",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = S.Rose500,
                    modifier = Modifier
                        .weight(1f)
                        .padding(start = 14.dp),
                )
                Icon(
                    Icons.Filled.ChevronRight,
                    contentDescription = null,
                    tint = S.Rose500.copy(alpha = 0.6f),
                    modifier = Modifier.size(16.dp),
                )
            }
        }

        // Version footnote
        Text(
            "Spartan Esports Arena • v2.4.0 (Build 104)",
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = S.Slate500,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 0.dp, bottom = 8.dp),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
    }
    }

    if (accountOpen) {
        AccountModal(
            playerName = playerName,
            playerPhone = playerPhone,
            onClose = { accountOpen = false },
        )
    }

    if (fairPlayOpen) {
        FairPlayModal(onClose = { fairPlayOpen = false })
    }
}

@Composable
private fun SettingsRow(
    badgeColor: Color,
    icon: ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
    showChevron: Boolean,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Badge(badgeColor) {
            Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
        }
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(start = 14.dp),
        ) {
            Text(title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
            Text(
                subtitle,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = S.Slate400,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        if (showChevron) {
            Icon(
                Icons.Filled.ChevronRight,
                contentDescription = null,
                tint = S.Slate500,
                modifier = Modifier.size(16.dp),
            )
        }
    }
}

@Composable
private fun Badge(color: Color, content: @Composable () -> Unit) {
    Box(
        modifier = Modifier
            .size(40.dp)
            .clip(CircleShape)
            .background(color),
        contentAlignment = Alignment.Center,
    ) { content() }
}

/** `h-px w-full ml-[62px] bg-white/5` */
@Composable
private fun SettingsDivider() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 62.dp)
            .height(1.dp)
            .background(S.White5),
    )
}

@Composable
private fun ThemeSegment(label: String, icon: ImageVector, selected: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(if (selected) Color.White else Color.Transparent)
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = if (selected) S.Slate950 else S.Slate400,
            modifier = Modifier.size(12.dp),
        )
        Text(
            label,
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            color = if (selected) S.Slate950 else S.Slate400,
        )
    }
}

/** `h-6 w-11` track with a `h-5 w-5` white knob, emerald when on. */
@Composable
private fun DemoToggle(checked: Boolean, onToggle: () -> Unit) {
    Box(
        modifier = Modifier
            .width(44.dp)
            .height(24.dp)
            .clip(RoundedCornerShape(50))
            .background(if (checked) S.Emerald else Color(0xFF334155))
            .clickable(onClick = onToggle)
            .padding(2.dp),
        contentAlignment = if (checked) Alignment.CenterEnd else Alignment.CenterStart,
    ) {
        Box(
            modifier = Modifier
                .size(20.dp)
                .clip(CircleShape)
                .background(Color.White),
        )
    }
}

// ── Account modal ────────────────────────────────────────────────────────
@Composable
private fun AccountModal(playerName: String, playerPhone: String, onClose: () -> Unit) {
    DemoModal(onDismiss = onClose) {
        ModalHeader(
            badgeColor = S.Blue,
            icon = Icons.Filled.Person,
            title = "Account Details",
            subtitle = "Registered Player",
            onClose = onClose,
        )

        Column(
            modifier = Modifier.padding(top = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            ModalField(label = "Username", value = playerName)
            ModalField(label = "Mobile Number", value = playerPhone)

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(S.Slate950.copy(alpha = 0.4f))
                    .border(1.dp, S.White10, RoundedCornerShape(12.dp))
                    .padding(12.dp),
            ) {
                Icon(
                    Icons.Filled.Shield,
                    contentDescription = null,
                    tint = S.Amber400,
                    modifier = Modifier
                        .padding(top = 2.dp)
                        .size(16.dp),
                )
                Text(
                    "For tournament anti-cheat and prize security, game accounts are permanently locked to this registered mobile number.",
                    fontSize = 11.sp,
                    color = S.Slate400,
                    lineHeight = 16.sp,
                    modifier = Modifier.padding(start = 10.dp),
                )
            }
        }

        AmberButton("Done", onClose, modifier = Modifier.padding(top = 16.dp))
    }
}

// ── Fair play modal ──────────────────────────────────────────────────────
@Composable
private fun FairPlayModal(onClose: () -> Unit) {
    DemoModal(onDismiss = onClose) {
        ModalHeader(
            badgeColor = S.Amber,
            icon = Icons.Filled.VerifiedUser,
            title = "Fair Play Rules",
            subtitle = "Official Scrim Guidelines",
            onClose = onClose,
        )

        Column(
            modifier = Modifier.padding(top = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            RuleCard(
                title = "1. Mobile Only Policy",
                titleColor = S.Amber400,
                body = "PC Emulators are strictly prohibited. Detected emulators will be auto-kicked.",
            )
            RuleCard(
                title = "2. Anti-Cheat Policy",
                titleColor = Color(0xFFFB7185),
                body = "Config files, headshot scripts, or modified APKs lead to permanent account ban.",
            )
            RuleCard(
                title = "3. Match Timing",
                titleColor = Color(0xFF34D399),
                body = "Room ID & Password unlock 15 minutes before the match start time.",
            )
        }

        AmberButton("Understood", onClose, modifier = Modifier.padding(top = 16.dp))
    }
}

@Composable
private fun RuleCard(title: String, titleColor: Color, body: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(S.Slate950.copy(alpha = 0.6f))
            .border(1.dp, S.White10, RoundedCornerShape(12.dp))
            .padding(12.dp),
    ) {
        Text(title, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = titleColor)
        Text(
            body,
            fontSize = 11.sp,
            color = Color(0xFFCBD5E1),
            lineHeight = 16.sp,
            modifier = Modifier.padding(top = 2.dp),
        )
    }
}

@Composable
private fun ModalField(label: String, value: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(S.Slate950.copy(alpha = 0.7f))
            .border(1.dp, S.White10, RoundedCornerShape(12.dp))
            .padding(14.dp),
    ) {
        Text(
            label.uppercase(),
            fontSize = 10.sp,
            fontWeight = FontWeight.Black,
            color = S.Slate400,
            letterSpacing = 0.6.sp,
        )
        Text(
            value,
            fontSize = 14.sp,
            fontWeight = FontWeight.Black,
            color = Color.White,
            modifier = Modifier.padding(top = 2.dp),
        )
    }
}

@Composable
private fun ModalHeader(
    badgeColor: Color,
    icon: ImageVector,
    title: String,
    subtitle: String,
    onClose: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(CircleShape)
                .background(badgeColor),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
        }
        Column(modifier = Modifier.padding(start = 10.dp)) {
            Text(title, fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White)
            Text(subtitle, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = S.Slate400)
        }
        Spacer(Modifier.weight(1f))
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .clickable(onClick = onClose)
                .padding(6.dp),
        ) {
            Icon(Icons.Filled.Close, contentDescription = "Close", tint = S.Slate400, modifier = Modifier.size(16.dp))
        }
    }
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(1.dp)
            .background(S.White10),
    )
}

@Composable
private fun AmberButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(S.Amber400)
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, fontSize = 12.sp, fontWeight = FontWeight.Black, color = S.Slate950)
    }
}

@Composable
private fun DemoModal(onDismiss: () -> Unit, content: @Composable () -> Unit) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.75f))
                .padding(16.dp),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 384.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(S.Slate900)
                    .border(1.dp, S.White15, RoundedCornerShape(16.dp))
                    .verticalScroll(rememberScrollState())
                    .padding(20.dp),
            ) { content() }
        }
    }
}
