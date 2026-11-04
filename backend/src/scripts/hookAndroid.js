const fs = require('fs');
const path = require('path');

const file = 'C:/Free Fire turnament/android/app-player/src/main/java/com/tourney/player/PlayerViewModel.kt';
let code = fs.readFileSync(file, 'utf8');

// 1. Add imports
if (!code.includes('import com.tourney.core.network.TourneyRealtimeClient')) {
  code = code.replace(
    'import com.tourney.core.network.ApiClient',
    'import com.tourney.core.model.TournamentStatus\nimport com.tourney.core.network.RealtimeEvent\nimport com.tourney.core.network.TourneyRealtimeClient\nimport com.tourney.core.network.ApiClient'
  );
}

// 2. Add observeRealtimeEvents() call to init
if (!code.includes('observeRealtimeEvents()')) {
  if (code.includes('init {\r\n        loadDiskCache()\r\n    }')) {
    code = code.replace(
      'init {\r\n        loadDiskCache()\r\n    }',
      'init {\r\n        loadDiskCache()\r\n        observeRealtimeEvents()\r\n    }'
    );
  } else {
    code = code.replace(
      'init {\n        loadDiskCache()\n    }',
      'init {\n        loadDiskCache()\n        observeRealtimeEvents()\n    }'
    );
  }
}

// 3. Add observeRealtimeEvents function implementation
const observeMethod = `
    private fun observeRealtimeEvents() {
        viewModelScope.launch {
            TourneyRealtimeClient.events.collect { event ->
                when (event) {
                    is RealtimeEvent.SlotBooked -> {
                        val currentFeed = (feedUi as? UiState.Success)?.data ?: return@collect
                        val updatedItems = currentFeed.items.map { item ->
                            if (item.id == event.tournamentId) {
                                val newStatus = event.status?.let {
                                    runCatching { TournamentStatus.valueOf(it) }.getOrNull()
                                } ?: if (event.slotsBooked >= event.totalSlots) TournamentStatus.SLOTS_FULL else item.status
                                item.copy(
                                    slotsBooked = event.slotsBooked,
                                    totalSlots = event.totalSlots,
                                    status = newStatus
                                )
                            } else {
                                item
                            }
                        }
                        val updatedFeed = currentFeed.copy(items = updatedItems)
                        feedUi = UiState.Success(updatedFeed)
                        saveFeedCache(updatedFeed)
                    }

                    is RealtimeEvent.WalletUpdated -> {
                        val currentWallet = (walletUi as? UiState.Success)?.data
                        if (currentWallet != null) {
                            val updated = currentWallet.copy(
                                depositBalance = "%.2f".format(java.util.Locale.US, event.depositBalance),
                                winningBalance = "%.2f".format(java.util.Locale.US, event.winningBalance),
                                totalBalance = "%.2f".format(java.util.Locale.US, event.totalBalance),
                            )
                            walletUi = UiState.Success(updated)
                            saveWalletCache(updated)
                        } else {
                            refreshWallet(forceLoading = false)
                        }
                    }

                    is RealtimeEvent.MatchStatusChanged -> {
                        val currentFeed = (feedUi as? UiState.Success)?.data ?: return@collect
                        if (event.status == TournamentStatus.COMPLETED || event.status == TournamentStatus.CANCELLED) {
                            val filtered = currentFeed.items.filter { it.id != event.tournamentId }
                            val updatedFeed = currentFeed.copy(items = filtered)
                            feedUi = UiState.Success(updatedFeed)
                            saveFeedCache(updatedFeed)
                        } else {
                            val updatedItems = currentFeed.items.map { item ->
                                if (item.id == event.tournamentId) {
                                    item.copy(status = event.status)
                                } else {
                                    item
                                }
                            }
                            val updatedFeed = currentFeed.copy(items = updatedItems)
                            feedUi = UiState.Success(updatedFeed)
                            saveFeedCache(updatedFeed)
                        }
                    }

                    is RealtimeEvent.RoomCredentialsRevealed -> {
                        refreshFeed(forceLoading = false)
                    }

                    is RealtimeEvent.DepositApproved -> {
                        refreshWallet(forceLoading = false)
                    }

                    is RealtimeEvent.PrizeWon -> {
                        refreshWallet(forceLoading = false)
                    }
                }
            }
        }
    }
`;

if (!code.includes('private fun observeRealtimeEvents()')) {
  if (code.includes('private fun loadDiskCache()')) {
    code = code.replace('private fun loadDiskCache()', observeMethod + '\n    private fun loadDiskCache()');
  }
}

// 4. Update persistLogin to send token to TourneyRealtimeClient
if (!code.includes('TourneyRealtimeClient.updateToken(response.token)')) {
  code = code.replace(
    'private suspend fun persistLogin(response: com.tourney.core.model.AuthResponse) {',
    'private suspend fun persistLogin(response: com.tourney.core.model.AuthResponse) {\n        TourneyRealtimeClient.updateToken(response.token)'
  );
}

// 5. Update logout to reset token in TourneyRealtimeClient
if (!code.includes('TourneyRealtimeClient.updateToken(null)')) {
  code = code.replace(
    'fun logout() {',
    'fun logout() {\n        TourneyRealtimeClient.updateToken(null)'
  );
}

fs.writeFileSync(file, code, 'utf8');
console.log('✅ PlayerViewModel.kt updated successfully');
