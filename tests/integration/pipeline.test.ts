import { describe, it, expect } from 'vitest';
import YAML from 'yaml';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from '../../src/parser/index.js';
import { transform } from '../../src/transformer/index.js';
import { generate } from '../../src/generator/index.js';
import { validate } from '../../src/validator/index.js';
import { estimateCost } from '../../src/deployer/cost-estimator.js';
import type { AppSpec } from '../../src/types/appspec.js';
import type { MermaidAST } from '../../src/types/ast.js';
import type { IRApp } from '../../src/types/ir.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('End-to-End Pipeline: Mermaid to AppSpec', () => {
  describe('Full pipeline execution', () => {
    it('should execute complete pipeline: parse -> transform -> generate -> validate', () => {
      const mermaidInput = `flowchart TD
        %% brick:name=test-app
        A[API Service] --> B[(PostgreSQL)]`;

      // Step 1: Parse Mermaid to AST
      const ast = parse(mermaidInput);
      expect(ast.type).toBe('flowchart');
      expect(ast.nodes).toHaveLength(2);
      expect(ast.edges).toHaveLength(1);

      // Step 2: Transform AST to IR
      const ir = transform(ast);
      expect(ir.name).toBe('test-app');
      expect(ir.components).toHaveLength(2);

      // Step 3: Generate AppSpec YAML
      const yaml = generate(ir);
      expect(yaml).toContain('name: test-app');

      // Step 4: Validate AppSpec
      const appspec = YAML.parse(yaml) as AppSpec;
      const validation = validate(appspec);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should produce valid AppSpec that can be re-parsed', () => {
      const mermaidInput = `flowchart TD
        %% brick:name=my-app
        A[Service]`;

      const ast = parse(mermaidInput);
      const ir = transform(ast);
      const yaml = generate(ir);

      // Should be able to parse the YAML back
      expect(() => YAML.parse(yaml)).not.toThrow();
    });

    it('should preserve semantic information through pipeline', () => {
      const mermaidInput = `flowchart TD
        %% brick:name=semantic-test
        %% brick:region=sfo
        API[Node.js API] --> DB[(PostgreSQL)]
        %% brick:API:port=3000`;

      const ast = parse(mermaidInput);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      // Check semantic preservation
      expect(appspec.name).toBe('semantic-test');
      expect(appspec.region).toBe('sfo');
      expect(appspec.services?.[0].http_port).toBe(3000);
      expect(appspec.databases?.[0].engine).toBe('PG');
    });
  });

  describe('Example diagrams: web-app-db pattern', () => {
    it('should process web-app-db example end-to-end', async () => {
      const diagramPath = join(__dirname, '../../examples/web-app-db/diagram.mmd');
      const mermaidInput = await readFile(diagramPath, 'utf-8');

      const ast = parse(mermaidInput);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;
      const validation = validate(appspec);

      expect(validation.valid).toBe(true);
      expect(appspec.name).toBe('nextjs-app');
      expect(appspec.services).toHaveLength(1);
      expect(appspec.databases).toHaveLength(1);
    });

    it('should correctly wire database connection in web-app-db', async () => {
      const diagramPath = join(__dirname, '../../examples/web-app-db/diagram.mmd');
      const mermaidInput = await readFile(diagramPath, 'utf-8');

      const ast = parse(mermaidInput);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      // Service should have database env var
      const service = appspec.services?.[0];
      expect(service?.envs).toBeDefined();
      expect(service?.envs?.some(e => e.key.includes('URL'))).toBe(true);
    });

    it('should estimate reasonable cost for web-app-db', async () => {
      const diagramPath = join(__dirname, '../../examples/web-app-db/diagram.mmd');
      const mermaidInput = await readFile(diagramPath, 'utf-8');

      const ast = parse(mermaidInput);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;
      const cost = estimateCost(appspec);

      // Should have service + database cost
      expect(cost.totalMonthlyCents).toBeGreaterThan(0);
      expect(cost.breakdown).toHaveLength(2);
    });
  });

  describe('Example diagrams: microservices pattern', () => {
    it('should process microservices example end-to-end', async () => {
      const diagramPath = join(__dirname, '../../examples/microservices/diagram.mmd');
      const mermaidInput = await readFile(diagramPath, 'utf-8');

      const ast = parse(mermaidInput);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;
      const validation = validate(appspec);

      expect(validation.valid).toBe(true);
      expect(appspec.name).toBe('ecommerce');
    });

    it('should have correct component counts for microservices', async () => {
      const diagramPath = join(__dirname, '../../examples/microservices/diagram.mmd');
      const mermaidInput = await readFile(diagramPath, 'utf-8');

      const ast = parse(mermaidInput);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      expect(appspec.static_sites).toHaveLength(1);
      expect(appspec.services).toHaveLength(3);
      expect(appspec.databases).toHaveLength(2);
    });

    it('should wire multiple services to shared database', async () => {
      const diagramPath = join(__dirname, '../../examples/microservices/diagram.mmd');
      const mermaidInput = await readFile(diagramPath, 'utf-8');

      const ast = parse(mermaidInput);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      // All three services should connect to PostgreSQL
      const servicesWithDbEnv = appspec.services?.filter(
        s => s.envs?.some(e => e.key.includes('POSTGRESQL') || e.key.includes('URL'))
      );
      expect(servicesWithDbEnv?.length).toBeGreaterThan(0);
    });

    it('should estimate cost for microservices architecture', async () => {
      const diagramPath = join(__dirname, '../../examples/microservices/diagram.mmd');
      const mermaidInput = await readFile(diagramPath, 'utf-8');

      const ast = parse(mermaidInput);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;
      const cost = estimateCost(appspec);

      // Should have multiple components in breakdown
      expect(cost.breakdown.length).toBeGreaterThan(4);
      expect(cost.totalMonthlyCents).toBeGreaterThan(0);
    });
  });

  describe('Example diagrams: queue-workers pattern', () => {
    it('should process queue-workers example end-to-end', async () => {
      const diagramPath = join(__dirname, '../../examples/queue-workers/diagram.mmd');
      const mermaidInput = await readFile(diagramPath, 'utf-8');

      const ast = parse(mermaidInput);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;
      const validation = validate(appspec);

      expect(validation.valid).toBe(true);
      expect(appspec.name).toBe('processor');
    });

    it('should have correct worker count for queue-workers', async () => {
      const diagramPath = join(__dirname, '../../examples/queue-workers/diagram.mmd');
      const mermaidInput = await readFile(diagramPath, 'utf-8');

      const ast = parse(mermaidInput);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      expect(appspec.workers).toHaveLength(2);
      expect(appspec.databases).toHaveLength(2);
    });

    it('should infer Redis engine for queue database', async () => {
      const diagramPath = join(__dirname, '../../examples/queue-workers/diagram.mmd');
      const mermaidInput = await readFile(diagramPath, 'utf-8');

      const ast = parse(mermaidInput);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      const redisDb = appspec.databases?.find(d => d.engine === 'REDIS');
      expect(redisDb).toBeDefined();
    });
  });

  describe('Example diagrams: scheduled-jobs pattern', () => {
    it('should process scheduled-jobs example end-to-end', async () => {
      const diagramPath = join(__dirname, '../../examples/scheduled-jobs/diagram.mmd');
      const mermaidInput = await readFile(diagramPath, 'utf-8');

      const ast = parse(mermaidInput);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;
      const validation = validate(appspec);

      expect(validation.valid).toBe(true);
      expect(appspec.name).toBe('analytics');
    });

    it('should have correct job count for scheduled-jobs', async () => {
      const diagramPath = join(__dirname, '../../examples/scheduled-jobs/diagram.mmd');
      const mermaidInput = await readFile(diagramPath, 'utf-8');

      const ast = parse(mermaidInput);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      expect(appspec.jobs).toHaveLength(2);
    });

    it('should preserve schedule annotations', async () => {
      const diagramPath = join(__dirname, '../../examples/scheduled-jobs/diagram.mmd');
      const mermaidInput = await readFile(diagramPath, 'utf-8');

      const ast = parse(mermaidInput);

      // Check annotations are parsed
      const scheduleAnnotations = ast.annotations.filter(a => a.key === 'schedule');
      expect(scheduleAnnotations).toHaveLength(2);
    });
  });

  describe('Example diagrams: static-api pattern', () => {
    it('should process static-api example end-to-end', async () => {
      const diagramPath = join(__dirname, '../../examples/static-api/diagram.mmd');
      const mermaidInput = await readFile(diagramPath, 'utf-8');

      const ast = parse(mermaidInput);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;
      const validation = validate(appspec);

      expect(validation.valid).toBe(true);
      expect(appspec.name).toBe('blog');
    });

    it('should have correct component counts for static-api', async () => {
      const diagramPath = join(__dirname, '../../examples/static-api/diagram.mmd');
      const mermaidInput = await readFile(diagramPath, 'utf-8');

      const ast = parse(mermaidInput);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      expect(appspec.static_sites).toHaveLength(1);
      expect(appspec.services).toHaveLength(1);
      expect(appspec.databases).toHaveLength(1);
    });

    it('should infer Hugo output directory', async () => {
      const diagramPath = join(__dirname, '../../examples/static-api/diagram.mmd');
      const mermaidInput = await readFile(diagramPath, 'utf-8');

      const ast = parse(mermaidInput);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      const hugoSite = appspec.static_sites?.[0];
      expect(hugoSite?.output_dir).toBe('public');
    });

    it('should infer Go port for API', async () => {
      const diagramPath = join(__dirname, '../../examples/static-api/diagram.mmd');
      const mermaidInput = await readFile(diagramPath, 'utf-8');

      const ast = parse(mermaidInput);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      const goApi = appspec.services?.[0];
      expect(goApi?.http_port).toBe(8080);
    });
  });

  describe('Pipeline with custom options', () => {
    it('should allow name override through transform options', () => {
      const mermaidInput = `flowchart TD
        %% brick:name=original-name
        A[Service]`;

      const ast = parse(mermaidInput);
      const ir = transform(ast, { name: 'overridden-name' });
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      expect(appspec.name).toBe('overridden-name');
    });

    it('should allow region override through transform options', () => {
      const mermaidInput = `flowchart TD
        %% brick:region=sfo
        A[Service]`;

      const ast = parse(mermaidInput);
      const ir = transform(ast, { region: 'nyc' });
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      expect(appspec.region).toBe('nyc');
    });
  });

  describe('Pipeline error handling', () => {
    it('should handle empty input gracefully', () => {
      const mermaidInput = '';

      const ast = parse(mermaidInput);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;
      const validation = validate(appspec);

      // Should produce invalid AppSpec (no components)
      expect(validation.valid).toBe(false);
    });

    it('should handle whitespace-only input', () => {
      const mermaidInput = '   \n   \n   ';

      const ast = parse(mermaidInput);
      expect(ast.nodes).toHaveLength(0);
    });

    it('should handle diagram with only comments', () => {
      const mermaidInput = `%% This is a comment
        %% Another comment`;

      const ast = parse(mermaidInput);
      expect(ast.nodes).toHaveLength(0);
    });
  });

  describe('Pipeline data integrity', () => {
    it('should preserve node IDs through pipeline', () => {
      const mermaidInput = `flowchart TD
        MyAPI[API Service]
        MyDB[(Database)]
        MyAPI --> MyDB`;

      const ast = parse(mermaidInput);
      expect(ast.nodes.map(n => n.id)).toContain('MyAPI');
      expect(ast.nodes.map(n => n.id)).toContain('MyDB');

      const ir = transform(ast);
      expect(ir.components.map(c => c.id)).toContain('MyAPI');
      expect(ir.components.map(c => c.id)).toContain('MyDB');
    });

    it('should preserve connections through pipeline', () => {
      const mermaidInput = `flowchart TD
        A[Service] --> B[(DB)]
        A --> C[(Cache)]`;

      const ast = parse(mermaidInput);
      expect(ast.edges).toHaveLength(2);

      const ir = transform(ast);
      const serviceA = ir.components.find(c => c.id === 'A');
      expect(serviceA?.connections).toContain('B');
      expect(serviceA?.connections).toContain('C');
    });

    it('should preserve labels through pipeline', () => {
      const mermaidInput = `flowchart TD
        A[My Cool API Service]`;

      const ast = parse(mermaidInput);
      expect(ast.nodes[0].label).toBe('My Cool API Service');

      const ir = transform(ast);
      // Label gets slugified for name
      expect(ir.components[0].name).toBe('my-cool-api-service');
    });
  });

  describe('Complex scenarios', () => {
    it('should handle large diagram with many components', () => {
      const mermaidInput = `flowchart TD
        %% brick:name=large-app
        A([Frontend])
        B[API Gateway]
        C[User Service]
        D[Order Service]
        E[Product Service]
        F[Payment Service]
        G[(User DB)]
        H[(Order DB)]
        I[(Product DB)]
        J[(Redis Cache)]
        K((Email Worker))
        L((Report Worker))
        M{{Daily Backup}}

        A --> B
        B --> C
        B --> D
        B --> E
        B --> F
        C --> G
        D --> H
        E --> I
        C --> J
        D --> J
        K --> G
        L --> H
        M --> G
        M --> H
        M --> I`;

      const ast = parse(mermaidInput);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;
      const validation = validate(appspec);

      expect(validation.valid).toBe(true);
      expect(ast.nodes.length).toBeGreaterThan(10);
    });

    it('should handle multiple annotation types', () => {
      const mermaidInput = `flowchart TD
        %% brick:name=annotated-app
        %% brick:region=sfo
        A[Service]
        %% brick:A:port=3000
        %% brick:A:instances=3
        %% brick:A:size=basic-m
        %% brick:A:build=npm run build
        %% brick:A:run=npm start`;

      const ast = parse(mermaidInput);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;

      expect(appspec.name).toBe('annotated-app');
      expect(appspec.region).toBe('sfo');
      expect(appspec.services?.[0].http_port).toBe(3000);
      expect(appspec.services?.[0].instance_count).toBe(3);
      expect(appspec.services?.[0].instance_size_slug).toBe('basic-m');
      expect(appspec.services?.[0].build_command).toBe('npm run build');
      expect(appspec.services?.[0].run_command).toBe('npm start');
    });

    it('should handle all component types in one diagram', () => {
      const mermaidInput = `flowchart TD
        %% brick:name=full-stack
        A([Static Site])
        B[Service]
        C[(Database)]
        D((Worker))
        E{{Job}}
        F>Queue]

        A --> B
        B --> C
        B --> F
        F --> D
        D --> C
        E --> C`;

      const ast = parse(mermaidInput);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;
      const validation = validate(appspec);

      expect(validation.valid).toBe(true);
      expect(appspec.static_sites?.length).toBeGreaterThan(0);
      expect(appspec.services?.length).toBeGreaterThan(0);
      expect(appspec.databases?.length).toBeGreaterThan(0);
      expect(appspec.workers?.length).toBeGreaterThan(0);
      expect(appspec.jobs?.length).toBeGreaterThan(0);
    });
  });

  describe('Integration with cost estimation', () => {
    it('should provide cost estimate for any valid diagram', () => {
      const mermaidInput = `flowchart TD
        %% brick:name=cost-test
        A[Service] --> B[(DB)]`;

      const ast = parse(mermaidInput);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;
      const cost = estimateCost(appspec);

      expect(cost.totalMonthlyCents).toBeGreaterThan(0);
      expect(cost.formatted).toContain('$');
      expect(cost.breakdown).toHaveLength(2);
    });

    it('should estimate zero cost for static-only sites', () => {
      const mermaidInput = `flowchart TD
        %% brick:name=static-only
        A([Static Site])`;

      const ast = parse(mermaidInput);
      const ir = transform(ast);
      const yaml = generate(ir);
      const appspec = YAML.parse(yaml) as AppSpec;
      const cost = estimateCost(appspec);

      expect(cost.totalMonthlyCents).toBe(0);
    });
  });

  describe('Idempotency', () => {
    it('should produce same output for same input', () => {
      const mermaidInput = `flowchart TD
        %% brick:name=idempotent
        A[Service] --> B[(DB)]`;

      const run1 = {
        ast: parse(mermaidInput),
        ir: null as IRApp | null,
        yaml: '',
      };
      run1.ir = transform(run1.ast);
      run1.yaml = generate(run1.ir);

      const run2 = {
        ast: parse(mermaidInput),
        ir: null as IRApp | null,
        yaml: '',
      };
      run2.ir = transform(run2.ast);
      run2.yaml = generate(run2.ir);

      expect(run1.yaml).toBe(run2.yaml);
    });
  });
});
