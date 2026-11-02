import { spawnSync } from 'node:child_process';
import { access, chmod, mkdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

interface GitResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

function git(cwd: string, args: string[]): GitResult {
  const result = spawnSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    windowsHide: true,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    ...(result.error ? { error: result.error } : {}),
  };
}

function lines(output: string): string[] {
  return output.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
}

/** Match only the ORIGINAL template repository, not the user's new project. */
export function isBoilerplateRemote(url: string): boolean {
  return /^(?:https?:\/\/github\.com\/|ssh:\/\/git@github\.com\/|git@github\.com:|git:\/\/github\.com\/)(?:KeyserDSoze\/M365Agent)(?:\.git)?\/?$/i.test(url.trim());
}

function urlsForRemote(cwd: string, remote: string, kind: 'url' | 'pushurl'): string[] {
  const result = git(cwd, ['config', '--get-all', 'remote.' + remote + '.' + kind]);
  if (result.status === 1) return []; // Git returns 1 when no value is configured.
  if (result.error || result.status !== 0) {
    throw new Error('Impossibile leggere il remote Git ' + remote);
  }
  return lines(result.stdout);
}

/**
 * Disconnect only template GitHub remotes. If a project's own origin is already
 * configured (e.g. created using GitHub "Use this template"), leave it intact.
 */
export async function configureProjectGit(root: string): Promise<void> {
  const topLevel = git(root, ['rev-parse', '--show-toplevel']);
  if (topLevel.error || topLevel.status !== 0) {
    console.log('Git: nessuna repository locale trovata; inizializzazione progetto completata senza modificare remote.');
    return;
  }
  const actualRoot = await realpath(topLevel.stdout.trim());
  const expectedRoot = await realpath(root);
  if (process.platform === 'win32'
    ? actualRoot.toLowerCase() !== expectedRoot.toLowerCase()
    : actualRoot !== expectedRoot) {
    console.log('Git: repository padre rilevata; remote e hook non modificati per sicurezza.');
    return;
  }

  const originalRemotes = lines(git(root, ['remote']).stdout);
  for (const remote of originalRemotes) {
    const fetch = urlsForRemote(root, remote, 'url');
    const push = urlsForRemote(root, remote, 'pushurl');
    if (fetch.length === 0 || !fetch.every(isBoilerplateRemote) || !push.every(isBoilerplateRemote)) {
      continue;
    }
    const removed = git(root, ['remote', 'remove', remote]);
    if (removed.error || removed.status !== 0) {
      throw new Error('Impossibile rimuovere il remote template ' + remote + ': ' + removed.stderr.trim());
    }
    console.log('Git: remote "' + remote + '" del boilerplate originale rimosso.');
  }

  const remaining = lines(git(root, ['remote']).stdout);
  if (remaining.length > 0) {
    console.log('Git: remote del progetto già presente (' + remaining.join(', ') + '); preservato.');
    return;
  }

  console.log('Git: nessun remote configurato. Per collegare il nuovo repository:');
  console.log('  git remote add origin <URL-DEL-TUO-REPOSITORY>');
  console.log('  git push -u origin HEAD');

  const hooksPath = git(root, ['config', '--get', 'core.hooksPath']);
  if (hooksPath.status === 0 && hooksPath.stdout.trim() !== '') {
    console.log('Git: core.hooksPath personalizzato; non modifico hook esistenti. Usa i comandi sopra.');
    return;
  }
  const gitHookPath = git(root, ['rev-parse', '--git-path', 'hooks/post-commit']);
  if (gitHookPath.error || gitHookPath.status !== 0 || !gitHookPath.stdout.trim()) {
    console.log('Git: impossibile localizzare hooks/post-commit; usa i comandi sopra.');
    return;
  }

  const path = resolve(root, gitHookPath.stdout.trim());
  try {
    await access(path);
    console.log('Git: hook post-commit già presente, lasciato invariato. Usa i comandi sopra.');
    return;
  } catch (error: unknown) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }

  // Local-only Git hook. Git for Windows supplies /bin/sh for POSIX Git hooks.
  // It warns after a commit (without preventing it) until the user sets a remote.
  const hook = [
    '#!/bin/sh',
    '# M365Agent init: hint for an unlinked repository; do not block commits.',
    'if [ -z "$(git remote)" ]; then',
    '  printf "\\n[Git] Nessun remote configurato per il nuovo progetto.\\n"',
    "  printf '%s\\n' '  git remote add origin <URL-DEL-TUO-REPOSITORY>' '  git push -u origin HEAD'",
    'fi',
    '',
  ].join('\n');

  await mkdir(dirname(path), { recursive: true });
  // Exclusive flag prevents overwriting hooks installed by other tooling.
  await writeFile(path, hook, { flag: 'wx', mode: 0o755 });
  await chmod(path, 0o755);
  console.log('Git: installato un avviso locale post-commit finché non configuri il remote.');
}
