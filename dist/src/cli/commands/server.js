import { Command } from 'commander';
import chalk from 'chalk';
export const serverCommand = new Command('server')
    .description('Start the Brick platform server')
    .option('-p, --port <port>', 'Port to run the server on', '4000')
    .action(async (options) => {
    process.env.PORT = options.port;
    console.log(chalk.bold('\n🧱 Starting Brick Platform Server...\n'));
    // Check for required environment variables
    if (!process.env.BRICK_DO_TOKEN) {
        console.log(chalk.yellow('⚠️  BRICK_DO_TOKEN not set - deployments will be disabled'));
        console.log(chalk.dim('   Set it with: export BRICK_DO_TOKEN=your_digitalocean_token\n'));
    }
    // Dynamic import to avoid loading server code unless needed
    const { startServer } = await import('../../server/index.js');
    startServer();
});
//# sourceMappingURL=server.js.map