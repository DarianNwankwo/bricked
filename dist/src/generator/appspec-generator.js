import YAML from 'yaml';
import { DEFAULT_INSTANCE_SIZE, DEFAULT_INSTANCE_COUNT, DEFAULT_DATABASE_SIZE, inferEnvironmentSlug, normalizeRegion, } from './defaults.js';
export function generateAppSpec(ir) {
    const appSpec = {
        name: ir.name,
        region: normalizeRegion(ir.region),
    };
    const services = [];
    const staticSites = [];
    const workers = [];
    const jobs = [];
    const databases = [];
    const databaseNames = new Set();
    for (const component of ir.components) {
        if (component.type === 'database') {
            databaseNames.add(component.name);
        }
    }
    for (const component of ir.components) {
        switch (component.type) {
            case 'service':
                services.push(generateService(component, databaseNames, ir.components));
                break;
            case 'static_site':
                staticSites.push(generateStaticSite(component));
                break;
            case 'worker':
                workers.push(generateWorker(component, databaseNames, ir.components));
                break;
            case 'job':
                jobs.push(generateJob(component, databaseNames, ir.components));
                break;
            case 'database':
                databases.push(generateDatabase(component));
                break;
        }
    }
    if (services.length > 0)
        appSpec.services = services;
    if (staticSites.length > 0)
        appSpec.static_sites = staticSites;
    if (workers.length > 0)
        appSpec.workers = workers;
    if (jobs.length > 0)
        appSpec.jobs = jobs;
    if (databases.length > 0)
        appSpec.databases = databases;
    return YAML.stringify(appSpec, {
        indent: 2,
        lineWidth: 0,
    });
}
function generateService(component, databaseNames, allComponents) {
    const spec = {
        name: component.name,
        git: {
            repo: 'https://github.com/your-org/your-repo',
            branch: 'main',
        },
    };
    const envSlug = inferEnvironmentSlug(component.name);
    if (envSlug) {
        spec.environment_slug = envSlug;
    }
    if (component.config.port) {
        spec.http_port = component.config.port;
    }
    if (component.config.buildCommand) {
        spec.build_command = component.config.buildCommand;
    }
    if (component.config.runCommand) {
        spec.run_command = component.config.runCommand;
    }
    spec.instance_count = component.config.instanceCount || DEFAULT_INSTANCE_COUNT;
    spec.instance_size_slug = component.config.instanceSize || DEFAULT_INSTANCE_SIZE;
    const envVars = generateDatabaseEnvVars(component.connections, databaseNames, allComponents);
    if (component.config.envVars) {
        for (const [key, value] of Object.entries(component.config.envVars)) {
            envVars.push({ key, value });
        }
    }
    if (envVars.length > 0) {
        spec.envs = envVars;
    }
    return spec;
}
function generateStaticSite(component) {
    const spec = {
        name: component.name,
        git: {
            repo: 'https://github.com/your-org/your-repo',
            branch: 'main',
        },
    };
    const envSlug = inferEnvironmentSlug(component.name);
    if (envSlug) {
        spec.environment_slug = envSlug;
    }
    if (component.config.buildCommand) {
        spec.build_command = component.config.buildCommand;
    }
    if (component.config.outputDir) {
        spec.output_dir = component.config.outputDir;
    }
    if (component.config.envVars) {
        spec.envs = Object.entries(component.config.envVars).map(([key, value]) => ({
            key,
            value,
        }));
    }
    return spec;
}
function generateWorker(component, databaseNames, allComponents) {
    const spec = {
        name: component.name,
        git: {
            repo: 'https://github.com/your-org/your-repo',
            branch: 'main',
        },
    };
    const envSlug = inferEnvironmentSlug(component.name);
    if (envSlug) {
        spec.environment_slug = envSlug;
    }
    if (component.config.buildCommand) {
        spec.build_command = component.config.buildCommand;
    }
    if (component.config.runCommand) {
        spec.run_command = component.config.runCommand;
    }
    spec.instance_count = component.config.instanceCount || DEFAULT_INSTANCE_COUNT;
    spec.instance_size_slug = component.config.instanceSize || DEFAULT_INSTANCE_SIZE;
    const envVars = generateDatabaseEnvVars(component.connections, databaseNames, allComponents);
    if (component.config.envVars) {
        for (const [key, value] of Object.entries(component.config.envVars)) {
            envVars.push({ key, value });
        }
    }
    if (envVars.length > 0) {
        spec.envs = envVars;
    }
    return spec;
}
function generateJob(component, databaseNames, allComponents) {
    const spec = {
        name: component.name,
        kind: 'PRE_DEPLOY',
        git: {
            repo: 'https://github.com/your-org/your-repo',
            branch: 'main',
        },
    };
    const envSlug = inferEnvironmentSlug(component.name);
    if (envSlug) {
        spec.environment_slug = envSlug;
    }
    if (component.config.buildCommand) {
        spec.build_command = component.config.buildCommand;
    }
    if (component.config.runCommand) {
        spec.run_command = component.config.runCommand;
    }
    spec.instance_count = component.config.instanceCount || DEFAULT_INSTANCE_COUNT;
    spec.instance_size_slug = component.config.instanceSize || DEFAULT_INSTANCE_SIZE;
    const envVars = generateDatabaseEnvVars(component.connections, databaseNames, allComponents);
    if (component.config.envVars) {
        for (const [key, value] of Object.entries(component.config.envVars)) {
            envVars.push({ key, value });
        }
    }
    if (envVars.length > 0) {
        spec.envs = envVars;
    }
    return spec;
}
function generateDatabase(component) {
    const spec = {
        name: component.name,
        engine: component.config.engine || 'PG',
    };
    if (component.config.version) {
        spec.version = component.config.version;
    }
    spec.size = DEFAULT_DATABASE_SIZE;
    return spec;
}
function generateDatabaseEnvVars(connections, databaseNames, allComponents) {
    const envVars = [];
    for (const connId of connections) {
        const connectedComponent = allComponents.find((c) => c.id === connId);
        if (connectedComponent && databaseNames.has(connectedComponent.name)) {
            const dbName = connectedComponent.name;
            const engine = connectedComponent.config.engine || 'PG';
            const envVarName = `${dbName.toUpperCase().replace(/-/g, '_')}_URL`;
            envVars.push({
                key: envVarName,
                value: `\${${dbName}.${engine === 'REDIS' ? 'REDIS' : 'DATABASE'}_URL}`,
            });
        }
    }
    return envVars;
}
//# sourceMappingURL=appspec-generator.js.map