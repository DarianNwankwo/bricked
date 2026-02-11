import { processAnnotations } from '../parser/annotations.js';
import { inferComponentType, inferDatabaseEngine, inferDatabaseVersion, inferPort, slugify, } from './inference.js';
export function transformAST(ast, options = {}) {
    const annotations = processAnnotations(ast.annotations);
    const appName = options.name || annotations.global.name || 'my-app';
    const region = options.region || annotations.global.region || 'nyc';
    const edgeMap = new Map();
    for (const edge of ast.edges) {
        const existing = edgeMap.get(edge.from) || [];
        existing.push(edge.to);
        edgeMap.set(edge.from, existing);
    }
    const components = [];
    for (const node of ast.nodes) {
        const component = transformNode(node, edgeMap.get(node.id) || [], annotations.nodes.get(node.id));
        components.push(component);
    }
    return {
        name: slugify(appName),
        region,
        components,
    };
}
function transformNode(node, connections, nodeAnnotations) {
    const componentType = inferComponentType(node.shape);
    const config = buildConfig(node, componentType, nodeAnnotations);
    return {
        id: node.id,
        name: slugify(node.label),
        type: componentType,
        config,
        connections,
    };
}
function buildConfig(node, type, annotations) {
    const config = {};
    if (annotations) {
        if (annotations.port)
            config.port = annotations.port;
        if (annotations.schedule)
            config.schedule = annotations.schedule;
        if (annotations.instanceCount)
            config.instanceCount = annotations.instanceCount;
        if (annotations.instanceSize)
            config.instanceSize = annotations.instanceSize;
        if (annotations.buildCommand)
            config.buildCommand = annotations.buildCommand;
        if (annotations.runCommand)
            config.runCommand = annotations.runCommand;
        if (annotations.outputDir)
            config.outputDir = annotations.outputDir;
        if (annotations.envVars)
            config.envVars = annotations.envVars;
    }
    switch (type) {
        case 'service':
            if (!config.port) {
                config.port = inferPort(node.label);
            }
            break;
        case 'static_site':
            if (!config.outputDir) {
                config.outputDir = inferOutputDir(node.label);
            }
            break;
        case 'database':
            config.engine = annotations?.engine
                ? mapEngineString(annotations.engine)
                : inferDatabaseEngine(node.label);
            config.version = annotations?.version || inferDatabaseVersion(config.engine);
            break;
        case 'worker':
            break;
        case 'job':
            if (!config.schedule && annotations?.schedule) {
                config.schedule = annotations.schedule;
            }
            break;
    }
    return config;
}
function mapEngineString(engine) {
    const normalized = engine.toUpperCase();
    if (normalized === 'POSTGRES' || normalized === 'POSTGRESQL')
        return 'PG';
    if (normalized === 'MYSQL' || normalized === 'MARIA' || normalized === 'MARIADB')
        return 'MYSQL';
    if (normalized === 'REDIS')
        return 'REDIS';
    if (normalized === 'MONGO' || normalized === 'MONGODB')
        return 'MONGODB';
    return 'PG';
}
function inferOutputDir(label) {
    const lowerLabel = label.toLowerCase();
    if (/next\.?js/i.test(lowerLabel))
        return '.next';
    if (/react|vite|vue|angular/i.test(lowerLabel))
        return 'dist';
    if (/hugo/i.test(lowerLabel))
        return 'public';
    if (/gatsby/i.test(lowerLabel))
        return 'public';
    if (/astro/i.test(lowerLabel))
        return 'dist';
    return 'dist';
}
//# sourceMappingURL=transformer.js.map