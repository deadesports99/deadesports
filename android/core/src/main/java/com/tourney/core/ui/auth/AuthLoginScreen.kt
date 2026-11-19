package com.tourney.core.ui.auth

import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.R

/**
 * "Sign In" screen — pixel port of
 * `ui-ux demo/finel demo/src/screens/auth/LoginScreen.tsx`.
 *
 * Layout: dark canvas + 32dp micro grid, one solid `#0C121E` card, phone field with
 * the +91 flag chip, gold CTA, "or" divider, Google ghost button, trust footer.
 */
@Composable
fun AuthLoginScreen(
    phone: String,
    onPhoneChange: (String) -> Unit,
    onContinue: () -> Unit,
    onGoogle: () -> Unit,
    googleEnabled: Boolean,
) {
    val focusRequester = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current
    var validationError by remember { mutableStateOf<String?>(null) }

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
                // ─── Title & description ───────────────────────────────────────
                Text(
                    "Sign In",
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Black,
                    color = AuthPalette.TextPrimary,
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    "Enter your 10-digit mobile number to receive an instant OTP.",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    lineHeight = 17.sp,
                    color = AuthPalette.TextMuted,
                )

                Spacer(Modifier.height(20.dp))

                // ─── Mobile number label ───────────────────────────────────────
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Filled.Phone,
                        contentDescription = null,
                        tint = AuthPalette.TextMuted,
                        modifier = Modifier.size(14.dp),
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        "Mobile Number",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = AuthPalette.TextSecondary,
                    )
                }

                Spacer(Modifier.height(6.dp))

                // ─── Input: +91 flag chip + digits ─────────────────────────────
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .background(AuthPalette.Field, RoundedCornerShape(AuthPalette.FieldRadius))
                        .border(1.dp, AuthPalette.BorderStrong, RoundedCornerShape(AuthPalette.FieldRadius)),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Row(
                        modifier = Modifier
                            .height(48.dp)
                            .background(Color(0x08FFFFFF), RoundedCornerShape(topStart = AuthPalette.FieldRadius, bottomStart = AuthPalette.FieldRadius))
                            .padding(horizontal = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        IndiaFlag()
                        Text(
                            "+91",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = 1.sp,
                            color = AuthPalette.TextSecondary,
                        )
                    }

                    // Hairline separator between the prefix and the digits.
                    Box(
                        modifier = Modifier
                            .height(48.dp)
                            .width(1.dp)
                            .background(AuthPalette.BorderSoft),
                    )

                    BasicTextField(
                        value = phone,
                        onValueChange = { raw ->
                            onPhoneChange(raw.filter(Char::isDigit).take(10))
                        },
                        modifier = Modifier
                            .weight(1f)
                            .focusRequester(focusRequester)
                            .padding(horizontal = 14.dp),
                        singleLine = true,
                        textStyle = TextStyle(
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 2.sp,
                            color = AuthPalette.TextPrimary,
                        ),
                        cursorBrush = SolidColor(AuthPalette.Gold),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        decorationBox = { inner ->
                            Box(contentAlignment = Alignment.CenterStart) {
                                if (phone.isEmpty()) {
                                    Text(
                                        "98765 43210",
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.Bold,
                                        letterSpacing = 2.sp,
                                        color = AuthPalette.Placeholder,
                                    )
                                }
                                inner()
                            }
                        },
                    )
                }

                Spacer(Modifier.height(6.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        if (validationError != null) validationError!!
                        else "Match room ID and credentials will be sent to this number.",
                        fontSize = 10.sp,
                        fontWeight = if (validationError != null) FontWeight.SemiBold else FontWeight.Normal,
                        color = if (validationError != null) AuthPalette.Danger else AuthPalette.TextMuted,
                    )
                }

                Spacer(Modifier.height(16.dp))

                // ─── Gold CTA ─────────────────────────────────────────────────
                GoldCta(
                    text = "Continue with Phone",
                    onClick = {
                        if (phone.length == 10) {
                            validationError = null
                            keyboard?.hide()
                            onContinue()
                        } else {
                            validationError = "Please enter a valid 10-digit mobile number."
                        }
                    },
                    height = 46.dp,
                    trailingIcon = Icons.Filled.ArrowForward,
                )

                if (googleEnabled) {
                    OrDivider()

                    GhostCta(
                        text = "Continue with Google",
                        onClick = {
                            keyboard?.hide()
                            onGoogle()
                        },
                        height = 42.dp,
                        leading = {
                            Icon(
                                painterResource(id = R.drawable.ic_google_g),
                                contentDescription = null,
                                tint = Color.Unspecified,
                                modifier = Modifier.size(16.dp),
                            )
                        },
                    )
                }

                Spacer(Modifier.height(24.dp))

                AuthFooter(
                    text = "Safe & Secure • Fair Play Protocol",
                    icon = Icons.Filled.Lock,
                )
            }
        }
    }
}

/** Tiny Indian tricolour — saffron / white+chakra / green, 20x14dp. */
@Composable
private fun IndiaFlag() {
    Canvas(
        modifier = Modifier
            .size(width = 20.dp, height = 14.dp)
            .background(Color.Transparent, RoundedCornerShape(2.dp)),
    ) {
        val band = size.height / 3f
        drawRect(Color(0xFFFF9933), size = Size(size.width, band))
        drawRect(Color.White, topLeft = Offset(0f, band), size = Size(size.width, band))
        drawRect(Color(0xFF128807), topLeft = Offset(0f, band * 2f), size = Size(size.width, band))
        drawCircle(Color(0xFF000080), radius = band * 0.30f, center = center)
        drawCircle(Color.White, radius = band * 0.24f, center = center)
        drawCircle(Color(0xFF000080), radius = band * 0.09f, center = center)
    }
}

/** Shared text alignment helper for the OTP screen (kept here to avoid duplication). */
val AuthCentered: TextAlign = TextAlign.Center
