#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GUID_PATTERN, assertConfig, isRecord, parseAgentConfig, scopeForAudience, type AgentConfig } from '../types/agent-config.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export interface ValidatedProject {
  config: AgentConfig;
  path: string;
  pkg: string;
}

export interface ValidateOptions {
  requireInit?: boolean;
  requireProvisioned?: boolean;
}

function parseEnv(content: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    if (/^\s*(?:#|$)/.test(line)) continue;
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    assertConfig(match, 'Riga .env.prod non valida: ' + line);
    const key = match[1]!;
    assertConfig(!(key in vars), 'Variabile duplicata in .env.prod: ' + key);
    vars[key] = match[2]!;
  }
  return vars;
}

export async function validate(options: ValidateOptions = {}): Promise<ValidatedProject> {
  const config = parseAgentConfig(JSON.parse(await readFile(join(root, 'agent.config.json'), 'utf8')) as unknown);
  if (options.requireInit) assertConfig(config.name !== 'm365-agent', 'Esegui prima npm run init -- nome-progetto');
  const path = join(root, 'src', config.name);
  const pkg = join(path, 'appPackage');
  const manifest: unknown = JSON.parse(await readFile(join(pkg, 'manifest.json'), 'utf8'));
  const agent: unknown = JSON.parse(await readFile(join(pkg, 'declarativeAgent.json'), 'utf8'));
  assertConfig(isRecord(manifest) && isRecord(manifest.name), 'Manifest Teams non valido');
  assertConfig(manifest.id === '${{TEAMS_APP_ID}}', 'Il manifest deve riferirsi a TEAMS_APP_ID');
  assertConfig(manifest.name.short === config.displayName, 'Nome manifest diverso da agent.config.json');
  assertConfig(isRecord(agent) && agent.name === config.displayName, 'Nome declarativeAgent diverso da agent.config.json');
  assertConfig(typeof agent.instructions === 'string' && agent.instructions.trim().length >= 20, 'Istruzioni dell’agent mancanti');

  await stat(join(path, 'm365agents.yml'));
  const env = parseEnv(await readFile(join(path, 'env', '.env.prod'), 'utf8'));
  assertConfig(env.TEAMSFX_ENV === 'prod', 'TEAMSFX_ENV deve essere prod');
  assertConfig(env.TEAMS_APP_NAME === config.name, 'TEAMS_APP_NAME deve corrispondere al nome progetto');
  assertConfig(env.TEAMS_APP_ID === '' || (typeof env.TEAMS_APP_ID === 'string' && GUID_PATTERN.test(env.TEAMS_APP_ID)), 'TEAMS_APP_ID deve essere GUID o vuoto prima del bootstrap');
  assertConfig(env.M365_TITLE_ID !== undefined, 'M365_TITLE_ID mancante');
  assertConfig(env.M365_AGENT_SCOPE === scopeForAudience(config.audience), 'M365_AGENT_SCOPE errato: atteso ' + scopeForAudience(config.audience));
  if (options.requireProvisioned) {
    assertConfig(GUID_PATTERN.test(env.TEAMS_APP_ID ?? ''), 'Bootstrap richiesto: salva TEAMS_APP_ID reale in .env.prod');
    assertConfig((env.M365_TITLE_ID?.trim().length ?? 0) > 3, 'Bootstrap richiesto: salva M365_TITLE_ID in .env.prod');
    assertConfig(config.tenantId !== null, 'Configura tenantId in agent.config.json');
    assertConfig(process.env.M365_TENANT_ID?.toLowerCase() === config.tenantId.toLowerCase(), 'M365_TENANT_ID non corrisponde al tenantId configurato');
  }
  const capabilities = agent.capabilities;
  if (capabilities !== undefined) {
    assertConfig(Array.isArray(capabilities), 'capabilities deve essere un array');
    const embedded = (capabilities as unknown[]).find(
      (value) => isRecord(value) && value.name === 'EmbeddedKnowledge'
    );
    if (embedded !== undefined) {
      assertConfig(isRecord(embedded) && Array.isArray(embedded.files) && embedded.files.length > 0 && embedded.files.length <= 10, 'EmbeddedKnowledge richiede 1-10 file');
      for (const file of embedded.files as unknown[]) {
        assertConfig(isRecord(file) && typeof file.file === 'string' && /\.(docx?|pptx?|xlsx?|txt|pdf)$/i.test(file.file), 'File EmbeddedKnowledge non valido');
        const resolved = resolve(pkg, file.file);
        assertConfig(resolved.startsWith(resolve(pkg) + sep), 'Percorso knowledge non sicuro: ' + file.file);
        assertConfig((await stat(resolved)).size <= 1024 * 1024, 'File embedded maggiore di 1 MiB: ' + file.file);
      }
    }
  }
  return { config, path, pkg };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  validate({
    requireInit: process.argv.includes('--require-init'),
    requireProvisioned: process.argv.includes('--require-provisioned'),
  }).then((project) => {
    if (process.argv.includes('--print-path')) console.log(project.path);
    else console.log('Validation OK: ' + project.config.name + ' (' + project.config.audience.mode + ')');
  }).catch((error: unknown) => {
    console.error('Validation FAILED:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
