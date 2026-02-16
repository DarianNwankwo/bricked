// Shared constants for component types — used by Canvas, DetailPanel, EdgePopover

export const TYPE_COLORS: Record<string, string> = {
  service: '#6366f1',
  static_site: '#a855f7',
  database: '#22c55e',
  cache: '#ef4444',
  queue: '#8b5cf6',
  worker: '#f59e0b',
  cdn: '#3b82f6',
  api_gateway: '#06b6d4',
  load_balancer: '#ec4899',
  auth: '#f97316',
  storage: '#6366f1',
  search: '#a855f7',
  monitoring: '#84cc16',
  ml_model: '#0ea5e9',
};

export const TYPE_ICONS: Record<string, string> = {
  service: 'solar:server-linear',
  static_site: 'solar:monitor-smartphone-linear',
  database: 'solar:database-linear',
  cache: 'solar:bolt-linear',
  queue: 'solar:letter-linear',
  worker: 'solar:cpu-bolt-linear',
  cdn: 'solar:globe-linear',
  api_gateway: 'solar:routing-2-linear',
  load_balancer: 'solar:sort-linear',
  auth: 'solar:lock-linear',
  storage: 'solar:cloud-storage-linear',
  search: 'solar:magnifer-linear',
  monitoring: 'solar:chart-2-linear',
  ml_model: 'solar:brain-linear',
};

export const COMPONENT_TYPES = Object.keys(TYPE_COLORS);
