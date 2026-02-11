import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/index.js';
import {
  transformToGraph,
  detectIntegrationType,
  getInfrastructurePorts,
} from '../../src/transformer/index.js';
import type { Graph, GraphNode, IntegrationType } from '../../src/types/graph.js';

describe('Graph Transformer', () => {
  describe('Integration Detection', () => {
    it('should detect Calendly from label', () => {
      expect(detectIntegrationType('Calendly')).toBe('calendly');
      expect(detectIntegrationType('My Calendly Integration')).toBe('calendly');
      expect(detectIntegrationType('CALENDLY')).toBe('calendly');
    });

    it('should detect Cal.com from label', () => {
      expect(detectIntegrationType('Cal.com')).toBe('cal_com');
      expect(detectIntegrationType('Cal.com Scheduling')).toBe('cal_com');
      expect(detectIntegrationType('Calcom')).toBe('cal_com');
    });

    it('should return null for non-integration labels', () => {
      expect(detectIntegrationType('My API')).toBeNull();
      expect(detectIntegrationType('PostgreSQL')).toBeNull();
      expect(detectIntegrationType('React App')).toBeNull();
    });

    it('should detect scheduling integrations', () => {
      // Currently only Calendly and Cal.com are registered
      expect(detectIntegrationType('Calendly Scheduling')).toBe('calendly');
      expect(detectIntegrationType('Cal.com Booking')).toBe('cal_com');
      // Unregistered integrations should return null until added to registry
      expect(detectIntegrationType('Stripe Payments')).toBeNull();
      expect(detectIntegrationType('SendGrid Email')).toBeNull();
    });
  });

  describe('Transform to Graph', () => {
    it('should transform simple diagram to graph', () => {
      const ast = parse(`flowchart TD
        %% brick:name=coaching-app
        A[API Service]`);
      const graph = transformToGraph(ast);

      expect(graph.name).toBe('coaching-app');
      expect(graph.region).toBe('nyc');
      expect(graph.nodes).toHaveLength(1);
      expect(graph.edges).toHaveLength(0);
    });

    it('should create graph metadata', () => {
      const ast = parse(`flowchart TD
        A[Service]`);
      const graph = transformToGraph(ast);

      expect(graph.metadata).toBeDefined();
      expect(graph.metadata?.version).toBe('2.0.0');
      expect(graph.metadata?.createdAt).toBeDefined();
    });

    it('should set vertical from options', () => {
      const ast = parse(`flowchart TD
        A[Service]`);
      const graph = transformToGraph(ast, { vertical: 'coaching' });

      expect(graph.vertical).toBe('coaching');
    });
  });

  describe('Integration Nodes', () => {
    it('should create Calendly node with predefined ports', () => {
      const ast = parse(`flowchart TD
        A[Calendly]`);
      const graph = transformToGraph(ast);

      const node = graph.nodes[0];
      expect(node.type).toBe('calendly');
      expect(node.category).toBe('integration');
      expect(node.ports.inputs.length).toBeGreaterThan(0);
      expect(node.ports.outputs.length).toBeGreaterThan(0);
    });

    it('should have booking_confirmed output port on Calendly', () => {
      const ast = parse(`flowchart TD
        A[Calendly Scheduling]`);
      const graph = transformToGraph(ast);

      const node = graph.nodes[0];
      const bookingConfirmed = node.ports.outputs.find(
        (p) => p.id === 'booking_confirmed'
      );
      expect(bookingConfirmed).toBeDefined();
      expect(bookingConfirmed?.contract).toBeDefined();
    });

    it('should have booking_cancelled output port on Calendly', () => {
      const ast = parse(`flowchart TD
        A[Calendly]`);
      const graph = transformToGraph(ast);

      const node = graph.nodes[0];
      const bookingCancelled = node.ports.outputs.find(
        (p) => p.id === 'booking_cancelled'
      );
      expect(bookingCancelled).toBeDefined();
    });

    it('should create Cal.com node with predefined ports', () => {
      const ast = parse(`flowchart TD
        A[Cal.com]`);
      const graph = transformToGraph(ast);

      const node = graph.nodes[0];
      expect(node.type).toBe('cal_com');
      expect(node.category).toBe('integration');
    });

    it('should have meeting_ended output port on Cal.com', () => {
      const ast = parse(`flowchart TD
        A[Cal.com Scheduling]`);
      const graph = transformToGraph(ast);

      const node = graph.nodes[0];
      const meetingEnded = node.ports.outputs.find(
        (p) => p.id === 'meeting_ended'
      );
      expect(meetingEnded).toBeDefined();
    });
  });

  describe('Infrastructure Nodes', () => {
    it('should create service node with default ports', () => {
      const ast = parse(`flowchart TD
        A[My API Service]`);
      const graph = transformToGraph(ast);

      const node = graph.nodes[0];
      expect(node.type).toBe('service');
      expect(node.category).toBe('infrastructure');
      expect(node.ports.inputs).toHaveLength(2);
      expect(node.ports.outputs).toHaveLength(2);
    });

    it('should have http_request input port on service', () => {
      const ast = parse(`flowchart TD
        A[Express API]`);
      const graph = transformToGraph(ast);

      const node = graph.nodes[0];
      const httpRequest = node.ports.inputs.find((p) => p.id === 'http_request');
      expect(httpRequest).toBeDefined();
    });

    it('should create database node with query ports', () => {
      const ast = parse(`flowchart TD
        A[(PostgreSQL)]`);
      const graph = transformToGraph(ast);

      const node = graph.nodes[0];
      expect(node.type).toBe('database');
      expect(node.category).toBe('infrastructure');

      const queryInput = node.ports.inputs.find((p) => p.id === 'query');
      expect(queryInput).toBeDefined();
    });

    it('should create static_site with form_submit output', () => {
      const ast = parse(`flowchart TD
        A([React App])`);
      const graph = transformToGraph(ast);

      const node = graph.nodes[0];
      expect(node.type).toBe('static_site');

      const formSubmit = node.ports.outputs.find((p) => p.id === 'form_submit');
      expect(formSubmit).toBeDefined();
    });

    it('should preserve inference for service ports', () => {
      const ast = parse(`flowchart TD
        A[Django API]`);
      const graph = transformToGraph(ast);

      expect(graph.nodes[0].config.port).toBe(8000);
    });

    it('should preserve inference for database engine', () => {
      const ast = parse(`flowchart TD
        A[(Redis Cache)]`);
      const graph = transformToGraph(ast);

      expect(graph.nodes[0].config.engine).toBe('REDIS');
    });
  });

  describe('Graph Edges', () => {
    it('should create edges between nodes', () => {
      const ast = parse(`flowchart TD
        A[Service] --> B[(Database)]`);
      const graph = transformToGraph(ast);

      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0].from.nodeId).toBe('A');
      expect(graph.edges[0].to.nodeId).toBe('B');
    });

    it('should assign port IDs to edges', () => {
      const ast = parse(`flowchart TD
        A[Service] --> B[(Database)]`);
      const graph = transformToGraph(ast);

      const edge = graph.edges[0];
      expect(edge.from.portId).toBeDefined();
      expect(edge.to.portId).toBeDefined();
    });

    it('should infer booking_confirmed port from edge label', () => {
      const ast = parse(`flowchart TD
        A[Calendly] -->|booking confirmed| B[CRM Service]`);
      const graph = transformToGraph(ast);

      const edge = graph.edges[0];
      expect(edge.from.portId).toBe('booking_confirmed');
      expect(edge.label).toBe('booking confirmed');
    });

    it('should infer booking_cancelled port from edge label', () => {
      const ast = parse(`flowchart TD
        A[Calendly] -->|cancelled| B[Notification Service]`);
      const graph = transformToGraph(ast);

      const edge = graph.edges[0];
      expect(edge.from.portId).toBe('booking_cancelled');
    });

    it('should handle multiple edges from one node', () => {
      const ast = parse(`flowchart TD
        A[Calendly] --> B[CRM]
        A --> C[Email Service]`);
      const graph = transformToGraph(ast);

      expect(graph.edges).toHaveLength(2);
      const aEdges = graph.edges.filter((e) => e.from.nodeId === 'A');
      expect(aEdges).toHaveLength(2);
    });

    it('should create unique edge IDs', () => {
      const ast = parse(`flowchart TD
        A[Service] --> B[(DB)]
        A --> C[(Cache)]
        B --> D[Worker]`);
      const graph = transformToGraph(ast);

      const edgeIds = graph.edges.map((e) => e.id);
      const uniqueIds = new Set(edgeIds);
      expect(uniqueIds.size).toBe(edgeIds.length);
    });
  });

  describe('Mixed Architecture (Integrations + Infrastructure)', () => {
    it('should transform coaching app architecture', () => {
      const ast = parse(`flowchart TD
        %% brick:name=coaching-platform
        A([Landing Page]) --> B[Calendly]
        B -->|booking confirmed| C[Node.js API]
        C --> D[(PostgreSQL)]`);
      const graph = transformToGraph(ast, { vertical: 'coaching' });

      expect(graph.name).toBe('coaching-platform');
      expect(graph.vertical).toBe('coaching');
      expect(graph.nodes).toHaveLength(4);

      // Check node types
      const nodeTypes = graph.nodes.map((n) => ({ id: n.id, type: n.type }));
      expect(nodeTypes.find((n) => n.id === 'A')?.type).toBe('static_site');
      expect(nodeTypes.find((n) => n.id === 'B')?.type).toBe('calendly');
      expect(nodeTypes.find((n) => n.id === 'C')?.type).toBe('service');
      expect(nodeTypes.find((n) => n.id === 'D')?.type).toBe('database');

      // Check categories
      const integrations = graph.nodes.filter((n) => n.category === 'integration');
      expect(integrations).toHaveLength(1); // Calendly
    });

    it('should handle fitness booking flow', () => {
      const ast = parse(`flowchart TD
        A([Fitness Website]) --> B[Cal.com]
        B -->|booking created| C[Express API]
        B -->|booking cancelled| D((Notification Worker))
        C --> E[(MongoDB)]`);
      const graph = transformToGraph(ast, { vertical: 'fitness' });

      expect(graph.vertical).toBe('fitness');
      expect(graph.nodes).toHaveLength(5);

      const calcom = graph.nodes.find((n) => n.type === 'cal_com');
      expect(calcom).toBeDefined();
      expect(calcom?.category).toBe('integration');

      // Check edges have proper port inference
      const bookingCreatedEdge = graph.edges.find((e) => e.label === 'booking created');
      expect(bookingCreatedEdge).toBeDefined();
    });
  });

  describe('Infrastructure Ports Helper', () => {
    it('should return ports for service type', () => {
      const ports = getInfrastructurePorts('service');
      expect(ports.inputs.length).toBeGreaterThan(0);
      expect(ports.outputs.length).toBeGreaterThan(0);
    });

    it('should return ports for database type', () => {
      const ports = getInfrastructurePorts('database');
      expect(ports.inputs.some((p) => p.id === 'query')).toBe(true);
      expect(ports.inputs.some((p) => p.id === 'write')).toBe(true);
    });

    it('should return ports for worker type', () => {
      const ports = getInfrastructurePorts('worker');
      expect(ports.inputs.some((p) => p.id === 'job_request')).toBe(true);
      expect(ports.outputs.some((p) => p.id === 'job_complete')).toBe(true);
    });

    it('should return ports for job type', () => {
      const ports = getInfrastructurePorts('job');
      expect(ports.inputs.some((p) => p.id === 'schedule_trigger')).toBe(true);
    });

    it('should return ports for static_site type', () => {
      const ports = getInfrastructurePorts('static_site');
      expect(ports.inputs).toHaveLength(0);
      expect(ports.outputs.some((p) => p.id === 'form_submit')).toBe(true);
    });
  });

  describe('Backward Compatibility', () => {
    it('should preserve node config from annotations', () => {
      const ast = parse(`flowchart TD
        A[Express API]
        %% brick:A:port=4000
        %% brick:A:instances=3`);
      const graph = transformToGraph(ast);

      expect(graph.nodes[0].config.port).toBe(4000);
      expect(graph.nodes[0].config.instanceCount).toBe(3);
    });

    it('should preserve database config', () => {
      const ast = parse(`flowchart TD
        A[(Database)]
        %% brick:A:engine=mysql
        %% brick:A:version=8`);
      const graph = transformToGraph(ast);

      expect(graph.nodes[0].config.engine).toBe('MYSQL');
      expect(graph.nodes[0].config.version).toBe('8');
    });

    it('should preserve build/run commands', () => {
      const ast = parse(`flowchart TD
        A[Service]
        %% brick:A:build=npm run build
        %% brick:A:run=npm start`);
      const graph = transformToGraph(ast);

      expect(graph.nodes[0].config.buildCommand).toBe('npm run build');
      expect(graph.nodes[0].config.runCommand).toBe('npm start');
    });
  });
});
