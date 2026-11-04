package com.tourney.admin

import android.app.Activity
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.firebase.auth.PhoneAuthProvider
import com.tourney.core.firebase.PhoneAuthListener
import com.tourney.core.firebase.PhoneAuthManager
import com.tourney.core.theme.LocalClientConfig
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.GlassCard
import kotlinx.coroutines.delay

private enum class AdminAuthStep {
    PHONE_INPUT,
    OTP_VERIFICATION,
}

/**
 * Owner/Staff authentication — Phone + Firebase OTP verification.
 * The session role returned by the backend decides which dashboard renders.
 */
@Composable
fun AdminLoginScreen(viewModel: AdminViewModel) {
    val context = LocalContext.current
    val activity = context as? Activity
    val config = LocalClientConfig.current

    var step by remember { mutableStateOf(AdminAuthStep.PHONE_INPUT) }
    var phone by remember { mutableStateOf("") }
    var otpCode by remember { mutableStateOf("") }

    var verificationId by remember { mutableStateOf<String?>(null) }
    var resendToken by remember { mutableStateOf<PhoneAuthProvider.ForceResendingToken?>(null) }
    var resendCountdown by remember { mutableIntStateOf(60) }
    var isTimerRunning by remember { mutableStateOf(false) }

    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var infoMessage by remember { mutableStateOf<String?>(null) }

    // Resend countdown loop
    LaunchedEffect(isTimerRunning, resendCountdown) {
        if (isTimerRunning && resendCountdown > 0) {
            delay(1000L)
            resendCountdown--
        } else if (resendCountdown <= 0) {
            isTimerRunning = false
        }
    }

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

    val phoneAuthListener = remember(phone) {
        object : PhoneAuthListener {
            override fun onCodeSent(
                verId: String,
                token: PhoneAuthProvider.ForceResendingToken,
            ) {
                verificationId = verId
                resendToken = token
                step = AdminAuthStep.OTP_VERIFICATION
                busy = false
                error = null
                infoMessage = "Admin login OTP sent to +91 $phone"
                resendCountdown = 60
                isTimerRunning = true
            }

            override fun onAutoVerified(idToken: String) {
                busy = true
                infoMessage = "Auto-verified! Accessing Admin Console..."
                viewModel.login(phoneNumber = phone.trim(), idToken = idToken)
            }

            override fun onError(errorMessage: String) {
                error = errorMessage
                busy = false
            }

            override fun onVerificationSuccess(idToken: String) {
                infoMessage = "OTP Verified! Accessing Admin Console..."
                viewModel.login(phoneNumber = phone.trim(), idToken = idToken)
            }
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

        if (step == AdminAuthStep.PHONE_INPUT) {
            OutlinedTextField(
                value = phone,
                onValueChange = { phone = it.filter(Char::isDigit).take(10) },
                label = { Text("Admin / Staff Phone Number") },
                placeholder = { Text("9999900001 (Owner)") },
                leadingIcon = {
                    Text(
                        "+91 ",
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(start = 12.dp),
                    )
                },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                modifier = Modifier.fillMaxWidth(),
            )

            if (error != null) {
                Text(error!!, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
            }

            AppButton(
                text = if (busy) "Sending OTP..." else "Get OTP to Login",
                enabled = !busy && phone.trim().length == 10 && activity != null,
                onClick = {
                    if (activity == null) {
                        error = "Unable to access Android Activity context"
                        return@AppButton
                    }
                    error = null
                    infoMessage = null
                    busy = true
                    PhoneAuthManager.sendOtp(
                        activity = activity,
                        phoneNumber = phone.trim(),
                        listener = phoneAuthListener,
                    )
                },
                modifier = Modifier.fillMaxWidth(),
            )
        } else {
            GlassCard(modifier = Modifier.fillMaxWidth()) {
                Text(
                    "Enter Admin Verification OTP",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "Code sent to +91 $phone",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        "Edit Number",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.clickable {
                            step = AdminAuthStep.PHONE_INPUT
                            otpCode = ""
                            error = null
                            infoMessage = null
                        },
                    )
                }
            }

            OutlinedTextField(
                value = otpCode,
                onValueChange = { otpCode = it.filter(Char::isDigit).take(6) },
                label = { Text("6-Digit OTP Code") },
                placeholder = { Text("123456") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                modifier = Modifier.fillMaxWidth(),
            )

            if (infoMessage != null) {
                Text(
                    infoMessage!!,
                    color = MaterialTheme.colorScheme.primary,
                    fontSize = 13.sp,
                )
            }

            if (error != null) {
                Text(error!!, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
            }

            AppButton(
                text = if (busy) "Verifying…" else "Verify & Enter Console",
                enabled = !busy && otpCode.trim().length == 6 && verificationId != null,
                onClick = {
                    val verId = verificationId
                    if (verId == null) {
                        error = "Verification session expired. Please resend OTP."
                        return@AppButton
                    }
                    error = null
                    busy = true
                    PhoneAuthManager.verifyOtp(
                        verificationId = verId,
                        otpCode = otpCode.trim(),
                        listener = phoneAuthListener,
                    )
                },
                modifier = Modifier.fillMaxWidth(),
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (isTimerRunning) {
                    Text(
                        "Resend OTP in ${resendCountdown}s",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else {
                    TextButton(
                        enabled = !busy && activity != null,
                        onClick = {
                            if (activity != null) {
                                busy = true
                                error = null
                                PhoneAuthManager.sendOtp(
                                    activity = activity,
                                    phoneNumber = phone.trim(),
                                    listener = phoneAuthListener,
                                    resendToken = resendToken,
                                )
                            }
                        },
                    ) {
                        Text("Resend OTP SMS", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
