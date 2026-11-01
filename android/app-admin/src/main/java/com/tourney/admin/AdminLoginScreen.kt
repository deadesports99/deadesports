package com.tourney.admin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.theme.LocalClientConfig
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.GlassCard

/**
 * Owner/Staff authentication — same phone login as players; the session role
 * decides which dashboard renders. (No OTP yet; Phase 3 adds it.)
 */
@Composable
fun AdminLoginScreen(viewModel: AdminViewModel) {
    var phone by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val config = LocalClientConfig.current

    val uiState = viewModel.authUi
    LaunchedEffect(uiState) {
        when (uiState) {
            is AdminUi.Error -> { error = uiState.message; busy = false }
            is AdminUi.Success<*> -> busy = false
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
            Text("🛡️ ${config.appName}", style = MaterialTheme.typography.headlineLarge)
            Text(
                "Owner & Staff Console",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        OutlinedTextField(
            value = phone,
            onValueChange = { phone = it.filter(Char::isDigit).take(15) },
            label = { Text("Phone Number") },
            placeholder = { Text("9999900001 (Owner) / 9999900002 (Staff)") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
            modifier = Modifier.fillMaxWidth(),
        )

        if (error != null) {
            Text(error!!, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
        }

        AppButton(
            text = if (busy) "Logging in…" else "Login",
            enabled = !busy && phone.isNotBlank(),
            onClick = {
                error = null
                busy = true
                viewModel.login(phone.trim())
            },
            modifier = Modifier.fillMaxWidth(),
        )
    }
}