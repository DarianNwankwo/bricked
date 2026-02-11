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

describe('Pattern: Web App + Database', () => {
  it('should generate valid AppSpec from diagram', async () => {
    const diagramPath = join(__dirname, '../../examples/web-app-db/diagram.mmd');
    const content = await readFile(diagramPath, 'utf-8');

    const ast = parse(content);
    const ir = transform(ast);
    const yaml = generate(ir);
    const appspec = YAML.parse(yaml);

    const validation = validate(appspec);
    expect(validation.valid).toBe(true);
  });

  it('should have correct app name', async () => {
    const diagramPath = join(__dirname, '../../examples/web-app-db/diagram.mmd');
    const content = await readFile(diagramPath, 'utf-8');

    const ast = parse(content);
    const ir = transform(ast);
    const yaml = generate(ir);
    const appspec = YAML.parse(yaml);

    expect(appspec.name).toBe('nextjs-app');
  });

  it('should have one service and one database', async () => {
    const diagramPath = join(__dirname, '../../examples/web-app-db/diagram.mmd');
    const content = await readFile(diagramPath, 'utf-8');

    const ast = parse(content);
    const ir = transform(ast);
    const yaml = generate(ir);
    const appspec = YAML.parse(yaml);

    expect(appspec.services).toHaveLength(1);
    expect(appspec.databases).toHaveLength(1);
  });

  it('should connect service to database via env var', async () => {
    const diagramPath = join(__dirname, '../../examples/web-app-db/diagram.mmd');
    const content = await readFile(diagramPath, 'utf-8');

    const ast = parse(content);
    const ir = transform(ast);
    const yaml = generate(ir);
    const appspec = YAML.parse(yaml);

    expect(appspec.services[0].envs).toBeDefined();
    expect(appspec.services[0].envs.some((env: any) => env.key.includes('URL'))).toBe(true);
  });
});
