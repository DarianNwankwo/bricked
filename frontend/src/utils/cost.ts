// Client-side cost estimation for architecture canvas
// Mirrors backend COMPONENT_PRICING from src/deployer/cost-estimator.ts

const COMPONENT_PRICING: Record<string, number> = {
  // Compute
  service: 500,
  static_site: 0,
  worker: 500,
  job: 50,
  function: 0,
  container: 500,
  // Data
  database: 700,
  cache: 1500,
  queue: 2000,
  storage: 500,
  search: 5000,
  // Infrastructure
  api_gateway: 350,
  load_balancer: 1200,
  cdn: 0,
  dns: 50,
  firewall: 0,
  // Platform
  auth: 0,
  monitoring: 0,
  logging: 1000,
  secrets: 40,
  registry: 500,
  // External
  email: 0,
  payment: 0,
  analytics: 0,
  ml_model: 3000,
  third_party: 0,
};

export interface CostBreakdownItem {
  name: string;
  type: string;
  monthlyCents: number;
}

export function estimateMonthlyCostCents(
  components: Array<{ type: string; name: string }>
): { totalCents: number; breakdown: CostBreakdownItem[] } {
  const breakdown: CostBreakdownItem[] = [];
  let totalCents = 0;

  for (const comp of components) {
    const cents = COMPONENT_PRICING[comp.type] ?? 500;
    breakdown.push({ name: comp.name, type: comp.type, monthlyCents: cents });
    totalCents += cents;
  }

  return { totalCents, breakdown };
}

export function formatCostDollars(cents: number): string {
  const dollars = cents / 100;
  if (dollars === 0) return '$0';
  if (dollars < 1) return `$${dollars.toFixed(2)}`;
  return `$${Math.round(dollars)}`;
}
