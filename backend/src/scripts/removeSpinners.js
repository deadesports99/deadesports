const fs = require('fs');

// 1. Update PlayerViewModel.kt
const vmFile = 'C:/Free Fire turnament/android/app-player/src/main/java/com/tourney/player/PlayerViewModel.kt';
let vmCode = fs.readFileSync(vmFile, 'utf8');

// Update refreshWallet signature and implementation
vmCode = vmCode.replace(
  /fun refreshWallet\(forceLoading: Boolean = false\) \{[\s\S]*?isWalletRefreshing = true/,
  `fun refreshWallet(forceLoading: Boolean = false, silent: Boolean = false) {\n        if (!silent && (forceLoading || walletUi is UiState.Idle || walletUi is UiState.Error)) {\n            walletUi = UiState.Loading\n        }\n        if (!silent) isWalletRefreshing = true`
);

vmCode = vmCode.replace(
  /\} finally \{\s*isWalletRefreshing = false\s*\}/,
  `} finally {\n                if (!silent) isWalletRefreshing = false\n            }`
);

// Update calls in observeRealtimeEvents
vmCode = vmCode.replace('refreshWallet(forceLoading = false)', 'refreshWallet(silent = true)');
vmCode = vmCode.replace('refreshFeed(forceLoading = false)', 'refreshFeed(silent = true)');
vmCode = vmCode.replace('refreshWallet(forceLoading = false)', 'refreshWallet(silent = true)');
vmCode = vmCode.replace('refreshWallet(forceLoading = false)', 'refreshWallet(silent = true)');
vmCode = vmCode.replace('refreshWallet(forceLoading = false)', 'refreshWallet(silent = true)');

fs.writeFileSync(vmFile, vmCode, 'utf8');
console.log('✅ PlayerViewModel.kt updated');

// 2. Update TournamentFeedScreen.kt
const feedFile = 'C:/Free Fire turnament/android/app-player/src/main/java/com/tourney/player/TournamentFeedScreen.kt';
let feedCode = fs.readFileSync(feedFile, 'utf8');

feedCode = feedCode.replace(
  'viewModel.refreshFeed()',
  'viewModel.refreshFeed(silent = true)'
);

fs.writeFileSync(feedFile, feedCode, 'utf8');
console.log('✅ TournamentFeedScreen.kt updated');

// 3. Update WalletScreen.kt
const walletFile = 'C:/Free Fire turnament/android/app-player/src/main/java/com/tourney/player/WalletScreen.kt';
let walletCode = fs.readFileSync(walletFile, 'utf8');

walletCode = walletCode.replace(
  'viewModel.refreshWallet()',
  'viewModel.refreshWallet(silent = true)'
);

fs.writeFileSync(walletFile, walletCode, 'utf8');
console.log('✅ WalletScreen.kt updated');
