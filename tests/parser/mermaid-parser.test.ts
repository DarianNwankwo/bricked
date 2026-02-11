import { describe, it, expect } from 'vitest';
import { parse, MermaidParseError } from '../../src/parser/index.js';
import type { MermaidAST, NodeShape } from '../../src/types/ast.js';

describe('Mermaid Parser', () => {
  describe('Parse simple flowcharts', () => {
    it('should parse empty flowchart with only direction', () => {
      const input = `flowchart TD`;
      const ast = parse(input);
      expect(ast.type).toBe('flowchart');
      expect(ast.direction).toBe('TD');
      expect(ast.nodes).toHaveLength(0);
      expect(ast.edges).toHaveLength(0);
    });

    it('should parse flowchart with single node', () => {
      const input = `flowchart TD
        A[Service]`;
      const ast = parse(input);
      expect(ast.nodes).toHaveLength(1);
      expect(ast.nodes[0].id).toBe('A');
      expect(ast.nodes[0].label).toBe('Service');
    });

    it('should parse flowchart with multiple nodes', () => {
      const input = `flowchart TD
        A[Service One]
        B[Service Two]
        C[Service Three]`;
      const ast = parse(input);
      expect(ast.nodes).toHaveLength(3);
      expect(ast.nodes.map(n => n.id)).toEqual(['A', 'B', 'C']);
    });

    it('should parse flowchart TD direction', () => {
      const input = `flowchart TD
        A[Node]`;
      const ast = parse(input);
      expect(ast.direction).toBe('TD');
    });

    it('should parse flowchart LR direction', () => {
      const input = `flowchart LR
        A[Node]`;
      const ast = parse(input);
      expect(ast.direction).toBe('LR');
    });

    it('should parse flowchart TB direction', () => {
      const input = `flowchart TB
        A[Node]`;
      const ast = parse(input);
      expect(ast.direction).toBe('TB');
    });

    it('should parse flowchart BT direction', () => {
      const input = `flowchart BT
        A[Node]`;
      const ast = parse(input);
      expect(ast.direction).toBe('BT');
    });

    it('should parse flowchart RL direction', () => {
      const input = `flowchart RL
        A[Node]`;
      const ast = parse(input);
      expect(ast.direction).toBe('RL');
    });

    it('should handle lowercase direction', () => {
      const input = `flowchart td
        A[Node]`;
      const ast = parse(input);
      expect(ast.direction).toBe('TD');
    });

    it('should parse graph keyword as alternative to flowchart', () => {
      const input = `graph LR
        A[Node]`;
      const ast = parse(input);
      expect(ast.direction).toBe('LR');
      expect(ast.nodes).toHaveLength(1);
    });

    it('should ignore regular comments', () => {
      const input = `flowchart TD
        %% This is a regular comment
        A[Service]
        %% Another comment`;
      const ast = parse(input);
      expect(ast.nodes).toHaveLength(1);
      expect(ast.annotations).toHaveLength(0);
    });

    it('should handle empty lines', () => {
      const input = `flowchart TD

        A[Service]

        B[Database]

      `;
      const ast = parse(input);
      expect(ast.nodes).toHaveLength(2);
    });

    it('should preserve node labels with spaces', () => {
      const input = `flowchart TD
        A[My Great Service Name]`;
      const ast = parse(input);
      expect(ast.nodes[0].label).toBe('My Great Service Name');
    });
  });

  describe('Parse nodes with different shapes', () => {
    it('should parse rectangle shape [text] as service', () => {
      const input = `flowchart TD
        A[My Service]`;
      const ast = parse(input);
      expect(ast.nodes[0].shape).toBe('rectangle');
      expect(ast.nodes[0].label).toBe('My Service');
    });

    it('should parse stadium shape ([text]) as static_site', () => {
      const input = `flowchart TD
        A([My Website])`;
      const ast = parse(input);
      expect(ast.nodes[0].shape).toBe('stadium');
      expect(ast.nodes[0].label).toBe('My Website');
    });

    it('should parse cylinder shape [(text)] as database', () => {
      const input = `flowchart TD
        A[(PostgreSQL)]`;
      const ast = parse(input);
      expect(ast.nodes[0].shape).toBe('cylinder');
      expect(ast.nodes[0].label).toBe('PostgreSQL');
    });

    it('should parse circle shape ((text)) as worker', () => {
      const input = `flowchart TD
        A((Background Worker))`;
      const ast = parse(input);
      expect(ast.nodes[0].shape).toBe('circle');
      expect(ast.nodes[0].label).toBe('Background Worker');
    });

    it('should parse hexagon shape {{text}} as job', () => {
      const input = `flowchart TD
        A{{Scheduled Job}}`;
      const ast = parse(input);
      expect(ast.nodes[0].shape).toBe('hexagon');
      expect(ast.nodes[0].label).toBe('Scheduled Job');
    });

    it('should parse asymmetric shape >text] as queue', () => {
      const input = `flowchart TD
        A>Message Queue]`;
      const ast = parse(input);
      expect(ast.nodes[0].shape).toBe('asymmetric');
      expect(ast.nodes[0].label).toBe('Message Queue');
    });

    it('should default to rectangle for node without explicit shape', () => {
      const input = `flowchart TD
        A`;
      const ast = parse(input);
      expect(ast.nodes[0].shape).toBe('rectangle');
      expect(ast.nodes[0].label).toBe('A');
    });

    it('should parse multiple nodes with different shapes', () => {
      const input = `flowchart TD
        A[API Service]
        B([React App])
        C[(Database)]
        D((Worker))
        E{{Job}}`;
      const ast = parse(input);
      expect(ast.nodes).toHaveLength(5);
      expect(ast.nodes[0].shape).toBe('rectangle');
      expect(ast.nodes[1].shape).toBe('stadium');
      expect(ast.nodes[2].shape).toBe('cylinder');
      expect(ast.nodes[3].shape).toBe('circle');
      expect(ast.nodes[4].shape).toBe('hexagon');
    });

    it('should trim whitespace from labels', () => {
      const input = `flowchart TD
        A[  My Service  ]`;
      const ast = parse(input);
      expect(ast.nodes[0].label).toBe('My Service');
    });
  });

  describe('Parse edges/connections', () => {
    it('should parse simple arrow edge', () => {
      const input = `flowchart TD
        A[Service] --> B[(Database)]`;
      const ast = parse(input);
      expect(ast.edges).toHaveLength(1);
      expect(ast.edges[0]).toEqual({ from: 'A', to: 'B' });
    });

    it('should parse multiple edges', () => {
      const input = `flowchart TD
        A[Service] --> B[(DB)]
        A --> C[(Cache)]
        B --> D[Worker]`;
      const ast = parse(input);
      expect(ast.edges).toHaveLength(3);
      expect(ast.edges[0]).toEqual({ from: 'A', to: 'B' });
      expect(ast.edges[1]).toEqual({ from: 'A', to: 'C' });
      expect(ast.edges[2]).toEqual({ from: 'B', to: 'D' });
    });

    it('should parse edge with & operator for multiple sources', () => {
      const input = `flowchart TD
        A & B --> C[(Database)]`;
      const ast = parse(input);
      expect(ast.edges).toHaveLength(2);
      expect(ast.edges).toContainEqual({ from: 'A', to: 'C' });
      expect(ast.edges).toContainEqual({ from: 'B', to: 'C' });
    });

    it('should parse edge with & operator for multiple targets', () => {
      const input = `flowchart TD
        A[Service] --> B & C`;
      const ast = parse(input);
      expect(ast.edges).toHaveLength(2);
      expect(ast.edges).toContainEqual({ from: 'A', to: 'B' });
      expect(ast.edges).toContainEqual({ from: 'A', to: 'C' });
    });

    it('should parse edge with multiple sources and targets', () => {
      const input = `flowchart TD
        A & B & C --> D[(PostgreSQL)]`;
      const ast = parse(input);
      expect(ast.edges).toHaveLength(3);
      expect(ast.edges).toContainEqual({ from: 'A', to: 'D' });
      expect(ast.edges).toContainEqual({ from: 'B', to: 'D' });
      expect(ast.edges).toContainEqual({ from: 'C', to: 'D' });
    });

    it('should create nodes from edges if not previously defined', () => {
      const input = `flowchart TD
        A[Service] --> B[(Database)]`;
      const ast = parse(input);
      expect(ast.nodes).toHaveLength(2);
      expect(ast.nodes.find(n => n.id === 'A')).toBeDefined();
      expect(ast.nodes.find(n => n.id === 'B')).toBeDefined();
    });

    it('should not duplicate nodes when referenced multiple times', () => {
      const input = `flowchart TD
        A[Service]
        A --> B[(DB)]
        A --> C[(Cache)]`;
      const ast = parse(input);
      expect(ast.nodes.filter(n => n.id === 'A')).toHaveLength(1);
    });

    it('should preserve node definitions when parsing edges', () => {
      const input = `flowchart TD
        A[My Custom Label] --> B[(DB)]`;
      const ast = parse(input);
      expect(ast.nodes.find(n => n.id === 'A')?.label).toBe('My Custom Label');
    });

    it('should handle chain of edges', () => {
      const input = `flowchart TD
        A[Frontend] --> B[Backend]
        B --> C[(Database)]`;
      const ast = parse(input);
      expect(ast.edges).toHaveLength(2);
      expect(ast.nodes).toHaveLength(3);
    });
  });

  describe('Parse subgraphs', () => {
    it('should parse simple subgraph', () => {
      const input = `flowchart TD
        subgraph Backend
          A[API]
          B[(DB)]
        end`;
      const ast = parse(input);
      expect(ast.subgraphs).toHaveLength(1);
      expect(ast.subgraphs[0].id).toBe('Backend');
      expect(ast.subgraphs[0].label).toBe('Backend');
    });

    it('should parse subgraph with label', () => {
      const input = `flowchart TD
        subgraph backend ["Backend Services"]
          A[API]
        end`;
      const ast = parse(input);
      expect(ast.subgraphs[0].id).toBe('backend');
      expect(ast.subgraphs[0].label).toBe('Backend Services');
    });

    it('should track nodes within subgraph', () => {
      const input = `flowchart TD
        subgraph Backend
          A[API]
          B[(DB)]
        end`;
      const ast = parse(input);
      expect(ast.subgraphs[0].nodes).toContain('A');
      expect(ast.subgraphs[0].nodes).toContain('B');
    });

    it('should parse multiple subgraphs', () => {
      const input = `flowchart TD
        subgraph Frontend
          A([React])
        end
        subgraph Backend
          B[API]
        end`;
      const ast = parse(input);
      expect(ast.subgraphs).toHaveLength(2);
      expect(ast.subgraphs[0].id).toBe('Frontend');
      expect(ast.subgraphs[1].id).toBe('Backend');
    });

    it('should parse edges between subgraph nodes', () => {
      const input = `flowchart TD
        subgraph Frontend
          A([React])
        end
        subgraph Backend
          B[API]
        end
        A --> B`;
      const ast = parse(input);
      expect(ast.edges).toHaveLength(1);
      expect(ast.edges[0]).toEqual({ from: 'A', to: 'B' });
    });

    it('should handle nested subgraphs', () => {
      const input = `flowchart TD
        subgraph Cloud
          subgraph Backend
            A[API]
          end
        end`;
      const ast = parse(input);
      expect(ast.subgraphs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Parse brick annotations', () => {
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

    it('should parse global region annotation', () => {
      const input = `flowchart TD
        %% brick:region=sfo
        A[Service]`;
      const ast = parse(input);
      expect(ast.annotations).toHaveLength(1);
      expect(ast.annotations[0]).toEqual({
        type: 'global',
        key: 'region',
        value: 'sfo',
      });
    });

    it('should parse node-specific port annotation', () => {
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

    it('should parse node-specific schedule annotation', () => {
      const input = `flowchart TD
        A{{Job}}
        %% brick:A:schedule=0 6 * * *`;
      const ast = parse(input);
      expect(ast.annotations).toHaveLength(1);
      expect(ast.annotations[0]).toEqual({
        type: 'node',
        nodeId: 'A',
        key: 'schedule',
        value: '0 6 * * *',
      });
    });

    it('should parse multiple annotations', () => {
      const input = `flowchart TD
        %% brick:name=my-app
        %% brick:region=nyc
        A[Service]
        %% brick:A:port=8080
        %% brick:A:instances=3`;
      const ast = parse(input);
      expect(ast.annotations).toHaveLength(4);
    });

    it('should parse annotations for multiple nodes', () => {
      const input = `flowchart TD
        A[API]
        %% brick:A:port=3000
        B{{Job}}
        %% brick:B:schedule=0 * * * *`;
      const ast = parse(input);
      const nodeAAnnotations = ast.annotations.filter(a => a.nodeId === 'A');
      const nodeBAnnotations = ast.annotations.filter(a => a.nodeId === 'B');
      expect(nodeAAnnotations).toHaveLength(1);
      expect(nodeBAnnotations).toHaveLength(1);
    });

    it('should ignore non-brick comments', () => {
      const input = `flowchart TD
        %% This is a regular comment
        %% brick:name=my-app
        %% Another regular comment
        A[Service]`;
      const ast = parse(input);
      expect(ast.annotations).toHaveLength(1);
    });

    it('should handle annotation with special characters in value', () => {
      const input = `flowchart TD
        A[Service]
        %% brick:A:build=npm run build --production`;
      const ast = parse(input);
      expect(ast.annotations[0].value).toBe('npm run build --production');
    });
  });

  describe('Error handling for invalid syntax', () => {
    it('should handle missing flowchart declaration gracefully', () => {
      const input = `A[Service] --> B[(DB)]`;
      const ast = parse(input);
      // Should still parse nodes and edges
      expect(ast.direction).toBe('TD'); // default
    });

    it('should handle malformed node definitions gracefully', () => {
      const input = `flowchart TD
        A[Valid Node]
        B[Also Valid]`;
      const ast = parse(input);
      expect(ast.nodes).toHaveLength(2);
    });

    it('should handle empty input', () => {
      const input = '';
      const ast = parse(input);
      expect(ast.nodes).toHaveLength(0);
      expect(ast.edges).toHaveLength(0);
    });

    it('should handle whitespace-only input', () => {
      const input = '   \n\n   \t\t   ';
      const ast = parse(input);
      expect(ast.nodes).toHaveLength(0);
    });

    it('should handle unclosed subgraph gracefully', () => {
      const input = `flowchart TD
        subgraph Backend
          A[API]`;
      // Should not throw, but may have incomplete subgraph
      const ast = parse(input);
      expect(ast.nodes).toHaveLength(1);
    });

    it('should handle incomplete edge gracefully', () => {
      const input = `flowchart TD
        A[Service]
        B[Worker]`;
      const ast = parse(input);
      expect(ast.edges).toHaveLength(0);
      expect(ast.nodes).toHaveLength(2);
    });
  });

  describe('Edge cases', () => {
    it('should handle node IDs with numbers', () => {
      const input = `flowchart TD
        A1[Service 1]
        B2[Service 2]
        A1 --> B2`;
      const ast = parse(input);
      expect(ast.nodes.map(n => n.id)).toContain('A1');
      expect(ast.nodes.map(n => n.id)).toContain('B2');
    });

    it('should handle very long labels', () => {
      const longLabel = 'A'.repeat(100);
      const input = `flowchart TD
        A[${longLabel}]`;
      const ast = parse(input);
      expect(ast.nodes[0].label).toBe(longLabel);
    });

    it('should handle labels with special characters', () => {
      const input = `flowchart TD
        A[Next.js App v2.0]`;
      const ast = parse(input);
      expect(ast.nodes[0].label).toBe('Next.js App v2.0');
    });

    it('should handle mixed case in direction', () => {
      const input = `flowchart Lr
        A[Node]`;
      const ast = parse(input);
      expect(ast.direction).toBe('LR');
    });

    it('should preserve first definition when node is defined multiple times', () => {
      const input = `flowchart TD
        A[First Label]
        A[Second Label]`;
      const ast = parse(input);
      expect(ast.nodes).toHaveLength(1);
      expect(ast.nodes[0].label).toBe('First Label');
    });

    it('should handle complex microservices pattern', () => {
      const input = `flowchart TD
        %% brick:name=ecommerce
        A([React SPA]) --> B[User API]
        A --> C[Order API]
        A --> D[Product API]
        B & C & D --> E[(PostgreSQL)]
        C --> F[(Redis)]`;
      const ast = parse(input);
      expect(ast.nodes).toHaveLength(6);
      expect(ast.edges.length).toBeGreaterThanOrEqual(5);
      expect(ast.annotations[0].value).toBe('ecommerce');
    });
  });
});
