#!/usr/bin/env node
import { cli } from '../src/cli/index.js';
import { loadEnvFromCwd } from '../src/utils/env-loader.js';
loadEnvFromCwd();
cli.parse(process.argv);
//# sourceMappingURL=brick.js.map