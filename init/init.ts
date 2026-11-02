#!/usr/bin/env node
import { access, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAgentConfig } from '../types/agent-config.ts';
import { configureProjectGit } from './git.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function main(args: string[]): Promise<void> {
  if (args.includes('--help') || args.length === 0) {
    console.log('Uso: npm run init -- nome-progetto [--display-name "Nome Agent"]');
    if (args.includes('--help')) return;
    throw new Error('Inserisci il nome del progetto');
  }
  const [name, option, userDisplayName] = args;
  if (!name || name.startsWith('--') || (args.length !== 1 && !(args.length === 3 && option === '--display-name' && userDisplayName))) {
    throw new Error('Argomenti non validi. Usa --display-name "Nome Agent" se necessario');
  }
  const slug = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!/^[a-z][a-z0-9-]{2,47}$/.test(slug) || slug.endsWith('-') || slug === 'm365-agent') {
    throw new Error('Slug non valido o ancora uguale al nome del template (3-48 caratteri, iniziale alfabetica)');
  }
  const displayName = userDisplayName?.trim() ??
    slug.split('-').map((part) => part[0]!.toUpperCase() + part.slice(1)).join(' ');
  if (displayName.length < 1 || displayName.length > 30) {
    throw new Error('Il nome visualizzato deve contenere 1-30 caratteri');
  }

  const configPath = join(root, 'agent.config.json');
  const config = parseAgentConfig(JSON.parse(await readFile(configPath, 'utf8')) as unknown);
  if (config.name !== 'm365-agent') throw new Error('Progetto già inizializzato: non cambiare l’identità di un agent già distribuito');
  const source = join(root, 'src', 'm365-agent');
  const target = join(root, 'src', slug);
  try {
    await access(target);
    throw new Error('Cartella già esistente: src/' + slug);
  } catch (error: unknown) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  const manifestPath = join(source, 'appPackage', 'manifest.json');
  const definitionPath = join(source, 'appPackage', 'declarativeAgent.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    name: { short: string; full: string };
  };
  const definition = JSON.parse(await readFile(definitionPath, 'utf8')) as {
    name: string; description: string;
  };
  manifest.name.short = displayName;
  manifest.name.full = displayName;
  definition.name = displayName;
  definition.description = 'Assistente per il progetto ' + displayName + '.';
  config.name = slug;
  config.displayName = displayName;
  config.description = definition.description;

  // No invented cloud identifiers: the initial tenant provisioning generates real IDs.
  const environment = [
    '# Committare gli ID non segreti creati dal primo provisioning sul tenant reale.',
    'TEAMSFX_ENV=prod',
    'TEAMS_APP_NAME=' + slug,
    'TEAMS_APP_ID=',
    'M365_TITLE_ID=',
    'M365_AGENT_SCOPE=personal',
    '',
  ].join('\n');
  await rename(source, target);
  await writeFile(join(target, 'env', '.env.prod'), environment);
  await writeFile(join(target, 'appPackage', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(join(target, 'appPackage', 'declarativeAgent.json'), JSON.stringify(definition, null, 2) + '\n');
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log('OK: src/' + slug + ' — ' + displayName + '. Configura ora tenantId, audience e prod.');
  await configureProjectGit(root);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error('Init FAILED:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
