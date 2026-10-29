import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {execFileSync} from 'node:child_process';
const root=process.cwd(), out=path.join(root,'tmp/synethos-deploy/stage');
if(fs.existsSync(out)) throw new Error('Staging directory already exists');
fs.mkdirSync(out,{recursive:true});
const copy=(p)=>{const dest=path.join(out,p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.cpSync(path.join(root,p),dest,{recursive:true});};
for(const p of ['sveltekit/build','sveltekit/package.json','sveltekit/package-lock.json','config/mosaic.json','knowledge/sources.json'])copy(p);
const manifest=JSON.parse(fs.readFileSync('knowledge/sources.json','utf8'));
for(const source of manifest.sources){const p=path.posix.join('knowledge',source.file);if(!p.startsWith('knowledge/')||p.includes('../'))throw new Error('Invalid approved source');copy(p)}
const config=JSON.parse(fs.readFileSync('config/mosaic.json','utf8'));
const index='indexes/provider=gemini/model=gemini-embedding-2/dimensions=768/input=v2/30886679a306cf2ee9a3cd10532e6a7cfb5549f85baf3f595f672c9273e4b150.json';
copy(index);

const files=[];
function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else{const bytes=fs.readFileSync(p);if(secrets.some(s=>bytes.includes(s)))throw new Error('Secret detected in deployment artifact');files.push({path:path.relative(out,p).replaceAll('\\','/'),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')})}}}
walk(out);
const report={release:'20261022-033e02f-01',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:'24.22.1',sources:manifest.sources.length,indexFingerprint:JSON.parse(fs.readFileSync(index)).fingerprint,files,totalBytes:files.reduce((n,f)=>n+f.bytes,0)};
fs.writeFileSync(path.join(out,'release-manifest.json'),JSON.stringify(report,null,2));
fs.writeFileSync('tmp/synethos-deploy/release-manifest.json',JSON.stringify(report,null,2));
