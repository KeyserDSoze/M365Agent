#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function assert(value, message) { if (!value) throw new Error(message); }
export async function validate({ requireInit = false, requireProvisioned = false } = {}) {
  const config = JSON.parse(await readFile(join(root, 'agent.config.json'), 'utf8'));
  assert(/^[a-z][a-z0-9-]{2,47}$/.test(config.name), 'agent.config.json: name non valido');
  if (requireInit) assert(config.name !== 'm365-agent', 'Esegui prima node init/init.mjs nome-progetto');
  const path = join(root, 'src', config.name), pkg = join(path, 'appPackage');
  const manifest = JSON.parse(await readFile(join(pkg, 'manifest.json'), 'utf8'));
  const agent = JSON.parse(await readFile(join(pkg, 'declarativeAgent.json'), 'utf8'));
  const env = await readFile(join(path, 'env', '.env.prod'), 'utf8');
  assert(manifest.id === '${{TEAMS_APP_ID}}', 'Il manifest deve riferirsi a TEAMS_APP_ID');
  assert(manifest.name.short === config.displayName && agent.name === config.displayName, 'Nomi incoerenti, riesegui init');
  const vars = Object.fromEntries(env.split(/\r?\n/).filter(x => /^[A-Z][A-Z0-9_]*=/.test(x)).map(x => { const k = x.indexOf('='); return [x.slice(0,k), x.slice(k+1)]; }));
  const idFormat = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  assert(!vars.TEAMS_APP_ID || idFormat.test(vars.TEAMS_APP_ID), 'env/.env.prod: TEAMS_APP_ID deve essere UUID');
  assert(vars.M365_TITLE_ID !== undefined, 'env/.env.prod: M365_TITLE_ID mancante');
  if (requireProvisioned) {
    assert(idFormat.test(vars.TEAMS_APP_ID || ''), 'Esegui prima il bootstrap su tenant e salva TEAMS_APP_ID');
    assert(typeof vars.M365_TITLE_ID === 'string' && vars.M365_TITLE_ID.trim().length > 3, 'Esegui prima il bootstrap e salva M365_TITLE_ID');
    assert(idFormat.test(config.tenantId || ''), 'Configura tenantId in agent.config.json');
    assert(process.env.M365_TENANT_ID?.toLowerCase() === config.tenantId.toLowerCase(), 'M365_TENANT_ID non corrisponde al tenantId del progetto');
  }
  assert(!config.tenantId || idFormat.test(config.tenantId), 'agent.config.json: tenantId deve essere un GUID o null');
  assert(env.includes('TEAMSFX_ENV=prod'), 'env/.env.prod non contiene TEAMSFX_ENV=prod');
  assert(typeof agent.instructions === 'string' && agent.instructions.trim().length >= 20, 'Istruzioni mancanti');
  const audience = config.audience;
  assert(audience && ['private', 'users', 'group', 'organization'].includes(audience.mode), 'Audience mode non valido');
  const emails = audience.emails;
  assert(Array.isArray(emails) && emails.every(x => typeof x === 'string' && /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(x)), 'Email non valide');
  assert(new Set(emails.map(x => x.toLowerCase())).size === emails.length, 'Indirizzi email duplicati');
  if (audience.mode === 'private') assert(emails.length <= 1, 'Modalità private: al massimo un destinatario');
  if (audience.mode === 'users') assert(emails.length >= 1, 'Modalità users: almeno una email');
  if (audience.mode === 'group') {
    assert(typeof audience.groupId === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(audience.groupId), 'Modalità group: groupId GUID obbligatorio');
    assert(['security', 'm365'].includes(audience.groupType), 'Modalità group: groupType security o m365');
  } else assert(!audience.groupId && !audience.groupType, 'Rimuovi groupId/groupType nelle altre modalità');
  if (['organization', 'group'].includes(audience.mode)) assert(emails.length === 0, 'Non mescolare scope organizzazione/gruppo ed email');
  assert(typeof config.publishToCatalog === 'boolean', 'publishToCatalog deve essere boolean');
  if (config.publishToCatalog) assert(['organization', 'group'].includes(audience.mode), 'Pubblicazione nel catalogo non consentita per private/users');
  const expectedScope = audience.mode === 'private' && emails.length === 0 ? 'personal' : 'shared';
  assert(vars.M365_AGENT_SCOPE === expectedScope, 'Imposta M365_AGENT_SCOPE=' + expectedScope + ' in env/.env.prod per l’audience selezionata');
  const embedded = (agent.capabilities || []).find(x => x.name === 'EmbeddedKnowledge');
  if (embedded) {
    assert(Array.isArray(embedded.files) && embedded.files.length > 0 && embedded.files.length <= 10, 'Massimo 10 file embedded');
    for (const item of embedded.files) {
      assert(typeof item.file === 'string' && /\.(docx?|pptx?|xlsx?|txt|pdf)$/i.test(item.file), 'Tipo file embedded non supportato');
      const full = resolve(pkg, item.file);
      assert(full.startsWith(resolve(pkg) + sep), 'Path knowledge non sicuro');
      assert((await stat(full)).size <= 1024 * 1024, 'File embedded maggiore di 1 MiB: ' + item.file);
    }
  }
  return { config, path, pkg };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const r = await validate({ requireInit: process.argv.includes('--require-init'), requireProvisioned: process.argv.includes('--require-provisioned') });
    if (process.argv.includes('--print-path')) console.log(r.path);
    else console.log('Validation OK: ' + r.config.name + ' (' + r.config.audience.mode + ')');
  } catch (e) { console.error('Validation FAILED: ' + e.message); process.exitCode = 1; }
}
