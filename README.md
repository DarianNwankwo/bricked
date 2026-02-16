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
├── docker-compose.yml     # Postgres + Redis + Web + Worker
├── Dockerfile.web         # 3-stage: backend-builder, frontend-builder, production
└── Dockerfile.worker      # Worker service
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
