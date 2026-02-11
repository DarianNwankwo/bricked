import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import { parse } from '../../src/parser/index.js';
import { transform } from '../../src/transformer/index.js';
import { generate } from '../../src/generator/index.js';
import { validate } from '../../src/validator/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Pattern: Scheduled Jobs', () => {
  it('should generate valid AppSpec from diagram', async () => {
    const diagramPath = join(__dirname, '../../examples/scheduled-jobs/diagram.mmd');
    const content = await readFile(diagramPath, 'utf-8');

    const ast = parse(content);
    const ir = transform(ast);
    const yaml = generate(ir);
    const appspec = YAML.parse(yaml);

    const validation = validate(appspec);
    expect(validation.valid).toBe(true);
  });

  it('should have correct app name', async () => {
    const diagramPath = join(__dirname, '../../examples/scheduled-jobs/diagram.mmd');
    const content = await readFile(diagramPath, 'utf-8');

    const ast = parse(content);
    const ir = transform(ast);
    const yaml = generate(ir);
    const appspec = YAML.parse(yaml);

    expect(appspec.name).toBe('analytics');
  });

  it('should have two jobs', async () => {
    const diagramPath = join(__dirname, '../../examples/scheduled-jobs/diagram.mmd');
    const content = await readFile(diagramPath, 'utf-8');

    const ast = parse(content);
    const ir = transform(ast);
    const yaml = generate(ir);
    const appspec = YAML.parse(yaml);

    expect(appspec.jobs).toHaveLength(2);
    const jobNames = appspec.jobs.map((j: any) => j.name);
    expect(jobNames).toContain('daily-report');
    expect(jobNames).toContain('hourly-sync');
  });

  it('should have PostgreSQL database', async () => {
    const diagramPath = join(__dirname, '../../examples/scheduled-jobs/diagram.mmd');
    const content = await readFile(diagramPath, 'utf-8');

    const ast = parse(content);
    const ir = transform(ast);
    const yaml = generate(ir);
    const appspec = YAML.parse(yaml);

    expect(appspec.databases).toHaveLength(1);
    expect(appspec.databases[0].engine).toBe('PG');
  });

  it('should parse schedule annotations', async () => {
    const diagramPath = join(__dirname, '../../examples/scheduled-jobs/diagram.mmd');
    const content = await readFile(diagramPath, 'utf-8');

    const ast = parse(content);
    const scheduleAnnotations = ast.annotations.filter(a => a.key === 'schedule');
    expect(scheduleAnnotations).toHaveLength(2);
    expect(scheduleAnnotations.some(a => a.value === '0 6 * * *')).toBe(true);
    expect(scheduleAnnotations.some(a => a.value === '0 * * * *')).toBe(true);
  });
});
