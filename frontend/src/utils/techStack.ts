// Tech stack options per component type
// Mirrors backend techStackOptions from src/server/routes/architecture.ts

export const TECH_STACK_OPTIONS: Record<string, { options: string[]; default: string }> = {
  static_site: {
    options: ['React', 'Vue.js', 'Next.js', 'Svelte', 'Angular', 'Astro', 'HTML/CSS'],
    default: 'React',
  },
  service: {
    options: ['Node.js/Express', 'Python/FastAPI', 'Go/Gin', 'Ruby/Rails', 'Java/Spring', 'Rust/Actix', '.NET/C#'],
    default: 'Node.js/Express',
  },
  database: {
    options: ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'CockroachDB'],
    default: 'PostgreSQL',
  },
  cache: {
    options: ['Redis', 'Memcached', 'KeyDB'],
    default: 'Redis',
  },
  queue: {
    options: ['Redis', 'RabbitMQ', 'Kafka', 'AWS SQS'],
    default: 'Redis',
  },
  worker: {
    options: ['Node.js', 'Python', 'Go', 'Ruby', 'Java'],
    default: 'Node.js',
  },
  job: {
    options: ['Node.js', 'Python', 'Go', 'Shell Script'],
    default: 'Node.js',
  },
  api_gateway: {
    options: ['Kong', 'Nginx', 'Traefik', 'AWS API Gateway'],
    default: 'Kong',
  },
  load_balancer: {
    options: ['Nginx', 'HAProxy', 'Traefik', 'AWS ALB'],
    default: 'Nginx',
  },
  auth: {
    options: ['Auth0', 'Firebase Auth', 'Keycloak', 'Custom JWT'],
    default: 'Custom JWT',
  },
  storage: {
    options: ['DigitalOcean Spaces', 'AWS S3', 'Cloudflare R2', 'MinIO'],
    default: 'DigitalOcean Spaces',
  },
  search: {
    options: ['Elasticsearch', 'Algolia', 'Meilisearch', 'Typesense'],
    default: 'Elasticsearch',
  },
  monitoring: {
    options: ['Prometheus/Grafana', 'Datadog', 'New Relic', 'Sentry'],
    default: 'Prometheus/Grafana',
  },
  ml_model: {
    options: ['TensorFlow Serving', 'PyTorch Serve', 'ONNX Runtime', 'Hugging Face'],
    default: 'TensorFlow Serving',
  },
  cdn: {
    options: ['Cloudflare', 'AWS CloudFront', 'Fastly', 'DigitalOcean CDN'],
    default: 'Cloudflare',
  },
};
