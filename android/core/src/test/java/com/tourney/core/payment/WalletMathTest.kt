package com.tourney.core.payment

import org.junit.Assert.assertEquals
import org.junit.Test

/** The optimistic wallet deduction must mirror the backend fee rule exactly. */
class WalletMathTest {

    @Test
    fun `fee comes out of the deposit balance first`() {
        val split = WalletMath.applyEntryFee(deposit = 100.0, winning = 50.0, fee = 25.0)

        assertEquals(75.0, split.deposit, 0.001)
        assertEquals(50.0, split.winning, 0.001)
        assertEquals(125.0, split.total, 0.001)
    }

    @Test
    fun `winnings cover only the remainder`() {
        val split = WalletMath.applyEntryFee(deposit = 10.0, winning = 50.0, fee = 25.0)

        assertEquals(0.0, split.deposit, 0.001)
        assertEquals(35.0, split.winning, 0.001)
        assertEquals(35.0, split.total, 0.001)
    }

    @Test
    fun `whole deposit is used before any winnings`() {
        val split = WalletMath.applyEntryFee(deposit = 25.0, winning = 50.0, fee = 25.0)

        assertEquals(0.0, split.deposit, 0.001)
        assertEquals(50.0, split.winning, 0.001, )
    }

    @Test
    fun `a zero fee changes nothing`() {
        val split = WalletMath.applyEntryFee(deposit = 100.0, winning = 50.0, fee = 0.0)

        assertEquals(100.0, split.deposit, 0.001)
        assertEquals(50.0, split.winning, 0.001)
    }

    @Test
    fun `a negative or NaN fee never credits the player`() {
        val negative = WalletMath.applyEntryFee(deposit = 100.0, winning = 50.0, fee = -25.0)
        assertEquals(100.0, negative.deposit, 0.001)
        assertEquals(50.0, negative.winning, 0.001)

        val nan = WalletMath.applyEntryFee(deposit = 100.0, winning = 50.0, fee = Double.NaN)
        assertEquals(100.0, nan.deposit, 0.001)
        assertEquals(50.0, nan.winning, 0.001)
    }

    @Test
    fun `a fee larger than both balances floors at zero, never negative`() {
        val split = WalletMath.applyEntryFee(deposit = 10.0, winning = 5.0, fee = 100.0)

        assertEquals(0.0, split.deposit, 0.001)
        assertEquals(0.0, split.winning, 0.001)
    }
}
