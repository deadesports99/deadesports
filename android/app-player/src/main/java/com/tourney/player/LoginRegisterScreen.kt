package com.tourney.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.text.KeyboardOptions
import com.tourney.core.theme.LocalClientConfig
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.GlassCard

/**
 * Login / Register — tabbed. Registration collects phone + IGN + numeric
 * Free Fire UID (6-12 digits). Purely API-driven; NO screenshot anywhere.
 */
@Composable
fun LoginRegisterScreen(
    viewModel: PlayerViewModel,
    onLoggedIn: () -> Unit,
) {
    var tab by remember { mutableIntStateOf(0) }
    var phone by remember { mutableStateOf("") }
    var ign by remember { mutableStateOf("") }
    var uid by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val config = LocalClientConfig.current

    // Surface VM errors inline; clear once a call settles.
    val uiState = viewModel.authUi
    androidx.compose.runtime.LaunchedEffect(uiState) {
        when (uiState) {
            is UiState.Error -> {
                error = uiState.message
                busy = false
            }
            is UiState.Success<*> -> busy = false
            else -> {}
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Spacer(Modifier.height(24.dp))

        GlassCard(modifier = Modifier.fillMaxWidth()) {
            Text("⚡ ${config.appName}", style = MaterialTheme.typography.headlineLarge)
            Text(
                "Free Fire Battle Royale Tournaments",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        TabRow(selectedTabIndex = tab) {
            Tab(selected = tab == 0, onClick = { tab = 0; error = null }, text = { Text("Login") })
            Tab(selected = tab == 1, onClick = { tab = 1; error = null }, text = { Text("Register") })
        }

        OutlinedTextField(
            value = phone,
            onValueChange = { phone = it.filter(Char::isDigit).take(15) },
            label = { Text("Phone Number") },
            placeholder = { Text("9999900003") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
            modifier = Modifier.fillMaxWidth(),
        )

        if (tab == 1) {
            OutlinedTextField(
                value = ign,
                onValueChange = { ign = it.take(30) },
                label = { Text("In-Game Name (IGN)") },
                placeholder = { Text("RAISTAR_99") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = uid,
                onValueChange = { uid = it.filter(Char::isDigit).take(12) },
                label = { Text("Free Fire UID (6-12 digits)") },
                placeholder = { Text("1928374612") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
            )
        }

        if (error != null) {
            Text(error!!, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
        }

        AppButton(
            text = if (tab == 0) "Login" else "Create Account",
            enabled = !busy && phone.isNotBlank() && (tab == 0 || (ign.isNotBlank() && uid.length in 6..12)),
            onClick = {
                error = null
                busy = true
                if (tab == 0) {
                    viewModel.login(phone.trim())
                } else {
                    viewModel.register(phone.trim(), ign.trim(), uid.trim())
                }
            },
            modifier = Modifier.fillMaxWidth(),
        )
    }
}