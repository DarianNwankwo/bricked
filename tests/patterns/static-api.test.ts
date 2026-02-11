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

describe('Pattern: Static Site + API', () => {
  it('should generate valid AppSpec from diagram', async () => {
    const diagramPath = join(__dirname, '../../examples/static-api/diagram.mmd');
    const content = await readFile(diagramPath, 'utf-8');

    const ast = parse(content);
    const ir = transform(ast);
    const yaml = generate(ir);
    const appspec = YAML.parse(yaml);

    const validation = validate(appspec);
    expect(validation.valid).toBe(true);
  });

  it('should have correct app name', async () => {
    const diagramPath = join(__dirname, '../../examples/static-api/diagram.mmd');
    const content = await readFile(diagramPath, 'utf-8');

    const ast = parse(content);
    const ir = transform(ast);
    const yaml = generate(ir);
    const appspec = YAML.parse(yaml);

    expect(appspec.name).toBe('blog');
  });

  it('should have static site with Hugo', async () => {
    const diagramPath = join(__dirname, '../../examples/static-api/diagram.mmd');
    const content = await readFile(diagramPath, 'utf-8');

    const ast = parse(content);
    const ir = transform(ast);
    const yaml = generate(ir);
    const appspec = YAML.parse(yaml);

    expect(appspec.static_sites).toHaveLength(1);
    expect(appspec.static_sites[0].name).toBe('hugo-site');
  });

  it('should have Go API service', async () => {
    const diagramPath = join(__dirname, '../../examples/static-api/diagram.mmd');
    const content = await readFile(diagramPath, 'utf-8');

    const ast = parse(content);
    const ir = transform(ast);
    const yaml = generate(ir);
    const appspec = YAML.parse(yaml);

    expect(appspec.services).toHaveLength(1);
    expect(appspec.services[0].name).toBe('go-api');
    expect(appspec.services[0].http_port).toBe(8080);
  });

  it('should have PostgreSQL database', async () => {
    const diagramPath = join(__dirname, '../../examples/static-api/diagram.mmd');
    const content = await readFile(diagramPath, 'utf-8');

    const ast = parse(content);
    const ir = transform(ast);
    const yaml = generate(ir);
    const appspec = YAML.parse(yaml);

    expect(appspec.databases).toHaveLength(1);
    expect(appspec.databases[0].engine).toBe('PG');
  });

  it('should use LR direction', async () => {
    const diagramPath = join(__dirname, '../../examples/static-api/diagram.mmd');
    const content = await readFile(diagramPath, 'utf-8');

    const ast = parse(content);
    expect(ast.direction).toBe('LR');
  });
});
