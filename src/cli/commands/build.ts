import { Command } from 'commander';
import { readFile, writeFile } from 'fs/promises';
import chalk from 'chalk';
import ora from 'ora';
import { parse } from '../../parser/index.js';
import { transform } from '../../transformer/index.js';
import { generate } from '../../generator/index.js';

export const buildCommand = new Command('build')
  .description('Build AppSpec YAML from a Mermaid diagram')
  .argument('<diagram>', 'Path to the Mermaid diagram file (.mmd)')
  .option('-o, --output <file>', 'Output file path', 'appspec.yaml')
  .option('-n, --name <name>', 'Override app name')
  .option('-r, --region <region>', 'Override region (e.g., nyc, sfo, ams)')
  .action(async (diagramPath: string, options: { output: string; name?: string; region?: string }) => {
    const spinner = ora('Reading diagram...').start();

    try {
      const content = await readFile(diagramPath, 'utf-8');
      spinner.text = 'Parsing Mermaid diagram...';

      const ast = parse(content);
      spinner.text = 'Transforming to intermediate representation...';

      const ir = transform(ast, {
        name: options.name,
        region: options.region,
      });
      spinner.text = 'Generating AppSpec YAML...';

      const appspec = generate(ir);

      await writeFile(options.output, appspec);
      spinner.succeed(chalk.green(`AppSpec written to ${options.output}`));

      console.log(chalk.dim('\nNext steps:'));
      console.log(chalk.dim(`  1. Review the generated spec: ${chalk.cyan(`cat ${options.output}`)}`));
      console.log(chalk.dim(`  2. Deploy to DigitalOcean: ${chalk.cyan(`brick deploy ${options.output}`)}`));
    } catch (error) {
      spinner.fail(chalk.red('Build failed'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      process.exit(1);
    }
  });
