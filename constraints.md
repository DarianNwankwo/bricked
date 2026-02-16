# Constraints

> **Read this file before making any changes to the codebase.**
>
> Multiple agentic workflows and contributors operate on this workspace independently. This file is the coordination point — it captures active architectural constraints, in-flight work, and conventions so that everyone stays in sync regardless of which tools or agents they use.

## Active Constraints

### BAC is the canonical contract layer
The Brick App Contract (BAC) is the single source of truth for project architecture. All surfaces (Canvas, Docs, Code) derive their context from it. Do not introduce parallel state that duplicates what BAC already tracks.

### Three dev mode surfaces, one project scope
Each project in Brick Studio has three LLM-facing surfaces:
- **Canvas** — reads/writes `currentBAC` + `manualArchitecture`
- **Docs** — reads/writes `documentation` for the active project
- **Code** — reads BAC + `componentSpecs`, writes files via tool use

All three must be scoped to the active project (`currentProjectId`). The LLM operating on any surface must know *which project* it's working on and must only modify that project's state.

### Docs mode must emit structured patches
The docs mode LLM must output `docs-update` code blocks (JSON patch arrays) for the server-side parser to extract and apply. Prose-only responses do not update the Project Documentation panel. The system prompt enforces this — do not weaken it.

### No file tool access in docs mode
The docs mode LLM is restricted to the context provided in its system prompt (current documentation + architecture reference). It must not use Read, Write, Edit, Bash, Glob, Grep, or any file-system tools. This is enforced in `DOCS_DEV_CHAT_SYSTEM_PROMPT`.

### OpenRouter is the default model router
LLM calls go through OpenRouter by default. `OPENROUTER_API_KEY` is the preferred key. Direct provider keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) are supported as fallbacks.

## In-Flight Work

### Project-scoped LLM context for Docs and Code modes
**Status:** Design phase
**Owner:** @jamosa

**Problem:** When the LLM operates in Docs mode, it doesn't have strong enough project identity. It has documented Brick Studio (the tool) instead of the active project (e.g., an e-commerce vertical). The same risk applies to Code mode.

**Goal:** Each mode's `build*SystemContext` function should receive the active project's identity as a first-class input. The LLM should always know it's working *on* a specific project, not *inside* Brick Studio. Docs changes should also be persisted to the project's server-side state (matching how Canvas mode persists BAC patches immediately).

**Affected files:**
- `src/codegen/prompts.ts` — system prompts and context builders
- `src/cli/commands/ui.ts` — request handling and state management

### Server-side docs persistence
**Status:** Not started
**Owner:** Unassigned

Canvas mode applies `bac-patch` blocks directly to `currentBAC` on the server. Docs mode does not — it patches a transient variable and sends the result back to the frontend, relying on explicit "Save Project" to persist. This asymmetry means docs changes can be lost on project switch. The fix is to write updated docs to `savedProjects[currentProjectId].documentation` on the server after applying patches, matching the Canvas pattern.

## Conventions

### Commit style
- Concise subject line describing the *why*, not the *what*
- Body for detail when the change is non-obvious
- `Co-Authored-By` trailer when commits are AI-assisted

### Testing
- Run `npx vitest` before pushing. All 522 tests must pass.
- Tests live in `tests/` mirroring the `src/` structure.

### State management in `ui.ts`
- Server-side state variables (`currentBAC`, `manualArchitecture`, `currentProject`, `currentProjectId`) are swapped on project load and cleared on project delete/reset.
- Frontend state (`projectDocs`, component specs panel, etc.) is synced via SSE events and explicit API calls.
- When adding new per-project state, it must be included in `SavedProject`, the save endpoint, and the load endpoint.

### Prompt changes
- Changes to system prompts in `src/codegen/prompts.ts` affect LLM behavior across all sessions. Test manually in the UI after modifying prompts.
- Keep prompt rules directive ("you MUST") rather than suggestive ("you should consider"). The LLM will take the softer path if given the option.
