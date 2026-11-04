package com.tourney.admin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.TenantSettings
import com.tourney.core.theme.ThemeMode
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.GlassCard
import com.tourney.core.ui.LoadingState

/** UPI handle@bank validation (mirrors the backend regex). */
private val UPI_REGEX = Regex("^[a-zA-Z0-9.\\-_]{2,256}@[a-zA-Z]{2,64}$")

/**
 * Owner-only App Settings — runtime UPI ID / payee name / WhatsApp support /
 * minimum deposit, plus the shared light-dark appearance switch.
 *
 * Nothing here needs an APK rebuild: the Player app reads these on login and
 * on every profile refresh, so the Add-Cash QR follows the database.
 */
@Composable
fun AdminSettingsScreen(
    viewModel: AdminViewModel,
    themeMode: ThemeMode,
    onSetThemeMode: (ThemeMode) -> Unit,
    onBack: () -> Unit,
) {
    LaunchedEffect(Unit) { viewModel.loadSettings() }

    val state = viewModel.settingsUi
    var upiId by remember { mutableStateOf("") }
    var upiName by remember { mutableStateOf("") }
    var whatsapp by remember { mutableStateOf("") }
    var minDeposit by remember { mutableStateOf("10") }
    var loadedOnce by remember { mutableStateOf(false) }

    // Prefill the form the first time the settings arrive (never clobber edits).
    (state as? AdminUi.Success)?.data?.let { s: TenantSettings ->
        if (!loadedOnce) {
            upiId = s.upiId
            upiName = s.payeeName
            whatsapp = s.supportWhatsapp
            minDeposit = s.minDeposit.toString()
            loadedOnce = true
        }
    }

    val upiValid = UPI_REGEX.matches(upiId.trim())
    val nameValid = upiName.trim().length >= 2
    val waDigits = whatsapp.filter { it.isDigit() }
    val waValid = waDigits.isEmpty() || waDigits.length in 10..15
    val minValue = minDeposit.toIntOrNull()
    val minValid = minValue != null && minValue in 10..10000
    val canSave = upiValid && nameValid && waValid && minValid && !viewModel.settingsSaving

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize()) {
            AppTopBar(title = "App Settings", onBack = onBack)

            when (state) {
                AdminUi.Idle, AdminUi.Loading -> LoadingState("Loading settings…")
                is AdminUi.Error -> ErrorState(state.message) { viewModel.loadSettings() }
                is AdminUi.Success -> Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    GlassCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 18.dp) {
                        Text("💳 Collecting UPI", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text(
                            "Players pay this ID for Add Cash. Changing it here updates their QR instantly — no new APK.",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 2.dp, bottom = 10.dp),
                        )

                        OutlinedTextField(
                            value = upiId,
                            onValueChange = { upiId = it },
                            label = { Text("UPI ID (e.g. thunder@okaxis)") },
                            singleLine = true,
                            isError = upiId.isNotBlank() && !upiValid,
                            supportingText = if (upiId.isNotBlank() && !upiValid) {
                                { Text("Format: name@bank") }
                            } else null,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(
                            value = upiName,
                            onValueChange = { upiName = it },
                            label = { Text("Payee name (shown in UPI app)") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }

                    GlassCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 18.dp) {
                        Text("💬 Player Support", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text(
                            "WhatsApp number shown on the player Wallet + Profile screens. Leave empty to hide it.",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 2.dp, bottom = 10.dp),
                        )
                        OutlinedTextField(
                            value = whatsapp,
                            onValueChange = { whatsapp = it.filter { ch -> ch.isDigit() || ch == '+' } },
                            label = { Text("WhatsApp (with country code)") },
                            placeholder = { Text("919999900001") },
                            singleLine = true,
                            isError = !waValid,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                            supportingText = if (!waValid) {
                                { Text("10-15 digits, e.g. 919999900001") }
                            } else null,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(
                            value = minDeposit,
                            onValueChange = { minDeposit = it.filter { ch -> ch.isDigit() } },
                            label = { Text("Minimum Add Cash (₹)") },
                            singleLine = true,
                            isError = !minValid,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            supportingText = if (!minValid) {
                                { Text("Between ₹10 and ₹10000") }
                            } else null,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }

                    GlassCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 18.dp) {
                        Text("🎨 Appearance", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text(
                            "Same preference as the Player app — dark, light or follow the phone.",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 2.dp, bottom = 10.dp),
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            ThemePill(
                                "🌙 Dark",
                                themeMode == ThemeMode.DARK,
                                { onSetThemeMode(ThemeMode.DARK) },
                                Modifier.weight(1f),
                            )
                            ThemePill(
                                "☀️ Light",
                                themeMode == ThemeMode.LIGHT,
                                { onSetThemeMode(ThemeMode.LIGHT) },
                                Modifier.weight(1f),
                            )
                            ThemePill(
                                "🔄 Auto",
                                themeMode == ThemeMode.SYSTEM,
                                { onSetThemeMode(ThemeMode.SYSTEM) },
                                Modifier.weight(1f),
                            )
                        }
                    }

                    viewModel.settingsMessage?.let {
                        Text("✅ $it", fontSize = 11.sp, color = Color(0xFF00C853), fontWeight = FontWeight.SemiBold)
                    }
                    viewModel.settingsError?.let {
                        Text("⚠️ $it", fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
                    }

                    AppButton(
                        text = if (viewModel.settingsSaving) "⏳ Saving…" else "Save Changes",
                        enabled = canSave,
                        onClick = {
                            viewModel.saveSettings(
                                upiId = upiId,
                                upiName = upiName,
                                supportWhatsapp = waDigits,
                                minDeposit = minValue ?: 10,
                            )
                        },
                        modifier = Modifier.fillMaxWidth(),
                    )

                    Text(
                        "Changes apply to every player device on their next wallet refresh.",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun ThemePill(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val bg = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
    val fg = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface
    androidx.compose.material3.TextButton(
        onClick = onClick,
        modifier = modifier,
        shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
        colors = androidx.compose.material3.ButtonDefaults.textButtonColors(containerColor = bg),
    ) {
        Text(label, color = fg, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
    }
}
