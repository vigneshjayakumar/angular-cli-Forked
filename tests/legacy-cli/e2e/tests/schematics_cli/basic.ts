import { join } from 'node:path';
import { getGlobalVariable } from '../../utils/env';
import { exec, execAndWaitForOutputToMatch, silentNpm } from '../../utils/process';
import { rimraf } from '../../utils/fs';

export default async function () {
  // setup
  const argv = getGlobalVariable('argv');
  if (argv.noglobal) {
    return;
  }

  await silentNpm('install', '-g', '@angular-devkit/schematics-cli');
  await exec(process.platform.startsWith('win') ? 'where' : 'which', 'schematics');

  const startCwd = process.cwd();
  const schematicPath = join(startCwd, 'test-schematic');

  try {
    // create blank schematic
    await exec('schematics', 'schematic', '--name', 'test-schematic');

    process.chdir(join(startCwd, 'test-schematic'));
    await execAndWaitForOutputToMatch(
      'schematics',
      ['.:', '--list-schematics'],
      /my-full-schematic/,
    );
  } finally {
    // restore path
    process.chdir(startCwd);
    await Promise.all([
      rimraf(schematicPath),
      silentNpm('uninstall', '-g', '@angular-devkit/schematics-cli'),
    ]);
  }
}
