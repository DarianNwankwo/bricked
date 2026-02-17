import { Command } from 'commander';
import { readFile, writeFile } from 'fs/promises';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { generateArchitecture } from '../../llm/index.js';
import { parse } from '../../parser/index.js';
import { transform } from '../../transformer/index.js';
import { generate } from '../../generator/index.js';
import { deriveBrickAppContract } from '../../bac/index.js';
async function resolveDescription(descriptionArg, descriptionFile) {
    const inlineDescription = descriptionArg?.trim() || '';
    if (!descriptionFile) {
        if (!inlineDescription) {
            throw new Error('Provide a description or use --description-file <path>');
        }
        return inlineDescription;
    }
    const fileContent = (await readFile(descriptionFile, 'utf8')).trim();
    if (!fileContent) {
        throw new Error(`Description file is empty: ${descriptionFile}`);
    }
    if (!inlineDescription) {
        return fileContent;
    }
    return `${inlineDescription}\n\nAdditional vertical description:\n${fileContent}`;
}
export const createCommand = new Command('create')
    .description('Create infrastructure from a natural language description')
    .argument('[description]', 'Description of your application')
    .option('-o, --output <file>', 'Output file path', 'appspec.yaml')
    .option('-d, --diagram <file>', 'Also save the generated Mermaid diagram')
    .option('-f, --description-file <file>', 'Path to a file containing the application/vertical description')
    .option('--bac-output <file>', 'Also write a derived Brick App Contract JSON file')
    .option('-y, --yes', 'Skip confirmation prompts')
    .action(async (description, options) => {
    const spinner = ora('Generating architecture...').start();
    try {
        const finalDescription = await resolveDescription(description, options.descriptionFile);
        const result = await generateArchitecture(finalDescription, []);
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
        const bac = deriveBrickAppContract({
            appName: ir.name,
            region: ir.region,
            intent: finalDescription,
            components: ir.components.map(component => ({
                id: component.id,
                name: component.name,
                type: component.type,
                connections: component.connections,
            })),
            connections: ir.components.flatMap(component => (component.connections || []).map(to => ({ from: component.id, to }))),
        });
        await writeFile(options.output, appspec);
        if (options.diagram) {
            await writeFile(options.diagram, result.diagram);
            spinner.succeed(chalk.green(`Diagram saved to ${options.diagram}`));
        }
        if (options.bacOutput) {
            await writeFile(options.bacOutput, JSON.stringify(bac, null, 2));
            spinner.succeed(chalk.green(`BAC saved to ${options.bacOutput}`));
        }
        spinner.succeed(chalk.green(`AppSpec written to ${options.output}`));
        console.log(chalk.dim('\nNext steps:'));
        console.log(chalk.dim(`  1. Review the generated spec: ${chalk.cyan(`cat ${options.output}`)}`));
        console.log(chalk.dim(`  2. Deploy to DigitalOcean: ${chalk.cyan(`brick deploy ${options.output}`)}`));
    }
    catch (error) {
        spinner.fail(chalk.red('Create failed'));
        if (error instanceof Error) {
            console.error(chalk.red(error.message));
        }
        process.exit(1);
    }
});
//# sourceMappingURL=create.js.map