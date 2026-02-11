import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import { parse } from '../../src/parser/index.js';
import { transform } from '../../src/transformer/index.js';
import { generate } from '../../src/generator/index.js';
import { validate } from '../../src/validator/index.js';
import { estimateCost } from '../../src/deployer/cost-estimator.js';
import type { AppSpec } from '../../src/types/appspec.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('End-to-End Pipeline', () => {
  describe('Full pipeline: Mermaid -> Parse -> Transform -> Generate -> Validate', () => {
    it('should complete full pipeline for simple service', () => {
      const input = `flowchart TD
        %% brick:name=my-service
        A[Express API]`;

      const ast = parse(input);
      expect(ast.nodes).toHaveLength(1);

      const ir = transform(ast);
      expect(ir.name).toBe('my-service');
      expect(ir.components).toHaveLength(1);

      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;
      expect(appspec.name).toBe('my-service');
      expect(appspec.services).toHaveLength(1);

      const result = validate(appspec);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should complete full pipeline for service with database', () => {
      const input = `flowchart TD
        %% brick:name=webapp
        A[Node API] --> B[(PostgreSQL)]`;

      const ast = parse(input);
      expect(ast.nodes).toHaveLength(2);
      expect(ast.edges).toHaveLength(1);

      const ir = transform(ast);
      expect(ir.components).toHaveLength(2);
      const service = ir.components.find(c => c.type === 'service');
      expect(service?.connections).toContain('B');

      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;
      expect(appspec.services).toHaveLength(1);
      expect(appspec.databases).toHaveLength(1);
      expect(appspec.services![0].envs).toBeDefined();

      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });

    it('should complete full pipeline for microservices architecture', () => {
      const input = `flowchart TD
        %% brick:name=ecommerce
        A([React SPA]) --> B[User API]
        A --> C[Order API]
        A --> D[Product API]
        B & C & D --> E[(PostgreSQL)]
        C --> F[(Redis)]`;

      const ast = parse(input);
      expect(ast.nodes).toHaveLength(6);

      const ir = transform(ast);
      expect(ir.name).toBe('ecommerce');

      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;
      expect(appspec.static_sites).toHaveLength(1);
      expect(appspec.services).toHaveLength(3);
      expect(appspec.databases).toHaveLength(2);

      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });

    it('should complete full pipeline for worker-based architecture', () => {
      const input = `flowchart TD
        %% brick:name=processor
        A[API] --> B[(Redis)]
        B --> C((Email Worker))
        B --> D((PDF Worker))
        C & D --> E[(PostgreSQL)]`;

      const ast = parse(input);
      expect(ast.nodes.filter(n => n.shape === 'circle')).toHaveLength(2);

      const ir = transform(ast);
      expect(ir.components.filter(c => c.type === 'worker')).toHaveLength(2);

      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;
      expect(appspec.workers).toHaveLength(2);

      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });

    it('should complete full pipeline for scheduled jobs architecture', () => {
      const input = `flowchart TD
        %% brick:name=analytics
        A{{Daily Report}}
        %% brick:A:schedule=0 6 * * *
        B{{Hourly Sync}}
        %% brick:B:schedule=0 * * * *
        A & B --> C[(PostgreSQL)]`;

      const ast = parse(input);
      expect(ast.annotations.filter(a => a.key === 'schedule')).toHaveLength(2);

      const ir = transform(ast);
      const jobs = ir.components.filter(c => c.type === 'job');
      expect(jobs).toHaveLength(2);
      expect(jobs[0].config.schedule).toBe('0 6 * * *');
      expect(jobs[1].config.schedule).toBe('0 * * * *');

      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;
      expect(appspec.jobs).toHaveLength(2);

      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });

    it('should complete full pipeline with cost estimation', () => {
      const input = `flowchart TD
        %% brick:name=fullstack
        A([React App]) --> B[Express API]
        B --> C[(PostgreSQL)]`;

      const ast = parse(input);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      const result = validate(appspec);
      expect(result.valid).toBe(true);

      const estimate = estimateCost(appspec);
      expect(estimate.totalMonthlyCents).toBeGreaterThan(0);
      expect(estimate.breakdown).toHaveLength(3);
    });
  });

  describe('Test with example diagrams from examples/ folder', () => {
    it('should process web-app-db example', async () => {
      const diagramPath = join(__dirname, '../../examples/web-app-db/diagram.mmd');
      const content = await readFile(diagramPath, 'utf-8');

      const ast = parse(content);
      expect(ast.nodes.length).toBeGreaterThan(0);

      const ir = transform(ast);
      expect(ir.name).toBe('nextjs-app');

      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      const result = validate(appspec);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);

      expect(appspec.services).toHaveLength(1);
      expect(appspec.databases).toHaveLength(1);
      expect(appspec.services![0].envs).toBeDefined();
    });

    it('should process microservices example', async () => {
      const diagramPath = join(__dirname, '../../examples/microservices/diagram.mmd');
      const content = await readFile(diagramPath, 'utf-8');

      const ast = parse(content);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      const result = validate(appspec);
      expect(result.valid).toBe(true);

      expect(appspec.name).toBe('ecommerce');
      expect(appspec.static_sites).toHaveLength(1);
      expect(appspec.services).toHaveLength(3);
      expect(appspec.databases).toHaveLength(2);
    });

    it('should process static-api example', async () => {
      const diagramPath = join(__dirname, '../../examples/static-api/diagram.mmd');
      const content = await readFile(diagramPath, 'utf-8');

      const ast = parse(content);
      expect(ast.direction).toBe('LR');

      const ir = transform(ast);
      expect(ir.name).toBe('blog');

      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      const result = validate(appspec);
      expect(result.valid).toBe(true);

      expect(appspec.static_sites).toHaveLength(1);
      expect(appspec.services).toHaveLength(1);
      expect(appspec.databases).toHaveLength(1);
    });

    it('should process queue-workers example', async () => {
      const diagramPath = join(__dirname, '../../examples/queue-workers/diagram.mmd');
      const content = await readFile(diagramPath, 'utf-8');

      const ast = parse(content);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      const result = validate(appspec);
      expect(result.valid).toBe(true);

      expect(appspec.name).toBe('processor');
      expect(appspec.services).toHaveLength(1);
      expect(appspec.workers).toHaveLength(2);
      expect(appspec.databases).toHaveLength(2);
    });

    it('should process scheduled-jobs example', async () => {
      const diagramPath = join(__dirname, '../../examples/scheduled-jobs/diagram.mmd');
      const content = await readFile(diagramPath, 'utf-8');

      const ast = parse(content);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      const result = validate(appspec);
      expect(result.valid).toBe(true);

      expect(appspec.name).toBe('analytics');
      expect(appspec.jobs).toHaveLength(2);
      expect(appspec.databases).toHaveLength(1);
    });
  });

  describe('Pipeline with annotations', () => {
    it('should apply port annotation through pipeline', () => {
      const input = `flowchart TD
        %% brick:name=api
        A[Service]
        %% brick:A:port=9000`;

      const ast = parse(input);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      expect(appspec.services![0].http_port).toBe(9000);

      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });

    it('should apply instance configuration through pipeline', () => {
      const input = `flowchart TD
        %% brick:name=api
        A[Service]
        %% brick:A:instances=3
        %% brick:A:size=basic-s`;

      const ast = parse(input);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      expect(appspec.services![0].instance_count).toBe(3);
      expect(appspec.services![0].instance_size_slug).toBe('basic-s');

      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });

    it('should apply build and run commands through pipeline', () => {
      const input = `flowchart TD
        %% brick:name=api
        A[Service]
        %% brick:A:build=npm run build
        %% brick:A:run=npm start`;

      const ast = parse(input);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      expect(appspec.services![0].build_command).toBe('npm run build');
      expect(appspec.services![0].run_command).toBe('npm start');

      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });

    it('should apply region annotation through pipeline', () => {
      const input = `flowchart TD
        %% brick:name=api
        %% brick:region=sfo
        A[Service]`;

      const ast = parse(input);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      expect(appspec.region).toBe('sfo');

      const result = validate(appspec);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Pipeline with complex patterns', () => {
    it('should handle static site with API and multiple databases', () => {
      const input = `flowchart TD
        %% brick:name=fullstack
        A([Vue SPA]) --> B[Node API]
        B --> C[(PostgreSQL)]
        B --> D[(Redis)]
        B --> E((Background Worker))
        E --> C`;

      const ast = parse(input);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      const result = validate(appspec);
      expect(result.valid).toBe(true);

      expect(appspec.static_sites).toHaveLength(1);
      expect(appspec.services).toHaveLength(1);
      expect(appspec.workers).toHaveLength(1);
      expect(appspec.databases).toHaveLength(2);
    });

    it('should handle all component types in one diagram', () => {
      const input = `flowchart TD
        %% brick:name=complete-app
        A([Static Site]) --> B[API Service]
        B --> C[(PostgreSQL)]
        B --> D((Worker))
        D --> C
        E{{Scheduled Job}}
        E --> C`;

      const ast = parse(input);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      const result = validate(appspec);
      expect(result.valid).toBe(true);

      expect(appspec.static_sites).toHaveLength(1);
      expect(appspec.services).toHaveLength(1);
      expect(appspec.workers).toHaveLength(1);
      expect(appspec.jobs).toHaveLength(1);
      expect(appspec.databases).toHaveLength(1);
    });

    it('should correctly wire database connections for all connected components', () => {
      const input = `flowchart TD
        %% brick:name=multi-connect
        A[Service 1] --> C[(PostgreSQL)]
        B[Service 2] --> C
        D((Worker)) --> C`;

      const ast = parse(input);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      const result = validate(appspec);
      expect(result.valid).toBe(true);

      // All services and workers connected to DB should have env vars
      expect(appspec.services![0].envs).toBeDefined();
      expect(appspec.services![1].envs).toBeDefined();
      expect(appspec.workers![0].envs).toBeDefined();
    });
  });

  describe('Pipeline error handling', () => {
    it('should handle empty diagram gracefully', () => {
      const input = `flowchart TD`;

      const ast = parse(input);
      expect(ast.nodes).toHaveLength(0);

      const ir = transform(ast);
      expect(ir.components).toHaveLength(0);

      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      const result = validate(appspec);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('App must have at least one component');
    });

    it('should handle diagram with only comments', () => {
      const input = `flowchart TD
        %% This is just a comment
        %% Another comment`;

      const ast = parse(input);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      const result = validate(appspec);
      expect(result.valid).toBe(false);
    });

    it('should use default name when annotation is missing', () => {
      const input = `flowchart TD
        A[Service]`;

      const ast = parse(input);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      expect(appspec.name).toBe('my-app');

      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });
  });

  describe('Pipeline with cost estimation', () => {
    it('should estimate costs for web-app-db pattern', async () => {
      const diagramPath = join(__dirname, '../../examples/web-app-db/diagram.mmd');
      const content = await readFile(diagramPath, 'utf-8');

      const ast = parse(content);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      const estimate = estimateCost(appspec);

      expect(estimate.totalMonthlyCents).toBeGreaterThan(0);
      expect(estimate.breakdown.length).toBe(2); // service + database
      expect(estimate.formatted).toMatch(/\$\d+\.\d{2}\/month/);
    });

    it('should estimate costs for microservices pattern', async () => {
      const diagramPath = join(__dirname, '../../examples/microservices/diagram.mmd');
      const content = await readFile(diagramPath, 'utf-8');

      const ast = parse(content);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      const estimate = estimateCost(appspec);

      expect(estimate.totalMonthlyCents).toBeGreaterThan(0);
      // static_site (free) + 3 services + 2 databases = 6 items in breakdown
      expect(estimate.breakdown.length).toBe(6);

      // Verify static site is free
      const staticSiteBreakdown = estimate.breakdown.find(b => b.type === 'static_site');
      expect(staticSiteBreakdown?.monthlyCents).toBe(0);
    });

    it('should estimate costs for all example diagrams', async () => {
      const examples = [
        'web-app-db',
        'microservices',
        'static-api',
        'queue-workers',
        'scheduled-jobs',
      ];

      for (const example of examples) {
        const diagramPath = join(__dirname, `../../examples/${example}/diagram.mmd`);
        const content = await readFile(diagramPath, 'utf-8');

        const ast = parse(content);
        const ir = transform(ast);
        const yaml = generate(ir);
        const appspec = YAML.parse(yaml) as AppSpec;

        const result = validate(appspec);
        expect(result.valid).toBe(true);

        const estimate = estimateCost(appspec);
        expect(estimate.formatted).toMatch(/\$\d+\.\d{2}\/month/);
      }
    });
  });

  describe('Pipeline determinism', () => {
    it('should produce identical output for identical input', () => {
      const input = `flowchart TD
        %% brick:name=test-app
        A[Service] --> B[(Database)]`;

      const yaml1 = generate(transform(parse(input)));
      const yaml2 = generate(transform(parse(input)));

      expect(yaml1).toBe(yaml2);
    });

    it('should produce same validation result for same input', () => {
      const input = `flowchart TD
        %% brick:name=test-app
        A[Service] --> B[(Database)]`;

      const appspec1 = YAML.parse(generate(transform(parse(input))));
      const appspec2 = YAML.parse(generate(transform(parse(input))));

      const result1 = validate(appspec1);
      const result2 = validate(appspec2);

      expect(result1.valid).toBe(result2.valid);
      expect(result1.errors).toEqual(result2.errors);
      expect(result1.warnings).toEqual(result2.warnings);
    });

    it('should produce same cost estimate for same input', () => {
      const input = `flowchart TD
        %% brick:name=test-app
        A[Service] --> B[(Database)]`;

      const appspec1 = YAML.parse(generate(transform(parse(input))));
      const appspec2 = YAML.parse(generate(transform(parse(input))));

      const estimate1 = estimateCost(appspec1);
      const estimate2 = estimateCost(appspec2);

      expect(estimate1.totalMonthlyCents).toBe(estimate2.totalMonthlyCents);
      expect(estimate1.formatted).toBe(estimate2.formatted);
    });
  });
});
