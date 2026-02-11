import { chat } from './client.js';
import { SYSTEM_PROMPT } from './prompts/system.js';
import { formatExamplesForPrompt } from './prompts/examples.js';
function extractMermaidBlock(content) {
    const mermaidMatch = content.match(/```mermaid\n([\s\S]*?)```/);
    if (mermaidMatch) {
        return mermaidMatch[1].trim();
    }
    const genericMatch = content.match(/```\n?(flowchart[\s\S]*?)```/);
    if (genericMatch) {
        return genericMatch[1].trim();
    }
    if (content.includes('flowchart')) {
        const lines = content.split('\n');
        const startIdx = lines.findIndex((line) => line.trim().startsWith('flowchart'));
        if (startIdx !== -1) {
            const diagramLines = [];
            for (let i = startIdx; i < lines.length; i++) {
                const line = lines[i];
                if (line.trim() === '' && diagramLines.length > 0) {
                    const nextNonEmpty = lines.slice(i + 1).find((l) => l.trim() !== '');
                    if (nextNonEmpty && !nextNonEmpty.trim().startsWith('%%') && !nextNonEmpty.trim().match(/^\w+[\[\(\{<>]/)) {
                        break;
                    }
                }
                if (line.trim().startsWith('flowchart') ||
                    line.trim().startsWith('%%') ||
                    line.trim().match(/^\w+[\[\(\{<>]/) ||
                    line.trim().match(/^\w+\s*(-->|---|\.\->|==>)/) ||
                    line.trim() === 'end' ||
                    line.trim().startsWith('subgraph') ||
                    line.trim() === '') {
                    diagramLines.push(line);
                }
                else if (diagramLines.length > 1) {
                    break;
                }
            }
            if (diagramLines.length > 1) {
                return diagramLines.join('\n').trim();
            }
        }
    }
    return null;
}
function extractExplanation(content, diagram) {
    if (!diagram) {
        return content.trim();
    }
    let explanation = content;
    explanation = explanation.replace(/```mermaid[\s\S]*?```/g, '');
    explanation = explanation.replace(/```[\s\S]*?```/g, '');
    return explanation.trim();
}
export async function generateArchitecture(description, conversationHistory) {
    const systemPrompt = `${SYSTEM_PROMPT}

## Few-Shot Examples

${formatExamplesForPrompt()}`;
    const messages = [
        ...conversationHistory.map((msg) => ({
            role: msg.role,
            content: msg.content,
        })),
        { role: 'user', content: description },
    ];
    const response = await chat(systemPrompt, messages);
    const rawContent = response.content;
    const diagram = extractMermaidBlock(rawContent);
    const explanation = extractExplanation(rawContent, diagram);
    return {
        diagram,
        explanation,
        rawContent,
    };
}
//# sourceMappingURL=architect.js.map