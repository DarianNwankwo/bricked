export { transformAST as transform, type TransformOptions } from './transformer.js';
export {
  inferComponentType,
  inferDatabaseEngine,
  inferDatabaseVersion,
  inferPort,
  slugify,
} from './inference.js';

// Port-based graph transformer
export {
  transformToGraph,
  detectIntegrationType,
  getInfrastructurePorts,
  type GraphTransformOptions,
} from './graph-transformer.js';
