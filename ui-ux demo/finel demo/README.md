# Spartan Esports Arena — Final UI/UX Architecture

Ye folder Free Fire Tournament platform ka **Final Modular Production Demo** hai. Yaha pura code screen-wise, component-wise aur utility-wise modularize kiya gaya hai taaki kisi ek file me khichdi na bane.

---

## 📁 Folder Structure & File Map

```
C:\Free Fire turnament\ui-ux demo\finel demo\
├── index.html                   # Vite / React standard HTML entry point
├── package.json                 # React + Tailwind dependencies
├── preview.html                 # 1-Click Instant Browser Preview (Zero setup needed)
├── README.md                    # Ye guide aur documentation
└── src/
    ├── main.tsx                 # React 18 DOM root render
    ├── App.tsx                  # Master App coordinator & state machine
    │
    ├── types/
    │   └── index.ts             # Saare TypeScript interfaces & enums
    │
    ├── data/
    │   └── mockData.ts          # Central mock data (matches, transactions, filters)
    │
    ├── utils/
    │   └── formatters.ts        # Helper functions (formatINR, generateUTR, cx)
    │
    ├── components/
    │   ├── common/              # Universal micro-components
    │   │   ├── Ambient.tsx      # Cyber background mesh & glow orbs
    │   │   ├── Crest.tsx        # Spartan EGA official shield logo
    │   │   ├── GlassCard.tsx    # 50% dark / 25% light frosted glass container
    │   │   ├── ThemeButton.tsx  # Sun/Moon theme toggle pill
    │   │   └── Toast.tsx        # Notification toast pill
    │   │
    │   ├── navigation/          # Navigation components
    │   │   ├── AppHeader.tsx    # Sticky top header (balance, topup, bell, settings)
    │   │   └── BottomNav.tsx    # Clean 3-tab dock (Tournaments, Wallet, Profile)
    │   │
    │   ├── tournaments/         # Tournament components
    │   │   ├── MatchCard.tsx    # Match card with single-accent cyan progress bar
    │   │   └── MatchSheet.tsx   # Cupertino quick-join bottom sheet
    │   │
    │   └── modals/              # App Modals & Dialogs
    │       ├── SecurityModal.tsx # 4-digit PIN security dialog
    │       ├── SettingsSheet.tsx # Settings drawer (anti-cheat, WhatsApp support)
    │       └── SignOutModal.tsx  # Sign-out confirmation dialog
    │
    └── screens/                 # Full-Screen App Views
        ├── auth/
        │   ├── LoginScreen.tsx  # Spartan login with phone / Google & UID
        │   └── OtpScreen.tsx    # 6-digit OTP verification with timer & change number
        ├── TournamentsScreen.tsx# Esports lobby, titles selector, filters & featured banner
        ├── WalletScreen.tsx     # Dual-entry ledger (Deposits vs Winnings), UPI & tx history
        └── ProfileScreen.tsx    # Identity profile, Google/Phone toggle & career stats
```

---

## 🎨 Design System & Highlights

1. **Dual Frosted Glassmorphism**:
   - **Dark Mode**: 50% frosted glass (`bg-slate-900/50 backdrop-blur-xl border-white/10`).
   - **Light Mode**: 25% frosted glass (`bg-white/75 backdrop-blur-md border-slate-900/10`).
2. **Single-Accent Cyan Slot Progress Bar**:
   - Filled slots display `#00C2FF` (Electric Cyan) glowing progress bar.
3. **Clean 3-Tab Bottom Dock**:
   - Tab 1: `Tournaments`
   - Tab 2: `Wallet`
   - Tab 3: `Profile`
   - Wallet tab me balance badge ko remove kar ke clean icon + text rakha gaya hai.
4. **True Full-Screen Edge-to-Edge**:
   - Kisi fixed card container me band nahi hai, screen ke edges tak perfectly fit baithta hai.
5. **Instant Preview**:
   - `preview.html` ko kisi bhi browser me direct double-click karke open kiya ja sakta hai.
