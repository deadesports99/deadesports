# 📱 Master Deep Research Prompt
## Google Play Store Compliance, Anti-Spam Policy & White-Label Architecture for Free Fire eSports Apps

```text
You are a Senior Google Play Policy Specialist, Android Legal Compliance Counsel, and Lead Mobile Architect specializing in White-Label Android Applications and Real-Money eSports Tournament Platforms in India.

I am developing a white-label Free Fire Tournament platform built with Native Android (Kotlin + Jetpack Compose) and a Node.js/TypeScript (Supabase & Firebase) backend.
Our business model is selling this system to multiple clients (Tournament Organizers). Each client will receive their own branded Android APK to publish on their own Google Play Console developer account.

We need a comprehensive, highly technical, and policy-accurate Deep Research investigation into how to design, brand, obfuscate, and configure the Kotlin codebase so that every client’s app looks completely unique, functions uniquely, and 100% passes Google Play Store Review without triggering rejections or suspensions.

Conduct an in-depth research analysis and answer the following 5 critical pillars:

---

### PILLAR 1: GOOGLE PLAY "REPETITIVE CONTENT & SPAM" POLICY EVASION & COMPLIANCE
Google Play Developer Program Policies explicitly state: "We don't allow apps that merely provide the same experience as other apps already on Google Play." (Minimum Functionality & Repetitive Content Policy).
1. How does Google's automated APK/AAB static analysis bot detect white-label clones (Bytecode hashing, resource similarity, layout tree similarity, manifest fingerprinting)?
2. How to architect the Kotlin + Jetpack Compose codebase to prevent bot detection:
   - Unique Application IDs, package name structures, and manifest variations.
   - ProGuard / R8 code shrinking and aggressive dictionary-based obfuscation to produce completely distinct DEX bytecode for each client build.
   - Separate Keystores, signing certificates, and build hashes.
3. What degree of UI and layout differentiation is required to pass human reviewer scrutiny?

---

### PILLAR 2: JETPACK COMPOSE DYNAMIC WHITE-LABEL DESIGN SYSTEM
How to architect a single Kotlin codebase where switching a single configuration file changes the entire visual identity:
1. Material 3 & Jetpack Compose Dynamic Theming:
   - Complete tokenization of ColorScheme (Primary, Secondary, Surface, Gradients).
   - Component variant toggles (e.g., Client A uses Sharp 4dp corner cards, Client B uses Glassmorphic 24dp rounded cards, Client C uses Pill-shaped outlined buttons).
   - Dynamic Typography (Inter, Poppins, Outfit, Rajdhani, Orbitron gaming fonts).
2. Layout Swapping Architecture:
   - How to build composable screen variants (e.g., Home Screen Feed: Carousel Layout vs 2-Column Grid vs Vertical Detailed Cards) controlled via a client config or build flavor.
3. Android Gradle Product Flavors vs Remote Config Theming:
   - Compare Gradle Flavors (`flavorDimensions "client"`) vs Dynamic Remote Config loaded from the backend. Which is safer for Play Store approval?

---

### PILLAR 3: GARENA FREE FIRE TRADEMARK & INTELLECTUAL PROPERTY (IP) SAFETY
Garena aggressively protects the "Free Fire" trademark and in-game assets.
1. What naming conventions are strictly compliant with Google Play Trademark Policy?
   - Can the app be called "XYZ Free Fire Tournament"? (No - explanation of "XYZ: Tournaments for FF" or community naming guidelines).
2. Safe app store listing guidelines:
   - App title, Short description, and Long description phrasing.
   - Mandatory legal disclaimer format: "This is an independent community tournament platform and is not endorsed by or affiliated with Garena..."
3. Screenshots & Visual Assets:
   - Rules against using official Free Fire game logos, characters (Kelly, Alok, Hayato), and game banners in Play Store promo graphics. What custom illustration styles or silhouettes must be used instead?

---

### PILLAR 4: REAL-MONEY TOURNAMENTS VS GOOGLE PLAY GAMING POLICY IN INDIA
Google Play has strict policies regarding real-money entry fees, cash prizes, and payment gateways.
1. How do leading Indian esports apps (WinZO, Khiladi Adda, Tournafest, Gamerji, Battlemania) navigate Google Play:
   - Does Google Play allow apps with entry fees and cash prizes under India's "Game of Skill" legal framework?
   - The "Two-APK Strategy": Explain how companies host a "Free Community / Points Version" on Google Play Store (for discovery/downloads) and provide the "Pro Real-Money Wallet APK" via direct download from the client's website.
   - If attempting to publish the real-money wallet version directly on Play Store: What self-declarations, payment gateway restrictions (Google Play Billing vs Third-Party UPI), and Indian state geofencing (blocking Assam, Odisha, Telangana, Andhra Pradesh, Nagaland, Sikkim) are required?

---

### PILLAR 5: AUTOMATED 10-MINUTE CLIENT PACKAGING PIPELINE (CI/CD)
Provide an exact blueprint for a Gradle / Fastlane build pipeline where our team can input:
- `client_name`: "Thunder eSports"
- `application_id`: "com.thunderesports.app"
- `primary_color`: "#FF5722"
- `font_family`: "Rajdhani"
- `logo_path`: "clients/thunder/logo.png"
- `client_keystore`: "clients/thunder/release.jks"

And the system automatically compiles, optimizes, obfuscates, and exports a unique, signed `release.aab` and `release.apk` ready for Google Play upload within 10 minutes.
```
