package com.tourney.player

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.repeatOnLifecycle
import com.tourney.core.model.MatchType
import com.tourney.core.model.SlotEntry
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.GlassCard
import com.tourney.core.ui.GlowProgressBar
import com.tourney.core.ui.LoadingState
import com.tourney.core.ui.SlideToJoinButton
import com.tourney.core.ui.formatMoney
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * 48-Seat grid (12 rows x 4 cols). Booked seats show IGN, open seats are
 * tappable. DUO/SQUAD matches accept a 6-digit team code to join a friend's
 * squad; without a code the joining player becomes the leader and receives
 * a fresh code to share.
 */
@Composable
fun SlotPickerScreen(
    tournamentId: String,
    matchType: MatchType,
    entryFee: String,
    viewModel: MatchViewModel,
    onBack: () -> Unit,
    onJoinSuccess: (Double) -> Unit = {},
) {
    val state = viewModel.slotsUi
    var selectedSlot by remember { mutableStateOf<SlotEntry?>(null) }
    var teamCode by remember { mutableStateOf("") }
    val haptics = LocalHapticFeedback.current
    val clipboard = LocalClipboardManager.current
    val result = viewModel.lastJoinResult
    var showTeamCodeDialog by remember { mutableStateOf(false) }
    var showSoloSuccessDialog by remember { mutableStateOf(false) }

    LaunchedEffect(tournamentId) { viewModel.loadSlots(tournamentId) }
    LaunchedEffect(result) {
        if (result != null) {
            selectedSlot = null
            teamCode = ""
            val fee = entryFee.toDoubleOrNull() ?: 0.0
            onJoinSuccess(fee)
            if (result.teamCode != null) {
                showTeamCodeDialog = true
            } else {
                showSoloSuccessDialog = true
            }
        }
    }

    // ── Realtime occupancy polling: every 5s while the screen is visible ──
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()
    DisposableEffect(lifecycleOwner, tournamentId) {
        val job = scope.launch {
            lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
                while (isActive) {
                    delay(5000)
                    viewModel.silentRefreshSlots(tournamentId)
                }
            }
        }
        onDispose { job.cancel() }
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background,
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            Column(modifier = Modifier.fillMaxSize()) {
            AppTopBar(title = "Select Your Seat", onBack = onBack)

            when (state) {
                UiState.Idle, UiState.Loading -> LoadingState("Loading 48 seats…")
                is UiState.Error -> ErrorState(state.message) { viewModel.loadSlots(tournamentId) }
                is UiState.Success -> {
                    val bookedCount = state.data.booked
                    val totalSlots = state.data.totalSlots.coerceAtLeast(48)
                    val nearFull = bookedCount >= 40

                    // Build complete 1..totalSlots list so empty slots are ALWAYS interactive
                    val bookedMap = remember(state.data.slots) {
                        state.data.slots.associateBy { it.slotNumber }
                    }
                    val allSlots = remember(state.data.slots, totalSlots) {
                        (1..totalSlots).map { num ->
                            bookedMap[num] ?: SlotEntry(slotNumber = num, teamId = null, player = null)
                        }
                    }

                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 6.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                "Seats: $bookedCount / $totalSlots Booked",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                            )
                            // Legend
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                LegendItem(color = Color(0xFF00E676), label = "Open")
                                LegendItem(color = Color(0xFFE53935), label = "Taken")
                                LegendItem(color = MaterialTheme.colorScheme.primary, label = "Selected")
                            }
                        }

                        GlowProgressBar(
                            progress = bookedCount.toFloat() / totalSlots,
                            nearFull = nearFull,
                            modifier = Modifier.padding(top = 8.dp),
                        )
                    }

                    LazyVerticalGrid(
                        columns = GridCells.Fixed(4),
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                        contentPadding = PaddingValues(bottom = if (selectedSlot != null) 220.dp else 24.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(allSlots, key = { it.slotNumber }) { slot ->
                            SeatCell(
                                slot = slot,
                                selected = slot.slotNumber == selectedSlot?.slotNumber,
                                onClick = {
                                    if (!slot.isBooked) {
                                        viewModel.clearActionError()
                                        selectedSlot = slot
                                        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    }
                                },
                            )
                        }
                    }
                }
            }
        }

        // ── Bottom Join Confirmation Sheet (Full Width Slide To Join) ──
        AnimatedVisibility(
            visible = selectedSlot != null,
            enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
            exit = slideOutVertically(targetOffsetY = { it }) + fadeOut(),
            modifier = Modifier.align(Alignment.BottomCenter),
        ) {
            selectedSlot?.let { slot ->
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    tonalElevation = 8.dp,
                    shadowElevation = 16.dp,
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column {
                                Text(
                                    "Selected: Seat #${slot.slotNumber}",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                )
                                Text(
                                    "Entry Fee: ₹${formatMoney(entryFee.toDoubleOrNull() ?: 0.0)}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.primary,
                                    fontWeight = FontWeight.SemiBold,
                                )
                            }
                            IconButton(onClick = { selectedSlot = null }) {
                                Icon(Icons.Default.Close, contentDescription = "Close")
                            }
                        }

                        if (matchType != MatchType.SOLO) {
                            OutlinedTextField(
                                value = teamCode,
                                onValueChange = { teamCode = it.filter(Char::isDigit).take(6) },
                                label = { Text("Squad Code (Optional)") },
                                placeholder = { Text("Leave blank to create new squad") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }

                        viewModel.actionError?.let { err ->
                            Text(
                                text = err,
                                color = MaterialTheme.colorScheme.error,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }

                        SlideToJoinButton(
                            text = "Slide to Join ₹${formatMoney(entryFee.toDoubleOrNull() ?: 0.0)} >>",
                            enabled = !viewModel.joining,
                            loading = viewModel.joining,
                            onConfirm = {
                                viewModel.join(
                                    tournamentId,
                                    slot.slotNumber,
                                    teamCode.ifBlank { null },
                                )
                            },
                        )

                        TextButton(
                            onClick = {
                                haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                                viewModel.join(
                                    tournamentId,
                                    slot.slotNumber,
                                    teamCode.ifBlank { null },
                                )
                            },
                            enabled = !viewModel.joining,
                            modifier = Modifier.align(Alignment.CenterHorizontally),
                        ) {
                            Icon(
                                imageVector = Icons.Default.Bolt,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(18.dp).padding(end = 4.dp),
                            )
                            Text(
                                "Or Tap to Quick Join",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.primary,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                }
            }
        }
    }
}

    // Leader team-code share dialog
    if (showTeamCodeDialog && result?.teamCode != null) {
        AlertDialog(
            onDismissRequest = { showTeamCodeDialog = false },
            title = { Text("Squad Created Successfully! 🎉", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Your Seat: #${result.slotNumber}")
                    Text("Share this 6-digit code with your teammates:", fontSize = 13.sp)
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                color = MaterialTheme.colorScheme.primaryContainer,
                                shape = RoundedCornerShape(12.dp),
                            )
                            .padding(vertical = 12.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            result.teamCode!!,
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                        )
                    }
                }
            },
            confirmButton = {
                AppButton(
                    text = "Copy Squad Code",
                    onClick = {
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        clipboard.setText(AnnotatedString(result.teamCode!!))
                        showTeamCodeDialog = false
                    },
                )
            },
            dismissButton = {
                TextButton(onClick = { showTeamCodeDialog = false }) { Text("Done") }
            },
        )
    }

    // Solo or member seat confirmed dialog
    if (showSoloSuccessDialog && result != null && result.teamCode == null) {
        AlertDialog(
            onDismissRequest = {
                showSoloSuccessDialog = false
                viewModel.loadSlots(tournamentId)
            },
            title = { Text("Seat Booked Successfully! 🎮", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "Seat #${result.slotNumber} has been locked for you!",
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text("Entry Fee: ₹${result.entryFee}")
                    Text("Remaining Balance: ₹${result.balanceAfter}")
                    Text(
                        "Room ID and Password will be visible on the Room screen 15 minutes before match start.",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            },
            confirmButton = {
                AppButton(
                    text = "Awesome! 🚀",
                    onClick = {
                        showSoloSuccessDialog = false
                        viewModel.loadSlots(tournamentId)
                    },
                )
            },
        )
    }
}

@Composable
private fun LegendItem(color: Color, label: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .background(color, CircleShape)
        )
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontSize = 11.sp,
        )
    }
}

@Composable
private fun SeatCell(slot: SlotEntry, selected: Boolean, onClick: () -> Unit) {
    val booked = slot.isBooked

    val borderColor = when {
        selected -> MaterialTheme.colorScheme.primary
        booked -> Color(0xFFE53935).copy(alpha = 0.5f)
        else -> Color(0xFF00E676).copy(alpha = 0.5f)
    }

    val backgroundColor = when {
        selected -> MaterialTheme.colorScheme.primary.copy(alpha = 0.25f)
        booked -> Color(0xFFE53935).copy(alpha = 0.15f)
        else -> Color(0xFF00E676).copy(alpha = 0.08f)
    }

    Surface(
        onClick = { if (!booked) onClick() },
        enabled = !booked,
        shape = RoundedCornerShape(10.dp),
        color = backgroundColor,
        border = BorderStroke(1.5.dp, borderColor),
        modifier = Modifier.height(68.dp),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier
                .fillMaxSize()
                .padding(4.dp),
        ) {
            Text(
                "#${slot.slotNumber}",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = if (selected) MaterialTheme.colorScheme.primary else Color.White,
            )
            if (booked) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Icon(
                        Icons.Default.Lock,
                        contentDescription = "Booked",
                        tint = Color(0xFFE53935),
                        modifier = Modifier.size(10.dp),
                    )
                    Text(
                        text = slot.player?.inGameName?.take(8) ?: "Taken",
                        fontSize = 10.sp,
                        color = Color(0xFFE53935),
                        textAlign = TextAlign.Center,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            } else {
                Text(
                    text = "OPEN",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF00E676),
                )
            }
        }
    }
}


