import { Command } from 'commander';
import { readFile } from 'fs/promises';
import chalk from 'chalk';
import YAML from 'yaml';
import { validate } from '../../validator/index.js';
export const validateCommand = new Command('validate')
    .description('Validate an AppSpec YAML file')
    .argument('<appspec>', 'Path to the AppSpec YAML file')
    .action(async (appspecPath) => {
    try {
        const content = await readFile(appspecPath, 'utf-8');
        const appspec = YAML.parse(content);
        const result = validate(appspec);
        if (result.valid) {
            console.log(chalk.green('✓ AppSpec is valid'));
            if (result.warnings.length > 0) {
                console.log(chalk.yellow('\nWarnings:'));
                result.warnings.forEach((warn) => console.log(chalk.yellow(`  - ${warn}`)));
            }
        }
        else {
            console.log(chalk.red('✗ AppSpec validation failed\n'));
            console.log(chalk.red('Errors:'));
            result.errors.forEach((err) => console.error(chalk.red(`  - ${err}`)));
            if (result.warnings.length > 0) {
                console.log(chalk.yellow('\nWarnings:'));
                result.warnings.forEach((warn) => console.log(chalk.yellow(`  - ${warn}`)));
            }
            process.exit(1);
        }
    }
    catch (error) {
        console.error(chalk.red('Failed to read or parse AppSpec'));
        if (error instanceof Error) {
            console.error(chalk.red(error.message));
        }
        process.exit(1);
    }
});
//# sourceMappingURL=validate.js.map