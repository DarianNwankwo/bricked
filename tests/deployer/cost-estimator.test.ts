import { describe, it, expect } from 'vitest';
import { estimateCost, estimateCostFromComponents } from '../../src/deployer/cost-estimator.js';
import type { AppSpec } from '../../src/types/appspec.js';
import type { SimpleComponent } from '../../src/deployer/cost-estimator.js';

describe('Cost Estimator', () => {
  describe('Estimate costs for different component types', () => {
    describe('Service costs', () => {
      it('should calculate cost for basic-xxs instance', () => {
        const appspec: AppSpec = {
          name: 'test',
          services: [{
            name: 'api',
            git: { repo: 'https://github.com/org/repo' },
            instance_size_slug: 'basic-xxs',
            instance_count: 1,
          }],
        };
        const estimate = estimateCost(appspec);
        expect(estimate.totalMonthlyCents).toBe(500);
      });

      it('should calculate cost for basic-xs instance', () => {
        const appspec: AppSpec = {
          name: 'test',
          services: [{
            name: 'api',
            git: { repo: 'https://github.com/org/repo' },
            instance_size_slug: 'basic-xs',
            instance_count: 1,
          }],
        };
        const estimate = estimateCost(appspec);
        expect(estimate.totalMonthlyCents).toBe(1000);
      });

      it('should calculate cost for basic-s instance', () => {
        const appspec: AppSpec = {
          name: 'test',
          services: [{
            name: 'api',
            git: { repo: 'https://github.com/org/repo' },
            instance_size_slug: 'basic-s',
            instance_count: 1,
          }],
        };
        const estimate = estimateCost(appspec);
        expect(estimate.totalMonthlyCents).toBe(1200);
      });

      it('should calculate cost for professional-xs instance', () => {
        const appspec: AppSpec = {
          name: 'test',
          services: [{
            name: 'api',
            git: { repo: 'https://github.com/org/repo' },
            instance_size_slug: 'professional-xs',
            instance_count: 1,
          }],
        };
        const estimate = estimateCost(appspec);
        expect(estimate.totalMonthlyCents).toBe(1200);
      });

      it('should multiply cost by instance count', () => {
        const appspec: AppSpec = {
          name: 'test',
          services: [{
            name: 'api',
            git: { repo: 'https://github.com/org/repo' },
            instance_size_slug: 'basic-xxs',
            instance_count: 3,
          }],
        };
        const estimate = estimateCost(appspec);
        expect(estimate.totalMonthlyCents).toBe(1500);
      });

      it('should default to 1 instance when not specified', () => {
        const appspec: AppSpec = {
          name: 'test',
          services: [{
            name: 'api',
            git: { repo: 'https://github.com/org/repo' },
            instance_size_slug: 'basic-xxs',
          }],
        };
        const estimate = estimateCost(appspec);
        expect(estimate.totalMonthlyCents).toBe(500);
      });

      it('should use default instance size when not specified', () => {
        const appspec: AppSpec = {
          name: 'test',
          services: [{
            name: 'api',
            git: { repo: 'https://github.com/org/repo' },
          }],
        };
        const estimate = estimateCost(appspec);
        expect(estimate.totalMonthlyCents).toBe(500);
      });

      it('should sum costs for multiple services', () => {
        const appspec: AppSpec = {
          name: 'test',
          services: [
            { name: 'api-1', git: { repo: 'https://github.com/org/repo' }, instance_size_slug: 'basic-xxs' },
            { name: 'api-2', git: { repo: 'https://github.com/org/repo' }, instance_size_slug: 'basic-xxs' },
          ],
        };
        const estimate = estimateCost(appspec);
        expect(estimate.totalMonthlyCents).toBe(1000);
      });
    });

    describe('Worker costs', () => {
      it('should calculate worker cost', () => {
        const appspec: AppSpec = {
          name: 'test',
          workers: [{
            name: 'worker',
            git: { repo: 'https://github.com/org/repo' },
            instance_size_slug: 'basic-xxs',
            instance_count: 1,
          }],
        };
        const estimate = estimateCost(appspec);
        expect(estimate.totalMonthlyCents).toBe(500);
      });

      it('should multiply worker cost by instance count', () => {
        const appspec: AppSpec = {
          name: 'test',
          workers: [{
            name: 'worker',
            git: { repo: 'https://github.com/org/repo' },
            instance_size_slug: 'basic-xxs',
            instance_count: 2,
          }],
        };
        const estimate = estimateCost(appspec);
        expect(estimate.totalMonthlyCents).toBe(1000);
      });
    });

    describe('Job costs', () => {
      it('should estimate job cost as fraction of always-on', () => {
        const appspec: AppSpec = {
          name: 'test',
          jobs: [{
            name: 'job',
            kind: 'PRE_DEPLOY',
            git: { repo: 'https://github.com/org/repo' },
            instance_size_slug: 'basic-xxs',
          }],
        };
        const estimate = estimateCost(appspec);
        // Jobs are estimated at ~10% of always-on cost
        expect(estimate.totalMonthlyCents).toBe(50);
      });

      it('should include approximate indicator for job costs', () => {
        const appspec: AppSpec = {
          name: 'test',
          jobs: [{
            name: 'job',
            kind: 'PRE_DEPLOY',
            git: { repo: 'https://github.com/org/repo' },
          }],
        };
        const estimate = estimateCost(appspec);
        const jobBreakdown = estimate.breakdown.find(b => b.name === 'job');
        expect(jobBreakdown?.cost).toContain('~');
      });
    });

    describe('Database costs', () => {
      it('should calculate dev database cost', () => {
        const appspec: AppSpec = {
          name: 'test',
          databases: [{
            name: 'db',
            engine: 'PG',
            size: 'db-s-dev-database',
          }],
        };
        const estimate = estimateCost(appspec);
        expect(estimate.totalMonthlyCents).toBe(700);
      });

      it('should calculate cost for 1GB database', () => {
        const appspec: AppSpec = {
          name: 'test',
          databases: [{
            name: 'db',
            engine: 'PG',
            size: 'db-s-1vcpu-1gb',
          }],
        };
        const estimate = estimateCost(appspec);
        expect(estimate.totalMonthlyCents).toBe(1500);
      });

      it('should calculate cost for 2GB database', () => {
        const appspec: AppSpec = {
          name: 'test',
          databases: [{
            name: 'db',
            engine: 'PG',
            size: 'db-s-1vcpu-2gb',
          }],
        };
        const estimate = estimateCost(appspec);
        expect(estimate.totalMonthlyCents).toBe(3000);
      });

      it('should use default size when not specified', () => {
        const appspec: AppSpec = {
          name: 'test',
          databases: [{
            name: 'db',
            engine: 'PG',
          }],
        };
        const estimate = estimateCost(appspec);
        expect(estimate.totalMonthlyCents).toBe(700);
      });

      it('should sum costs for multiple databases', () => {
        const appspec: AppSpec = {
          name: 'test',
          databases: [
            { name: 'pg', engine: 'PG', size: 'db-s-dev-database' },
            { name: 'redis', engine: 'REDIS', size: 'db-s-dev-database' },
          ],
        };
        const estimate = estimateCost(appspec);
        expect(estimate.totalMonthlyCents).toBe(1400);
      });
    });
  });

  describe('Handle free tier (static sites)', () => {
    it('should return 0 cost for static sites', () => {
      const appspec: AppSpec = {
        name: 'test',
        static_sites: [{
          name: 'frontend',
          git: { repo: 'https://github.com/org/repo' },
        }],
      };
      const estimate = estimateCost(appspec);
      expect(estimate.totalMonthlyCents).toBe(0);
    });

    it('should show Free in breakdown for static sites', () => {
      const appspec: AppSpec = {
        name: 'test',
        static_sites: [{
          name: 'frontend',
          git: { repo: 'https://github.com/org/repo' },
        }],
      };
      const estimate = estimateCost(appspec);
      const siteBreakdown = estimate.breakdown.find(b => b.name === 'frontend');
      expect(siteBreakdown?.cost).toBe('Free');
    });

    it('should include specs for static sites', () => {
      const appspec: AppSpec = {
        name: 'test',
        static_sites: [{
          name: 'frontend',
          git: { repo: 'https://github.com/org/repo' },
        }],
      };
      const estimate = estimateCost(appspec);
      const siteBreakdown = estimate.breakdown.find(b => b.name === 'frontend');
      expect(siteBreakdown?.specs).toBeDefined();
    });

    it('should not add to total for multiple static sites', () => {
      const appspec: AppSpec = {
        name: 'test',
        static_sites: [
          { name: 'site-1', git: { repo: 'https://github.com/org/repo' } },
          { name: 'site-2', git: { repo: 'https://github.com/org/repo' } },
        ],
      };
      const estimate = estimateCost(appspec);
      expect(estimate.totalMonthlyCents).toBe(0);
    });
  });

  describe('Calculate total costs', () => {
    it('should sum all component costs', () => {
      const appspec: AppSpec = {
        name: 'test',
        services: [{
          name: 'api',
          git: { repo: 'https://github.com/org/repo' },
          instance_size_slug: 'basic-xxs',
          instance_count: 1,
        }],
        static_sites: [{
          name: 'frontend',
          git: { repo: 'https://github.com/org/repo' },
        }],
        databases: [{
          name: 'db',
          engine: 'PG',
          size: 'db-s-dev-database',
        }],
      };
      const estimate = estimateCost(appspec);
      expect(estimate.totalMonthlyCents).toBe(500 + 0 + 700);
    });

    it('should calculate complex microservices cost', () => {
      const appspec: AppSpec = {
        name: 'test',
        services: [
          { name: 'api-1', git: { repo: 'https://github.com/org/repo' }, instance_size_slug: 'basic-xxs' },
          { name: 'api-2', git: { repo: 'https://github.com/org/repo' }, instance_size_slug: 'basic-xxs' },
          { name: 'api-3', git: { repo: 'https://github.com/org/repo' }, instance_size_slug: 'basic-xxs' },
        ],
        static_sites: [
          { name: 'frontend', git: { repo: 'https://github.com/org/repo' } },
        ],
        databases: [
          { name: 'pg', engine: 'PG', size: 'db-s-dev-database' },
          { name: 'redis', engine: 'REDIS', size: 'db-s-dev-database' },
        ],
      };
      const estimate = estimateCost(appspec);
      // 3 services * $5 + 0 static + 2 DBs * $7 = $15 + $14 = $29
      expect(estimate.totalMonthlyCents).toBe(2900);
    });

    it('should handle app with only database', () => {
      const appspec: AppSpec = {
        name: 'test',
        databases: [{
          name: 'db',
          engine: 'PG',
        }],
      };
      const estimate = estimateCost(appspec);
      expect(estimate.totalMonthlyCents).toBe(700);
    });
  });

  describe('Cost formatting', () => {
    it('should format total as dollars per month', () => {
      const appspec: AppSpec = {
        name: 'test',
        services: [{
          name: 'api',
          git: { repo: 'https://github.com/org/repo' },
          instance_size_slug: 'basic-xxs',
        }],
      };
      const estimate = estimateCost(appspec);
      expect(estimate.formatted).toBe('$5.00/month');
    });

    it('should format zero cost correctly', () => {
      const appspec: AppSpec = {
        name: 'test',
        static_sites: [{
          name: 'frontend',
          git: { repo: 'https://github.com/org/repo' },
        }],
      };
      const estimate = estimateCost(appspec);
      expect(estimate.formatted).toBe('$0.00/month');
    });

    it('should format large costs correctly', () => {
      const appspec: AppSpec = {
        name: 'test',
        services: [{
          name: 'api',
          git: { repo: 'https://github.com/org/repo' },
          instance_size_slug: 'professional-xl',
          instance_count: 5,
        }],
      };
      const estimate = estimateCost(appspec);
      expect(estimate.formatted).toMatch(/\$\d+\.\d{2}\/month/);
    });
  });

  describe('Breakdown by component', () => {
    it('should provide breakdown array', () => {
      const appspec: AppSpec = {
        name: 'test',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
        databases: [{ name: 'db', engine: 'PG' }],
      };
      const estimate = estimateCost(appspec);
      expect(Array.isArray(estimate.breakdown)).toBe(true);
      expect(estimate.breakdown).toHaveLength(2);
    });

    it('should include name in breakdown', () => {
      const appspec: AppSpec = {
        name: 'test',
        services: [{ name: 'my-api', git: { repo: 'https://github.com/org/repo' } }],
      };
      const estimate = estimateCost(appspec);
      expect(estimate.breakdown[0].name).toBe('my-api');
    });

    it('should include type in breakdown', () => {
      const appspec: AppSpec = {
        name: 'test',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
      };
      const estimate = estimateCost(appspec);
      expect(estimate.breakdown[0].type).toBe('service');
    });

    it('should include cost string in breakdown', () => {
      const appspec: AppSpec = {
        name: 'test',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
      };
      const estimate = estimateCost(appspec);
      expect(typeof estimate.breakdown[0].cost).toBe('string');
    });

    it('should include monthlyCents in breakdown', () => {
      const appspec: AppSpec = {
        name: 'test',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
      };
      const estimate = estimateCost(appspec);
      expect(typeof estimate.breakdown[0].monthlyCents).toBe('number');
    });

    it('should include specs in breakdown', () => {
      const appspec: AppSpec = {
        name: 'test',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
      };
      const estimate = estimateCost(appspec);
      expect(estimate.breakdown[0].specs).toBeDefined();
    });

    it('should show instance count in specs when > 1', () => {
      const appspec: AppSpec = {
        name: 'test',
        services: [{
          name: 'api',
          git: { repo: 'https://github.com/org/repo' },
          instance_size_slug: 'basic-xxs',
          instance_count: 3,
        }],
      };
      const estimate = estimateCost(appspec);
      expect(estimate.breakdown[0].specs).toContain('3');
    });
  });

  describe('Estimate cost from simple components', () => {
    it('should estimate service cost', () => {
      const components: SimpleComponent[] = [
        { id: '1', name: 'api', type: 'service' },
      ];
      const estimate = estimateCostFromComponents(components);
      expect(estimate.totalMonthlyCents).toBe(500);
    });

    it('should estimate static_site as free', () => {
      const components: SimpleComponent[] = [
        { id: '1', name: 'frontend', type: 'static_site' },
      ];
      const estimate = estimateCostFromComponents(components);
      expect(estimate.totalMonthlyCents).toBe(0);
    });

    it('should estimate worker cost', () => {
      const components: SimpleComponent[] = [
        { id: '1', name: 'worker', type: 'worker' },
      ];
      const estimate = estimateCostFromComponents(components);
      expect(estimate.totalMonthlyCents).toBe(500);
    });

    it('should estimate job cost', () => {
      const components: SimpleComponent[] = [
        { id: '1', name: 'job', type: 'job' },
      ];
      const estimate = estimateCostFromComponents(components);
      expect(estimate.totalMonthlyCents).toBe(50);
    });

    it('should estimate database cost', () => {
      const components: SimpleComponent[] = [
        { id: '1', name: 'db', type: 'database' },
      ];
      const estimate = estimateCostFromComponents(components);
      expect(estimate.totalMonthlyCents).toBe(700);
    });

    it('should estimate cache cost', () => {
      const components: SimpleComponent[] = [
        { id: '1', name: 'cache', type: 'cache' },
      ];
      const estimate = estimateCostFromComponents(components);
      expect(estimate.totalMonthlyCents).toBe(1500);
    });

    it('should estimate queue cost', () => {
      const components: SimpleComponent[] = [
        { id: '1', name: 'queue', type: 'queue' },
      ];
      const estimate = estimateCostFromComponents(components);
      expect(estimate.totalMonthlyCents).toBe(2000);
    });

    it('should estimate storage cost', () => {
      const components: SimpleComponent[] = [
        { id: '1', name: 'storage', type: 'storage' },
      ];
      const estimate = estimateCostFromComponents(components);
      expect(estimate.totalMonthlyCents).toBe(500);
    });

    it('should sum multiple component costs', () => {
      const components: SimpleComponent[] = [
        { id: '1', name: 'api', type: 'service' },
        { id: '2', name: 'db', type: 'database' },
        { id: '3', name: 'frontend', type: 'static_site' },
      ];
      const estimate = estimateCostFromComponents(components);
      expect(estimate.totalMonthlyCents).toBe(500 + 700 + 0);
    });

    it('should provide breakdown for simple components', () => {
      const components: SimpleComponent[] = [
        { id: '1', name: 'api', type: 'service' },
        { id: '2', name: 'db', type: 'database' },
      ];
      const estimate = estimateCostFromComponents(components);
      expect(estimate.breakdown).toHaveLength(2);
      expect(estimate.breakdown.map(b => b.name)).toContain('api');
      expect(estimate.breakdown.map(b => b.name)).toContain('db');
    });

    it('should show Free* for zero-cost components', () => {
      const components: SimpleComponent[] = [
        { id: '1', name: 'frontend', type: 'static_site' },
      ];
      const estimate = estimateCostFromComponents(components);
      expect(estimate.breakdown[0].cost).toBe('Free*');
    });

    it('should use default cost for unknown component types', () => {
      const components: SimpleComponent[] = [
        { id: '1', name: 'unknown', type: 'custom-type' },
      ];
      const estimate = estimateCostFromComponents(components);
      expect(estimate.totalMonthlyCents).toBe(500); // default
    });
  });

  describe('Edge cases', () => {
    it('should handle empty services array', () => {
      const appspec: AppSpec = {
        name: 'test',
        services: [],
        databases: [{ name: 'db', engine: 'PG' }],
      };
      const estimate = estimateCost(appspec);
      expect(estimate.totalMonthlyCents).toBe(700);
    });

    it('should handle missing services property', () => {
      const appspec: AppSpec = {
        name: 'test',
        databases: [{ name: 'db', engine: 'PG' }],
      };
      const estimate = estimateCost(appspec);
      expect(estimate.totalMonthlyCents).toBe(700);
    });

    it('should handle unknown instance size slug', () => {
      const appspec: AppSpec = {
        name: 'test',
        services: [{
          name: 'api',
          git: { repo: 'https://github.com/org/repo' },
          instance_size_slug: 'unknown-size',
        }],
      };
      const estimate = estimateCost(appspec);
      expect(estimate.totalMonthlyCents).toBe(500); // default
    });

    it('should handle unknown database size', () => {
      const appspec: AppSpec = {
        name: 'test',
        databases: [{
          name: 'db',
          engine: 'PG',
          size: 'unknown-size',
        }],
      };
      const estimate = estimateCost(appspec);
      expect(estimate.totalMonthlyCents).toBe(700); // default
    });

    it('should handle empty components array', () => {
      const estimate = estimateCostFromComponents([]);
      expect(estimate.totalMonthlyCents).toBe(0);
      expect(estimate.breakdown).toHaveLength(0);
    });
  });
});
