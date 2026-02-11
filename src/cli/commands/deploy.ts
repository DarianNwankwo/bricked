import { Command } from 'commander';
import { readFile } from 'fs/promises';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { deploy, checkDoctl } from '../../deployer/index.js';
import { estimateCost } from '../../deployer/cost-estimator.js';
import { validate } from '../../validator/index.js';
import YAML from 'yaml';

export const deployCommand = new Command('deploy')
  .description('Deploy an AppSpec to DigitalOcean App Platform')
  .argument('<appspec>', 'Path to the AppSpec YAML file')
  .option('-y, --yes', 'Skip confirmation prompts')
  .option('--dry-run', 'Show what would be deployed without deploying')
  .action(async (appspecPath: string, options: { yes?: boolean; dryRun?: boolean }) => {
    const spinner = ora('Checking prerequisites...').start();

    try {
      const doctlInstalled = await checkDoctl();
      if (!doctlInstalled) {
        spinner.fail(chalk.red('doctl is not installed or not authenticated'));
        console.log(chalk.dim('\nTo install and configure doctl:'));
        console.log(chalk.dim('  1. Install: https://docs.digitalocean.com/reference/doctl/how-to/install/'));
        console.log(chalk.dim('  2. Authenticate: doctl auth init'));
        process.exit(1);
      }

      spinner.text = 'Reading AppSpec...';
      const content = await readFile(appspecPath, 'utf-8');
      const appspec = YAML.parse(content);

      spinner.text = 'Validating AppSpec...';
      const validation = validate(appspec);
      if (!validation.valid) {
        spinner.fail(chalk.red('AppSpec validation failed'));
        validation.errors.forEach((err) => console.error(chalk.red(`  - ${err}`)));
        process.exit(1);
      }

      spinner.stop();

      const cost = estimateCost(appspec);
      console.log(chalk.bold('\nDeployment Summary:'));
      console.log(chalk.dim(`  App Name: ${chalk.white(appspec.name)}`));
      console.log(chalk.dim(`  Region: ${chalk.white(appspec.region || 'nyc')}`));
      console.log(chalk.dim(`  Estimated Monthly Cost: ${chalk.yellow(cost.formatted)}`));
      console.log(chalk.dim('\n  Components:'));
      cost.breakdown.forEach((item) => {
        console.log(chalk.dim(`    - ${item.name} (${item.type}): ${item.cost}`));
      });

      if (options.dryRun) {
        console.log(chalk.yellow('\n[Dry run] No changes made.'));
        return;
      }

      if (!options.yes) {
        const { proceed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: 'Deploy this application?',
            default: false,
          },
        ]);

        if (!proceed) {
          console.log(chalk.yellow('Deployment cancelled.'));
          return;
        }
      }

      spinner.start('Deploying to DigitalOcean...');
      const result = await deploy(appspecPath);

      if (result.success) {
        spinner.succeed(chalk.green('Deployment started successfully!'));
        console.log(chalk.dim(`\nApp URL: ${chalk.cyan(result.url)}`));
        console.log(chalk.dim(`Dashboard: ${chalk.cyan(result.dashboardUrl)}`));
      } else {
        spinner.fail(chalk.red('Deployment failed'));
        console.error(chalk.red(result.error));
        process.exit(1);
      }
    } catch (error) {
      spinner.fail(chalk.red('Deploy failed'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      process.exit(1);
    }
  });
