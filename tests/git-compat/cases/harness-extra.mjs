import fs from 'node:fs';
import path from 'node:path';
import { project, json, fileHash } from '../../../scripts/git-compat/lib.mjs';
import { selectCases, loadMatrix } from '../../../scripts/git-compat/runner.mjs';
import { exerciseZipPortability } from '../infra/zip-portability.mjs';
const make=(id,title,run)=>({id,variant:'portable-and-selection',title,profile:'N0',tier:'smoke',phase:'HARNESS',productStatus:'NOT_ASSESSED',capabilities:[],timeout:60000,run});
export const cases=[
  make('HARNESS-011','Current Windows platform and object format are recorded without certifying another OS',async c=>{
    await c.init();const version=await c.git(['version','--build-options']);
    c.eq('object format probed',(await c.git(['rev-parse','--show-object-format'])).stdout.trim(),'sha1');
    c.ok('native executable absolute',path.isAbsolute(c.gitPath));
    json(path.join(c.artifactDir,'platform.json'),{platform:process.platform,arch:process.arch,node:process.version,git:version.stdout,filesystem:'Windows host filesystem; case sensitivity and links have separate cases',notCertified:['other OS','physical power loss','every filesystem']});
    return {limits:['Only the current Windows x64 subset executes; other platform/backend matrix dimensions are not inferred.']};
  }),
  make('HARNESS-012','Smoke, daily, affected, all and focused selections expose omissions',async c=>{
    const m=loadMatrix();const ids=['INDEX-001','LAYER-001','REMOTE-001','HARNESS-001'];
    const fake=ids.map((id,i)=>({id,variant:'selection-control',tier:['smoke','daily','stress','broad'][i],profile:'N0',capabilities:i===2?['loopback']:[]}));
    c.eq('smoke narrow',selectCases(fake,m,{suite:'smoke'}).map(x=>x.id),['INDEX-001']);
    c.eq('daily includes smoke',selectCases(fake,m,{suite:'daily'}).map(x=>x.id),['INDEX-001','LAYER-001']);
    c.eq('broad excludes stress',selectCases(fake,m,{suite:'broad'}).length,3);
    c.eq('all preserves stress',selectCases(fake,m,{suite:'all'}).length,4);
    c.eq('affected omits unrelated remote',selectCases(fake,m,{suite:'affected'}).map(x=>x.id),['INDEX-001','LAYER-001','HARNESS-001']);
    c.eq('combined selection',selectCases(fake,m,{suite:'all',id:'REMOTE-001',capability:'loopback'}).length,1);
    c.eq('empty intersection visible',selectCases(fake,m,{suite:'smoke',family:'REMOTE'}).length,0);
    json(path.join(c.artifactDir,'selection-control.json'),{fake,note:'Selection unit control only. Actual smoke/amplo/stress process outcomes are separate runs.'});
  }),
  make('HARNESS-020','Output ZIP is reopened under another root and hashes/relative links remain valid',async c=>{
    return exerciseZipPortability(c);
  }),
  make('HARNESS-021','Instruction history and critical requirement links are preserved',async c=>{
    const agents=fs.readFileSync(path.join(project,'AGENTS.md'),'utf8');
    const history=fs.readFileSync(path.join(project,'docs/git-compat/history/REVISAO-AGENTS-v2.md'),'utf8');
    const paths=[];
    for(const match of agents.matchAll(/\]\(([^)]+)\)/g)){const rel=match[1].split('#')[0];if(!rel||/^[a-z]+:/i.test(rel))continue;paths.push(rel);c.eq('AGENTS link '+rel,fs.existsSync(path.resolve(project,rel)),true);}
    const authorityFile='docs/decisions/2026-11-02-closure.md', authority=fs.readFileSync(path.join(project,authorityFile),'utf8'), currentScope=agents.split('Na preparação')[0];
    c.ok('Historical restrictions remain explicitly scoped to older rounds', /restrição pertence à rodada histórica/u.test(agents) && /não é uma proibição permanente/u.test(agents));
    c.ok('Current authorization overrides prior publication prohibition', /permite[^.]*commits[^.]*push/u.test(currentScope) && /substitui[^.]*proibição[^.]*publicação/u.test(currentScope));
    c.ok('Current scope points to preserved authorization source', paths.includes(authorityFile));
    c.ok('Current task source expressly authorizes project publication', /Estão autorizados commits, fetch, push e a integração/u.test(authority));
    c.ok('future engineering autonomy explicit',agents.includes('Em tarefa futura'));
    c.ok('real Git preservation explicit',agents.includes('Use objetos, refs e índices do Git real'));
    c.ok('history explains reasons',history.length>1000);
    json(path.join(c.artifactDir,'instruction-proof.json'),{links:paths,currentAuthority:authorityFile,currentAuthoritySha256:fileHash(path.join(project,authorityFile)),historySha256:fileHash(path.join(project,'docs/git-compat/history/REVISAO-AGENTS-v2.md')),note:'Text/links checked; product behavior is not certified by prose.'});
  }),
  make('MODEL-011','Behavior oracle accepts index stat refresh and rejects actual byte changes',async c=>{
    await c.init();const observe=async()=>({head:(await c.git(['rev-parse','HEAD'])).stdout.trim(),index:(await c.git(['ls-files','--stage','-z'])).stdout,bytes:c.read('base.txt')});
    const before=await observe();await c.git(['update-index','--refresh']);const refreshed=await observe();c.eq('semantic equivalence after stat refresh',refreshed,before);
    c.write('base.txt','actually different\n');const changed=await observe();c.ok('byte divergence detected independently',JSON.stringify(changed)!==JSON.stringify(before));c.eq('index still earlier content',(await c.git(['show',':base.txt'])).stdout,'base one\n');
    return {limits:['Observer control on real Git/filesystem; does not implement a second product or prove all future ownership algorithms equivalent.']};
  }),
];
