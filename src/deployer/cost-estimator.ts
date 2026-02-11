import type { AppSpec } from '../types/appspec.js';

export interface CostBreakdown {
  name: string;
  type: string;
  cost: string;
  monthlyCents: number;
  specs?: string; // e.g., "1 vCPU, 512MB RAM"
}

export interface CostEstimate {
  totalMonthlyCents: number;
  formatted: string;
  breakdown: CostBreakdown[];
}

// DigitalOcean App Platform pricing (as of 2024)
// Source: https://docs.digitalocean.com/products/app-platform/details/pricing/
const INSTANCE_COSTS: Record<string, { cents: number; specs: string }> = {
  // Shared CPU (App Platform)
  'apps-s-1vcpu-0.5gb': { cents: 500, specs: '1 shared vCPU, 512MB RAM' },
  'apps-s-1vcpu-1gb-fixed': { cents: 1000, specs: '1 shared vCPU, 1GB RAM' },
  'apps-s-1vcpu-1gb': { cents: 1200, specs: '1 shared vCPU, 1GB RAM' },
  'apps-s-1vcpu-2gb': { cents: 2500, specs: '1 shared vCPU, 2GB RAM' },
  'apps-s-2vcpu-4gb': { cents: 5000, specs: '2 shared vCPUs, 4GB RAM' },
  // Dedicated CPU
  'apps-d-1vcpu-0.5gb': { cents: 2900, specs: '1 dedicated vCPU, 512MB RAM' },
  'apps-d-1vcpu-1gb': { cents: 3400, specs: '1 dedicated vCPU, 1GB RAM' },
  'apps-d-1vcpu-2gb': { cents: 3900, specs: '1 dedicated vCPU, 2GB RAM' },
  'apps-d-2vcpu-4gb': { cents: 7800, specs: '2 dedicated vCPUs, 4GB RAM' },
  'apps-d-4vcpu-8gb': { cents: 15600, specs: '4 dedicated vCPUs, 8GB RAM' },
  'apps-d-4vcpu-16gb': { cents: 19600, specs: '4 dedicated vCPUs, 16GB RAM' },
  'apps-d-8vcpu-32gb': { cents: 39200, specs: '8 dedicated vCPUs, 32GB RAM' },
  // Legacy slugs (map to new ones)
  'basic-xxs': { cents: 500, specs: '1 shared vCPU, 512MB RAM' },
  'basic-xs': { cents: 1000, specs: '1 shared vCPU, 1GB RAM' },
  'basic-s': { cents: 1200, specs: '1 shared vCPU, 1GB RAM' },
  'basic-m': { cents: 2500, specs: '1 shared vCPU, 2GB RAM' },
  'basic-l': { cents: 5000, specs: '2 shared vCPUs, 4GB RAM' },
  'professional-xs': { cents: 1200, specs: '1 shared vCPU, 1GB RAM' },
  'professional-s': { cents: 2500, specs: '1 shared vCPU, 2GB RAM' },
  'professional-m': { cents: 5000, specs: '2 shared vCPUs, 4GB RAM' },
  'professional-l': { cents: 10000, specs: '4 shared vCPUs, 8GB RAM' },
  'professional-xl': { cents: 20000, specs: '8 shared vCPUs, 16GB RAM' },
};

// Database pricing (Dev databases in App Platform)
const DATABASE_COSTS: Record<string, { cents: number; specs: string }> = {
  'db-s-dev-database': { cents: 700, specs: 'Dev: 512MB RAM, 10GB storage' },
  'development': { cents: 700, specs: 'Dev: 512MB RAM, 10GB storage' },
  'db-s-1vcpu-1gb': { cents: 1500, specs: '1 vCPU, 1GB RAM, 10GB storage' },
  'db-s-1vcpu-2gb': { cents: 3000, specs: '1 vCPU, 2GB RAM, 25GB storage' },
  'db-s-2vcpu-4gb': { cents: 6000, specs: '2 vCPUs, 4GB RAM, 38GB storage' },
  'db-s-4vcpu-8gb': { cents: 12000, specs: '4 vCPUs, 8GB RAM, 115GB storage' },
  'db-s-6vcpu-16gb': { cents: 24000, specs: '6 vCPUs, 16GB RAM, 270GB storage' },
  'db-s-8vcpu-32gb': { cents: 48000, specs: '8 vCPUs, 32GB RAM, 580GB storage' },
};

const STATIC_SITE_COST = 0;
const DEFAULT_INSTANCE = { cents: 500, specs: '1 shared vCPU, 512MB RAM' };
const DEFAULT_DATABASE = { cents: 700, specs: 'Dev: 512MB RAM, 10GB storage' };

export function estimateCost(appspec: AppSpec): CostEstimate {
  const breakdown: CostBreakdown[] = [];
  let totalMonthlyCents = 0;

  if (appspec.services) {
    for (const service of appspec.services) {
      const instanceSize = service.instance_size_slug || 'apps-s-1vcpu-0.5gb';
      const instanceCount = service.instance_count || 1;
      const instance = INSTANCE_COSTS[instanceSize] || DEFAULT_INSTANCE;
      const monthlyCents = instance.cents * instanceCount;

      breakdown.push({
        name: service.name,
        type: 'service',
        cost: formatCents(monthlyCents),
        monthlyCents,
        specs: instance.specs + (instanceCount > 1 ? ` × ${instanceCount}` : ''),
      });
      totalMonthlyCents += monthlyCents;
    }
  }

  if (appspec.static_sites) {
    for (const site of appspec.static_sites) {
      breakdown.push({
        name: site.name,
        type: 'static_site',
        cost: 'Free',
        monthlyCents: STATIC_SITE_COST,
        specs: 'CDN hosted, unlimited bandwidth',
      });
    }
  }

  if (appspec.workers) {
    for (const worker of appspec.workers) {
      const instanceSize = worker.instance_size_slug || 'apps-s-1vcpu-0.5gb';
      const instanceCount = worker.instance_count || 1;
      const instance = INSTANCE_COSTS[instanceSize] || DEFAULT_INSTANCE;
      const monthlyCents = instance.cents * instanceCount;

      breakdown.push({
        name: worker.name,
        type: 'worker',
        cost: formatCents(monthlyCents),
        monthlyCents,
        specs: instance.specs + (instanceCount > 1 ? ` × ${instanceCount}` : ''),
      });
      totalMonthlyCents += monthlyCents;
    }
  }

  if (appspec.jobs) {
    for (const job of appspec.jobs) {
      const instanceSize = job.instance_size_slug || 'apps-s-1vcpu-0.5gb';
      const instance = INSTANCE_COSTS[instanceSize] || DEFAULT_INSTANCE;
      // Jobs are billed per execution, estimate ~10% of always-on cost
      const monthlyCents = Math.round(instance.cents * 0.1);

      breakdown.push({
        name: job.name,
        type: 'job',
        cost: `~${formatCents(monthlyCents)}`,
        monthlyCents,
        specs: 'Billed per execution',
      });
      totalMonthlyCents += monthlyCents;
    }
  }

  if (appspec.databases) {
    for (const db of appspec.databases) {
      const dbSize = db.size || 'db-s-dev-database';
      const database = DATABASE_COSTS[dbSize] || DEFAULT_DATABASE;

      breakdown.push({
        name: db.name,
        type: `database`,
        cost: formatCents(database.cents),
        monthlyCents: database.cents,
        specs: database.specs,
      });
      totalMonthlyCents += database.cents;
    }
  }

  return {
    totalMonthlyCents,
    formatted: formatCents(totalMonthlyCents) + '/month',
    breakdown,
  };
}

// Simple cost estimation from component types (for real-time preview)
// Component types matching the full set in ui.ts
export type ComponentType =
  | 'service' | 'static_site' | 'worker' | 'job' | 'function' | 'container'
  | 'database' | 'cache' | 'queue' | 'storage' | 'search'
  | 'api_gateway' | 'load_balancer' | 'cdn' | 'dns' | 'firewall'
  | 'auth' | 'monitoring' | 'logging' | 'secrets' | 'registry'
  | 'email' | 'payment' | 'analytics' | 'ml_model' | 'third_party';

export interface SimpleComponent {
  id: string;
  name: string;
  type: ComponentType | string;
}

// Realistic pricing based on typical cloud provider costs (monthly estimates)
// Sources: DigitalOcean, AWS, GCP, and common SaaS pricing
const COMPONENT_PRICING: Record<string, { cents: number; specs: string; note?: string }> = {
  // Compute
  service: { cents: 500, specs: '1 shared vCPU, 512MB RAM' },
  static_site: { cents: 0, specs: 'CDN hosted, unlimited bandwidth' },
  worker: { cents: 500, specs: '1 shared vCPU, 512MB RAM' },
  job: { cents: 50, specs: 'Billed per execution', note: '~10% of always-on' },
  function: { cents: 0, specs: 'Pay per invocation', note: 'Free tier: 1M requests/mo' },
  container: { cents: 500, specs: '1 shared vCPU, 512MB RAM' },

  // Data
  database: { cents: 700, specs: 'Dev: 512MB RAM, 10GB storage' },
  cache: { cents: 1500, specs: 'Redis: 1GB RAM', note: 'Managed Redis/Memcached' },
  queue: { cents: 2000, specs: 'Message broker', note: 'RabbitMQ/SQS/Kafka' },
  storage: { cents: 500, specs: '100GB object storage', note: 'S3/Spaces/R2' },
  search: { cents: 5000, specs: 'Elasticsearch: 2GB RAM', note: 'Search cluster' },

  // Infrastructure
  api_gateway: { cents: 350, specs: 'Per 1M requests', note: 'API management' },
  load_balancer: { cents: 1200, specs: 'Regional LB', note: 'Traffic distribution' },
  cdn: { cents: 0, specs: 'Pay per GB transferred', note: 'Free tier: 1TB/mo' },
  dns: { cents: 50, specs: 'Managed DNS', note: 'Per hosted zone' },
  firewall: { cents: 0, specs: 'Cloud firewall rules', note: 'Usually free with compute' },

  // Platform Services
  auth: { cents: 0, specs: 'Free tier: 7K MAU', note: 'Auth0/Cognito' },
  monitoring: { cents: 0, specs: 'Basic metrics', note: 'Free tier available' },
  logging: { cents: 1000, specs: '10GB logs/mo', note: 'Log aggregation' },
  secrets: { cents: 40, specs: 'Per 10K API calls', note: 'Secret management' },
  registry: { cents: 500, specs: '5GB storage', note: 'Container registry' },

  // External / Third-party
  email: { cents: 0, specs: 'Free tier: 100/day', note: 'SES/SendGrid' },
  payment: { cents: 0, specs: '2.9% + 30¢ per txn', note: 'Stripe/Payment processor' },
  analytics: { cents: 0, specs: 'Free tier available', note: 'Segment/Mixpanel' },
  ml_model: { cents: 3000, specs: 'GPU inference', note: 'Model serving endpoint' },
  third_party: { cents: 0, specs: 'Varies by service', note: 'External API' },
};

export function estimateCostFromComponents(components: SimpleComponent[]): CostEstimate {
  const breakdown: CostBreakdown[] = [];
  let totalMonthlyCents = 0;

  for (const comp of components) {
    const pricing = COMPONENT_PRICING[comp.type] || { cents: 500, specs: 'Estimated' };
    const cost: CostBreakdown = {
      name: comp.name,
      type: comp.type,
      cost: pricing.cents === 0 ? 'Free*' : formatCents(pricing.cents),
      monthlyCents: pricing.cents,
      specs: pricing.note ? `${pricing.specs} (${pricing.note})` : pricing.specs,
    };

    breakdown.push(cost);
    totalMonthlyCents += cost.monthlyCents;
  }

  return {
    totalMonthlyCents,
    formatted: formatCents(totalMonthlyCents) + '/month',
    breakdown,
  };
}

function formatCents(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toFixed(2)}`;
}
