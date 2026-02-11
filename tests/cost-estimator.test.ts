import { describe, it, expect } from 'vitest';
import { estimateCost } from '../src/deployer/cost-estimator.js';
import type { AppSpec } from '../src/types/appspec.js';

describe('Cost Estimator', () => {
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
      expect(estimate.formatted).toBe('$5.00/month');
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
  });

  describe('Static site costs', () => {
    it('should be free for static sites', () => {
      const appspec: AppSpec = {
        name: 'test',
        static_sites: [{
          name: 'frontend',
          git: { repo: 'https://github.com/org/repo' },
        }],
      };
      const estimate = estimateCost(appspec);
      expect(estimate.totalMonthlyCents).toBe(0);
      expect(estimate.breakdown[0].cost).toBe('Free');
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
  });

  describe('Combined costs', () => {
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
  });

  describe('Breakdown', () => {
    it('should provide breakdown by component', () => {
      const appspec: AppSpec = {
        name: 'test',
        services: [{ name: 'api', git: { repo: 'https://github.com/org/repo' } }],
        databases: [{ name: 'db', engine: 'PG' }],
      };
      const estimate = estimateCost(appspec);
      expect(estimate.breakdown).toHaveLength(2);
      expect(estimate.breakdown.map(b => b.name)).toContain('api');
      expect(estimate.breakdown.map(b => b.name)).toContain('db');
    });
  });
});
