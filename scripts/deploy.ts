#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { appendFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { validate } from './validate.ts';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value?.trim()) throw new Error('Manca il secret/variable prod: ' + key);
  return value;
}
function run(args: string[]): void {
  console.log('> wiqd ' + args.join(' '));
  const result = spawnSync('wiqd', args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('wiqd failed (' + result.status + ')');
}
async function summary(message: string): Promise<void> {
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, message + '\n');
}
async function main(): Promise<void> {
  if (process.env.CI_ENABLED !== 'true') throw new Error('CI_ENABLED=true richiesto; usa la pipeline prod protetta');
  requireEnv('M365_ACCOUNT_NAME');
  requireEnv('M365_ACCOUNT_PASSWORD');
  requireEnv('M365_TENANT_ID');
  const { config, path, pkg } = await validate({ requireInit: true, requireProvisioned: true });
  const { mode, emails } = config.audience;
  if (mode === 'organization' && process.env.ALLOW_ORG_SHARING !== 'true') {
    throw new Error('Condivisione tenant bloccata: ALLOW_ORG_SHARING deve essere true su prod');
  }
  if (config.publishToCatalog && process.env.ALLOW_CATALOG_PUBLISH !== 'true') {
    throw new Error('Pubblicazione catalogo bloccata: ALLOW_CATALOG_PUBLISH deve essere true su prod');
  }
  const flags = ['--path', path, '--env', 'prod'];
  run(['agent', 'validate', ...flags]);
  run(['agent', 'provision', ...flags]);
  await mkdir(join(pkg, 'build'), { recursive: true });
  const zip = join(pkg, 'build', 'appPackage.prod.zip');
  run(['agent', 'package', ...flags, '--output', zip]);
  if ((await stat(zip)).size === 0) throw new Error('Pacchetto ZIP vuoto');
  run(['agent', 'validate', ...flags, '--mode', 'deep', '--package-file', zip]);
  if (mode === 'organization') {
    run(['agent', 'share', ...flags, '--scope', 'tenant']);
    await summary('Condivisione diretta al tenant richiesta');
  } else if (mode === 'users' || (mode === 'private' && emails.length === 1)) {
    run(['agent', 'share', ...flags, '--scope', 'users', '--email', emails.join(',')]);
    await summary('Condivisione diretta richiesta per ' + emails.length + ' utente/i');
  } else if (mode === 'private') {
    await summary('Nessuna condivisione ulteriore: visibilità privata del deployer');
  } else {
    await summary('Assegnazione amministrativa richiesta: gruppo ' + config.audience.groupType + ' ' + config.audience.groupId);
  }
  if (config.publishToCatalog) {
    run(['agent', 'publish', ...flags]);
    await summary('Richiesta di pubblicazione nel catalogo inoltrata: possibili approvazioni amministrative');
  }
  if (mode === 'group') {
    if (process.env.GROUP_ASSIGNMENT_CONFIRMED !== 'true') {
      await summary('AZIONE ADMIN: assegnare Available to: Specific users/groups nel Microsoft 365 admin center; testare membri e non membri; solo dopo impostare GROUP_ASSIGNMENT_CONFIRMED=true');
      throw new Error('Deploy tecnico eseguito, visibilità al gruppo NON completata');
    }
    await summary('Assegnazione gruppo attestata da admin (non verificabile automaticamente tramite WIQD)');
  }
  await summary('Deploy prod completato per ' + config.displayName);
}

main().catch((error: unknown) => {
  console.error('Deploy FAILED:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
