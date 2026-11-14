# 📧 Brevo setup — admin OTP mail (Phase 6)

> ### ✅ STATUS: CONFIGURED & VERIFIED (Nov 2026)
> Account: `deadesports99@gmail.com` · Plan: **free (300/din)** · Sender: **verified (active)**
> · IP blocking: **API keys = Deactivated** · `.env`: `EMAIL_PROVIDER=brevo` + key set.
> Live proof: `📧 [EMAIL:brevo] sent to=deadesports99@gmail.com` (201 + messageId).
> **Ye guide sirf dobara setup karna pade tab kaam aayega** (naya account / key rotate).

> **Kya hai:** Brevo (pehle Sendinblue) se hum OTP email bhejte hain. Free plan:
> **300 mail/din** — permanent, **credit card nahi chahiye**.
> **Kitna time:** 10 minute setup + account approval (kabhi kabhi 2 ghante se 48 ghante).
> **Code ready hai** — `backend/src/services/email.service.ts` me `brevo` provider already
> likha hua hai. Aapko sirf account + key chahiye.

---

## 0. Pehle ye samajh lo (3 line)

- Brevo me **2 tarah ki keys** hoti hain: **API key** (`xkeysib-...`) aur **SMTP key**.
  Hum **API key** use karte hain. **SMTP key galat hai** — usse `401` aayega.
- Jo email se mail bhejna hai, wo Brevo me **verified sender** hona chahiye. Warna
  `Sender not authorized` aata hai.
- API key **sirf ek baar** dikhti hai. Copy karke turant `.env` me daalo.

---

## 1. Account banao

1. Kholo: **https://www.brevo.com/signup/**
   (ya seedha dashboard: https://app.brevo.com)
2. Email + password daalo → **verify email** (inbox me link aayega).
3. Onboarding questionnaire aayega — company name / address maango to apna naam-address
   daal do (koi legal verification nahi hoti free plan pe).
4. ⚠️ Naye accounts kabhi kabhi **review** me jaate hain — mail aayega activate hone par.
   Ye **2 ghante se 2 din** le sakta hai. Tab tak mail bhejne ki koshish mat karo.

---

## 2. Sender verify karo (ye step miss karoge to mail fail hoga)

**Link:** https://app.brevo.com/senders

1. Dashboard me bottom-left **Settings** → **Senders, Domains & Dedicated IPs** → tab **Senders**
2. **Add a sender** click karo
3. **From name:** `Thunder eSports` (ya aapka brand)
   **From email:** wo email jo aapke paas hai — jaise `deadesports99@gmail.com`
4. **Save** → us email par Brevo ka verification mail aayega → usme **click** karo
5. Status **Verified** dikhne lage to done ✅

> **Domain auth (optional, baad me):** apna domain lo to
> **Senders, Domains & Dedicated IPs → Domains → Add domain** → DNS me SPF/DKIM records
> daalo. Isse mail inbox me jaane ke chances badh jate hain (`no-reply@yourdomain` bhi chalega).
> Abhi Gmail sender se kaam chal jayega.

---

## 3. API key banao

**Link:** https://app.brevo.com/settings/keys/api

1. Dashboard bottom-left **Settings** → **SMTP & API** → **API Keys & MCP**
2. **Generate API key**
3. Brevo ek **verification code** maangega (aapke email/phone par) → daalo → **Verify**
4. **Key name:** `ff-admin-backend`
5. **Expiry:** **No expiration** chuno
   > ⚠️ No-expiry key bhi **90 din** tak koi successful API call na ho to deactivate ho jati hai
6. **Access:** **Restricted** (recommended) → permissions me
   **Transactional Email = Read/Write** (ya `All`) → baaki `None`
   *(Seedha rasta chahiye to **Full** bhi chalega, par Restricted safer hai.)*
7. **Copy** karo — key `xkeysib-...` se shuru hoti hai. **Sirf ek baar dikhti hai.**
8. **"I've saved my key"** click karo

---

## 4. IP blocking band karo (Render ke liye zaroori)

Brevo har API call ka IP note karta hai. Pehle kuch din wo "learning phase" me rehta hai
(aapke IPs khud authorize ho jate hain — /24 subnet matlab poora 256 ka range).
**30 din tak koi naya IP na aaye to Brevo khud blocking ON kar deta hai** — aur phir aapke
naye IP (ghar ka ya Render ka) block ho jate hain. Hamare case me wahi hua hai.
Render ke IP badalte rehte hain, isliye **deactivate** karna hi sahi hai.

> Sirf account owner, ya jis user ke paas **SMTP & API → Authorized IPs** permission hai,
> wo hi ye badal sakta hai.

### Exact steps

1. Kholo: **https://app.brevo.com/security/authorised_ips**
   (ya menu se: apna naam/account → **Settings** → sidebar me **Security** → tab **Authorized IPs**)
2. Section: **Blocking unauthorized IP addresses**
3. Yahan **do alag row** hongi — sirf **API keys** wali dekho:

   | Row | Aapko kya karna hai |
   |---|---|
   | **API keys** | status **Activated** hoga → right side button **Deactivate for API** dabao |
   | SMTP keys | isko **mat chhedo** (hum SMTP use nahi karte) |

4. Confirm dialog me **Deactivate blocking** dabao
5. Confirm karo ki **API keys** row ab **Deactivated** dikh rahi hai

### Dhyan rakho

- ❌ API key **delete/disable mat karo** — ye setting sirf IP ka darwaza kholti hai, key nahi banti/badalni
- ❌ **"Authorize IP address" me sirf apna ghar ka IP mat daalo** — Render ka IP alag hoga aur
  kal badal bhi jayega. Blocking off karna hi sahi hai
- ✅ Blocking off hone ka matlab security gayi nahi — API **key** ke bina koi kuch nahi kar sakta

### Confirm

Usi page pe **API keys** = `Deactivated` dikhna chahiye. Uske baad `npm run dev` se
backend restart karo (`.env` badla hai) aur OTP login test karo.

---

## 5. `.env` me daalo

`backend/.env` file kholo (`backend/.env.example` se copy kar sakte ho agar nahi hai) aur
ye 3 line set karo:

```env
EMAIL_PROVIDER=brevo
BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM="Thunder eSports <deadesports99@gmail.com>"
```

`EMAIL_FROM` me **wahi email** hona chahiye jo step 2 me verify kiya — warna
`Sender not authorized` aayega.

Baaki defaults theek hain:
```env
EMAIL_TIMEOUT_MS=10000      # ek hung request login block na kare
ADMIN_OTP_DAILY_CAP=10      # per account 24h me max 10 code
```

> `.env` git me **nahi** jati (`.gitignore` me hai). Key kisi ko mat bhejo,
> screenshot me mat lo, WhatsApp pe mat paste karo.

---

## 6. Test karo

### Tarika A — seedha Brevo API se (backend restart se pehle)

Git Bash:
```bash
curl -sS -X POST https://api.brevo.com/v3/smtp/email \
  -H "api-key: $BREVO_API_KEY" \
  -H "content-type: application/json" \
  -H "accept: application/json" \
  -d '{"sender":{"name":"Thunder eSports","email":"deadesports99@gmail.com"},"to":[{"email":"deadesports99@gmail.com"}],"subject":"Brevo test","htmlContent":"<b>Chal gaya bhai</b>"}'
```

PowerShell:
```powershell
curl.exe -X POST https://api.brevo.com/v3/smtp/email `
  -H "api-key: xkeysib-..." -H "content-type: application/json" `
  -d '{\"sender\":{\"name\":\"Thunder eSports\",\"email\":\"deadesports99@gmail.com\"},\"to\":[{\"email\":\"deadesports99@gmail.com\"}],\"subject\":\"Brevo test\",\"htmlContent\":\"<b>Chal gaya</b>\"}'
```

- **Success:** `{"messageId":"<...@brevo>"}`
- **Fail:** error JSON — neeche troubleshooting table dekho

### Tarika B — poore app se (asli test)

```bash
cd backend && npm run dev
```
Phir admin panel (`http://localhost:5174`) → Owner login → email → **Send code**.

**Screen pe:** 6-digit OTP box
**Mail me:** subject `Thunder eSports — admin sign-in code 123456` (branded HTML, bada code)
**Backend log me:**
```
📧 [EMAIL:brevo] sent to=deadesports99@gmail.com
```
Ye line aayi = **kaam kar gaya** ✅

---

## 7. Troubleshooting — error se pehchano

| Error / Message | Matlab | Fix |
|---|---|---|
| `401 Key not found` | Galat key | API key dobara banao (`xkeysib-` wali). **SMTP key** galti se use nahi hui? |
| `401 Unauthorized` | Key inactive | 90 din me API call nahi hui, ya key delete ho gayi. Nayi banao |
| `400 Sender not authorized` | `EMAIL_FROM` verify nahi hai | Step 2 karo, ya `EMAIL_FROM` ko verified email par badlo |
| `400 "Only one content type"` | html + text dono bheje gaye | Hamare code me already fix hai — ek hi body jaati hai |
| `400 Invalid email address` | `EMAIL_FROM` format galat | `"Naam <email@x.com>"` format rakho |
| `429 / daily limit` | 300/din khatam | Agle din, ya `EMAIL_PROVIDER=resend` pe switch (free 3000/mahina) |
| Backend: `502 Could not send the sign-in code` | Provider fail | Backend console me `✖ admin OTP email failed: ...` dekho — wahan asli wajah hogi |
| Mail aaya hi nahi | Spam folder | Spam check karo; domain auth lagaoge to inbox me aayega |

> Backend ka error log **kabhi** OTP value ya API key nahi chhapata — ye test se prove kiya hua hai
> (`backend/tests/emailProvider.test.ts`).

---

## 8. Quota ka hisaab — kab problem hogi

| Kaun | Roz kitne OTP | Note |
|---|---|---|
| Owner | 2-5 | |
| Sub-admin (har ek) | 2-10 | `ADMIN_OTP_DAILY_CAP=10` per account |
| **Players** (email login) | ?? | Player OTP bhi **isi** provider se jata hai |
| Brevo free limit | **300/din total** | |

**10 staff × 10 OTP = 100** → theek. Par **players badh gaye to 300/din kam pad sakta hai.**
Us waqt:
1. `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` — free **3000/mahina**
2. Ya Brevo paid (~$9/mahina)

Code me provider switch ek line ka kaam hai — kuch aur nahi badalna.

---

## 9. Links — sab ek jagah

| Kaam | Link |
|---|---|
| Signup | https://www.brevo.com/signup/ |
| Login / dashboard | https://app.brevo.com |
| **Senders verify** | https://app.brevo.com/senders |
| **API keys** | https://app.brevo.com/settings/keys/api |
| **IP blocking off** | https://app.brevo.com/security/authorised_ips |
| Pricing / free limits | https://www.brevo.com/pricing/ |
| API docs — send email | https://developers.brevo.com/reference/send-transac-email |
| API keys ka help article | https://help.brevo.com/hc/en-us/articles/40159485019794 |
| IP authorize/block help | https://help.brevo.com/hc/en-us/articles/5740111683858 |
| Transactional logs (mail gaya ya nahi) | https://app.brevo.com/transactional-email/logs |

---

## 10. Checklist — tick karke aage badho

- [x] Brevo account bana + email verify
- [x] Account approved (mail aaya)
- [x] Sender verify (`https://app.brevo.com/senders` me "Verified") — 2 senders active
- [x] API key bani (`xkeysib-...` copy ho gayi)
- [x] Security → Authorized IPs → **API keys = Deactivated**
- [x] `backend/.env` me 3 line daali
- [x] Test mail aaya (API 201 + `email.service.ts` se bhi)
- [ ] Admin panel se OTP login chal gaya  ← **aakhri step, aapka**

**Sab tick?** Ab panel **asli mail pe kaam karta hai** — OTP server ke log me nahi, aapke
inbox me aayega.
