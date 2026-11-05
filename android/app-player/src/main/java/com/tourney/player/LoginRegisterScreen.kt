package com.tourney.player

import android.app.Activity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.firebase.auth.PhoneAuthProvider
import com.tourney.core.firebase.GoogleAuthManager
import com.tourney.core.firebase.PhoneAuthListener
import com.tourney.core.firebase.PhoneAuthManager
import com.tourney.core.theme.LocalClientConfig
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.GlassCard
import kotlinx.coroutines.delay

private enum class AuthMode {
    PHONE,
    EMAIL,
}

private enum class AuthStep {
    CREDENTIALS_INPUT,
    OTP_VERIFICATION,
}

/**
 * Login / Register Screen — 3 dynamic authentication methods:
 * 1. 📩 Phone Auth (Firebase SMS OTP)
 * 2. ✉️ Email + Password + OTP (Backend verified)
 * 3. 🚀 1-Tap Google Sign-In
 *
 * Configured live by the Admin in Settings without shipping a new APK.
 */
@Composable
fun LoginRegisterScreen(
    viewModel: PlayerViewModel,
    onLoggedIn: () -> Unit = {},
) {
    val context = LocalContext.current
    val activity = context as? Activity
    val config = LocalClientConfig.current

    LaunchedEffect(Unit) {
        viewModel.loadSettings()
    }

    val settings = viewModel.liveSettings
    val allowPhoneAuth = settings.allowPhoneAuth
    val allowEmailAuth = settings.allowEmailAuth
    val allowGoogleAuth = settings.allowGoogleAuth

    var selectedMode by remember {
        mutableStateOf(if (allowPhoneAuth) AuthMode.PHONE else AuthMode.EMAIL)
    }

    // Auto-adjust selected mode if admin disables currently active mode
    LaunchedEffect(allowPhoneAuth, allowEmailAuth) {
        if (selectedMode == AuthMode.PHONE && !allowPhoneAuth && allowEmailAuth) {
            selectedMode = AuthMode.EMAIL
        } else if (selectedMode == AuthMode.EMAIL && !allowEmailAuth && allowPhoneAuth) {
            selectedMode = AuthMode.PHONE
        }
    }

    var tab by remember { mutableIntStateOf(0) } // 0 = Login, 1 = Register
    var step by remember { mutableStateOf(AuthStep.CREDENTIALS_INPUT) }

    // Phone state
    var phone by remember { mutableStateOf("") }
    var verificationId by remember { mutableStateOf<String?>(null) }
    var resendToken by remember { mutableStateOf<PhoneAuthProvider.ForceResendingToken?>(null) }

    // Email state
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }

    // Common state
    var name by remember { mutableStateOf("") }
    var otpCode by remember { mutableStateOf("") }
    var resendCountdown by remember { mutableIntStateOf(60) }
    var isTimerRunning by remember { mutableStateOf(false) }

    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var infoMessage by remember { mutableStateOf<String?>(null) }

    // Resend countdown timer loop
    LaunchedEffect(isTimerRunning, resendCountdown) {
        if (isTimerRunning && resendCountdown > 0) {
            delay(1000L)
            resendCountdown--
        } else if (resendCountdown <= 0) {
            isTimerRunning = false
        }
    }

    // Surface ViewModel API errors inline
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
            val task = com.google.android.gms.auth.api.signin.GoogleSignIn.getSignedInAccountFromIntent(result.data)
            try {
                val account = task.getResult(com.google.android.gms.common.api.ApiException::class.java)
                if (account != null) {
                    busy = true
                    infoMessage = "Authenticating with Google..."
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

    val phoneAuthListener = remember(tab, phone, name) {
        object : PhoneAuthListener {
            override fun onCodeSent(
                verId: String,
                token: PhoneAuthProvider.ForceResendingToken,
            ) {
                verificationId = verId
                resendToken = token
                step = AuthStep.OTP_VERIFICATION
                busy = false
                error = null
                infoMessage = "6-digit OTP SMS sent to +91 $phone"
                resendCountdown = 60
                isTimerRunning = true
            }

            override fun onAutoVerified(idToken: String) {
                busy = true
                infoMessage = "Auto-verified via SMS! Logging in..."
                if (tab == 0) {
                    viewModel.login(phoneNumber = phone.trim(), idToken = idToken)
                } else {
                    viewModel.register(
                        phoneNumber = phone.trim(),
                        idToken = idToken,
                        name = name.trim().takeIf { it.isNotBlank() },
                    )
                }
            }

            override fun onError(errorMessage: String) {
                error = errorMessage
                busy = false
            }

            override fun onVerificationSuccess(idToken: String) {
                infoMessage = "OTP Verified! Completing authentication..."
                if (tab == 0) {
                    viewModel.login(phoneNumber = phone.trim(), idToken = idToken)
                } else {
                    viewModel.register(
                        phoneNumber = phone.trim(),
                        idToken = idToken,
                        name = name.trim().takeIf { it.isNotBlank() },
                    )
                }
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
        Spacer(Modifier.height(20.dp))

        GlassCard(modifier = Modifier.fillMaxWidth()) {
            Text("⚡ ${config.appName}", style = MaterialTheme.typography.headlineLarge)
            Text(
                "Free Fire Battle Royale Tournaments",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        if (step == AuthStep.CREDENTIALS_INPUT) {
            val hasCredentialsAuth = allowPhoneAuth || allowEmailAuth

            if (hasCredentialsAuth) {
                // If both Phone and Email are enabled, let user toggle between them
                if (allowPhoneAuth && allowEmailAuth) {
                    TabRow(
                        selectedTabIndex = if (selectedMode == AuthMode.PHONE) 0 else 1,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Tab(
                            selected = selectedMode == AuthMode.PHONE,
                            onClick = {
                                selectedMode = AuthMode.PHONE
                                error = null
                                infoMessage = null
                            },
                            text = { Text("📱 Phone (OTP)", fontWeight = FontWeight.SemiBold) },
                        )
                        Tab(
                            selected = selectedMode == AuthMode.EMAIL,
                            onClick = {
                                selectedMode = AuthMode.EMAIL
                                error = null
                                infoMessage = null
                            },
                            text = { Text("✉️ Email (OTP)", fontWeight = FontWeight.SemiBold) },
                        )
                    }
                }

                // Login vs Register Tab
                TabRow(selectedTabIndex = tab) {
                    Tab(
                        selected = tab == 0,
                        onClick = { tab = 0; error = null; infoMessage = null },
                        text = { Text("Login") },
                    )
                    Tab(
                        selected = tab == 1,
                        onClick = { tab = 1; error = null; infoMessage = null },
                        text = { Text("Register") },
                    )
                }

                if (selectedMode == AuthMode.PHONE && allowPhoneAuth) {
                    // ─── PHONE AUTH INPUTS ────────────────────────────────────
                    OutlinedTextField(
                        value = phone,
                        onValueChange = { phone = it.filter(Char::isDigit).take(10) },
                        label = { Text("Mobile Phone Number") },
                        placeholder = { Text("9999900003") },
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

                    if (tab == 1) {
                        OutlinedTextField(
                            value = name,
                            onValueChange = { name = it.take(50) },
                            label = { Text("Your Name (Optional)") },
                            placeholder = { Text("e.g. Rahul Gamer") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Text(
                            "🎮 Fast Registration: Free Fire UID is automatically asked when joining your first tournament.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 12.sp,
                        )
                    }

                    if (error != null) {
                        Text(error!!, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
                    }

                    AppButton(
                        text = if (busy) "Sending OTP..." else if (tab == 0) "📩 Get OTP to Login" else "📩 Get OTP to Register",
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
                } else if (selectedMode == AuthMode.EMAIL && allowEmailAuth) {
                    // ─── EMAIL AUTH INPUTS ────────────────────────────────────
                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it.trim() },
                        label = { Text("Email Address") },
                        placeholder = { Text("player@example.com") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        modifier = Modifier.fillMaxWidth(),
                    )

                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("Password (min 6 characters)") },
                        placeholder = { Text("••••••") },
                        singleLine = true,
                        visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        trailingIcon = {
                            Text(
                                text = if (passwordVisible) "HIDE" else "SHOW",
                                color = MaterialTheme.colorScheme.primary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                modifier = Modifier
                                    .clickable { passwordVisible = !passwordVisible }
                                    .padding(end = 12.dp),
                            )
                        },
                        modifier = Modifier.fillMaxWidth(),
                    )

                    if (tab == 1) {
                        OutlinedTextField(
                            value = name,
                            onValueChange = { name = it.take(50) },
                            label = { Text("Your Name (Optional)") },
                            placeholder = { Text("e.g. Rahul Gamer") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Text(
                            "🎮 Fast Registration: Free Fire UID is automatically asked when joining your first tournament.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 12.sp,
                        )
                    }

                    if (error != null) {
                        Text(error!!, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
                    }

                    val emailValid = email.contains("@") && email.contains(".") && email.length >= 5
                    val passwordValid = password.length >= 6

                    AppButton(
                        text = if (busy) "Sending OTP..." else if (tab == 0) "✉️ Get OTP to Login" else "✉️ Get OTP to Register",
                        enabled = !busy && emailValid && passwordValid,
                        onClick = {
                            error = null
                            infoMessage = null
                            busy = true
                            viewModel.sendEmailOtp(
                                email = email.trim(),
                                password = password,
                                name = name.trim().takeIf { it.isNotBlank() },
                                type = if (tab == 0) "LOGIN" else "REGISTER",
                                onSuccess = { res ->
                                    busy = false
                                    step = AuthStep.OTP_VERIFICATION
                                    infoMessage = if (res.debugOtp != null) {
                                        "6-digit OTP sent to $email (Code: ${res.debugOtp})"
                                    } else {
                                        "6-digit OTP sent to $email"
                                    }
                                    resendCountdown = 60
                                    isTimerRunning = true
                                },
                                onError = { errMsg ->
                                    busy = false
                                    error = errMsg
                                },
                            )
                        },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            } else {
                // Both Phone and Email are disabled by Admin
                Text(
                    "Mobile phone and email login are currently disabled. Please continue with your Google Account.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(vertical = 12.dp),
                )
                if (error != null) {
                    Text(error!!, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
                }
            }

            // Google Sign-In Option
            if (allowGoogleAuth) {
                if (hasCredentialsAuth) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        HorizontalDivider(modifier = Modifier.weight(1f))
                        Text(
                            "  OR  ",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        HorizontalDivider(modifier = Modifier.weight(1f))
                    }
                }

                OutlinedButton(
                    onClick = {
                        if (activity != null) {
                            error = null
                            busy = true
                            val client = GoogleAuthManager.getSignInClient(context)
                            googleLauncher.launch(client.signInIntent)
                        }
                    },
                    enabled = !busy,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp),
                    shape = RoundedCornerShape(config.cornerRadius.dp),
                ) {
                    Text("🚀 Continue with Google", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }
            }
        } else {
            // ─── STEP 2: OTP VERIFICATION (PHONE OR EMAIL) ────────────────
            val isPhone = selectedMode == AuthMode.PHONE

            GlassCard(modifier = Modifier.fillMaxWidth()) {
                Text(
                    if (isPhone) "Enter SMS Verification Code" else "Enter Email Verification Code",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        if (isPhone) "Code sent to +91 $phone" else "Code sent to $email",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        if (isPhone) "Edit Number" else "Edit Email",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.clickable {
                            step = AuthStep.CREDENTIALS_INPUT
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
                    textAlign = TextAlign.Center,
                )
            }

            if (error != null) {
                Text(error!!, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
            }

            AppButton(
                text = if (busy) "Verifying..." else if (tab == 0) "Verify & Login" else "Verify & Create Account",
                enabled = !busy && otpCode.trim().length == 6 && (!isPhone || verificationId != null),
                onClick = {
                    error = null
                    busy = true
                    if (isPhone) {
                        val verId = verificationId
                        if (verId == null) {
                            error = "Verification session expired. Please resend OTP."
                            busy = false
                            return@AppButton
                        }
                        PhoneAuthManager.verifyOtp(
                            verificationId = verId,
                            otpCode = otpCode.trim(),
                            listener = phoneAuthListener,
                        )
                    } else {
                        viewModel.verifyEmailOtp(
                            email = email.trim(),
                            code = otpCode.trim(),
                            password = password,
                            name = name.trim().takeIf { it.isNotBlank() },
                            type = if (tab == 0) "LOGIN" else "REGISTER",
                        )
                    }
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
                        enabled = !busy && (isPhone && activity != null || !isPhone),
                        onClick = {
                            busy = true
                            error = null
                            if (isPhone) {
                                if (activity != null) {
                                    PhoneAuthManager.sendOtp(
                                        activity = activity,
                                        phoneNumber = phone.trim(),
                                        listener = phoneAuthListener,
                                        resendToken = resendToken,
                                    )
                                }
                            } else {
                                viewModel.sendEmailOtp(
                                    email = email.trim(),
                                    password = password,
                                    name = name.trim().takeIf { it.isNotBlank() },
                                    type = if (tab == 0) "LOGIN" else "REGISTER",
                                    onSuccess = { res ->
                                        busy = false
                                        infoMessage = if (res.debugOtp != null) {
                                            "New OTP sent to $email (Code: ${res.debugOtp})"
                                        } else {
                                            "New OTP sent to $email"
                                        }
                                        resendCountdown = 60
                                        isTimerRunning = true
                                    },
                                    onError = { errMsg ->
                                        busy = false
                                        error = errMsg
                                    },
                                )
                            }
                        },
                    ) {
                        Text(if (isPhone) "Resend OTP SMS" else "Resend OTP Email", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
