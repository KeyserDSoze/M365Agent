#!/usr/bin/env node
// Offline manifest validation with Agents Toolkit. No WIQD EULA or tenant login.
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validate } from './validate.ts';

async function main(): Promise<void> {
  const { path } = await validate();
  const envPath = join(path, 'env', '.env.prod');
  const original = await readFile(envPath, 'utf8');
  try {
    // A placeholder UUID is used only for validation on an ephemeral CI runner.
    const simulated = original.replace(/^TEAMS_APP_ID=$/m, 'TEAMS_APP_ID=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    await writeFile(envPath, simulated);
    const result = spawnSync('atk', ['validate', '--env', 'prod', '--folder', path, '--interactive', 'false'], {
      stdio: 'inherit', shell: process.platform === 'win32',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('Agents Toolkit validation failed (' + result.status + ')');
  } finally {
    await writeFile(envPath, original);
  }
}
main().catch((error: unknown) => {
  console.error('Toolkit validation FAILED:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
