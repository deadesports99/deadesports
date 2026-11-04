const fs = require('fs');

const file = 'C:/Free Fire turnament/android/app-player/src/main/java/com/tourney/player/TournamentFeedScreen.kt';
let code = fs.readFileSync(file, 'utf8');

// Replace sort and tab filter
const oldBlock = `                        // 2. Sort by matchTime ASC (earliest first, later tournaments below)
                        val sortedMatches = activeMatches.sortedBy { it.matchTime }

                        // 3. Separate Upcoming vs Live sections
                        val tabMatches = when (currentTab) {
                            FeedTab.UPCOMING -> sortedMatches.filter {
                                it.status == TournamentStatus.UPCOMING ||
                                    it.status == TournamentStatus.OPEN ||
                                    it.status == TournamentStatus.SLOTS_FULL
                            }
                            FeedTab.LIVE -> sortedMatches.filter {
                                it.status == TournamentStatus.LIVE ||
                                    it.status == TournamentStatus.ROOM_REVEALED ||
                                    it.status == TournamentStatus.UNDER_REVIEW
                            }
                        }`;

const newBlock = `                        // 2. Sort: joined matches first so player never loses their match, then by matchTime ASC
                        val sortedMatches = activeMatches.sortedWith(
                            compareByDescending<Tournament> { it.mySlot != null }
                                .thenBy { it.matchTime }
                        )

                        // 3. Separate Upcoming vs Live sections
                        val tabMatches = when (currentTab) {
                            FeedTab.UPCOMING -> sortedMatches.filter {
                                it.status == TournamentStatus.UPCOMING ||
                                    it.status == TournamentStatus.OPEN ||
                                    it.status == TournamentStatus.SLOTS_FULL ||
                                    it.status == TournamentStatus.ROOM_REVEALED
                            }
                            FeedTab.LIVE -> sortedMatches.filter {
                                it.status == TournamentStatus.LIVE ||
                                    it.status == TournamentStatus.ROOM_REVEALED ||
                                    it.status == TournamentStatus.UNDER_REVIEW
                            }
                        }`;

if (code.includes(oldBlock)) {
  code = code.replace(oldBlock, newBlock);
  fs.writeFileSync(file, code, 'utf8');
  console.log('✅ TournamentFeedScreen.kt updated (LF)');
} else {
  // Try CRLF
  const oldBlockCRLF = oldBlock.replace(/\n/g, '\r\n');
  const newBlockCRLF = newBlock.replace(/\n/g, '\r\n');
  if (code.includes(oldBlockCRLF)) {
    code = code.replace(oldBlockCRLF, newBlockCRLF);
    fs.writeFileSync(file, code, 'utf8');
    console.log('✅ TournamentFeedScreen.kt updated (CRLF)');
  } else {
    console.log('❌ Could not find oldBlock in TournamentFeedScreen.kt');
  }
}
