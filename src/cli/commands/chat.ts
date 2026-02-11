import { Command } from 'commander';
import { writeFile } from 'fs/promises';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { generateArchitecture, refineArchitecture, type Message } from '../../llm/index.js';
import { parse } from '../../parser/index.js';
import { transform } from '../../transformer/index.js';
import { generate } from '../../generator/index.js';
import { deriveBrickAppContract } from '../../bac/index.js';

export const chatCommand = new Command('chat')
  .description('Interactive mode to design and refine your architecture')
  .option('-o, --output <file>', 'Output file path', 'appspec.yaml')
  .option('--bac-output <file>', 'Also write a derived Brick App Contract JSON file')
  .action(async (options: { output: string; bacOutput?: string }) => {
    console.log(chalk.bold('\nWelcome to Brick Interactive Mode\n'));
    console.log(chalk.dim('Describe your application and I\'ll design the architecture.'));
    console.log(chalk.dim('You can then refine it through conversation.\n'));
    console.log(chalk.dim('Commands:'));
    console.log(chalk.dim('  /build  - Generate AppSpec from current architecture'));
    console.log(chalk.dim('  /show   - Show current Mermaid diagram'));
    console.log(chalk.dim('  /reset  - Start over'));
    console.log(chalk.dim('  /quit   - Exit\n'));

    const conversationHistory: Message[] = [];
    let currentDiagram: string | null = null;

    while (true) {
      const { input } = await inquirer.prompt([
        {
          type: 'input',
          name: 'input',
          message: chalk.cyan('>'),
          prefix: '',
        },
      ]);

      const trimmedInput = input.trim();

      if (!trimmedInput) continue;

      if (trimmedInput === '/quit' || trimmedInput === '/exit') {
        console.log(chalk.dim('Goodbye!'));
        break;
      }

      if (trimmedInput === '/reset') {
        conversationHistory.length = 0;
        currentDiagram = null;
        console.log(chalk.yellow('Conversation reset. Describe your new application.'));
        continue;
      }

      if (trimmedInput === '/show') {
        if (currentDiagram) {
          console.log(chalk.cyan('\n' + currentDiagram + '\n'));
        } else {
          console.log(chalk.yellow('No architecture generated yet.'));
        }
        continue;
      }

      if (trimmedInput === '/build') {
        if (!currentDiagram) {
          console.log(chalk.yellow('No architecture to build. Describe your application first.'));
          continue;
        }

        const spinner = ora('Building AppSpec...').start();
        try {
          const ast = parse(currentDiagram);
          const ir = transform(ast);
          const appspec = generate(ir);
          const bac = deriveBrickAppContract({
            appName: ir.name,
            region: ir.region,
            intent: conversationHistory.find(message => message.role === 'user')?.content,
            components: ir.components.map(component => ({
              id: component.id,
              name: component.name,
              type: component.type,
              connections: component.connections,
            })),
            connections: ir.components.flatMap(component =>
              (component.connections || []).map(to => ({ from: component.id, to }))
            ),
          });

          await writeFile(options.output, appspec);
          if (options.bacOutput) {
            await writeFile(options.bacOutput, JSON.stringify(bac, null, 2));
          }
          spinner.succeed(chalk.green(`AppSpec written to ${options.output}`));
          if (options.bacOutput) {
            console.log(chalk.dim(`  BAC: ${chalk.cyan(options.bacOutput)}`));
          }

          console.log(chalk.dim('\nNext steps:'));
          console.log(chalk.dim(`  1. Review: ${chalk.cyan(`cat ${options.output}`)}`));
          console.log(chalk.dim(`  2. Deploy: ${chalk.cyan(`brick deploy ${options.output}`)}`));
        } catch (error) {
          spinner.fail(chalk.red('Build failed'));
          if (error instanceof Error) {
            console.error(chalk.red(error.message));
          }
        }
        continue;
      }

      const spinner = ora('Thinking...').start();

      try {
        let result;
        if (currentDiagram) {
          result = await refineArchitecture(trimmedInput, currentDiagram, conversationHistory);
        } else {
          result = await generateArchitecture(trimmedInput, conversationHistory);
        }

        spinner.stop();

        conversationHistory.push({ role: 'user', content: trimmedInput });
        conversationHistory.push({ role: 'assistant', content: result.rawContent });

        if (result.diagram) {
          currentDiagram = result.diagram;
          console.log(chalk.bold('\nArchitecture:\n'));
          console.log(chalk.cyan(result.diagram));
        }

        if (result.explanation) {
          console.log(chalk.dim('\n' + result.explanation + '\n'));
        }
      } catch (error) {
        spinner.fail(chalk.red('Error'));
        if (error instanceof Error) {
          console.error(chalk.red(error.message));
        }
      }
    }
  });
