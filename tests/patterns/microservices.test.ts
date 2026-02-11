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

describe('Pattern: Microservices', () => {
  it('should generate valid AppSpec from diagram', async () => {
    const diagramPath = join(__dirname, '../../examples/microservices/diagram.mmd');
    const content = await readFile(diagramPath, 'utf-8');

    const ast = parse(content);
    const ir = transform(ast);
    const yaml = generate(ir);
    const appspec = YAML.parse(yaml);

    const validation = validate(appspec);
    expect(validation.valid).toBe(true);
  });

  it('should have correct app name', async () => {
    const diagramPath = join(__dirname, '../../examples/microservices/diagram.mmd');
    const content = await readFile(diagramPath, 'utf-8');

    const ast = parse(content);
    const ir = transform(ast);
    const yaml = generate(ir);
    const appspec = YAML.parse(yaml);

    expect(appspec.name).toBe('ecommerce');
  });

  it('should have frontend as static site', async () => {
    const diagramPath = join(__dirname, '../../examples/microservices/diagram.mmd');
    const content = await readFile(diagramPath, 'utf-8');

    const ast = parse(content);
    const ir = transform(ast);
    const yaml = generate(ir);
    const appspec = YAML.parse(yaml);

    expect(appspec.static_sites).toHaveLength(1);
    expect(appspec.static_sites[0].name).toBe('react-spa');
  });

  it('should have three API services', async () => {
    const diagramPath = join(__dirname, '../../examples/microservices/diagram.mmd');
    const content = await readFile(diagramPath, 'utf-8');

    const ast = parse(content);
    const ir = transform(ast);
    const yaml = generate(ir);
    const appspec = YAML.parse(yaml);

    expect(appspec.services).toHaveLength(3);
    const serviceNames = appspec.services.map((s: any) => s.name);
    expect(serviceNames).toContain('user-api');
    expect(serviceNames).toContain('order-api');
    expect(serviceNames).toContain('product-api');
  });

  it('should have PostgreSQL and Redis databases', async () => {
    const diagramPath = join(__dirname, '../../examples/microservices/diagram.mmd');
    const content = await readFile(diagramPath, 'utf-8');

    const ast = parse(content);
    const ir = transform(ast);
    const yaml = generate(ir);
    const appspec = YAML.parse(yaml);

    expect(appspec.databases).toHaveLength(2);
    const engines = appspec.databases.map((db: any) => db.engine);
    expect(engines).toContain('PG');
    expect(engines).toContain('REDIS');
  });
});
