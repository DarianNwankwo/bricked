import { describe, it, expect } from 'vitest';
import { validate } from '../src/validator/index.js';
import type { AppSpec } from '../src/types/appspec.js';

describe('Validator', () => {
  describe('App name validation', () => {
    it('should require app name', () => {
      const appspec = {} as AppSpec;
      const result = validate(appspec);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('App name is required');
    });

    it('should reject invalid app names', () => {
      const appspec: AppSpec = {
        name: 'My App!',
        services: [{ name: 'svc', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(false);
    });

    it('should accept valid app names', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        services: [{ name: 'svc', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });
  });

  describe('Component validation', () => {
    it('should require at least one component', () => {
      const appspec: AppSpec = { name: 'my-app' };
      const result = validate(appspec);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('App must have at least one component');
    });

    it('should require source for services', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        services: [{ name: 'svc' } as any],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must have a source'))).toBe(true);
    });

    it('should detect duplicate component names', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        services: [
          { name: 'api', git: { repo: 'https://github.com/org/repo' } },
          { name: 'api', git: { repo: 'https://github.com/org/repo2' } },
        ],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Duplicate component name'))).toBe(true);
    });
  });

  describe('Database validation', () => {
    it('should validate database engine', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        databases: [{ name: 'db', engine: 'INVALID' as any }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('invalid engine'))).toBe(true);
    });

    it('should accept valid database engines', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        databases: [{ name: 'db', engine: 'PG' }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });
  });

  describe('Job validation', () => {
    it('should validate job kind', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        jobs: [{ name: 'job', kind: 'INVALID' as any, git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('invalid kind'))).toBe(true);
    });
  });

  describe('Port validation', () => {
    it('should validate http_port range', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        services: [{ name: 'svc', git: { repo: 'https://github.com/org/repo' }, http_port: 70000 }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('invalid http_port'))).toBe(true);
    });
  });

  describe('Region validation', () => {
    it('should warn about unknown regions', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        region: 'unknown-region',
        services: [{ name: 'svc', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.warnings.some(w => w.includes('may not be valid'))).toBe(true);
    });

    it('should accept valid regions', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        region: 'nyc',
        services: [{ name: 'svc', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.warnings.length).toBe(0);
    });
  });
});
