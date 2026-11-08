package com.tourney.player.ui.wallet

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Smartphone
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.razorpay.Checkout
import com.tourney.core.model.PaymentOrderCreated
import com.tourney.core.ui.formatMoney
import com.tourney.player.PlayerViewModel
import com.tourney.player.ui.common.DemoCompactField
import com.tourney.player.ui.common.DemoMessage
import com.tourney.player.ui.common.DemoSheetLabel
import com.tourney.player.ui.common.DemoTextField
import com.tourney.player.ui.common.GoldButton
import com.tourney.player.ui.theme.DemoColors
import com.tourney.player.ui.theme.DemoRadius
import com.tourney.player.ui.theme.DemoText
import org.json.JSONObject

/**
 * Add Cash sheet — port of the approved demo's `AddCashModal.tsx`.
 *
 * Same structure as the web modal: preset amount chips -> custom amount ->
 * UPI / Net Banking / Cards tabs with the same brand lists -> security note ->
 * pay CTA. The payment itself goes through the real gateway order flow
 * (Razorpay native checkout / demo checkout + UTR fallback).
 */

private data class UpiApp(val id: String, val name: String, val logoRes: Int, val bg: Color)

private val POPULAR_UPI = listOf(
    UpiApp("phonepe", "PhonePe", com.tourney.player.R.drawable.brand_phonepe, Color(0xFF5F259F)),
    UpiApp("gpay", "Google Pay", com.tourney.player.R.drawable.brand_gpay, Color.White),
    UpiApp("paytm", "Paytm UPI", com.tourney.player.R.drawable.brand_paytm, Color.White),
    UpiApp("bhim", "BHIM / Any UPI", com.tourney.player.R.drawable.brand_upi, Color.White),
)

private data class Bank(val id: String, val name: String, val logoRes: Int)

private val POPULAR_BANKS = listOf(
    Bank("hdfc", "HDFC Bank", com.tourney.player.R.drawable.brand_hdfc),
    Bank("sbi", "State Bank of India", com.tourney.player.R.drawable.brand_sbi),
    Bank("icici", "ICICI Bank", com.tourney.player.R.drawable.brand_icici),
    Bank("axis", "Axis Bank", com.tourney.player.R.drawable.brand_axis),
    Bank("kotak", "Kotak Bank", com.tourney.player.R.drawable.brand_kotak),
    Bank("pnb", "Punjab National Bank", com.tourney.player.R.drawable.brand_pnb),
)

private enum class Method { UPI, NETBANKING, CARDS }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddCashSheet(
    viewModel: PlayerViewModel,
    onDismiss: () -> Unit,
    onManualDeposit: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val context = LocalContext.current

    // ── gateway state ─────────────────────────────────────────────────────
    val busy = viewModel.topUpBusy
    val message = viewModel.topUpMessage
    val settled = viewModel.topUpSettled
    val order = viewModel.activeTopUp
    val info = viewModel.gatewayInfo
    val minAmount = (info?.minAmountRupees ?: viewModel.liveSettings.minDeposit).coerceAtLeast(1)
    val maxAmount = info?.maxAmountRupees ?: 10_000

    var amountText by remember { mutableStateOf("100") }
    var method by remember { mutableStateOf(Method.UPI) }
    var selectedUpi by remember { mutableStateOf("phonepe") }
    var selectedBank by remember { mutableStateOf("hdfc") }
    var customUpiId by remember { mutableStateOf("") }
    var cardNumber by remember { mutableStateOf("") }
    var cardHolder by remember { mutableStateOf("SPARTAN PLAYER") }
    var cardExpiry by remember { mutableStateOf("") }
    var cardCvv by remember { mutableStateOf("") }

    val presets = remember(minAmount) {
        listOf(50, 100, 200, 500, 1000).filter { it >= minAmount }
    }
    val amount = amountText.toIntOrNull() ?: 0
    val amountTooSmall = amountText.isNotEmpty() && amount < minAmount
    val amountTooBig = amountText.isNotEmpty() && amount > maxAmount
    val canPay = amount >= minAmount && amount <= maxAmount && !busy

    // The player may return from the browser without any callback.
    val lifecycleOwner = androidx.lifecycle.compose.LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                val pending = viewModel.activeTopUp
                if (pending != null && !viewModel.topUpSettled) viewModel.syncTopUp()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    LaunchedEffect(Unit) {
        viewModel.clearTopUp()
        viewModel.loadGatewayInfo()
    }

    ModalBottomSheet(
        onDismissRequest = { if (!busy) onDismiss() },
        sheetState = sheetState,
        containerColor = DemoColors.Card,
        contentColor = DemoColors.TextPrimary,
        shape = RoundedCornerShape(topStart = DemoRadius.Sheet, topEnd = DemoRadius.Sheet),
        dragHandle = {},
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
                .padding(bottom = 24.dp),
        ) {
            // Compact grab bar (the default one wastes vertical space)
            Box(
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .padding(top = 16.dp, bottom = 2.dp)
                    .width(44.dp)
                    .height(4.dp)
                    .clip(RoundedCornerShape(DemoRadius.Pill))
                    .background(DemoColors.TextMuted.copy(alpha = 0.35f)),
            )

            if (settled) {
                Box(modifier = Modifier.padding(top = 10.dp)) {
                    DemoMessage(message ?: "Payment successful.", tone = DemoColors.Success)
                }
            }

            if (!settled) {
                AmountSection(
                    presets = presets,
                    amountText = amountText,
                    onAmountChange = { amountText = it },
                    enabled = !busy,
                    minAmount = minAmount,
                    maxAmount = maxAmount,
                    amountTooSmall = amountTooSmall,
                    amountTooBig = amountTooBig,
                )

                MethodTabs(method = method, onSelect = { method = it })

                when (method) {
                    Method.UPI -> UpiSection(
                        selected = selectedUpi,
                        onSelect = { selectedUpi = it },
                        customUpiId = customUpiId,
                        onCustomChange = { customUpiId = it },
                        enabled = !busy,
                    )
                    Method.NETBANKING -> NetBankingSection(
                        selected = selectedBank,
                        onSelect = { selectedBank = it },
                        enabled = !busy,
                    )
                    Method.CARDS -> CardsSection(
                        cardNumber = cardNumber,
                        onCardNumber = { cardNumber = it },
                        cardHolder = cardHolder,
                        onCardHolder = { cardHolder = it },
                        cardExpiry = cardExpiry,
                        onCardExpiry = { cardExpiry = it },
                        cardCvv = cardCvv,
                        onCardCvv = { cardCvv = it },
                        enabled = !busy,
                    )
                }

                GoldButton(
                    text = when {
                        busy -> "Processing..."
                        order != null -> "Pay ₹${formatMoney(amount.toDouble())} securely"
                        else -> "Pay ₹${formatMoney(amount.toDouble())}"
                    },
                    enabled = canPay,
                    loading = busy,
                    leading = {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowForward,
                            contentDescription = null,
                            tint = DemoColors.OnGold,
                            modifier = Modifier.size(15.dp),
                        )
                    },
                    modifier = Modifier
                        .padding(top = 12.dp)
                        .fillMaxWidth()
                        .height(48.dp),
                    onClick = {
                        viewModel.createTopUp(amount) { created ->
                            openCheckout(context, created, viewModel.config.clientName)
                        }
                    },
                )

                if (order != null) {
                    TextButton(
                        onClick = { viewModel.syncTopUp() },
                        enabled = !busy,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 2.dp),
                    ) {
                        Text(
                            if (busy) "Checking…" else "Already paid? Check status",
                            fontSize = DemoText.Small,
                            fontWeight = FontWeight.Bold,
                            color = DemoColors.TextMuted,
                        )
                    }
                }

                message?.let {
                    Box(modifier = Modifier.padding(top = 6.dp)) {
                        DemoMessage(
                            it,
                            tone = if (it.startsWith("✅")) DemoColors.Success else DemoColors.Danger,
                        )
                    }
                }

                // Manual UTR fallback
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 6.dp)
                        .clickable(enabled = !busy) { onManualDeposit() }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "Pay via UPI & enter UTR instead",
                        fontSize = DemoText.Small,
                        fontWeight = FontWeight.Bold,
                        color = DemoColors.TextMuted,
                    )
                }
            } else {
                GoldButton(
                    text = "Done",
                    onClick = onDismiss,
                    modifier = Modifier
                        .padding(top = 14.dp)
                        .fillMaxWidth()
                        .height(48.dp),
                )
            }
        }
    }
}

// ── Section: amount ─────────────────────────────────────────────────────

@Composable
private fun AmountSection(
    presets: List<Int>,
    amountText: String,
    onAmountChange: (String) -> Unit,
    enabled: Boolean,
    minAmount: Int,
    maxAmount: Int,
    amountTooSmall: Boolean,
    amountTooBig: Boolean,
) {
    Column(modifier = Modifier.padding(top = 6.dp)) {
        DemoSheetLabel("SELECT DEPOSIT AMOUNT")
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 7.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            presets.forEach { preset ->
                val selected = amountText == preset.toString()
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(DemoRadius.Field))
                        .background(if (selected) DemoColors.TextPrimary else DemoColors.Card)
                        .border(
                            1.dp,
                            if (selected) DemoColors.TextPrimary else DemoColors.BorderSoft,
                            RoundedCornerShape(DemoRadius.Field),
                        )
                        .clickable(enabled = enabled) { onAmountChange(preset.toString()) }
                        .padding(vertical = 6.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "+₹$preset",
                        fontSize = DemoText.Small,
                        fontWeight = FontWeight.Black,
                        color = if (selected) DemoColors.Canvas else DemoColors.TextSecondary,
                    )
                }
            }
        }

        DemoCompactField(
            value = amountText,
            onValueChange = { raw -> onAmountChange(raw.filter { ch -> ch.isDigit() }.take(6)) },
            placeholder = "Or enter custom amount (Min. ₹$minAmount)",
            enabled = enabled,
            isError = amountTooSmall || amountTooBig,
            prefix = "₹",
            modifier = Modifier.padding(top = 8.dp),
        )
        if (amountTooSmall || amountTooBig) {
            Text(
                when {
                    amountTooSmall -> "Minimum ₹$minAmount per top-up"
                    else -> "Maximum ₹$maxAmount per top-up"
                },
                fontSize = DemoText.Tiny,
                fontWeight = FontWeight.Bold,
                color = DemoColors.Danger,
                modifier = Modifier.padding(top = 5.dp, start = 4.dp),
            )
        }
    }
}


// ── Section: method tabs ────────────────────────────────────────────────

@Composable
private fun MethodTabs(method: Method, onSelect: (Method) -> Unit) {
    Column(modifier = Modifier.padding(top = 12.dp)) {
        DemoSheetLabel("CHOOSE PAYMENT METHOD")
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 8.dp)
                .clip(RoundedCornerShape(DemoRadius.Field))
                .background(DemoColors.Field)
                .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Field))
                .padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            MethodTab(Icons.Filled.Smartphone, "UPI", method == Method.UPI) { onSelect(Method.UPI) }
            MethodTab(Icons.Filled.AccountBalance, "Net Banking", method == Method.NETBANKING) { onSelect(Method.NETBANKING) }
            MethodTab(Icons.Filled.CreditCard, "Cards", method == Method.CARDS) { onSelect(Method.CARDS) }
        }
    }
}

@Composable
private fun androidx.compose.foundation.layout.RowScope.MethodTab(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .weight(1f)
            .clip(RoundedCornerShape(9.dp))
            .background(if (selected) DemoColors.CardElevated else Color.Transparent)
            .clickable(onClick = onClick)
            .padding(vertical = 9.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = if (selected) DemoColors.TextPrimary else DemoColors.TextMuted,
            modifier = Modifier.size(14.dp),
        )
        Spacer(Modifier.width(5.dp))
        Text(
            text,
            fontSize = DemoText.Small,
            fontWeight = if (selected) FontWeight.Black else FontWeight.Bold,
            color = if (selected) DemoColors.TextPrimary else DemoColors.TextMuted,
        )
    }
}

// ── Section: UPI ────────────────────────────────────────────────────────

@Composable
private fun UpiSection(
    selected: String,
    onSelect: (String) -> Unit,
    customUpiId: String,
    onCustomChange: (String) -> Unit,
    enabled: Boolean,
) {
    Column(modifier = Modifier.padding(top = 10.dp)) {
        // 2x2 grid of popular UPI apps
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            POPULAR_UPI.chunked(2).forEach { rowApps ->
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    rowApps.forEach { app ->
                        SelectRow(
                            selected = selected == app.id,
                            onClick = { onSelect(app.id) },
                            enabled = enabled,
                            label = app.name,
                            modifier = Modifier.weight(1f),
                            leading = {
                                BrandBadge(bg = app.bg, logoRes = app.logoRes, wide = app.id == "paytm")
                            },
                        )
                    }
                    if (rowApps.size == 1) Spacer(Modifier.weight(1f))
                }
            }
        }

        DemoCompactField(
            value = customUpiId,
            onValueChange = { onCustomChange(it.take(60)) },
            placeholder = "Or enter UPI ID (e.g. mobile@upi)",
            enabled = enabled,
            isError = false,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}

// ── Section: net banking ────────────────────────────────────────────────

@Composable
private fun NetBankingSection(
    selected: String,
    onSelect: (String) -> Unit,
    enabled: Boolean,
) {
    Column(modifier = Modifier.padding(top = 10.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            POPULAR_BANKS.chunked(2).forEach { rowBanks ->
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    rowBanks.forEach { bank ->
                        SelectRow(
                            selected = selected == bank.id,
                            onClick = { onSelect(bank.id) },
                            enabled = enabled,
                            label = bank.name,
                            modifier = Modifier.weight(1f),
                            leading = { BrandBadge(bg = Color.White, logoRes = bank.logoRes, wide = false) },
                        )
                    }
                    if (rowBanks.size == 1) Spacer(Modifier.weight(1f))
                }
            }
        }
        Text(
            "All Indian banks supported via secure RBI payment gateway",
            fontSize = DemoText.Tiny,
            fontWeight = FontWeight.Medium,
            color = DemoColors.TextMuted,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 6.dp),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
    }
}

// ── Section: cards ──────────────────────────────────────────────────────

/** Card network detection — same BIN rules as the web modal. */
private fun cardNetwork(cardNumber: String): String {
    val clean = cardNumber.replace(" ", "")
    return when {
        clean.startsWith("4") -> "visa"
        clean.matches(Regex("^5[1-5].*")) || clean.matches(Regex("^2[2-7].*")) -> "mastercard"
        clean.matches(Regex("^(60|65|508).*")) -> "rupay"
        else -> "generic"
    }
}

@Composable
private fun CardsSection(
    cardNumber: String,
    onCardNumber: (String) -> Unit,
    cardHolder: String,
    onCardHolder: (String) -> Unit,
    cardExpiry: String,
    onCardExpiry: (String) -> Unit,
    cardCvv: String,
    onCardCvv: (String) -> Unit,
    enabled: Boolean,
) {
    Column(modifier = Modifier.padding(top = 12.dp)) {
        DemoTextField(
            value = cardNumber,
            onValueChange = { raw ->
                val digits = raw.filter { ch -> ch.isDigit() }.take(16)
                onCardNumber(digits.chunked(4).joinToString(" "))
            },
            label = "CARD NUMBER",
            placeholder = "4000 1234 5678 9010",
            enabled = enabled,
            digitsOnly = true,
            maxLength = 19,
            trailing = {
                when (cardNetwork(cardNumber)) {
                    "visa" -> CardNetworkLogo(com.tourney.player.R.drawable.brand_visa, height = 12.dp)
                    "mastercard" -> CardNetworkLogo(com.tourney.player.R.drawable.brand_mastercard, height = 15.dp)
                    "rupay" -> CardNetworkLogo(com.tourney.player.R.drawable.brand_rupay, height = 12.dp)
                    else -> Icon(
                        Icons.Filled.CreditCard,
                        contentDescription = null,
                        tint = DemoColors.TextFaint,
                        modifier = Modifier.size(15.dp),
                    )
                }
            },
        )
        DemoTextField(
            value = cardHolder,
            onValueChange = { onCardHolder(it.uppercase()) },
            label = "NAME ON CARD",
            placeholder = "SPARTAN PLAYER",
            enabled = enabled,
            maxLength = 40,
            modifier = Modifier.padding(top = 10.dp),
        )
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            DemoTextField(
                value = cardExpiry,
                onValueChange = { raw ->
                    val digits = raw.filter { ch -> ch.isDigit() }.take(4)
                    onCardExpiry(if (digits.length >= 3) "${digits.take(2)}/${digits.drop(2)}" else digits)
                },
                label = "EXPIRY DATE",
                placeholder = "MM/YY",
                enabled = enabled,
                digitsOnly = true,
                maxLength = 5,
                modifier = Modifier.weight(1f),
            )
            DemoTextField(
                value = cardCvv,
                onValueChange = { raw -> onCardCvv(raw.filter { ch -> ch.isDigit() }.take(4)) },
                label = "CVV / CVC",
                placeholder = "•••",
                enabled = enabled,
                digitsOnly = true,
                maxLength = 4,
                trailing = {
                    Icon(
                        Icons.Filled.Lock,
                        contentDescription = null,
                        tint = DemoColors.TextFaint,
                        modifier = Modifier.size(13.dp),
                    )
                },
                modifier = Modifier.weight(1f),
            )
        }

        // Supported cards badge strip
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 12.dp)
                .clip(RoundedCornerShape(DemoRadius.Field))
                .background(DemoColors.CardMuted)
                .border(1.dp, DemoColors.BorderFaint, RoundedCornerShape(DemoRadius.Field))
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "SUPPORTED CARDS:",
                fontSize = DemoText.Micro,
                fontWeight = FontWeight.Black,
                color = DemoColors.TextMuted,
                letterSpacing = 0.5.sp,
                modifier = Modifier.weight(1f),
            )
            CardNetworkLogo(com.tourney.player.R.drawable.brand_visa, height = 10.dp)
            Spacer(Modifier.width(10.dp))
            CardNetworkLogo(com.tourney.player.R.drawable.brand_mastercard, height = 14.dp)
            Spacer(Modifier.width(10.dp))
            CardNetworkLogo(com.tourney.player.R.drawable.brand_rupay, height = 10.dp)
        }
    }
}

/** Wide network mark (visa / mastercard / rupay) drawn at a fixed height. */
@Composable
private fun CardNetworkLogo(res: Int, height: androidx.compose.ui.unit.Dp) {
    val painter = painterResource(res)
    val ratio = painter.intrinsicSize.let { if (it.width > 0 && it.height > 0) it.width / it.height else 3f }
    Image(
        painter = painter,
        contentDescription = null,
        contentScale = ContentScale.Fit,
        modifier = Modifier
            .height(height)
            .width(height * ratio),
    )
}

// ── Shared row + badge ──────────────────────────────────────────────────

@Composable
private fun SelectRow(
    selected: Boolean,
    onClick: () -> Unit,
    enabled: Boolean,
    label: String,
    modifier: Modifier = Modifier,
    leading: @Composable () -> Unit,
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(DemoRadius.Field))
            .background(if (selected) DemoColors.CardMuted else DemoColors.Card)
            .border(
                if (selected) 1.5.dp else 1.dp,
                if (selected) DemoColors.TextPrimary else DemoColors.BorderSoft,
                RoundedCornerShape(DemoRadius.Field),
            )
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        leading()
        Spacer(Modifier.width(6.dp))
        Text(
            label,
            fontSize = DemoText.Small,
            fontWeight = FontWeight.Bold,
            color = DemoColors.TextPrimary,
            modifier = Modifier.weight(1f),
            maxLines = 1,
        )
        if (selected) {
            Icon(
                Icons.Filled.CheckCircle,
                contentDescription = null,
                tint = DemoColors.Success,
                modifier = Modifier.size(13.dp),
            )
        }
    }
}

/** Compact rounded brand badge for the UPI app / bank tiles. */
@Composable
private fun BrandBadge(bg: Color, logoRes: Int, wide: Boolean) {
    Box(
        modifier = Modifier
            .size(width = if (wide) 24.dp else 20.dp, height = 20.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(bg)
            .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(6.dp))
            .padding(horizontal = if (wide) 2.dp else 1.dp),
        contentAlignment = Alignment.Center,
    ) {
        Image(
            painter = painterResource(logoRes),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

// ── Checkout plumbing ─────────────────────────────────────────────────────

/**
 * Open the correct checkout for the provider:
 *  - Razorpay -> native Standard Checkout (result comes back via MainActivity).
 *  - mock     -> the backend's demo checkout page in a browser.
 */
private fun openCheckout(context: Context, order: PaymentOrderCreated, brandName: String) {
    if (order.isRazorpay) {
        val activity = context.findActivityHost()
        if (activity == null) {
            ToastMessage.show(context, "Cannot open checkout right now. Try again.")
            return
        }
        try {
            val checkout = Checkout()
            order.keyId?.let { checkout.setKeyID(it) }
            val options = JSONObject().apply {
                put("name", brandName)
                put("description", "Wallet top-up")
                put("order_id", order.providerOrderId)
                put("amount", order.amountPaise)
                put("currency", order.currency)
                put("theme", JSONObject().put("color", "#FF4757"))
                put("retry", JSONObject().put("enabled", true))
                put("send_sms_hash", true)
            }
            checkout.open(activity, options)
        } catch (e: Exception) {
            ToastMessage.show(context, "Could not open Razorpay checkout: ${e.message}")
        }
        return
    }

    val url = order.checkoutUrl
    if (url.isNullOrBlank()) {
        ToastMessage.show(context, "Checkout link missing. Try again.")
        return
    }
    try {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    } catch (e: ActivityNotFoundException) {
        ToastMessage.show(context, "No browser found to open the checkout.")
    }
}

/** Compose dialogs receive a ContextWrapper — unwrap it to the host Activity. */
private fun Context.findActivityHost(): Activity? {
    var current: Context = this
    while (current is ContextWrapper) {
        if (current is Activity) return current
        current = current.baseContext
    }
    return null
}

/** Tiny toast helper so the checkout helpers stay free of Compose imports. */
private object ToastMessage {
    fun show(context: Context, text: String) {
        android.widget.Toast.makeText(context, text, android.widget.Toast.LENGTH_LONG).show()
    }
}
