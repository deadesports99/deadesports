package com.tourney.admin

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.tourney.core.model.CreateTournamentRequest
import com.tourney.core.model.GameMode
import com.tourney.core.model.MapType
import com.tourney.core.model.MatchType
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.GlassCard
import com.tourney.core.ui.formatDurationShort
import com.tourney.core.ui.formatIstDateWithWeekday
import com.tourney.core.ui.formatIstFullDateTime
import com.tourney.core.ui.formatIstTimeOfDay
import com.tourney.core.ui.istEpochMs
import com.tourney.core.util.TimeAuthority
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneOffset
import java.time.ZonedDateTime

/** How the match should appear in the player feed. */
private enum class VisibilityMode { ALWAYS, WITHIN_HOURS }

/** Minimum number of hours the admin can set for the visibility window. */
private const val MIN_VISIBILITY_HOURS = 1
private const val MAX_VISIBILITY_HOURS = 336

/**
 * Create a match (canCreateMatch) — 48-slot tournament form.
 *
 * Schedule is ALWAYS Indian Standard Time (IST) with a 12-hour AM/PM picker,
 * independent of the phone's time zone. The admin can also decide how late the
 * match appears in the player list (e.g. "show only in the last 10 hours").
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateTournamentScreen(
    viewModel: AdminViewModel,
    onBack: () -> Unit,
    onCreated: () -> Unit,
) {
    var gameMode by remember { mutableStateOf(GameMode.BATTLE_ROYALE) }
    var matchType by remember { mutableStateOf(MatchType.SOLO) }
    var mapType by remember { mutableStateOf(MapType.BERMUDA) }
    var entryFee by remember { mutableStateOf("") }
    var prizePool by remember { mutableStateOf("") }
    var perKillPrize by remember { mutableStateOf("") }

    // ── IST schedule (server-authoritative clock, Asia/Kolkata zone) ──────
    val defaultStart = remember {
        TimeAuthority.currentIstDateTime().plusHours(2).withMinute(0).withSecond(0).withNano(0)
    }
    var selectedDate by remember { mutableStateOf(defaultStart.toLocalDate()) }
    var selectedTime by remember { mutableStateOf(defaultStart.toLocalTime()) }
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }

    // ── Player-list visibility window ─────────────────────────────────────
    var visibilityMode by remember { mutableStateOf(VisibilityMode.ALWAYS) }
    var visibilityHoursText by remember { mutableStateOf("10") }

    var error by remember { mutableStateOf<String?>(null) }

    val uiState = viewModel.createUi

    // Success → confirm + leave. The result is consumed first: leaving `Success` in
    // the ViewModel made the next visit pop itself back to the dashboard instantly.
    LaunchedEffect(uiState) {
        when (uiState) {
            is AdminUi.Error -> error = uiState.message
            is AdminUi.Success<*> -> {
                viewModel.clearCreateState()
                onCreated()
            }
            else -> {}
        }
    }

    val nowMs = TimeAuthority.currentTimeMillis()
    val matchEpochMs = istEpochMs(selectedDate, selectedTime)
    val matchInFuture = matchEpochMs > nowMs + 60_000L
    val secondsUntilStart = (matchEpochMs - nowMs).coerceAtLeast(0) / 1000L

    val parsedVisibilityHours = visibilityHoursText.toIntOrNull()
    val visibilityValid = visibilityMode == VisibilityMode.ALWAYS ||
        (parsedVisibilityHours != null && parsedVisibilityHours in MIN_VISIBILITY_HOURS..MAX_VISIBILITY_HOURS)
    val visibleFromEpochMs = parsedVisibilityHours
        ?.takeIf { it in MIN_VISIBILITY_HOURS..MAX_VISIBILITY_HOURS }
        ?.let { matchEpochMs - it * 3_600_000L }
    val windowAlreadyOpen = visibleFromEpochMs != null && visibleFromEpochMs <= nowMs

    Column(modifier = Modifier.fillMaxSize()) {
        AppTopBar(title = "Create Match", onBack = onBack)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                // The numeric keyboard used to cover the submit button at the very bottom.
                .imePadding()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            GlassCard(modifier = Modifier.fillMaxWidth()) {
                Text(
                    "⚙️ Match Settings",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    "Match number (#1, #2, #3 …) and the title are generated automatically from the map + mode.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            DropdownField("Game Mode", gameMode.name, GameMode.entries.map { it.name }) { gameMode = GameMode.valueOf(it) }
            DropdownField("Match Type", matchType.name, MatchType.entries.map { it.name }) { matchType = MatchType.valueOf(it) }
            DropdownField("Map", mapType.name, MapType.entries.map { it.name }) { mapType = MapType.valueOf(it) }

            OutlinedTextField(
                value = entryFee,
                onValueChange = { entryFee = it.filter { c -> c.isDigit() || c == '.' }.take(8) },
                label = { Text("Entry Fee (₹)") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = prizePool,
                onValueChange = { prizePool = it.filter { c -> c.isDigit() || c == '.' }.take(8) },
                label = { Text("Prize Pool (₹)") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = perKillPrize,
                onValueChange = { perKillPrize = it.filter { c -> c.isDigit() || c == '.' }.take(8) },
                label = { Text("Per-Kill Prize (₹, optional)") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth(),
            )

            HorizontalDivider(modifier = Modifier.padding(vertical = 2.dp))

            // ── Indian Date & Time (IST, 12-hour AM/PM) ──────────────────
            Text(
                "🗓️ Match Schedule (IST)",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
            )

            OutlinedTextField(
                value = formatIstDateWithWeekday(istEpochMs(selectedDate, LocalTime.NOON)),
                onValueChange = {},
                label = { Text("Match Date (Indian Standard Time)") },
                readOnly = true,
                modifier = Modifier.fillMaxWidth(),
                trailingIcon = {
                    TextButton(onClick = { showDatePicker = true }) { Text("Pick") }
                },
            )

            OutlinedTextField(
                value = formatIstTimeOfDay(matchEpochMs),
                onValueChange = {},
                label = { Text("Match Time (IST • AM/PM)") },
                readOnly = true,
                modifier = Modifier.fillMaxWidth(),
                trailingIcon = {
                    TextButton(onClick = { showTimePicker = true }) { Text("Pick") }
                },
            )

            // Quick scheduling shortcuts (+1h / +3h / +6h / +12h / +24h).
            Text(
                "Quick schedule:",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf(1L, 3L, 6L, 12L, 24L).forEach { hours ->
                    FilterChip(
                        selected = false,
                        onClick = {
                            val target = roundUpToQuarter(TimeAuthority.currentIstDateTime().plusHours(hours))
                            selectedDate = target.toLocalDate()
                            selectedTime = target.toLocalTime()
                            error = null
                        },
                        label = { Text("+${hours}h", fontSize = 11.sp) },
                        colors = FilterChipDefaults.filterChipColors(),
                    )
                }
            }

            // IST preview of exactly when the match will start.
            val previewColor = when {
                !matchInFuture -> MaterialTheme.colorScheme.error
                else -> MaterialTheme.colorScheme.primary
            }
            GlassCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 12.dp) {
                Text(
                    "⏰ Match starts: ${formatIstFullDateTime(matchEpochMs)} IST",
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                    color = previewColor,
                )
                Text(
                    when {
                        !matchInFuture -> "❌ Match time must be in the future."
                        else -> "Starts in about ${formatDurationShort(secondsUntilStart)} (IST)."
                    },
                    fontSize = 11.sp,
                    color = previewColor,
                )
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 2.dp))

            // ── Player-list visibility window ────────────────────────────
            Text(
                "👁️ Player List Visibility",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "You decide when players can see this match in their list. " +
                    "Tip: a match 12 hours away with a 10-hour window stays hidden until 10 hours remain.",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = visibilityMode == VisibilityMode.ALWAYS,
                    onClick = { visibilityMode = VisibilityMode.ALWAYS },
                    label = { Text("Always visible", fontSize = 11.sp) },
                )
                FilterChip(
                    selected = visibilityMode == VisibilityMode.WITHIN_HOURS,
                    onClick = { visibilityMode = VisibilityMode.WITHIN_HOURS },
                    label = { Text("Only near start", fontSize = 11.sp) },
                )
            }

            if (visibilityMode == VisibilityMode.WITHIN_HOURS) {
                OutlinedTextField(
                    value = visibilityHoursText,
                    onValueChange = { visibilityHoursText = it.filter(Char::isDigit).take(3) },
                    label = { Text("Show in list this many hours before start") },
                    placeholder = { Text("10") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    isError = !visibilityValid,
                    supportingText = {
                        Text(
                            if (visibilityValid) "Between 1 and 336 hours (14 days)"
                            else "Enter 1 to 336 hours",
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
                )

                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("2", "6", "10", "12", "24").forEach { preset ->
                        FilterChip(
                            selected = visibilityHoursText == preset,
                            onClick = { visibilityHoursText = preset },
                            label = { Text("${preset}h", fontSize = 11.sp) },
                        )
                    }
                }

                if (visibilityValid && visibleFromEpochMs != null) {
                    GlassCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 12.dp) {
                        Text(
                            "👁️ Players see this match from: ${formatIstFullDateTime(visibleFromEpochMs)} IST",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                        )
                        Text(
                            if (windowAlreadyOpen) {
                                "This window has already opened — the match will be visible immediately."
                            } else {
                                "Hidden until then • ${formatDurationShort((visibleFromEpochMs - nowMs) / 1000L)} from now (" +
                                    "${parsedVisibilityHours} hours before the match starts)."
                            },
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            "Players who already joined always keep seeing their match.",
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            } else {
                Text(
                    "👁️ Players can see this match in their list right after it is created.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.primary,
                )
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 2.dp))

            // Room ID & Password timing lives in the Room console only (Publish Room ID).
            GlassCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 12.dp) {
                Text("🔑 Room ID & Password", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Text(
                    "Not part of match creation. After saving this match, open Publish Room ID to set the " +
                        "code, its password and when players can see it.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            if (error != null) {
                Text(error!!, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
            }

            AppButton(
                text = if (uiState is AdminUi.Loading) "Creating…" else "Create Tournament",
                enabled = (uiState !is AdminUi.Loading) &&
                    entryFee.toDoubleOrNull() != null && prizePool.toDoubleOrNull() != null &&
                    matchInFuture && visibilityValid,
                onClick = {
                    error = null
                    if (!matchInFuture) {
                        error = "Match time must be in the future (IST)."
                        return@AppButton
                    }
                    if (!visibilityValid) {
                        error = "Visibility window must be between 1 and 336 hours."
                        return@AppButton
                    }
                    val fee = entryFee.toDoubleOrNull() ?: 0.0
                    val pool = prizePool.toDoubleOrNull() ?: 0.0
                    val kill = perKillPrize.toDoubleOrNull()?.takeIf { it > 0 }
                    val matchTimeIso = Instant.ofEpochMilli(matchEpochMs).toString()
                    viewModel.createTournament(
                        CreateTournamentRequest(
                            gameMode = gameMode,
                            matchType = matchType,
                            mapType = mapType,
                            entryFee = fee,
                            prizePool = pool,
                            perKillPrize = kill,
                            matchTime = matchTimeIso,
                            totalSlots = 48,
                            visibilityHours = if (visibilityMode == VisibilityMode.ALWAYS) {
                                null
                            } else {
                                parsedVisibilityHours
                            },
                        )
                    )
                },
                modifier = Modifier.fillMaxWidth(),
            )

            Text(
                "Room reveal timing: set it in Publish Room ID (default 15 min before start).",
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }

    // ── Indian date picker ───────────────────────────────────────────────
    if (showDatePicker) {
        val state = rememberDatePickerState(
            initialSelectedDateMillis = selectedDate
                .atStartOfDay(ZoneOffset.UTC)
                .toInstant()
                .toEpochMilli(),
        )
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { millis ->
                        selectedDate = Instant.ofEpochMilli(millis)
                            .atZone(ZoneOffset.UTC)
                            .toLocalDate()
                    }
                    showDatePicker = false
                }) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text("Cancel") }
            },
        ) {
            DatePicker(state = state)
        }
    }

    // ── IST 12-hour time picker (AM / PM) ────────────────────────────────
    if (showTimePicker) {
        val timeState = rememberTimePickerState(
            initialHour = selectedTime.hour,
            initialMinute = selectedTime.minute,
            is24Hour = false,
        )
        Dialog(
            onDismissRequest = { showTimePicker = false },
            properties = DialogProperties(usePlatformDefaultWidth = false),
        ) {
            Surface(
                shape = RoundedCornerShape(24.dp),
                color = MaterialTheme.colorScheme.surface,
                tonalElevation = 6.dp,
                modifier = Modifier
                    .fillMaxWidth(0.92f)
                    .padding(vertical = 24.dp),
            ) {
                Column(
                    modifier = Modifier.padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text(
                        "Match Time (IST)",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        "Select the start time in Indian Standard Time (AM/PM).",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    TimePicker(state = timeState)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End,
                    ) {
                        TextButton(onClick = { showTimePicker = false }) { Text("Cancel") }
                        TextButton(
                            onClick = {
                                selectedTime = LocalTime.of(timeState.hour, timeState.minute)
                                showTimePicker = false
                            },
                        ) { Text("OK", fontWeight = FontWeight.Bold) }
                    }
                }
            }
        }
    }
}

/** Round an IST zoned time UP to the next 15-minute boundary (used by quick chips). */
private fun roundUpToQuarter(zdt: ZonedDateTime): ZonedDateTime {
    val add = (15 - zdt.minute % 15) % 15
    return zdt.plusMinutes(add.toLong()).withSecond(0).withNano(0)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DropdownField(label: String, value: String, options: List<String>, onSelect: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { option ->
                DropdownMenuItem(text = { Text(option) }, onClick = {
                    onSelect(option)
                    expanded = false
                })
            }
        }
    }
}
