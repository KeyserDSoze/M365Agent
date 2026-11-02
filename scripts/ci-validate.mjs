#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {validate} from './validate.mjs';
const {path} = await validate();
const r = spawnSync('wiqd', ['agent','validate','--path',path,'--env','prod'], {stdio:'inherit',shell:process.platform==='win32'});
if (r.error) throw r.error;
process.exitCode = r.status ?? 1;
