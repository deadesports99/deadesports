package com.tourney.core.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Money models are the client's only source of truth for "did my top-up land?".
 * These tests pin the contract: paise in, rupees out, never a float on the wire.
 */
class PaymentModelTest {

    @Test
    fun `amount is derived from paise, never stored as rupees`() {
        val order = PaymentOrderCreated(
            orderId = "o1",
            provider = "razorpay",
            providerOrderId = "order_RZP1",
            amountPaise = 50_000,
        )

        assertEquals(500, order.amountRupees)
        assertEquals("INR", order.currency)
    }

    @Test
    fun `razorpay checkout needs both provider and key id`() {
        val live = PaymentOrderCreated("o1", "razorpay", "order_1", 10_000, keyId = "rzp_live_x")
        assertTrue(live.isRazorpay)

        // A razorpay order without a key cannot open the native sheet.
        val missingKey = PaymentOrderCreated("o2", "razorpay", "order_2", 10_000, keyId = "  ")
        assertFalse(missingKey.isRazorpay)

        // Mock orders are settled on the demo page instead.
        val mock = PaymentOrderCreated("o3", "mock", "order_mock_1", 10_000, checkoutUrl = "http://x/demo")
        assertFalse(mock.isRazorpay)
        assertEquals("http://x/demo", mock.checkoutUrl)
    }

    @Test
    fun `only CAPTURED counts as paid`() {
        listOf("CREATED", "AUTHORIZED", "FAILED", "EXPIRED").forEach { status ->
            assertFalse(status, PaymentOrderStatus("o1", status, 10_000).isCaptured)
        }
        assertTrue(PaymentOrderStatus("o1", "CAPTURED", 10_000).isCaptured)
    }

    @Test
    fun `settlement response exposes the new balance and re-check flag`() {
        val fresh = VerifyPaymentResponse(orderId = "o1", status = "CAPTURED", balanceAfter = 1_250.0)
        assertTrue(fresh.isCaptured)
        assertFalse(fresh.alreadySettled)
        assertEquals(1_250.0, fresh.balanceAfter!!, 0.001)

        val retry = VerifyPaymentResponse(orderId = "o1", status = "CAPTURED", alreadySettled = true)
        assertTrue(retry.alreadySettled)
        assertNull(retry.balanceAfter)
    }

    @Test
    fun `gateway limits are shown to the player in rupees`() {
        val config = PaymentGatewayInfo(minAmountPaise = 1_000, maxAmountPaise = 100_000, demoMode = false)

        assertEquals(10, config.minAmountRupees)
        assertEquals(1_000, config.maxAmountRupees)
        assertFalse(config.demoMode)
    }

    @Test
    fun `admin row falls back from in-game name to name to unknown`() {
        assertEquals("FF Sniper", PaymentPlayer(inGameName = "FF Sniper", name = "Rahul").label)
        assertEquals("Rahul", PaymentPlayer(inGameName = "  ", name = "Rahul").label)
        assertEquals("Unknown player", PaymentPlayer().label)
    }

    @Test
    fun `history rows explain their status in one word`() {
        assertEquals("Paid", PlayerPayment(status = "CAPTURED").label)
        assertEquals("Pending", PlayerPayment(status = "CREATED").label)
        assertEquals("Pending", PlayerPayment(status = "AUTHORIZED").label)
        assertEquals("Failed", PlayerPayment(status = "FAILED").label)
        assertEquals("Expired", PlayerPayment(status = "EXPIRED").label)
        assertEquals("WEIRD", PlayerPayment(status = "WEIRD").label)
    }

    @Test
    fun `only unpaid rows offer Re-check`() {
        assertTrue(PlayerPayment(status = "PENDING").isPending)
        assertTrue(PlayerPayment(status = "AUTHORIZED").isPending)
        assertFalse(PlayerPayment(status = "CAPTURED").isPending)
        assertFalse(PlayerPayment(status = "EXPIRED").isPending)
        assertFalse(PlayerPayment(status = "FAILED").isPending)
    }
}
