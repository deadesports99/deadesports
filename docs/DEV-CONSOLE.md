# Phone Dev Console — fatak fatak testing

Ek chhota local panel jo **phone ke browser me** khulta hai aur wahan se hi APK
build + install + launch karta hai. Zero dependencies, sirf Node + adb.

## Start

```bat
START-DEV-CONSOLE.bat        :: ya: node scripts/dev-console.mjs
```

Terminal me URLs print honge:

- laptop: `http://localhost:5199`
- wi-fi:  `http://<laptop-ip>:5199` (same network par phone se bhi khulta hai)

## Phone par panel kholne ke 2 tarike

| Tarika | Setup |
|---|---|
| **USB + adb reverse** (best) | phone USB se lagao → panel `adb reverse tcp:5199 tcp:5199` khud kar deta hai → phone browser me `http://localhost:5199` |
| **Wi-Fi** | phone aur laptop same Wi-Fi par → phone browser me `http://<laptop-ip>:5199` |

## Wireless adb (cable hata ke bhi kaam kare)

Ek baar USB se:

```bash
adb tcpip 5555
adb shell ip route          # phone ka IP dekho (src <ip>)
adb connect <phone-ip>:5555
adb devices                 # "device" dikhna chahiye, ab cable nikal do
```

Panel ke Device card me bhi `IP:5555` daal ke **Connect** tap kar sakte ho.
Android 11+ par *Developer options → Wireless debugging → Pair device with
pairing code* chahiye hota hai (`adb pair <ip>:<pair-port>`).

## Phone ki zaroorat nahi — emulator

Ek baar `START-EMULATOR.bat` (ya `emulator -avd ffTest -port 5554 ...`) chalao.
AVD `ffTest` = Pixel 6 profile, Android 16 (API 36, google_apis_playstore), x86_64,
3GB RAM. Boot ~40-60s, phir `adb devices` me `emulator-5554` dikhta hai aur panel
usko normal phone jaisa hi treat karta hai (install / launch / logcat / screenshot).

Verified on this machine (2026-11-16): `installDebug` on emulator = 35s cold,
watcher save → install = 9s, app sign-in screen render hui, logcat + screenshot chalte hain.

Fayda: ghar pahunchne se pehle bhi pura Android loop chalta hai.
Nuksan: emulator ~3GB RAM leta hai, animations/graphics asli phone se slow,
UPI app intents / real FCM push emulator par thoda alag behave karte hain.

## Panel me kya hai

- **Player / Admin** — ek tap: `installDebug` (build + install), phir app auto launch.
- **Watcher ON** — `android/app-player/src`, `android/app-admin/src`, `android/core/src`
  par file save karte hi (1.2s debounce) khud build + install. Sirf edit karo,
  phone me app update ho jayegi.
  - `core` change kis app me jaye: dropdown se `core → player / admin / both`.
- **Launch / Force stop** — app kholo ya band karo (rebuild ke bina).
- **Reconnect adb reverse** — backend `tcp:5000` + panel `tcp:5199`; USB nikalne
  ke baad adb reverse reset ho jata hai, isliye build ke baad auto-reverse on hai.
- **Live Build log / Logcat / Screen** — build output stream, logcat stream
  (filter box), aur phone ka screenshot panel me.

## Kitna fast hai

Incremental build ~4-13s (ye machine par measure kiya), cold ~25s.
Isliye loop: edit → save → ~10s me phone par naya app.

Sirf Compose UI/copy/text badla → normal rebuild (upar wala loop).
`client_config.json` (app name, application_id, api_base_url, tenant) badla →
rebuild zaroori (assets bake hote hain), watcher khud pakad lega.
Backend/DB change → app rebuild nahi chahiye, sirf backend restart.

## Notes

- Koi phone connected nahi → build button fail nahi karta, panel warn dikhata hai.
- Gradle daemon warm rehne ke liye console band mat karo; `--daemon --build-cache`.
- Port badalna ho: `DEV_CONSOLE_PORT=5300 node scripts/dev-console.mjs`
  (tab `adb reverse tcp:5300 tcp:5300` bhi karna padega — script khud karti hai).
