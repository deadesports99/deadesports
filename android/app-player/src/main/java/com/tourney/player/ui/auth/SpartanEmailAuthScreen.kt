package com.tourney.player.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.ui.auth.AuthCard
import com.tourney.core.ui.auth.AuthCentered
import com.tourney.core.ui.auth.AuthFooter
import com.tourney.core.ui.auth.AuthPalette
import com.tourney.core.ui.auth.GhostCta
import com.tourney.core.ui.auth.GoldCta

/**
 * Email + OTP sign-in for players.
 *
 * Why this screen exists: Firebase phone (SMS) sign-in requires the Blaze plan, so on the
 * free Spark plan players need a method that costs nothing. The backend already supports
 * `POST /auth/player/email/send-otp` + `/verify-otp`; this is the missing client UI.
 *
 * Step 0 — email + password (+ optional name) → OTP is mailed.
 * Step 1 — 6-digit code → logs in and the parent screen fires `onLoggedIn`.
 *
 * The screen is stateless: the caller (SpartanAuthScreen) owns the fields and the ViewModel
 * calls, so a failed request simply shows `serverError` instead of resetting the form.
 */
@Composable
fun SpartanEmailAuthScreen(
    email: String,
    onEmailChange: (String) -> Unit,
    password: String,
    onPasswordChange: (String) -> Unit,
    name: String,
    onNameChange: (String) -> Unit,
    step: Int,
    code: String,
    onCodeChange: (String) -> Unit,
    busy: Boolean,
    serverError: String?,
    onSend: () -> Unit,
    onVerify: () -> Unit,
    onBack: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .imePadding()
            .padding(horizontal = 16.dp, vertical = 32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        AuthCard {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    if (step == 0) "Email Sign In" else "Check Your Inbox",
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Black,
                    color = AuthPalette.TextPrimary,
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    if (step == 0) {
                        "No SMS needed — we mail you a one-time code."
                    } else {
                        "We sent a 6-digit code to $email"
                    },
                    fontSize = 13.sp,
                    color = AuthPalette.TextMuted,
                    textAlign = AuthCentered,
                )

                Spacer(Modifier.height(20.dp))

                if (step == 0) {
                    AuthField(
                        label = "Email Address",
                        icon = Icons.Filled.Email,
                        value = email,
                        onValueChange = onEmailChange,
                        placeholder = "you@example.com",
                        keyboardType = KeyboardType.Email,
                    )
                    Spacer(Modifier.height(12.dp))
                    AuthField(
                        label = "Password",
                        icon = Icons.Filled.Lock,
                        value = password,
                        onValueChange = onPasswordChange,
                        placeholder = "At least 6 characters",
                        keyboardType = KeyboardType.Password,
                        isPassword = true,
                    )
                    Spacer(Modifier.height(12.dp))
                    AuthField(
                        label = "In-Game Name (only for a new account)",
                        icon = Icons.Filled.Person,
                        value = name,
                        onValueChange = onNameChange,
                        placeholder = "Leave empty to just sign in",
                        keyboardType = KeyboardType.Text,
                    )
                } else {
                    AuthField(
                        label = "6-digit code",
                        icon = Icons.Filled.Lock,
                        value = code,
                        onValueChange = { raw -> onCodeChange(raw.filter(Char::isDigit).take(6)) },
                        placeholder = "123456",
                        keyboardType = KeyboardType.NumberPassword,
                    )
                }

                if (serverError != null) {
                    Spacer(Modifier.height(10.dp))
                    Text(
                        serverError,
                        fontSize = 12.sp,
                        color = AuthPalette.Danger,
                        textAlign = AuthCentered,
                    )
                }

                Spacer(Modifier.height(18.dp))

                GoldCta(
                    text = when {
                        busy && step == 0 -> "Sending code…"
                        busy -> "Verifying…"
                        step == 0 -> "Email me a code"
                        else -> "Verify & Sign In"
                    },
                    onClick = { if (step == 0) onSend() else onVerify() },
                    enabled = !busy,
                )

                Spacer(Modifier.height(10.dp))

                GhostCta(
                    text = if (step == 0) "Use phone number instead" else "Change email",
                    onClick = onBack,
                    height = 42.dp,
                )

                Spacer(Modifier.height(24.dp))

                AuthFooter(
                    text = "One-time code • No SMS charges",
                    icon = Icons.Filled.Lock,
                )
            }
        }
    }
}

/** Dark rounded field matching the Spartan auth card (same palette as AuthLoginScreen). */
@Composable
private fun AuthField(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    keyboardType: KeyboardType,
    isPassword: Boolean = false,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = AuthPalette.TextMuted, modifier = Modifier.size(14.dp))
        Spacer(Modifier.size(6.dp))
        Text(
            label,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = AuthPalette.TextSecondary,
        )
    }
    Spacer(Modifier.height(6.dp))
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(48.dp)
            .background(AuthPalette.Field, RoundedCornerShape(AuthPalette.FieldRadius))
            .border(1.dp, AuthPalette.BorderStrong, RoundedCornerShape(AuthPalette.FieldRadius))
            .padding(horizontal = 14.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            textStyle = TextStyle(
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = AuthPalette.TextPrimary,
            ),
            cursorBrush = SolidColor(AuthPalette.Gold),
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType, imeAction = ImeAction.Next),
            visualTransformation = if (isPassword) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
            decorationBox = { inner ->
                Box(contentAlignment = Alignment.CenterStart) {
                    if (value.isEmpty()) {
                        Text(
                            placeholder,
                            fontSize = 14.sp,
                            color = AuthPalette.TextMuted,
                        )
                    }
                    inner()
                }
            },
        )
    }
}
