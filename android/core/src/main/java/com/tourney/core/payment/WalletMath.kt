package com.tourney.core.payment

/**
 * Client-side mirror of the server's entry-fee rule:
 * **deposit balance first, then winnings**, never below zero.
 *
 * Why it exists: the app deducts the fee optimistically so the slot screen feels
 * instant. If this maths drifts from the server, the player sees one balance and
 * the ledger says another — exactly the kind of "mera paisa kahan gaya" ticket we
 * cannot debug from support.
 */
object WalletMath {

    data class Split(val deposit: Double, val winning: Double) {
        val total: Double get() = deposit + winning
    }

    /**
     * Apply [fee] to the two balances.
     *
     * - a zero/negative fee changes nothing,
     * - deposit is spent first, winnings only cover the remainder,
     * - a fee larger than both balances floors at zero (the server would reject
     *   the join anyway; the UI must never show a negative balance meanwhile).
     */
    fun applyEntryFee(deposit: Double, winning: Double, fee: Double): Split {
        val safeFee = if (fee.isNaN() || fee <= 0.0) 0.0 else fee
        val fromDeposit = minOf(deposit, safeFee)
        val remaining = safeFee - fromDeposit
        val fromWinning = minOf(winning, remaining)
        return Split(
            deposit = (deposit - fromDeposit).coerceAtLeast(0.0),
            winning = (winning - fromWinning).coerceAtLeast(0.0),
        )
    }
}
