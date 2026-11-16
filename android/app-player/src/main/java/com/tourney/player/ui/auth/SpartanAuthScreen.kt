package com.tourney.player.ui.auth

import android.app.Activity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material3.Icon
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.tourney.core.firebase.GoogleAuthManager
import com.tourney.core.ui.auth.AuthAmbient
import com.tourney.core.ui.auth.AuthLoginScreen
import com.tourney.core.ui.auth.AuthOtpScreen
import com.tourney.core.ui.auth.AuthPalette
import com.tourney.core.ui.auth.GhostCta
import com.tourney.player.PlayerViewModel
import com.tourney.player.UiState

/**
 * Entry point for player authentication — the approved "Spartan Arena" design
 * (`ui-ux demo/finel demo`) backed by the real API.
 *
 * Flow:  phone number  →  OTP screen  →  `/auth/player/login`.
 *
 * OTP delivery is in demo mode right now (the backend `PHONE_OTP_BYPASS` switch
 * provisions the account for any 10-digit number and accepts any 6-digit code), so
 * no Firebase SMS session is involved. When real Firebase phone auth comes back the
 * only change needed here is the idToken passed to `viewModel.login(...)`.
 */
@Composable
fun SpartanAuthScreen(
    viewModel: PlayerViewModel,
    onLoggedIn: () -> Unit = {},
) {
    val context = LocalContext.current
    val activity = context as? Activity

    var step by remember { mutableIntStateOf(0) } // 0 = login, 1 = OTP
    var phone by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    // Email OTP path — free replacement for Firebase SMS sign-in, which needs the Blaze plan.
    var mode by remember { mutableStateOf("PHONE") } // PHONE | EMAIL
    var emailStep by remember { mutableIntStateOf(0) }
    var email by remember { mutableStateOf("") }
    var emailPassword by remember { mutableStateOf("") }
    var emailName by remember { mutableStateOf("") }
    var emailCode by remember { mutableStateOf("") }
    val emailType = if (emailName.isBlank()) "LOGIN" else "REGISTER"

    LaunchedEffect(Unit) {
        viewModel.loadSettings()
    }

    // Surface ViewModel API results inline (same contract as before).
    val uiState = viewModel.authUi
    LaunchedEffect(uiState) {
        when (uiState) {
            is UiState.Error -> {
                error = uiState.message
                busy = false
            }
            is UiState.Success<*> -> {
                busy = false
                onLoggedIn()
            }
            else -> {}
        }
    }

    val googleLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val task = com.google.android.gms.auth.api.signin.GoogleSignIn
                .getSignedInAccountFromIntent(result.data)
            try {
                val account = task.getResult(com.google.android.gms.common.api.ApiException::class.java)
                if (account != null) {
                    busy = true
                    error = null
                    GoogleAuthManager.firebaseAuthWithGoogle(
                        account = account,
                        onSuccess = { idToken, _, name ->
                            viewModel.loginWithGoogle(idToken = idToken, name = name)
                        },
                        onError = { errMsg ->
                            error = errMsg
                            busy = false
                        },
                    )
                } else {
                    error = "Failed to retrieve Google Account."
                    busy = false
                }
            } catch (e: Exception) {
                error = e.localizedMessage ?: "Google sign-in cancelled or failed."
                busy = false
            }
        } else {
            busy = false
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        AuthAmbient()

        if (mode == "EMAIL") {
            SpartanEmailAuthScreen(
                email = email,
                onEmailChange = { email = it; error = null },
                password = emailPassword,
                onPasswordChange = { emailPassword = it; error = null },
                name = emailName,
                onNameChange = { emailName = it; error = null },
                step = emailStep,
                code = emailCode,
                onCodeChange = { emailCode = it; error = null },
                busy = busy,
                serverError = error,
                onSend = {
                    error = null
                    when {
                        email.isBlank() || !email.contains('@') -> error = "Enter a valid email address"
                        emailPassword.length < 6 -> error = "Password must be at least 6 characters"
                        else -> {
                            busy = true
                            viewModel.sendEmailOtp(
                                email = email,
                                password = emailPassword,
                                name = emailName.ifBlank { null },
                                type = emailType,
                                onSuccess = {
                                    busy = false
                                    emailStep = 1
                                },
                                onError = {
                                    busy = false
                                    error = it
                                },
                            )
                        }
                    }
                },
                onVerify = {
                    error = null
                    when {
                        emailCode.length != 6 -> error = "Enter the 6-digit code"
                        else -> {
                            busy = true
                            // Success flips `authUi` to Success, which the LaunchedEffect above
                            // turns into onLoggedIn() — same contract as the phone path.
                            viewModel.verifyEmailOtp(
                                email = email,
                                code = emailCode,
                                password = emailPassword,
                                name = emailName.ifBlank { null },
                                type = emailType,
                            )
                        }
                    }
                },
                onBack = {
                    error = null
                    busy = false
                    if (emailStep == 1) {
                        emailStep = 0
                    } else {
                        mode = "PHONE"
                    }
                },
            )
        } else if (step == 0) {
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
                onGoogle = {
                    if (activity != null) {
                        error = null
                        busy = true
                        val client = GoogleAuthManager.getSignInClient(context)
                        googleLauncher.launch(client.signInIntent)
                    }
                },
                googleEnabled = viewModel.liveSettings.allowGoogleAuth,
                footer = {
                    GhostCta(
                        text = "Sign in with Email OTP",
                        onClick = {
                            error = null
                            mode = "EMAIL"
                        },
                        height = 42.dp,
                        leading = {
                            Icon(
                                Icons.Filled.Email,
                                contentDescription = null,
                                tint = AuthPalette.TextSecondary,
                                modifier = Modifier.size(16.dp),
                            )
                        },
                    )
                },
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
