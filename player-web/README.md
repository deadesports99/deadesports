# player-web — demo UI wired to the real backend

This folder is a **copy** of the approved design (`ui-ux demo/finel demo`) and is the
one that gets connected to the live API, page by page. The original demo folder stays
untouched as the design reference.

```
player-web/
├─ src/
│  ├─ lib/api.ts          # typed client for the Express backend (auth done, feed/wallet next)
│  ├─ screens/            # LoginScreen, OtpScreen, TournamentsScreen, WalletScreen, SettingsScreen
│  ├─ components/         # cards, sheets, modals, navigation, ambient background
│  └─ data/mockData.ts    # still used by the pages that are not connected yet
└─ tools/webcheck.mjs     # headless Chrome smoke test for the flow
```

## Run it

```bash
cd player-web
npm install
npm run dev          # http://127.0.0.1:5173
```

`.env` (already present for local work, template in `.env.example`):

| key | meaning |
| --- | --- |
| `VITE_API_BASE_URL` | backend root, e.g. `http://localhost:5000/api/v1` |
| `VITE_TENANT_ID` | white-label tenant the app is scoped to |
| `VITE_DEV_AUTH` | `true` = skip Firebase SMS and use the server's `dev_otp_<phone>` shortcut |

The backend needs `DEV_FAKE_FIREBASE=true` (already set in `backend/.env`) while
`VITE_DEV_AUTH=true`, and `CORS_ORIGIN` must list the dev origin (`http://localhost:5173`).

## What is already connected

- **Sign In** — 10-digit phone validation, demo layout untouched.
- **OTP** — six boxes, resend timer, inline server errors.
  * Dev (`VITE_DEV_AUTH=true`): any 6 digits sign in via `dev_otp_<phone>`; a brand-new
    number is registered automatically.
  * Prod: send a Firebase ID token through `api.auth.loginWithToken(phone, idToken)`.
- **Session** — JWT + user in `localStorage`; the app reopens straight into the dashboard.
- **Sign out** — clears the stored session.

## What is still mock

Tournaments feed, match join, wallet balances, transactions, settings. Each one gets
swapped to real data in the same order the user asked for (feed → join → wallet).

## Headless check

```bash
# terminal 1
npm run dev
# terminal 2
chrome --headless=new --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-cdp http://127.0.0.1:5173/
node tools/webcheck.mjs http://127.0.0.1:5173 --phone 9876500011
```

It prints the three screens (Sign In → OTP → dashboard) and confirms the JWT was stored.
