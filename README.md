# Brick Studio

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-green)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Brick Studio is an AI-powered platform for designing, specifying, and generating full-stack applications from visual architecture diagrams. Design your system as a node graph, fill in component specs and data contracts, then let AI agents generate the code.

## How It Works

1. **Design** — Drag-and-drop architecture canvas with 14 component types (services, databases, queues, CDN, etc.)
2. **Specify** — Click nodes to add descriptions, input/output contracts, and implementation notes. Click edges to define data contracts between components.
3. **Generate** — AI agents read the BAC (Brick App Contract) and generate code for each component with full context of the architecture.
4. **Preview** — Docker-based local preview to test generated code.

The BAC is the canonical contract layer — a structured JSON document that captures every node, edge, spec, and data contract in your architecture. It's what the AI agents read to understand what to build.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Frontend (Vite + React + TypeScript)           │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │Dashboard │ │Workspace │ │Architecture      │ │
│  │          │ │  View    │ │  Canvas (xyflow) │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
├─────────────────────────────────────────────────┤
│  Backend (Express + TypeScript)                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │Auth (JWT)│ │Projects  │ │Session Manager   │ │
│  │          │ │  CRUD    │ │(arch, BAC, specs)│ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │LLM Router│ │Codegen   │ │Docker Preview    │ │
│  │(OpenRtr) │ │  Stream  │ │  (Compose)       │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
├─────────────────────────────────────────────────┤
│  Worker (BullMQ)  │  PostgreSQL  │  Redis       │
└─────────────────────────────────────────────────┘
```

**Modular monolith** — Web server (Express on port 3333), background worker (BullMQ), PostgreSQL for persistence, Redis for job queues. Frontend is a Vite+React SPA served by Express.

## Quick Start

### Prerequisites
- Docker & Docker Compose
- At least one LLM API key: `OPENROUTER_API_KEY` (preferred), `ANTHROPIC_API_KEY`, or `OPENAI_API_KEY`

### Run with Docker (recommended)

```bash
# Set your API key
export OPENROUTER_API_KEY=your_key_here

# Start all services
docker compose up -d

# Open in browser
open http://localhost:3333
```

### Local Development

```bash
# Backend
npm install
npm run dev -- server

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

## Frontend Stack

- **React 18** with TypeScript
- **@xyflow/react** (ReactFlow v12) — Architecture canvas with custom nodes, handles, edge editing
- **dagre** — Auto-layout for architecture graphs
- **Monaco Editor** — Code editing for generated files
- **@dnd-kit** — Drag-and-drop for kanban/feature boards
- **Iconify** — Icon system (CDN-loaded)
- Dark theme with indigo accent (#6366f1), Inter + JetBrains Mono fonts

## Key Features

### Architecture Canvas
- 14 component types: service, static_site, database, cache, queue, worker, cdn, api_gateway, load_balancer, auth, storage, search, monitoring, ml_model
- Drag-and-drop node placement from palette
- Visual connection creation between components
- Auto-layout via dagre (top-to-bottom)
- Edge type toggle (bezier/straight/step)
- Completeness indicators (red/green dots) for spec coverage

### Component Detail Panel
- Slide-out panel on node click
- Editable fields: description, input contract, output contract, implementation notes
- Connection contract editing (label + data contract per edge)
- Inner component definitions
- Auto-save with 800ms debounce

### BAC (Brick App Contract)
- Structured JSON capturing the full architecture specification
- Nodes with specs (description, inputs, outputs, runtime, framework)
- Edges with labels, protocols, and data contracts
- Completeness checking via `GET /api/bac/completeness`
- Patch operations for incremental updates

### Code Generation
- SSE streaming from `POST /api/generate-code`
- Targeted edit strategy (only regenerate changed components)
- Full regeneration fallback
- Generated files viewable/editable in Monaco editor

### Templates
- 9 pre-built architecture templates (web app, API backend, microservices, etc.)
- One-click loading into the canvas

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/signup` | POST | Create account |
| `/api/auth/login` | POST | Get JWT token |
| `/api/projects` | GET/POST | List/create projects |
| `/api/projects/:id` | GET/PATCH/DELETE | Project CRUD |
| `/api/architecture` | GET/POST | Get/set architecture |
| `/api/architecture/name` | PUT | Rename architecture |
| `/api/component` | POST/PUT/DELETE | Component CRUD |
| `/api/connection` | POST/PUT/DELETE | Connection CRUD |
| `/api/component-specs` | GET/PUT | Component specifications |
| `/api/bac` | GET/PUT/PATCH | BAC operations |
| `/api/bac/completeness` | GET | Check spec completeness |
| `/api/bac/from-intent` | POST | Generate BAC from text |
| `/api/templates` | GET | List architecture templates |
| `/api/template` | POST | Load template |
| `/api/generate-stream` | POST | Stream AI chat (SSE) |
| `/api/generate-code` | POST | Stream code generation (SSE) |
| `/api/files` | GET | List generated files |
| `/api/file` | GET/PUT | Read/edit generated files |
| `/api/config` | GET | LLM configuration |
| `/api/preview/:id/start` | POST | Start Docker preview |

## Project Structure

```
brick-by-brick/
├── frontend/              # Vite + React SPA
│   └── src/
│       ├── api/           # API client + types
│       ├── components/    # React components
│       │   ├── dashboard/ # Project listing
│       │   └── workspace/ # Architecture canvas, detail panel, editor
│       └── hooks/         # Shared hooks (debounce, etc.)
├── src/
│   ├── server/            # Express backend
│   │   ├── routes/        # API route handlers
│   │   ├── db/            # PostgreSQL migrations + queries
│   │   └── services/      # Session manager, LLM, codegen
│   ├── worker/            # BullMQ background jobs
│   └── landing/           # Marketing pages
├── backlog/               # Feature specs for incomplete work (see Backlog section)
├── docker-compose.yml     # Postgres + Redis + Web + Worker
├── Dockerfile.web         # 3-stage: backend-builder, frontend-builder, production
└── Dockerfile.worker      # Worker service
```

## What Works Today

The core design-to-generate loop is functional for single-user, single-session workflows:

| Feature | Status | Notes |
|---------|--------|-------|
| Auth (signup/login) | Working | JWT-based, persists to DB |
| Dashboard & project CRUD | Working | Full DB persistence |
| Architecture canvas | Working | Nodes, edges, handles, drag-and-drop, auto-layout |
| Component detail panel | Working | Specs auto-save to session |
| Edge editing | Working | Label + data contract editing |
| AI chat | Working | Streaming LLM chat with architecture updates |
| Code generation | Working | SSE streaming, targeted edits |
| Code editor | Working | Monaco with syntax highlighting, manual edits |
| Template loading | Working | 9 pre-built templates |
| Project rename | Working | Syncs to both session and DB |
| Completeness indicators | Working | Red/green dots on nodes |
| Feature board (Kanban) | UI only | Drag-and-drop works, no backend persistence |
| Docker preview | UI ready | Backend endpoints exist, needs end-to-end verification |
| Docs tab | Placeholder | Backend agent exists but not wired to UI |
| GitHub integration | Partial | Backend OAuth exists, frontend only has connect button |

## Backlog

The following features are incomplete or have known gaps. Each item has a detailed specification in the [`backlog/`](./backlog/) directory with implementation context, affected files, and acceptance criteria.

### Critical — Data Loss Risk

| # | Feature | Detail | Issue |
|---|---------|--------|-------|
| [001](./backlog/001-session-persistence.md) | Session-to-DB Persistence | Architecture, specs, BAC live in-memory only | Server restart loses all design work |
| [002](./backlog/002-unified-project-system.md) | Unified Project System | Two conflicting save systems (DB vs in-memory) | Data divergence between dashboard and workspace |

### High — Core Functionality Gaps

| # | Feature | Detail | Issue |
|---|---------|--------|-------|
| [006](./backlog/006-multi-user-session-isolation.md) | Multi-User Session Isolation | Sessions are global, not per-user | Two users can corrupt each other's work |
| [009](./backlog/009-generated-files-persistence.md) | Generated File Persistence | Code files only in memory + optional disk stash | Files lost on refresh unless explicitly saved |
| [010](./backlog/010-deploy-pipeline-integrity.md) | Deploy Pipeline Integrity | Deploy reads stale DB architecture | Deployed app doesn't match canvas design |

### Medium — Missing Features

| # | Feature | Detail | Issue |
|---|---------|--------|-------|
| [003](./backlog/003-feature-board-backend.md) | Feature Board Backend | Kanban UI works but no persistence | Features lost on page reload |
| [004](./backlog/004-docs-generation-tab.md) | Docs Generation Tab | Backend docs agent exists | UI shows placeholder, not wired to agent |
| [005](./backlog/005-chat-history-persistence.md) | Chat History Persistence | Messages in React state only | Conversation lost on refresh |

### Low — Polish & Integrations

| # | Feature | Detail | Issue |
|---|---------|--------|-------|
| [007](./backlog/007-inner-components-persistence.md) | Inner Components Persistence | UI exists in detail panel | Add/edit works but never saves to backend |
| [008](./backlog/008-github-integration.md) | GitHub Integration | Backend OAuth flow exists | No push-to-repo UI, no callback handler |
| [011](./backlog/011-settings-model-persistence.md) | LLM Model Persistence | Model selection in session only | Reverts to default on new tab or restart |

### Dependency Graph

Items 001 and 002 are foundational — most other backlog items become simpler once session state auto-syncs to the database.

```
001 Session Persistence ─┬─→ 009 File Persistence ─→ 010 Deploy Integrity
                         ├─→ 005 Chat Persistence
                         └─→ 011 Model Persistence

002 Unified Projects ────→ 003 Feature Board (needs project-scoped DB tables)

006 Session Isolation ───→ (independent, but should be done before multi-user launch)

004 Docs Tab ────────────→ (independent, backend agent already exists)
007 Inner Components ────→ (independent, extends existing ComponentSpec)
008 GitHub Integration ──→ (independent, backend routes already exist)
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | One of three | OpenRouter API key (preferred) |
| `ANTHROPIC_API_KEY` | One of three | Anthropic API key |
| `OPENAI_API_KEY` | One of three | OpenAI API key |
| `DATABASE_URL` | Docker sets | PostgreSQL connection string |
| `REDIS_URL` | Docker sets | Redis connection string |
| `BRICK_JWT_SECRET` | Docker sets | JWT signing secret |
| `BRICK_MODEL` | No | Override default LLM model |

## License

MIT
