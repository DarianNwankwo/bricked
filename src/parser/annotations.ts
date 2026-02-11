import type { BrickAnnotation } from '../types/ast.js';

export interface ParsedAnnotations {
  global: {
    name?: string;
    region?: string;
  };
  nodes: Map<string, NodeAnnotations>;
}

export interface NodeAnnotations {
  port?: number;
  schedule?: string;
  instanceCount?: number;
  instanceSize?: string;
  buildCommand?: string;
  runCommand?: string;
  outputDir?: string;
  engine?: string;
  version?: string;
  envVars?: Record<string, string>;
}

export function processAnnotations(annotations: BrickAnnotation[]): ParsedAnnotations {
  const result: ParsedAnnotations = {
    global: {},
    nodes: new Map(),
  };

  for (const annotation of annotations) {
    if (annotation.type === 'global') {
      switch (annotation.key) {
        case 'name':
          result.global.name = annotation.value;
          break;
        case 'region':
          result.global.region = annotation.value;
          break;
      }
    } else if (annotation.type === 'node' && annotation.nodeId) {
      let nodeConfig = result.nodes.get(annotation.nodeId);
      if (!nodeConfig) {
        nodeConfig = {};
        result.nodes.set(annotation.nodeId, nodeConfig);
      }

      switch (annotation.key) {
        case 'port':
          nodeConfig.port = parseInt(annotation.value, 10);
          break;
        case 'schedule':
          nodeConfig.schedule = annotation.value;
          break;
        case 'instances':
        case 'instanceCount':
          nodeConfig.instanceCount = parseInt(annotation.value, 10);
          break;
        case 'size':
        case 'instanceSize':
          nodeConfig.instanceSize = annotation.value;
          break;
        case 'build':
        case 'buildCommand':
          nodeConfig.buildCommand = annotation.value;
          break;
        case 'run':
        case 'runCommand':
          nodeConfig.runCommand = annotation.value;
          break;
        case 'output':
        case 'outputDir':
          nodeConfig.outputDir = annotation.value;
          break;
        case 'engine':
          nodeConfig.engine = annotation.value;
          break;
        case 'version':
          nodeConfig.version = annotation.value;
          break;
        default:
          if (annotation.key.startsWith('env.')) {
            const envKey = annotation.key.slice(4);
            if (!nodeConfig.envVars) {
              nodeConfig.envVars = {};
            }
            nodeConfig.envVars[envKey] = annotation.value;
          }
      }
    }
  }

  return result;
}
