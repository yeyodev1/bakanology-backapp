# Luisa Pita Bejarano Academy — Backend

## Stack
- Express 5 (CommonJS target) + TypeScript + Mongoose
- MongoDB, JWT (7d), bcryptjs, Cloudinary, Resend, Payphone (Ecuador payment gateway)
- pnpm with `node-linker=hoisted`

## Commands
| Command | What |
|---|---|
| `npm run dev` | Dev server via `ts-node-dev` (port 8100) |
| `npm run build` | `tsc` → `dist/` |
| `npm run format` | Prettier on `src/` |
| `npm run compile` | `tsc --watch` |
| `npm run delete:dreyes` | Delete seed admin user |
| `npm run fix:access` | Recompute `accessUntil` from latest approved payment |
| `pnpm ts-node src/scripts/find-users.ts <term>` | Search users by email/name |

No test, lint, or typecheck scripts exist.

## Commands that need `.env`
- `npm run dev` — requires `.env` with `DB_URI`, `JWT_SECRET`, etc.
- Any `src/scripts/*.ts` — runs via `ts-node`, needs `DB_URI` in `.env`
- `npm run build` — does NOT need `.env` (pure compile)

## Scripts (run via `ts-node`)
All scripts call `dbConnect()` and end with `process.exit(0)` manually.
- `seed-admin.ts` — runs automatically on every server start (idempotent). Creates `dreyes@bakano.ec / 123456789`
- `delete-user.ts` — deletes user + their payments by email
- `fix-access.ts` — recalculates `user.accessUntil` from latest approved Payment or ManualPayment
- `find-users.ts` — regex search across name/lastName/email

## Architecture
- `src/index.ts` → connects DB, seeds admin, starts HTTP server
- `api/index.ts` → Vercel serverless handler, lazy DB init singleton
- Routes at `/api/auth`, `/api/payments`, `/api/presale`, `/api/admin`, `/api/launch-reminders`
- Pattern: `route → middleware → controller → service → model`
- Controllers: try/catch → `next(error)`, use `successResponse(res, data, message, status?)`
- Errors: `CustomError(message, status, details?)`
- 500s optionally notify Slack webhook (`SLACK_ERROR_WEBHOOK`)

## Key conventions
- JWT payload: `{ userId, email, accountType }` — stored in `req.user`
- Auth header: `Bearer <token>` — check via `authMiddleware` or `adminMiddleware`
- Admin guard: checks `decoded.accountType !== "admin"` (note: model field is `role`, JWT payload field is `accountType`)
- Responses: `{ data, message }` (never `{ success: true, ... }`)
- Image upload: multer memoryStorage → Cloudinary. Allowed: jpg/png/webp/gif, max 5MB
- Email: all via Resend, from `RESEND_FROM_EMAIL`, templates in Spanish for Ecuador locale

## Deployment
- Vercel: `api/index.ts` → `@vercel/node`, all routes caught by `/(.*)`
- DB connects lazily on first request (serverless cold start)
- `node_modules` hoisted by `.npmrc` (pnpm default is isolated)

## .env essentials
`DB_URI`, `JWT_SECRET`, `FRONTEND_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
`PAYPHONE_TOKEN`, `PAYPHONE_STORE_ID`, `CLOUDINARY_*`, `ANNUAL_PRICE`, `MONTHLY_PRICE`,
`PRESALE_DEADLINE`, `ADMIN_WHATSAPP`
