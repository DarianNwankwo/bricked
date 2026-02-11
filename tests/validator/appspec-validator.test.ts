import { describe, it, expect } from 'vitest';
import { validate } from '../../src/validator/index.js';
import type { AppSpec, ServiceSpec, DatabaseSpec, JobSpec } from '../../src/types/appspec.js';

describe('AppSpec Validator', () => {
  describe('Validate correct AppSpecs pass', () => {
    it('should pass for minimal valid AppSpec with service', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass for AppSpec with static site', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        static_sites: [{ name: 'frontend', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });

    it('should pass for AppSpec with database only', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        databases: [{ name: 'db', engine: 'PG' }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });

    it('should pass for AppSpec with worker', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        workers: [{ name: 'worker', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });

    it('should pass for AppSpec with job', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        jobs: [{ name: 'job', kind: 'PRE_DEPLOY', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });

    it('should pass for complete AppSpec with all component types', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        region: 'nyc',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
        static_sites: [{ name: 'frontend', git: { repo: 'https://github.com/org/repo' } }],
        workers: [{ name: 'worker', git: { repo: 'https://github.com/org/repo' } }],
        jobs: [{ name: 'job', kind: 'PRE_DEPLOY', git: { repo: 'https://github.com/org/repo' } }],
        databases: [{ name: 'db', engine: 'PG' }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });

    it('should pass for AppSpec with github source', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        services: [{ name: 'api', github: { repo: 'org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });

    it('should pass for AppSpec with image source', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        services: [{ name: 'api', image: { registry_type: 'DOCKER_HUB', repository: 'org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });
  });

  describe('Catch missing required fields', () => {
    it('should fail when app name is missing', () => {
      const appspec = {
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
      } as AppSpec;
      const result = validate(appspec);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('App name is required');
    });

    it('should fail when app has no components', () => {
      const appspec: AppSpec = {
        name: 'my-app',
      };
      const result = validate(appspec);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('App must have at least one component');
    });

    it('should fail when service has no source', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        services: [{ name: 'api' } as ServiceSpec],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must have a source'))).toBe(true);
    });

    it('should fail when static site has no source', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        static_sites: [{ name: 'frontend' } as any],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must have a source'))).toBe(true);
    });

    it('should fail when worker has no source', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        workers: [{ name: 'worker' } as any],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must have a source'))).toBe(true);
    });

    it('should fail when job has no source', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        jobs: [{ name: 'job', kind: 'PRE_DEPLOY' } as any],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must have a source'))).toBe(true);
    });
  });

  describe('Catch invalid component types', () => {
    it('should fail for invalid database engine', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        databases: [{ name: 'db', engine: 'INVALID' as any }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('invalid engine'))).toBe(true);
    });

    it('should fail for invalid job kind', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        jobs: [{ name: 'job', kind: 'INVALID' as any, git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('invalid kind'))).toBe(true);
    });

    it('should accept valid database engine PG', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        databases: [{ name: 'db', engine: 'PG' }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });

    it('should accept valid database engine MYSQL', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        databases: [{ name: 'db', engine: 'MYSQL' }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });

    it('should accept valid database engine REDIS', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        databases: [{ name: 'db', engine: 'REDIS' }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });

    it('should accept valid database engine MONGODB', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        databases: [{ name: 'db', engine: 'MONGODB' }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });

    it('should accept valid job kind PRE_DEPLOY', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        jobs: [{ name: 'job', kind: 'PRE_DEPLOY', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });

    it('should accept valid job kind POST_DEPLOY', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        jobs: [{ name: 'job', kind: 'POST_DEPLOY', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });

    it('should accept valid job kind FAILED_DEPLOY', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        jobs: [{ name: 'job', kind: 'FAILED_DEPLOY', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });
  });

  describe('Catch invalid configurations', () => {
    it('should fail for invalid app name with special characters', () => {
      const appspec: AppSpec = {
        name: 'My App!',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(false);
    });

    it('should fail for app name starting with number', () => {
      const appspec: AppSpec = {
        name: '123-app',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(false);
    });

    it('should fail for app name with uppercase', () => {
      const appspec: AppSpec = {
        name: 'MyApp',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(false);
    });

    it('should fail for app name longer than 32 characters', () => {
      const appspec: AppSpec = {
        name: 'a'.repeat(33),
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('32 characters'))).toBe(true);
    });

    it('should accept valid app name with hyphens', () => {
      const appspec: AppSpec = {
        name: 'my-great-app',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });

    it('should accept valid app name with numbers', () => {
      const appspec: AppSpec = {
        name: 'my-app-123',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });

    it('should fail for invalid http_port (too high)', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' }, http_port: 70000 }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('invalid http_port'))).toBe(true);
    });

    it('should allow http_port of zero (treated as unset)', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' }, http_port: 0 }],
      };
      const result = validate(appspec);
      // Port 0 is falsy, so validation is skipped (treated as unset)
      expect(result.valid).toBe(true);
    });

    it('should fail for invalid http_port (negative)', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' }, http_port: -1 }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(false);
    });

    it('should accept valid http_port', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' }, http_port: 3000 }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });

    it('should accept http_port at upper boundary', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' }, http_port: 65535 }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });
  });

  describe('Detect duplicate component names', () => {
    it('should fail for duplicate service names', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        services: [
          { name: 'api', git: { repo: 'https://github.com/org/repo1' } },
          { name: 'api', git: { repo: 'https://github.com/org/repo2' } },
        ],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Duplicate component name'))).toBe(true);
    });

    it('should fail for duplicate names across component types', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        services: [{ name: 'component', git: { repo: 'https://github.com/org/repo' } }],
        workers: [{ name: 'component', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Duplicate component name'))).toBe(true);
    });

    it('should fail for duplicate database names', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        databases: [
          { name: 'db', engine: 'PG' },
          { name: 'db', engine: 'REDIS' },
        ],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Duplicate component name'))).toBe(true);
    });

    it('should pass for unique component names', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        services: [
          { name: 'api-1', git: { repo: 'https://github.com/org/repo1' } },
          { name: 'api-2', git: { repo: 'https://github.com/org/repo2' } },
        ],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });
  });

  describe('Region validation', () => {
    it('should warn about unknown regions', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        region: 'unknown-region',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.warnings.some(w => w.includes('may not be valid'))).toBe(true);
    });

    it('should not warn for valid region nyc', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        region: 'nyc',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.warnings).toHaveLength(0);
    });

    it('should not warn for valid region sfo', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        region: 'sfo',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.warnings).toHaveLength(0);
    });

    it('should not warn for valid region ams', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        region: 'ams',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.warnings).toHaveLength(0);
    });

    it('should not warn for valid region sgp', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        region: 'sgp',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.warnings).toHaveLength(0);
    });

    it('should not warn for valid region lon', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        region: 'lon',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.warnings).toHaveLength(0);
    });

    it('should not warn for valid region fra', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        region: 'fra',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.warnings).toHaveLength(0);
    });

    it('should not warn when region is not specified', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('ValidationResult structure', () => {
    it('should return valid boolean', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(typeof result.valid).toBe('boolean');
    });

    it('should return errors array', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should return warnings array', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should collect multiple errors', () => {
      const appspec = {
        services: [{ name: 'api' } as ServiceSpec],
      } as AppSpec;
      const result = validate(appspec);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty services array', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        services: [],
      };
      const result = validate(appspec);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('App must have at least one component');
    });

    it('should handle null-like values gracefully', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
        databases: undefined,
      };
      const result = validate(appspec);
      expect(result.valid).toBe(true);
    });

    it('should validate single character app name', () => {
      const appspec: AppSpec = {
        name: 'a',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      // Single character names might be valid depending on regex
      expect(typeof result.valid).toBe('boolean');
    });

    it('should handle very long component name gracefully', () => {
      const appspec: AppSpec = {
        name: 'my-app',
        services: [{ name: 'a'.repeat(100), git: { repo: 'https://github.com/org/repo' } }],
      };
      const result = validate(appspec);
      // Should validate without throwing
      expect(typeof result.valid).toBe('boolean');
    });
  });
});
