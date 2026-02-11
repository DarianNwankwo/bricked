import { describe, it, expect } from 'vitest';
import YAML from 'yaml';
import { parse } from '../../src/parser/index.js';
import { transform } from '../../src/transformer/index.js';
import { generate } from '../../src/generator/index.js';
import type { AppSpec } from '../../src/types/appspec.js';

describe('AppSpec Generator', () => {
  describe('Generate valid AppSpec YAML', () => {
    it('should generate parseable YAML', () => {
      const ast = parse(`flowchart TD
        %% brick:name=test-app
        A[Service]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      expect(() => YAML.parse(yaml)).not.toThrow();
    });

    it('should include app name in generated YAML', () => {
      const ast = parse(`flowchart TD
        %% brick:name=my-app
        A[Service]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.name).toBe('my-app');
    });

    it('should include region in generated YAML', () => {
      const ast = parse(`flowchart TD
        %% brick:name=my-app
        %% brick:region=sfo
        A[Service]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.region).toBe('sfo');
    });

    it('should normalize region to lowercase', () => {
      const ast = parse(`flowchart TD
        %% brick:region=SFO
        A[Service]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.region).toBe('sfo');
    });

    it('should generate proper YAML structure', () => {
      const ast = parse(`flowchart TD
        %% brick:name=test
        A[Service] --> B[(DB)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed).toHaveProperty('name');
      expect(parsed).toHaveProperty('services');
      expect(parsed).toHaveProperty('databases');
    });
  });

  describe('Generate services', () => {
    it('should generate services array for service components', () => {
      const ast = parse(`flowchart TD
        A[API]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.services).toBeDefined();
      expect(parsed.services).toHaveLength(1);
    });

    it('should include service name', () => {
      const ast = parse(`flowchart TD
        A[My API Service]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.services![0].name).toBe('my-api-service');
    });

    it('should include git source with placeholder', () => {
      const ast = parse(`flowchart TD
        A[API]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.services![0].git).toBeDefined();
      expect(parsed.services![0].git!.repo).toBe('https://github.com/your-org/your-repo');
      expect(parsed.services![0].git!.branch).toBe('main');
    });

    it('should include http_port from inferred port', () => {
      const ast = parse(`flowchart TD
        A[Node API]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.services![0].http_port).toBe(3000);
    });

    it('should include instance_count with default', () => {
      const ast = parse(`flowchart TD
        A[API]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.services![0].instance_count).toBe(1);
    });

    it('should include instance_size_slug with default', () => {
      const ast = parse(`flowchart TD
        A[API]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.services![0].instance_size_slug).toBe('basic-xxs');
    });

    it('should include build_command from annotation', () => {
      const ast = parse(`flowchart TD
        A[API]
        %% brick:A:build=npm run build`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.services![0].build_command).toBe('npm run build');
    });

    it('should include run_command from annotation', () => {
      const ast = parse(`flowchart TD
        A[API]
        %% brick:A:run=npm start`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.services![0].run_command).toBe('npm start');
    });

    it('should include custom instance_count from annotation', () => {
      const ast = parse(`flowchart TD
        A[API]
        %% brick:A:instances=3`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.services![0].instance_count).toBe(3);
    });

    it('should include custom instance_size from annotation', () => {
      const ast = parse(`flowchart TD
        A[API]
        %% brick:A:size=basic-s`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.services![0].instance_size_slug).toBe('basic-s');
    });

    it('should generate multiple services', () => {
      const ast = parse(`flowchart TD
        A[User API]
        B[Order API]
        C[Product API]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.services).toHaveLength(3);
    });
  });

  describe('Generate static sites', () => {
    it('should generate static_sites array for static site components', () => {
      const ast = parse(`flowchart TD
        A([React App])`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.static_sites).toBeDefined();
      expect(parsed.static_sites).toHaveLength(1);
    });

    it('should include static site name', () => {
      const ast = parse(`flowchart TD
        A([My Frontend])`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.static_sites![0].name).toBe('my-frontend');
    });

    it('should include output_dir for static site', () => {
      const ast = parse(`flowchart TD
        A([Vite App])`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.static_sites![0].output_dir).toBe('dist');
    });

    it('should include git source for static site', () => {
      const ast = parse(`flowchart TD
        A([React App])`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.static_sites![0].git).toBeDefined();
    });

    it('should include custom output_dir from annotation', () => {
      const ast = parse(`flowchart TD
        A([My Site])
        %% brick:A:output=build`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.static_sites![0].output_dir).toBe('build');
    });

    it('should include build_command from annotation', () => {
      const ast = parse(`flowchart TD
        A([React App])
        %% brick:A:build=npm run build`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.static_sites![0].build_command).toBe('npm run build');
    });
  });

  describe('Generate databases', () => {
    it('should generate databases array for database components', () => {
      const ast = parse(`flowchart TD
        A[(PostgreSQL)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.databases).toBeDefined();
      expect(parsed.databases).toHaveLength(1);
    });

    it('should include database name', () => {
      const ast = parse(`flowchart TD
        A[(My Database)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.databases![0].name).toBe('my-database');
    });

    it('should include database engine', () => {
      const ast = parse(`flowchart TD
        A[(PostgreSQL)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.databases![0].engine).toBe('PG');
    });

    it('should include database version', () => {
      const ast = parse(`flowchart TD
        A[(PostgreSQL)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.databases![0].version).toBe('16');
    });

    it('should include database size with default', () => {
      const ast = parse(`flowchart TD
        A[(DB)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.databases![0].size).toBe('db-s-dev-database');
    });

    it('should generate MySQL database correctly', () => {
      const ast = parse(`flowchart TD
        A[(MySQL)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.databases![0].engine).toBe('MYSQL');
      expect(parsed.databases![0].version).toBe('8');
    });

    it('should generate Redis database correctly', () => {
      const ast = parse(`flowchart TD
        A[(Redis)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.databases![0].engine).toBe('REDIS');
    });

    it('should generate MongoDB database correctly', () => {
      const ast = parse(`flowchart TD
        A[(MongoDB)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.databases![0].engine).toBe('MONGODB');
    });

    it('should generate multiple databases', () => {
      const ast = parse(`flowchart TD
        A[(PostgreSQL)]
        B[(Redis)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.databases).toHaveLength(2);
    });
  });

  describe('Generate workers', () => {
    it('should generate workers array for worker components', () => {
      const ast = parse(`flowchart TD
        A((Background Worker))`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.workers).toBeDefined();
      expect(parsed.workers).toHaveLength(1);
    });

    it('should include worker name', () => {
      const ast = parse(`flowchart TD
        A((Email Worker))`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.workers![0].name).toBe('email-worker');
    });

    it('should include git source for worker', () => {
      const ast = parse(`flowchart TD
        A((Worker))`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.workers![0].git).toBeDefined();
    });

    it('should include instance configuration for worker', () => {
      const ast = parse(`flowchart TD
        A((Worker))`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.workers![0].instance_count).toBe(1);
      expect(parsed.workers![0].instance_size_slug).toBe('basic-xxs');
    });

    it('should include run_command from annotation', () => {
      const ast = parse(`flowchart TD
        A((Worker))
        %% brick:A:run=npm run worker`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.workers![0].run_command).toBe('npm run worker');
    });
  });

  describe('Generate jobs', () => {
    it('should generate jobs array for job components', () => {
      const ast = parse(`flowchart TD
        A{{Cron Job}}`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.jobs).toBeDefined();
      expect(parsed.jobs).toHaveLength(1);
    });

    it('should include job name', () => {
      const ast = parse(`flowchart TD
        A{{Daily Report}}`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.jobs![0].name).toBe('daily-report');
    });

    it('should include job kind with default PRE_DEPLOY', () => {
      const ast = parse(`flowchart TD
        A{{Job}}`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.jobs![0].kind).toBe('PRE_DEPLOY');
    });

    it('should include git source for job', () => {
      const ast = parse(`flowchart TD
        A{{Job}}`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.jobs![0].git).toBeDefined();
    });

    it('should include instance configuration for job', () => {
      const ast = parse(`flowchart TD
        A{{Job}}`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.jobs![0].instance_count).toBe(1);
      expect(parsed.jobs![0].instance_size_slug).toBe('basic-xxs');
    });
  });

  describe('Handle environment variables', () => {
    it('should not include envs when no connections', () => {
      const ast = parse(`flowchart TD
        A[Service]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.services![0].envs).toBeUndefined();
    });

    it('should add environment variable for database connection', () => {
      const ast = parse(`flowchart TD
        A[Service] --> B[(PostgreSQL)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.services![0].envs).toBeDefined();
      expect(parsed.services![0].envs!.length).toBeGreaterThan(0);
    });

    it('should format PostgreSQL env var correctly', () => {
      const ast = parse(`flowchart TD
        A[Service] --> B[(PostgreSQL)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      const envVar = parsed.services![0].envs!.find(e => e.key.includes('URL'));
      expect(envVar).toBeDefined();
      expect(envVar!.value).toContain('DATABASE_URL');
    });

    it('should format Redis env var correctly', () => {
      const ast = parse(`flowchart TD
        A[Service] --> B[(Redis)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      const envVar = parsed.services![0].envs!.find(e => e.key.includes('URL'));
      expect(envVar).toBeDefined();
      expect(envVar!.value).toContain('REDIS_URL');
    });

    it('should add multiple env vars for multiple database connections', () => {
      const ast = parse(`flowchart TD
        A[Service] --> B[(PostgreSQL)]
        A --> C[(Redis)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.services![0].envs!.length).toBe(2);
    });

    it('should add env vars for worker connected to database', () => {
      const ast = parse(`flowchart TD
        A((Worker)) --> B[(PostgreSQL)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.workers![0].envs).toBeDefined();
    });

    it('should add env vars for job connected to database', () => {
      const ast = parse(`flowchart TD
        A{{Job}} --> B[(PostgreSQL)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.jobs![0].envs).toBeDefined();
    });
  });

  describe('Handle database connection strings', () => {
    it('should use correct variable format for PostgreSQL', () => {
      const ast = parse(`flowchart TD
        A[Service] --> B[(PostgreSQL)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      const envVar = parsed.services![0].envs![0];
      expect(envVar.value).toMatch(/\$\{.+\.DATABASE_URL\}/);
    });

    it('should use correct variable format for Redis', () => {
      const ast = parse(`flowchart TD
        A[Service] --> B[(Redis)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      const envVar = parsed.services![0].envs![0];
      expect(envVar.value).toMatch(/\$\{.+\.REDIS_URL\}/);
    });

    it('should reference database by its slugified name', () => {
      const ast = parse(`flowchart TD
        A[Service] --> B[(My Database)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      const envVar = parsed.services![0].envs![0];
      expect(envVar.value).toContain('my-database');
    });

    it('should create unique env var keys for multiple databases', () => {
      const ast = parse(`flowchart TD
        A[Service] --> B[(User DB)]
        A --> C[(Order DB)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      const keys = parsed.services![0].envs!.map(e => e.key);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });

  describe('Complex patterns', () => {
    it('should generate valid AppSpec for web-app-db pattern', () => {
      const ast = parse(`flowchart TD
        %% brick:name=nextjs-app
        A[Next.js App] --> B[(PostgreSQL)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.name).toBe('nextjs-app');
      expect(parsed.services).toHaveLength(1);
      expect(parsed.databases).toHaveLength(1);
      expect(parsed.services![0].envs).toBeDefined();
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

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.name).toBe('ecommerce');
      expect(parsed.static_sites).toHaveLength(1);
      expect(parsed.services).toHaveLength(3);
      expect(parsed.databases).toHaveLength(2);
    });

    it('should generate valid AppSpec for queue-workers pattern', () => {
      const ast = parse(`flowchart TD
        %% brick:name=processor
        A[API] --> B[(Redis)]
        B --> C((Email Worker))
        B --> D((PDF Worker))
        C & D --> E[(PostgreSQL)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.name).toBe('processor');
      expect(parsed.services).toHaveLength(1);
      expect(parsed.workers).toHaveLength(2);
      expect(parsed.databases).toHaveLength(2);
    });

    it('should generate valid AppSpec for scheduled-jobs pattern', () => {
      const ast = parse(`flowchart TD
        %% brick:name=analytics
        A{{Daily Report}}
        B{{Hourly Sync}}
        A & B --> C[(PostgreSQL)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.name).toBe('analytics');
      expect(parsed.jobs).toHaveLength(2);
      expect(parsed.databases).toHaveLength(1);
    });

    it('should generate valid AppSpec for static-api pattern', () => {
      const ast = parse(`flowchart LR
        %% brick:name=blog
        A([Hugo Site]) --> B[Go API]
        B --> C[(PostgreSQL)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.name).toBe('blog');
      expect(parsed.static_sites).toHaveLength(1);
      expect(parsed.services).toHaveLength(1);
      expect(parsed.databases).toHaveLength(1);
    });
  });

  describe('Empty sections', () => {
    it('should not include services key when no services', () => {
      const ast = parse(`flowchart TD
        A[(Database)]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.services).toBeUndefined();
    });

    it('should not include static_sites key when no static sites', () => {
      const ast = parse(`flowchart TD
        A[Service]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.static_sites).toBeUndefined();
    });

    it('should not include databases key when no databases', () => {
      const ast = parse(`flowchart TD
        A[Service]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.databases).toBeUndefined();
    });

    it('should not include workers key when no workers', () => {
      const ast = parse(`flowchart TD
        A[Service]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.workers).toBeUndefined();
    });

    it('should not include jobs key when no jobs', () => {
      const ast = parse(`flowchart TD
        A[Service]`);
      const ir = transform(ast);
      const yaml = generate(ir);

      const parsed = YAML.parse(yaml) as AppSpec;
      expect(parsed.jobs).toBeUndefined();
    });
  });
});
