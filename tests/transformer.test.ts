import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser/index.js';
import { transform } from '../src/transformer/index.js';

describe('Transformer', () => {
  describe('Component type inference', () => {
    it('should transform rectangle to service', () => {
      const ast = parse(`flowchart TD
        A[My API]`);
      const ir = transform(ast);
      expect(ir.components[0].type).toBe('service');
    });

    it('should transform stadium to static_site', () => {
      const ast = parse(`flowchart TD
        A([My Site])`);
      const ir = transform(ast);
      expect(ir.components[0].type).toBe('static_site');
    });

    it('should transform cylinder to database', () => {
      const ast = parse(`flowchart TD
        A[(PostgreSQL)]`);
      const ir = transform(ast);
      expect(ir.components[0].type).toBe('database');
    });

    it('should transform circle to worker', () => {
      const ast = parse(`flowchart TD
        A((Worker))`);
      const ir = transform(ast);
      expect(ir.components[0].type).toBe('worker');
    });

    it('should transform hexagon to job', () => {
      const ast = parse(`flowchart TD
        A{{Job}}`);
      const ir = transform(ast);
      expect(ir.components[0].type).toBe('job');
    });
  });

  describe('Database engine inference', () => {
    it('should infer PostgreSQL from label', () => {
      const ast = parse(`flowchart TD
        A[(PostgreSQL)]`);
      const ir = transform(ast);
      expect(ir.components[0].config.engine).toBe('PG');
    });

    it('should infer Redis from label', () => {
      const ast = parse(`flowchart TD
        A[(Redis)]`);
      const ir = transform(ast);
      expect(ir.components[0].config.engine).toBe('REDIS');
    });

    it('should infer MongoDB from label', () => {
      const ast = parse(`flowchart TD
        A[(MongoDB)]`);
      const ir = transform(ast);
      expect(ir.components[0].config.engine).toBe('MONGODB');
    });

    it('should default to PG for unknown database', () => {
      const ast = parse(`flowchart TD
        A[(Database)]`);
      const ir = transform(ast);
      expect(ir.components[0].config.engine).toBe('PG');
    });
  });

  describe('Port inference', () => {
    it('should infer port 3000 for Next.js', () => {
      const ast = parse(`flowchart TD
        A[Next.js App]`);
      const ir = transform(ast);
      expect(ir.components[0].config.port).toBe(3000);
    });

    it('should infer port 8080 for Go', () => {
      const ast = parse(`flowchart TD
        A[Go API]`);
      const ir = transform(ast);
      expect(ir.components[0].config.port).toBe(8080);
    });

    it('should infer port 8000 for Django', () => {
      const ast = parse(`flowchart TD
        A[Django App]`);
      const ir = transform(ast);
      expect(ir.components[0].config.port).toBe(8000);
    });
  });

  describe('App configuration', () => {
    it('should use name from annotation', () => {
      const ast = parse(`flowchart TD
        %% brick:name=my-app
        A[Service]`);
      const ir = transform(ast);
      expect(ir.name).toBe('my-app');
    });

    it('should use name from options over annotation', () => {
      const ast = parse(`flowchart TD
        %% brick:name=my-app
        A[Service]`);
      const ir = transform(ast, { name: 'override-name' });
      expect(ir.name).toBe('override-name');
    });

    it('should use region from annotation', () => {
      const ast = parse(`flowchart TD
        %% brick:region=sfo
        A[Service]`);
      const ir = transform(ast);
      expect(ir.region).toBe('sfo');
    });
  });

  describe('Connections', () => {
    it('should track connections between components', () => {
      const ast = parse(`flowchart TD
        A[Service] --> B[(DB)]`);
      const ir = transform(ast);
      const service = ir.components.find(c => c.type === 'service');
      expect(service?.connections).toContain('B');
    });
  });

  describe('Name slugification', () => {
    it('should slugify component names', () => {
      const ast = parse(`flowchart TD
        A[My Great Service]`);
      const ir = transform(ast);
      expect(ir.components[0].name).toBe('my-great-service');
    });
  });
});
