#!/usr/bin/env node
// Multipiattaforma: node init/init.mjs <nome> [--display-name "Nome visualizzato"]
import { readFile, writeFile, rename, access } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
function fail(message) { console.error('Init: ' + message); process.exit(1); }
if (!args[0] || args[0].startsWith('--') || args.includes('--help')) {
  console.log('Uso: node init/init.mjs nome-progetto [--display-name "Nome Agent"]');
  process.exit(args.includes('--help') ? 0 : 1);
}
const slug = args[0].normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
if (!/^[a-z][a-z0-9-]{2,47}$/.test(slug) || slug.endsWith('-')) fail('Nome non valido (3-48 caratteri, iniziale alfabetica).');
const displayFlag = args.indexOf('--display-name');
if (displayFlag >= 0 && !args[displayFlag + 1]) fail('--display-name richiede un valore.');
if (args.length !== (displayFlag >= 0 ? 3 : 1) || (displayFlag >= 0 && displayFlag !== 1)) fail('Argomenti non riconosciuti.');
const displayName = displayFlag >= 0 ? args[displayFlag + 1].trim() : slug.split('-').map(x => x[0].toUpperCase() + x.slice(1)).join(' ');
if (!displayName || displayName.length > 30) fail('Il nome visualizzato deve contenere 1-30 caratteri (limite manifest Teams).');
const configPath = join(root, 'agent.config.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));
if (config.name !== 'm365-agent') fail('Progetto già inizializzato: non rigenerare la sua identità M365.');
const source = join(root, 'src', 'm365-agent'), target = join(root, 'src', slug);
if (slug !== 'm365-agent') {
  try { await access(target); fail('Destinazione già esistente: src/' + slug); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  await rename(source, target);
}
const agentDir = slug === 'm365-agent' ? source : target;
const manifestPath = join(agentDir, 'appPackage', 'manifest.json');
const definitionPath = join(agentDir, 'appPackage', 'declarativeAgent.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const definition = JSON.parse(await readFile(definitionPath, 'utf8'));
manifest.name.short = displayName;
manifest.name.full = displayName;
definition.name = displayName;
definition.description = 'Assistente per il progetto ' + displayName + '.';
config.name = slug;
config.displayName = displayName;
config.description = definition.description;
const env = '# Identificatore fisso per la distribuzione idempotente al tenant; non cambiare dopo il primo deploy.\n' +
  'TEAMSFX_ENV=prod\nTEAMS_APP_NAME=' + slug + '\nTEAMS_APP_ID=' + randomUUID() + '\n';
await writeFile(join(agentDir, 'env', '.env.prod'), env);
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
await writeFile(definitionPath, JSON.stringify(definition, null, 2) + '\n');
await writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('OK: src/' + slug + ' — ' + displayName + '. Configura ora agent.config.json e prod.');
