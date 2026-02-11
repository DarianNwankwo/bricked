import { chat, type ChatMessage } from './client.js';
import { SYSTEM_PROMPT } from './prompts/system.js';
import type { Message, ArchitectResult } from './architect.js';

function extractMermaidBlock(content: string): string | null {
  const mermaidMatch = content.match(/```mermaid\n([\s\S]*?)```/);
  if (mermaidMatch) {
    return mermaidMatch[1].trim();
  }

  const genericMatch = content.match(/```\n?(flowchart[\s\S]*?)```/);
  if (genericMatch) {
    return genericMatch[1].trim();
  }

  return null;
}

function extractExplanation(content: string, diagram: string | null): string {
  if (!diagram) {
    return content.trim();
  }

  let explanation = content;
  explanation = explanation.replace(/```mermaid[\s\S]*?```/g, '');
  explanation = explanation.replace(/```[\s\S]*?```/g, '');

  return explanation.trim();
}

const REFINE_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

## Refinement Mode

You are in refinement mode. The user has an existing architecture and wants to modify it.

When refining:
1. Preserve the existing structure unless changes are requested
2. Only modify the parts that need to change
3. Keep the same naming conventions and style
4. Explain what changed and why

If the user asks a question that doesn't require changes, answer it without outputting a new diagram.
If changes are needed, always output the complete updated diagram (not just the changes).`;

export async function refineArchitecture(
  userMessage: string,
  currentDiagram: string,
  conversationHistory: Message[]
): Promise<ArchitectResult> {
  const contextMessage = `Current architecture:

\`\`\`mermaid
${currentDiagram}
\`\`\`

User request: ${userMessage}`;

  const messages: ChatMessage[] = [
    ...conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: contextMessage },
  ];

  const response = await chat(REFINE_SYSTEM_PROMPT, messages);
  const rawContent = response.content;

  const diagram = extractMermaidBlock(rawContent);
  const explanation = extractExplanation(rawContent, diagram);

  return {
    diagram: diagram || currentDiagram,
    explanation,
    rawContent,
  };
}
