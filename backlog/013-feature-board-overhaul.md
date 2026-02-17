# 013: Feature Board Overhaul — Agent-Driven Workflow

**Priority:** High
**Status:** In Progress
**Affects:** FeatureBoard, WorkspaceView, backend agent system

## Requirements

### Remove Manual Cross-Column Drag
- Features always enter in Backlog when user adds them
- Users CANNOT drag features between columns (Backlog → In Progress, etc.)
- Only agents move features through the pipeline
- Users can still reorder within a column (optional)

### Feature Edit & Delete
- Each feature card has edit and delete buttons
- Edit: inline editing of title and description
- Delete: confirmation prompt, then removes the feature
- Both persist to the database (depends on 003)

### Auto-Start Timer
- When a feature is added to the backlog, a 2-3 minute countdown timer starts
- Timer is visible on the feature card (e.g., "Agent picks up in 2:34")
- After the timer expires, the agent autonomously picks up the feature
- User can cancel the timer (keeps feature in backlog without auto-start)
- User can also manually trigger "Start now" to skip the timer
- This gives users time to reconsider or add more context before the agent begins

### Agent Status Progression
Features move through columns based on agent status:
- Backlog: user-created, waiting for agent (timer counting or "needs context")
- In Progress: agent is actively working (planning, building, testing)
- Review: agent completed, waiting for user review
- Deployed: approved and deployed

Agent status indicators on the card:
- "Waiting" (timer counting down)
- "Needs more context" (flagged by agent or proactive system)
- "Planning" (agent is analyzing the feature)
- "Building" (agent is generating code)
- "Testing" (agent is running tests)
- "Complete" (ready for review)
- "Error" (agent hit a problem)

### Proactive Context Gathering
- When a backlog item is vague/underspecified, flag it as "needs more context"
- Push a prompt into the chat flow asking the user for more detail
- User's response attaches as context to the feature
- Feature toggle in settings: "AI proactively asks about backlog items" (on/off)
- Default: on. When off, agent works with whatever context is provided.
- Cost consideration: proactive questioning uses tokens, so users should control it

### Real-Time Updates via Supabase
- Agent status changes push through Supabase Realtime channels
- Feature board updates in real time without polling
- Multiple users see the same board state

## Dependencies
- 003: Feature Board Backend (DB tables)
- Supabase integration (real-time channels)
- Agent system (picks up features and reports progress)

## Acceptance Criteria

- [ ] Features always enter Backlog, no cross-column drag
- [ ] Edit and delete buttons on feature cards
- [ ] Auto-start timer visible on cards (2-3 min countdown)
- [ ] Cancel timer and "Start now" buttons
- [ ] Agent status progression visible on cards
- [ ] "Needs more context" flag with chat integration
- [ ] Proactive AI toggle in settings
- [ ] Real-time updates via Supabase
