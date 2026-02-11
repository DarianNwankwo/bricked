export const DEFAULT_INSTANCE_SIZE = 'basic-xxs';
export const DEFAULT_INSTANCE_COUNT = 1;
export const DEFAULT_DATABASE_SIZE = 'db-s-dev-database';
export const ENVIRONMENT_SLUGS = {
    node: 'node-js',
    nodejs: 'node-js',
    javascript: 'node-js',
    typescript: 'node-js',
    python: 'python',
    django: 'python',
    flask: 'python',
    go: 'go',
    golang: 'go',
    ruby: 'ruby',
    rails: 'ruby',
    php: 'php',
    rust: 'rust',
    java: 'java',
    spring: 'java',
    dotnet: 'dotnet',
    csharp: 'dotnet',
    html: 'html',
    static: 'html',
    hugo: 'hugo',
    gatsby: 'gatsby',
    next: 'node-js',
    nextjs: 'node-js',
    react: 'node-js',
    vue: 'node-js',
    angular: 'node-js',
};
export function inferEnvironmentSlug(name) {
    const lowerName = name.toLowerCase().replace(/[^a-z]/g, '');
    for (const [pattern, slug] of Object.entries(ENVIRONMENT_SLUGS)) {
        if (lowerName.includes(pattern)) {
            return slug;
        }
    }
    return undefined;
}
export const VALID_REGIONS = [
    'nyc',
    'nyc1',
    'nyc3',
    'sfo',
    'sfo1',
    'sfo2',
    'sfo3',
    'ams',
    'ams2',
    'ams3',
    'sgp',
    'sgp1',
    'lon',
    'lon1',
    'fra',
    'fra1',
    'tor',
    'tor1',
    'blr',
    'blr1',
    'syd',
    'syd1',
];
export function normalizeRegion(region) {
    const lower = region.toLowerCase();
    if (VALID_REGIONS.includes(lower)) {
        return lower;
    }
    if (lower.startsWith('nyc'))
        return 'nyc';
    if (lower.startsWith('sfo'))
        return 'sfo';
    if (lower.startsWith('ams'))
        return 'ams';
    if (lower.startsWith('sgp'))
        return 'sgp';
    if (lower.startsWith('lon'))
        return 'lon';
    if (lower.startsWith('fra'))
        return 'fra';
    if (lower.startsWith('tor'))
        return 'tor';
    if (lower.startsWith('blr'))
        return 'blr';
    if (lower.startsWith('syd'))
        return 'syd';
    return 'nyc';
}
//# sourceMappingURL=defaults.js.map