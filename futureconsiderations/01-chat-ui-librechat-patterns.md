# 01 — Chat UI Upgrade: LibreChat Patterns for Brick Studio

**Status**: INVESTIGATION COMPLETE — Ready for implementation
**Source**: Analysis of [LibreChat](https://github.com/danny-avila/LibreChat) (33K+ stars, TypeScript/React)
**Conflict Note**: If another Claude Code instance is actively touching code, see the File Conflict Map below to avoid overlap.

---

## Executive Summary

Our current ChatPanel is ~157 lines of plain-text rendering with basic streaming. LibreChat's equivalent is a battle-tested, multi-thousand-line system with markdown rendering, content parts, message actions, tool call display, file attachments, and message branching. We don't need all of it — but we need the parts that make LLM interactions feel professional.

**Goal**: Make our chat panel look and behave like a standard LLM chat interface (ChatGPT/Claude quality) while keeping our architecture-focused workflow intact.

---

## What to Adopt (Ordered by Impact)

### Phase 1: Core Chat Quality (HIGH PRIORITY)

#### 1.1 Markdown Rendering in Messages
**Why**: Assistant responses contain code blocks, lists, bold/italic, and headers. We currently render them as plain text.

**LibreChat pattern**: `react-markdown` + `remark-gfm` + `rehype-highlight` + `rehype-katex`

**What to do**:
- Install: `react-markdown`, `remark-gfm`, `rehype-highlight`, `highlight.js`
- Create `MessageContent.tsx` component that renders markdown for assistant messages, plain text for user messages
- Add syntax-highlighted code blocks with a copy button
- Keep our existing `formatContent()` logic (strip mermaid blocks) as a preprocessing step before markdown render

**Files touched**:
- `frontend/package.json` (new deps)
- NEW: `frontend/src/components/workspace/chat/MessageContent.tsx`
- `frontend/src/components/workspace/ChatPanel.tsx` (swap raw text for MessageContent)
- NEW: `frontend/src/components/workspace/chat/CodeBlock.tsx` (syntax highlighting + copy button)

#### 1.2 Auto-Resizing Textarea
**Why**: Fixed single-row textarea is cramped for multi-line prompts.

**LibreChat pattern**: `TextareaAutosize` that grows up to ~55vh, collapses when empty.

**What to do**:
- Replace `<textarea rows={1}>` with auto-resizing behavior (CSS + JS: set height to scrollHeight on input)
- Cap max height at `40vh`
- Keep Shift+Enter for newlines, Enter for submit

**Files touched**:
- `frontend/src/components/workspace/ChatPanel.tsx` (textarea logic)
- `frontend/src/components/workspace/ChatPanel.css` (textarea styling)

#### 1.3 Stop Generation Button
**Why**: Users can't cancel a bad response. The input is just disabled during streaming.

**LibreChat pattern**: Send button morphs into a Stop button (square icon) while `isStreaming`. Clicking calls `AbortController.abort()`.

**What to do**:
- Add `onStop` callback prop to ChatPanel
- Conditionally render Stop button (square icon) when `isStreaming`, Send button otherwise
- WorkspaceView wires `onStop` to abort the streaming fetch

**Files touched**:
- `frontend/src/components/workspace/ChatPanel.tsx` (button swap logic)
- `frontend/src/components/workspace/ChatPanel.css` (stop button styling)
- `frontend/src/components/workspace/WorkspaceView.tsx` (abort controller wiring) — **CONFLICT RISK: coordinate with other instance**

#### 1.4 Message Actions (Copy, Regenerate)
**Why**: No way to copy a response or retry a generation.

**LibreChat pattern**: Hover-revealed action buttons below each assistant message. `opacity-0` by default, `group-hover:opacity-100`.

**What to do**:
- Add `HoverActions` bar below assistant messages with:
  - **Copy** — copies message text to clipboard, shows checkmark feedback
  - **Regenerate** — re-sends the previous user message (replaces last assistant message)
- Wire `onRegenerate` callback through to WorkspaceView

**Files touched**:
- NEW: `frontend/src/components/workspace/chat/HoverActions.tsx`
- `frontend/src/components/workspace/ChatPanel.tsx` (integrate actions)
- `frontend/src/components/workspace/ChatPanel.css` (hover reveal styling)

#### 1.5 Streaming Cursor
**Why**: During streaming, there's no visual indicator of where new text is appearing.

**LibreChat pattern**: Blinking cursor CSS class (`result-streaming`) appended to the last text element.

**What to do**:
- Add blinking block cursor via CSS `::after` pseudo-element on the streaming message
- Remove cursor when streaming completes

**Files touched**:
- `frontend/src/components/workspace/ChatPanel.css` (cursor animation)
- `frontend/src/components/workspace/ChatPanel.tsx` (add class to streaming message)

---

### Phase 2: Content Architecture (MEDIUM PRIORITY)

#### 2.1 Content Parts Model
**Why**: Messages will eventually contain more than just text — tool calls, images, thinking blocks, errors. A flat `content: string` can't model this.

**LibreChat pattern**: Each message has a `content: ContentPart[]` array where each part has a `type` discriminator:
```typescript
type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; name: string; args: Record<string, any>; output?: string }
  | { type: 'thinking'; text: string }
  | { type: 'error'; text: string }
  | { type: 'image'; url: string; alt?: string }
  | { type: 'file'; name: string; url: string; mimeType: string }
```

**What to do**:
- Extend `ChatMessage` type in `api/types.ts` to support `parts: ContentPart[]` alongside the existing `content: string` (backward compatible)
- Create a `Part.tsx` dispatcher component that renders the right component based on `part.type`
- Migrate message rendering to iterate over parts instead of rendering raw content

**Files touched**:
- `frontend/src/api/types.ts` (extend ChatMessage, add ContentPart union type)
- NEW: `frontend/src/components/workspace/chat/Part.tsx` (dispatcher)
- NEW: `frontend/src/components/workspace/chat/parts/TextPart.tsx`
- NEW: `frontend/src/components/workspace/chat/parts/ToolCallPart.tsx`
- NEW: `frontend/src/components/workspace/chat/parts/ThinkingPart.tsx`
- NEW: `frontend/src/components/workspace/chat/parts/ErrorPart.tsx`

#### 2.2 Tool Call / Agent Step Display
**Why**: When our agents (BAC agent, codegen agent) execute, users see nothing. LibreChat renders tool calls with collapsible progress.

**LibreChat pattern**: `ToolCall.tsx` shows tool name, collapsible args/output, progress animation, error detection.

**What to do**:
- Render tool call parts with: icon, tool name, collapsible details, progress spinner
- Map to our existing agent actions (BAC derivation, code generation, deploy)
- Show "Architecture updated" / "Code generated" / "Deployed" badges inline

**Files touched**:
- `frontend/src/components/workspace/chat/parts/ToolCallPart.tsx` (from 2.1)
- CSS for tool call styling

#### 2.3 Thinking/Reasoning Display
**Why**: Claude's extended thinking is valuable for architecture decisions. Currently invisible.

**LibreChat pattern**: `Reasoning` component with collapsible "thinking" block, dimmed styling, toggle to expand.

**What to do**:
- Render thinking parts in a collapsible block with muted styling
- Default collapsed, click to expand
- Only show if backend sends thinking content

**Files touched**:
- `frontend/src/components/workspace/chat/parts/ThinkingPart.tsx` (from 2.1)
- CSS for thinking block styling

---

### Phase 3: Polish & UX (LOWER PRIORITY)

#### 3.1 File Attachments in Chat
**Why**: Users may want to share screenshots, API docs, or design references with the agent.

**LibreChat pattern**: Drag-drop zone, file preview chips above textarea, upload progress, remove button.

**What to do**:
- Add drag-drop handler to chat input area
- Show file preview chips (name + size + remove button) above textarea
- Send files as base64 or FormData to backend
- Display image attachments inline in user messages

**Files touched**:
- NEW: `frontend/src/components/workspace/chat/FileAttachment.tsx`
- `frontend/src/components/workspace/ChatPanel.tsx` (drag-drop, file state)
- Backend endpoint changes (coordinate with other instance)

#### 3.2 Conversation Scroll Behavior
**Why**: Current smooth scroll can be janky during fast streaming.

**LibreChat pattern**: `abortScroll` atom that lets users opt out of auto-scroll (scroll up = stop auto-scroll, scroll to bottom = re-enable).

**What to do**:
- Track whether user has scrolled up from bottom
- If scrolled up, stop auto-scrolling (show "scroll to bottom" button)
- If at bottom, continue auto-scrolling on new content
- Use `requestAnimationFrame` for smooth scroll during streaming

**Files touched**:
- `frontend/src/components/workspace/ChatPanel.tsx` (scroll logic)
- `frontend/src/components/workspace/ChatPanel.css` (scroll-to-bottom button)

#### 3.3 Message Edit (User Messages)
**Why**: Users may want to tweak a prompt and re-send.

**LibreChat pattern**: Click edit on user message → inline textarea replaces message → Save/Cancel → re-submits from that point.

**What to do**:
- Add Edit button to user message hover actions
- Clicking Edit shows inline textarea pre-filled with message text
- Save re-sends the edited message (truncating conversation after that point)

**Files touched**:
- `frontend/src/components/workspace/chat/HoverActions.tsx` (add edit for user msgs)
- `frontend/src/components/workspace/ChatPanel.tsx` (edit mode state)

---

## What NOT to Adopt

| LibreChat Feature | Why Skip |
|---|---|
| Recoil/Jotai state management | Our useState approach in WorkspaceView is fine for a single chat per project. Atoms are for multi-conversation apps. |
| React Query for messages | We don't need cache invalidation or optimistic updates. Messages live in component state. |
| Message branching / sibling tree | Over-complex for our use case. We can add later if needed. |
| Conversation sidebar | We're one conversation per project workspace, not a multi-chat app. |
| Virtualized message list | We won't have thousands of messages. Simple div scrolling is fine. |
| i18n / localization | Not needed yet. |
| OAuth for tool calls | Our tools are internal platform actions, no third-party auth needed. |
| @ mentions for model selection | We have a model dropdown already. |
| Text-to-speech / speech-to-text | Not relevant for architecture design. |
| Multi-provider model badges | We already have model selection in settings. |

---

## File Conflict Map

Files the **other Claude Code instance** may be touching (based on git status and typical workspace work):

| File | Risk Level | Strategy |
|---|---|---|
| `WorkspaceView.tsx` | **HIGH** | This is the state hub. Minimize changes — only add `onStop` prop threading. Do last. |
| `ChatPanel.tsx` | **MEDIUM** | Primary file we're modifying. If other instance is also editing, split into sub-components first to reduce merge surface. |
| `ChatPanel.css` | **LOW** | Additive CSS changes rarely conflict. |
| `api/types.ts` | **MEDIUM** | Adding new types (ContentPart) is additive. Should merge cleanly. |
| `api/client.ts` | **LOW** | We're not changing the API client in Phase 1. |

**Recommended approach**: Create new files in a `chat/` subdirectory under workspace. This avoids conflicting edits on existing files. Refactor ChatPanel to import from the new directory.

---

## New Directory Structure

```
frontend/src/components/workspace/
├── chat/                          # NEW directory
│   ├── MessageContent.tsx         # Markdown renderer
│   ├── CodeBlock.tsx              # Syntax-highlighted code block + copy
│   ├── HoverActions.tsx           # Copy/Edit/Regenerate buttons
│   ├── Part.tsx                   # Content part dispatcher
│   ├── FileAttachment.tsx         # File upload/display
│   ├── parts/
│   │   ├── TextPart.tsx           # Markdown text rendering
│   │   ├── ToolCallPart.tsx       # Agent action display
│   │   ├── ThinkingPart.tsx       # Reasoning display
│   │   └── ErrorPart.tsx          # Error display
│   └── chat.css                   # Shared chat sub-component styles
├── ChatPanel.tsx                  # Existing (minimal changes in Phase 1)
├── ChatPanel.css                  # Existing (additive changes)
└── WorkspaceView.tsx              # Existing (minimal prop threading)
```

---

## Dependencies to Add

```json
{
  "react-markdown": "^9.0.0",
  "remark-gfm": "^4.0.0",
  "rehype-highlight": "^7.0.0",
  "highlight.js": "^11.9.0"
}
```

Optional (Phase 2+):
```json
{
  "rehype-katex": "^7.0.0",
  "remark-math": "^6.0.0"
}
```

---

## Implementation Order

1. **Phase 1.1** — Markdown rendering (biggest visual impact, zero risk of conflicts)
2. **Phase 1.2** — Auto-resize textarea (self-contained change)
3. **Phase 1.5** — Streaming cursor (CSS-only, trivial)
4. **Phase 1.4** — Message actions (new component, low conflict risk)
5. **Phase 1.3** — Stop generation (touches WorkspaceView — do after coordinating)
6. **Phase 2.1** — Content parts model (types + new components)
7. **Phase 2.2** — Tool call display (builds on 2.1)
8. **Phase 2.3** — Thinking display (builds on 2.1)
9. **Phase 3.x** — Polish items as needed

---

## Key LibreChat Patterns to Replicate

### Pattern: Group-hover action reveal
```css
.message-actions {
  opacity: 0;
  transition: opacity 0.15s;
}
.chat-message:hover .message-actions {
  opacity: 1;
}
```

### Pattern: Streaming cursor
```css
.streaming-cursor::after {
  content: '';
  display: inline-block;
  width: 3px;
  height: 1em;
  background: var(--text-primary);
  animation: blink 1s step-end infinite;
  margin-left: 2px;
  vertical-align: text-bottom;
}
@keyframes blink {
  50% { opacity: 0; }
}
```

### Pattern: Code block with copy
```tsx
function CodeBlock({ language, children }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code-block">
      <div className="code-header">
        <span>{language}</span>
        <button onClick={() => { navigator.clipboard.writeText(children); setCopied(true); }}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre><code className={`language-${language}`}>{children}</code></pre>
    </div>
  );
}
```

### Pattern: Auto-resize textarea
```tsx
const handleInput = (e) => {
  const el = e.target;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
};
```

### Pattern: Abort streaming
```tsx
const abortRef = useRef<AbortController | null>(null);

const startStreaming = async () => {
  abortRef.current = await streamGenerate(message, onChunk, onDone, onError);
};

const stopStreaming = () => {
  abortRef.current?.abort();
  setIsStreaming(false);
};
```
