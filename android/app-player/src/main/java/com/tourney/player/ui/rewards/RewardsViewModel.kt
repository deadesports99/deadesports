package com.tourney.player.ui.rewards

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tourney.core.network.ApiClient
import com.tourney.core.model.ApiException
import com.tourney.core.network.apiCall
import com.tourney.core.model.ApplyReferralRequest
import com.tourney.core.model.ReferralInfo
import com.tourney.core.model.RewardsSummary
import com.tourney.player.UiState
import kotlinx.coroutines.launch

/**
 * State for the Rewards tab.
 *
 * One request ([RewardsSummary]) renders the whole screen; claims then refetch
 * quietly so the streak, progress bars and balances can never disagree with the
 * server. Money actions surface their error inline (`actionError`) instead of a
 * snackbar, because "claim nahi hua" must stay visible next to the button.
 */
class RewardsViewModel : ViewModel() {

    var state by mutableStateOf<UiState<RewardsSummary>>(UiState.Idle)
        private set

    var claimingDaily by mutableStateOf(false)
        private set

    var claimingTaskId by mutableStateOf<String?>(null)
        private set

    var actionError by mutableStateOf<String?>(null)
        private set

    /** Last successful credit, e.g. "+₹5 credited" for a one-shot toast. */
    var toast by mutableStateOf<String?>(null)
        private set

    fun clearToast() {
        toast = null
    }

    fun clearError() {
        actionError = null
    }

    fun refresh(showLoading: Boolean = true) {
        if (showLoading && state !is UiState.Success) state = UiState.Loading
        viewModelScope.launch {
            state = try {
                UiState.Success(apiCall { ApiClient.tourneyApi.rewardsSummary() })
            } catch (e: ApiException) {
                if (state is UiState.Success) state else UiState.Error(e.message)
            } catch (e: Exception) {
                if (state is UiState.Success) state else UiState.Error("Rewards load nahi hue — internet check karo")
            }
        }
    }

    fun summary(): RewardsSummary? = (state as? UiState.Success)?.data

    fun claimDailyBonus() {
        if (claimingDaily) return
        claimingDaily = true
        actionError = null
        viewModelScope.launch {
            try {
                val ack = apiCall { ApiClient.tourneyApi.claimDailyBonus() }
                toast = if (ack.credited > 0) "+₹${com.tourney.core.ui.formatMoney(ack.credited)} bonus mila" else "Bonus claimed"
                refresh(showLoading = false)
            } catch (e: ApiException) {
                actionError = e.message
                refresh(showLoading = false)
            } catch (e: Exception) {
                actionError = "Claim nahi hua — dubara try karo"
            } finally {
                claimingDaily = false
            }
        }
    }

    fun claimTask(taskId: String) {
        if (claimingTaskId != null) return
        claimingTaskId = taskId
        actionError = null
        viewModelScope.launch {
            try {
                val ack = apiCall { ApiClient.tourneyApi.claimTask(taskId) }
                toast = "+₹${com.tourney.core.ui.formatMoney(ack.credited)} task reward"
                refresh(showLoading = false)
            } catch (e: ApiException) {
                actionError = e.message
                refresh(showLoading = false)
            } catch (e: Exception) {
                actionError = "Task claim nahi hua — dubara try karo"
            } finally {
                claimingTaskId = null
            }
        }
    }

    /** Referral tab: apply someone's code, then refresh the summary. */
    fun applyReferralCode(code: String, onDone: (ReferralInfo?) -> Unit) {
        if (code.isBlank()) {
            actionError = "Code daalo"
            onDone(null)
            return
        }
        viewModelScope.launch {
            try {
                val info = apiCall { ApiClient.tourneyApi.applyReferralCode(ApplyReferralRequest(code.trim().uppercase())) }
                toast = "Referral apply ho gaya"
                refresh(showLoading = false)
                onDone(info)
            } catch (e: ApiException) {
                actionError = e.message
                onDone(null)
            } catch (e: Exception) {
                actionError = "Code apply nahi hua"
                onDone(null)
            }
        }
    }

    /** Referral screen refresh (own invitees list). */
    var referralUi by mutableStateOf<UiState<ReferralInfo>>(UiState.Idle)
        private set

    fun refreshReferral() {
        if (referralUi !is UiState.Success) referralUi = UiState.Loading
        viewModelScope.launch {
            referralUi = try {
                UiState.Success(apiCall { ApiClient.tourneyApi.referralInfo() })
            } catch (e: ApiException) {
                UiState.Error(e.message)
            } catch (e: Exception) {
                UiState.Error("Referral info load nahi hui")
            }
        }
    }
}
