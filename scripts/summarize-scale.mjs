import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i++) {
  assert(['--input', '--out', '--ablation-input', '--baseline-1000-input', '--final-input'].includes(args[i]) && options[args[i]] === undefined && args[i + 1], 'Usage: node scripts/summarize-scale.mjs --input EXTERNAL_BENCHMARK_ROOT --out REPORT_DIRECTORY [--ablation-input ROOT] [--baseline-1000-input ROOT] [--final-input ROOT]');
  options[args[i]] = args[++i];
}
assert(options['--input'] && options['--out']);
const input = path.resolve(options['--input']), output = path.resolve(options['--out']);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const rawReceipts = (directory, names) => names.filter(name => fs.existsSync(path.join(directory, name))).map(name => {
  const bytes = fs.readFileSync(path.join(directory, name));
  return { path: name, bytes: bytes.length, sha256: sha(bytes) };
});
// Aggregate spawn counts above use the original observations. Public evidence
// needs those facts, never the machine's actual numeric process identifiers.
function redactProcessIdentifiers(value) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(redactProcessIdentifiers); return; }
  for (const key of Object.keys(value)) {
    if (/^(?:pid|ppid|processId|parentProcessId)$/iu.test(key)) {
      const obtained = Number.isInteger(value[key]);
      const flag = key === 'pid' ? 'pidObtained' : key + 'Obtained';
      if (Object.hasOwn(value, flag)) assert.equal(value[flag], obtained, 'Conflicting process observation');
      value[flag] = obtained; delete value[key];
    } else redactProcessIdentifiers(value[key]);
  }
}
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/u, ''));
const lines = file => fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
const ids = ['layers1-files10', 'layers1-files100', 'layers1-files1000', 'layers1-files10000', 'layers1-file100MiB', 'layers1-files3x32MiB', 'layers5-files100', 'layers10-files100'];
const phases = [ ['baseline', input, 'baseline'], ['final', options['--final-input'] ? path.resolve(options['--final-input']) : input, 'current'], ...(options['--ablation-input'] ? [['journal-only', path.resolve(options['--ablation-input']), 'current']] : []) ];
const median = values => { const sorted = [...values].sort((a,b) => a-b); return sorted.length % 2 ? sorted[(sorted.length-1)/2] : (sorted[sorted.length/2-1] + sorted[sorted.length/2])/2; };
function getPhase(label, root, name) {
  const dir = path.join(root, name), configFile = path.join(dir, 'config.json');
  if (!fs.existsSync(configFile)) return { label, status: 'NOT_RUN', cases: [] };
  const config = read(configFile);
  const metadata = { revision: config.revision, observerVersion:config.observerVersion??'scale-initial-v1', sourceFingerprint: config.sourceFingerprint, inputs: config.inputs, platform: config.platform, compilerVersion:config.compilerVersion??null, runnerSha256: config.runnerSha256, runnerDependencies: config.runnerDependencies, methodology: config.methodology, startedAt: config.createdAt };
  const events=lines(path.join(dir,'events.jsonl'));
  const cases = ids.map(id => {
    const folder = path.join(dir, id), resultFile = path.join(folder, 'result.json'), processFile = path.join(folder, 'process.json');
    if (!fs.existsSync(folder)) return { id, status: 'NOT_RUN', samples: [] };
    const process = fs.existsSync(processFile) ? read(processFile) : null;
    let result = fs.existsSync(resultFile) ? read(resultFile) : null;
    let samples = result?.samples ?? lines(path.join(folder, 'samples.jsonl'));
    let serialized = JSON.stringify({ ...result, samples });
    const templateArg = result?.nativeObserverCommands?.flatMap(command => command.args).find(arg => arg.startsWith('--template='));
    const fixtureRoot = templateArg ? path.dirname(templateArg.slice('--template='.length)) : null;
    if (fixtureRoot) serialized = serialized.replaceAll(JSON.stringify(fixtureRoot).slice(1,-1), '<FIXTURE>');
    result = JSON.parse(serialized);
    result.samples = result.samples.map(sample => ({ ...sample, git: { ...sample.git, directSpawnAttempts: sample.gitEntries.length, directProcessesWithPid: sample.gitEntries.filter(entry => Number.isInteger(entry.pid)).length, failedWithoutPid: sample.gitEntries.filter(entry => !Number.isInteger(entry.pid)).length, descendantsObserved: false } }));
    const status = process?.timedOut ? 'TIMEOUT' : result.status === 'PASS' && process?.code === 0 && !process?.signal && !process?.outputTruncated ? 'PASS' : result.status === 'FAIL' ? 'FAIL' : process ? 'INCOMPLETE' : 'RUNNING';
    const sampleRows=result.samples;delete result.samples;const invocation=events.filter(event=>event.kind==='INVOCATION'&&event.selected.includes(id)).at(-1),completion=events.filter(event=>event.kind==='CASE_COMPLETED'&&event.scenario===id).at(-1);const timeoutInventory=path.join(folder,'post-timeout-inventory.json');return { id, status, process, workerStartedAt:fs.existsSync(path.join(folder,'started.json'))?read(path.join(folder,'started.json')).startedAt:null, configuredInvocationBudgetMs:invocation?.budgetMs??null, completedAt:completion?.at??null, operationStarts: lines(path.join(folder, 'operation-starts.jsonl')), operationProofs:lines(path.join(folder,'operation-proofs.jsonl')), postTimeoutInventory:fs.existsSync(timeoutInventory)?read(timeoutInventory):null, result, samples: sampleRows, privateRawEvidence: rawReceipts(folder, ['result.json', 'process.json', 'samples.jsonl', 'started.json', 'operation-starts.jsonl', 'operation-proofs.jsonl', 'post-timeout-inventory.json']) };
  });
  return { label, metadata, cases, privateRawEvidence: rawReceipts(dir, ['config.json', 'events.jsonl']) };
}
const receiptFile=path.join(path.dirname(input),'environment-receipt.json');
const volumeReceiptFile=path.join(output,'PUBLICATION-FOCUSED.json');
const volumeSupplement=fs.existsSync(volumeReceiptFile)?{path:'PUBLICATION-FOCUSED.json',sha256:sha(fs.readFileSync(volumeReceiptFile)),volume:read(volumeReceiptFile).volume}:null;
const allocationProbeFile=path.join(path.dirname(input),'ALLOCATION-PROBE-FINAL.json');
const allocationProbe=fs.existsSync(allocationProbeFile)?read(allocationProbeFile):null;
const data = { schema: 1, allocationProbe, volumeSupplement, environmentReceipt:fs.existsSync(receiptFile)?read(receiptFile):null, generatedAt: new Date().toISOString(), baselineCommit: 'e8f2e3feba87224246a42337f77f702914df989e', reportGeneratorSha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))), compilerVersionObservedDuringCampaign: 'esbuild 0.28.2', phases: phases.map(args => getPhase(...args)), limitations: [
  'Complete Core API calls; no CLI startup. Source and observer bundle frozen per phase. Older v1 baseline and current observer differ only in observation (tip classification, compiler provenance, per operation native Git proofs, endpoint allocated file data, final 1000 n3). Controlled primary 1000 baseline uses the same current observer as final.',
  'First activation includes first registration and is one observation per case. Reactivation is extraction again; no projection cache exists.',
  'Baseline 10/100 reactivation/off use n3; baseline1000,10k,large,multi-layer n1. Final 10/100/1000 use n3 where completed; first activation remains n1. No p95 or statistical significance is claimed.',
  'Fixed baseline-then-final order, filesystem warm after setup, no OS cache eviction, and unmeasured host load limit causal attribution.',
  'Filesystem observers count known successful bytes at JavaScript FileHandle/filesystem boundaries, including repeated journal writes; not physical device IO.',
  'Native fs.copyFile returns void: its byte counter remains 0 (unknown payload), even on success. Git checkout-index IO is outside the JS filesystem observer. These zeros never prove absence of copies.',
  'Directory fsync attempts and failures remain separate. Windows can reject directory flush; file flush success does not establish power-loss durability of all names.',
  'Method phases are inclusive and overlap; do not add phase durations. Hash validation is included in materialize/diskSnapshot/copy/publish and IO calls, with no exclusive CPU timer.',
  'Worker RSS sampled every 10 ms omits shorter peaks and child Git RSS; includes harness/oracle allocations. Endpoint logical and OS-reported file-data allocated bytes are separate; neither is peak disk or full physical volume cost.',
  'Git spawn attempts, children with PID, and failures without PID are separated; descendants of Git/wrappers are unobserved.',
  'Benchmark DriveInfo observed C: NTFS; its earlier Get-Volume/fsutil probes were denied. A later independent campaign Get-Volume receipt (PUBLICATION-FOCUSED.json) confirmed 4096-byte allocation units. Current observer measures endpoint OS-reported file-data allocation via blocks*512; v1 endpoints remain NOT_MEASURED; unique extents/full volume cost remain unmeasured.',
  'Timeout/incomplete endpoints retain samples without claiming complete activation or a comparative speedup. Fixtures for failures are retained externally.',
  'Performance PASS includes independent Git/physical state oracles in the harness; functional certification comes from separate adversarial/regression suites.'
] };
data.primaryOverrides=[];data.supplementaryCampaigns=[];
if(options['--baseline-1000-input']){
  const replacement=getPhase('baseline-v2-1000',path.resolve(options['--baseline-1000-input']),'baseline'),primary=data.phases.find(p=>p.label==='baseline'),current=data.phases.find(p=>p.label==='final');
  const next=replacement.cases.find(c=>c.id==='layers1-files1000'),previous=primary.cases.find(c=>c.id==='layers1-files1000');
  assert.equal(next?.status,'PASS','A primary baseline override must be a complete passing case');assert.equal(replacement.metadata.sourceFingerprint,primary.metadata.sourceFingerprint,'Primary override must measure the exact same frozen baseline Core');assert.equal(replacement.metadata.revision,data.baselineCommit,'Override baseline commit mismatch');
  for(const name of ['off','on-reactivation-no-cache'])assert.equal(next.samples.filter(sample=>sample.operation===name).length,3,'Primary1000 override requires n3');
  if(current.metadata){assert.equal(replacement.metadata.runnerSha256,current.metadata.runnerSha256,'Primary1000 baseline and final must use the same observer');assert.deepEqual(replacement.metadata.platform,current.metadata.platform,'Primary1000 baseline and final require equivalent recorded environment');}
  data.supplementaryCampaigns.push({label:'baseline-v1-1000-observation-only',metadata:primary.metadata,cases:[previous],reason:'Original n1 retained separately; not pooled with primary n3.'});
  const provenance={label:'baseline-v2-1000',caseId:next.id,metadata:replacement.metadata,reason:'Coordinated new n3 baseline using the same current observer/peroperation proofs as final; v1 n1 kept supplementary.'};
  primary.cases=primary.cases.map(c=>c.id===next.id?{...next,primaryProvenance:provenance}:c);data.primaryOverrides.push(provenance);
  data.limitations=data.limitations.map(value=>value.startsWith('Baseline 10/100')?'Baseline 10/100 reactivation/off n3; primary1000 baseline v2 n3 and final1000 n3 where completed. Earlier v1 n1 is supplementary, never pooled. First activation and large/multilayer cases remain n1; no p95 or statistical significance.':value);
}
const baseline = data.phases.find(p => p.label === 'baseline'), final = data.phases.find(p => p.label === 'final');
const operations = ['first-on-register-layer0', 'first-on-allLayers-sum-API', 'on-reactivation-no-cache', 'off', 'on-already-active', 'off-dirty-refusal', 'recover-empty'];
const privacyAudit=value=>{if(typeof value==='string'){assert(!/(?:(?<![A-Za-z])[A-Za-z]:[\\/]+[A-Za-z0-9_]|\/(?:Users|home|tmp|var\/tmp)\/|gl-perf-(?:baseline|current)-|rabrunos|AppData)/iu.test(value),'Private host/fixture path remains in public data');return;}if(Array.isArray(value)){value.forEach(privacyAudit);return;}if(value&&typeof value==='object')Object.values(value).forEach(privacyAudit);};
const operationRows=(c,operation)=>{if(operation!=='first-on-allLayers-sum-API')return c?.samples.filter(s=>s.operation===operation)??[];const rows=c?.samples.filter(s=>s.operation.startsWith('first-on-register-layer'))??[];if(!c?.result?.scenario?.layers||rows.length!==c.result.scenario.layers)return [];return [{durationMs:rows.reduce((sum,row)=>sum+row.durationMs,0)}];};
const rows = [];
for (const id of ids) for (const operation of operations) {
  if(operation==='first-on-allLayers-sum-API'&&!['layers5-files100','layers10-files100'].includes(id))continue;
  const before = baseline.cases.find(c => c.id === id), after = final.cases.find(c => c.id === id);
  const a=operationRows(before,operation),b=operationRows(after,operation);
  const paired = before?.status === 'PASS' && after?.status === 'PASS' && a.length && b.length;
  const first = a.length ? median(a.map(s => s.durationMs)) : null, last = b.length ? median(b.map(s => s.durationMs)) : null;
  rows.push({ id, operation, baseline: first === null ? null : { n: a.length, medianMs: a.length>1?first:null, observedMs:first,minMs:Math.min(...a.map(s=>s.durationMs)),maxMs:Math.max(...a.map(s=>s.durationMs)) }, final:last===null?null:{n:b.length,medianMs:b.length>1?last:null,observedMs:last,minMs:Math.min(...b.map(s=>s.durationMs)),maxMs:Math.max(...b.map(s=>s.durationMs))}, deltaMs:paired?last-first:null, deltaPercent:paired?(last-first)*100/first:null, state:paired?(a.length===1||b.length===1?'SINGLE_OBSERVATION':'N3_OBSERVED_COMPARISON'):'NOT_COMPARABLE' });
}
data.comparisons = rows;
redactProcessIdentifiers(data);
data.privacyProjection = { actualProcessIdentifiersPublished: false, processPresence: 'pidObtained booleans; aggregate spawn/attempt/error counts computed before redaction', rawEvidence: 'Unmodified private files identified by relative name, byte count and SHA-256; not public attachments' };
privacyAudit(data);
const number = value => value === null || value === undefined ? '—' : value.toFixed(3);
let markdown = '# Benchmarks — Etapa 2B\n\n';
markdown += 'Baseline congelada: `'+data.baselineCommit+'`. Operações completas do Core, em Windows x64, Node 24.14.1/Git2.53.0.windows.2. Não inclui startup da CLI. Todos os tempos abaixo são milissegundos absolutos; Δ negativo indica menor tempo observado.\n\n';
markdown += 'A projeção pública registra pidObtained e contagens agregadas, sem IDs reais de processos. Os arquivos brutos privados permanecem intactos, com tamanhos e hashes identificados no JSON. Os ciclos n3 repetem on/off na mesma fixture, com histórico retido e filesystem aquecido; não são três fixtures independentes nem prova de estabilidade estatística.\n\n';
if(data.primaryOverrides.length)markdown += 'A baseline principal de mil arquivos usa nova campanha controlada n3, com o mesmo observador do final. A observa\u00e7\u00e3o v1 n1 permanece em supplementaryCampaigns no JSON e n\u00e3o entra nas compara\u00e7\u00f5es principais.\n\n';
markdown += '| Cenário | Operação | Antes ms(n) | Final ms(n) | Δ ms | Δ % | Qualificação |\n| --- | --- | ---: | ---: | ---: | ---: | --- |\n';
for (const row of rows) markdown += '| '+[row.id,row.operation,row.baseline?number(row.baseline.observedMs)+'('+row.baseline.n+')':'—',row.final?number(row.final.observedMs)+'('+row.final.n+')':'—',number(row.deltaMs),number(row.deltaPercent),row.state].join(' | ')+' |\n';
markdown += '\n## Journals e disco\n\nContagens são observações nos handles do Core instrumentado. Bytes regravados não são espaço adicional retido nem bytes físicos de IO. As durações incluem o custo de observação em ambos os endpoints.\n\n| Fonte/cenário | Operação/amostra | Journal escrito B | Flush de arquivo journal OK/tentativas | Journal lido B | Persist inclusivo ms |\n| --- | --- | ---: | ---: | ---: | ---: |\n';
for (const phase of data.phases) for (const c of phase.cases) for (const sample of c.samples.filter(s=>['first-on-register-layer0','on-reactivation-no-cache','off'].includes(s.operation))) {
  const stats = (suffix, field) => Object.entries(sample.io??{}).filter(([key])=>key.startsWith('journal.')&&suffix.some(s=>key.endsWith(s))).reduce((sum,[,entry])=>sum+(entry[field]??0),0);
  markdown += '| '+[phase.label+'/'+c.id,sample.operation+'/'+sample.sample,stats(['.writeFile','.appendFile','.write','.writev'],'bytes'),stats(['.sync','.datasync'],'successes')+'/'+stats(['.sync','.datasync'],'attempts'),stats(['.read','.readFile'],'bytes'),number(sample.phases['transaction.persist']?.durationMs)].join(' | ')+' |\n';
}
markdown += '\n| Fonte/cenário | Setup ms | Disco lógico final B | Backups B | Journals B | Materialized B | Validation indexes B | Initialization indexes B | Private indexes B | Status |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |\n';
for (const phase of data.phases) for (const c of phase.cases) markdown += '| '+[phase.label+'/'+c.id,number(c.result?.setupMs),c.result?.finalFixtureLogicalBytes??'—',c.result?.finalStorage?.backups??'—',c.result?.finalStorage?.journals??'—',c.result?.finalStorage?.materialized??'—',c.result?.finalStorage?.validationIndexes??'—',c.result?.finalStorage?.initializationIndexes??'—',c.result?.finalStorage?.privateIndexes??'—',c.status].join(' | ')+' |\n';
markdown += '\n## Dados de arquivo alocados no endpoint\n\nA vers\u00e3o atual usa lstat BigInt e soma blocks\u00d7512, deduplicando dev:ino. O libuv 1.51 converte AllocationSize para blocos de 512 bytes; o Node24.14.1 encaminha esse campo. Isto observa aloca\u00e7\u00e3o de dados de arquivos, fora dos rel\u00f3gios das APIs. Exclui diret\u00f3rios, MFT/metadados, ADS, extents CoW compartilhados, IO do dispositivo e picos. Blksize n\u00e3o define a unidade de blocks nem prova clusters. [libuv1.51 fonte](https://github.com/libuv/libuv/blob/v1.51.0/src/win/fs.c#L1772), [Node fonte](https://github.com/nodejs/node/blob/v24.14.1/src/node_file-inl.h#L97).\n\n| Fonte/cen\u00e1rio | Estado | Repo dados alocados B | Journals B | Backups B | Materialized B | Validation indexes B | Initialization indexes B | Private indexes B | Aliases dedup |\n| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n';
for(const phase of data.phases)for(const c of phase.cases){const a=c.result?.finalAllocatedStorage;markdown += '| '+[phase.label+'/'+c.id,c.result?.fileDataAllocation?.status??'NOT_MEASURED',c.result?.repoFileDataAllocatedBytes??'\u2014',a?.journals??'\u2014',a?.backups??'\u2014',a?.materialized??'\u2014',a?.validationIndexes??'\u2014',a?.initializationIndexes??'\u2014',a?.privateIndexes??'\u2014',c.result?.fileDataAllocation?.duplicateFileNames??'\u2014'].join(' | ')+' |\n';}
markdown += '\nValidation indexes identifica somente transactions/ID/activation-UUID.index; initialization indexes identifica separadamente transactions/ID/register-UUID.index; \u00edndices privados necess\u00e1rios e MAIN s\u00e3o categorias separadas. O JSON conserva os tamanhos l\u00f3gicos e alocados de cada categoria. V1 n\u00e3o recebeu medidas retroativas. O probe isolado do contador demonstrou que um alias hardlink adiciona 8192 B l\u00f3gicos e zero aloca\u00e7\u00e3o contabilizada adicional; n\u00e3o adota hardlinks como c\u00f3pias independentes nem certifica o produto.\n\n';
markdown += '\n## Recursos observados\n\nRSS do worker em MiB, amostrado a cada 10 ms; inclui o harness e exclui filhos Git. A coluna Git conta processos diretos com PID/tentativas de spawn, sem descendentes. Fases e tempos Git podem se sobrepor; n\u00e3o devem ser somados ao tempo total.\n\n| Fonte/cen\u00e1rio | API/amostra | RSS pico MiB | Git PID/tentativas | Sem PID | Git dur. agregada ms |\n| --- | --- | ---: | ---: | ---: | ---: |\n';
for(const phase of data.phases)for(const c of phase.cases)for(const sample of c.samples.filter(s=>['first-on-register-layer0','on-reactivation-no-cache','off'].includes(s.operation)))markdown += '| '+[phase.label+'/'+c.id,sample.operation+'/'+sample.sample,number(sample.resources.rssPeakBytes/1024**2),sample.git.directProcessesWithPid+'/'+sample.git.directSpawnAttempts,sample.git.failedWithoutPid,number(sample.git.totalDurationMs)].join(' | ')+' |\n';
markdown += '\nO disco l\u00f3gico total inclui toda a fixture (objetos Git, workspace, HOME isolado, \u00edndices de seeding e transa\u00e7\u00f5es). Backups, journals e materialized s\u00e3o subtotais do reposit\u00f3rio; nenhum deles \u00e9 pico medido, ocupa\u00e7\u00e3o f\u00edsica ou quota.\n\n';
markdown += '\n## Escala de dez mil arquivos\n\n';
for(const phase of data.phases){const c=phase.cases.find(row=>row.id==='layers1-files10000');if(!c||c.status==='NOT_RUN')continue;markdown += phase.label+': '+c.status+'; or\u00e7amento do worker inteiro '+(c.configuredInvocationBudgetMs??'\u2014')+'ms (setup inclu\u00eddo), dura\u00e7\u00e3o externa '+(c.process?.durationMs??'\u2014')+'ms. ';const init=c.operationStarts.find(row=>row.operation==='init'),activation=c.operationStarts.find(row=>row.operation==='first-on-register-layer0');if(init&&c.workerStartedAt)markdown += 'Setup aproximado pela linha do tempo '+number(Date.parse(init.at)-Date.parse(c.workerStartedAt))+'ms. ';if(c.status==='TIMEOUT'&&activation&&c.completedAt)markdown += 'Intervalo observado desde in\u00edcio da primeira ativa\u00e7\u00e3o at\u00e9 recibo do timeout '+number(Date.parse(c.completedAt)-Date.parse(activation.at))+'ms; n\u00e3o \u00e9 lat\u00eancia completa. ';if(c.postTimeoutInventory){
  const i=c.postTimeoutInventory,logical=i.logicalBytes??i.finalFixtureLogicalBytes;
  const extracted=i.materializedFiles!=null?i.materializedFiles+' arquivos extraídos':i.finalStorage?.materialized!=null?i.finalStorage.materialized+'B de extrações retidas':'extração não quantificada';
  const ended=i.ownedProcessTreeTerminated??c.process?.termination?.descendant_tree_confirmed;
  markdown += 'Inventário posterior: '+(logical==null?'total lógico da fixture não medido':logical+'B lógicos da fixture')+', ';
  markdown += (i.worktreeLayerFiles==null?'arquivos da Layer não contados':i.worktreeLayerFiles+' arquivos da Layer observados no worktree')+', '+extracted+'; ';
  markdown += 'encerramento da árvore própria '+(ended==null?'não confirmado':ended)+'. ';
}markdown += 'Opera\u00e7\u00f5es incompletas n\u00e3o recebem aprova\u00e7\u00e3o nem delta pareado.\n\n';}
markdown += '\nNos cen\u00e1rios finais, cada ativa\u00e7\u00e3o/desativa\u00e7\u00e3o conclu\u00edda possui recibo em operationProofs: HEAD/refs de branches/\u00edndice MAIN sem\u00e2ntico e blobs Git ou aus\u00eancias, verificados fora do rel\u00f3gio. Um timeout posterior conserva esses recibos, mas mant\u00e9m o cen\u00e1rio inteiro incompleto. A baseline possui os or\u00e1culos finais originais; os extras do v2 s\u00e3o explicitamente separados.\n\n';
markdown += '\nEm 5/10 Layers h\u00e1 100 arquivos no total. On/off do alvo bench0 move 20/10 arquivos com 4/9 outras Layers ativas. First-on-register-layer0 mede apenas a primeira origem, com as demais ainda inativas. First-on-allLayers-sum-API soma os tempos completos das 5/10 chamadas iniciais; exclui setup e or\u00e1culos entre chamadas e n\u00e3o \u00e9 uma opera\u00e7\u00e3o at\u00f4mica \u00fanica.\n\n';
markdown += '\n## Fontes e limites\n\n';
for (const phase of data.phases) markdown += '- '+phase.label+': '+(phase.metadata?'Core SHA-256 `'+phase.metadata.sourceFingerprint+'`; runner `'+phase.metadata.runnerSha256+'`.':phase.status)+'\n';
for(const override of data.primaryOverrides)markdown += '- Baseline1000 principal: Core `'+override.metadata.sourceFingerprint+'`; runner `'+override.metadata.runnerSha256+'`; n3, v2; v1 n1 separado em supplementaryCampaigns.\n';
markdown += '\n'+data.limitations.map(value=>'- '+value).join('\n')+'\n\nAmostras, condições, oráculos nativos, contadores por syscall, Git direto e fases inclusivas constam de [BENCHMARKS.json](BENCHMARKS.json). Cache ausente/inválido e volumes alternativos não recebem números fictícios: não há cache de projeção no produto. Não se atribui medição de reflink ou rename de diretório a estes tempos.\n';
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'BENCHMARKS.json'),JSON.stringify(data,null,2)+'\n');
fs.writeFileSync(path.join(output,'BENCHMARKS.md'),markdown);
console.log(JSON.stringify({cases:data.phases.map(p=>({phase:p.label,statuses:p.cases.map(c=>({id:c.id,status:c.status}))})),bytes:fs.statSync(path.join(output,'BENCHMARKS.json')).size}));
