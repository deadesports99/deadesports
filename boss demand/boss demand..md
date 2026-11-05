Kotlin + Jetpack Compose + Firebase ke saath is White-Label Free Fire eSports system ko banane aur har naye client ko 10 minute mein handover karne ka step-by-step practical roadmap niche diya gaya hai.

Is roadmap ko 6 phases mein baanta gaya hai, jise aap niche interactive checklist mein track bhi kar sakte hain:

Phase 1: Android Studio Multi-Module Setup (Din 1–2)

Alag-alag project kholne ke bajaye Android Studio mein ek hi Project banayein aur usmein 3 modules rakhein:

 \* :app-player: Isse Player ka APK niklega.

 \* :app-admin: Isse Manager aur uske hired Staff ka APK niklega.

 \* :core: Ismein aapke Kotlin data class models (Tournament.kt, User.kt, StaffPermissions.kt) aur Firebase repository functions rahenge, taaki aapko dono apps mein dobara code na likhna pade.

 \* Local Database: :core module mein Jetpack DataStore lagayein jo phone mein user ka uid, role (manager ya staff), aur permissions locally cache karega taaki app khulte hi bina internet delay ke sahi dashboard dikhe.

Phase 2: Firebase Firestore Database Structure (Din 3–4)

Client ke Firebase mein sirf 4 main collections banenge:

 \* admins collection: Har document mein email, role ("manager" ya "staff"), aur ek permissions map hoga:

   \* canCreateMatch: Boolean

   \* canUpdateRoomId: Boolean

   \* canDistributePrize: Boolean

   \* canManageWallet: Boolean

 \* tournaments collection: title, map (Bermuda/Purgatory), matchTime, entryFee, perKillPrize, winPrize, totalSlots (e.g., 48), joinedPlayers (List of Player UIDs + FF Names), roomId, roomPassword, aur status ("upcoming", "live", "completed").

 \* users collection: Player ka name, ffUid (Free Fire UID), ffIgn (In-game Name), walletBalance, aur joinedMatches.

 \* transactions collection: Deposit, withdrawal requests, aur match winning records.

Phase 3: Admin &amp; Sub-Admin App Development (Din 5–10)

Yeh app aapke Boss ke clients ko sabse zyada pasand aayega kyunki ismein Manager aur Staff dono ka kaam ek hi APK mein ho jayega:

 \* Dynamic Dashboard (Jetpack Compose): Jab koi login karega, app admins collection se uska document fetch karega:

   \* Agar role == "manager" hai: Screen par Create Match, Manage Staff, Wallet/Withdrawals, aur App Settings (UPI ID/WhatsApp Support link) sab dikhega.

   \* Agar role == "staff" hai: Jetpack Compose mein simple if (permissions.canUpdateRoomId) check lagega, aur screen par sirf wahi cards dikhenge jinki permission Manager ne di hai.

 \* Add Staff Feature: Manager jab "Add Staff" par click karke email, password aur checkboxes select karega, toh ek secondary FirebaseApp instance use karke background mein staff ka Firebase Auth account create ho jayega (taaki Manager khud logout na ho) aur admins collection mein uski permissions save ho jayengi.

 \* Room ID Push: Match start hone se 15 minute pehle Staff ya Manager tournament card khol kar Custom Room ID aur Password dalega. Firestore ke .addSnapshotListener ki wajah se woh turant joined players ko dikhne lagega.

Phase 4: Player App Development (Din 11–16)

 \* Onboarding &amp; FF Profile: Google Credential Manager se 1-Tap Login karwayein, aur pehli baar login karne par player se uska Free Fire UID aur In-Game Name maang kar save kar lein.

 \* Tournament Joining Logic (Firestore Transaction): Jab player "Join Match" dabaye, toh Firestore Transaction (runTransaction) ka use karein. Yeh check karega ki joinedPlayers.size total slots (48) se kam hai aur player ke wallet mein balance hai—tabhi paise katenge aur slot book hoga. Isse kabhi bhi 48 ki jagah 49 bande join nahi ho payenge.

 \* Protected Room ID View: Tournament screen par Room ID aur Password wala box tabhi unlock hoga jab current player ki uid us tournament ke joinedPlayers array mein maujood hogi.

Phase 5: White-Label Automation (Din 17–18)

Har naye client ke liye code mein jagah-jagah badlav karne se bachne ke liye build.gradle.kts mein ek central block bana lein:

 \* App ka Naam (resValue("string", "app_name", "XYZ eSports"))

 \* Package Name (applicationId = "com.xyzesports.player")

 \* Theme Color (Color.kt mein primary brand color)

 \* App Icon (mipmap folder mein client ka logo)

Phase 6: Naye Client ko 10-Minute Mein Handover Kaise Karein

Jab aapka system ek baar ban gaya, toh har naye client ke aane par bas yeh 4 step karne hain:

 \* Client ke Gmail se Firebase Project banayein, Auth aur Firestore enable karein, aur admins collection mein pehla document client ke email ke saath role = "manager" daal dein.

 \* Wahan se dono apps (com.client.player aur com.client.admin) ka google-services.json download karke apne :app-player aur :app-admin folders mein replace kar dein.

 \* Client ka Logo aur App Name update karein.

 \* Android Studio se Generate Signed Bundle / APK chala kar dono APKs (Player.apk aur Admin.apk) client ko WhatsApp/Drive par bhej dein.