package com.tourney.core.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccessTime
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Headset
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

/**
 * "Enter OTP" screen — pixel port of
 * `ui-ux demo/finel demo/src/screens/auth/OtpScreen.tsx`.
 *
 * 6 white/black code boxes (no gold inside the boxes), resend timer strip,
 * rose error line, gold "Verify OTP & Continue" CTA and the support footer.
 */
@Composable
fun AuthOtpScreen(
    phone: String,
    onBack: () -> Unit,
    onVerify: (String) -> Unit,
    busy: Boolean,
    serverError: String?,
) {
    val keyboard = androidx.compose.ui.platform.LocalSoftwareKeyboardController.current
    val digits = remember { mutableStateListOf("", "", "", "", "", "") }
    val focusRequesters = remember { List(6) { FocusRequester() } }
    var focusedIndex by remember { mutableIntStateOf(0) }
    var localError by remember { mutableStateOf<String?>(null) }
    var timeLeft by remember { mutableIntStateOf(60) }

    // 60s resend countdown, mirroring the demo's window.setInterval.
    LaunchedEffect(timeLeft) {
        if (timeLeft > 0) {
            delay(1000L)
            timeLeft -= 1
        }
    }

    LaunchedEffect(Unit) {
        runCatching { focusRequesters[0].requestFocus() }
    }

    val code = digits.joinToString("")
    val error = serverError ?: localError

    // Hide the IME once the code is complete so "Verify OTP & Continue" stays tappable.
    LaunchedEffect(code.length) {
        if (code.length == 6) keyboard?.hide()
    }

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
                // ─── Back link ────────────────────────────────────────────────
                Row(
                    modifier = Modifier.clickable { onBack() },
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Icon(
                        Icons.Filled.ArrowBack,
                        contentDescription = null,
                        tint = AuthPalette.TextMuted,
                        modifier = Modifier.size(14.dp),
                    )
                    Text(
                        "Back to Login",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = AuthPalette.TextMuted,
                    )
                }

                Spacer(Modifier.height(20.dp))

                // ─── Header ───────────────────────────────────────────────────
                Text(
                    "Enter OTP",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Black,
                    color = AuthPalette.TextPrimary,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    "Enter the 6-digit verification code sent to your mobile number.",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    lineHeight = 17.sp,
                    color = AuthPalette.TextMuted,
                )

                Spacer(Modifier.height(16.dp))

                // ─── Phone badge + Change ─────────────────────────────────────
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(AuthPalette.Field, RoundedCornerShape(AuthPalette.FieldRadius))
                        .border(1.dp, AuthPalette.BorderSoft, RoundedCornerShape(AuthPalette.FieldRadius))
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.weight(1f, fill = false),
                    ) {
                        Icon(
                            Icons.Filled.Phone,
                            contentDescription = null,
                            tint = AuthPalette.TextMuted,
                            modifier = Modifier.size(14.dp),
                        )
                        Text(
                            if (phone.isBlank()) "+91 98765 43210" else "+91 $phone",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = 0.5.sp,
                            color = AuthPalette.TextPrimary,
                        )
                    }
                    Row(
                        modifier = Modifier
                            .background(AuthPalette.Card, RoundedCornerShape(8.dp))
                            .border(1.dp, AuthPalette.BorderSoft, RoundedCornerShape(8.dp))
                            .clickable { onBack() }
                            .padding(horizontal = 10.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Icon(
                            Icons.Filled.Edit,
                            contentDescription = null,
                            tint = AuthPalette.TextSecondary,
                            modifier = Modifier.size(12.dp),
                        )
                        Text("Change", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = AuthPalette.TextSecondary)
                    }
                }

                Spacer(Modifier.height(20.dp))

                // ─── Code label + demo autofill ───────────────────────────────
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        "6-Digit Code",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = AuthPalette.TextSecondary,
                    )
                    Text(
                        "Auto-fill demo",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        textDecoration = androidx.compose.ui.text.style.TextDecoration.Underline,
                        color = AuthPalette.TextMuted,
                        modifier = Modifier.clickable {
                            localError = null
                            "482916".forEachIndexed { i, c -> digits[i] = c.toString() }
                            runCatching { focusRequesters[5].requestFocus() }
                        },
                    )
                }

                Spacer(Modifier.height(10.dp))

                // ─── 6 code boxes ─────────────────────────────────────────────
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    for (index in 0 until 6) {
                        val filled = digits[index].isNotEmpty()
                        val focused = focusedIndex == index
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(52.dp)
                                .background(
                                    if (filled) AuthPalette.FieldFilled else AuthPalette.Field,
                                    RoundedCornerShape(AuthPalette.FieldRadius),
                                )
                                .border(
                                    1.dp,
                                    when {
                                        filled -> Color.White
                                        focused -> AuthPalette.TextMuted
                                        else -> AuthPalette.BorderStrong
                                    },
                                    RoundedCornerShape(AuthPalette.FieldRadius),
                                ),
                            contentAlignment = Alignment.Center,
                        ) {
                            BasicTextField(
                                value = digits[index],
                                onValueChange = { raw ->
                                    localError = null
                                    val typed = raw.filter(Char::isDigit)
                                    when {
                                        typed.length > 1 -> {
                                            typed.take(6).forEachIndexed { offset, ch ->
                                                if (index + offset < 6) digits[index + offset] = ch.toString()
                                            }
                                            runCatching { focusRequesters[minOf(index + typed.length, 5)].requestFocus() }
                                        }
                                        else -> {
                                            digits[index] = typed
                                            if (typed.isNotEmpty() && index < 5) {
                                                runCatching { focusRequesters[index + 1].requestFocus() }
                                            }
                                        }
                                    }
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .focusRequester(focusRequesters[index])
                                    .onFocusChanged { if (it.isFocused) focusedIndex = index }
                                    .onKeyEvent { event ->
                                        val isEmpty = digits[index].isEmpty()
                                        if (event.key == Key.Backspace && isEmpty && index > 0) {
                                            if (event.type == KeyEventType.KeyDown) {
                                                digits[index - 1] = ""
                                                runCatching { focusRequesters[index - 1].requestFocus() }
                                                true
                                            } else {
                                                false
                                            }
                                        } else {
                                            false
                                        }
                                    },
                                singleLine = true,
                                textStyle = TextStyle(
                                    fontSize = 20.sp,
                                    fontWeight = FontWeight.Black,
                                    color = AuthPalette.TextPrimary,
                                    textAlign = TextAlign.Center,
                                ),
                                cursorBrush = SolidColor(AuthPalette.Gold),
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                            )
                        }
                    }
                }

                if (error != null) {
                    Spacer(Modifier.height(10.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Icon(
                            Icons.Filled.Warning,
                            contentDescription = null,
                            tint = AuthPalette.Danger,
                            modifier = Modifier.size(14.dp),
                        )
                        Text(
                            error,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = AuthPalette.Danger,
                        )
                    }
                }

                Spacer(Modifier.height(16.dp))

                // ─── Timer / resend strip ─────────────────────────────────────
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0x08FFFFFF), RoundedCornerShape(AuthPalette.FieldRadius))
                        .border(1.dp, AuthPalette.BorderFaint, RoundedCornerShape(AuthPalette.FieldRadius))
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Icon(
                            Icons.Filled.AccessTime,
                            contentDescription = null,
                            tint = AuthPalette.TextMuted,
                            modifier = Modifier.size(14.dp),
                        )
                        Text(
                            if (timeLeft > 0) "Resend in 00:${timeLeft.toString().padStart(2, '0')}"
                            else "Didn't receive code?",
                            fontSize = 12.sp,
                            color = AuthPalette.TextSecondary,
                        )
                    }

                    if (timeLeft > 0) {
                        Text(
                            "Skip wait",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = AuthPalette.TextMuted,
                            modifier = Modifier.clickable { timeLeft = 0 },
                        )
                    } else {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.clickable {
                                timeLeft = 60
                                localError = null
                                for (i in 0 until 6) digits[i] = ""
                                runCatching { focusRequesters[0].requestFocus() }
                            },
                        ) {
                            Icon(
                                Icons.Filled.Refresh,
                                contentDescription = null,
                                tint = AuthPalette.TextPrimary,
                                modifier = Modifier.size(14.dp),
                            )
                            Text(
                                "Resend OTP",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Black,
                                textDecoration = androidx.compose.ui.text.style.TextDecoration.Underline,
                                color = AuthPalette.TextPrimary,
                            )
                        }
                    }
                }

                Spacer(Modifier.height(16.dp))

                // ─── Gold CTA ─────────────────────────────────────────────────
                GoldCta(
                    text = "Verify OTP & Continue",
                    onClick = {
                        if (code.length != 6) {
                            localError = "Please enter all 6 digits of your verification code."
                        } else {
                            localError = null
                            onVerify(code)
                        }
                    },
                    enabled = !busy,
                    loading = busy,
                    height = 46.dp,
                )

                Spacer(Modifier.height(20.dp))

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(1.dp)
                        .background(AuthPalette.BorderSoft),
                )

                Spacer(Modifier.height(16.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center,
                ) {
                    Icon(
                        Icons.Filled.Headset,
                        contentDescription = null,
                        tint = AuthPalette.TextFaint,
                        modifier = Modifier.size(14.dp),
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        "Spartan Tournament Support is online",
                        fontSize = 10.sp,
                        color = AuthPalette.TextMuted,
                        textAlign = AuthCentered,
                    )
                }
            }
        }
    }
}
