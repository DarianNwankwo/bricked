export const FEW_SHOT_EXAMPLES = [
    {
        user: 'A simple blog with Next.js and PostgreSQL',
        assistant: `Here's a simple architecture for your blog:

\`\`\`mermaid
flowchart TD
    %% brick:name=blog
    A[Next.js App] --> B[(PostgreSQL)]
\`\`\`

This setup includes:
- A Next.js application serving both the frontend and API routes
- A managed PostgreSQL database for storing posts and user data

The Next.js app will automatically receive the DATABASE_URL environment variable to connect to PostgreSQL.`,
    },
    {
        user: 'An e-commerce site with separate frontend and backend, plus Redis for caching',
        assistant: `Here's a microservices architecture for your e-commerce platform:

\`\`\`mermaid
flowchart TD
    %% brick:name=ecommerce
    A([React SPA]) --> B[Product API]
    A --> C[Order API]
    B --> D[(PostgreSQL)]
    C --> D
    B --> E[(Redis)]
    C --> E
\`\`\`

This architecture includes:
- **React SPA**: Static frontend served from CDN for fast global delivery
- **Product API**: Handles product catalog, search, and inventory
- **Order API**: Manages shopping cart, checkout, and order processing
- **PostgreSQL**: Primary database for products, orders, and users
- **Redis**: Caching layer for frequently accessed data (product listings, sessions)

The APIs are separated so they can scale independently based on traffic patterns.`,
    },
    {
        user: 'A data pipeline that processes uploads and sends email notifications',
        assistant: `Here's an event-driven architecture for your data pipeline:

\`\`\`mermaid
flowchart TD
    %% brick:name=data-pipeline
    A[Upload API] --> B[(Redis)]
    B --> C((File Processor))
    B --> D((Email Worker))
    C --> E[(PostgreSQL)]
    D --> E
\`\`\`

This setup includes:
- **Upload API**: Receives file uploads and queues processing jobs
- **Redis**: Message queue for job coordination
- **File Processor Worker**: Processes uploaded files asynchronously
- **Email Worker**: Sends notifications when processing completes
- **PostgreSQL**: Stores processing results and notification logs

Workers run continuously and pull jobs from Redis, allowing horizontal scaling.`,
    },
    {
        user: 'A system that generates daily reports and syncs data every hour',
        assistant: `Here's a scheduled job architecture:

\`\`\`mermaid
flowchart TD
    %% brick:name=analytics
    A{{Daily Report}}
    %% brick:A:schedule=0 6 * * *
    B{{Hourly Sync}}
    %% brick:B:schedule=0 * * * *
    A --> C[(PostgreSQL)]
    B --> C
\`\`\`

This includes:
- **Daily Report Job**: Runs at 6 AM UTC to generate reports
- **Hourly Sync Job**: Runs every hour to sync external data
- **PostgreSQL**: Stores the synchronized data and generated reports

Jobs run to completion and are scheduled using cron syntax. Both jobs share the same database.`,
    },
    {
        user: 'A static documentation site with a Go API backend',
        assistant: `Here's a static site with API backend:

\`\`\`mermaid
flowchart LR
    %% brick:name=docs-site
    A([Hugo Site]) --> B[Go API]
    B --> C[(PostgreSQL)]
\`\`\`

This architecture includes:
- **Hugo Site**: Static documentation built with Hugo, served from CDN
- **Go API**: Backend service for dynamic features (search, feedback, auth)
- **PostgreSQL**: Stores user data and dynamic content

The static site makes API calls to the Go backend for any dynamic functionality. Using LR (left-to-right) flow shows the request direction clearly.`,
    },
];
export function formatExamplesForPrompt() {
    return FEW_SHOT_EXAMPLES.map((example, i) => `Example ${i + 1}:
User: ${example.user}
Assistant: ${example.assistant}`).join('\n\n---\n\n');
}
//# sourceMappingURL=examples.js.map