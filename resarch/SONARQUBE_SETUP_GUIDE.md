# 🔍 SonarQube MCP & Code Quality Setup Guide (Hinglish)

> **Document:** SonarQube / SonarCloud Integration  
> **Project:** Free Fire Tournament Multi-Tenant Platform  
> **Status:** ✅ Configured in Workspace MCP (`.agents/mcp_config.json` & `mcp_config.json`)

---

## 🎯 1. SonarQube Ka Kaun Sa Type Best Rahega? (CLI & System Comparison)

SonarQube ke 2 main types hote hain. Aapke system aur CLI ke hisab se humne analysis kiya hai:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SONARQUBE TYPES COMPARISON                            │
├─────────────────────┬───────────────────────┬───────────────────────────────┤
│ Feature             │ ☁️ Option 1: SonarCloud │ 🐳 Option 2: Local Docker     │
│                     │ (RECOMMENDED ⭐)      │ (SonarQube Community)         │
├─────────────────────┼───────────────────────┼───────────────────────────────┤
│ System RAM Usage    │ 0 MB (Cloud par run   │ 3.5 GB - 4 GB RAM consume     │
│                     │ hota hai)             │ karega (heavy)                │
├─────────────────────┼───────────────────────┼───────────────────────────────┤
│ Pricing             │ Free for open-source/ │ 100% Free & Self-hosted       │
│                     │ community projects    │                               │
├─────────────────────┼───────────────────────┼───────────────────────────────┤
│ Setup Time          │ 2 Minutes (Sirf Token │ 15-20 Mins (Docker image      │
│                     │ generate karna hai)   │ download & ElasticSearch)     │
├─────────────────────┼───────────────────────┼───────────────────────────────┤
│ MCP AI Integration  │ 100% Supported        │ 100% Supported                │
└─────────────────────┴───────────────────────┴───────────────────────────────┘
```

👉 **Final Recommendation:** **SonarCloud (Cloud Version)** sabse best aur fast rahega!
Kyunki SonarQube ko local chalane me computer par 4 GB RAM lagti hai, jabki SonarCloud seedha cloud par chalta hai aur computer bilkul smooth rehta hai.

---

## 🔌 2. Project Me Kya-Kya Setup Ho Chuka Hai?

1. **Antigravity MCP Config:** [`.agents/mcp_config.json`](file:///C:/Free%20Fire%20turnament/.agents/mcp_config.json)
2. **Root MCP Config:** [`mcp_config.json`](file:///C:/Free%20Fire%20turnament/mcp_config.json)
3. **Scanner Rules File:** [`sonar-project.properties`](file:///C:/Free%20Fire%20turnament/sonar-project.properties) (Backend TypeScript + Android Kotlin dono ko scan karne ke liye rules).
4. **Environment Template:** [`.env.example`](file:///C:/Free%20Fire%20turnament/.env.example)

---

## 🔑 3. SonarCloud Token Kaise Generate Karein (3 Aasan Steps)

1. **[sonarcloud.io](https://sonarcloud.io)** par jayein aur apne **GitHub account** se login karein.
2. Top right me apne Avatar par click karein -> **My Account -> Security**.
3. **Generate Token** par click karein (Name: `freefire-mcp-token`).
4. Token copy karke apne `.env` file me paste kar dein:
   ```env
   SONARQUBE_URL=https://sonarcloud.io
   SONARQUBE_TOKEN=your_token_here
   ```

---

## 🚀 4. Terminal / CLI Se Scan Kaise Run Karein?

Jab bhi aapko dekhna ho ki code me koi bug, security leak ya code smell toh nahi hai, bas yeh ek command terminal me run kijiye:

```bash
# Pure project ka automatic static analysis scan
npx @sonar/scan
```

Yeh command aapke:
* `backend/src/` (Auth, Wallet, Redis Slot Lock, Room logic)
* `android/` (Jetpack Compose screens aur Retrofit network calls)
dono ko scan karke **Quality Gate Pass/Fail** report generate kar degi!

---

## 🤖 5. SonarQube MCP Se AI Agent Kya Karega?

MCP judne ke baad AI agent direct SonarQube se baat karega:
* *"Check Quality Gate status for my tournament engine."*
* *"Are there any SQL injection or security vulnerabilities in `wallet.service.ts`?"*
* *"Find code smells and suggest fixes before building production APK."*
