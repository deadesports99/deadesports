# 🤖 Master Prompt for Kimi K3.1 Pro (FreePI)
## Phase 1: Backend Scaffolding Implementation

> **Instructions for Jay:** Aap is pure prompt ko copy karke **FreePI (Kimi K3.1 Pro)** me paste kar dijiye. Kimi ko project ka pura context, folder structure aur exact instructions mil jayenge taaki wo bina kisi bug ke 100% production-ready code likh kar de.

---

```text
You are an Elite Principal Backend Architect specializing in high-concurrency Node.js, Express, TypeScript, Redis, and PostgreSQL/Prisma systems for real-money esports tournament platforms (like WinZO, Gamerji, and Khiladi Adda).

We are building the Core Backend for a Multi-Tenant Free Fire Tournament Platform.
The environment, dependencies, and folder structure have ALREADY been initialized on the developer's Windows machine.

### TECH STACK INSTALLED:
- Runtime: Node.js (TypeScript with tsx)
- Framework: Express.js (v4.x)
- Security & Middleware: cors, helmet, dotenv, zod
- Database & ORM: PostgreSQL (Supabase) with @prisma/client & prisma
- In-Memory Cache & Mutex: ioredis
- Target Module System: CommonJS / NodeNext (ES2022)

### CURRENT PROJECT DIRECTORY STRUCTURE:
C:\Free Fire turnament\backend\
├── node_modules/
├── src/
│   ├── config/          # Environment & Database/Redis clients
│   ├── controllers/     # Route handlers
│   ├── middlewares/     # Error, Auth, and Validation middlewares
│   ├── routes/          # Express route definitions
│   ├── services/        # Business logic & algorithms
│   ├── types/           # Custom TS interfaces & types
│   ├── utils/           # Response helpers & Custom Errors
│   ├── app.ts           # Express app definition & middleware pipeline
│   └── server.ts        # HTTP server listener & graceful shutdown
├── .env
├── .env.example
├── .gitignore
├── package.json
└── tsconfig.json

---

### YOUR MISSION:
Write the complete, clean, production-ready TypeScript code for Phase 1 (Backend Scaffolding).
Do NOT write placeholders like `// TODO: implement later`. Provide the full implementation for all files below:

#### 1. `src/utils/ApiError.ts`
- Create a custom `ApiError` class extending `Error`.
- Include properties: `statusCode: number`, `isOperational: boolean`, `details?: any`.
- Static convenience methods:
  - `badRequest(message, details)` (400)
  - `unauthorized(message)` (401)
  - `forbidden(message)` (403)
  - `notFound(message)` (404)
  - `conflict(message)` (409)
  - `internal(message)` (500)

#### 2. `src/utils/ApiResponse.ts`
- Standardized API response format for all JSON responses:
  ```ts
  interface ApiResponseData<T> {
    success: boolean;
    message: string;
    data?: T;
    statusCode: number;
  }
  ```
- Helper function `sendResponse<T>(res: Response, statusCode: number, message: string, data?: T)`

#### 3. `src/config/env.ts`
- Use `zod` to validate `process.env` at startup.
- Validate:
  - `PORT`: coerced number (default: 5000)
  - `NODE_ENV`: enum ['development', 'production', 'test'] (default: 'development')
  - `DATABASE_URL`: string (url)
  - `REDIS_URL`: string (default: 'redis://localhost:6379')
  - `JWT_SECRET`: string (min length 10)
  - `JWT_EXPIRES_IN`: string (default: '7d')
  - `CORS_ORIGIN`: string (comma-separated, transformed into string[])
- Throw clear descriptive error and terminate process (`process.exit(1)`) if any required env is missing or invalid.
- Export parsed `env` object.

#### 4. `src/config/redis.ts`
- Create and export a singleton `ioredis` instance using `env.REDIS_URL`.
- Add retry strategy (`retryStrategy(times)` with exponential backoff capped at 2000ms).
- Add event listeners: `connect`, `ready`, `error`, `reconnecting`, `close`.
- Handle graceful disconnection function `disconnectRedis(): Promise<void>`.

#### 5. `src/config/prisma.ts`
- Create and export a singleton `PrismaClient` instance.
- Enable `['query', 'error', 'warn']` logging in `development`, only `['error']` in `production`.
- Handle graceful disconnection function `disconnectPrisma(): Promise<void>`.

#### 6. `src/middlewares/errorHandler.ts`
- Global Express error handling middleware `(err, req, res, next)`.
- Handle `ApiError` instances -> return appropriate statusCode and message.
- Handle Zod `ZodError` -> return 400 with structured field-level error messages.
- Handle Prisma errors (e.g. `P2002` Unique Constraint Violation -> return 409 Conflict).
- For unhandled exceptions: return 500 with `"Internal Server Error"` (hide stack trace in production, show in development).

#### 7. `src/routes/health.routes.ts`
- Create Express Router with:
  - `GET /health` -> returns server uptime, memory usage, timestamp, environment.
  - `GET /health/db` -> queries PostgreSQL via Prisma (`prisma.$queryRaw\`SELECT 1\``) and returns latency in ms.
  - `GET /health/redis` -> sends `redis.ping()` and returns latency in ms.

#### 8. `src/app.ts`
- Express application instance:
  - Security headers: `helmet()`.
  - CORS configuration using `env.CORS_ORIGIN`.
  - Body parsers: `express.json({ limit: '10mb' })` and `express.urlencoded({ extended: true })`.
  - Request logger (simple console log: `[METHOD] /path - IP - timestamp`).
  - Mount `/health` routes at `/api/v1/health` and `/health`.
  - 404 handler for undefined routes throwing `ApiError.notFound('Route not found')`.
  - Mount `errorHandler` middleware at the very end.
  - Export `app`.

#### 9. `src/server.ts`
- Server listener importing `app` and `env`.
- Start server on `env.PORT`.
- Implement graceful shutdown listeners for `SIGINT` and `SIGTERM`:
  - Close HTTP server.
  - Disconnect Redis (`disconnectRedis()`).
  - Disconnect Prisma (`disconnectPrisma()`).
  - Exit cleanly with code 0.

---

### OUTPUT FORMAT:
Provide the file name clearly for each file, followed by the complete code block in TypeScript. Ensure zero missing imports, zero any-casting where strict types are applicable, and 100% compatibility with tsx and tsc.
```
