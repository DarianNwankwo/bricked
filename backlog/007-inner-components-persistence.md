# 007: Inner Components Persistence

**Priority:** Low
**Status:** Not Started
**Affects:** ComponentDetailPanel

## Problem

The Component Detail Panel has an "Inner Components" section where users can add sub-components (name + description pairs) to a parent component. The UI works — you can add, edit, and remove inner components — but the state is purely local React state that is never sent to the backend.

### Current code:
```typescript
// ComponentDetailPanel.tsx
const [innerComponents, setInnerComponents] = useState<InnerComponent[]>([]);

const handleAddInner = () => {
  setInnerComponents(prev => [...prev, { name: '', description: '' }]);
};
// ← No API call, no persistence
```

### What this means:
- Adding inner components works visually
- Switching to another component resets the list
- Refreshing the page loses all inner components
- Inner components never reach the BAC or code generation

## Implementation Approach

### Extend ComponentSpec
The `ComponentSpec` type can be extended to include inner components:

```typescript
// types.ts
export interface ComponentSpec {
  description?: string;
  inputs?: string;
  outputs?: string;
  notes?: string;
  innerComponents?: Array<{ name: string; description: string }>;
}
```

### Storage
Inner components should be stored as part of the component spec, which already persists via `PUT /api/component-specs`. No new API endpoints needed — just extend the existing spec data structure.

### Frontend Changes
1. Initialize `innerComponents` from `spec.innerComponents` instead of empty array
2. Include `innerComponents` in the debounced spec update
3. Send to backend via existing `onUpdateSpec` handler

### BAC Integration
Inner components should appear in BAC node specs so code generation agents understand the component's internal structure:
```json
{
  "id": "api-gateway",
  "name": "API Gateway",
  "spec": {
    "description": "...",
    "innerComponents": [
      { "name": "RateLimiter", "description": "Limits requests per IP" },
      { "name": "AuthMiddleware", "description": "JWT validation" }
    ]
  }
}
```

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/api/types.ts` | Add `innerComponents` to ComponentSpec |
| `frontend/src/components/workspace/ComponentDetailPanel.tsx` | Load from spec, save via onUpdateSpec |
| `src/types/bac.ts` | Add innerComponents to BAC node spec (if needed) |

## Acceptance Criteria

- [ ] Inner components load from component spec when panel opens
- [ ] Adding/editing/removing inner components auto-saves via debounced spec update
- [ ] Inner components persist across page reloads
- [ ] Inner components appear in BAC for code generation context
