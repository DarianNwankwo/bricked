/**
 * Code generation job processor
 *
 * Takes a BAC and generates all project files, or edits a single file.
 * Reports progress per-file so the web server can stream updates to clients.
 */

import type { Job } from 'bullmq';
import type { CodegenGenerateJobData, CodegenEditJobData } from '../../server/queue/index.js';
import type { JobEventPublisher } from '../../server/queue/events.js';
import { planCodeStructureFromBAC } from '../../codegen/planner.js';
import { generateFileFromBAC, editFile } from '../../codegen/generator.js';
import type { GeneratedFile } from '../../codegen/generator.js';
import type { Component } from '../../codegen/planner.js';
import type { BrickAppContract } from '../../types/bac.js';
import { getLLMConfig } from '../../llm/config.js';

export async function processCodegenGenerate(
  job: Job<CodegenGenerateJobData>,
  publisher: JobEventPublisher
): Promise<GeneratedFile[]> {
  const { projectId, userId, bac: bacData, componentSpecs, model } = job.data;
  const bac = bacData as BrickAppContract;

  const emitProgress = (progress: number, stage: string, data?: unknown) =>
    publisher.publishProgress({
      jobId: job.id!,
      jobType: 'codegen:generate',
      projectId,
      userId,
      progress,
      stage,
      data,
    });

  let config = getLLMConfig();
  if (model) {
    config = { ...config, model };
  }

  // Step 1: Plan file structure from BAC
  await emitProgress(5, 'Planning file structure from BAC');
  const projectName = bac.metadata?.name || 'project';
  const plan = await planCodeStructureFromBAC(bac, projectName, config);

  await emitProgress(15, `Planned ${plan.files.length} files`);

  // Step 2: Build component list from BAC
  const components: Component[] = (bac.systemContracts?.nodes || []).map(node => ({
    id: node.nodeId,
    name: node.nodeName,
    type: node.nodeType,
    spec: {
      description: node.description,
      inputs: node.inputContract,
      outputs: node.outputContract,
      notes: node.notes,
    },
    connections: (bac.systemContracts?.edges || [])
      .filter(e => e.fromNodeId === node.nodeId)
      .map(e => e.toNodeId),
  }));

  // Step 3: Generate each file
  const generatedFiles: GeneratedFile[] = [];
  const existingFiles = new Map<string, string>();
  const totalFiles = plan.files.length;

  for (let i = 0; i < totalFiles; i++) {
    const file = plan.files[i];
    const fileProgress = 15 + Math.round((i / totalFiles) * 80);

    await emitProgress(fileProgress, `Generating ${file.path} (${i + 1}/${totalFiles})`);

    try {
      const generated = await generateFileFromBAC({
        file,
        components,
        existingFiles,
        config,
        bac,
      });
      generatedFiles.push(generated);
      existingFiles.set(file.path, generated.content);

      // Emit partial result so frontend can show files as they're generated
      await emitProgress(fileProgress, `Generated ${file.path}`, {
        file: { path: generated.path, componentId: generated.componentId },
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      generatedFiles.push({
        path: file.path,
        content: `// Error generating file: ${errMsg}\n// Purpose: ${file.purpose}`,
        componentId: file.componentId,
        generatedAt: new Date(),
      });
    }
  }

  await emitProgress(95, `Generated ${generatedFiles.length} files`);

  return generatedFiles;
}

export async function processCodegenEdit(
  job: Job<CodegenEditJobData>,
  publisher: JobEventPublisher
): Promise<GeneratedFile> {
  const { projectId, userId, filePath, editRequest, existingContent, bac: bacData, model } = job.data;

  const emitProgress = (progress: number, stage: string, data?: unknown) =>
    publisher.publishProgress({
      jobId: job.id!,
      jobType: 'codegen:edit',
      projectId,
      userId,
      progress,
      stage,
      data,
    });

  let config = getLLMConfig();
  if (model) {
    config = { ...config, model };
  }

  await emitProgress(20, `Editing ${filePath}`);

  const result = await editFile({
    file: { path: filePath, purpose: '', componentId: null, dependencies: [] },
    components: [],
    existingFiles: new Map(),
    existingContent,
    editRequest,
    config,
  });

  await emitProgress(90, `Edit complete for ${filePath}`);

  return result;
}
