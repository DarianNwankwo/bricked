import { describe, it, expect } from 'vitest';
import YAML from 'yaml';
import { parse } from '../src/parser/index.js';
import { transform } from '../src/transformer/index.js';
import { generate } from '../src/generator/index.js';

describe('Generator', () => {
  describe('Basic generation', () => {
    it('should generate valid YAML', () => {
      const ast = parse(`flowchart TD
        %% brick:name=test-app
        A[Service]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml);
      expect(parsed.name).toBe('test-app');
    });

    it('should include region', () => {
      const ast = parse(`flowchart TD
        %% brick:name=test-app
        %% brick:region=sfo
        A[Service]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml);
      expect(parsed.region).toBe('sfo');
    });
  });

  describe('Service generation', () => {
    it('should generate service with git source', () => {
      const ast = parse(`flowchart TD
        A[API]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml);
      expect(parsed.services).toHaveLength(1);
      expect(parsed.services[0].git).toBeDefined();
    });

    it('should include http_port for service', () => {
      const ast = parse(`flowchart TD
        A[Node API]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml);
      expect(parsed.services[0].http_port).toBe(3000);
    });

    it('should include instance configuration', () => {
      const ast = parse(`flowchart TD
        A[API]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml);
      expect(parsed.services[0].instance_count).toBe(1);
      expect(parsed.services[0].instance_size_slug).toBe('basic-xxs');
    });
  });

  describe('Static site generation', () => {
    it('should generate static_sites section', () => {
      const ast = parse(`flowchart TD
        A([React App])`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml);
      expect(parsed.static_sites).toHaveLength(1);
    });

    it('should include output_dir', () => {
      const ast = parse(`flowchart TD
        A([Vite App])`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml);
      expect(parsed.static_sites[0].output_dir).toBe('dist');
    });
  });

  describe('Database generation', () => {
    it('should generate databases section', () => {
      const ast = parse(`flowchart TD
        A[(PostgreSQL)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml);
      expect(parsed.databases).toHaveLength(1);
      expect(parsed.databases[0].engine).toBe('PG');
    });

    it('should include database size', () => {
      const ast = parse(`flowchart TD
        A[(DB)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml);
      expect(parsed.databases[0].size).toBe('db-s-dev-database');
    });
  });

  describe('Worker generation', () => {
    it('should generate workers section', () => {
      const ast = parse(`flowchart TD
        A((Worker))`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml);
      expect(parsed.workers).toHaveLength(1);
    });
  });

  describe('Job generation', () => {
    it('should generate jobs section', () => {
      const ast = parse(`flowchart TD
        A{{Cron Job}}`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml);
      expect(parsed.jobs).toHaveLength(1);
      expect(parsed.jobs[0].kind).toBe('PRE_DEPLOY');
    });
  });

  describe('Database environment variables', () => {
    it('should add DATABASE_URL env var for connected database', () => {
      const ast = parse(`flowchart TD
        A[Service] --> B[(PostgreSQL)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml);
      expect(parsed.services[0].envs).toBeDefined();
      expect(parsed.services[0].envs).toContainEqual({
        key: 'POSTGRESQL_URL',
        value: '${postgresql.DATABASE_URL}',
      });
    });

    it('should add REDIS_URL for connected Redis', () => {
      const ast = parse(`flowchart TD
        A[Service] --> B[(Redis)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml);
      expect(parsed.services[0].envs).toContainEqual({
        key: 'REDIS_URL',
        value: '${redis.REDIS_URL}',
      });
    });
  });

  describe('Pattern examples', () => {
    it('should generate valid AppSpec for web-app-db pattern', () => {
      const ast = parse(`flowchart TD
        %% brick:name=nextjs-app
        A[Next.js App] --> B[(PostgreSQL)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml);
      expect(parsed.name).toBe('nextjs-app');
      expect(parsed.services).toHaveLength(1);
      expect(parsed.databases).toHaveLength(1);
    });

    it('should generate valid AppSpec for microservices pattern', () => {
      const ast = parse(`flowchart TD
        %% brick:name=ecommerce
        A([React SPA]) --> B[User API]
        A --> C[Order API]
        A --> D[Product API]
        B & C & D --> E[(PostgreSQL)]
        C --> F[(Redis)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml);
      expect(parsed.name).toBe('ecommerce');
      expect(parsed.static_sites).toHaveLength(1);
      expect(parsed.services).toHaveLength(3);
      expect(parsed.databases).toHaveLength(2);
    });
  });
});
