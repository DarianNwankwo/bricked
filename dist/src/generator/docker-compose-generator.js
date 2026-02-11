// Docker Compose generator for local preview
import YAML from 'yaml';
// Component type to Docker service mapping
const componentToDocker = {
    service: {
        build: '.',
        ports: ['3000:3000'],
        environment: {
            NODE_ENV: 'development',
            PORT: '3000',
        },
    },
    static_site: {
        image: 'nginx:alpine',
        ports: ['80:80'],
        volumes: ['./dist:/usr/share/nginx/html:ro'],
    },
    database: {
        image: 'postgres:15-alpine',
        environment: {
            POSTGRES_USER: 'brick',
            POSTGRES_PASSWORD: 'brick_dev_password',
            POSTGRES_DB: 'brick_db',
        },
        volumes: ['db-data:/var/lib/postgresql/data'],
        healthcheck: {
            test: ['CMD-SHELL', 'pg_isready -U brick'],
            interval: '10s',
            timeout: '5s',
            retries: 5,
        },
    },
    worker: {
        build: '.',
        command: 'npm run worker',
        environment: {
            NODE_ENV: 'development',
        },
    },
    job: {
        build: '.',
        command: 'npm run job',
        environment: {
            NODE_ENV: 'development',
        },
    },
};
// Database type variations
const databaseImages = {
    postgres: {
        image: 'postgres:15-alpine',
        environment: {
            POSTGRES_USER: 'brick',
            POSTGRES_PASSWORD: 'brick_dev_password',
            POSTGRES_DB: 'brick_db',
        },
        volumes: ['postgres-data:/var/lib/postgresql/data'],
        healthcheck: {
            test: ['CMD-SHELL', 'pg_isready -U brick'],
            interval: '10s',
            timeout: '5s',
            retries: 5,
        },
    },
    mysql: {
        image: 'mysql:8',
        environment: {
            MYSQL_ROOT_PASSWORD: 'brick_dev_password',
            MYSQL_DATABASE: 'brick_db',
            MYSQL_USER: 'brick',
            MYSQL_PASSWORD: 'brick_dev_password',
        },
        volumes: ['mysql-data:/var/lib/mysql'],
        healthcheck: {
            test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost'],
            interval: '10s',
            timeout: '5s',
            retries: 5,
        },
    },
    mongodb: {
        image: 'mongo:7',
        environment: {
            MONGO_INITDB_ROOT_USERNAME: 'brick',
            MONGO_INITDB_ROOT_PASSWORD: 'brick_dev_password',
            MONGO_INITDB_DATABASE: 'brick_db',
        },
        volumes: ['mongodb-data:/data/db'],
        healthcheck: {
            test: ['CMD', 'mongosh', '--eval', "db.adminCommand('ping')"],
            interval: '10s',
            timeout: '5s',
            retries: 5,
        },
    },
    redis: {
        image: 'redis:7-alpine',
        environment: {},
        volumes: ['redis-data:/data'],
        healthcheck: {
            test: ['CMD', 'redis-cli', 'ping'],
            interval: '10s',
            timeout: '5s',
            retries: 5,
        },
    },
};
// Detect database type from component name
function detectDatabaseType(name) {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('postgres') || nameLower.includes('postgresql') || nameLower.includes('pg')) {
        return 'postgres';
    }
    if (nameLower.includes('mysql') || nameLower.includes('mariadb')) {
        return 'mysql';
    }
    if (nameLower.includes('mongo') || nameLower.includes('mongodb')) {
        return 'mongodb';
    }
    if (nameLower.includes('redis')) {
        return 'redis';
    }
    return 'postgres'; // Default
}
// Generate service name from component name
function toServiceName(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}
// Derive a deterministic starting port from the project slug so each project
// gets its own port range (9100-9899). Each project can use up to 10 ports.
function portBaseForProject(slug) {
    let hash = 0;
    for (let i = 0; i < slug.length; i++) {
        hash = ((hash << 5) - hash + slug.charCodeAt(i)) | 0;
    }
    // Map to 80 possible slots of 10 ports each within 9100-9899
    const slot = ((hash % 80) + 80) % 80;
    return 9100 + slot * 10;
}
export function generateDockerCompose(project) {
    const services = {};
    const volumes = {};
    const componentIdToService = {};
    // Each project gets a deterministic port range based on its slug
    let nextPort = portBaseForProject(project.slug);
    const usedPorts = new Set();
    // First pass: create services and track IDs
    for (const component of project.architecture.components) {
        const serviceName = toServiceName(component.name);
        componentIdToService[component.id] = serviceName;
        let service = {};
        if (component.type === 'database') {
            const dbType = detectDatabaseType(component.name);
            const dbConfig = databaseImages[dbType];
            service = {
                image: dbConfig.image,
                environment: { ...dbConfig.environment },
                volumes: dbConfig.volumes.map(v => v.replace(/^[^-]+-/, `${serviceName}-`)),
                restart: 'unless-stopped',
            };
            if (dbConfig.healthcheck) {
                service.healthcheck = dbConfig.healthcheck;
            }
            // Add volume for this database
            const volumeName = dbConfig.volumes[0].split(':')[0].replace(/^[^-]+-/, `${serviceName}-`);
            volumes[volumeName] = {};
            // Databases don't expose host ports — services connect via Docker network
        }
        else {
            const template = componentToDocker[component.type] || componentToDocker.service;
            service = { ...template };
            // Handle port assignment for services
            if (component.type === 'service' || component.type === 'static_site') {
                while (usedPorts.has(nextPort)) {
                    nextPort++;
                }
                const containerPort = component.type === 'static_site' ? 80 : 3000;
                service.ports = [`${nextPort}:${containerPort}`];
                usedPorts.add(nextPort);
                if (service.environment) {
                    service.environment.PORT = String(containerPort);
                }
                nextPort++;
            }
        }
        // Add container name
        service.container_name = `brick-${project.slug}-${serviceName}`;
        services[serviceName] = service;
    }
    // Second pass: add depends_on based on connections
    for (const connection of project.architecture.connections) {
        const fromService = componentIdToService[connection.from];
        const toService = componentIdToService[connection.to];
        if (fromService && toService && services[fromService]) {
            const service = services[fromService];
            if (!service.depends_on) {
                service.depends_on = [];
            }
            if (!service.depends_on.includes(toService)) {
                service.depends_on.push(toService);
            }
            // Add environment variable for database connection if connecting to a database
            const toComponent = project.architecture.components.find(c => c.id === connection.to);
            if (toComponent?.type === 'database') {
                if (!service.environment) {
                    service.environment = {};
                }
                const env = service.environment;
                const dbType = detectDatabaseType(toComponent.name);
                switch (dbType) {
                    case 'postgres':
                        env.DATABASE_URL = `postgresql://brick:brick_dev_password@${toService}:5432/brick_db`;
                        break;
                    case 'mysql':
                        env.DATABASE_URL = `mysql://brick:brick_dev_password@${toService}:3306/brick_db`;
                        break;
                    case 'mongodb':
                        env.MONGODB_URI = `mongodb://brick:brick_dev_password@${toService}:27017/brick_db`;
                        break;
                    case 'redis':
                        env.REDIS_URL = `redis://${toService}:6379`;
                        break;
                }
            }
        }
    }
    // Add labels for connection labels
    if (project.connectionLabels) {
        for (const [key, label] of Object.entries(project.connectionLabels)) {
            const [fromId, toId] = key.split('-');
            const fromService = componentIdToService[fromId];
            if (fromService && services[fromService]) {
                const service = services[fromService];
                if (!service.labels) {
                    service.labels = {};
                }
                service.labels[`brick.connection.${toId}`] = label;
            }
        }
    }
    return {
        version: '3.8',
        services,
        volumes: Object.keys(volumes).length > 0 ? volumes : undefined,
        networks: {
            default: {
                name: `brick-${project.slug}-network`,
            },
        },
    };
}
// Generate docker-compose.yml content as string
export function generateDockerComposeYAML(project) {
    const config = generateDockerCompose(project);
    return YAML.stringify(config, {
        indent: 2,
        lineWidth: 120,
    });
}
// Generate a basic Dockerfile for services
export function generateDockerfile(componentType) {
    return `# Generated by Brick Studio
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy source code
COPY . .

# Build if needed
RUN npm run build --if-present

# Set environment
ENV NODE_ENV=production

# Expose port (only for services)
${componentType === 'service' ? 'EXPOSE 3000' : ''}

# Start command
CMD ["npm", "start"]
`;
}
// Generate nginx config for static sites
export function generateNginxConfig(componentName) {
    return `# Generated by Brick Studio for ${componentName}
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html index.htm;

    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
`;
}
//# sourceMappingURL=docker-compose-generator.js.map