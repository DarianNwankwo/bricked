# 012: Chat Input Bar Redesign

**Priority:** High
**Status:** In Progress
**Affects:** ChatPanel, WorkspaceView

## Requirements

### Model Selector (inline)
- Dropdown in the chat input bar showing current model (e.g., "Opus 4.6 Extended")
- Click to switch between available models from GET /api/config
- Per-message model flexibility — cheap model for simple questions, powerful model for generation
- Persists selection for the session, updates via POST /api/model

### File Attachment
- "+" button on the left of the input bar
- Opens file picker for images, text files, code files
- Attached files shown as chips/thumbnails above the input
- Files sent alongside the message to the LLM for context
- Backend needs to accept multipart/form-data or base64-encoded files

### Context Mode Selector
- Toggle above or inside the chat input: Architecture / Code / Docs
- Each mode routes to the appropriate backend API with the right system prompt
- Architecture mode: designs and modifies the node graph (current behavior)
- Code mode: helps write/edit/debug generated code
- Docs mode: generates and refines documentation
- Visual indicator of current mode (pills, tabs, or segmented control)

### @mentions
- @architecture — references current architecture/BAC in context
- @code — references generated code files
- @docs — references project documentation
- @component:name — references a specific component's spec
- Autocomplete dropdown when user types @
- Mentioned items attached to the message as context for the LLM

### /commands
- /generate — trigger code generation
- /build — build the project
- /preview — start Docker preview
- /reset — reset conversation
- Autocomplete dropdown when user types /
- Commands execute immediately without sending a chat message

## Acceptance Criteria

- [ ] Model selector dropdown in chat input bar
- [ ] "+" file attachment button with file picker
- [ ] Attached files displayed as removable chips
- [ ] Context mode toggle (Architecture/Code/Docs)
- [ ] @mention autocomplete with context injection
- [ ] /command autocomplete with immediate execution
