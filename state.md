# Brick by Brick — State & Context

## Core Mental Model

Brick by Brick is a **platform pipeline**, not a single application. The core pipeline (Mermaid diagrams → Parser → Transformer → AppSpec → Validator → Deploy) is the reusable foundation. Individual verticals (Coach, E-Com, etc.) are **applications built on top** of that pipeline.

- The "Coach" application is the first vertical — helping coaches build dashboards and manage their clients
- Future verticals could include E-Com, SaaS, etc.
- The pipeline enables rapid iteration across architectures and products

## Architecture Decisions

### Twenty CRM — DROPPED
- **Decision**: Remove Twenty CRM from the project
- **Rationale**: While Twenty does support multi-tenancy (schema-per-tenant via `IS_MULTIWORKSPACE_ENABLED=true`), it introduces:
  - Operational overhead (separate PostgreSQL, Redis, ClickHouse stack)
  - AGPLv3 license risk for modifications
  - Feature bloat (50+ features when we need 3 tables)
  - External coupling to Twenty's release cycle
- **Replacement**: Lightweight foundational data tables (Contacts, Notes, Contact Interactions) with row-level tenant isolation

### Foundational Data Layer
- **Contacts**: Core entity across all verticals (clients for coaches, customers for e-com)
- **Notes**: Per-contact notes with flexible metadata
- **Contact Interactions**: Event-sourced touchpoints (purchases, bookings, calls, sessions) for future analytics
- These tables are **platform-level**, not vertical-specific — every application built on the pipeline will need CRM-like data

### Architecture Diagram Corrections
- **User Layer**: Should NOT be at the top — the current CLI/WebUI/API layer is app-specific, not platform-level
- **Twenty CRM**: Should be removed from integrations entirely
- **Integrations** (Calendly, Stripe, Email): These are correct as app-level integrations that feed into the Contact Interactions event stream
- **Core Pipeline**: Correctly highlighted as the foundation

## Tech Stack
- TypeScript 5.4, Node.js 18+, ES Modules
- SQLite (better-sqlite3) for persistence, abstracted behind DatabaseClient interface
- Anthropic Claude (primary LLM), OpenAI (fallback)
- DigitalOcean App Platform for deployment
- Vitest for testing

## Current State
- Core pipeline: Implemented and tested (parser, transformer, generator, validator, deployer)
- LLM layer: Working (architect + client)
- Integrations: Calendly done, Cal.com done, Twenty CRM removed
- Stripe, Email: Not yet implemented
- Server/API: Express backend with auth, projects, deployments
- UI: Single-file React SPA (11K lines)
- Database: SQLite with foundational data tables (Contacts, Notes, Interactions)
- Artifact stashing: Generated code persisted to `data/artifacts/{slug}/` with manifest

## Completed
- [x] Remove Twenty CRM integration code and references
- [x] Create foundational Contacts, Notes, Contact Interactions tables (schema + SQLite + InMemory)
- [x] Update architecture diagram to reflect platform-first model (Notion updated)
- [x] Remove Twenty sync from coaching service layer
- [x] Create Coach vertical Mermaid diagram (examples/coach-vertical.mmd)
- [x] TypeScript compiles clean
- [x] Build platform dashboard — stats, project cards, mini arch diagrams, env pills, cost breakdown, quick deploy

## UI Polish & Docker Preview (Latest Session)
- [x] Seeded Coach Platform project in database (Dashboard UI, Coaching API, PostgreSQL, Calendly Sync)
- [x] Wired "Demo Locally" button to Docker Compose preview API (start/stop/status)
- [x] Removed non-functional canvas toolbar (CSS, state, rendering)
- [x] Dashboard: Demo/Deploy/Delete buttons, architecture mini-diagrams, date sorting
- [x] Docker preview: port 9100+ range, stale container cleanup, JSON parsing for newer Docker
- [x] Unified panel collapse: all 3 panel headers trigger panelsCollapsed mode
- [x] Collapse bar: icons for chat/palette/cost, floating overlay for active panel
- [x] Minimap: dark theme (#1A1A1A background)
- [x] Run Locally/Quick Deploy: visible for saved projects (ir || manualArch)
- [x] Code view collapsed: file-tree hidden, editor-panel fills grid
- [x] Docs view collapsed: docs-panel fills grid
- [x] Preview panel: fixed overlay (bottom-right), error text truncated
- [x] Horizontal overflow: .app overflow hidden
- [x] Puppeteer UI testing: comprehensive test suite (tests/ui-check.ts)
- **Note**: Server must be restarted (`brick ui`) to serve latest compiled code

## Landing Redesign, Code View, LLM Iteration, Agent Layer (Latest Session)
- [x] Coaching landing page redesigned — white/indigo/Tailwind matching wizard visual language
- [x] Deleted static `src/landing/coaching.html`, replaced with inline `getCoachingLandingPage()` function
- [x] Code view: Source file auto-loading from filesystem via `/api/source-files` endpoint
- [x] Code view: Source/Generated toggle in file tree panel header
- [x] LLM client: Added `maxTokens` option to `chat()` and `chatStream()` (default 1024, design iteration uses 4096)
- [x] Added `SITE_DESIGN_PROMPT` to `src/codegen/prompts.ts`
- [x] Chat endpoint: `POST /api/coaching/project/:id/chat` in both ui.ts and Express coaching routes
- [x] Streaming chat endpoint: `POST /api/coaching/project/:id/chat/stream` in Express coaching routes
- [x] Dashboard chat wired to real LLM — auto-applies content updates from JSON blocks in LLM response
- [x] Agent abstraction layer: `src/agent/types.ts` (AgentContext, AgentAction, AgentResult, Agent interfaces)
- [x] Agent orchestrator skeleton: `src/agent/orchestrator.ts` (registration, routing, result application)
- [x] TypeScript compiles clean, build succeeds

## Next Steps
- [ ] Run a vertical diagram through Brick CLI to dogfood the pipeline
- [ ] Add Stripe integration
- [ ] Add Email integration
- [ ] Implement first "build within" agent using the Agent interface
- [x] Upgrade file browser to Monaco Editor + tree component (CDN)
- [x] Connect Canvas assistant to local Claude Code for live development (Phase 1)
- [ ] Asset upload support (logos, favicons, hero images, headshots)

## Canvas → Claude Code Integration (Implemented)
Canvas chat panel has **Design/Dev mode toggle**. Design mode uses OpenRouter LLMs for architecture iteration. Dev mode spawns local Claude Code CLI with persistent sessions for direct code editing.

**Files**:
- `src/agent/claude-code.ts` — executeClaudeCode(), cancelClaudeCode(), resetSession() wrapping CLI with `--resume` for session persistence
- `src/cli/commands/ui.ts` — SSE endpoints (`/api/agent/claude-code`, `/api/agent/claude-code/cancel`), mode toggle UI, handleDevSubmit

**Flow**: Browser chat (Dev mode) → POST /api/agent/claude-code → spawn claude CLI (stream-json, --resume) → parse events → SSE to browser
- No auto-build — build is manually triggered
- Session persists across messages (--resume with stored session ID)
- Uses local Claude Code CLI auth (Max plan), not API keys

## Coaching Artifacts — FULLY REMOVED
All coaching-specific code removed from the platform in two waves:
1. First wave: Landing page, wizard, dashboard, templates, setup handler, types, route handlers, CSS removed from `ui.ts` (~2700 lines)
2. Second wave: REST routes (`coaching.ts`), service (`coaching.ts`), marketing pages (5 landing designs), coaching DB schema/methods from schema.ts, client.ts, sqlite-client.ts, seed data, example diagram, `SITE_DESIGN_PROMPT`. Total: 8 files deleted, 5 files edited, ~1500+ lines removed

## Artifact Stashing (Implemented)
Generated code persists to `data/artifacts/{slug}/` via `src/server/services/artifacts.ts`. Files survive across server restarts.
- **Stash on generate**: After code generation in ui.ts, files are written to disk with a `manifest.json` (checksums, metadata)
- **Load on project load**: When a project is opened, files are restored from disk into in-memory `currentProject.files`
- **External edit detection**: Checksums detect files modified outside the platform (e.g., by Claude Code Dev mode)
- **Preview integration**: Docker preview copies stashed artifacts into preview dir instead of generating placeholders
- **Delete cleanup**: `deleteArtifacts()` called on project delete

## Docker Preview — Per-Project Port Ranges (Implemented)
Each project gets a deterministic port range derived from its slug hash. Port base = `9100 + (hash(slug) % 80) * 10`, giving each project a 10-port window within 9100–9899. This allows multiple projects to run Docker previews simultaneously without port conflicts.

## Project Routing
Projects are accessed via their Docker container ports (`localhost:<port>`). There is no application-level URL routing per project — each project's services bind to their own host ports. The port is embedded in the generated `docker-compose.yml` at preview start time.

## Project Sorting — By Creation Date
Dashboard and API both sort projects by `createdAt` (newest first), not by last-edited date.

## Platform Dashboard (Implemented)
- Default view after login/signup (replaces project list as landing)
- Stats row: total projects, active deployments, monthly cost, health
- Project cards with mini SVG architecture diagrams (dagre layout), environment pills, cost, quick deploy
- Cost breakdown bar chart by project
- Navigation: Dashboard ↔ Projects ↔ Settings all cross-linked in sidebars
- Logo/back clicks in editor return to dashboard

---

## AutoMaker Competitive Analysis & Feature Adoption Plan

**Reference**: [AutoMaker](https://github.com/AutoMaker-Org/automaker) — local, open-source agentic IDE (2.9K stars, TypeScript/React/Electron, MIT-like license, no longer actively maintained). Analyzed Feb 2026.

**AutoMaker's model**: Kanban board → agents autonomously implement features in isolated git worktrees → user reviews diffs → merge. No deployment capability — everything stays local.

**Brick-by-Brick's advantage**: We have the deployment pipeline (Mermaid → AppSpec → CodeGen → Docker Preview → DigitalOcean Deploy). AutoMaker can *write* code. We can *ship* it. Combine both = "vibe deploy."

### Tier 1: High-Impact, Build Now

**1. Git Worktree Isolation Per Feature**
- AutoMaker's best architectural decision — each feature gets its own git worktree, agents work freely without polluting main branch, merge on approval
- **Current gap**: `src/agent/claude-code.ts` operates on live project files. If agent goes off the rails, it corrupts working state. Worktrees give rollback for free
- **Implementation**: Before spawning `executeClaudeCode()`, create worktree (`git worktree add`), point Claude at it, merge on approval. Thin wrapper around existing claude-code.ts

**2. Auto-Mode: Parallel Agent Execution with Concurrency Control**
- AutoMaker's largest service (220KB) orchestrates multiple features executing simultaneously: per-project concurrency limits, lease counting, consecutive failure detection, feature dependency resolution
- **Current gap**: Agent orchestrator (`src/agent/orchestrator.ts`) is a skeleton. BAC, codegen, docs agents exist but can't run in parallel or queue features
- **Implementation**: Worker queue (`src/server/queue/`) is the foundation. Add concurrency limits per project, dependency resolution between BAC/codegen steps, status loop that picks up next pending feature
- **Key patterns from AutoMaker**: `acquireRunningFeature()` / `releaseRunningFeature()` with lease counting, `autoLoopsByProject` Map keyed by `projectPath::branchName`, consecutive failure detection that pauses the loop

**3. Kanban Board as Primary Interface**
- AutoMaker's Kanban isn't a task tracker — it's the **control surface** for the agent system. Features move through: `Backlog → In Progress → Waiting Approval → Done`. Moving a card triggers agent execution
- **Current gap**: Dashboard shows project cards with stats but no feature-level task management
- **Implementation**: Add `features` table to DB (status, project FK, dependencies, description). Dashboard gets Kanban view per project. Moving card to "Build" triggers codegen pipeline. Use `@dnd-kit` for drag-and-drop (what AutoMaker uses)

**4. Plan Approval Workflow (Human-in-the-Loop)**
- AutoMaker generates structured plan before agents write code, presents for user review/approval/rejection
- **Current gap**: BAC flow derives specs but no explicit approval gate between "here's what I'll build" and "building it"
- **Implementation**: After BAC derivation, emit `plan_ready` event via WebSocket. UI shows plan. User approves → codegen runs. User edits → re-derive. Maps to existing BAC → Codegen pipeline

### Tier 2: Medium-Term, Adapt to Our Model

**5. Real-Time Agent Streaming via WebSocket**
- AutoMaker streams every agent action (planning steps, file edits, test results, terminal output) to UI in real time
- **Current gap**: WebSocket exists (`src/server/websocket/index.ts`), SSE for Claude Code exists, but agent layer (`bac-agent.ts`, `codegen-agent.ts`) doesn't stream intermediate steps
- **Implementation**: Worker processors (`src/worker/processors/`) should emit granular events: `step_started`, `file_written`, `test_passed`, `deploy_initiated`. Frontend shows live activity feed per project

**6. Context Injection System**
- AutoMaker uses `.automaker/context/` directories — users drop files (API docs, style guides) that auto-inject into every agent prompt
- **Current gap**: Agents get context from BAC/AppSpec only. No way for users to provide supplementary context (brand guidelines, API specs, compliance requirements)
- **Implementation**: Add `context/` directory per project in artifacts system. Files prepended to agent prompts. UI gets "Context" panel for upload/edit

**7. Multi-Provider AI Support**
- AutoMaker supports Claude, Codex, Copilot, Gemini, Cursor through provider abstraction with per-feature model selection
- **Current gap**: Have Anthropic Claude + OpenAI fallback but no formal provider interface or per-task model selection
- **Implementation**: Formalize `src/llm/client.ts` with provider interface. Let BAC agent use different model than codegen agent. Cheap models for simple features, powerful ones for complex architecture

### Tier 3: Our Differentiators (What AutoMaker Can't Do)

**8. Vibe Deploy (Close the Loop)**
- AutoMaker has ZERO deployment capability. Our entire pipeline solves this
- When feature is approved on Kanban and merged → automatically trigger deploy pipeline → card moves to "Deployed" with live URL

**9. Multi-Tenant Preview Environments**
- We already have per-project Docker preview with deterministic port ranges. Extend so every feature branch gets its own preview URL (like Vercel/Netlify preview deployments)

**10. Infrastructure as Features**
- Kanban cards aren't just application features — they can be infrastructure: "Add Redis caching," "Set up PostgreSQL," "Configure Stripe webhooks." Agent provisions infrastructure via deployer, not just application code

### What NOT to Borrow
- **Electron desktop app** — we're a web platform, not a local IDE
- **File-based JSON storage** — we have SQLite/Postgres, keep proper DB
- **25+ themes** — vanity feature, don't prioritize
- **Terminal multiplexer (xterm.js)** — our users shouldn't need a terminal, the whole point is abstracting that away. Keep Docker preview instead

### Target Architecture (Combined)

```
Describe features on Kanban board
    ↓
Agent generates BAC/spec → user approves plan
    ↓
Agents work in parallel, in isolated git worktrees
    ↓
Real-time progress streaming via WebSocket
    ↓
Diff review + preview environment
    ↓
One-click deploy → live production URL
    ↓
Describe next feature, repeat
```

### Key AutoMaker Technical Patterns Worth Studying
- **Monorepo with `@automaker/*` packages**: types → utils → platform → server/ui (strict dependency hierarchy, prevents circular deps)
- **Provider factory pattern**: `base-provider.ts` → `claude-provider.ts` / `codex-provider.ts` etc. (formalized abstraction for multi-model)
- **Atomic file writes**: temp file → rename (prevents corruption during crashes)
- **Dual WebSocket servers**: events broadcast (`/api/events`) separate from terminal I/O (`/api/terminal/ws`)
- **Settings migration system**: handles version transitions (field mapping, model ID canonicalization, format conversions)
