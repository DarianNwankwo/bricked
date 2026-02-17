# Future Considerations — Agent Context

**Before implementing any consideration in this directory, read the following files first to establish full project context:**

1. **[../README.md](../README.md)** — Project architecture, tech stack, API reference, backlog, and what works today
2. **[../state.md](../state.md)** — Current architectural decisions, completed work, and active context

These two files are the canonical source of truth for the Brick Studio platform. Every consideration below assumes familiarity with:

- The BAC (Brick App Contract) as the central specification layer
- The pipeline: Design (canvas) → Specify (BAC) → Generate (codegen) → Preview (Docker) → Deploy
- The modular monolith architecture (Express + BullMQ + PostgreSQL + Redis)
- The frontend (Vite + React + TypeScript, component state in WorkspaceView)

---

## Considerations Index

| # | File | Summary |
|---|------|---------|
| 01 | [01-chat-ui-librechat-patterns.md](./01-chat-ui-librechat-patterns.md) | Upgrade chat panel to production-quality LLM interface (markdown, streaming cursor, message actions, content parts, tool call display). Based on LibreChat source analysis. |
| 02 | [02-integration-plugin-architecture.md](./02-integration-plugin-architecture.md) | How third-party integrations (Calendly, Stripe, Google Calendar, etc.) work in apps built and deployed on Brick. Plugin registry, OAuth flow generation, credential management, generated settings UI. |

---

## How to Use These

Each consideration is a self-contained design document with:
- **Problem statement** — what gap it addresses
- **Proposed architecture** — types, data flow, abstractions
- **Implementation plan** — phased, with file paths and dependency ordering
- **What NOT to do** — scope boundaries to prevent over-engineering

Considerations are numbered for reference but have no strict dependency ordering unless noted within the document itself.
