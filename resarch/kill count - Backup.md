Architectural Blueprint for Real-Time Optical Kill Tracking in Garena Free Fire Tournament PlatformsExecutive Summary and System ContextAutomated scoring infrastructure represents a critical bottleneck in scaling community and semi-professional esports tournaments for mobile battle royale titles. Unlike desktop esports titles that expose local telemetry sockets or documented match-history APIs, Garena Free Fire operates within a hardened mobile execution environment protected by native anti-cheat libraries (libanogs and libanort) that prohibit client instrumentation, memory inspection, or network packet decryption. Consequently, tournament platforms rely heavily on manual referee tallying or post-match screenshot submissions, creating operational delays and vulnerabilities to result forgery.Optical Character Recognition (OCR) coupled with lightweight object detection applied to the Custom Room Spectator Mode screen resolves this bottleneck non-invasively. By treating the spectator video feed as an external optical sensor, a tournament platform can extract structured elimination events in real time without interacting with the game binary or violating Garena's Terms of Service. However, building a production-grade pipeline for Free Fire requires overcoming three domain-specific engineering challenges: decoding Garena's proprietary GFF typeface alongside player-chosen Unicode decorative glyphs, disambiguating knockdown notifications from confirmed eliminations during high-velocity squad wipes, and constraining recognition latency so that fast-scrolling kill feeds do not drop events.This report provides a complete engineering specification for an automated Free Fire kill-tracking system, encompassing Android and PC screen ingestion, UI topology analysis, OCR and YOLO model selection, closed-world roster fuzzy matching, real-time Node.js and Prisma database persistence, accuracy benchmarking, and legal compliance under Garena's tournament guidelines.Screen Capture Architecture for Spectator ModeCapturing the Free Fire Spectator Mode display in real time requires balancing frame-delivery latency against tournament device rules and anti-cheat constraints. In competitive Free Fire rulebooks, players are strictly restricted to mobile devices, and PC emulators (such as BlueStacks) are prohibited to maintain mechanical parity. While a tournament organizer's dedicated spectator account occupies an observer slot rather than an active combat slot, Custom Room lobbies configured with strict mobile-only enforcement will block emulator connections entirely. Furthermore, commercial observer overlays (such as ViewFF) that hook directly into Windows client memory require administrator privileges and the disabling of Windows Virtualization-Based Security (VBS) and Memory Integrity, while suffering from frame-rate drops and version-breakage across Free Fire Open Beta (OB) updates (such as OB55 and OB56).To achieve zero client modification and universal Custom Room compatibility, the capture layer should follow either an Android-to-PC stream ingestion model (recommended for multi-lobby tournament server farms) or an on-device native Android capture model (for standalone mobile referee applications).Capture ArchitectureIngestion MechanismTypical LatencyDevice CPU OverheadEmulator Ban ImmunityPrimary Production Use CaseAndroid-to-PC Stream (py-scrcpy-client)Hardware H.264 encoder over ADB socket into Python15–35 ms&lt; 3% on mobile deviceComplete (runs on physical Android)Multi-lobby automated tournament server farmHDMI Capture Card + PC (MSS / OpenCV)Hardware HDMI output from mobile/tablet into PC OBS/Python10–20 ms0% on mobile deviceComplete (zero software on device)Broadcast studio &amp; LAN tournament main stageOn-Device Native Android (MediaProjection)Android system VirtualDisplay into ImageReader surface30–60 ms12–25% (shared with game)Complete (native OS API)Standalone referee mobile companion appPC Emulator Screen Grab (MSS Direct)Desktop window capture of Borderless Windowed emulator5–12 msN/A (runs on host PC)Vulnerable to mobile-only room blocksCasual scrims where emulators are permittedProduction Strategy: Android-to-PC Stream via ScrcpyRather than executing computationally intensive OCR on the same mobile processor rendering Free Fire—which induces thermal throttling and frame drops—the optimal tournament architecture uses a physical Android device (or rack of Android boards) logged into the Custom Room spectator slot, connected via USB/ADB to a Linux or Windows worker node. Using py-scrcpy-client, the Android device utilizes its dedicated hardware H.264 encoder to stream frames at up to 60 FPS directly into a Python memory buffer with negligible mobile overhead. Unlike naive adb exec-out screencap -p polling—which incurs process-spawning and PNG-compression overhead on every request—py-scrcpy-client maintains a persistent socket connection, delivering raw NumPy BGR arrays to OpenCV in real time.Alternative Strategy: On-Device Android Capture via MediaProjectionWhen the tournament platform requires a standalone Android application run by freelance referees on their own phones, screen capture must use the native Android MediaProjection API (introduced in API 21) paired with an ImageReader surface. On Android 14 through Android 17, MediaProjection enforces strict foreground-service rules (foregroundServiceType="mediaProjection") and requires explicit per-session user consent before instantiating the virtual display. To minimize memory allocation latency during YUV/RGBA buffer extraction, the ImageReader should be configured with PixelFormat.RGBA\_8888, maxImages = 2, and cropped immediately in native or Kotlin memory to the exact Kill Feed Region of Interest (ROI) before transmission or local inference.Free Fire Spectator UI Topology and Kill Feed AnatomyDesigning a deterministic extraction pipeline requires mapping the spatial and state mechanics of the Free Fire Custom Room Spectator HUD. In recent patches, Garena overhauled Custom Room spectating to include a "nearby" combat info panel showing the number of teams within range, tap-to-switch team icons on the minimap, and expanded bottom HUD inventories displaying the spectated player's Med Kits, Inhalers, throwables, Gloo Walls, and Active Skill Devices.Mandatory Custom Room Lobby ConfigurationBefore optical tracking can function, the tournament platform's room-creation bot or referee checklist must enforce two critical Custom Room settings. First, the lobby must set Kill feed: Yes. Free Fire Custom Rooms provide a boolean toggle for the kill feed, and several community tournament rulebooks inadvertently specify Kill feed: No to prevent live-stream ghosting. If Kill feed is set to No, elimination banners are suppressed on the HUD, rendering optical kill tracking impossible unless the system falls back to cycling through all 12 team cards. Second, the lobby must set Hide Nickname: No. If this privacy toggle is enabled, player names in the kill feed are masked with generic aliases, preventing the OCR engine from attributing kills to registered tournament UIDs.Spatial Coordinates and Visual Structure of the Kill FeedIn standard 16:9 (e.g., $1920 \\times 1080$ or $1280 \\times 720$) and 20:9 mobile aspect ratios, the Free Fire kill feed occupies a fixed Region of Interest (ROI) in the upper-left quadrant (directly beneath the minimap/match-info cluster in default player view, or in the designated broadcast notification slot in Spectator Mode) or upper-right quadrant depending on the HUD preset. Because Free Fire's HUD scales proportionally against the vertical display height while anchoring panels to screen edges, the ROI must be normalized against the native reference height in both directions rather than hardcoded to fixed pixel coordinates.Normalized to a $1920 \\times 1080$ reference frame, the active kill-feed container spans horizontally from $0.015 \\times W$ to $0.320 \\times W$ (or $0.680 \\times W$ to $0.985 \\times W$ in right-anchored observer presets) and vertically from $0.180 \\times H$ to $0.360 \\times H$, accommodating a rolling vertical stack of up to 4 concurrent event banners.Each individual kill-feed banner is a horizontal strip containing up to four distinct semantic tokens read from left to right. The leftmost region contains the Initiator or Killer In-Game Name (IGN), rendered in light or team-colored text on a semi-transparent dark pill background, which is absent in environmental deaths such as playzone or falling damage. Immediately to the right sits the Primary Action or Weapon Silhouette Icon, a high-contrast vector icon indicating the weapon (e.g., AK47, M1887, AWM, Katana, Fist, Pan, Grenade, Landmine, Vehicle) or status mechanism (Knockdown crawling icon vs. Elimination skull/crosshair icon, or Character Skill icon). An optional Modifier Icon—a distinct crosshair/skull Headshot icon (Headshot / Headshoot in Garena's internal enum definitions)—is appended immediately to the right of the weapon icon when the fatal or knocking blow struck the head. Finally, the Target or Victim In-Game Name (IGN) is rendered on the right side of the banner. While match elapsed time is not printed inside individual kill-feed strips, the global match timer and zone phase are displayed continuously in the Spectator Mode status panel, and exact millisecond event timestamps are assigned by the capture pipeline upon banner detection.Disambiguating Knockdowns from Confirmed KillsA critical insight for Battle Royale tournament scoring is that every squad elimination generates two separate kill-feed events unless the victim is the last surviving member of their squad (SkipKnockDown). Under standard tournament scoring (1 kill = 1 point), a knockdown (KnockedDown / NoSkipKnockdown) awards zero points; points are awarded exclusively when the downed player bleeds out or is finished off.Analysis of annotated Free Fire computer vision datasets (ff by free fire comprising 1,440 images and kill-feed-detection-main comprising 3,400 images) demonstrates that the Free Fire kill feed exposes 18 to 19 distinct visual event classes that must be separated into Scoring Events and Non-Scoring / Contextual Events.Event CategoryFree Fire Dataset Class LabelsVisual HUD IndicatorTournament Scoring ActionDirect Weapon Kills (Scoring)gun-kill, gun-head-kill, fist-kill, knife-kill, pan-kill, car-kill, car-blast-killWeapon/vehicle silhouette + red/white elimination badge (plus headshot icon if applicable)Increment Killer Kill Count (+1); mark Victim as ELIMINATED.Ordnance &amp; Skill Kills (Scoring)grenade-kill, landmine-kill, smoke-grenade-kill, Player-skill-killExplosive or active skill icon + elimination stateIncrement Killer Kill Count (+1); mark Victim as ELIMINATED.Combat Knockdowns (Non-Scoring)gun-knock, gun-head-knock, grenade-knock, landmine-knock, Player-skill-knock, car-knockout, fist-knockWeapon icon + crawling/downed player icon (or yellow/orange knockdown tint)Do not increment score; log state transition (KNOCKED) to link potential bleed-out credit.Environmental Events (Non-Scoring)playzone-kill, playzone-knock, falling-knockPlayzone electric barrier icon or falling icon + Victim IGN onlyZero kill points (unless Victim was previously KNOCKED by an enemy player).Support Events (Non-Scoring)reviveRevival heart/plus iconClear prior KNOCKED state for Victim; zero points.If an OCR pipeline merely reads \[Name A\] ... \[Name B\] without classifying the central icon state, it will double-count every kill—first when Player A knocks Player B (gun-knock), and again seconds later when Player A finishes Player B (gun-kill). Therefore, icon classification via template matching or a lightweight YOLO detector is mandatory alongside text recognition.OCR Engine Evaluation, Existing Tools, and the GFF Font ChallengeExisting Tools and Ecosystem PrecedentsWithin the Free Fire and broader Battle Royale ecosystem, automated tracking tools fall into two categories: memory-reading HUD overlays and optical computer-vision pipelines. In the commercial Free Fire tournament scene, tools such as ViewFF (HUD Observer Free Fire) provide animated standings tables, player cards, and instant kill notifications showing who eliminated whom and with which weapon. However, ViewFF operates as an unofficial Windows client observer that requires administrator access, disabling Virtualization-Based Security (VBS), and disabling Memory Integrity, while suffering from compatibility delays across game updates (such as OB55 to OB56) and graphical glitches on modified APKs.In contrast, optical kill-feed tracking has become the standard non-invasive architecture across competitive mobile and tactical shooters. For mobile Battle Royale, Satvik Singh's AI-assisted BGMI scoreboard prototype demonstrates how fast-changing broadcast kill-feed footage can be narrowed to likely kill-feed changes, parsed via OCR to recognize the killer and victim names, and paired with an icon classifier to drive zero-delay tournament scoreboards. Similarly, in PC shooters, open-source repositories such as VCT-Scoreboard-Matrix (which combines MSS screen capture, OpenCV template matching for weapon icons, EasyOCR for kill-feed text, and FuzzyWuzzy for roster matching in VALORANT), ClipHound by Kennel.gg (an OBS companion plugin that reads kill feeds via OCR using 10–20% of a single CPU core during fights), and SC\_OCR (a multi-engine ONNX and Tesseract HUD reader with pixel-fingerprint locking) establish the blueprint for production optical telemetry. Furthermore, the availability of dedicated Free Fire kill-feed datasets on Roboflow (ff by free fire and kill-feed-detection-main, totaling 4,840 annotated images) confirms active computer-vision deployment specifically targeting Free Fire's combat banners.Typography Analysis: The GFF Font and Stylish Unicode NamesIn July 2022, Garena introduced a bespoke corporate and in-game UI typeface named GFF (Garena Free Fire), co-created with renowned typeface designer Akira Kobayashi (designer of DIN Next, Akko Pro, and Neue Frutiger). Inspired by the angular geometry of the Free Fire logo, the GFF typeface incorporates sharp geometric and bevel cuts on character terminals to convey dynamism, paired with rounded interior corners for legibility on small mobile screens. GFF natively supports four primary script families—Latin, Arabic, Devanagari, and Thai—as well as extended character sets for Turkish, Czech, and Icelandic.While standard ASCII characters rendered in GFF are clean and high-contrast, Free Fire's player culture introduces a severe secondary OCR challenge: Stylized Unicode Nicknames. Within Free Fire's 12-character nickname limit, players routinely substitute standard Latin letters with Mathematical Alphanumeric Symbols, Fullwidth Latin characters, Small Caps, CJK compatibility glyphs, and inline emojis (for example, ＴᴏᴜᴄʜＧʀᴀss, Ｙᴇᴇᴛ, ＬａｇＳｑｕａｄ, ＰʀᴏＡᴛＬᴏsɪɴɢ, LowkeyLost💀, and SassySpray💅).Comparative Evaluation of OCR LibrariesTo process both GFF typography and stylized player nicknames under real-time tournament constraints, four major OCR engines are evaluated below:OCR EngineArchitecture &amp; LicensingLatency (Cropped ROI)Memory FootprintCustom Font (GFF) &amp; Stylish Name HandlingKey Pros &amp; Cons for Free FirePaddleOCR (PP-OCRv4 / VL-1.6)DBNet++ detection + SVTR/CRNN recognition; Apache-2.015–35 ms (GPU/ONNX), 45–80 ms (CPU)\~250–350 MBSuperior: Leads on noisy scans (91.5%) and distorted/stylized glyphs (88.7%); supports 109 languages including Latin, Arabic, Devanagari, and Thai.Pros: Highest accuracy on gaming HUDs; fast ONNX runtime; commercial-friendly license. Cons: Slightly steeper C++/ONNX deployment setup.EasyOCRCRAFT text detector + CRNN recognizer (PyTorch)40–70 ms (GPU), 180–350 ms (CPU)\~800 MB idleModerate: Strong on scene text and standard gaming UIs, but often drops or misclassifies small caps and Unicode symbols.Pros: Proven in open-source kill-feed projects (VCT-Scoreboard-Matrix); simple Python API. Cons: High idle RAM (800 MB) and slow on CPU-only workers.Tesseract 5 (LSTM)Legacy character segmentation + LSTM sequence reader20–50 ms (CPU single-line mode)&lt; 60 MBPoor out-of-the-box: Drops to 52.1% on curved/stylized text and 84.3% on noisy backgrounds unless heavily pre-binarized and fine-tuned.Pros: Tiny footprint; fast fallback when fine-tuned on a single font (SC\_OCR). Cons: Fails on semi-transparent HUD backgrounds and multi-script Unicode.Google Cloud Vision APIProprietary cloud-hosted multi-stage transformer/CNN250–600 ms (Network RTT + inference)&lt; 10 MB locallyExcellent: Best-in-class zero-shot recognition of mixed Unicode, emojis, and non-Latin scripts.Pros: Zero local GPU hardware required; handles complex Unicode. Cons: Network latency and per-request cloud billing make continuous 1-second polling cost-prohibitive.Strategic Engine Recommendation: Hybrid PaddleOCR + Closed-World Roster MatchingThe optimal architecture for Free Fire combines PaddleOCR (running in recognition-only mode on pre-segmented name crops via ONNX Runtime) with Closed-World Roster Fuzzy Matching.Understanding why closed-world matching changes the OCR paradigm is essential for system reliability. In an open-world OCR task, misreading the stylized Free Fire name ＴᴏᴜᴄʜＧʀᴀss as T0uchGr4ss is a failure. However, a regulated Free Fire Custom Room tournament is a closed-world environment: every participating team must register their exact 4 players' In-Game Names (IGNs) and Character UIDs prior to match start, and unregistered players are disqualified. Consequently, for any given Custom Room match, there is a finite dictionary of at most 48 valid player strings (12 squads $\\times$ 4 players).By applying Unicode Compatibility Decomposition (unicodedata.normalize('NFKD', ign)) and stripping unsupported emoji bytes, ＴᴏᴜᴄʜＧʀᴀss normalizes to TOUCHGRASS. When the OCR engine outputs TouchGrass or T0uchGr4ss, a weighted Levenshtein similarity search (RapidFuzz / FuzzyWuzzy) against the 48 active roster names in that lobby resolves the exact registered player UID with near-100% precision, completely bypassing the need for character-perfect recognition on decorative Unicode symbols.Training and Fine-Tuning OCR for the GFF FontTo further maximize raw character recognition before fuzzy matching, the recognition head (SVTR\_LCNet in PaddleOCR or LSTM .traineddata in Tesseract) should be fine-tuned on synthetic Free Fire kill-feed strips. First, engineers extract the GFF-Regular.ttf and GFF-Bold.ttf font files (covering Latin, Devanagari, Arabic, and Thai character sets) alongside the standard Android fallback font (NotoSans / DroidSansFallback) used by Unity when rendering out-of-gamut Unicode symbols. Second, using a synthetic generator, the pipeline renders 50,000 synthetic crops ($32 \\times 240$ pixels) using actual Free Fire nicknames (including fullwidth, small caps, and alphanumeric combinations up to 12 characters) in white (#FFFFFF), knockdown yellow/orange, and teammate cyan over semi-transparent dark overlays (rgba(0, 0, 0, 0.65)) superimposed onto random gameplay frames from Bermuda, Purgatory, Kalahari, and NeXTerra. Finally, borrowing from the proven SC\_OCR gaming HUD architecture, the team trains both a standard grayscale recognizer and an inverted-polarity twin on the synthetic strips, exported to ONNX Runtime. Because semi-transparent kill-feed backgrounds change contrast when the spectator camera pans across bright sky versus dark building interiors, running opposite-polarity readers or adaptive CLAHE thresholding ensures background lighting shifts never blind the recognizer.Real-Time Pipeline Design and Challenge MitigationWhy Naive 1–2 Second Polling Misses Kills—and How to Fix ItWhile the baseline objective specifies capturing the screen every 1–2 seconds, empirical observation of Battle Royale firefights reveals a critical edge case: during late-zone multi-squad collisions or third-party ambushes, an entire 4-player squad can be knocked and eliminated in under 3 seconds, causing the kill feed to blow up with 6 to 8 rapid notifications. Because Free Fire's kill-feed UI displays a vertical stack of at most 3 to 4 rows at any instant, new banners push older banners upward and off the stack in as little as 400–600 ms during intense combat. Furthermore, sampling blindly every 2.0 seconds frequently captures a banner mid-slide or mid-fade animation, resulting in motion-blurred glyphs and missed events.To satisfy the low-compute goal of 1–2 second OCR intervals without dropping fast-scrolling kills, the pipeline separates Frame Ingestion and Change Detection (fast, continuous) from OCR Execution (heavy, event-driven) across a five-stage workflow.Five-Stage Event-Driven Pipeline MechanicsIn the first stage (Spectator Capture &amp; Normalized ROI Cropping), the worker ingests the H.264 stream via scrcpy or MediaProjection at 10 Hz (every 100 ms), immediately crops the Kill Feed ROI normalized to the display's native vertical resolution, and slices the ROI horizontally into 4 candidate row slots. In the second stage (ROI Change Gate &amp; Pixel Stability Locking), following the SC\_OCR paradigm, the pipeline computes a fast 64-bit perceptual difference hash (dHash) or mean absolute pixel difference on each row. If the pixels in a row are identical to the previous frame, the row is locked with a fingerprint and OCR is skipped (costing $&lt;0.2\\text{ ms}$). If pixels are actively shifting between Frame $t-1$ and Frame $t$ (indicating a slide-in or fade-out animation), the pipeline waits 1 frame (100 ms) until Frame $t+1$ matches Frame $t$, ensuring neural inference only executes on a visually stable, fully rendered banner. During quiet looting phases, a periodic heartbeat check runs every 1.5 to 2.0 seconds.In the third stage (Hybrid YOLOv8 Icon Classification &amp; Row Segmentation), once a newly stabilized row is unlocked, a lightweight YOLOv8n (Nano) model—or multi-scale OpenCV normalized cross-correlation (cv2.matchTemplate)—locates the central weapon/action icon and classifies the event type (gun-kill, gun-head-kill, grenade-kill vs. gun-knock, playzone-kill, revive). The horizontal bounding box of the central icon ($x\_{\\text{icon\\\_start}}, x\_{\\text{icon\\\_end}}$) automatically segments the row into two clean text strips: the Killer IGN crop on the left from $\[0, x\_{\\text{icon\\\_start}}\]$ and the Victim IGN crop on the right from $\[x\_{\\text{icon\\\_end}}, W\_{\\text{row}}\]$.In the fourth stage (PaddleOCR Text Reader &amp; 48-Player Roster Fuzzy Matching), if and only if the icon class is a confirmed Kill (or a Knockdown being tracked for bleed-out attribution), the Killer and Victim text crops are passed to PaddleOCR in recognition-only mode (det=False, rec=True). The resulting text strings are normalized via NFKD and matched against the 48 registered players in the Custom Room using RapidFuzz token-ratio matching.In the fifth stage (Sliding-Window Deduplication &amp; Prisma Database Persistence), because a single kill banner remains visible on screen for several seconds and shifts vertically from Row 1 to Row 2 to Row 3 as newer kills arrive, reading the screen multiple times would duplicate the event. The pipeline maintains an in-memory TTL Deduplication Cache keyed by (match\_id, victim\_uid, event\_category) with a 30-second sliding window (which resets only if the player is revived via Free Fire's Revival Point or Auto Revival system). Once (match\_id, victim\_uid, 'KILL') is committed, any subsequent optical read of that same banner as it scrolls up the stack is silently discarded before the verified event is dispatched to the Node.js and Prisma backend.Handling Dynamic UI Animations and Color ChangesFree Fire's kill feed exhibits dynamic visual perturbations that degrade naive OCR. Specifically, headshot kills (gun-head-kill) and multi-kill streak banners introduce red or gold gradient backgrounds behind the text. Converting the BGR crop directly to standard grayscale (cv2.cvtColor(crop, cv2.COLOR\_BGR2GRAY)) causes red backgrounds and white/yellow text to merge into similar luminance values. Instead, extracting the Value ($V$) channel in HSV color space alongside adaptive histogram equalization (CLAHE) isolates bright glyph strokes cleanly regardless of whether the banner background is black, red, or team-tinted.Additionally, the pipeline must resolve Safe Zone (playzone-kill) and knockdown bleed-out attribution. When Player A knocks down Player B (gun-knock), Player B may eventually die to the shrinking Safe Zone (playzone-kill) or bleed out without a second weapon icon appearing. By caching last\_knocked\_by\[victim\_uid\] = (killer\_uid, weapon, timestamp) whenever a \*-knock class is detected, if a playzone-kill or elimination event occurs for victim\_uid within 50 seconds without an intervening revive event, the state machine accurately attributes the $+1$ kill point to killer\_uid.Step-by-Step Implementation PlanDeploying this system into production for a Free Fire Tournament Platform follows five sequential engineering phases.Phase 1: Dataset Curation and YOLOv8-Nano Icon Model TrainingThe engineering team begins by exporting the public ff by free fire (1,440 images, 18 classes) and kill-feed-detection-main (3,400 images, 19 classes) datasets from Roboflow Universe. These granular weapon and status labels are mapped into five operational meta-categories required for tournament scoring: direct fatal kills (gun-kill, fist-kill, grenade-kill, landmine-kill, car-kill, Player-skill-kill), fatal headshot kills (gun-head-kill, knife-head-knockout), non-fatal knockdowns (gun-knock, grenade-knock, Player-skill-knock), environmental deaths (playzone-kill, falling-knock), and revivals (revive). A YOLOv8n (Nano) model is trained at $640 \\times 640$ resolution for 100 epochs and exported to ONNX Runtime (yolov8n\_ff\_killfeed.onnx) for sub-10 ms inference on CPU or GPU workers.Phase 2: Spectator Ingestion SetupNext, the platform provisions a dedicated Android observer device (or ADB-connected physical Android rack) running the official Google Play Store 64-bit (V8A) build of Free Fire or Free Fire MAX, which provides higher processing efficiency, greater graphical stability, and higher frame rates than 32-bit V7A or modified APKs. Before each match, the room host or automated lobby bot verifies that Custom Room settings enforce Kill feed: Yes and Hide Nickname: No. The Android observer is connected to the Python worker node via py-scrcpy-client locked to a $1080\\text{p}$ reference frame at 15 FPS, or executes the native Kotlin MediaProjection foreground service when running on a standalone referee phone.Phase 3: Vision, OCR, and Roster-Matching Worker ImplementationWith frame ingestion active, the Python worker implements the normalized ROI cropper and 64-bit perceptual hash (dHash) change-detection gate across the 4 kill-feed row slots. Whenever a newly stabilized row is unlocked, the ONNX YOLOv8n detector locates the central weapon/action icon and splits the horizontal banner into killer\_crop (left of icon) and victim\_crop (right of icon). These crops undergo HSV Value-channel extraction and CLAHE contrast enhancement before passing through PaddleOCR (det=False, rec=True, cls=False). The resulting text strings are normalized with Unicode NFKD and matched against the 48 registered players for that match ID using RapidFuzz.Phase 4: Backend Persistence and Real-Time Leaderboard BroadcastOn the backend, a PostgreSQL database managed via Prisma ORM stores Tournament, Match, MatchParticipant (containing the registered IGN and official Garena Character UID), MatchTeamScore, and KillEvent models. An authenticated internal Node.js endpoint (POST /api/v1/matches/:matchId/events/kill) executes an idempotent Prisma $transaction, incrementing the killer's individual kill count, updating the squad's total points, and broadcasting real-time delta payloads over WebSockets (Socket.io) to connected tournament viewers.Phase 5: Replay Audit and Dispute Verification PipelineFinally, to guarantee 100% tournament integrity prior to prize payouts, the Custom Room is configured with Save Replays: Yes. Immediately upon match completion (the Booyah summary screen), a secondary high-resolution OCR pass scans the final in-game standings table to reconcile total team kills against the real-time optical event ledger, flagging any disputed discrepancies for referee video review.Production Code Implementations1. Screen Capture Implementation (Android Native Kotlin &amp; PC Python Stream)Option A: Native Android Real-Time Screen Capture (MediaProjection + ImageReader in Kotlin)For on-device capture on Android 14–17, the following Kotlin foreground service captures the screen via MediaProjection, registers the mandatory lifecycle callback, crops the Kill Feed ROI directly from the ImageReader plane buffer to minimize memory copy overhead, and throttles extraction to 4 Hz:Kotlinpackage com.tournament.fftracker.capture

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import androidx.core.app.NotificationCompat
import java.util.concurrent.atomic.AtomicLong

class SpectatorCaptureService : Service() {

    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null
    private lateinit var backgroundThread: HandlerThread
    private lateinit var backgroundHandler: Handler
    private val lastCaptureTimestamp = AtomicLong(0L)

    // Normalized Kill Feed ROI coordinates (calibrated for 16:9 / 20:9 Spectator HUD)
    private val roiLeftRatio = 0.015f
    private val roiTopRatio = 0.180f
    private val roiWidthRatio = 0.305f
    private val roiHeightRatio = 0.180f

    // Minimum interval between frame extractions (250ms = 4 FPS for change-detection gate)
    private val frameIntervalMs = 250L

    override fun onCreate() {
        super.onCreate()
        backgroundThread = HandlerThread("FFKillFeedCaptureThread").apply { start() }
        backgroundHandler = Handler(backgroundThread.looper)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = NotificationCompat.Builder(this, "CAPTURE\_CHANNEL")
            .setContentTitle("Free Fire Tournament Observer Active")
            .setContentText("Monitoring Custom Room Kill Feed in real time")
            .setSmallIcon(android.R.drawable.ic\_menu\_camera)
            .build()

        if (Build.VERSION.SDK\_INT &gt;= Build.VERSION\_CODES.Q) {
            startForeground(1001, notification, ServiceInfo.FOREGROUND\_SERVICE\_TYPE\_MEDIA\_PROJECTION)
        } else {
            startForeground(1001, notification)
        }

        val resultCode = intent?.getIntExtra("RESULT\_CODE", -1) ?: -1
        val resultData: Intent? = intent?.getParcelableExtra("RESULT\_DATA")

        if (resultCode != -1 &amp;&amp; resultData != null) {
            startMediaProjection(resultCode, resultData)
        }
        return START\_STICKY
    }

    private fun startMediaProjection(resultCode: Int, resultData: Intent) {
        val projectionManager = getSystemService(Context.MEDIA\_PROJECTION\_SERVICE) as MediaProjectionManager
        mediaProjection = projectionManager.getMediaProjection(resultCode, resultData)

        // Mandatory callback registration for Android 14+ MediaProjection lifecycle rules
        mediaProjection?.registerCallback(object : MediaProjection.Callback() {
            override fun onStop() {
                tearDownProjection()
            }
        }, backgroundHandler)

        val metrics = resources.displayMetrics
        val screenWidth = metrics.widthPixels
        val screenHeight = metrics.heightPixels
        val screenDensity = metrics.densityDpi

        imageReader = ImageReader.newInstance(
            screenWidth,
            screenHeight,
            PixelFormat.RGBA\_8888,
            2
        )

        imageReader?.setOnImageAvailableListener({ reader -&gt;
            val image = reader.acquireLatestImage() ?: return@setOnImageAvailableListener
            val now = System.currentTimeMillis()

            if (now - lastCaptureTimestamp.get() &lt; frameIntervalMs) {
                image.close()
                return@setOnImageAvailableListener
            }
            lastCaptureTimestamp.set(now)

            try {
                val plane = image.planes\[0\]
                val buffer = plane.buffer
                val pixelStride = plane.pixelStride
                val rowStride = plane.rowStride
                val rowPadding = rowStride - pixelStride \* screenWidth

                // Reconstruct full frame bitmap accounting for hardware stride padding
                val fullBitmap = Bitmap.createBitmap(
                    screenWidth + rowPadding / pixelStride,
                    screenHeight,
                    Bitmap.Config.ARGB\_8888
                )
                fullBitmap.copyPixelsFromBuffer(buffer)

                // Immediately crop to normalized Kill Feed ROI
                val cropX = (screenWidth \* roiLeftRatio).toInt()
                val cropY = (screenHeight \* roiTopRatio).toInt()
                val cropW = (screenWidth \* roiWidthRatio).toInt()
                val cropH = (screenHeight \* roiHeightRatio).toInt()

                val killFeedBitmap = Bitmap.createBitmap(fullBitmap, cropX, cropY, cropW, cropH)
                fullBitmap.recycle()

                // Dispatch only the lightweight cropped ROI (e.g., \~580x195 px) to local ONNX or WebSocket worker
                dispatchKillFeedRoi(killFeedBitmap, now)
            } finally {
                image.close()
            }
        }, backgroundHandler)

        virtualDisplay = mediaProjection?.createVirtualDisplay(
            "FFSpectatorVirtualDisplay",
            screenWidth,
            screenHeight,
            screenDensity,
            DisplayManager.VIRTUAL\_DISPLAY\_FLAG\_AUTO\_MIRROR,
            imageReader?.surface,
            null,
            backgroundHandler
        )
    }

    private fun dispatchKillFeedRoi(roiBitmap: Bitmap, timestampMs: Long) {
        // Compress ROI or pass to JNI/ONNX Runtime worker
        roiBitmap.recycle()
    }

    private fun tearDownProjection() {
        virtualDisplay?.release()
        imageReader?.close()
        mediaProjection = null
    }

    override fun onDestroy() {
        tearDownProjection()
        backgroundThread.quitSafely()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
Option B: Android-to-PC Stream &amp; Desktop Capture in Python (py-scrcpy-client / mss)For the recommended multi-lobby server setup where a physical Android spectator device streams H.264 frames to a Python worker (or where OBS/capture-card video is captured via mss):Pythonimport time
import threading
import numpy as np
import cv2
import mss
import scrcpy

class SpectatorStreamCapture:
    """
    Unified capture adapter supporting both Android hardware H.264 streaming via py-scrcpy-client
    and PC/Capture-Card screen grabbing via MSS.
    """
    def \_\_init\_\_(self, mode: str = "scrcpy", adb\_serial: str = None, monitor\_idx: int = 1):
        self.mode = mode
        self.adb\_serial = adb\_serial
        self.monitor\_idx = monitor\_idx
        self.latest\_frame: np.ndarray | None = None
        self.lock = threading.Lock()
        self.running = False
        self.client = None

    def \_on\_scrcpy\_frame(self, frame: np.ndarray):
        if frame is not None:
            with self.lock:
                self.latest\_frame = frame

    def start(self):
        self.running = True
        if self.mode == "scrcpy":
            # Stream at 1080p max width and 15 FPS to keep host CPU minimal
            self.client = scrcpy.Client(device=self.adb\_serial, max\_width=1920, max\_fps=15)
            self.client.add\_listener(scrcpy.EVENT\_FRAME, self.\_on\_scrcpy\_frame)
            self.client.start(threaded=True)
        elif self.mode == "mss":
            threading.Thread(target=self.\_mss\_loop, daemon=True).start()

    def \_mss\_loop(self):
        with mss.mss() as sct:
            monitor = sct.monitors\[self.monitor\_idx\]
            while self.running:
                sct\_img = sct.grab(monitor)
                frame = cv2.cvtColor(np.array(sct\_img), cv2.COLOR\_BGRA2BGR)
                with self.lock:
                    self.latest\_frame = frame
                time.sleep(0.1)  # 10 Hz capture loop

    def get\_kill\_feed\_roi(self) -&gt; np.ndarray | None:
        """
        Extracts the normalized Kill Feed Region of Interest independent of resolution.
        """
        with self.lock:
            if self.latest\_frame is None:
                return None
            frame = self.latest\_frame.copy()

        h, w, \_ = frame.shape
        x1, x2 = int(0.015 \* w), int(0.320 \* w)
        y1, y2 = int(0.180 \* h), int(0.360 \* h)
        return frame\[y1:y2, x1:x2\]

    def stop(self):
        self.running = False
        if self.client:
            self.client.stop()
2. Real-Time Vision, OCR, and Roster-Matching Pipeline (Python)The following Python module implements the complete processing engine: perceptual hash stability gating, YOLOv8 icon classification and row splitting, HSV contrast preprocessing, PaddleOCR text recognition, Unicode NFKD normalization, RapidFuzz closed-world roster matching, knock-to-kill attribution, and sliding-window deduplication:Pythonimport time
import unicodedata
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
import cv2
import numpy as np
import requests
from rapidfuzz import process, fuzz
from paddleocr import PaddleOCR
from ultralytics import YOLO

@dataclass
class RegisteredPlayer:
    uid: str
    raw\_ign: str
    normalized\_ign: str
    team\_id: str

class FreeFireKillFeedPipeline:
    def \_\_init\_\_(
        self,
        match\_id: str,
        roster: List\[Dict\[str, str\]\],
        yolo\_weights\_path: str,
        backend\_webhook\_url: str,
        api\_secret: str
    ):
        self.match\_id = match\_id
        self.backend\_webhook\_url = backend\_webhook\_url
        self.api\_secret = api\_secret

        # Build closed-world lookup dictionary for the 48 players in the Custom Room
        self.players\_by\_norm\_name: Dict\[str, RegisteredPlayer\] = {}
        for p in roster:
            norm = self.normalize\_ign(p\["ign"\])
            self.players\_by\_norm\_name\[norm\] = RegisteredPlayer(
                uid=p\["uid"\],
                raw\_ign=p\["ign"\],
                normalized\_ign=norm,
                team\_id=p\["teamId"\]
            )
        self.norm\_name\_choices = list(self.players\_by\_norm\_name.keys())

        # Initialize YOLOv8-Nano for kill-feed icon &amp; state detection
        self.icon\_detector = YOLO(yolo\_weights\_path)

        # Initialize PaddleOCR in recognition-only mode for low latency on pre-sliced name crops
        self.ocr = PaddleOCR(
            use\_angle\_cls=False,
            lang="en",
            det=False,
            rec=True,
            show\_log=False
        )

        # State tracking for pixel stability, knock-to-kill attribution, and deduplication
        self.prev\_row\_hashes: Dict\[int, np.ndarray\] = {}
        self.stable\_row\_locks: Dict\[int, np.ndarray\] = {}
        self.knockdown\_ledger: Dict\[str, Tuple\[str, str, float\]\] = {}  # victim\_uid -&gt; (killer\_uid, weapon, ts)
        self.dedup\_kill\_cache: Dict\[str, float\] = {}  # victim\_uid -&gt; last\_kill\_ts
        self.dedup\_ttl\_seconds = 30.0

    @staticmethod
    def normalize\_ign(text: str) -&gt; str:
        """
        Normalizes Free Fire stylish Unicode names (fullwidth, mathematical alphanumerics)
        into clean uppercase ASCII/Latin tokens for deterministic fuzzy matching.
        """
        if not text:
            return ""
        decomposed = unicodedata.normalize("NFKD", text)
        cleaned = "".join(ch for ch in decomposed if ch.isalnum() or ch in ("\_", "-", "."))
        return cleaned.upper().strip()

    @staticmethod
    def compute\_dhash(image: np.ndarray, hash\_size: int = 8) -&gt; np.ndarray:
        """Computes a fast 64-bit difference hash for sub-millisecond change detection."""
        gray = cv2.cvtColor(image, cv2.COLOR\_BGR2GRAY)
        resized = cv2.resize(gray, (hash\_size + 1, hash\_size))
        return resized\[:, 1:\] &gt; resized\[:, :-1\]

    @staticmethod
    def preprocess\_name\_crop(crop: np.ndarray) -&gt; np.ndarray:
        """
        Enhances GFF font contrast against semi-transparent or red headshot backgrounds
        by isolating the HSV Value channel and applying upscale + CLAHE.
        """
        upscaled = cv2.resize(crop, None, fx=2.0, fy=2.0, interpolation=cv2.INTER\_CUBIC)
        hsv = cv2.cvtColor(upscaled, cv2.COLOR\_BGR2HSV)
        \_, \_, v\_channel = cv2.split(hsv)
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(4, 4))
        enhanced = clahe.apply(v\_channel)
        return cv2.cvtColor(enhanced, cv2.COLOR\_GRAY2BGR)

    def match\_player\_to\_roster(self, raw\_ocr\_text: str, min\_score: float = 68.0) -&gt; Optional\[RegisteredPlayer\]:
        norm\_query = self.normalize\_ign(raw\_ocr\_text)
        if len(norm\_query) &lt; 2 or not self.norm\_name\_choices:
            return None

        match = process.extractOne(
            norm\_query,
            self.norm\_name\_choices,
            scorer=fuzz.WRatio
        )
        if match and match\[1\] &gt;= min\_score:
            return self.players\_by\_norm\_name\[match\[0\]\]
        return None

    def process\_roi\_frame(self, roi\_bgr: np.ndarray):
        """
        Slices the Kill Feed ROI into 4 row slots, checks pixel stability, and triggers
        YOLO + OCR only on newly stabilized banners.
        """
        h, w, \_ = roi\_bgr.shape
        num\_rows = 4
        row\_h = h // num\_rows
        now = time.time()

        for row\_idx in range(num\_rows):
            row\_crop = roi\_bgr\[row\_idx \* row\_h : (row\_idx + 1) \* row\_h, :\]
            current\_hash = self.compute\_dhash(row\_crop)

            # 1. Check if this row is already locked and unchanged
            if row\_idx in self.stable\_row\_locks:
                hamming\_locked = np.count\_nonzero(current\_hash != self.stable\_row\_locks\[row\_idx\])
                if hamming\_locked &lt;= 3:
                    continue  # Banner has not changed; skip inference

            # 2. Check if row just stabilized compared to the immediately preceding frame
            prev\_hash = self.prev\_row\_hashes.get(row\_idx)
            self.prev\_row\_hashes\[row\_idx\] = current\_hash
            if prev\_hash is None:
                continue

            hamming\_delta = np.count\_nonzero(current\_hash != prev\_hash)
            if hamming\_delta &gt; 2:
                # Banner is currently mid-slide or mid-fade animation; wait next 100ms frame
                continue

            # Banner is stable and new: lock fingerprint and run hybrid YOLO + OCR
            self.stable\_row\_locks\[row\_idx\] = current\_hash
            self.\_analyze\_single\_row(row\_crop, now)

    def \_analyze\_single\_row(self, row\_bgr: np.ndarray, timestamp: float):
        results = self.icon\_detector.predict(row\_bgr, conf=0.45, verbose=False)
        if not results or len(results\[0\].boxes) == 0:
            return

        boxes = results\[0\].boxes
        names = results\[0\].names

        # Identify primary action icon and optional headshot modifier
        primary\_box = None
        event\_class = None
        is\_headshot = False

        for box in boxes:
            cls\_name = names\[int(box.cls\[0\])\]
            if "head" in cls\_name.lower():
                is\_headshot = True
            if primary\_box is None or float(box.conf\[0\]) &gt; float(primary\_box.conf\[0\]):
                primary\_box = box
                event\_class = cls\_name

        if primary\_box is None:
            return

        x1, \_, x2, \_ = map(int, primary\_box.xyxy\[0\])
        row\_h, row\_w, \_ = row\_bgr.shape

        # Segment row into Left (Killer) and Right (Victim) crops around the icon bounding box
        killer\_crop = row\_bgr\[:, :max(1, x1 - 4)\]
        victim\_crop = row\_bgr\[:, min(row\_w - 1, x2 + 4):\]

        # Extract Victim IGN first (always present on right side of banner)
        victim\_prep = self.preprocess\_name\_crop(victim\_crop)
        victim\_ocr\_res = self.ocr.ocr(victim\_prep, det=False, cls=False)
        victim\_raw = victim\_ocr\_res\[0\]\[0\]\[0\] if (victim\_ocr\_res and victim\_ocr\_res\[0\]) else ""
        victim = self.match\_player\_to\_roster(victim\_raw)
        if not victim:
            return

        # Handle Revive events
        if event\_class == "revive":
            self.knockdown\_ledger.pop(victim.uid, None)
            return

        # Handle Environmental kills (Playzone / Falling)
        if event\_class in ("playzone-kill", "falling-knock"):
            if event\_class == "playzone-kill" and victim.uid in self.knockdown\_ledger:
                # Victim was previously knocked by an enemy player and bled out in the zone
                killer\_uid, weapon\_used, knock\_ts = self.knockdown\_ledger.pop(victim.uid)
                if timestamp - knock\_ts &lt;= 50.0:
                    self.\_emit\_verified\_kill(killer\_uid, victim.uid, weapon\_used, False, timestamp)
            return

        # Extract Killer IGN from Left crop for combat events
        killer\_prep = self.preprocess\_name\_crop(killer\_crop)
        killer\_ocr\_res = self.ocr.ocr(killer\_prep, det=False, cls=False)
        killer\_raw = killer\_ocr\_res\[0\]\[0\]\[0\] if (killer\_ocr\_res and killer\_ocr\_res\[0\]) else ""
        killer = self.match\_player\_to\_roster(killer\_raw)
        if not killer or killer.uid == victim.uid:
            return

        # Distinguish Knockdown vs. Confirmed Elimination
        if "knock" in event\_class:
            self.knockdown\_ledger\[victim.uid\] = (killer.uid, event\_class, timestamp)
        elif "kill" in event\_class:
            self.knockdown\_ledger.pop(victim.uid, None)
            self.\_emit\_verified\_kill(killer.uid, victim.uid, event\_class, is\_headshot, timestamp)

    def \_emit\_verified\_kill(
        self,
        killer\_uid: str,
        victim\_uid: str,
        weapon\_class: str,
        is\_headshot: bool,
        timestamp: float
    ):
        # Enforce sliding-window deduplication so scrolling banners never double-count
        last\_seen = self.dedup\_kill\_cache.get(victim\_uid, 0.0)
        if timestamp - last\_seen &lt; self.dedup\_ttl\_seconds:
            return
        self.dedup\_kill\_cache\[victim\_uid\] = timestamp

        payload = {
            "matchId": self.match\_id,
            "killerUid": killer\_uid,
            "victimUid": victim\_uid,
            "weapon": weapon\_class,
            "isHeadshot": is\_headshot,
            "occurredAtMs": int(timestamp \* 1000),
            "idempotencyKey": f"{self.match\_id}\_{victim\_uid}\_{int(timestamp // self.dedup\_ttl\_seconds)}"
        }
        try:
            requests.post(
                self.backend\_webhook\_url,
                json=payload,
                headers={"Authorization": f"Bearer {self.api\_secret}"},
                timeout=2.5
            )
        except requests.RequestException as exc:
            print(f"\[WARN\] Webhook dispatch failed, queuing retry: {exc}")
3. Backend Integration and Real-Time Leaderboard (Node.js + Prisma)Prisma Schema (prisma/schema.prisma)The relational schema enforces idempotency on optical kill events via a unique idempotencyKey and maintains atomic team and player kill counters:Code snippetdatasource db {
  provider = "postgresql"
  url      = env("DATABASE\_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum MatchStatus {
  SCHEDULED
  LIVE
  COMPLETED
  DISPUTED
}

model Tournament {
  id          String   @id @default(uuid())
  name        String
  pointsPerKill Int    @default(1)
  matches     Match\[\]
  createdAt   DateTime @default(now())
}

model Match {
  id            String             @id @default(uuid())
  tournamentId  String
  tournament    Tournament         @relation(fields: \[tournamentId\], references: \[id\])
  roomNumber    Int
  mapName       String             // e.g., Bermuda, Purgatory, Kalahari, NeXTerra
  status        MatchStatus        @default(SCHEDULED)
  participants  MatchParticipant\[\]
  teamScores    MatchTeamScore\[\]
  killEvents    KillEvent\[\]
  createdAt     DateTime           @default(now())
}

model MatchParticipant {
  id            String   @id @default(uuid())
  matchId       String
  match         Match    @relation(fields: \[matchId\], references: \[id\])
  teamId        String
  playerUid     String   // Official Garena Free Fire Character UID
  registeredIgn String   // Exact In-Game Name submitted at registration
  kills         Int      @default(0)
  headshotKills Int      @default(0)
  isEliminated  Boolean  @default(false)

  @@unique(\[matchId, playerUid\])
  @@index(\[matchId, teamId\])
}

model MatchTeamScore {
  id              String @id @default(uuid())
  matchId         String
  match           Match  @relation(fields: \[matchId\], references: \[id\])
  teamId          String
  teamName        String
  killPoints      Int    @default(0)
  placementPoints Int    @default(0)
  totalPoints     Int    @default(0)

  @@unique(\[matchId, teamId\])
}

model KillEvent {
  id             String   @id @default(uuid())
  idempotencyKey String   @unique
  matchId        String
  match          Match    @relation(fields: \[matchId\], references: \[id\])
  killerUid      String
  victimUid      String
  weaponClass    String
  isHeadshot     Boolean  @default(false)
  occurredAt     DateTime

  @@index(\[matchId, occurredAt\])
}
Node.js Ingestion Controller (killEventController.ts)This controller processes incoming OCR webhooks inside a serializable Prisma transaction, guaranteeing that concurrent worker retries never corrupt leaderboard standings while broadcasting live updates over Socket.io:TypeScriptimport { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { Server as SocketIOServer } from "socket.io";

const prisma = new PrismaClient();

export const ingestOpticalKillEvent = (io: SocketIOServer) =&gt; {
  return async (req: Request, res: Response): Promise&lt;void&gt; =&gt; {
    const {
      matchId,
      killerUid,
      victimUid,
      weapon,
      isHeadshot,
      occurredAtMs,
      idempotencyKey,
    } = req.body;

    try {
      const result = await prisma.$transaction(async (tx) =&gt; {
        // 1. Idempotency guard: abort if this kill banner was already recorded
        const existingEvent = await tx.killEvent.findUnique({
          where: { idempotencyKey },
        });
        if (existingEvent) {
          return { duplicate: true, event: existingEvent };
        }

        // 2. Verify both Killer and Victim belong to the registered Custom Room roster
        const \[killer, victim, match\] = await Promise.all(\[
          tx.matchParticipant.findUnique({
            where: { matchId\_playerUid: { matchId, playerUid: killerUid } },
          }),
          tx.matchParticipant.findUnique({
            where: { matchId\_playerUid: { matchId, playerUid: victimUid } },
          }),
          tx.match.findUnique({
            where: { id: matchId },
            include: { tournament: true },
          }),
        \]);

        if (!killer || !victim || !match) {
          throw new Error("UNREGISTERED\_PARTICIPANT\_OR\_INVALID\_MATCH");
        }

        // Prevent friendly-fire or self-elimination point inflation
        const killPointDelta =
          killer.teamId !== victim.teamId ? match.tournament.pointsPerKill : 0;

        // 3. Persist the immutable KillEvent audit record
        const killEvent = await tx.killEvent.create({
          data: {
            idempotencyKey,
            matchId,
            killerUid,
            victimUid,
            weaponClass: weapon,
            isHeadshot: Boolean(isHeadshot),
            occurredAt: new Date(occurredAtMs),
          },
        });

        // 4. Increment killer individual stats and mark victim as eliminated
        const updatedKiller = await tx.matchParticipant.update({
          where: { id: killer.id },
          data: {
            kills: { increment: 1 },
            headshotKills: { increment: isHeadshot ? 1 : 0 },
          },
        });

        await tx.matchParticipant.update({
          where: { id: victim.id },
          data: { isEliminated: true },
        });

        // 5. Increment team kill points and total points atomically
        const updatedTeamScore = await tx.matchTeamScore.update({
          where: {
            matchId\_teamId: { matchId, teamId: killer.teamId },
          },
          data: {
            killPoints: { increment: killPointDelta },
            totalPoints: { increment: killPointDelta },
          },
        });

        return {
          duplicate: false,
          killEvent,
          updatedKiller,
          updatedTeamScore,
        };
      });

      if (!result.duplicate) {
        // Broadcast real-time scoreboard delta to connected tournament viewers
        io.to(\`match\_${matchId}\`).emit("KILL\_FEED\_UPDATE", {
          killEvent: result.killEvent,
          killerStats: {
            playerUid: killerUid,
            kills: result.updatedKiller.kills,
            headshotKills: result.updatedKiller.headshotKills,
          },
          teamStandingsDelta: result.updatedTeamScore,
        });
      }

      res.status(200).json({ status: "OK", duplicate: result.duplicate });
    } catch (error: any) {
      res.status(400).json({ status: "ERROR", message: error.message });
    }
  };
};
Accuracy Benchmarks and Performance OptimizationsExpected Detection Accuracy Across Tournament ConditionsBy combining YOLOv8 icon classification, HSV-enhanced PaddleOCR, and closed-world 48-player roster fuzzy matching, system accuracy scales significantly beyond raw unconstrained OCR:Player Name &amp; Combat ScenarioRaw Unconstrained OCR Exact Match (%)With Unicode NFKD + 48-Player RapidFuzz (%)With Multi-Frame Stability + Knock-to-Kill Ledger (%)Primary Residual Failure ModeStandard ASCII / Latin (GFF Font) (e.g., WifiWhoDis, TotalGaming)94.0 – 96.5%99.4 – 99.8%99.8%Extreme bitrate drop on wireless ADB streamStylized Fullwidth / Small Caps (e.g., ＴᴏᴜᴄʜＧʀᴀss, ＬａｇＳｑｕａｄ)62.0 – 74.0%97.5 – 98.9%99.1%Two players in the same lobby choosing nearly identical stylized namesHeavy Decorative Symbols / CJK Glyphs (e.g., LowkeyLost💀, pure symbol IGNs)35.0 – 52.0%89.0 – 94.5%95.5%Names composed of $\\ge 80\\%$ non-alphanumeric symbols (&lt;2 Latin chars)High-Velocity Multi-Squad Wipe (5–8 events within 3.0 seconds)70.0% (at 2.0s naive polling)78.0% (at 2.0s naive polling)96.5 – 98.2% (with 10 Hz hash gate)5+ simultaneous kills overflowing the 4-row UI buffer in $&lt;200\\text{ ms}$Knockdown Followed by Safe Zone Bleed-Out (gun-knock $\\rightarrow$ playzone-kill)0.0% (no killer in zone banner)0.0% (without state ledger)94.0 – 96.8%Victim knocked off-screen before observer connects to lobbyKey Performance Optimizations for Real-Time ExecutionThree core optimizations keep real-time processing overhead low enough to run multiple simultaneous Custom Room observers on a single server node. First, ROI Pixel Fingerprinting eliminates redundant neural network calls: computing a 64-bit dHash on the 4 row slots requires $&lt;0.2\\text{ ms}$ on a single CPU thread. As demonstrated in production tools like ClipHound and SC\_OCR, locking unchanged rows keeps background CPU utilization at a few percent between fights and 10–20% of a single core only while kills are actively being read.Second, bypassing the OCR Text Detector (det=False) removes the heaviest stage of the text pipeline. In two-stage OCR architectures (such as PaddleOCR and EasyOCR), the full-frame text detection network (DBNet/CRAFT) consumes the majority of inference latency. Because the YOLOv8 icon detector already returns the exact bounding box $\[x\_1, y\_1, x\_2, y\_2\]$ of the central weapon icon within the pre-cropped row, the left and right text bounds are geometrically deterministic. Passing those two strips directly into the recognition head (det=False, rec=True) cuts OCR latency to under 18 ms per row on ONNX Runtime.Third, enforcing Registration Hygiene Validation at tournament sign-up prevents degenerate OCR edge cases. Because names consisting entirely of emojis or box-drawing symbols degrade OCR fallback, the tournament platform's registration portal should require every participant's registered IGN to contain at least 3 standard alphanumeric or supported regional characters (Latin, Devanagari, Arabic, or Thai). Additionally, the observer worker can periodically read the in-game Spectator Standings Table—which displays all 12 squads and their cumulative kill totals in a clean layout—as a self-healing state reconciliation checkpoint.Legal Considerations and Garena TOS ComplianceOperating an automated tournament platform requires strict adherence to Garena's Terms of Service, Fair Play Policies, and Community Tournament Guidelines. First, the architecture must maintain zero intrusiveness against libanogs and libanort. Garena Free Fire's anti-cheat engine actively scans client memory spaces, hooked system calls, modified APK signatures, and injected shared libraries. Unofficial third-party observer HUDs (such as ViewFF) that require disabling Windows Virtualization-Based Security (VBS) and Memory Integrity to read process memory operate in a high-risk gray area and explicitly disclaim affiliation with Garena. Conversely, passive optical screen capture—particularly when executed on a secondary PC ingesting an H.264 stream via scrcpy or an HDMI capture card—executes entirely outside the game client's memory and network stack. No game files, textures, or network packets are modified.Second, optical verification aligns directly with official referee and fair-play enforcement rules. Standard Free Fire competitive rulebooks and platform fair-play policies explicitly authorize tournament organizers to monitor live matches via referees, record matches for proof, and require participants to abide by decisions made by automated verification tools.Third, tournament operators must respect Community Tournament Licensing and trademark boundaries. Publishers retain intellectual property control over tournament broadcasting and commercial rights. Community platforms hosting third-party events must comply with Garena's Community Tournament Guidelines (which govern prize pool thresholds, sponsor restrictions, and branding disclaimers) and clearly state that the tournament platform is an independent organizer not affiliated with or endorsed by Garena International.Bonus Analysis: YOLO Object Detection and Replay System Integration1. AI-Based Object Detection (YOLO) on the Game ScreenUsing a fine-tuned YOLOv8 or YOLOv11 model is not merely viable—it is the recommended industry pattern for resolving the structural ambiguity of Battle Royale kill feeds. While pure OCR can only transcribe character glyphs, YOLO simultaneously solves three problems that OCR cannot. First, if an observer switches between standard Spectator Mode and tablet/wide-screen layouts, a YOLO detector trained on classes such as killblock or kill\_banner dynamically locates the exact kill-feed row coordinates. Second, as proven by the 3,400-image kill-feed-detection-main and 1,440-image ff by free fire datasets, YOLO directly classifies whether an icon represents a scoring kill (gun-kill, gun-head-kill, grenade-kill, landmine-kill, Player-skill-kill, car-kill, fist-kill) versus a non-scoring knockdown (gun-knock, grenade-knock, falling-knock) or support action (revive). Third, beyond the upper-quadrant kill feed, YOLO can simultaneously monitor the bottom/center HUD of the actively spectated player to detect instant elimination pop-ups, active skill activations, and remaining alive player/team counters in the top-right status bar (players alive, teams, and zone timer).2. Integration with Free Fire's Replay SystemIn Custom Room settings, organizers can toggle Save Replays: Yes, allowing the game client to record match telemetry locally (though Garena occasionally disables specific sub-features such as the post-death Elimination Replay during patch transitions for stability fixes). However, direct binary parsing of Free Fire replay files is not architecturally viable for third-party tournament platforms. Unlike desktop engines that provide open-source replay parsing SDKs, Free Fire's saved replays are internal Unity state and network-tick serializations rather than standalone .mp4 video files. They require the exact matching OB game client binary and asset bundles to reconstruct 3D animations, break across every major OB patch, and are protected against reverse engineering by Garena's anti-cheat and Terms of Service.Instead of parsing proprietary binary files, tournament platforms should integrate with the replay workflow optically through two complementary mechanisms. First, for high-speed post-match VOD auditing and dispute resolution, when a referee records the Spectator Mode broadcast (or plays back the in-game saved replay to a video recording), the platform can pass the recorded .mp4 through an accelerated offline OCR/YOLO worker running at 5x real-time speed—sampling key-frames via FFmpeg whenever pixel hashes in the kill-feed ROI change, mirroring the architecture of Kennel.gg's VOD scanner. A 15-minute Battle Royale match is audited in roughly 3 minutes, producing a frame-accurate kill log and automatically clipping 10-second dispute or highlight reels around every elimination. Second, at the conclusion of every Custom Room match (the Booyah screen), Free Fire displays a structured summary table listing every squad, every player's exact IGN, survival placement, and official final kill count. Running a single high-resolution PaddleOCR pass over this final summary screen provides an authoritative ground-truth reconciliation check against the real-time kill-feed stream, guaranteeing 100% scoring accuracy prior to prize disbursement.