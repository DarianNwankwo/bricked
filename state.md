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
