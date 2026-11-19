# 01 — Feature flags: one click, build time

Goal: **ek JSON value badlo → rebuild → us APK me module off**. No code edit, no
commenting out screens, no `if (false)`. And a second, server-side switch so a
shipped APK can hide a module without a release.

---

## 1. The single knob: `features` block in `client_config.json`

Every client build already ships its own `client_config.json`
(`android/app-player/src/main/assets/client_config.json`, plus
`clients/<slug>/client_config.json` and `clients/_template/client_config.json`).
Add one block — nothing else in that file moves:

```json
{
  "client_name": "Spartan Arena",
  "features": {
    "referral": true,
    "daily_bonus": true,
    "tasks": true,
    "earn_hub": true,
    "rewards_push": false
  }
}
```

Rules:
- **Missing key = OFF**, except `earn_hub` which defaults to ON when any of the
  three money modules is ON (so a client that enables only tasks still gets a
  page to show them).
- `rewards_push` = the "aaj ka bonus ready" FCM reminder. Default OFF; it depends
  on `google-services.json` being present anyway.
- These keys also go into `clients/_template/client_config.json` so every new
  client starts from a documented shape.

Nested `features` (v2 schema `{"features": {...}}`) is the same thing — the
parser only looks at the `features` object, flat or nested.

---

## 2. Gradle: bake the flags into `BuildConfig`

In `android/app-player/build.gradle.kts` (already reads the JSON for app id and
name), add:

```kotlin
// ── FEATURE FLAGS (build time) ─────────────────────────────────────────
// Order: -P CLI override  >  client_config.json  >  default(false)
val featuresCfg = (clientCfg["features"] as? Map<*, *>) ?: emptyMap<Any, Any>()
fun featureFlag(key: String, default: Boolean = false): Boolean {
    val cli = providers.gradleProperty("feature.$key").orNull?.trim()?.lowercase()
    if (cli != null) return cli == "true" || cli == "on" || cli == "1"
    val json = featuresCfg[key] as? Boolean
    return json ?: default
}
val featureReferral   = featureFlag("referral")
val featureDailyBonus = featureFlag("daily_bonus")
val featureTasks      = featureFlag("tasks")
val featureEarnHub    = featureFlag("earn_hub", featureReferral || featureDailyBonus || featureTasks)
val featureRewardsPush = featureFlag("rewards_push")
```

and inside `defaultConfig { ... }`:

```kotlin
buildConfigField("boolean", "FEATURE_REFERRAL",    "$featureReferral")
buildConfigField("boolean", "FEATURE_DAILY_BONUS", "$featureDailyBonus")
buildConfigField("boolean", "FEATURE_TASKS",       "$featureTasks")
buildConfigField("boolean", "FEATURE_EARN_HUB",    "$featureEarnHub")
buildConfigField("boolean", "FEATURE_REWARDS_PUSH","$featureRewardsPush")
```

plus, in the `android { }` block (AGP 8 needs this explicitly):

```kotlin
buildFeatures {
    compose = true
    buildConfig = true   // NEW — required for buildConfigField
}
```

Log the resolved flags once so a build log proves what went in:

```kotlin
logger.lifecycle("[features] referral=$featureReferral daily=$featureDailyBonus " +
    "tasks=$featureTasks hub=$featureEarnHub push=$featureRewardsPush")
```

### Why `BuildConfig` and not just reading the asset at runtime

- `BuildConfig` lives in `app-player`, so `:core` stays flag-free (models and API
  can exist for every build — only the app module decides whether to show them).
- A `false` literal lets R8 drop the whole screen class from the release APK.
- Switching to "off" during development is a Gradle property, no rebuild of
  resources needed beyond the normal incremental build.

---

## 3. Runtime layer: `FeatureFlags` object

New file `android/app-player/src/main/java/com/tourney/player/FeatureFlags.kt`:

```kotlin
object FeatureFlags {
    /** Baked in at build time from client_config.json / -Pfeature.* */
    val buildReferral    = BuildConfig.FEATURE_REFERRAL
    val buildDailyBonus  = BuildConfig.FEATURE_DAILY_BONUS
    val buildTasks       = BuildConfig.FEATURE_TASKS
    val buildEarnHub     = BuildConfig.FEATURE_EARN_HUB
    val buildRewardsPush = BuildConfig.FEATURE_REWARDS_PUSH

    private var server: Map<String, Boolean> = emptyMap()

    /** Called from PlayerViewModel after GET /tenant/settings (and on resume). */
    fun applyServerSettings(map: Map<String, Boolean>?) {
        server = map?.filterValues { true } ?: emptyMap()   // server can only subtract
    }

    private fun on(key: String, build: Boolean) = build && (server[key] ?: true)

    val referral    get() = on("referral", buildReferral)
    val dailyBonus  get() = on("daily_bonus", buildDailyBonus)
    val tasks       get() = on("tasks", buildTasks)
    val earnHub     get() = on("earn_hub", buildEarnHub) &&
        (referral || dailyBonus || tasks)          // never an empty hub
    val rewardsPush get() = on("rewards_push", buildRewardsPush)
    val anyRewards  get() = earnHub
}
```

`Compose` reads these directly; the bottom bar recomposes when a server flag
changes because `FeatureFlags` fields are plain `val`s read inside composition —
wrap them in `remember` at the nav level only if a value must stay stable per
session (it does not here).

Server side, extend the existing settings payload
(`GET /tenant/settings` → `tenantService.getTenantSettings`):

```json
"features": { "referral": true, "daily_bonus": false, "tasks": true, "earn_hub": true }
```

The Player app already pulls tenant settings on login/resume, so the kill switch
works on next app foreground — no APK update.

---

## 4. One-click tooling

`tools/features.ps1` (PowerShell, works on Windows without extra installs):

```
tools\features.ps1                          # show current flags + resolved state
tools\features.ps1 -Feature referral -Off   # flip one flag in client_config.json
tools\features.ps1 -All -Off                # kill all reward modules
tools\features.ps1 -All -On                 # turn everything back on
tools\features.ps1 -Feature tasks -On -Build  # flip + run :app-player:assembleDebug
```

`tools/features.bat` = thin wrapper so double-click works:

```bat
@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0features.ps1" %*
```

Build-time override without touching JSON (handy in CI):

```
./gradlew :app-player:assembleDebug -Pfeature.referral=false -Pfeature.daily_bonus=false
```

Script contract (implementation notes):
- Edits only the `features` object of
  `android/app-player/src/main/assets/client_config.json` *and*
  `clients/_template/client_config.json` when it exists (keeps template honest).
- Preserves key order and indentation (2 spaces) so git diffs stay one line.
- Refuses to run if the file is not valid JSON; prints the resolved flags after
  the edit, same order as the Gradle log.
- Never commits; the owner runs the usual commit.

---

## 5. Where the flags are read (implementation checklist)

| Place | Behaviour when OFF |
| --- | --- |
| `PlayerTab.entries` / `DemoBottomBar` | Rewards tab not rendered; bar back to 4 items |
| `PlayerNav` `composable("rewards")` … | Route not registered at all |
| `PlayerViewModel` daily-bonus probe on resume | Skipped — no `/rewards/*` call |
| Matches header coin button (Option B fallback) | Not rendered |
| Wallet "Earn more" card | Not rendered |
| Settings rows | Section hidden, not greyed |
| `TourneyMessagingService` `DAILY_BONUS_READY` | Notification dropped silently |
| API layer | Models stay in `:core` (harmless); no request is ever made |

Also keep a **debug-only** line so QA can prove the build:

```kotlin
if (BuildConfig.DEBUG) Log.i("FeatureFlags", "referral=${FeatureFlags.buildReferral} " +
    "daily=${FeatureFlags.buildDailyBonus} tasks=${FeatureFlags.buildTasks} hub=${FeatureFlags.buildEarnHub}")
```

---

## 6. Acceptance for this document

- [ ] `-Pfeature.referral=false` build installs with **no** Rewards tab, no coin
      button, no `/rewards` request in logcat.
- [ ] Default build (all flags true in JSON) shows the full hub.
- [ ] Server `PATCH /admin/tenant/settings { features: { tasks: false } }` hides
      tasks on next app foreground **without** rebuilding.
- [ ] `tools\features.ps1` round-trips the JSON without reformatting other keys.
- [ ] Release build with all flags off has no `ui/rewards/*` classes in the APK
      (`unzip -l app-release.apk | grep rewards` empty, R8 shrinking on).
