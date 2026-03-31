# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── jhsc-tracker/       # JHSC Tracker React frontend
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## Application: JHSC Tracker

A workplace health and safety compliance tracker for Unifor Local 1285 at Saputo Georgetown. Built for the JHSC (Joint Health & Safety Committee) Worker Co-Chair.

### Features

- **Dashboard** — Stats overview (overdue count, open items, hazard findings, worker statements, closed this month), urgent/overdue alerts, recent activity feed
- **Action Items** — Full CRUD with status/priority/department tracking, due date overdue highlighting
- **Hazard Findings** — OHSA s.9 formal recommendations with OHSA reference codes, severity, response deadlines
- **Inspection Log** — Zone-by-zone inspections (11 zones matching actual facility), finding tracking with follow-up dates
- **Conduct Inspection** — Digital checklist for the 10-section / 50-item JHSC inspection form; rate each item A/B/C/X, add corrective actions + responsible parties, then export a fully filled Excel form (.xlsx) or save findings directly to the Inspection Log
- **Worker Statements** — Confidential statements tracked by code only (W-001), no worker names stored
- **Authentication** — Session-based login (bcrypt + express-session + PostgreSQL session store); admin auto-seeded on first run (username: admin, password: Unifor1285!)
- **Manage Users** — Admin-only page to create/edit/delete member accounts and assign per-module permissions
- **Documents** — Upload, browse, and download safety documents; category-based organisation (Meeting Minutes, Inspection Reports, Hazard Reports, OHSA References, Policies & Procedures, Worker Statements, Other); presigned GCS upload via Replit Object Storage; metadata stored in DB; per-user delete permission

### Auth & Permissions

- Roles: `admin` (full access, bypass all checks) and `member` (custom permission set)
- Permission keys: `dashboard`, `action-items`, `hazard-findings`, `inspection-log`, `conduct-inspection`, `worker-statements`, `import-data`, `documents`
- Frontend: `AuthContext` provides `user`, `login()`, `logout()`, `hasPermission()`; `ProtectedRoute` guards each page
- Sidebar hides nav items a member doesn't have access to; admin section ("Manage Users") only visible to admins
- All API routes except `/api/auth/*` and `/api/health` require a valid session

### Data Models

- `action_items` — AI-001 format codes, department, priority, status, due dates
- `hazard_findings` — HF-001 codes, OHSA references, severity, response deadlines
- `inspection_log` — IL-001 codes, 11 zones, areas, findings
- `worker_statements` — W-001 codes, shifts, hazard types, linked items
- `users` — username, displayName, passwordHash, role, permissions (JSON array), timestamps
- `documents` — title, description, category, fileName, fileSize, mimeType, objectPath, uploadedBy, timestamps
- `session` — auto-created by connect-pg-simple for session storage

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers
  - `health.ts` — GET /healthz
  - `actionItems.ts` — CRUD /action-items
  - `hazardFindings.ts` — CRUD /hazard-findings
  - `inspectionLog.ts` — CRUD /inspection-log
  - `workerStatements.ts` — CRUD /worker-statements
  - `dashboard.ts` — /dashboard/summary, /dashboard/overdue, /dashboard/recent
- Depends on: `@workspace/db`, `@workspace/api-zod`

### `artifacts/jhsc-tracker` (`@workspace/jhsc-tracker`)

React + Vite frontend for the JHSC Tracker. Uses IBM Plex Sans/Mono fonts, Unifor red (#E33225), and navy (#1a2744) sidebar branding.

- Entry: `src/App.tsx` — wouter router, pages by section
- Components: `src/components/ui/status-badges.tsx` — StatusBadge, PriorityBadge, DeptBadge
- Pages: dashboard, action-items, hazard-findings, inspection-log, worker-statements
- Depends on: `@workspace/api-client-react`

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

- `src/schema/actionItems.ts` — action_items table
- `src/schema/hazardFindings.ts` — hazard_findings table
- `src/schema/inspectionLog.ts` — inspection_log table
- `src/schema/workerStatements.ts` — worker_statements table
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`)

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`).

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec.
