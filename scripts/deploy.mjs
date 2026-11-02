#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdir, stat, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validate } from './validate.mjs';
function requireEnv(key) {
  const val = process.env[key];
  if (!val || !val.trim()) throw new Error('Manca il secret/variable prod: ' + key);
  return val;
}
function run(args) {
  console.log('> wiqd ' + args.join(' '));
  const p = spawnSync('wiqd', args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (p.error) throw p.error;
  if (p.status !== 0) throw new Error('wiqd failed (' + p.status + ')');
}
async function summary(message) {
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, message + '\n');
}
try {
  if (process.env.CI_ENABLED !== 'true') throw new Error('CI_ENABLED=true richiesto per questa pipeline.');
  requireEnv('M365_ACCOUNT_NAME');
  requireEnv('M365_ACCOUNT_PASSWORD');
  requireEnv('M365_TENANT_ID');
  const { config, path, pkg } = await validate({ requireInit: true, requireProvisioned: true });
  const { mode, emails, groupId, groupType } = config.audience;
  if (mode === 'organization' && process.env.ALLOW_ORG_SHARING !== 'true')
    throw new Error('Condivisione tenant bloccata: imposta ALLOW_ORG_SHARING=true su environment prod.');
  if (config.publishToCatalog && process.env.ALLOW_CATALOG_PUBLISH !== 'true')
    throw new Error('Pubblicazione catalogo bloccata: imposta ALLOW_CATALOG_PUBLISH=true su environment prod.');
  const flags = ['--path', path, '--env', 'prod'];
  run(['agent', 'validate', ...flags]);
  run(['agent', 'provision', ...flags]);
  const zip = join(pkg, 'build', 'appPackage.prod.zip');
  await mkdir(join(pkg, 'build'), { recursive: true });
  run(['agent', 'package', ...flags, '--output', zip]);
  if ((await stat(zip)).size === 0) throw new Error('Pacchetto ZIP vuoto');
  run(['agent', 'validate', ...flags, '--mode', 'deep', '--package-file', zip]);
  if (mode === 'organization') {
    run(['agent', 'share', ...flags, '--scope', 'tenant']);
    await summary('Distribuzione: accesso diretto richiesto per il tenant intero.');
  } else if ((mode === 'users') || (mode === 'private' && emails.length === 1)) {
    run(['agent', 'share', ...flags, '--scope', 'users', '--email', emails.join(',')]);
    await summary('Distribuzione: condivisione diretta richiesta per ' + emails.length + ' utente/i.');
  } else if (mode === 'private') {
    await summary('Distribuzione: solo proprietario/deployer. Nessuna condivisione aggiuntiva.');
  } else {
    await summary('Distribuzione per gruppo PENDING: il deploy è eseguito, ma un amministratore deve assegnare nel Microsoft 365 admin center Available to=Specific users/groups al gruppo ' + groupType + ' ' + groupId + '. Non equivale a un accesso già concesso.');
  }
  if (config.publishToCatalog) {
    run(['agent', 'publish', ...flags]);
    await summary('Catalogo: inviata richiesta di pubblicazione; approvazione e assegnazione amministrativa possono essere necessarie.');
  }
  if (mode === 'group') {
    if (process.env.GROUP_ASSIGNMENT_CONFIRMED !== 'true') {
      await summary('AZIONE AMMINISTRATORE RICHIESTA: assegnare nel Microsoft 365 admin center il gruppo ' + groupType + ' ' + groupId + ', testare con membro e non membro, quindi impostare GROUP_ASSIGNMENT_CONFIRMED=true in prod e rilanciare il workflow.');
      throw new Error('Deploy tecnico eseguito, visibilità al gruppo NON completata: conferma amministrativa mancante.');
    }
    await summary('Assegnazione al gruppo dichiarata completata dall’amministratore (flag): non verificabile automaticamente tramite WIQD.');
  }
  await summary('Deploy prod completato per ' + config.displayName + '.');
} catch (e) {
  console.error('Deploy FAILED: ' + e.message);
  process.exitCode = 1;
}
