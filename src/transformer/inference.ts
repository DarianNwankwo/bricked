import type { NodeShape } from '../types/ast.js';
import type { ComponentType, DatabaseEngine } from '../types/ir.js';

export function inferComponentType(shape: NodeShape): ComponentType {
  switch (shape) {
    case 'rectangle':
      return 'service';
    case 'stadium':
      return 'static_site';
    case 'cylinder':
      return 'database';
    case 'circle':
      return 'worker';
    case 'hexagon':
      return 'job';
    case 'asymmetric':
      return 'worker';
    default:
      return 'service';
  }
}

const DATABASE_PATTERNS: { pattern: RegExp; engine: DatabaseEngine }[] = [
  { pattern: /postgres|pg|postgresql/i, engine: 'PG' },
  { pattern: /mysql|maria/i, engine: 'MYSQL' },
  { pattern: /redis|cache/i, engine: 'REDIS' },
  { pattern: /mongo|mongodb/i, engine: 'MONGODB' },
];

export function inferDatabaseEngine(label: string): DatabaseEngine {
  for (const { pattern, engine } of DATABASE_PATTERNS) {
    if (pattern.test(label)) {
      return engine;
    }
  }
  return 'PG';
}

export function inferDatabaseVersion(engine: DatabaseEngine): string {
  switch (engine) {
    case 'PG':
      return '16';
    case 'MYSQL':
      return '8';
    case 'REDIS':
      return '7';
    case 'MONGODB':
      return '7';
    default:
      return '16';
  }
}

const PORT_PATTERNS: { pattern: RegExp; port: number }[] = [
  { pattern: /next\.?js/i, port: 3000 },
  { pattern: /react|vue|angular|frontend/i, port: 3000 },
  { pattern: /express|fastify/i, port: 3000 },
  { pattern: /django|python/i, port: 8000 },
  { pattern: /flask/i, port: 5000 },
  { pattern: /rails|ruby/i, port: 3000 },
  { pattern: /\bgo\b|golang|gin|echo/i, port: 8080 },
  { pattern: /rust|actix|axum/i, port: 8080 },
  { pattern: /spring|java/i, port: 8080 },
  { pattern: /nginx/i, port: 80 },
  { pattern: /node/i, port: 3000 },
];

export function inferPort(label: string): number {
  for (const { pattern, port } of PORT_PATTERNS) {
    if (pattern.test(label)) {
      return port;
    }
  }
  return 8080;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}
