package com.tourney.player

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.tourney.core.util.TimeAuthority
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import com.tourney.core.datastore.SessionState
import com.tourney.core.model.MatchType
import com.tourney.core.model.Tournament
import com.tourney.core.model.TournamentStatus
import com.tourney.core.network.ApiClient
import com.tourney.core.security.SecurityChecker
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.GlassCard
import com.tourney.core.ui.LoadingState
import com.tourney.core.ui.MapBanner
import com.tourney.core.ui.ModeBadge
import com.tourney.core.ui.SlideToJoinButton
import com.tourney.core.ui.StatusBadge
import com.tourney.core.ui.TournamentArt
import com.tourney.core.ui.formatDurationShort
import com.tourney.core.ui.formatMatchTime
import com.tourney.core.ui.formatMoney

/**
 * Tournament feed — high-res Free Fire map banners + mode badges, live slot
 * progress, 1-tap direct Join via ModalBottomSheet, and room/scoreboard links.
 */
enum class FeedTab { UPCOMING, LIVE }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TournamentFeedScreen(
    viewModel: PlayerViewModel,
    onOpenRoom: (String) -> Unit,
    onOpenScoreboard: (String) -> Unit,
    onNavigateToWallet: () -> Unit,
    onLogout: () -> Unit,
) {
    val state = viewModel.feedUi
    val haptics = LocalHapticFeedback.current

    // Tabs: Upcoming vs Live Matches, plus mode chips
    var currentTab by remember { mutableStateOf(FeedTab.UPCOMING) }
    var modeFilter by remember { mutableStateOf<MatchType?>(null) }

    // Direct Join Bottom Sheet state
    var selectedTournamentForJoin by remember { mutableStateOf<Tournament?>(null) }
    var showJoinedDetailsDialog by remember { mutableStateOf<Tournament?>(null) }
    var showRoomCredentialsDialogFor by remember { mutableStateOf<Tournament?>(null) }
    var joinSuccessMessage by remember { mutableStateOf<String?>(null) }

    // Authoritative Server Time ticker (immune to device clock spoofing)
    var currentServerTimeMs by remember { mutableLongStateOf(TimeAuthority.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (isActive) {
            delay(1000L)
            currentServerTimeMs = TimeAuthority.currentTimeMillis()
        }
    }

    // Auto-refresh while the feed is open: a match whose admin visibility window
    // opens (e.g. "show only in the last 10 hours") must appear automatically —
    // without the player having to pull-to-refresh.
    LaunchedEffect(Unit) {
        while (isActive) {
            delay(60_000L)
            viewModel.refreshFeed(silent = true)
        }
    }


    val lifecycleOwner = androidx.lifecycle.compose.LocalLifecycleOwner.current
    androidx.compose.runtime.DisposableEffect(lifecycleOwner) {
        val observer = androidx.lifecycle.LifecycleEventObserver { _, event ->
            if (event == androidx.lifecycle.Lifecycle.Event.ON_RESUME) {
                viewModel.refreshFeed(silent = true)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background,
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            AppTopBar(
                title = "Tournaments",
                onBack = null,
                modifier = Modifier.fillMaxWidth(),
                actions = {
                    IconButton(onClick = onLogout) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ExitToApp,
                            contentDescription = "Logout",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
            )

            // --- Status tabs + mode chips ---------------------------------
            Column(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FeedChip(
                        label = "⚡ Upcoming",
                        selected = currentTab == FeedTab.UPCOMING,
                        onClick = { currentTab = FeedTab.UPCOMING },
                        modifier = Modifier.weight(1f),
                    )
                    FeedChip(
                        label = "🔴 Live Matches",
                        selected = currentTab == FeedTab.LIVE,
                        onClick = { currentTab = FeedTab.LIVE },
                        modifier = Modifier.weight(1f),
                    )
                }

                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FeedChip(
                        label = "All",
                        selected = modeFilter == null,
                        onClick = { modeFilter = null },
                    )
                    FeedChip(
                        label = "Solo",
                        selected = modeFilter == MatchType.SOLO,
                        onClick = { modeFilter = MatchType.SOLO },
                    )
                    FeedChip(
                        label = "Duo",
                        selected = modeFilter == MatchType.DUO,
                        onClick = { modeFilter = MatchType.DUO },
                    )
                    FeedChip(
                        label = "Squad",
                        selected = modeFilter == MatchType.SQUAD,
                        onClick = { modeFilter = MatchType.SQUAD },
                    )
                }
            }

            // --- Feed list with pull-to-refresh ---------------------------
            PullToRefreshBox(
                isRefreshing = viewModel.isFeedRefreshing,
                onRefresh = {
                    haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                    viewModel.refreshFeed()
                },
                modifier = Modifier.fillMaxSize(),
            ) {
                when (state) {
                    UiState.Idle, UiState.Loading -> LoadingState("Loading matches…")
                    is UiState.Error -> ErrorState(state.message) {
                        viewModel.refreshFeed(forceLoading = true)
                    }
                    is UiState.Success -> {
                        val allMatches = state.data.items

                        // 1. Finished / stale matches must disappear from the player app.
                        //    A match stays visible only until 3h after kickoff — the
                        //    admin app keeps the full match history forever.
                        val feedGraceMs = 3 * 60 * 60 * 1000L
                        val activeMatches = allMatches.filter { t ->
                            if (t.status == TournamentStatus.COMPLETED ||
                                t.status == TournamentStatus.CANCELLED
                            ) {
                                return@filter false
                            }
                            val matchMs = runCatching {
                                java.time.Instant.parse(t.matchTime).toEpochMilli()
                            }.getOrNull()
                            matchMs == null || matchMs >= currentServerTimeMs - feedGraceMs
                        }

                        // 1b. Honour the admin's player-list visibility window:
                        //     a match scheduled 12h later with a 10h window stays hidden
                        //     until only 10h remain. Already-joined matches never vanish.
                        //     This uses the ticking server-authoritative clock, so a
                        //     match appears automatically the moment its window opens.
                        val visibleMatches = activeMatches.filter {
                            it.isVisibleInPlayerFeed(currentServerTimeMs)
                        }

                        // 2. Sort: joined matches first so player never loses their match, then by matchTime ASC
                        val sortedMatches = visibleMatches.sortedWith(
                            compareByDescending<Tournament> { it.mySlot != null }
                                .thenBy { it.matchTime }
                        )

                        // 3. Separate Upcoming vs Live sections strictly using Server IST
                        val tabMatches = when (currentTab) {
                            FeedTab.UPCOMING -> sortedMatches.filter { match ->
                                val matchStartMs = try {
                                    java.time.Instant.parse(match.matchTime).toEpochMilli()
                                } catch (_: Exception) { Long.MAX_VALUE }

                                val isUpcomingStatus = match.status == TournamentStatus.UPCOMING ||
                                    match.status == TournamentStatus.OPEN ||
                                    match.status == TournamentStatus.SLOTS_FULL ||
                                    match.status == TournamentStatus.ROOM_REVEALED

                                isUpcomingStatus && (matchStartMs > currentServerTimeMs)
                            }
                            FeedTab.LIVE -> sortedMatches.filter { match ->
                                val matchStartMs = try {
                                    java.time.Instant.parse(match.matchTime).toEpochMilli()
                                } catch (_: Exception) { Long.MAX_VALUE }

                                val isKickoffPast = currentServerTimeMs >= matchStartMs
                                match.status == TournamentStatus.LIVE ||
                                    match.status == TournamentStatus.UNDER_REVIEW ||
                                    (isKickoffPast && (match.status == TournamentStatus.ROOM_REVEALED || match.status == TournamentStatus.OPEN || match.status == TournamentStatus.SLOTS_FULL))
                            }
                        }

                        val items = if (modeFilter == null) tabMatches else tabMatches.filter { it.matchType == modeFilter }

                        LazyColumn(
                            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                            verticalArrangement = Arrangement.spacedBy(14.dp),
                            modifier = Modifier.fillMaxSize(),
                        ) {
                            item {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 2.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(
                                        if (currentTab == FeedTab.UPCOMING) "⚡ Upcoming Matches (${items.size})" else "🔴 Live Matches (${items.size})",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold,
                                    )
                                    Text(
                                        "Pull to refresh",
                                        fontSize = 10.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }

                            if (items.isEmpty()) {
                                item {
                                    if (currentTab == FeedTab.UPCOMING) {
                                        EmptyMatchesCard(onRefresh = { viewModel.refreshFeed(forceLoading = true) })
                                    } else {
                                        EmptyLiveCard(onRefresh = { viewModel.refreshFeed(forceLoading = true) })
                                    }
                                }
                            }

                            items(items, key = { it.id }) { t ->
                                TournamentCard(
                                    tournament = t,
                                    nowEpochMs = currentServerTimeMs,
                                    onJoinClick = { selectedTournamentForJoin = t },
                                    onViewSeatClick = { showJoinedDetailsDialog = t },
                                    onOpenRoom = { showRoomCredentialsDialogFor = t },
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // ── Direct Join Bottom Sheet ──────────────────────────────────────────
    if (selectedTournamentForJoin != null) {
        val t = selectedTournamentForJoin!!
        JoinMatchBottomSheet(
            tournament = t,
            viewModel = viewModel,
            onDismiss = { selectedTournamentForJoin = null },
            onNavigateToWallet = {
                selectedTournamentForJoin = null
                onNavigateToWallet()
            },
            onSuccess = { _ ->
                selectedTournamentForJoin = null
                joinSuccessMessage = "🎉 Successfully joined ${t.displayName}! You are registered for this match."
            },
        )
    }

    // ── Joined Details Dialog ─────────────────────────────────────────────
    if (showJoinedDetailsDialog != null) {
        val t = showJoinedDetailsDialog!!
        val isWithinWindow = t.isWithin15MinWindow()
        AlertDialog(
            onDismissRequest = { showJoinedDetailsDialog = null },
            title = {
                Text(
                    if (isWithinWindow) "⏳ Room ID Releasing Soon" else "🎟️ Match Entry Confirmed",
                    fontWeight = FontWeight.Bold,
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(t.displayName, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                    Text("✅ You are registered for this match!", color = Color(0xFF00C853), fontWeight = FontWeight.Bold)
                    Text("⏰ Match Time: ${formatMatchTime(t.matchTime)}", fontSize = 13.sp)
                    Text(
                        if (isWithinWindow) {
                            "⏳ Organizer is creating the Custom Room in Free Fire. The Room ID & Password will drop right here in a few moments!"
                        } else {
                            "🔑 Room ID & Password will be revealed ${t.roomRevealLabel()}."
                        },
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            },
            confirmButton = {
                AppButton(text = "Got It", onClick = { showJoinedDetailsDialog = null })
            },
        )
    }

    // ── In-Place Custom Room ID & Password Pop-up Dialog ──────────────────
    if (showRoomCredentialsDialogFor != null) {
        val t = showRoomCredentialsDialogFor!!
        RoomCredentialsDialog(
            tournamentId = t.id,
            tournamentTitle = t.displayName,
            initialRoom = t.room,
            onDismiss = { showRoomCredentialsDialogFor = null },
        )
    }

    // ── Join Success Dialog ───────────────────────────────────────────────
    if (joinSuccessMessage != null) {
        AlertDialog(
            onDismissRequest = { joinSuccessMessage = null },
            title = { Text("Match Joined! 🎯", fontWeight = FontWeight.Bold) },
            text = { Text(joinSuccessMessage!!) },
            confirmButton = {
                AppButton(
                    text = "Awesome!",
                    onClick = { joinSuccessMessage = null },
                )
            },
        )
    }
}

/**
 * Direct Join Bottom Sheet:
 * Lets the gamer review the match, verify their Free Fire IGN/UID, check wallet balance,
 * and slide to confirm joining directly without going to any separate seat grid page!
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JoinMatchBottomSheet(
    tournament: Tournament,
    viewModel: PlayerViewModel,
    onDismiss: () -> Unit,
    onNavigateToWallet: () -> Unit,
    onSuccess: (com.tourney.core.model.JoinResult) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val haptics = LocalHapticFeedback.current
    val sessionState by ApiClient.sessionManager.session.collectAsState(initial = SessionState())

    var inGameNameInput by remember { mutableStateOf("") }
    var inGameUidInput by remember { mutableStateOf("") }
    var teamCodeInput by remember { mutableStateOf("") }
    var isEditingId by remember { mutableStateOf(false) }

    val hasSavedId = !sessionState.inGameUid.isNullOrBlank()

    LaunchedEffect(tournament.id) {
        viewModel.clearJoinError()
        viewModel.refreshWallet()
        if (sessionState.inGameName != null) inGameNameInput = sessionState.inGameName.orEmpty()
        if (sessionState.inGameUid != null) inGameUidInput = sessionState.inGameUid.orEmpty()
        isEditingId = !hasSavedId
    }

    val effectiveIgn = if (hasSavedId && !isEditingId) sessionState.inGameName.orEmpty() else inGameNameInput.trim()
    val effectiveUid = if (hasSavedId && !isEditingId) sessionState.inGameUid.orEmpty() else inGameUidInput.trim()

    val isIdentityValid = effectiveIgn.length >= 2 && effectiveUid.length in 6..12

    val walletSummary = (viewModel.walletUi as? UiState.Success)?.data
    val totalBalance = (walletSummary?.depositValue ?: 0.0) + (walletSummary?.winningValue ?: 0.0)
    val hasSufficientBalance = totalBalance >= tournament.entryFeeValue

    val isFull = tournament.slotsBooked >= tournament.totalSlots

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.surface,
        dragHandle = { BottomSheetDefaults.DragHandle() },
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 6.dp)
                .padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            // Header: Title & Close
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        tournament.displayName,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Spacer(Modifier.height(4.dp))
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        ModeBadge(tournament.gameMode, size = 18.dp)
                        Text(
                            tournament.matchType.name,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                        )
                        Text("•", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(
                            tournament.mapType.name,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.Bold,
                        )
                        Text("•", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(
                            formatMatchTime(tournament.matchTime),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, contentDescription = "Close")
                }
            }

            // Summary Card (Prize, Entry, Per Kill, Seats)
            GlassCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 14.dp) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    StatBlock(label = "Entry Fee", value = "₹${formatMoney(tournament.entryFeeValue)}", valueColor = MaterialTheme.colorScheme.primary)
                    StatBlock(label = "Prize Pool", value = "₹${formatMoney(tournament.prizePoolValue)}", valueColor = Color(0xFF00C853))
                    StatBlock(label = "Per Kill", value = "₹${formatMoney(tournament.perKillValue)}", valueColor = Color(0xFFFF9800))
                }
                Spacer(Modifier.height(10.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        "Seats: ${tournament.slotsBooked}/${tournament.totalSlots} Booked",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Medium,
                    )
                    Text(
                        if (isFull) "❌ Full" else "⚡ ${tournament.remainingSlots} seats left",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Bold,
                        color = if (isFull) MaterialTheme.colorScheme.error else Color(0xFF00C853),
                    )
                }
                Spacer(Modifier.height(4.dp))
                LinearProgressIndicator(
                    progress = { tournament.fillFraction },
                    modifier = Modifier.fillMaxWidth().height(6.dp),
                )
            }

            // Free Fire Identity (JIT setup)
            GlassCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 14.dp) {
                if (hasSavedId && !isEditingId) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("🎮 Playing As:", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(
                                "$effectiveIgn (UID: $effectiveUid)",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                        TextButton(onClick = { isEditingId = true }) {
                            Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Change", fontSize = 12.sp)
                        }
                    }
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(
                            "🎮 Free Fire Game Identity",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                        )
                        OutlinedTextField(
                            value = inGameNameInput,
                            onValueChange = { inGameNameInput = it.take(30) },
                            label = { Text("Free Fire IGN (Nickname)") },
                            placeholder = { Text("e.g. RAISTAR_99") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        OutlinedTextField(
                            value = inGameUidInput,
                            onValueChange = { inGameUidInput = it.filter(Char::isDigit).take(12) },
                            label = { Text("Free Fire UID (6-12 digits)") },
                            placeholder = { Text("1928374612") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }
            }

            // Squad Code if DUO / SQUAD
            if (tournament.matchType != MatchType.SOLO) {
                OutlinedTextField(
                    value = teamCodeInput,
                    onValueChange = { teamCodeInput = it.filter(Char::isDigit).take(6) },
                    label = { Text("Squad Code (Optional)") },
                    placeholder = { Text("6 digits (leave empty to create squad)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            // Wallet Balance Status
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(
                        if (hasSufficientBalance) Color(0xFF00C853).copy(alpha = 0.12f)
                        else MaterialTheme.colorScheme.error.copy(alpha = 0.12f)
                    )
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text(
                        if (hasSufficientBalance) "Wallet Balance Sufficient" else "Insufficient Wallet Balance",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (hasSufficientBalance) Color(0xFF00C853) else MaterialTheme.colorScheme.error,
                    )
                    Text(
                        "Available: ₹${formatMoney(totalBalance)} • Entry: ₹${formatMoney(tournament.entryFeeValue)}",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (!hasSufficientBalance) {
                    AppButton(
                        text = "+ Add Cash",
                        onClick = onNavigateToWallet,
                        modifier = Modifier.height(36.dp),
                    )
                }
            }

            // Error Message (if any)
            viewModel.joinMatchError?.let { err ->
                Text(
                    err,
                    color = MaterialTheme.colorScheme.error,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                )
            }

            if (!isIdentityValid) {
                Text(
                    "💡 Enter Free Fire IGN & UID above to unlock join",
                    color = MaterialTheme.colorScheme.primary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                )
            }

            val buttonText = when {
                isFull -> "Match Full ❌"
                !isIdentityValid -> "Enter Free Fire IGN & UID >>"
                !hasSufficientBalance -> "Insufficient Balance (Add Cash)"
                else -> "Slide or Tap to Join (₹${tournament.entryFeeValue.toInt()}) >>"
            }

            // SlideToJoinButton
            SlideToJoinButton(
                text = buttonText,
                enabled = !isFull && isIdentityValid && hasSufficientBalance && !viewModel.isJoiningMatch,
                loading = viewModel.isJoiningMatch,
                onConfirm = {
                    if (SecurityChecker.isEmulator()) {
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        return@SlideToJoinButton
                    }
                    viewModel.joinMatch(
                        tournamentId = tournament.id,
                        inGameName = effectiveIgn,
                        inGameUid = effectiveUid,
                        teamCode = teamCodeInput.takeIf { it.isNotBlank() },
                        onSuccess = onSuccess,
                    )
                },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

/** Cupertino-grade empty state when nothing is scheduled. */
@Composable
private fun EmptyMatchesCard(onRefresh: () -> Unit) {
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Text("🎮", fontSize = 34.sp)
        Text(
            "No matches scheduled right now",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
        )
        Text(
            "New Free Fire rooms drop every few hours. Pull down to refresh — or tap below.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 4.dp, bottom = 10.dp),
        )
        AppButton(text = "Refresh Matches", onClick = onRefresh, modifier = Modifier.fillMaxWidth())
    }
}

/** Live matches tab is empty. */
@Composable
private fun EmptyLiveCard(onRefresh: () -> Unit) {
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Text("🔴", fontSize = 34.sp)
        Text(
            "No live matches right now",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
        )
        Text(
            "Matches appear here for up to 3 hours after kick-off (until the organizer settles them). Check the Upcoming tab!",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 4.dp, bottom = 10.dp),
        )
        AppButton(
            text = "Refresh",
            onClick = onRefresh,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

/** Small pill used for the status / mode filter rows. */
@Composable
private fun FeedChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = {
            Text(
                label,
                fontSize = 11.sp,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                maxLines = 1,
            )
        },
        modifier = modifier,
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
            selectedLabelColor = MaterialTheme.colorScheme.primary,
        ),
    )
}

@Composable
fun TournamentCard(
    tournament: Tournament,
    nowEpochMs: Long = TimeAuthority.currentTimeMillis(),
    onJoinClick: () -> Unit,
    onViewSeatClick: () -> Unit,
    onOpenRoom: () -> Unit,
) {
    GlassCard(
        cornerRadius = 16.dp,
        contentPadding = 0.dp,
        modifier = Modifier.fillMaxWidth(),
    ) {
        // ─── Official map artwork banner (edge-to-edge) ─────────────────
        MapBanner(
            mapType = tournament.mapType,
            height = 116.dp,
            overlay = {
                StatusBadge(
                    status = tournament.status,
                    hasCredentials = tournament.hasRoomCredentials ?: (tournament.room != null),
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(10.dp),
                )

                Column(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        ModeBadge(
                            gameMode = tournament.gameMode,
                            modifier = Modifier.size(20.dp),
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            tournament.gameMode.name.replace("_", " "),
                            style = MaterialTheme.typography.labelSmall,
                            color = Color.White.copy(alpha = 0.85f),
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 11.sp,
                        )
                    }
                    Text(
                        tournament.displayName,
                        style = MaterialTheme.typography.titleMedium,
                        color = Color.White,
                        fontWeight = FontWeight.ExtraBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "🗺️ ${tournament.mapType.name}",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color.White.copy(alpha = 0.9f),
                            fontSize = 11.sp,
                        )
                        Text(
                            "👥 ${tournament.matchType.name}",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color.White.copy(alpha = 0.9f),
                            fontSize = 11.sp,
                        )
                    }
                }
            },
        )

        // ─── Metrics + live slot progress + action buttons ───────────────
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                StatBlock(
                    label = "Prize Pool",
                    value = "₹${formatMoney(tournament.prizePoolValue)}",
                    valueColor = Color(0xFF00C853),
                )
                StatBlock(
                    label = "Per Kill",
                    value = "₹${formatMoney(tournament.perKillValue)}",
                    valueColor = Color(0xFFFF9800),
                )
                StatBlock(
                    label = "Entry Fee",
                    value = "₹${formatMoney(tournament.entryFeeValue)}",
                    valueColor = MaterialTheme.colorScheme.primary,
                )
            }

            // Slots progress
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        "Seats: ${tournament.slotsBooked}/${tournament.totalSlots} Booked",
                        style = MaterialTheme.typography.bodySmall,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                    )
                    tournament.mySlot?.let {
                        Text(
                            "✅ Joined",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF00C853),
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                        )
                    }
                }
                LinearProgressIndicator(
                    progress = { tournament.fillFraction },
                    modifier = Modifier.fillMaxWidth().height(6.dp),
                )
            }

            val secondsToStart = tournament.secondsUntilMatch(nowEpochMs)
            Text(
                buildString {
                    append("⏰ Match Time: ${formatMatchTime(tournament.matchTime)}")
                    if (secondsToStart > 0) append(" • starts in ${formatDurationShort(secondsToStart)}")
                },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 12.sp,
            )

            HorizontalDivider(modifier = Modifier.padding(vertical = 2.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (tournament.mySlot != null) {
                    val isWithin15Min = tournament.isWithin15MinWindow() || tournament.status == TournamentStatus.ROOM_REVEALED || tournament.status == TournamentStatus.LIVE
                    val hasCredentials = tournament.room != null || tournament.hasRoomCredentials == true

                    if (isWithin15Min && hasCredentials) {
                        AppButton(
                            text = "🔑 Get Room ID & Password",
                            onClick = onOpenRoom,
                            modifier = Modifier.weight(1f),
                        )
                    } else if (isWithin15Min && !hasCredentials) {
                        AppButton(
                            text = "⏳ Room ID Dropping Soon...",
                            onClick = onViewSeatClick,
                            modifier = Modifier.weight(1f),
                        )
                    } else {
                        val secondsToRoom = tournament.secondsUntilRoomReveal(nowEpochMs)
                        AppButton(
                            text = if (secondsToRoom > 0L) {
                                "✅ Joined • Room in ${formatDurationShort(secondsToRoom)}"
                            } else {
                                "✅ Joined • Waiting for Room ID"
                            },
                            onClick = onViewSeatClick,
                            modifier = Modifier.weight(1f),
                        )
                    }
                } else if (tournament.status == TournamentStatus.UPCOMING || tournament.status == TournamentStatus.OPEN) {
                    AppButton(
                        text = if (tournament.remainingSlots == 0) "🔒 Slots Full" else "⚡ Join Match",
                        onClick = onJoinClick,
                        enabled = tournament.remainingSlots > 0,
                        modifier = Modifier.weight(1f),
                    )
                } else if (tournament.status == TournamentStatus.LIVE) {
                    AppButton(
                        text = "🔴 Live In-Progress",
                        onClick = {},
                        enabled = false,
                        modifier = Modifier.weight(1f),
                    )
                } else if (tournament.status == TournamentStatus.ROOM_REVEALED) {
                    AppButton(
                        text = "⏳ Starting Soon",
                        onClick = {},
                        enabled = false,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

@Composable
private fun StatBlock(label: String, value: String, valueColor: Color = Color.Unspecified) {
    Column {
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
        Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = valueColor)
    }
}
