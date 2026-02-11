import { chat, chatStream } from '../llm/client.js';
import { CODE_GENERATOR_PROMPT, formatComponentForPrompt } from './prompts.js';
export async function generateFile(params) {
    const { file, components, existingFiles, config } = params;
    // Find the component this file belongs to
    const component = file.componentId
        ? components.find(c => c.id === file.componentId)
        : null;
    // Get context from dependencies
    const dependencyContext = file.dependencies
        .filter(dep => existingFiles.has(dep))
        .map(dep => `// ${dep}\n${existingFiles.get(dep)?.slice(0, 500)}...`)
        .join('\n\n');
    const prompt = buildFilePrompt(file, component, dependencyContext, components);
    const messages = [
        { role: 'user', content: prompt }
    ];
    const response = await chat(CODE_GENERATOR_PROMPT, messages, config);
    // Clean up the response - remove markdown code blocks if present
    let content = response.content.trim();
    if (content.startsWith('```')) {
        content = content.replace(/```\w*\n?/g, '').replace(/```$/g, '').trim();
    }
    return {
        path: file.path,
        content,
        componentId: file.componentId,
        generatedAt: new Date(),
    };
}
export async function* generateFileStream(params) {
    const { file, components, existingFiles, config } = params;
    const component = file.componentId
        ? components.find(c => c.id === file.componentId)
        : null;
    const dependencyContext = file.dependencies
        .filter(dep => existingFiles.has(dep))
        .map(dep => `// ${dep}\n${existingFiles.get(dep)?.slice(0, 500)}...`)
        .join('\n\n');
    const prompt = buildFilePrompt(file, component, dependencyContext, components);
    const messages = [
        { role: 'user', content: prompt }
    ];
    let fullContent = '';
    for await (const chunk of chatStream(CODE_GENERATOR_PROMPT, messages, config)) {
        fullContent += chunk;
        yield chunk;
    }
    // Clean up
    let content = fullContent.trim();
    if (content.startsWith('```')) {
        content = content.replace(/```\w*\n?/g, '').replace(/```$/g, '').trim();
    }
    return {
        path: file.path,
        content,
        componentId: file.componentId,
        generatedAt: new Date(),
    };
}
function buildFilePrompt(file, component, dependencyContext, allComponents) {
    let prompt = `Generate the file: ${file.path}
Purpose: ${file.purpose}
`;
    if (component) {
        prompt += `
This file belongs to:
${formatComponentForPrompt(component)}
`;
    }
    if (dependencyContext) {
        prompt += `
Related files for context:
${dependencyContext}
`;
    }
    // Add overall architecture context for key files
    if (file.path.includes('package.json') || file.path.includes('index') || file.path.includes('main')) {
        prompt += `
Full architecture context:
${allComponents.map(c => `- ${c.name} (${c.type}): ${c.spec?.description || 'No description'}`).join('\n')}
`;
    }
    // Add specific instructions based on file type
    if (file.path.endsWith('package.json')) {
        prompt += `
Include appropriate dependencies for the tech stack. Use recent stable versions.
`;
    }
    else if (file.path.includes('Dockerfile')) {
        prompt += `
Create a multi-stage Dockerfile optimized for production. Use slim base images.
`;
    }
    else if (file.path.endsWith('.env.example')) {
        prompt += `
Include all environment variables needed, with placeholder values and comments.
`;
    }
    return prompt;
}
export async function generateAllFiles(params) {
    const { files, components, config, onProgress } = params;
    const generatedFiles = [];
    const existingFiles = new Map();
    // Sort files so dependencies come first
    const sortedFiles = topologicalSort(files);
    for (let i = 0; i < sortedFiles.length; i++) {
        const file = sortedFiles[i];
        if (onProgress) {
            onProgress(i, sortedFiles.length, file.path);
        }
        try {
            const generated = await generateFile({
                file,
                components,
                existingFiles,
                config,
            });
            generatedFiles.push(generated);
            existingFiles.set(file.path, generated.content);
        }
        catch (error) {
            console.error(`Failed to generate ${file.path}:`, error);
            // Add a placeholder file
            generatedFiles.push({
                path: file.path,
                content: `// Error generating file: ${error instanceof Error ? error.message : 'Unknown error'}\n// Purpose: ${file.purpose}`,
                componentId: file.componentId,
                generatedAt: new Date(),
            });
        }
    }
    return generatedFiles;
}
// Topological sort for dependency ordering
function topologicalSort(files) {
    const fileMap = new Map(files.map(f => [f.path, f]));
    const visited = new Set();
    const result = [];
    function visit(file) {
        if (visited.has(file.path))
            return;
        visited.add(file.path);
        // Visit dependencies first
        for (const dep of file.dependencies) {
            const depFile = fileMap.get(dep);
            if (depFile) {
                visit(depFile);
            }
        }
        result.push(file);
    }
    // Start with config files (no dependencies usually)
    const configFiles = files.filter(f => f.path.includes('package.json') ||
        f.path.includes('tsconfig') ||
        f.path.endsWith('.json') ||
        f.path.startsWith('.'));
    for (const file of configFiles) {
        visit(file);
    }
    // Then the rest
    for (const file of files) {
        visit(file);
    }
    return result;
}
//# sourceMappingURL=generator.js.map