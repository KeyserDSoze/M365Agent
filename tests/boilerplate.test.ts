import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, rm, stat, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureFiles = ['init', 'scripts', 'types', 'src', 'agent.config.json', 'package.json'];

async function fixture(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'm365agent-'));
  for (const relative of fixtureFiles) {
    await cp(join(root, relative), join(dir, relative), { recursive: true });
  }
  return dir;
}

function invoke(cwd: string, command: string, args: string[] = []) {
  return spawnSync(process.execPath, [join(cwd, command), ...args], { cwd, encoding: 'utf8' });
}

test('init TS is cross-platform, updates manifests and cannot run twice', async () => {
  const dir = await fixture();
  try {
    const result = invoke(dir, 'init/init.ts', ['test-project', '--display-name', 'Test Project']);
    assert.equal(result.status, 0, result.stderr);
    const config = JSON.parse(await readFile(join(dir, 'agent.config.json'), 'utf8')) as { name: string; displayName: string };
    assert.equal(config.name, 'test-project');
    assert.equal(config.displayName, 'Test Project');
    const manifest = JSON.parse(await readFile(join(dir, 'src/test-project/appPackage/manifest.json'), 'utf8')) as { name: { short: string } };
    assert.equal(manifest.name.short, 'Test Project');
    assert.ok((await stat(join(dir, 'src/test-project/appPackage/declarativeAgent.json'))).isFile());
    const env = await readFile(join(dir, 'src/test-project/env/.env.prod'), 'utf8');
    assert.match(env, /^M365_TITLE_ID=$/m);
    assert.match(env, /^TEAMS_APP_ID=$/m);
    assert.equal(invoke(dir, 'scripts/validate.ts').status, 0);
    assert.notEqual(invoke(dir, 'init/init.ts', ['another-project']).status, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('audience variants and scope are validated, invalid combinations are rejected', async () => {
  const dir = await fixture();
  try {
    assert.equal(invoke(dir, 'init/init.ts', ['test-project']).status, 0);
    const configPath = join(dir, 'agent.config.json');
    const envPath = join(dir, 'src/test-project/env/.env.prod');
    const config = JSON.parse(await readFile(configPath, 'utf8')) as {
      audience: { mode: string; emails: string[]; groupId: string | null; groupType: string | null };
    };
    const original = await readFile(envPath, 'utf8');
    const cases = [
      { mode: 'private', emails: [], groupId: null, groupType: null, scope: 'personal' },
      { mode: 'private', emails: ['single@contoso.com'], groupId: null, groupType: null, scope: 'shared' },
      { mode: 'users', emails: ['a@contoso.com', 'b@contoso.com'], groupId: null, groupType: null, scope: 'shared' },
      { mode: 'group', emails: [], groupId: '00000000-0000-0000-0000-000000000123', groupType: 'security', scope: 'shared' },
      { mode: 'group', emails: [], groupId: '00000000-0000-0000-0000-000000000123', groupType: 'm365', scope: 'shared' },
      { mode: 'organization', emails: [], groupId: null, groupType: null, scope: 'shared' },
    ];
    for (const item of cases) {
      config.audience = { mode: item.mode, emails: item.emails, groupId: item.groupId, groupType: item.groupType };
      await writeFile(configPath, JSON.stringify(config));
      await writeFile(envPath, original.replace('M365_AGENT_SCOPE=personal', 'M365_AGENT_SCOPE=' + item.scope));
      const result = invoke(dir, 'scripts/validate.ts');
      assert.equal(result.status, 0, item.mode + ': ' + result.stderr);
    }
    config.audience = { mode: 'private', emails: ['a@contoso.com', 'b@contoso.com'], groupId: null, groupType: null };
    await writeFile(configPath, JSON.stringify(config));
    await writeFile(envPath, original);
    assert.notEqual(invoke(dir, 'scripts/validate.ts').status, 0, 'private must reject multiple users');
    config.audience = { mode: 'users', emails: ['a@contoso.com'], groupId: null, groupType: null };
    await writeFile(configPath, JSON.stringify(config));
    assert.notEqual(invoke(dir, 'scripts/validate.ts').status, 0, 'scope must match audience');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('prod preflight requires provisioned IDs and tenant binding', async () => {
  const dir = await fixture();
  try {
    assert.equal(invoke(dir, 'init/init.ts', ['test-project']).status, 0);
    assert.notEqual(invoke(dir, 'scripts/validate.ts', ['--require-provisioned']).status, 0);
    const configPath = join(dir, 'agent.config.json');
    const envPath = join(dir, 'src/test-project/env/.env.prod');
    const config = JSON.parse(await readFile(configPath, 'utf8')) as { tenantId: string | null };
    config.tenantId = '00000000-0000-0000-0000-000000000789';
    await writeFile(configPath, JSON.stringify(config));
    let env = await readFile(envPath, 'utf8');
    env = env.replace('TEAMS_APP_ID=', 'TEAMS_APP_ID=00000000-0000-0000-0000-000000000456');
    env = env.replace('M365_TITLE_ID=', 'M365_TITLE_ID=title-001');
    await writeFile(envPath, env);
    const mismatch = spawnSync(process.execPath, [join(dir, 'scripts/validate.ts'), '--require-provisioned'], {
      cwd: dir, encoding: 'utf8', env: { ...process.env, M365_TENANT_ID: '00000000-0000-0000-0000-000000000111' }
    });
    assert.notEqual(mismatch.status, 0);
    const matched = spawnSync(process.execPath, [join(dir, 'scripts/validate.ts'), '--require-provisioned'], {
      cwd: dir, encoding: 'utf8', env: { ...process.env, M365_TENANT_ID: config.tenantId }
    });
    assert.equal(matched.status, 0, matched.stderr);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('reject knowledge files that escape the package directory', async () => {
  const dir = await fixture();
  try {
    assert.equal(invoke(dir, 'init/init.ts', ['test-project']).status, 0);
    const file = join(dir, 'src/test-project/appPackage/declarativeAgent.json');
    const agent = JSON.parse(await readFile(file, 'utf8')) as { capabilities: unknown[] };
    agent.capabilities = [{ name: 'EmbeddedKnowledge', files: [{ file: '../../out.txt' }] }];
    await writeFile(file, JSON.stringify(agent));
    await mkdir(join(dir, 'src/test-project'), { recursive: true });
    assert.notEqual(invoke(dir, 'scripts/validate.ts').status, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
