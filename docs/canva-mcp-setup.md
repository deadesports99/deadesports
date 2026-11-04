# Canva Pro ko agent/CLI se chalane ka best setup (verified 2026-11)

TL;DR — Canva ka **official remote MCP server** use karo:
`https://api.canva.com/connect/v1/mcp`

Ye tumhare hi Canva Pro account se designs banata hai, photos edit karta hai
(background remove, layer separate), resize karta hai aur PNG/PDF/SVG export deta hai.
CLI se direct Canva ka koi "design editing" command nahi hai — MCP hi wo raasta hai.
(`@canva/cli` sirf Canva app *banane* ke liye hai, design banane ke liye nahi.)

Canva Pro plan hi ye unlock karta hai: **resize-design, autofill-design, brand kits,
brand templates**. Tumhare paas Pro hai, to sab available hoga.

---

## 1. Kya kya kar sakte ho (real tool list)

| Kaam | Tool |
|---|---|
| Logo / image generation (prompt se) | `generate-image` + `get-generate-image-job` |
| Uploaded photo ko edit karna (reference image) | `generate-image` (`imageReferences`) |
| Background remove (transparent PNG) | `remove-background` |
| Flat image ko editable layers me todna | `separate-image-layers` |
| Poora design brief se banana (poster, banner, app icon sheet) | `generate-design` → `create-design-from-candidate` / `create-design` |
| Design ko naye size me (1080x1080 → 1920x1080 etc.) | `resize-design` |
| Text/colour/image replace karna | `start-editing-transaction` → `perform-editing-operations` → `commit-editing-transaction` |
| Local file upload (bytes bhej ke) | `create-upload-url` + ek `curl` POST |
| Public URL se asset import | `upload-asset-from-url` |
| Brand kit colours/fonts | `list-brand-kits` |
| Brand template se on-brand design + autofill | `search-brand-templates`, `create-design-from-brand-template`, `get-design-dataset`, `autofill-design` |
| Export PNG/JPG/PDF/PPTX/MP4 | `get-export-formats`, `export-design` |
| Design library search / folders / comments | `search-designs`, `list-folder-items`, `comment-on-design` etc. |

Photo editing ka practical matlab: local photo → `create-upload-url` → `remove-background`
ya `generate-image` (with `imageReferences`) → `export-design` → download.
Canva editor ki magic tools (Magic Eraser type) MCP me nahi hain, but bg removal,
layer separation, AI edit aur export sab hain.

---

## 2. One-time setup (~10 min)

### Step 1 — Developer Portal me app banao
1. https://www.canva.com/developers/apps → **Create app** (free, Pro plan se alag cheez hai).
2. App khulne par left me **Outside Canva** → **Start integrating**.

### Step 2 — Canva MCP on karo
- **Outside Canva → Configuration → Integration methods** me **Canva MCP** toggle ON.
  (Canva REST APIs OFF hi rehne do, zarurat nahi.)
- **Credentials** me **Client ID** copy karo, **Generate secret** dabao aur secret
  ( `cnvca...` se shuru hota hai ) safe jagah rakho — dobara nahi dikhega.

### Step 3 — Redirect URL add karo
**Outside Canva → Redirect URLs** me ye do URL daalo (exact match chahiye):

```
http://127.0.0.1:8765/callback          <- pi (native OAuth)
http://localhost:8791/oauth/callback    <- mcp-remote bridge (Claude Code / Gemini / OpenCode)
```

### Step 4 — Secrets (do jagah, dono user-level)

**(a) pi ke liye** — `~/.free-pi/agent/mcp.json` ke `oauth` block me **seedha** client id aur secret
rakhna padta hai, kyunki pi `oauth.clientId` me `${VAR}` expand **nahi** karta (test kiya: literal
`${CANVA_CLIENT_ID}` bhej deta hai aur sign-in fail hota hai). Ye file repo ke bahar hai, isliye
secret git me nahi jaata.

**(b) mcp-remote bridge (Claude Code / Gemini / OpenCode) ke liye** — wahan env vars theek chalti hain.
Windows (PowerShell ya cmd, ek baar):

```powershell
setx CANVA_CLIENT_ID "OC-XXXXXXXX-XXXXXX"
setx CANVA_CLIENT_SECRET "cnvcaXXXXXXXXXXXXXXXX"
```

Naya terminal kholo, phir check:

```bash
echo "$CANVA_CLIENT_ID"   # Git Bash me empty dikhe to `export` se set karo ya naya shell
```

Git Bash me permanently rakhna ho to `~/.bashrc` me:

```bash
export CANVA_CLIENT_ID="OC-..."
export CANVA_CLIENT_SECRET="cnvca..."
```

### ### Step 5 — pi me server configured hai (`~/.free-pi/agent/mcp.json`)

```json
{
  "mcpServers": {
    "canva": {
      "url": "https://api.canva.com/connect/v1/mcp",
      "description": "Canva: generate logos/images, edit photos, remove backgrounds, resize, export PNG/PDF/SVG, brand kits and templates",
      "exposure": "deferred",
      "oauth": {
        "clientId": "OC-XXXXXXXX-XXXXXX",
        "clientSecret": "cnvcaXXXXXXXXXXXXXXXX",
        "callbackUrl": "http://127.0.0.1:8765/callback"
      }
    }
  }
}
```

Ab login:

```bash
pi mcp list            # canva: needs sign-in (deferred, global)  <- normal
pi mcp login canva     # browser khulega -> Canva se Allow
pi mcp list            # canva: connected, NN tools
```

Session ke andar `/mcp` se bhi sign-in / reconnect / exposure badal sakte ho.
Login ke baad agent `tool_search("canva logo generate")` ya `codemode` se tools call karega
(`mcp__canva__generate-image` etc.). Tokens `~/.free-pi/agent/mcp-auth.json` me rehte hain
aur auto-refresh hote hain.

### Step 6 — Verify
```bash
pi mcp list
```
`canva: connected, 49 tools` dikhna chahiye. Agar `needs sign-in` reh jaye to Step 2/3/4 wapas check karo
(secret ya redirect URL mismatch = sign-in fail).

**Port 8765 busy** error aaye to purana login process zinda hai:
```bash
netstat -ano | grep 8765        # PID dekho
taskkill //PID <PID> //F
```

---

## 2b. Verified status (04 Nov 2026)

- `pi mcp list` → `canva: connected, 49 tools` ✅
- Account: **jay kumar** (token `~/.free-pi/agent/mcp-auth.json`, auto-refresh) ✅
- `generate-image` real run: 1264x1264 esports shield+flame logo bana, media id `MAHZ4799y4s`
  → preview `ui-ux demo/free fire assests/canva-logo-gen-1.png` ✅
- Standalone CLI helper bhi hai (pi session ke bahar bhi chalta hai):
  ```bash
  node tools/canva-call.mjs get-assets '{"asset_ids":["MAHZ4799y4s"]}' "ui-ux demo/free fire assests"
  node tools/canva-call.mjs search-designs '{"query":"free fire"}'
  node tools/canva-call.mjs list-brand-kits '{}'
  ```
  Ye stored token use karta hai, naya login nahi maangta.

---

## 3. Doosre agents (Claude Code, Gemini CLI, OpenCode, Qwen)

Ye sab stdio MCP samajhte hain, remote nahi — to `mcp-remote` bridge use karo.
Client secret process list me na dikhe isliye env var se aata hai:

```bash
npx -y mcp-remote@latest https://api.canva.com/connect/v1/mcp 8791 \
  --static-oauth-client-info "{\"client_id\":\"$CANVA_CLIENT_ID\",\"client_secret\":\"$CANVA_CLIENT_SECRET\"}" \
  --static-oauth-client-metadata '{"token_endpoint_auth_method":"client_secret_basic"}'
```

- Port `8791` explicitly diya hai — isi liye redirect URL `http://localhost:8791/oauth/callback`
  Developer Portal me registered hona chahiye.
- Agar token error aaye to `client_secret_basic` ko `client_secret_post` karke dekho
  (Canva dono support karta hai, Basic recommended hai).

Claude Code me add karne ka tarika:

```bash
claude mcp add canva -- npx -y mcp-remote@latest https://api.canva.com/connect/v1/mcp 8791 \
  --static-oauth-client-info "{\"client_id\":\"$CANVA_CLIENT_ID\",\"client_secret\":\"$CANVA_CLIENT_SECRET\"}" \
  --static-oauth-client-metadata '{"token_endpoint_auth_method":"client_secret_basic"}'
```

Project ke shared `mcp_config.json` me bhi `canva` entry add kar di gayi hai
(env vars se hi credentials aate hain, koi secret file me nahi).

Login ka token har agent ka apna alag hota hai (per-client), to har naye client par
ek baar browser me "Allow" karna padega.

---

## 4. Roz ke workflows (agent ko seedha ye prompt do)

**Logo banao**
> Canva se 3 logo concepts banao for "Free Fire Tournament" esports brand: generate-image
> se 3 variants (dark bg, neon orange accent, minimal monogram), phir jo best lage usko
> 512x512 aur 1024x1024 me export karke `ui-ux demo/free fire assests/` me save karo.

**Existing photo edit (background remove + naya bg)**
> Ye photo upload karo (create-upload-url + curl POST), background remove karo, phir
> dark gradient background wale 1080x1080 banner me daalo, PNG export karo.

**Local file upload (agent ko ye exact steps dene hain)**
1. `create-upload-url` → `uploadUrl` milta hai
2. ```bash
   curl -X POST "<uploadUrl>" -H "Content-Type: application/octet-stream" \
        --data-binary "@/path/to/photo.png"
   ```
3. Response ka `mediaId` use karo `remove-background` / `generate-image` me.

**On-brand kit**
> Brand kit ke colours use karke Play Store feature graphic (1024x500), app icon (512x512)
> aur 3 screenshot frames banao; brand template ho to wahi se autofill karo.

**Export turant download**
`export-design` ke URLs **signed aur short-lived** hote hain — turant download karo:
```bash
./tools/canva-dl.sh "<export-url>" "ui-ux demo/free fire assests/banner-1080.png"
```

---

## 5. Dhyan rakhne wali baatein
- Har user apne Canva account se auth karta hai; permissions usi design ke hisaab se lagti hain.
- Export links expire hote hain — store mat karo, download karke rakho.
- Rate limits: https://www.canva.dev/docs/apps/mcp/tools/
- Generated image ka full-res file: `generate-image` sirf media id deta hai (thumbnail 200px milta hai).
  Poora PNG chahiye to us media ko design/brand template me daalo → `export-design` → `tools/canva-dl.sh`,
  ya seedha `https://www.canva.com/M/<mediaId>` link kholkar Download kar lo.
- Pi session pehle se chal raha ho to naye server ke tools usme nahi hote → `/mcp reconnect canva`
  ya pi restart karo. Turant kaam chahiye to `node tools/canva-call.mjs <tool> '<json>'`.
- Pro-only: resize, autofill, brand kits, brand templates. (Tumhare paas Pro hai.)
- `upload-asset-from-url` sirf public **HTTPS** URL leta hai (200 return kare) — local file ke liye
  `create-upload-url` use karo.
- Canva **Dev MCP** (`npx -y @canva/cli@latest mcp`) alag cheez hai: wo Canva *apps* banane me
  help karta hai, design banane me nahi. Confuse na hona.
- Design handoff: har design ka `edit_url` agent se maango, taaki Canva editor me khud tweak kar sako.

## 6. Troubleshooting
| Symptom | Fix |
|---|---|
| `canva: needs sign-in` | `pi mcp login canva` |
| Sign-in ke baad bhi error | redirect URL exact match karo (`http://127.0.0.1:8765/callback`) |
| `invalid_client` | client ID/secret galat ya secret regenerate karna padega |
| `fetch_failed` (upload-asset-from-url) | URL public HTTPS + 200 hona chahiye |
| Tools list khali | `/mcp` → canva → reconnect; `pi mcp list` se error dekho |
| Agent tools nahi dhoondh pa raha | tools `deferred` mode me hain → `tool_search("canva export")` bolo |