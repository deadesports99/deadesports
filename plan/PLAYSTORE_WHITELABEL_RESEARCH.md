# 📱 Google Play White-Label Research Findings
## Play Store Compliance, Anti-Spam Policies & White-Label Architecture (Free Fire eSports Apps)

> **Research date:** 01-Nov-2026 · **Method:** Live web research (Google Play Console Help, Android Developers Blog, CCI orders, MeitY gazette, press, legal sources)
> **Important:** Yeh ek engineering/research document hai — legal advice nahi. India me online gaming regulation rapidly change ho raha hai; kisi bhi money-based model launch karne se pehle qualified Indian gaming counsel se verify kijiye.

---

## 🎯 EXECUTIVE SUMMARY (10-second read)

1. **White-label publishing IS allowed by Google** — unhone khud ek official "Best Practices for White Label Developers" guide publish kiya hai. Recommended model: **decentralized accounts** (har client ka apna Play Console account), NOT sab apps ek account me.
2. **Repetitive Content policy ka #1 trigger:** ek jaisi apps ka mass publish + **identical metadata** (title/description/screenshots). Sabse bada documented fix: har app ki metadata me **clear differentiation** batao (kis client ke liye hai, kya unique value hai).
3. **Google detection bots:** ML-based (word embeddings on text, image understanding, static+dynamic APK analysis). Obfuscation (R8/ProGuard) bytecode hashing ko thoda confuse kar deta hai, par **semantic similarity detection se nahi bachayega** — genuine differentiation hi asli bachao hai.
4. **"Free Fire" trademark** Garena ke paas registered hai. App TITLE me "Free Fire" use karna risk hai. Safe pattern: *"Thunder eSports: Battleground Tournaments"* + **mandatory disclaimer**.
5. **🚨 CRITICAL — Real-money (entry fee + cash prize) tournaments abhi India me ILLEGAL hain:** *Promotion & Regulation of Online Gaming Act, 2025* (1 May 2026 se force me) puri tarah **online money games** (fees/stakes in expectation of winnings) par ban lagata hai — skill ya chance ka distinction nahi karta. Google ne Jan 2026 me apna RMG pilot bhi band kar diya. CCI ne WinZO case 8 Sept 2026 me close kiya. **Compliant path:** e-sport registration (Online Gaming Authority) + participation/admin-cost fees + performance-based prize money; ya free-entry/social-gaming model.
6. **CI/CD:** Gradle product flavors + Fastlane per-client lanes se 10-minute packaging 100% achievable (clients.json → matrix build → signed .aab/.apk).

---

## PILLAR 1: GOOGLE PLAY "REPETITIVE CONTENT & SPAM" POLICY

### 1.1 Policy kya kehta hai

> *"We don't allow apps that merely provide the same experience as other apps already on Google Play. Apps should provide value to users through the creation of unique content or services."* — [Google Play Developer Policy: Spam & Minimum Functionality](https://support.google.com/googleplay/android-developer/answer/9899034)

Policy ke 2 key prongs jo white-label ko touch karte hain:

| Policy | Matlab |
|---|---|
| **Repetitive Content** | "Creating multiple apps with highly similar functionality, content, and user experience." Do apps ka code/UI ek jaisa ho to violation — bina unique content ke |
| **Circumvention / Associated Accounts** | Multiple developer accounts **sirf duplicate apps distribute karne ke liye** banana — explicitly prohibited |

**⚠️ Important nuance:** Report-thread ka documented case (2025): dono apps alag DBs serve karte the, phir bhi "Repetitive Content Violation" laga. Google ka 2020 guidance: *"if your apps are designed for different purpose/database/clients, you have to point out the differences in the apps' metadata (such as the description) to help users distinguish"* — aur 2025 me strictness badh gayi. **Conclusion: metadata differentiation ab sirf ek factor hai, par UI/UX/feature differentiation bhi utna hi zaroori.**

### 1.2 Google ka OFFICIAL white-label stance ✅

Google ne ek dedicated page publish kiya hai: **[Best Practices for White Label Developers](https://support.google.com/googleplay/android-developer/answer/15884185?hl=en)** (officially welcomed model):

- **Decentralized account management (RECOMMENDED):** har client (ya client-group) ka apna alag developer account.
  - *Unmanaged:* client apne account khud manage karta hai (ideal risk isolation).
  - *Managed:* white-label dev ko admin access milta hai, par account client ke naam ka hota hai (financial-institution cases me typical).
- **Centralized (single account, sab apps ek saath):** Google isse strongly avoid karne ko kehta hai — *"policy issues with one app can negatively impact all other apps within the same account... including account suspension or even termination."*

Aapke boss demand ke hisaab se: **har client apne Play Console account me apna branded app publish karega** — yehi officially recommended decentralized model hai. ✅

### 1.3 Google ka detection kaisa kaam karta hai

**Officially disclosed (Android Developers Blog, 2017 — "AI to Fight Spam & Abuse"):**
- **Static analysis of the APK/AAB binary** — code-level analysis
- **Dynamic analysis** — runtime behavior analysis
- **Text analysis with word embeddings (neural networks)** — app metadata (title, description, keywords) semantic similarity
- **Image understanding (Google Brain)** — screenshots/icon/promo visuals similarity

**Academic literature (vahi techniques jo marketplaces use karte hain):**
- **AnDarwin** (IEEE TMC 2015): semantic clone detection — code ko *Program Dependence Graphs* me tod kar embeddings banata hai; **library code automatically remove karta hai** (matlab: Firebase/Facebook SDKs similarity score me count nahi hote — sirf YOUR app code matter karta hai). 265k apps par evaluate: cloned apps + rebranded apps detect kiye.
- **Retriever / account attribution** (ACM CCS 2020): developer-account linking — same owner ke multiple accounts identify karne ka academic framework (94% operations me undiscovered accounts mirror se milte hain). Google ka internal "associated accounts" detection isi direction me hai: **common payment card, bank account, tax/ID documents, IP, device fingerprints, certificate chains, support email, console phone number** — yeh sab account-linking signals hain.

**Practical conclusion for architecture:** Jaise hi 2 apps ek hi support email / same Play billing card / same bank account se aayi hain — LinkedIn ho jata hai. Isliye: **har client ko apna email, apna billing, apna support, apna keystore, apna Firebase/Supabase project, apna codebase checkout (ya at least flavor-conflict-free build)** dena hi sahi approach hai.

### 1.4 Kaise architect karein (bot + human review dono se bachne ke liye)

**Layer 1 — Identity isolation (REQUIRED, non-negotiable):**

| Item | Per-client unique |
|---|---|
| Play Console account | ✅ Client ka apna (name, billing card, phone, tax details) |
| Email domain | ✅ Client ka domain (nahi to support@yourcompany.com use KARNA HI NAHI) |
| Package/applicationId | ✅ `com.thunderesports.app`, `com.rajasthanff.club` etc. |
| Keystore + signature | ✅ Har client ka alag `release.jks` + alag password; konsi bhi 2 apps ka SHA-1 shared na ho |
| Firebase/Supabase project | ✅ Alag project, alag config file, alag DB instance |
| Client config | ✅ alag `clients/<client>/config.json`, resources, fonts, logo |

**Layer 2 — Code/build differentiation (RAISES effort to clone; not a magic shield):**
- **Minify + shrink:** `minifyEnabled true`, R8 shrinkResources — dead code hatao.
- **ProGuard/R8 obfuscation dictionary:** custom dictionary file (`-obfuscationdictionary`) with gaming-flavored tokens — har flavor ka apna dictionary → different DEX strings even for same logic. *Note: R8 abhi automation can rename classes/methods → bytecode level diff banta hai.*
- **BuildConfig fields / flavor dimensions per client.**
- **Resource merging:** alag colors.xml, strings.xml (app_name), themes, fonts per flavor.

**Layer 3 — Metadata differentiation (HUMAN REVIEWER + listing algorithm ke liye — sabse important documented lever):**
- **Title:** `Thunder eSports – Battle Royale Tournaments` (client-specific; "Free Fire" avoid — Pillar 3 dekho).
- **Short/Long description:** Client-specific — organization ka naam, city/community, in-app branding, support info; koi bhi 2 apps me same paragraphs na ho. **Yeh wahi fix hai jo Google ne ek actual violation case me diya tha.**
- **Icon & screenshots:** Har client ke unique icon + screenshots (alag layout themes, alag color grading, client logo).
- **Category/audience:** same audience overlap to risk badhta hai — alag states/cities/crafts ke clients better.

**Layer 4 — Functional differentiation (STAYS compliant + human review passes):**
- Screen layout variants (Pillar 2 ka design system) — Carousel vs Grid vs Cards.
- Client-specific features toggles (e.g., Squad vs 1v1 focus, language, feed sections).
- Alag backend behavior/config per tenant (tenants already in our schema ✅).

**⚠️ Red flags jo kabhi nahi karne:**
- Ek hi codebase ke 10 apps jinka sirf color/logos alag ho (classic spam pattern).
- Same metadata ke saath multiple accounts (Circumvention policy — account ban risk).
- Google Play par publish karke ranking parody ya fake engagement.
- Ek app me release ke baad remote-config se public experience ko radically badalna (Play "minimum functionality" me issue; hisaab se "app does not provide the same experience post-review" type rejections).

### 1.5 Humans for review ke liye differentiation ka bar

Google official list karta hai factors: **"unique content or services"**. Community reports se pattern:
- Ek jaisi feature list + ek jaisa UI layout + ek jaisi screenshots = HIGH RISK (flagged/removed cases documented).
- Different brand identity + client-specific store copy + UI theme/typography/layout variation + real community (ratings/comments alag hain) = PASS karta hai.
- Reviews/ratings bhi diversify hoti hain jab app kisi real community ko serve karta ho — yeh signal bhi matter karta hai.
---

## PILLAR 2: JETPACK COMPOSE WHITE-LABEL DESIGN SYSTEM

Single Kotlin codebase, ek config file switch → pura visual identity badal jaye. Industry-standard Material 3 + Compose pattern yeh hai:

### 2.1 Core architecture — `ClientConfig` data class

```kotlin
// core/src/main/java/com/ff/whitelabel/core/config/ClientConfig.kt
data class ClientConfig(
    val clientName: String,                    // "Thunder eSports"
    val applicationId: String,                 // com.thunderesports.app
    val primaryColor: Long,                    // 0xFFFF5722
    val secondaryColor: Long,
    val surfaceColor: Long,
    val gradientStart: Long,                   // brand gradient
    val gradientEnd: Long,
    val fontFamily: FontFamily,                // Rajdhani / Orbitron / Inter...
    val cornerRadius: Dp,                      // 4.dp sharp | 24.dp glassmorphic
    val componentStyle: ComponentStyle,        // SHARP / GLASSMORPHIC / PILL
    val homeFeedLayout: HomeFeedLayout,        // CAROUSEL / TWO_COL_GRID / VERTICAL_CARDS
    val logoRes: Int,
    val tagline: String,
)
```

**Kaise supply hota hai:** har Gradle flavor apna `ClientConfig` object (ya `BuildConfig.CLIENT_NAME` + `assets/clients/<name>/config.json`) provide karta hai. Ek `AppConfig.current` (singleton, flavor-compile-time) sab composables par inject hota hai via CompositionLocal.

### 2.2 Material 3 tokenization

```kotlin
// MaterialTheme colors — fully tokenized from ClientConfig
val colorScheme = lightColorScheme(
    primary = Color(config.primaryColor),
    secondary = Color(config.secondaryColor),
    surface = Color(config.surfaceColor),
    // + onPrimary, primaryContainer, etc. derived
)

// Typography — dynamic family
val typography = Typography(
    headlineLarge = TextStyle(
        fontFamily = config.fontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 34.sp,
    ),
    // ...
)

// Shapes — variant-driven
val shapes = when (config.componentStyle) {
    SHARP        -> Shapes(small = RoundedCornerShape(4.dp), medium = RoundedCornerShape(8.dp), large = RoundedCornerShape(12.dp))
    GLASSMORPHIC -> Shapes(small = RoundedCornerShape(24.dp), medium = RoundedCornerShape(28.dp), large = RoundedCornerShape(32.dp))
    PILL         -> Shapes(small = CircleShape, medium = CircleShape, large = CircleShape)
}
```

**Gradientachieve:** `Brush.linearGradient(listOf(Color(config.gradientStart), Color(config.gradientEnd)))` helper — hero cards, headers, CTA buttons ek jagah se control hote hain.

### 2.3 Component variants (sealed interface pattern)

```kotlin
sealed interface ComponentStyle {
    data object Sharp : ComponentStyle
    data object Glassmorphic : ComponentStyle
    data object Pill : ComponentStyle
}

@Composable
fun TournamentCard(tournament: Tournament, style: ComponentStyle = AppConfig.current.componentStyle) {
    when (style) {
        Sharp        -> SharpTournamentCard(tournament)       // 4dp corners, solid bg, top banner color strip
        Glassmorphic -> GlassCard(tournament)                  // 24dp radius, blur bg via Modifier.blur, translucent surface
        Pill         -> PillTournamentCard(tournament)         // full-rounded, outlined, bold typography
    }
}
```

Card/Button/Input/Sheet har ek component ka 3 variant hona enough hai — pure color-swapping spam se bach ke human reviewer ko clearly different lagega.

### 2.4 Layout swapping architecture

```kotlin
sealed interface HomeFeedLayout {
    data object Carousel : HomeFeedLayout        // horizontal pager + featured hero
    data object TwoColumnGrid : HomeFeedLayout   // LazyVerticalGrid(2)
    data object VerticalCards : HomeFeedLayout   // detailed vertical list cards
}

@Composable
fun HomeFeed(viewModel: HomeViewModel) {
    when (AppConfig.current.homeFeedLayout) {
        Carousel      -> CarouselFeed(viewModel)
        TwoColumnGrid -> TwoColumnFeed(viewModel)
        VerticalCards -> VerticalListFeed(viewModel)
    }
}
```

Screen-level variants (Home, TournamentList, Profile, Wallet) — har screen ke 2–3 layout variants banayein. Yeh **functional differentiation** Pillar 1 ke "unique experience" requirement me directly contribute karta hai.

### 2.5 Gradle Product Flavors vs Remote Config — kya use karein

| | Gradle Flavors (`flavorDimensions "client"`) | Remote Config (backend se) |
|---|---|---|
| **Kya hai** | Compile-time build matrix: `clientThunder`, `clientRajFF`... har ek apna res/applicationId/signing | Runtime theming config client ke backend se fetch hota hai |
| **Play review me risk** | LOW — har build apne aap me stable, review-time ka build = production build | HIGH agr aap isse *app identity* badalne ke liye use karo (review-testing mismatch, "different experience post-review") |
| **Clone detection** | Flavors share most code — need R8 dict + resources + variant logic to differentiate | Code 100% same hota hai — detection me worse |
| **Banane ka time** | 1 click per client par 10-min pipeline (Pillar 5) | Instant, par sirf colors/fonts tak thik |

**✅ Recommendation (Play-safe priority order):**
1. **Gradle flavors = primary mechanism** — applicationId, branding, resources, layout variant, R8 dictionary, signing. Release build me client identity **baked** ho.
2. **Remote config sirf non-structural theming** ke liye: accent color bado/shado, festival banners, strings tweaks — jo feature/identity nahi badalte.
3. **Kabhi bhi remote config se app ka "public experience" post-review radically mat badlo** — Google ise minimum-functionality/misleading listing violation maanta hai.
4. Screenshots: **flavor build me generated** (kiosk mode) — har client ke actual screenshots listing me dikhayein.

**Fonts:** bundled res (fonts/rajdhani.ttf etc. per flavor) — Play Fonts Download API (Google Fonts) bhi chalega, par offline-build determinism ke liye bundling better hai. Gaming vibes: Rajdhani/Orbitron (headings) + Inter/Poppins (body).


---

## PILLAR 3: GARENA "FREE FIRE" TRADEMARK & IP SAFETY

### 3.1 Trademark status

- **"FREE FIRE" registered trademark — Garena Online Private Limited** (e.g., US Reg. No. 6375063; Garena ke paas India aur globally bhi registrations/use hain). Garena aggressively enforce karta hai.
- Garena ke apne UGC/contest rules khud bolte hain: *"Please do not incorporate the 'Free Fire' logo or 'Free Fire' text into your design."* — brand assets simple use karne bhi allow nahi hote.

### 3.2 App naming — safe vs dangerous

| Pattern | Verdict | Reasoning |
|---|---|---|
| `XYZ Free Fire Tournament` | ❌ Risky | Trademark in app title — Google Play trademark policy me "misleading affiliation / trademark misuse" trigger; Garena complaint ka bhi risk |
| `XYZ: Tournament Hub for FF Gamers` | ⚠️ Medium | "FF" abbreviation use hota hai par title me trademark nahi — dislike policy still charges "FF" ko refer kar raha hai |
| `Thunder eSports – Battle Royale Tournaments` / `Thunder Arena` | ✅ SAFE | Full generic title; trademark sirf description me nominative reference ke tor par (ek-do baar, disclaimer ke saath) |
| `XYZ Tournaments by <Client Name>` | ✅ SAFE | App ka title client brand par ho, game mention na ho |

**Rule of thumb:** Play Store key search terms (free fire tournament, ff tournament, battle royale cash) **description me** mileage ke liye use karein (nominative fair use, disclaimer ke saath), **title me nahi**. Play policy: title app ka brand hai, generic keywords title me nahi bharne chahiye.

### 3.3 Mandatory disclaimer — exact template

Play Store listing + app me (Settings/Splash) dono me visible rakho:

> **"This is an independent, community-run tournament platform. [Client Name] is not affiliated with, endorsed by, sponsored by, or connected to Garena International, Sea Limited, or any of their affiliates. Free Fire is a trademark of Garena International Private Limited. All game-related trademarks and assets belong to their respective owners. Players must comply with the Free Fire Terms of Service and Community Guidelines."**

*(Real-world verified example: [FFC Esports community platform](https://esports.freefirecommunity.com/about/) — similar disclaimer use karta hai; aise hi structure standardized hai industry me.)*

### 3.4 Screenshots & visual assets rules

- ❌ **Never use:** official Free Fire logo, character art (Kelly, Alok, Hayato, etc.), in-game map/banner assets, official promotional screenshots in Play console graphics.
- ✅ **Use:** client-branded mockups (phone frames + custom UI screenshots of the tournament app), abstract/esports-style vector art (silhouettes, geometric battle themes, gradient explosions), CLIENT ka logo.
- Screenshots me gameplay content: community apps aksar apne UI screenshots use karte hain — agr gameplay footage dikhana hi ho to custom/watermarked + "independent platform" clear karo; safest is app-UI-only screenshots.
- Icons: client marks ya generic trophy/crosshair style — kabhi FF official icon nahi.

### 3.5 Garena ToS ka operational risk (backend/ops side)

- Free Fire ToS me third-party tournament ko expressly allow nahi karta (India ToS: users ke liye ToS compliance requirement). Real-world me community tournaments chale hue hain, par Garena game accounts par action le sakta hai agar woh "unauthorized" samjhe.
- **Mitigation:** Khel ke rules se platform level pe disclaimer (players apne accounts ki responsibility khein), Garena ke console ka official room system use karo (custom rooms jo FF me officially allowed hain), aur ek clean, kaam-kaaj wahi in-game features use karo.

---

## PILLAR 4: REAL-MONEY TOURNAMENTS — INDIA 2026 KA LEGAL LANDSCAPE (CRITICAL)

### 4.1 Timeline — kya hua (2022 → 2026)

| Date | Event |
|---|---|
| Sep 2022 | Google India pilot: sirf **DFS (fantasy) + Rummy** apps Play par. Free Fire-style skill games include NAHI |
| Jun 2023 | Pilot bada karke "more real-money games" ke liye (India/Mexico/Brazil) plans announce |
| Jul 1, 2024 | Google ka "New Approach to RMG" — policy se RMG beyond DFS/Rummy distribute ho sakta tha (bina central licensing framework ke), with **age-gating 18+, geo-gating, free to download, no Play Billing, no IAP** requirements |
| 2024–2025 | **WinZO v Google** CCI case (No. 42/2022) — Google se commitment; Google ne propose kiya: sab "self-declared permissible" real-money games + third-party skill certification (AIGF/EGF/FIFS) |
| Aug 22, 2025 | 🇮🇳 **Promotion and Regulation of Online Gaming Act, 2025 (Act 32 of 2025)** — Parliament se pass, Presidential assent |
| Jan 2026 | Google ne apna RMG pilot program + RMG advertisements **band kar diye** |
| May 1, 2026 | **Online Gaming Rules 2026** ke saath Act force me — online money games par POORA BAN |
| Sep 8, 2026 | **CCI ne WinZO case close kiya** — kyunki law ne hi RMG market khatam kar diya |

### 4.2 Act me kya hai (Section-wise, as per official text)

- **Sec 2(c) "e-sport"** (ALLOWED): organized competitive multiplayer events, recognized under *National Sports Governance Act 2025* + **registered with the Authority**, outcome purely skill (dexterity/strategy), **"may include payment of registration or participation fees SOLELY for entering the competition or covering administrative costs and may include performance-based prize money for the player"** — bets/wagers/stakes ban.
- **Sec 2(g) "online money game"** (PROHIBITED): "*any online game, irrespective of whether based on skill, chance, or both, played by a user by paying fees, depositing money or other stakes in expectation of winnings*".
- **Sec 3:** e-sport recognition & promotion. **Sec 4:** online social games (permitted, casual skill-based). **Sec 5–7:** online money game prohibition + advertisement prohibition + fund-transfer facilitation prohibition.
- **Online Gaming Authority of India (OGA)** — registration regime, Grievance Appellate Committee, penalties; MeitY nodal.
- **Supreme Court challenge pending (no stay)** — Act abhi governing law hai.

### 4.3 Aapke business model ka kya matlab (India)

| Model | Status under 2026 law |
|---|---|
| Entry fee ₹50 → prize pool ₹2400 (pooled stakes) | ❌ **Prohibited** — "online money game" (fees + expectation of winnings), irrespective of game of skill |
| Eatariat: entry-fee cash prize tournaments (jo WinZO/Gamerji abhi bhi website-only par chalate hain) | ❌ Same headed — *abhi* se bhi nahi; WinZO jaise platforms sideload the kyunki **Play par allowed hi nahi tha**, ab law bhi ban ho gayi |
| **E-sport registration path:** OGA me register + NSGA-recognized + *admin-cost-only* participation fee + performance-based prizes | ✅ **Potential compliant path** — legal counsel se diagram verify karo |
| Free-entry tournaments, coins/points leaderboards, in-app virtual rewards, no money-in money-out | ✅ **Fully compliant** — "online social game" hai |
| Withdrawal of "winnings" kisi bhi form me jo entry fees se funded ho | ❌ Prohibited (fund transfer ban) |

### 4.4 "Two-APK strategy" — ab kya status

**Past (2022–2025 ka standard industry play):** ek *free/community/points version* Play par (discovery ke liye), aur *real-money wallet version* sirf client ki website se direct download (sideload) — WinZO apne complaint me khud confirm karta hai ki yehi karta tha. Isse Play par RMG ban bypass hota tha (kyunki Play version me paisa nahi) aur Google se account-level bhi bach-te hain.

**Ab (May 2026+):** real-money version kisi bhi store/website se **law khatam kar chuka hai** na ki sirf Play policy. Do options:
1. **Agr SC Act ko strike karta hai** → 2025 ke Google commitment framework wapas aa sakta hai (self-declaration + AIGF/EGF/FIFS certification + age/geo gating). Tab two-APK strategy phir valid ho jayega. **Backend me wallet/ledger architecture banake rakho (humne Phase 1-2 me already banaya hai ✅)** — feature flag se on/off karna.
2. **Agr Act stand karta hai** → real-money model end. Product ko **e-sport registered path** ya **free/social model** me rebrand karo.

### 4.5 Agr aap Phir bhi Play par RMG publish karna chahe (jab law allow kare)

Google Play RMG requirements (policy + 2024 upd
Google Play RMG requirements (policy + 2024 update, jab applicable ho):
- ✅ Free to download; ❌ NO Play Billing, ❌ NO IAP for RMG deposits (UPI/third-party gateways use kar sakte ho)
- ✅ **18+ age gating** (Play Console me selected countries me RMG declaration)
- ✅ **Geo-gating** — sirf un states/countries me jahan legal (India me historically prohibited states: Andhra Pradesh, Assam, Nagaland, Odisha, Sikkim, Telangana; law ke according update karte raho)
- ✅ **Self-declaration** + skill-game proof (AIGF/E-Gaming Federation/FIFS certification) — Google ke 2025 commitment proposal me yaahi criteria tha
- ✅ IARC rating, responsible-gaming disclosures, user age verification UI, KYC
- Play service fee (RMG ke liye naya model — evolve hote rahega)

---

## PILLAR 5: AUTOMATED 10-MINUTE CLIENT PACKAGING PIPELINE

### 5.1 Repo layout

```text
/whitelabel-tournament
├── android/                     # Kotlin + Compose app
│   ├── app/
│   │   ├── src/main/            # shared code
│   │   └── src/clientThunder/   # flavor-specific res (brand, styles, Config)
│   ├── build.gradle.kts         # flavor matrix
│   └── version.gradle.kts
├── clients/
│   └── thunder/
│       ├── config.json          # client_name, app_id, colors, font, logo
│       ├── logo.png
│       └── release.jks          # per-client keystore (gitignored, secret-store me)
├── fastlane/
│   ├── Fastfile                 # lane: build_and_deploy
│   └── Appfile
└── .github/workflows/release.yml  # matrix CI
```

### 5.2 Gradle — dynamic flavors from clients.json

`build.gradle.kts` me config ko **generate-time** read karo (buildscript se JSON parse):

```kotlin
// invoked as: ./gradlew bundleRelease -Pclient=thunder
val clientName = providers.gradleProperty("client").get()
val cfg = json.parse(File("clients/$clientName/config.json").readText())

android {
    applicationId = cfg["application_id"]                        // com.thunderesports.app
    signingConfigs.create("release") {
        storeFile = file("clients/$clientName/release.jks")
        storePassword = System.getenv("SIGN_STORE_PASS")         // NEVER hardcode
        keyAlias = cfg["key_alias"]
        keyPassword = System.getenv("SIGN_KEY_PASS")
    }
    flavorDimensions += "client"
    // ...har client ke liye ek flavor, CI matrix se generate
    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"),
                          "clients/$clientName/r8-dict.pro")
            signingConfig = signingConfigs.getByName("release")
        }
    }
}
buildConfigField("String", "CLIENT_NAME", "\"${cfg["client_name"]}\"")
buildConfigField("Long", "PRIMARY_COLOR", cfg["primary_color"])  // 0xFFFF5722
```

### 5.3 Obfuscation — per-client R8 dictionary

```proguard
# clients/thunder/r8-dict.pro
-obfuscationdictionary dict_thunder.txt     # unique tokens: nova, blitz, hex, arena, volt...
-classobfuscationdictionary dict_thunder.txt
-packageobfuscationdictionary dict_thunder.txt
```
Har client apni **alag dictionary** → same Kotlin logic ka DEX strings/classes alag alag → naive bytecode hashing fail karta hai. (Semantic detection se nahi bachayega — isliye UI/layout variants bhi zaroori, Pillar 2.)

### 5.4 Fastlane — ek lane, sab clients

```ruby
# fastlane/Fastfile
desc "Build + sign + upload white-label client"
lane :client_release do |options|
  client = options[:client]                     # e.g. "thunder"
  gradle(tasks: ["clean", "bundleRelease"], properties: { "client" => client })
  aab_path = lane_context[SharedValues::GRADLE_ALL_AAB_OUTPUT_PATHS].first

  # upload to the CLIENT's OWN Play account (per-client credentials!)
  upload_to_play_store(
    track: "production",                        # ya internal/shared testing pehle
    aab: aab_path,
    json_key: "clients/#{client}/play-credentials.json",  # client ka API key
    release_status: "completed",
  )
end
```

### 5.5 GitHub Actions — matrix, 10 minutes target

```yaml
name: white-label-release
on:
  workflow_dispatch:
    inputs:
      clients: { description: "comma-separated", default: "thunder,rajff" }
jobs:
  build:
    strategy:
      matrix:
        client: ["thunder", "rajff"]     # or generated from input
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4       # JDK 17
      - uses: actions/cache@v4            # gradle cache
      - run: ./gradlew bundleRelease assembleRelease -Pclient=${{ matrix.client }}
        env:
          SIGN_STORE_PASS: ${{ secrets[format('{0}_STORE_PASS', matrix.client)] }}
          SIGN_KEY_PASS:   ${{ secrets[format('{0}_KEY_PASS', matrix.client)] }}
      - uses: actions/upload-artifact@v4  # signed release.aab + release.apk
```

**10-min target:** Gradle config-cache + parallel matrix runners + pre-warmed deps + signing AAB once. Har client ka signed `.aab` ~3-5 min me ready.

### 5.6 Secrets & security checklist

- Keystores/keys/passwords: **kabhi repo me nahi** — per-client GitHub secrets (naming `THUNDER_STORE_PASS`...), 1Password/SOPS for production.
- Har client ka **Play Console API json_key** alag.
- `.gitignore`: `clients/*/release.jks`, `clients/*/play-credentials.json`, `*.keystore`.
- **VersionCode per client monotonic** (har account ki apni release stream), ya CI timestamp-based.

---

## ✅ RECOMMENDED ACTION PLAN

1. **Identity isolation:** har client = alag Play Console account + alag email/domain/billing + alag keystore + alag Firebase/Supabase project — Google ka official decentralized model (backend already multi-tenant hai ✅).
2. **Design system:** Android/Kotlin phase me ComponentStyle (Sharp/Glass/Pill) + layout variants (Carousel/Grid/List) — Pillar 2 ka pattern ready rakhna.
3. **Listing kit:** title pattern `Thunder eSports – Battle Royale Tournaments`, disclaimer template, custom artwork guidelines — client aate hi 10-min listing.
4. **🚨 Legal gate:** India me entry-fee + cash-prize tournaments abhi banned (Online Gaming Act 2025, force 1 May 2026). Backend wallet/ledger architecture future-proof hai; launch abhi free-to-play + points par karo, SC ruling track karo, Indian gaming counsel se e-sport registration path verify karwao.
5. **CI/CD skeleton** Android repo banate hi add karna.

---

## 🔗 KEY SOURCES

- Google Play Console Help — [Best Practices for White Label Developers](https://support.google.com/googleplay/android-developer/answer/15884185?hl=en)
- Google Play Developer Policy — [Spam / Repetitive Content](https://support.google.com/googleplay/android-developer/answer/9899034), [Real-Money Gambling, Games & Contests](https://support.google.com/googleplay/android-developer/answer/9877032?hl=en), [DFS & Rummy Pilot (India)](https://support.google.com/googleplay/android-developer/answer/14083159)
- Android Developers Blog — [A New Approach to Real-Money Games on Google Play (Jan 2024)](https://android-developers.googleblog.com/2024/01/a-new-approach-to-real-money-games-on-google-play.html)
- Google Research — [ML to Fight Spam and Abuse at Scale (2017)](https://research.google/blog/app-discovery-with-google-play-part-3-machine-learning-to-fight-spam-and-abuse-at-scale/)
- AnDarwin (IEEE TMC 2015) — [Scalable Detection of Android Application Clones](https://doi.org/10.1109/tmc.2014.2381212) · Retriever (ACM CCS 2020) — [Attribution in Mobile Markets](https://dl.acm.org/doi/10.1145/3372297.3417281)
- TechCrunch (Jul 2025) — [Google proposes opening Play to more RMG in India](https://techcrunch.com/2025/07/30/google-proposes-to-open-play-store-to-more-real-money-games-in-india/)
- [Promotion & Regulation of Online Gaming Act, 2025 — IndiaCode](https://upload.indiacode.nic.in/view-casepdf?id=AC_CEN_45_0_00004_2025-32_1778133559220&type=act) · [Online Gaming Rules 2026 — MeitY](https://www.meity.gov.in/static/uploads/2025/10/18bae7782749f36ebb062fdb0b2607ea.pdf)
- PIB — [Online Gaming Rules 2026 in force 1 May 2026](https://www.pib.gov.in/PressReleasePage.aspx?lang=2&PRID=2256973&reg=3)
- Business Standard (8 Sep 2026) — [CCI closes Google RMG inquiry](https://www.business-standard.com/industry/news/cci-closes-antitrust-inquiry-against-google-over-real-money-gaming-apps-126090801736_1.html) · [CCI order, Case 42/2022](https://www.cci.gov.in/antitrust/orders/details/1285/0)
- Justia — [FREE FIRE trademark (Garena, Reg. 6375063)](https://trademarks.justia.com/792/81/free-79281413.html) · [Garena UGC/Community Standards](http://content.garena.com/legal/ugc/ugc-EN.html) · [Free Fire India ToS](https://content.garena.com/legal/tos/india_tos_en.html)
- Community reference — [FFC Esports disclaimer pattern](https://esports.freefirecommunity.com/about/)
- Play Console Help — [RMG & Contests policy detail](https://support.google.com/googleplay/android-developer/answer/9877032?hl=en)

> **⚠️ Disclaimer:** Policies saal-dar-saal update hoti hain; 2026 me Online Gaming Act ke Supreme Court verdict par poora RMG framework depend karta hai. Production deployments se pehle fresh verify karein.
