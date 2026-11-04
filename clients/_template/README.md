# 🧩 Client template — 10-minute white-label build

Copy this folder, rename it to your client slug (e.g. `clients/alpha_esports/`),
then edit **only** `client_config.json` and drop a logo in `icons/`.

```
clients/
└── alpha_esports/
    ├── client_config.json   # ← branding, backend, payments
    └── icons/
        └── app_icon.png     # ← 512×512 PNG with transparent padding (optional)
```

Then from the repo root:

```bat
package_client.bat alpha_esports
```

Output:

```
dist/alpha_esports/Player.apk   ← gamers
dist/alpha_esports/Admin.apk    ← owner + staff
dist/alpha_esports/build-info.json
```

## Field reference

| Field | Required | Notes |
| --- | --- | --- |
| `client.name` | ✅ | Internal slug/name used for the output folder |
| `client.app_name` | ✅ | Player app launcher label (≤ 30 chars for Play Store) |
| `client.admin_app_name` | – | Defaults to `<app_name> Admin` |
| `client.application_id` | ✅ | Unique, never reuse an existing Play Store package |
| `client.admin_application_id` | – | Defaults to `<application_id>.admin` |
| `client.version_name` / `version_code` | – | Defaults `1.0.0` / `1` — bump `version_code` for every upload |
| `theme.*` | ✅ | `primary_color` is a `#RRGGBB` hex; `corner_radius_dp` 4 = sharp, 12 = rounded, 999 = pill |
| `backend.api_base_url` | ✅ | Must end with `/api/v1` |
| `backend.tenant_id` | ✅ | The client's tenant UUID from their database (`Tenant.id`) |
| `backend.supabase_url` / `supabase_anon_key` | – | Only needed if the client later adds direct storage reads |
| `payments.upi_id` | ✅ | **The client's own** UPI ID — money never touches our account |
| `payments.upi_name` | ✅ | Payee name shown inside GPay/PhonePe |
| `payments.min_deposit` | – | Defaults `10` |
| `payments.support_whatsapp` | – | Digits with country code, e.g. `919876543210` (no `+`, no spaces) |
| `assets.app_icon` | – | 512×512 PNG. **Never ship Garena/Free Fire official logos as your app icon** |

## What the script does

1. Validates the config (hex colors, package id, URL, tenant id, UPI id).
2. Backs up, then injects `client_config.json` into **both** apps.
3. Themes the launcher icon background with `primary_color` and installs the
   client logo as the adaptive-icon foreground (icon files are restored after
   the build, so the repo stays client-neutral).
4. Runs `gradlew :app-player:assembleDebug :app-admin:assembleDebug`.
5. Copies the APKs to `dist/<client>/Player.apk` + `Admin.apk` with SHA-256
   hashes in `build-info.json`.

Add `--release` for R8 release APKs (unsigned unless you configure signing in
`android/app-player/build.gradle.kts`), `--no-build` to only validate + inject,
`--keep` to leave the injected files in place for a manual Gradle run.
