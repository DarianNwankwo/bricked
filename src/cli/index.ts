import { Command } from 'commander';
import { buildCommand } from './commands/build.js';
import { createCommand } from './commands/create.js';
import { deployCommand } from './commands/deploy.js';
import { chatCommand } from './commands/chat.js';
import { validateCommand } from './commands/validate.js';
import { uiCommand } from './commands/ui.js';
import { serverCommand } from './commands/server.js';

export const cli = new Command();

cli
  .name('brick')
  .description('Translate natural language or Mermaid diagrams into deployed DigitalOcean infrastructure')
  .version('0.1.0');

cli.addCommand(buildCommand);
cli.addCommand(createCommand);
cli.addCommand(deployCommand);
cli.addCommand(chatCommand);
cli.addCommand(validateCommand);
cli.addCommand(uiCommand);
cli.addCommand(serverCommand);
