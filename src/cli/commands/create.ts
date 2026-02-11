import { Command } from 'commander';
import { writeFile } from 'fs/promises';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { generateArchitecture } from '../../llm/index.js';
import { parse } from '../../parser/index.js';
import { transform } from '../../transformer/index.js';
import { generate } from '../../generator/index.js';

export const createCommand = new Command('create')
  .description('Create infrastructure from a natural language description')
  .argument('<description>', 'Description of your application')
  .option('-o, --output <file>', 'Output file path', 'appspec.yaml')
  .option('-d, --diagram <file>', 'Also save the generated Mermaid diagram')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (description: string, options: { output: string; diagram?: string; yes?: boolean }) => {
    const spinner = ora('Generating architecture...').start();

    try {
      const result = await generateArchitecture(description, []);
      spinner.stop();

      console.log(chalk.bold('\nGenerated Architecture:\n'));
      console.log(chalk.cyan(result.diagram));
      console.log(chalk.dim('\n' + result.explanation + '\n'));

      if (!options.yes) {
        const { proceed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: 'Generate AppSpec from this architecture?',
            default: true,
          },
        ]);

        if (!proceed) {
          console.log(chalk.yellow('Aborted.'));
          return;
        }
      }

      spinner.start('Building AppSpec...');

      if (!result.diagram) {
        spinner.fail(chalk.red('No architecture diagram generated'));
        console.log(chalk.dim('The LLM response did not contain a valid Mermaid diagram.'));
        process.exit(1);
      }

      const ast = parse(result.diagram);
      const ir = transform(ast);
      const appspec = generate(ir);

      await writeFile(options.output, appspec);

      if (options.diagram) {
        await writeFile(options.diagram, result.diagram);
        spinner.succeed(chalk.green(`Diagram saved to ${options.diagram}`));
      }

      spinner.succeed(chalk.green(`AppSpec written to ${options.output}`));

      console.log(chalk.dim('\nNext steps:'));
      console.log(chalk.dim(`  1. Review the generated spec: ${chalk.cyan(`cat ${options.output}`)}`));
      console.log(chalk.dim(`  2. Deploy to DigitalOcean: ${chalk.cyan(`brick deploy ${options.output}`)}`));
    } catch (error) {
      spinner.fail(chalk.red('Create failed'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      process.exit(1);
    }
  });
