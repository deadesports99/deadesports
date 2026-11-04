# 🧪 Module 08: App Speed, UI Snappiness & Performance Optimization

> **Target Goal:** Zero-lag UI, fast API responses, snappy transitions, and lightweight memory footprint.  
> **Target Scope:** Android Compose Renders, Backend Latency, Database Queries, Image Caching.  
> **Status:** ⏳ Testing in progress

---

### 📋 Checklist & Acceptance Criteria

- [ ] **8.1 Cold Launch & Warm Start Speed:**
  - Player app cold start: Opens login or feed screen in under 1.2 seconds.
  - Admin app cold start: Opens dashboard in under 1.2 seconds.
  - No ANR (Application Not Responding) or white screen flash.

- [ ] **8.2 Feed Scrolling & LazyColumn 60fps / 120fps Smoothness:**
  - Fast flinging and scrolling through match cards with zero dropped frames.
  - Coil image memory cache: Map banners load once and remain cached in RAM.
  - No redundant Jetpack Compose recompositions during scroll.

- [ ] **8.3 Backend API Response Time (WAN & In-Memory Cache):**
  - Cached Match Feed (`GET /api/v1/tournaments`): Responds in under 50ms (in-memory `feedCache`).
  - Wallet balance fetch (`GET /api/v1/wallet`): Responds in under 200ms.
  - Slot grid fetch (`GET /api/v1/tournaments/:id/slots`): Responds in under 200ms.

- [ ] **8.4 Memory Footprint & Leaks:**
  - App RAM usage on phone remains stable (< 150MB).
  - No memory leaks when switching tabs (Matches $\leftrightarrow$ Wallet $\leftrightarrow$ Profile) repeatedly.
  - Bitmaps and network responses properly garbage collected.

- [ ] **8.5 Pull-to-Refresh & Network Re-Fetch Smoothness:**
  - Swiping down triggers smooth spring physics.
  - Dismisses immediately upon API response without stutter.
