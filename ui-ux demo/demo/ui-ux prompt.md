# 🎮 Free Fire Tournament Arena — Master UI/UX Integration Prompt v2 (Astra 6)

> **Document Type:** Master Multi-Screen Architecture & Full-Screen Mobile Refinement Prompt  
> **Target Audience:** Astra 6 / Lead Frontend Engineer / UI-UX Architecture AI  
> **Output Destination:** Standalone Connected Demo Architecture (`master_app.tsx`)  
> **Source Component:** `C:\Free Fire turnament\ui-ux demo\demo\master_app.tsx`  
> **Preview Reference:** `C:\Free Fire turnament\ui-ux demo\demo\preview_master.html`  

---

## 📋 COPY-PASTE READY MASTER PROMPT (Astra 6 Ke Liye):

```text
You are an Elite Principal UI/UX Architect and Lead Mobile Frontend Engineer specializing in high-performance esports gaming applications.

We reviewed your initial integration of the Free Fire Tournament SaaS Master App (`master_app.tsx`). The logic, state management, and bottom sheets are excellent, but there are TWO CRITICAL VISUAL & ARCHITECTURAL FLAWS that must be fixed immediately:

================================================================================
CRITICAL REFINEMENTS REQUIRED (TOP PRIORITY):
================================================================================

1. ❌ REMOVE FLOATING CARD CONTAINER → 📱 MAKE IT 100% TRUE FULL-SCREEN (EDGE-TO-EDGE):
   - What went wrong: The app is currently wrapped in an artificial desktop card:
     `<section className="h-[min(900px,calc(100vh-24px))] max-w-[430px] rounded-[26px] border shadow-2xl">` with outer padding `p-3 sm:p-6`. This looks like a small floating card on a web page with huge empty spaces on the top, bottom, and sides.
   - The Fix: Make the app TRUE FULL-SCREEN (edge-to-edge full bleed, 100vw, 100vh / min-h-screen, 0 outer margins, 0 outer padding):
     * The app shell must occupy the full viewport (`w-full min-h-screen flex flex-col`).
     * On desktop / tablets, you may restrict max-width gracefully (`max-w-md mx-auto min-h-screen w-full relative flex flex-col bg-slate-950 shadow-2xl`) OR make it full-bleed responsive, but it MUST touch top and bottom without awkward floating margins (`p-0`, `m-0`).
     * Header must sit flush at the very top edge.
     * Content must scroll smoothly with padding at the bottom for the dock (`pb-24`).
     * LoginScreen and OtpScreen must also be full-screen immersive layouts without floating outer window margins.

2. ❌ REMOVE WALLET BALANCE BADGE FROM BOTTOM NAVIGATION DOCK:
   - What went wrong: The Wallet tab button currently contains an inline balance pill `{formatINR(balance)}` which clutters the bottom dock.
   - The Fix: REMOVE the balance badge from the bottom navigation dock completely!
   - The 3-tab dock must be clean, balanced, and uniform:
     * Tab 1: Gamepad2 icon + "Tournaments"
     * Tab 2: Wallet icon + "Wallet" (NO balance badge, just clean icon & label)
     * Tab 3: User icon + "Profile"
   - Active tab indicator: Sleek Cyber Gold line (`#FFD000`) or subtle glowing pill indicator.
   - The wallet balance remains prominently and proudly displayed in the top Header (`AppHeader`) and inside the Wallet Screen itself.

3. DUAL-THEME GLASSMORPHISM INTEGRITY:
   - Dark Mode: 50% transparent frosted glass (`bg-slate-900/50 backdrop-blur-xl border-white/10`).
   - Light Mode: 25% transparent frosted glass (`bg-white/75 backdrop-blur-md border-slate-900/10`).
   - Header, match cards, bottom sheets, and the bottom dock use glassmorphism with deep ambient glows.
   - Live theme toggle (Sun/Moon) fixed neatly at the top-right.

4. PRESERVE ALL WORKING INTERACTIVE LOGIC:
   - Login → OTP (with 6-digit grid, auto-fill, timer, inline email change) → Main App.
   - Match Card click → Cupertino Quick-Join Bottom Sheet (with wallet balance check, 1-tap join, balance deduction).
   - Solid Electric Cyan (`#00C2FF`) single-accent slot progress bar (no mismatched gradients).
   - Dual Wallet ledger: Deposit Cash vs Winnings Cash, UPI quick add (+₹50, +₹100, +₹200, +₹500), instant UPI payout with validation, 1-tap UTR copy.
   - Profile with Google vs Phone auth avatar toggle, 4-stat esports career grid, 4-digit PIN security modal, Fair Play & WhatsApp support drawer, and Sign-Out confirmation modal.
   - Strict TypeScript types, zero console errors, zero syntax regressions.

Deliver the complete, updated, drop-in replacement code for `master_app.tsx`.
```
