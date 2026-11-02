package com.tourney.core.ui

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import java.net.URLEncoder

/**
 * 💸 UPI deep link + QR engine (no third-party payment SDK needed).
 *
 * Both GPay/PhonePe/Paytm and the in-app QR read the same `upi://pay` URI, so
 * the amount the player scans is always the amount they typed — the QR is
 * dynamic per amount ("dynamic QR").
 *
 * Security note: this URI only *initiates* a transfer. Money is never credited
 * automatically — the player pastes the UTR and staff verify it (deposit flow).
 */
object UpiPay {

    /**
     * `upi://pay?pa=merchant@bank&pn=Brand&am=50.00&cu=INR&tn=Wallet top-up`
     *
     * @param amount amount in ₹ (rounded to 2dp, min ₹1)
     */
    fun buildUri(
        upiId: String,
        payeeName: String,
        amount: Double,
        note: String = "Wallet top-up",
        transactionRef: String? = null,
    ): String {
        val amt = String.format(java.util.Locale.US, "%.2f", amount.coerceAtLeast(1.0))
        val params = buildList {
            add("pa" to upiId.trim())
            add("pn" to payeeName.trim())
            add("am" to amt)
            add("cu" to "INR")
            add("tn" to note)
            if (!transactionRef.isNullOrBlank()) add("tr" to transactionRef)
        }
        return "upi://pay?" + params.joinToString("&") { (key, value) -> "$key=${encode(value)}" }
    }

    /**
     * GPay/PhonePe-friendly text amount ("50", not "50.00") — some UPI apps
     * reject trailing zeros in the `am` parameter.
     */
    fun friendlyAmount(amount: Double): String =
        if (amount == amount.toLong().toDouble()) amount.toLong().toString()
        else String.format(java.util.Locale.US, "%.2f", amount)

    private fun encode(value: String): String =
        URLEncoder.encode(value, "UTF-8").replace("+", "%20")
}

/** Render a QR bitmap for any payload (UPI URI, join code, etc.). */
fun generateQrBitmap(content: String, sizePx: Int = 512): Bitmap? = try {
    val hints = mapOf(
        EncodeHintType.MARGIN to 1,
        EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M,
        EncodeHintType.CHARACTER_SET to "UTF-8",
    )
    val matrix = QRCodeWriter().encode(
        content,
        BarcodeFormat.QR_CODE,
        sizePx,
        sizePx,
        hints,
    )
    val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
    for (x in 0 until sizePx) {
        for (y in 0 until sizePx) {
            bitmap.setPixel(x, y, if (matrix[x, y]) android.graphics.Color.BLACK else android.graphics.Color.WHITE)
        }
    }
    bitmap
} catch (e: Exception) {
    null
}

/**
 * White-backed UPI QR with a quiet zone — scans reliably in dark theme and on
 * camera apps that crop tightly.
 */
@Composable
fun UpiQrCode(
    uri: String,
    modifier: Modifier = Modifier,
    size: Dp = 180.dp,
) {
    val sizePx = with(LocalDensity.current) { size.toPx().toInt().coerceAtLeast(128) }
    val bitmap = remember(uri, sizePx) { generateQrBitmap(uri, sizePx) }

    Box(
        modifier = modifier
            .size(size)
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .padding(6.dp),
        contentAlignment = Alignment.Center,
    ) {
        if (bitmap != null) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = "UPI payment QR code",
                modifier = Modifier.size(size),
            )
        } else {
            Text(
                "QR unavailable — use the Pay button",
                color = Color.Black,
                fontSize = 11.sp,
                textAlign = TextAlign.Center,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}
