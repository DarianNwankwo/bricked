import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/index.js';
import { transform, inferComponentType, inferDatabaseEngine, inferPort, slugify } from '../../src/transformer/index.js';
import type { MermaidAST, NodeShape } from '../../src/types/ast.js';
import type { IRApp, ComponentType, DatabaseEngine } from '../../src/types/ir.js';

describe('Transformer', () => {
  describe('Transform AST to IR', () => {
    it('should transform simple AST to IR', () => {
      const ast = parse(`flowchart TD
        %% brick:name=my-app
        A[Service]`);
      const ir = transform(ast);

      expect(ir.name).toBe('my-app');
      expect(ir.region).toBe('nyc'); // default region
      expect(ir.components).toHaveLength(1);
    });

    it('should transform multiple nodes to components', () => {
      const ast = parse(`flowchart TD
        A[API]
        B[(Database)]
        C((Worker))`);
      const ir = transform(ast);

      expect(ir.components).toHaveLength(3);
      expect(ir.components.map(c => c.id)).toEqual(['A', 'B', 'C']);
    });

    it('should preserve node IDs in component IDs', () => {
      const ast = parse(`flowchart TD
        MyAPI[API Service]
        MyDB[(PostgreSQL)]`);
      const ir = transform(ast);

      expect(ir.components.find(c => c.id === 'MyAPI')).toBeDefined();
      expect(ir.components.find(c => c.id === 'MyDB')).toBeDefined();
    });

    it('should apply default name when no annotation provided', () => {
      const ast = parse(`flowchart TD
        A[Service]`);
      const ir = transform(ast);

      expect(ir.name).toBe('my-app');
    });

    it('should apply default region when no annotation provided', () => {
      const ast = parse(`flowchart TD
        A[Service]`);
      const ir = transform(ast);

      expect(ir.region).toBe('nyc');
    });

    it('should use region from annotation', () => {
      const ast = parse(`flowchart TD
        %% brick:region=sfo
        A[Service]`);
      const ir = transform(ast);

      expect(ir.region).toBe('sfo');
    });
  });

  describe('Infer component types from shapes', () => {
    it('should infer service from rectangle shape', () => {
      const ast = parse(`flowchart TD
        A[My API]`);
      const ir = transform(ast);

      expect(ir.components[0].type).toBe('service');
    });

    it('should infer static_site from stadium shape', () => {
      const ast = parse(`flowchart TD
        A([React App])`);
      const ir = transform(ast);

      expect(ir.components[0].type).toBe('static_site');
    });

    it('should infer database from cylinder shape', () => {
      const ast = parse(`flowchart TD
        A[(PostgreSQL)]`);
      const ir = transform(ast);

      expect(ir.components[0].type).toBe('database');
    });

    it('should infer worker from circle shape', () => {
      const ast = parse(`flowchart TD
        A((Background Worker))`);
      const ir = transform(ast);

      expect(ir.components[0].type).toBe('worker');
    });

    it('should infer job from hexagon shape', () => {
      const ast = parse(`flowchart TD
        A{{Scheduled Task}}`);
      const ir = transform(ast);

      expect(ir.components[0].type).toBe('job');
    });

    it('should infer worker from asymmetric shape (queue)', () => {
      const ast = parse(`flowchart TD
        A>Queue Handler]`);
      const ir = transform(ast);

      expect(ir.components[0].type).toBe('worker');
    });

    it('should transform all shape types correctly', () => {
      const ast = parse(`flowchart TD
        A[Service]
        B([Static Site])
        C[(Database)]
        D((Worker))
        E{{Job}}
        F>Queue]`);
      const ir = transform(ast);

      expect(ir.components.find(c => c.id === 'A')?.type).toBe('service');
      expect(ir.components.find(c => c.id === 'B')?.type).toBe('static_site');
      expect(ir.components.find(c => c.id === 'C')?.type).toBe('database');
      expect(ir.components.find(c => c.id === 'D')?.type).toBe('worker');
      expect(ir.components.find(c => c.id === 'E')?.type).toBe('job');
      expect(ir.components.find(c => c.id === 'F')?.type).toBe('worker');
    });
  });

  describe('Infer component type function', () => {
    it('should return service for rectangle', () => {
      expect(inferComponentType('rectangle')).toBe('service');
    });

    it('should return static_site for stadium', () => {
      expect(inferComponentType('stadium')).toBe('static_site');
    });

    it('should return database for cylinder', () => {
      expect(inferComponentType('cylinder')).toBe('database');
    });

    it('should return worker for circle', () => {
      expect(inferComponentType('circle')).toBe('worker');
    });

    it('should return job for hexagon', () => {
      expect(inferComponentType('hexagon')).toBe('job');
    });

    it('should return worker for asymmetric', () => {
      expect(inferComponentType('asymmetric')).toBe('worker');
    });
  });

  describe('Handle connections between components', () => {
    it('should track simple connection', () => {
      const ast = parse(`flowchart TD
        A[Service] --> B[(Database)]`);
      const ir = transform(ast);

      const service = ir.components.find(c => c.id === 'A');
      expect(service?.connections).toContain('B');
    });

    it('should track multiple connections from one source', () => {
      const ast = parse(`flowchart TD
        A[Service] --> B[(DB)]
        A --> C[(Cache)]`);
      const ir = transform(ast);

      const service = ir.components.find(c => c.id === 'A');
      expect(service?.connections).toContain('B');
      expect(service?.connections).toContain('C');
    });

    it('should track connections from & operator', () => {
      const ast = parse(`flowchart TD
        A & B --> C[(Database)]`);
      const ir = transform(ast);

      const compA = ir.components.find(c => c.id === 'A');
      const compB = ir.components.find(c => c.id === 'B');
      expect(compA?.connections).toContain('C');
      expect(compB?.connections).toContain('C');
    });

    it('should have empty connections for terminal nodes', () => {
      const ast = parse(`flowchart TD
        A[Service] --> B[(Database)]`);
      const ir = transform(ast);

      const database = ir.components.find(c => c.id === 'B');
      expect(database?.connections).toEqual([]);
    });

    it('should handle chain connections', () => {
      const ast = parse(`flowchart TD
        A[Frontend] --> B[Backend]
        B --> C[(Database)]`);
      const ir = transform(ast);

      const frontend = ir.components.find(c => c.id === 'A');
      const backend = ir.components.find(c => c.id === 'B');

      expect(frontend?.connections).toContain('B');
      expect(backend?.connections).toContain('C');
    });
  });

  describe('Process annotations', () => {
    it('should apply port annotation to component config', () => {
      const ast = parse(`flowchart TD
        A[Service]
        %% brick:A:port=3000`);
      const ir = transform(ast);

      expect(ir.components[0].config.port).toBe(3000);
    });

    it('should apply schedule annotation to job config', () => {
      const ast = parse(`flowchart TD
        A{{Cron Job}}
        %% brick:A:schedule=0 6 * * *`);
      const ir = transform(ast);

      expect(ir.components[0].config.schedule).toBe('0 6 * * *');
    });

    it('should apply instanceCount annotation', () => {
      const ast = parse(`flowchart TD
        A[Service]
        %% brick:A:instances=3`);
      const ir = transform(ast);

      expect(ir.components[0].config.instanceCount).toBe(3);
    });

    it('should apply instanceSize annotation', () => {
      const ast = parse(`flowchart TD
        A[Service]
        %% brick:A:size=basic-s`);
      const ir = transform(ast);

      expect(ir.components[0].config.instanceSize).toBe('basic-s');
    });

    it('should apply buildCommand annotation', () => {
      const ast = parse(`flowchart TD
        A[Service]
        %% brick:A:build=npm run build`);
      const ir = transform(ast);

      expect(ir.components[0].config.buildCommand).toBe('npm run build');
    });

    it('should apply runCommand annotation', () => {
      const ast = parse(`flowchart TD
        A[Service]
        %% brick:A:run=npm start`);
      const ir = transform(ast);

      expect(ir.components[0].config.runCommand).toBe('npm start');
    });

    it('should apply outputDir annotation', () => {
      const ast = parse(`flowchart TD
        A([Static Site])
        %% brick:A:output=build`);
      const ir = transform(ast);

      expect(ir.components[0].config.outputDir).toBe('build');
    });

    it('should apply engine annotation to database', () => {
      const ast = parse(`flowchart TD
        A[(Database)]
        %% brick:A:engine=mysql`);
      const ir = transform(ast);

      expect(ir.components[0].config.engine).toBe('MYSQL');
    });

    it('should apply version annotation to database', () => {
      const ast = parse(`flowchart TD
        A[(PostgreSQL)]
        %% brick:A:version=15`);
      const ir = transform(ast);

      expect(ir.components[0].config.version).toBe('15');
    });

    it('should use annotation port over inferred port', () => {
      const ast = parse(`flowchart TD
        A[Next.js App]
        %% brick:A:port=8080`);
      const ir = transform(ast);

      expect(ir.components[0].config.port).toBe(8080);
    });

    it('should use annotation outputDir over inferred', () => {
      const ast = parse(`flowchart TD
        A([React App])
        %% brick:A:output=custom-build`);
      const ir = transform(ast);

      expect(ir.components[0].config.outputDir).toBe('custom-build');
    });
  });

  describe('Database engine inference', () => {
    it('should infer PostgreSQL from label containing postgres', () => {
      const ast = parse(`flowchart TD
        A[(PostgreSQL)]`);
      const ir = transform(ast);

      expect(ir.components[0].config.engine).toBe('PG');
    });

    it('should infer PostgreSQL from label containing pg', () => {
      const ast = parse(`flowchart TD
        A[(PG Database)]`);
      const ir = transform(ast);

      expect(ir.components[0].config.engine).toBe('PG');
    });

    it('should infer Redis from label', () => {
      const ast = parse(`flowchart TD
        A[(Redis)]`);
      const ir = transform(ast);

      expect(ir.components[0].config.engine).toBe('REDIS');
    });

    it('should infer Redis from cache keyword', () => {
      const ast = parse(`flowchart TD
        A[(Session Cache)]`);
      const ir = transform(ast);

      expect(ir.components[0].config.engine).toBe('REDIS');
    });

    it('should infer MySQL from label', () => {
      const ast = parse(`flowchart TD
        A[(MySQL)]`);
      const ir = transform(ast);

      expect(ir.components[0].config.engine).toBe('MYSQL');
    });

    it('should infer MySQL from maria keyword', () => {
      const ast = parse(`flowchart TD
        A[(MariaDB)]`);
      const ir = transform(ast);

      expect(ir.components[0].config.engine).toBe('MYSQL');
    });

    it('should infer MongoDB from label', () => {
      const ast = parse(`flowchart TD
        A[(MongoDB)]`);
      const ir = transform(ast);

      expect(ir.components[0].config.engine).toBe('MONGODB');
    });

    it('should default to PG for unknown database label', () => {
      const ast = parse(`flowchart TD
        A[(My Database)]`);
      const ir = transform(ast);

      expect(ir.components[0].config.engine).toBe('PG');
    });

    it('should be case insensitive for database inference', () => {
      const ast = parse(`flowchart TD
        A[(POSTGRESQL)]`);
      const ir = transform(ast);

      expect(ir.components[0].config.engine).toBe('PG');
    });
  });

  describe('Infer database engine function', () => {
    it('should infer PG for postgres label', () => {
      expect(inferDatabaseEngine('PostgreSQL')).toBe('PG');
    });

    it('should infer REDIS for redis label', () => {
      expect(inferDatabaseEngine('Redis Cache')).toBe('REDIS');
    });

    it('should infer MYSQL for mysql label', () => {
      expect(inferDatabaseEngine('MySQL DB')).toBe('MYSQL');
    });

    it('should infer MONGODB for mongo label', () => {
      expect(inferDatabaseEngine('MongoDB')).toBe('MONGODB');
    });

    it('should default to PG for unknown', () => {
      expect(inferDatabaseEngine('Unknown DB')).toBe('PG');
    });
  });

  describe('Port inference', () => {
    it('should infer port 3000 for Next.js', () => {
      const ast = parse(`flowchart TD
        A[Next.js App]`);
      const ir = transform(ast);

      expect(ir.components[0].config.port).toBe(3000);
    });

    it('should infer port 3000 for NextJS without dot', () => {
      const ast = parse(`flowchart TD
        A[NextJS App]`);
      const ir = transform(ast);

      expect(ir.components[0].config.port).toBe(3000);
    });

    it('should infer port 8000 for Django', () => {
      const ast = parse(`flowchart TD
        A[Django App]`);
      const ir = transform(ast);

      expect(ir.components[0].config.port).toBe(8000);
    });

    it('should infer port 5000 for Flask', () => {
      const ast = parse(`flowchart TD
        A[Flask API]`);
      const ir = transform(ast);

      expect(ir.components[0].config.port).toBe(5000);
    });

    it('should infer port 8080 for Go', () => {
      const ast = parse(`flowchart TD
        A[Go Service]`);
      const ir = transform(ast);

      expect(ir.components[0].config.port).toBe(8080);
    });

    it('should infer port 8080 for Golang', () => {
      const ast = parse(`flowchart TD
        A[Golang API]`);
      const ir = transform(ast);

      expect(ir.components[0].config.port).toBe(8080);
    });

    it('should infer port 8080 for Java/Spring', () => {
      const ast = parse(`flowchart TD
        A[Spring Boot]`);
      const ir = transform(ast);

      expect(ir.components[0].config.port).toBe(8080);
    });

    it('should infer port 3000 for Express', () => {
      const ast = parse(`flowchart TD
        A[Express API]`);
      const ir = transform(ast);

      expect(ir.components[0].config.port).toBe(3000);
    });

    it('should infer port 3000 for Rails', () => {
      const ast = parse(`flowchart TD
        A[Rails App]`);
      const ir = transform(ast);

      expect(ir.components[0].config.port).toBe(3000);
    });

    it('should infer port 8080 for Rust', () => {
      const ast = parse(`flowchart TD
        A[Rust API]`);
      const ir = transform(ast);

      expect(ir.components[0].config.port).toBe(8080);
    });

    it('should default to port 8080 for unknown services', () => {
      const ast = parse(`flowchart TD
        A[My Custom Service]`);
      const ir = transform(ast);

      expect(ir.components[0].config.port).toBe(8080);
    });
  });

  describe('Infer port function', () => {
    it('should return 3000 for nextjs', () => {
      expect(inferPort('Next.js')).toBe(3000);
    });

    it('should return 8080 for go', () => {
      expect(inferPort('Go API')).toBe(8080);
    });

    it('should return 8000 for python', () => {
      expect(inferPort('Python Service')).toBe(8000);
    });

    it('should return 8080 as default', () => {
      expect(inferPort('Unknown')).toBe(8080);
    });
  });

  describe('Name slugification', () => {
    it('should slugify component names with spaces', () => {
      const ast = parse(`flowchart TD
        A[My Great Service]`);
      const ir = transform(ast);

      expect(ir.components[0].name).toBe('my-great-service');
    });

    it('should slugify names with special characters', () => {
      const ast = parse(`flowchart TD
        A[Next.js App v2.0]`);
      const ir = transform(ast);

      expect(ir.components[0].name).toBe('next-js-app-v2-0');
    });

    it('should convert to lowercase', () => {
      const ast = parse(`flowchart TD
        A[MyAPIService]`);
      const ir = transform(ast);

      expect(ir.components[0].name).toBe('myapiservice');
    });

    it('should trim leading and trailing hyphens', () => {
      const ast = parse(`flowchart TD
        A[--Service--]`);
      const ir = transform(ast);

      expect(ir.components[0].name).toBe('service');
    });

    it('should limit name length to 32 characters', () => {
      const longLabel = 'A'.repeat(50);
      const ast = parse(`flowchart TD
        A[${longLabel}]`);
      const ir = transform(ast);

      expect(ir.components[0].name.length).toBeLessThanOrEqual(32);
    });

    it('should slugify app name from annotation', () => {
      const ast = parse(`flowchart TD
        %% brick:name=My App Name
        A[Service]`);
      const ir = transform(ast);

      expect(ir.name).toBe('my-app-name');
    });
  });

  describe('Slugify function', () => {
    it('should convert spaces to hyphens', () => {
      expect(slugify('My Service')).toBe('my-service');
    });

    it('should convert to lowercase', () => {
      expect(slugify('MyService')).toBe('myservice');
    });

    it('should remove special characters', () => {
      expect(slugify('app@v2.0!')).toBe('app-v2-0');
    });

    it('should trim hyphens from edges', () => {
      expect(slugify('--service--')).toBe('service');
    });

    it('should limit to 32 characters', () => {
      expect(slugify('a'.repeat(50))).toBe('a'.repeat(32));
    });

    it('should handle consecutive special characters', () => {
      expect(slugify('my...service')).toBe('my-service');
    });
  });

  describe('Transform options', () => {
    it('should use name from options over annotation', () => {
      const ast = parse(`flowchart TD
        %% brick:name=annotation-name
        A[Service]`);
      const ir = transform(ast, { name: 'options-name' });

      expect(ir.name).toBe('options-name');
    });

    it('should use region from options over annotation', () => {
      const ast = parse(`flowchart TD
        %% brick:region=sfo
        A[Service]`);
      const ir = transform(ast, { region: 'nyc' });

      expect(ir.region).toBe('nyc');
    });

    it('should fall back to annotation when option not provided', () => {
      const ast = parse(`flowchart TD
        %% brick:name=annotation-name
        A[Service]`);
      const ir = transform(ast, {});

      expect(ir.name).toBe('annotation-name');
    });
  });

  describe('Output directory inference', () => {
    it('should infer .next for Next.js static site', () => {
      const ast = parse(`flowchart TD
        A([Next.js Site])`);
      const ir = transform(ast);

      expect(ir.components[0].config.outputDir).toBe('.next');
    });

    it('should infer dist for React static site', () => {
      const ast = parse(`flowchart TD
        A([React App])`);
      const ir = transform(ast);

      expect(ir.components[0].config.outputDir).toBe('dist');
    });

    it('should infer dist for Vue static site', () => {
      const ast = parse(`flowchart TD
        A([Vue App])`);
      const ir = transform(ast);

      expect(ir.components[0].config.outputDir).toBe('dist');
    });

    it('should infer public for Hugo static site', () => {
      const ast = parse(`flowchart TD
        A([Hugo Site])`);
      const ir = transform(ast);

      expect(ir.components[0].config.outputDir).toBe('public');
    });

    it('should infer public for Gatsby static site', () => {
      const ast = parse(`flowchart TD
        A([Gatsby Site])`);
      const ir = transform(ast);

      expect(ir.components[0].config.outputDir).toBe('public');
    });

    it('should default to dist for unknown static sites', () => {
      const ast = parse(`flowchart TD
        A([My Website])`);
      const ir = transform(ast);

      expect(ir.components[0].config.outputDir).toBe('dist');
    });
  });

  describe('Database version inference', () => {
    it('should infer version 16 for PostgreSQL', () => {
      const ast = parse(`flowchart TD
        A[(PostgreSQL)]`);
      const ir = transform(ast);

      expect(ir.components[0].config.version).toBe('16');
    });

    it('should infer version 8 for MySQL', () => {
      const ast = parse(`flowchart TD
        A[(MySQL)]`);
      const ir = transform(ast);

      expect(ir.components[0].config.version).toBe('8');
    });

    it('should infer version 7 for Redis', () => {
      const ast = parse(`flowchart TD
        A[(Redis)]`);
      const ir = transform(ast);

      expect(ir.components[0].config.version).toBe('7');
    });

    it('should infer version 7 for MongoDB', () => {
      const ast = parse(`flowchart TD
        A[(MongoDB)]`);
      const ir = transform(ast);

      expect(ir.components[0].config.version).toBe('7');
    });
  });

  describe('Complex patterns', () => {
    it('should transform microservices pattern correctly', () => {
      const ast = parse(`flowchart TD
        %% brick:name=ecommerce
        A([React SPA]) --> B[User API]
        A --> C[Order API]
        A --> D[Product API]
        B & C & D --> E[(PostgreSQL)]
        C --> F[(Redis)]`);
      const ir = transform(ast);

      expect(ir.name).toBe('ecommerce');
      expect(ir.components).toHaveLength(6);

      const staticSites = ir.components.filter(c => c.type === 'static_site');
      const services = ir.components.filter(c => c.type === 'service');
      const databases = ir.components.filter(c => c.type === 'database');

      expect(staticSites).toHaveLength(1);
      expect(services).toHaveLength(3);
      expect(databases).toHaveLength(2);
    });

    it('should transform queue-workers pattern correctly', () => {
      const ast = parse(`flowchart TD
        %% brick:name=processor
        A[API] --> B[(Redis)]
        B --> C((Email Worker))
        B --> D((PDF Worker))
        C & D --> E[(PostgreSQL)]`);
      const ir = transform(ast);

      expect(ir.name).toBe('processor');
      expect(ir.components.filter(c => c.type === 'worker')).toHaveLength(2);
      expect(ir.components.filter(c => c.type === 'database')).toHaveLength(2);
    });

    it('should transform scheduled-jobs pattern correctly', () => {
      const ast = parse(`flowchart TD
        %% brick:name=analytics
        A{{Daily Report}}
        %% brick:A:schedule=0 6 * * *
        B{{Hourly Sync}}
        %% brick:B:schedule=0 * * * *
        A & B --> C[(PostgreSQL)]`);
      const ir = transform(ast);

      expect(ir.name).toBe('analytics');
      const jobs = ir.components.filter(c => c.type === 'job');
      expect(jobs).toHaveLength(2);
      expect(jobs[0].config.schedule).toBe('0 6 * * *');
      expect(jobs[1].config.schedule).toBe('0 * * * *');
    });
  });
});
