package com.tourney.admin

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.tourney.core.ui.auth.AuthAmbient
import com.tourney.core.ui.auth.AuthLoginScreen
import com.tourney.core.ui.auth.AuthOtpScreen

/**
 * Owner / staff authentication — the approved "Spartan Arena" auth design
 * (`ui-ux demo/finel demo`), shared with the player app via `core.ui.auth`.
 *
 * Flow: phone number → OTP screen → `/auth/player/login` (the backend resolves the
 * role: ADMIN, SUB_ADMIN or USER). OTP delivery is in demo mode right now — the
 * backend `PHONE_OTP_BYPASS` switch accepts any 10-digit number + any 6-digit code,
 * so no Firebase SMS session is involved.
 */
@Composable
fun AdminAuthScreen(viewModel: AdminViewModel) {
    var step by remember { mutableIntStateOf(0) } // 0 = login, 1 = OTP
    var phone by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    // Surface ViewModel API results inline.
    val uiState = viewModel.authUi
    LaunchedEffect(uiState) {
        when (uiState) {
            is AdminUi.Error -> {
                error = uiState.message
                busy = false
            }
            is AdminUi.Success<*> -> busy = false
            else -> {}
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        AuthAmbient()

        if (step == 0) {
            AuthLoginScreen(
                phone = phone,
                onPhoneChange = {
                    phone = it
                    error = null
                },
                onContinue = {
                    error = null
                    step = 1
                },
                onGoogle = {},
                googleEnabled = false,
            )
        } else {
            AuthOtpScreen(
                phone = phone,
                onBack = {
                    error = null
                    step = 0
                },
                onVerify = {
                    error = null
                    busy = true
                    // Demo mode: `dev_otp_<phone>` is accepted for any 10-digit number
                    // while the backend runs with PHONE_OTP_BYPASS=true.
                    viewModel.login(
                        phoneNumber = phone,
                        idToken = "dev_otp_$phone",
                    )
                },
                busy = busy,
                serverError = error,
            )
        }
    }
}
