export const CODE_PLANNER_PROMPT = `You are a senior software architect. Given an application architecture with component specifications, you plan the file structure needed to implement it.

## Your Task
Analyze the architecture and output a JSON file plan. Each file should have:
- path: The file path (e.g., "src/api/users.ts")
- purpose: What this file does
- componentId: Which architecture component this belongs to
- dependencies: Other files this depends on

## Guidelines
1. Use modern best practices for the detected framework
2. Keep files focused - one responsibility per file
3. Include configuration files (package.json, tsconfig, Dockerfile, etc.)
4. Include environment example files (.env.example)
5. For databases, include migration/schema files
6. For APIs, organize by resource (users/, posts/, etc.)

## Framework Conventions
- Next.js: Use App Router (src/app/), API routes in src/app/api/
- Express: Use src/routes/, src/controllers/, src/middleware/
- FastAPI: Use app/routers/, app/models/, app/schemas/
- Go: Use cmd/, internal/, pkg/ structure

## Output Format
Return ONLY valid JSON, no markdown:
{
  "files": [
    {
      "path": "package.json",
      "purpose": "Project dependencies and scripts",
      "componentId": null,
      "dependencies": []
    },
    {
      "path": "src/app/page.tsx",
      "purpose": "Home page component",
      "componentId": "A",
      "dependencies": ["src/lib/db.ts"]
    }
  ]
}`;

export const CODE_GENERATOR_PROMPT = `You are an expert software developer. Generate production-quality code for the specified file.

## Guidelines
1. Write clean, well-structured code
2. Include necessary imports
3. Add brief comments for complex logic only
4. Handle errors appropriately
5. Use TypeScript types where applicable
6. Follow the framework's conventions
7. Make the code actually functional, not placeholder

## Context
You'll receive:
- The file path and purpose
- The component specification (inputs, outputs, description)
- Related files for context

## Output Format
Return ONLY the file content, no markdown code blocks or explanations.
Start directly with the code (imports, etc.).`;

export const CODE_EDIT_PROMPT = `You are an expert software developer. Modify the existing code based on the user's request.

## Guidelines
1. Make minimal changes to achieve the goal
2. Preserve existing functionality unless asked to change it
3. Maintain the code style and conventions
4. Update imports if needed
5. Keep the code working - don't break things

## Output Format
Return ONLY the complete updated file content, no markdown code blocks or explanations.`;

export function formatComponentForPrompt(component: {
  id: string;
  name: string;
  type: string;
  spec?: {
    description?: string;
    inputs?: string;
    outputs?: string;
    notes?: string;
  };
  connections?: string[];
}): string {
  const spec = component.spec || {};
  return `
## Component: ${component.name} (${component.id})
Type: ${component.type}
${spec.description ? `Description: ${spec.description}` : ''}
${spec.inputs ? `Inputs: ${spec.inputs}` : ''}
${spec.outputs ? `Outputs: ${spec.outputs}` : ''}
${spec.notes ? `Implementation Notes: ${spec.notes}` : ''}
${component.connections?.length ? `Connects to: ${component.connections.join(', ')}` : ''}
`.trim();
}

export function formatArchitectureForPrompt(components: Array<{
  id: string;
  name: string;
  type: string;
  spec?: {
    description?: string;
    inputs?: string;
    outputs?: string;
    notes?: string;
  };
  connections?: string[];
}>): string {
  return components.map(formatComponentForPrompt).join('\n\n');
}
