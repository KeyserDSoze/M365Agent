import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const relative=['init','scripts','agent.config.json','src'];
async function fixture(){
 const dir=await mkdtemp(join(tmpdir(),'m365agent-'));
 for(const rel of relative)await cp(join(root,rel),join(dir,rel),{recursive:true});
 return dir;
}
function invoke(cwd,command,args){
 return spawnSync(process.execPath,[join(cwd,command),...args],{cwd,encoding:'utf8'});
}
test('cross-platform init and validation, no accidental second initialization',async()=>{
 const dir=await fixture();
 try{
  const a=invoke(dir,'init/init.mjs',['test-project','--display-name','Test Project']);
  assert.equal(a.status,0,a.stderr);
  assert.equal((await stat(join(dir,'src/test-project/appPackage/manifest.json'))).isFile(),true);
  const c=JSON.parse(await readFile(join(dir,'agent.config.json'),'utf8'));
  assert.equal(c.name,'test-project');
  assert.equal(invoke(dir,'scripts/validate.mjs',[]).status,0);
  assert.notEqual(invoke(dir,'init/init.mjs',['again']).status,0);
  const env=await readFile(join(dir,'src/test-project/env/.env.prod'),'utf8');
  assert.match(env,/M365_TITLE_ID=\n/);
  assert.match(env,/M365_AGENT_SCOPE=personal/);
  const configPath=join(dir,'agent.config.json'),envPath=join(dir,'src/test-project/env/.env.prod');
  for(const [mode,emails,groupId,groupType,scope] of [
   ['users',['foo@contoso.com'],null,null,'shared'],
   ['private',['only@contoso.com'],null,null,'shared'],
   ['group',[],'00000000-0000-0000-0000-000000000123','security','shared'],
   ['organization',[],null,null,'shared']]){
    c.audience={mode,emails,groupId,groupType};
    await writeFile(configPath,JSON.stringify(c));
    await writeFile(envPath,env.replace('M365_AGENT_SCOPE=personal','M365_AGENT_SCOPE='+scope));
    assert.equal(invoke(dir,'scripts/validate.mjs',[]).status,0,mode);
   }
  c.audience={mode:'private',emails:['a@contoso.com','b@contoso.com'],groupId:null,groupType:null};
  await writeFile(configPath,JSON.stringify(c));
  await writeFile(envPath,env);
  assert.notEqual(invoke(dir,'scripts/validate.mjs',[]).status,0,'private audience must reject two users');
 }finally{await rm(dir,{recursive:true,force:true});}
});
