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

describe('Pattern: Queue-Based Workers', () => {
  it('should generate valid AppSpec from diagram', async () => {
    const diagramPath = join(__dirname, '../../examples/queue-workers/diagram.mmd');
    const content = await readFile(diagramPath, 'utf-8');

    const ast = parse(content);
    const ir = transform(ast);
    const yaml = generate(ir);
    const appspec = YAML.parse(yaml);

    const validation = validate(appspec);
    expect(validation.valid).toBe(true);
  });

  it('should have correct app name', async () => {
    const diagramPath = join(__dirname, '../../examples/queue-workers/diagram.mmd');
    const content = await readFile(diagramPath, 'utf-8');

    const ast = parse(content);
    const ir = transform(ast);
    const yaml = generate(ir);
    const appspec = YAML.parse(yaml);

    expect(appspec.name).toBe('processor');
  });

  it('should have one API service', async () => {
    const diagramPath = join(__dirname, '../../examples/queue-workers/diagram.mmd');
    const content = await readFile(diagramPath, 'utf-8');

    const ast = parse(content);
    const ir = transform(ast);
    const yaml = generate(ir);
    const appspec = YAML.parse(yaml);

    expect(appspec.services).toHaveLength(1);
    expect(appspec.services[0].name).toBe('api');
  });

  it('should have two workers', async () => {
    const diagramPath = join(__dirname, '../../examples/queue-workers/diagram.mmd');
    const content = await readFile(diagramPath, 'utf-8');

    const ast = parse(content);
    const ir = transform(ast);
    const yaml = generate(ir);
    const appspec = YAML.parse(yaml);

    expect(appspec.workers).toHaveLength(2);
    const workerNames = appspec.workers.map((w: any) => w.name);
    expect(workerNames).toContain('email-worker');
    expect(workerNames).toContain('pdf-worker');
  });

  it('should have Redis and PostgreSQL databases', async () => {
    const diagramPath = join(__dirname, '../../examples/queue-workers/diagram.mmd');
    const content = await readFile(diagramPath, 'utf-8');

    const ast = parse(content);
    const ir = transform(ast);
    const yaml = generate(ir);
    const appspec = YAML.parse(yaml);

    expect(appspec.databases).toHaveLength(2);
    const engines = appspec.databases.map((db: any) => db.engine);
    expect(engines).toContain('REDIS');
    expect(engines).toContain('PG');
  });
});
