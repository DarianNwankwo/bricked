import { VALID_REGIONS } from '../generator/defaults.js';
const VALID_ENGINES = ['PG', 'MYSQL', 'REDIS', 'MONGODB'];
const VALID_JOB_KINDS = ['PRE_DEPLOY', 'POST_DEPLOY', 'FAILED_DEPLOY'];
export function validateAppSpec(appspec) {
    const errors = [];
    const warnings = [];
    if (!appspec.name) {
        errors.push('App name is required');
    }
    else if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(appspec.name) && appspec.name.length > 1) {
        errors.push('App name must start with a letter, contain only lowercase letters, numbers, and hyphens, and end with a letter or number');
    }
    else if (appspec.name.length > 32) {
        errors.push('App name must be 32 characters or less');
    }
    if (appspec.region && !VALID_REGIONS.includes(appspec.region.toLowerCase())) {
        warnings.push(`Region '${appspec.region}' may not be valid. Valid regions include: nyc, sfo, ams, sgp, lon, fra`);
    }
    const componentNames = new Set();
    const checkUniqueName = (name, type) => {
        if (componentNames.has(name)) {
            errors.push(`Duplicate component name '${name}' in ${type}`);
        }
        componentNames.add(name);
    };
    if (appspec.services) {
        for (const service of appspec.services) {
            checkUniqueName(service.name, 'services');
            validateServiceOrWorker(service, 'service', errors, warnings);
        }
    }
    if (appspec.static_sites) {
        for (const site of appspec.static_sites) {
            checkUniqueName(site.name, 'static_sites');
            if (!site.git && !site.github && !site.image) {
                errors.push(`Static site '${site.name}' must have a source (git, github, or image)`);
            }
        }
    }
    if (appspec.workers) {
        for (const worker of appspec.workers) {
            checkUniqueName(worker.name, 'workers');
            validateServiceOrWorker(worker, 'worker', errors, warnings);
        }
    }
    if (appspec.jobs) {
        for (const job of appspec.jobs) {
            checkUniqueName(job.name, 'jobs');
            if (!VALID_JOB_KINDS.includes(job.kind)) {
                errors.push(`Job '${job.name}' has invalid kind '${job.kind}'. Must be one of: ${VALID_JOB_KINDS.join(', ')}`);
            }
            if (!job.git && !job.github && !job.image) {
                errors.push(`Job '${job.name}' must have a source (git, github, or image)`);
            }
        }
    }
    if (appspec.databases) {
        for (const db of appspec.databases) {
            checkUniqueName(db.name, 'databases');
            if (!VALID_ENGINES.includes(db.engine)) {
                errors.push(`Database '${db.name}' has invalid engine '${db.engine}'. Must be one of: ${VALID_ENGINES.join(', ')}`);
            }
        }
    }
    const hasComponents = (appspec.services?.length || 0) +
        (appspec.static_sites?.length || 0) +
        (appspec.workers?.length || 0) +
        (appspec.jobs?.length || 0) +
        (appspec.databases?.length || 0);
    if (hasComponents === 0) {
        errors.push('App must have at least one component');
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
function validateServiceOrWorker(component, type, errors, warnings) {
    if (!component.git && !component.github && !component.image) {
        errors.push(`${type} '${component.name}' must have a source (git, github, or image)`);
    }
    if (type === 'service' && component.http_port) {
        if (component.http_port < 1 || component.http_port > 65535) {
            errors.push(`${type} '${component.name}' has invalid http_port ${component.http_port}. Must be between 1 and 65535`);
        }
    }
}
//# sourceMappingURL=appspec-validator.js.map