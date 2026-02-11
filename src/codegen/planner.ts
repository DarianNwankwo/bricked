import { chat, type ChatMessage } from '../llm/client.js';
import { CODE_PLANNER_PROMPT, formatArchitectureForPrompt } from './prompts.js';
import type { LLMConfig } from '../llm/config.js';

export interface FilePlan {
  path: string;
  purpose: string;
  componentId: string | null;
  dependencies: string[];
}

export interface CodePlan {
  files: FilePlan[];
}

export interface Component {
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
}

export async function planCodeStructure(
  components: Component[],
  projectName: string,
  config?: LLMConfig
): Promise<CodePlan> {
  const architectureContext = formatArchitectureForPrompt(components);

  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: `Project: ${projectName}

Architecture Components:
${architectureContext}

Plan the complete file structure for this application. Include all necessary files for a production-ready project.`
    }
  ];

  const response = await chat(CODE_PLANNER_PROMPT, messages, config);

  // Parse the JSON response
  try {
    // Try to extract JSON from the response
    let jsonStr = response.content.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    const plan = JSON.parse(jsonStr) as CodePlan;

    // Validate the structure
    if (!plan.files || !Array.isArray(plan.files)) {
      throw new Error('Invalid plan structure: missing files array');
    }

    // Ensure all files have required fields
    plan.files = plan.files.map(f => ({
      path: f.path,
      purpose: f.purpose || '',
      componentId: f.componentId || null,
      dependencies: f.dependencies || [],
    }));

    return plan;
  } catch (error) {
    console.error('Failed to parse code plan:', error);
    console.error('Raw response:', response.content);

    // Return a minimal fallback plan
    return generateFallbackPlan(components, projectName);
  }
}

function generateFallbackPlan(components: Component[], projectName: string): CodePlan {
  const files: FilePlan[] = [
    {
      path: 'package.json',
      purpose: 'Project dependencies and scripts',
      componentId: null,
      dependencies: [],
    },
    {
      path: 'tsconfig.json',
      purpose: 'TypeScript configuration',
      componentId: null,
      dependencies: [],
    },
    {
      path: '.env.example',
      purpose: 'Environment variables template',
      componentId: null,
      dependencies: [],
    },
    {
      path: 'README.md',
      purpose: 'Project documentation',
      componentId: null,
      dependencies: [],
    },
  ];

  // Add files for each component
  for (const component of components) {
    switch (component.type) {
      case 'service':
      case 'static_site':
        files.push({
          path: `src/${component.id.toLowerCase()}/index.ts`,
          purpose: `Main entry for ${component.name}`,
          componentId: component.id,
          dependencies: [],
        });
        break;
      case 'database':
        files.push({
          path: `src/lib/db.ts`,
          purpose: `Database client for ${component.name}`,
          componentId: component.id,
          dependencies: [],
        });
        break;
      case 'worker':
        files.push({
          path: `src/workers/${component.id.toLowerCase()}.ts`,
          purpose: `Worker process for ${component.name}`,
          componentId: component.id,
          dependencies: [],
        });
        break;
      case 'job':
        files.push({
          path: `src/jobs/${component.id.toLowerCase()}.ts`,
          purpose: `Scheduled job for ${component.name}`,
          componentId: component.id,
          dependencies: [],
        });
        break;
    }
  }

  // Add Dockerfile
  files.push({
    path: 'Dockerfile',
    purpose: 'Container build configuration',
    componentId: null,
    dependencies: [],
  });

  return { files };
}
