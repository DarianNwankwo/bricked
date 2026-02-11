import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser/index.js';

describe('Mermaid Parser', () => {
  describe('Basic parsing', () => {
    it('should parse flowchart direction', () => {
      const input = `flowchart TD
        A[Node]`;
      const ast = parse(input);
      expect(ast.direction).toBe('TD');
    });

    it('should parse LR direction', () => {
      const input = `flowchart LR
        A[Node]`;
      const ast = parse(input);
      expect(ast.direction).toBe('LR');
    });
  });

  describe('Node shapes', () => {
    it('should parse rectangle as service', () => {
      const input = `flowchart TD
        A[My Service]`;
      const ast = parse(input);
      expect(ast.nodes[0].shape).toBe('rectangle');
      expect(ast.nodes[0].label).toBe('My Service');
    });

    it('should parse stadium as static_site', () => {
      const input = `flowchart TD
        A([My Site])`;
      const ast = parse(input);
      expect(ast.nodes[0].shape).toBe('stadium');
      expect(ast.nodes[0].label).toBe('My Site');
    });

    it('should parse cylinder as database', () => {
      const input = `flowchart TD
        A[(PostgreSQL)]`;
      const ast = parse(input);
      expect(ast.nodes[0].shape).toBe('cylinder');
      expect(ast.nodes[0].label).toBe('PostgreSQL');
    });

    it('should parse circle as worker', () => {
      const input = `flowchart TD
        A((Worker))`;
      const ast = parse(input);
      expect(ast.nodes[0].shape).toBe('circle');
      expect(ast.nodes[0].label).toBe('Worker');
    });

    it('should parse hexagon as job', () => {
      const input = `flowchart TD
        A{{Cron Job}}`;
      const ast = parse(input);
      expect(ast.nodes[0].shape).toBe('hexagon');
      expect(ast.nodes[0].label).toBe('Cron Job');
    });
  });

  describe('Edges', () => {
    it('should parse simple edge', () => {
      const input = `flowchart TD
        A[Service] --> B[(DB)]`;
      const ast = parse(input);
      expect(ast.edges).toHaveLength(1);
      expect(ast.edges[0]).toEqual({ from: 'A', to: 'B' });
    });

    it('should parse multiple edges from one source', () => {
      const input = `flowchart TD
        A[Service] --> B[(DB)]
        A --> C[(Redis)]`;
      const ast = parse(input);
      expect(ast.edges).toHaveLength(2);
    });

    it('should parse multi-target edge with &', () => {
      const input = `flowchart TD
        A & B --> C[(DB)]`;
      const ast = parse(input);
      expect(ast.edges).toHaveLength(2);
      expect(ast.edges).toContainEqual({ from: 'A', to: 'C' });
      expect(ast.edges).toContainEqual({ from: 'B', to: 'C' });
    });
  });

  describe('Annotations', () => {
    it('should parse global name annotation', () => {
      const input = `flowchart TD
        %% brick:name=my-app
        A[Service]`;
      const ast = parse(input);
      expect(ast.annotations).toHaveLength(1);
      expect(ast.annotations[0]).toEqual({
        type: 'global',
        key: 'name',
        value: 'my-app',
      });
    });

    it('should parse node-specific annotation', () => {
      const input = `flowchart TD
        A[Service]
        %% brick:A:port=3000`;
      const ast = parse(input);
      expect(ast.annotations).toHaveLength(1);
      expect(ast.annotations[0]).toEqual({
        type: 'node',
        nodeId: 'A',
        key: 'port',
        value: '3000',
      });
    });
  });

  describe('Pattern examples', () => {
    it('should parse web-app-db pattern', () => {
      const input = `flowchart TD
        %% brick:name=nextjs-app
        A[Next.js App] --> B[(PostgreSQL)]`;
      const ast = parse(input);
      expect(ast.nodes).toHaveLength(2);
      expect(ast.edges).toHaveLength(1);
      expect(ast.annotations[0].value).toBe('nextjs-app');
    });

    it('should parse microservices pattern', () => {
      const input = `flowchart TD
        %% brick:name=ecommerce
        A([React SPA]) --> B[User API]
        A --> C[Order API]
        A --> D[Product API]
        B & C & D --> E[(PostgreSQL)]
        C --> F[(Redis)]`;
      const ast = parse(input);
      expect(ast.nodes).toHaveLength(6);
      expect(ast.nodes.filter(n => n.shape === 'stadium')).toHaveLength(1);
      expect(ast.nodes.filter(n => n.shape === 'rectangle')).toHaveLength(3);
      expect(ast.nodes.filter(n => n.shape === 'cylinder')).toHaveLength(2);
    });

    it('should parse queue-workers pattern', () => {
      const input = `flowchart TD
        %% brick:name=processor
        A[API] --> B[(Redis)]
        B --> C((Email Worker))
        B --> D((PDF Worker))
        C & D --> E[(PostgreSQL)]`;
      const ast = parse(input);
      expect(ast.nodes.filter(n => n.shape === 'circle')).toHaveLength(2);
    });

    it('should parse scheduled-jobs pattern', () => {
      const input = `flowchart TD
        %% brick:name=analytics
        A{{Daily Report}}
        %% brick:A:schedule=0 6 * * *
        B{{Hourly Sync}}
        %% brick:B:schedule=0 * * * *
        A & B --> C[(PostgreSQL)]`;
      const ast = parse(input);
      expect(ast.nodes.filter(n => n.shape === 'hexagon')).toHaveLength(2);
      expect(ast.annotations.filter(a => a.key === 'schedule')).toHaveLength(2);
    });
  });
});
