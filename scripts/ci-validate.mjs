#!/usr/bin/env node
// Agents Toolkit: convalida offline su runner GitHub, senza EULA WIQD e senza login al tenant.
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validate } from './validate.mjs';
const {path} = await validate();
const envPath = join(path,'env','.env.prod');
const old = await readFile(envPath,'utf8');
try {
  // Bootstrap template ha TEAMS_APP_ID vuoto: forniamo un GUID di test solo sul runner.
  const simulated = old.replace(/^TEAMS_APP_ID=$/m,'TEAMS_APP_ID=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  await writeFile(envPath,simulated);
  const r=spawnSync('atk',['validate','--env','prod','--folder',path,'--interactive','false'],{
    stdio:'inherit',shell:process.platform==='win32'
  });
  if(r.error)throw r.error;
  process.exitCode=r.status??1;
}finally{
  // Non salvare ID simulati nel repository o negli artifact
  await writeFile(envPath,old);
}
