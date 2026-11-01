package com.tourney.admin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.CreateTournamentRequest
import com.tourney.core.model.GameMode
import com.tourney.core.model.MapType
import com.tourney.core.model.MatchType
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.GlassCard
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZoneOffset

/** Create a match (canCreateMatch) — 48-slot tournament form. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateTournamentScreen(
    viewModel: AdminViewModel,
    onBack: () -> Unit,
    onCreated: () -> Unit,
) {
    var title by remember { mutableStateOf("") }
    var gameMode by remember { mutableStateOf(GameMode.BATTLE_ROYALE) }
    var matchType by remember { mutableStateOf(MatchType.SOLO) }
    var mapType by remember { mutableStateOf(MapType.BERMUDA) }
    var entryFee by remember { mutableStateOf("") }
    var prizePool by remember { mutableStateOf("") }
    var perKillPrize by remember { mutableStateOf("") }
    var timeText by remember { mutableStateOf("20:00") }
    var showDatePicker by remember { mutableStateOf(false) }
    var selectedDateEpoch by remember { mutableLongStateOf(0L) }
    var error by remember { mutableStateOf<String?>(null) }

    val uiState = viewModel.createUi

    // Success → confirm + leave
    LaunchedEffect(uiState) {
        when (uiState) {
            is AdminUi.Error -> error = uiState.message
            is AdminUi.Success<*> -> onCreated()
            else -> {}
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        AppTopBar(title = "Create Match", onBack = onBack)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            GlassCard(modifier = Modifier.fillMaxWidth()) {
                Text("⚙️ Settings", style = MaterialTheme.typography.titleMedium, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
            }

            OutlinedTextField(
                value = title,
                onValueChange = { title = it.take(100) },
                label = { Text("Tournament Title") },
                placeholder = { Text("Daily Bermuda Solo Bash #201") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

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

            OutlinedTextField(
                value = if (selectedDateEpoch > 0)
                    Instant.ofEpochMilli(selectedDateEpoch).atZone(ZoneId.systemDefault()).toLocalDate().toString()
                else "Today",
                onValueChange = {},
                label = { Text("Match Date") },
                readOnly = true,
                modifier = Modifier.fillMaxWidth(),
                trailingIcon = {
                    TextButton(onClick = { showDatePicker = true }) { Text("Pick") }
                },
            )

            OutlinedTextField(
                value = timeText,
                onValueChange = { timeText = it.take(5) },
                label = { Text("Match Time (HH:mm)") },
                placeholder = { Text("20:00") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
            )

            if (error != null) {
                Text(error!!, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
            }

            AppButton(
                text = if (uiState is AdminUi.Loading) "Creating…" else "Create Tournament",
                enabled = (uiState !is AdminUi.Loading) && title.length >= 3 &&
                    entryFee.toDoubleOrNull() != null && prizePool.toDoubleOrNull() != null,
                onClick = {
                    error = null
                    val fee = entryFee.toDoubleOrNull() ?: 0.0
                    val pool = prizePool.toDoubleOrNull() ?: 0.0
                    val kill = perKillPrize.toDoubleOrNull()?.takeIf { it > 0 }
                    val matchDate = if (selectedDateEpoch > 0)
                        Instant.ofEpochMilli(selectedDateEpoch).atZone(ZoneId.systemDefault()).toLocalDate()
                    else LocalDate.now()
                    val time = runCatching { LocalTime.parse(timeText.padEnd(5, '0')) }
                        .getOrNull() ?: LocalTime.of(20, 0)
                    val matchTime = Instant.from(matchDate.atTime(time).atZone(ZoneId.systemDefault()))
                    viewModel.createTournament(
                        CreateTournamentRequest(
                            title = title.trim(),
                            gameMode = gameMode,
                            matchType = matchType,
                            mapType = mapType,
                            entryFee = fee,
                            prizePool = pool,
                            perKillPrize = kill,
                            matchTime = matchTime.toString(),
                            totalSlots = 48,
                        )
                    )
                },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }

    if (showDatePicker) {
        val state = rememberDatePickerState()
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { selectedDateEpoch = adjustToNoon(it) }
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
}

private fun adjustToNoon(epochMillis: Long): Long {
    val zone = ZoneId.systemDefault()
    val date = Instant.ofEpochMilli(epochMillis).atZone(zone).toLocalDate()
    return date.atTime(LocalTime.NOON).atZone(zone).toInstant().toEpochMilli()
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