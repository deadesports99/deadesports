package com.tourney.player.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Wallet
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.player.ui.theme.DemoColors
import com.tourney.player.ui.theme.DemoRadius
import com.tourney.player.ui.theme.DemoText

/**
 * Shared demo widgets. Small on purpose — each one mirrors a Tailwind snippet
 * from the approved design, so a screen file never hard-codes colours.
 */

/** Canvas colour + the two ambient glows the demo paints behind every screen. */
@Composable
fun DemoBackground(content: @Composable () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(DemoColors.Canvas)
            .background(
                Brush.radialGradient(
                    colors = listOf(DemoColors.GlowCyan, Color.Transparent),
                    radius = 900f,
                ),
            )
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.radialGradient(
                        colors = listOf(DemoColors.GlowViolet, Color.Transparent),
                        center = androidx.compose.ui.geometry.Offset(0f, 1400f),
                        radius = 1100f,
                    ),
                )
        )
        content()
    }
}

/** Header balance pill — tap opens the wallet, exactly like the demo. */
@Composable
fun BalancePill(amount: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .height(32.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(DemoColors.Card)
            .border(1.dp, DemoColors.BorderStrong, RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(Icons.Filled.Wallet, contentDescription = null, tint = DemoColors.TextSecondary, modifier = Modifier.size(14.dp))
        Text(amount, fontSize = DemoText.Body, fontWeight = FontWeight.Black, color = DemoColors.TextPrimary)
    }
}

/** Primary CTA — cyber gold, 46dp tall, 12dp radius. */
@Composable
fun GoldButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    height: Dp = 46.dp,
    leading: (@Composable () -> Unit)? = null,
) {
    val bg = when {
        loading -> DemoColors.Gold.copy(alpha = 0.7f)
        enabled -> DemoColors.Gold
        // Disabled must still read as a button: CardElevated is white in the light
        // theme, which made the CTA vanish into the sheet.
        else -> DemoColors.Track
    }
    Row(
        modifier = modifier
            .height(height)
            .clip(RoundedCornerShape(DemoRadius.Field))
            .background(bg)
            .clickable(enabled = enabled && !loading, onClick = onClick)
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.size(16.dp),
                color = DemoColors.OnGold,
                strokeWidth = 2.dp,
            )
        } else {
            leading?.invoke()
            if (leading != null) Box(Modifier.size(6.dp))
            Text(
                text,
                fontSize = DemoText.BodyStrong,
                fontWeight = FontWeight.Black,
                color = if (enabled) DemoColors.OnGold else DemoColors.TextMuted,
                textAlign = TextAlign.Center,
            )
        }
    }
}

/** Secondary CTA — outlined ghost button. */
@Composable
fun GhostButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    height: Dp = 46.dp,
) {
    Box(
        modifier = modifier
            .height(height)
            .clip(RoundedCornerShape(DemoRadius.Field))
            .background(DemoColors.Card)
            .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Field))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, fontSize = DemoText.BodyStrong, fontWeight = FontWeight.Bold, color = DemoColors.TextPrimary)
    }
}

/**
 * Dark input field used by the join sheet (IGN / UID).
 * [digitsOnly] and [maxLength] keep the Free Fire rules inline.
 */
@Composable
fun DemoTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    label: String? = null,
    enabled: Boolean = true,
    digitsOnly: Boolean = false,
    maxLength: Int = Int.MAX_VALUE,
    keyboardType: KeyboardType = KeyboardType.Text,
    isError: Boolean = false,
    trailing: (@Composable () -> Unit)? = null,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        if (label != null) {
            Text(
                label,
                fontSize = DemoText.Small,
                fontWeight = FontWeight.Bold,
                color = DemoColors.TextSecondary,
                modifier = Modifier.padding(bottom = 6.dp),
            )
        }
        OutlinedTextField(
            value = value,
            onValueChange = { raw ->
                val cleaned = if (digitsOnly) raw.filter { it.isDigit() } else raw
                onValueChange(cleaned.take(maxLength))
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = enabled,
            singleLine = true,
            placeholder = { Text(placeholder, fontSize = DemoText.BodyStrong, color = DemoColors.TextFaint) },
            textStyle = androidx.compose.ui.text.TextStyle(
                fontSize = DemoText.BodyStrong,
                fontWeight = FontWeight.Bold,
                color = DemoColors.TextPrimary,
            ),
            keyboardOptions = KeyboardOptions(keyboardType = if (digitsOnly) KeyboardType.Number else keyboardType),
            trailingIcon = trailing,
            shape = RoundedCornerShape(DemoRadius.Field),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = DemoColors.Field,
                unfocusedContainerColor = DemoColors.Field,
                disabledContainerColor = DemoColors.Field,
                focusedBorderColor = if (isError) DemoColors.Danger else DemoColors.TextPrimary,
                unfocusedBorderColor = if (isError) DemoColors.Danger else DemoColors.BorderStrong,
                disabledBorderColor = DemoColors.BorderFaint,
                cursorColor = DemoColors.Gold,
                errorBorderColor = DemoColors.Danger,
            ),
        )
    }
}

/** Small rounded stat block ("PRIZE POOL / ₹500"). */
@Composable
fun StatCell(label: String, value: String, modifier: Modifier = Modifier, alignEnd: Boolean = false) {
    Column(modifier = modifier, horizontalAlignment = if (alignEnd) Alignment.End else Alignment.Start) {
        Text(
            label.uppercase(),
            fontSize = DemoText.Micro,
            fontWeight = FontWeight.Bold,
            color = DemoColors.TextMuted,
        )
        Text(
            value,
            fontSize = DemoText.Body,
            fontWeight = FontWeight.Black,
            color = DemoColors.TextPrimary,
            modifier = Modifier.padding(top = 2.dp),
        )
    }
}

/** Pill chip used by the filter row. */
@Composable
fun DemoChip(text: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .heightIn(min = 30.dp)
            .clip(CircleShape)
            .background(if (selected) DemoColors.TextPrimary else DemoColors.Card)
            .border(1.dp, if (selected) DemoColors.TextPrimary else DemoColors.BorderSoft, CircleShape)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 7.dp),
    ) {
        Text(
            text,
            fontSize = DemoText.Tiny,
            fontWeight = FontWeight.Black,
            color = if (selected) DemoColors.Canvas else DemoColors.TextSecondary,
        )
    }
}

/** Inline error / info strip. */
@Composable
fun DemoMessage(text: String, tone: Color = DemoColors.Danger) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(tone.copy(alpha = 0.12f))
            .border(1.dp, tone.copy(alpha = 0.35f), RoundedCornerShape(10.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        Text(text, fontSize = DemoText.Tiny, fontWeight = FontWeight.Bold, color = tone)
    }
}

/** Small uppercase section label used inside sheets. */
@Composable
fun DemoSheetLabel(text: String) {
    Text(
        text,
        fontSize = DemoText.Tiny,
        fontWeight = FontWeight.Bold,
        color = DemoColors.TextSecondary,
        letterSpacing = 1.sp,
    )
}

/**
 * Compact single-line input (42dp) matching the demo's sheet inputs.
 * Optionally shows a [prefix] (e.g. "₹") and a [trailing] widget (e.g. MAX).
 */
@Composable
fun DemoCompactField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    isError: Boolean = false,
    prefix: String = "",
    trailing: (@Composable () -> Unit)? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
    // Sheet variants need a tighter field than the 42dp default.
    height: androidx.compose.ui.unit.Dp = 42.dp,
    textSize: androidx.compose.ui.unit.TextUnit = DemoText.BodyStrong,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(height)
            .clip(RoundedCornerShape(DemoRadius.Field))
            .background(DemoColors.Field)
            .border(
                1.dp,
                if (isError) DemoColors.Danger else DemoColors.BorderStrong,
                RoundedCornerShape(DemoRadius.Field),
            )
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (prefix != "") {
            Text(
                prefix,
                fontSize = DemoText.BodyStrong,
                fontWeight = FontWeight.Black,
                color = DemoColors.TextMuted,
            )
            Spacer(Modifier.width(6.dp))
        }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            enabled = enabled,
            singleLine = true,
            textStyle = TextStyle(
                fontSize = textSize,
                fontWeight = FontWeight.Bold,
                color = DemoColors.TextPrimary,
            ),
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            cursorBrush = SolidColor(DemoColors.Gold),
            decorationBox = { inner ->
                if (value.isEmpty()) {
                    Text(
                        placeholder,
                        fontSize = textSize,
                        fontWeight = FontWeight.Bold,
                        color = DemoColors.TextFaint,
                        maxLines = 1,
                    )
                }
                inner()
            },
            modifier = Modifier.weight(1f),
        )
        if (trailing != null) {
            Spacer(Modifier.width(6.dp))
            trailing()
        }
    }
}
