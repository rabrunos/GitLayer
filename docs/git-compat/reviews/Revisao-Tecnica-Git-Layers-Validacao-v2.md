# Revisão técnica — entrega da base de validação Git Layers v2

## Parecer

A entrega contém infraestrutura real e evidências consistentes, não apenas uma lista de cenários. É uma base útil para definir as próximas funcionalidades do Git Layer. A aceitação deve ser **com ressalvas de reutilização e de robustez do runner**. Não equivale a certificação do produto nem a conclusão de todos os cenários/variantes do Git.

O trabalho de preparação deve continuar separado da implementação do produto. Os ajustes apontados nesta revisão dizem respeito principalmente à infraestrutura; os defeitos do produto já registrados pertencem à etapa de implementação autorizada pelo usuário.

Este documento é uma revisão, **não um prompt de implementação**.

## Método e limites

Foram lidos o relatório entregue, os metadados de auditoria, os resultados da rodada final, a matriz, AGENTS e trechos relevantes da infraestrutura e dos testes. Foi consultado o estado remoto do projeto, que permanece no commit `37887aad107bd751a3687bc660a6644ef5d90c54`.

A avaliação das alterações locais usa o ZIP entregue, não presume que elas estejam no GitHub. O relatório registra alterações de produto anteriores à rodada de preparação; o ZIP não inclui o código completo desse snapshot local. Portanto, não é possível reconstruir integralmente esse produto apenas com o arquivo de evidências. Essa limitação é descrita pelo próprio relatório, seção 16.

Não foram executados Git Layers, a CLI, o runner nem qualquer script recebido. As verificações executadas nesta revisão foram próprias, de leitura, contagem, hash e extração de um arquivo do ZIP.

As constatações sobre fluxo de código são **achados estáticos com caminho identificável**, não reproduções dinâmicas dos defeitos na máquina do usuário. A constatação sobre separadores do ZIP foi observada por extração de uma entrada com Python/ZipFile em Linux.

## 1. Integridade e contagens

- Os 71,871 arquivos declarados em `MANIFEST.json` foram comparados por tamanho e SHA-256: nenhuma divergência.
- O relatório avulso corresponde byte a byte ao relatório interno.
- Os caminhos de ambiente, streams e evidências referenciados pelos resultados finais estão presentes, após normalização explícita dos separadores do ZIP.
- As declarações de hash/tamanho das evidências nos resultados concordam com o manifesto.
- As contagens foram recalculadas a partir de `results.json`, sem somar execuções históricas.
- O manifesto de preservação lista os mesmos 29 arquivos e hashes de produto antes/depois da tarefa. Isso confirma consistência das evidências enviadas; não substitui inspeção do filesystem local ao vivo.

Rodada: `run-2026-10-18T22-30-09-708Z-f19a1412`.
Fonte identificada no relatório: `d8e2a09f6fe581bee131d787f2fc679fb20b305a1ba51c1e5d4d82786d364475`.
Infraestrutura identificada no relatório: `eaeca3c971ad6b569cb493559c3aaa9ff768289abe2703054fe76695b2034378`.

| Medida | Valor |
| --- | ---: |
| IDs especificados | 344 |
| IDs com alguma variante executável | 323 |
| IDs com variante executada | 317 |
| Variantes totais, incluindo especificações | 368 |
| Variantes PASS | 341 |
| Variantes ENV_BLOCKED | 6 |
| Variantes NOT_RUN | 21 |
| PASS de Git nativo, sem certificar produto | 243 |
| PASS das fases CURRENT_PRODUCT / USER_REQUIREMENT | 76 |
| PASS de controles da infraestrutura | 22 |
| VERIFIED_SUPPORTED, dentro das 76 variantes de produto/requisito | 41 |
| PRODUCT_GAP, dentro dessas 76 | 17 |
| DOCUMENTED_RESTRICTION, dentro dessas 76 | 9 |
| PENDING_PRODUCT_SPEC, dentro dessas 76 | 9 |

Os 21 NOT_RUN correspondem a 20 IDs fora do escopo da rodada e `MODEL-008`. Os 20 fora do escopo incluem 10 cenários de futura organização/migração de armazenamento; não são 20 falhas.

Há 25 registros de achados no JSON final, correspondentes a 15 identificadores distintos. Não devem ser apresentados como 25 defeitos independentes.

**PASS é aprovação da caracterização realizada, não necessariamente aprovação de um requisito de produto.** A presença de um caso executável para um ID não significa cumprir todas as opções, estados e etapas do roteiro original.

## 2. Aspectos entregues que sustentam a continuidade

### Separação do editor

O `AGENTS.md` entregue apresenta Core/CLI como produto e desktop como laboratório manual. A restrição de não editar o produto é explicitamente da rodada de preparação, não uma proibição permanente.

O build headless tem entradas de Core/CLI/storage e verifica que o grafo não contém `src/desktop`. A suíte não depende de abrir Electron/Monaco/VS Code.

### Observador independente

Em `source/tests/git-compat/cases/product.mjs`, a operação de produto é chamada pela CLI e as observações usam o Git oficial por caminho absoluto.

Exemplo do interesse do usuário: `INDEX-001/native-add-dot-layer`. O roteiro chama `git add .`, confere o conjunto de nomes preparado na base, os blobs preparados, o índice e a ref da Layer e os bytes ainda modificados no disco. Não se limita a verificar exit code.

`COMMIT-014` ainda diferencia esse sucesso do efeito posterior: o commit nativo preserva a separação testada, mas o produto identifica `EXTERNAL_HEAD`. O resultado está classificado como restrição documentada, não como integração transparente completa.

### Evidências e testes do runner

Há asserções negativas, captura de saída, controles de código de erro, timeout, validação de artefatos e seleção de cenários. Existem mortes reais de processos em pontos observados, além de failpoints por exceção. A rodada final informa fingerprint estável e não é união de resultados antigos.

Esses pontos são positivos, mas os controles não cobrem todos os caminhos do processo supervisor; ver R-02 e R-03.

## 3. R-01 — Reutilização ainda presa ao snapshot e ao tamanho desta rodada

**Prioridade: alta para a próxima implementação. Confiança: alta por leitura estática.**

### Evidência A: HARNESS-015

Arquivo: `source/tests/git-compat/cases/harness.mjs`, linhas 90–99.

```javascript
  90   make('HARNESS-015','Source manifest includes untracked product sources',async c=>{
  91     const manifestPath=path.join(project,'.workshop/briefs/validation-v2-20261018-183029-c2f7bf08/initial-state/manifest.json');
  92     // The original-task proof is optional for reusable runs; stable source fingerprints always remain available.
  93     if(fs.existsSync(manifestPath)) {
  94       const m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));const protectedFiles=m.protectedFiles.filter(f=>f.path.startsWith('src/'));
  95       const changed=protectedFiles.filter(f=>!fs.existsSync(path.join(project,f.path))||fileHash(path.join(project,f.path))!==f.sha256);
  96       c.eq('all original product bytes preserved',changed,[]);c.ok('untracked explorer included',protectedFiles.some(f=>f.path.endsWith('FileExplorer.tsx')));
  97       json(path.join(c.artifactDir,'source-proof.json'),{files:protectedFiles.length,changed,fingerprint:fingerprint([path.join(project,'src')])});
  98     } else {c.ok('source fingerprint present',/^[a-f0-9]{64}$/.test(fingerprint([path.join(project,'src')])));}
  99   }),
```

Se a pasta privada original continuar existindo, qualquer alteração autorizada posterior em um arquivo `src/` que já estava no manifesto será comparada ao snapshot de 18/10/2026. A asserção exige que não haja alterações. Como o caso usa o tier padrão `smoke`, esse controle também entra no ciclo rápido.

Isso foi adequado para comprovar preservação **na preparação**, mas não deve se tornar um requisito de que o produto nunca mude. A ramificação alternativa em outra cópia do repositório testa algo diferente: apenas a existência de um hash.

### Evidência B: report.mjs

Arquivo: `source/scripts/git-compat/report.mjs`, linhas 7–14 e 121.

```javascript
   7 const base=path.join(project,'artifacts/git-compat');
   8 const brief=path.join(project,'.workshop/briefs/validation-v2-20261018-183029-c2f7bf08');
   9 const initial=JSON.parse(fs.readFileSync(path.join(brief,'initial-state/manifest.json'),'utf8'));
  10 const runId=process.argv[2]??JSON.parse(fs.readFileSync(path.join(base,'latest-run.json'),'utf8')).id;
  11 const runDir=path.join(base,'runs',runId);
  12 const summary=JSON.parse(fs.readFileSync(path.join(runDir,'summary.json'),'utf8'));
  13 if(summary.source_unchanged!==true||summary.runner_unchanged!==true)throw Error('Report requires a completed, unchanged source/runner snapshot; use the final frozen run');
  14 if(fingerprint([path.join(project,'src')])!==summary.sourceFingerprint||currentRunnerFingerprint()!==summary.runnerFingerprint)throw Error('Current source/config/tests differ from the selected run. Retest before packaging.');
```

O gerador lê obrigatoriamente um caminho privado fixo sob `.workshop/briefs/.../initial-state/manifest.json`, que não é um pré-requisito portátil disponível em um clone novo. Também usa esse snapshot de preparação para verificar alterações nas rodadas posteriores.

```javascript
 117 if(fs.existsSync(finalZip))copyFile(finalZip,path.join(base,'previous-'+exportId+'.zip'));
 118 fs.renameSync(tempZip,finalZip);
 119 const validation={created_at:new Date().toISOString(),run_id:runId,zip:path.basename(finalZip),sha256:fileHash(finalZip),bytes:fs.statSync(finalZip).size,manifest_files:manifest.length,all_hashes_verified:true,relative_entry_links_verified:true,results_validated:true,all_344_ids:true,product_unchanged:productUnchanged,source_count:protectedBefore.length};
 120 json(path.join(base,'PACKAGE-VALIDATION.json'),validation);fs.writeFileSync(finalZip+'.sha256',validation.sha256+'  '+path.basename(finalZip)+'\n');console.log(JSON.stringify(validation,null,2));
 121 if(!productUnchanged||!finalState.lockfileUnchanged||!finalState.preexistingUserChangesPreserved)process.exitCode=1;
```

Mesmo depois de uma nova execução válida, alterações autorizadas de produto desde aquele snapshot tornam `productUnchanged` falso e o gerador termina com erro. O texto gerado também mantém a moldura específica de preparação v2.

### Evidência C: 344 fixo

Arquivo: `source/tests/git-compat/cases/harness.mjs`, linhas 119 e 140.

```javascript
 119     c.eq('computed denominator',counts(results).scenario_ids,344);
 140     c.eq('344 specs execute zero',n.execution.NOT_RUN,344);c.eq('no implemented specs',n.implemented_ids,0);
```

Acrescentar legitimamente um novo roteiro ao catálogo faz esses controles falharem, mesmo que a matriz e o relatório estejam coerentes com o novo total.

### Critério de correção, sem impor a implementação

A próxima rodada autorizada deve poder modificar o produto, acrescentar IDs e gerar relatório em uma nova cópia do projeto sem depender da pasta privada antiga. Deve continuar comprovando que **a execução dos testes** não alterou as fontes observadas durante aquela execução. As evidências históricas da preparação devem continuar preservadas, sem serem usadas como bloqueio permanente.

## 4. R-02 — Resultado PASS pode prevalecer sobre falha/timeout do worker

**Prioridade: alta para confiar na automação. Confiança: alta por leitura estática. Não foi demonstrado que isso ocorreu na rodada final.**

Arquivo: `source/scripts/git-compat/runner.mjs`, linhas 138–144.

```javascript
 138       const r=await execute(process.execPath,[path.join(project,'scripts/git-compat/worker.mjs'),configPath],{cwd:project,env:fixtureEnv,timeout:(c.timeout??60000)+15000});
 139       fs.writeFileSync(path.join(artifactDir,'worker.stdout'),r.stdout);fs.writeFileSync(path.join(artifactDir,'worker.stderr'),r.stderr);
 140       const resultFile=path.join(artifactDir,'result.json');
 141       if(fs.existsSync(resultFile)) Object.assign(result,JSON.parse(fs.readFileSync(resultFile,'utf8')));
 142       else {result.execution_status='FAIL';result.failure_category='INFRASTRUCTURE';result.started_at=new Date(Date.now()-r.duration_ms).toISOString();result.ended_at=new Date().toISOString();result.duration_ms=r.duration_ms;result.error=`Worker exit=${r.code}, timeout=${r.timedOut}: ${r.stderr}`;result.product_status='TEST_GAP';result.nonexecution_reason=null;}
 143       const issue=registry.issues.find(i=>i.scenario_id===result.scenario_id&&i.variant_id===result.variant_id&&i.source_fingerprint===sourceFingerprint);
 144       Object.assign(result,classifyKnown(result,issue));
```

O supervisor recebe `r.code`, `r.timedOut` e `r.outputTruncated`. Contudo, se `result.json` existe, o conteúdo é carregado diretamente. O estado final do processo só entra na mensagem do ramo em que o arquivo não existe.

Em `worker.mjs`, o resultado é gravado antes do encerramento natural do processo. Portanto, um worker pode concluir as asserções e gravar PASS, mas manter um handle aberto, ser encerrado por timeout ou falhar depois. O supervisor pode conservar PASS.

Cenário que precisa de contraprova real do supervisor: worker grava um resultado estruturalmente válido e depois (a) termina com código de erro ou (b) fica pendurado. Outro caso deve verificar saída truncada e encerramento anormal. O resultado global não pode ficar aprovado apenas porque havia um JSON aprovado.

Os controles negativos atuais exercitam processos chamados pelo contexto do caso; isso não substitui verificar o tratamento do **worker pelo supervisor**.

Não se propõe invalidar retroativamente os 341 registros sem evidência. Trata-se de fechar uma brecha antes de confiar em aprovações automáticas futuras.

## 5. R-03 — Seleção vazia pode terminar com sucesso

**Prioridade: média. Confiança: alta por leitura estática.**

Arquivos: `source/scripts/git-compat/runner.mjs`, `selectCases`, construção de `queue` e cálculo de `process.exitCode`.

```javascript
  31     const key = args[i];
  32     if (['--list','--keep-fixtures','--help'].includes(key)) { options[key.slice(2)] = true; continue; }
  33     if (!['--id','--family','--command','--profile','--tier','--capability','--suite','--jobs','--seed','--retry-failed','--out','--module'].includes(key)) throw Error('Unknown option: ' + key);
  34     const value = args[++i]; if (!value || value.startsWith('--')) throw Error('Missing value: ' + key);
  35     options[key.slice(2)] = key === '--jobs' ? Number(value) : value;
  36   }
  37   if (!Number.isInteger(options.jobs) || options.jobs < 1 || options.jobs > 4) throw Error('--jobs must be 1..4');
  38   if (!['smoke','affected','daily','broad','optional','stress','all','harness'].includes(options.suite)) throw Error('Unknown suite');
  39   return options;
  40 }
  41 export function selectCases(cases, matrix, options) {
  42   const scenarios = new Map(matrix.map(s => [s.id,s]));
  43   let failed;
  44   if (options['retry-failed']) failed = new Set(JSON.parse(fs.readFileSync(options['retry-failed'],'utf8')).filter(r => r.execution_status === 'FAIL').map(r => r.scenario_id + '/' + r.variant_id));
  45   const match = (value, target) => value === undefined || value.split(',').some(v => target.includes(v));
  46   return cases.filter(c => {
  47     const s = scenarios.get(c.id);
  48     const suite = options.suite;
 123   const queue=results.filter(r=>r.selection_status==='SELECTED');
 124   json(path.join(runDir,'selection.json'),{options,selected:queue.map(r=>r.scenario_id+'/'+r.variant_id),omitted:results.filter(r=>r.selection_status!=='SELECTED').map(r=>({id:r.scenario_id,variant:r.variant_id,reason:r.nonexecution_reason}))});
 125   let cursor=0;
 160   process.exitCode=!summary.runner_unchanged?2:results.some(r=>r.execution_status==='FAIL'&&r.known_failure!=='XFAIL_STRICT')?1:results.some(r=>r.known_failure==='XPASS_NEEDS_REVIEW')?3:0;
```

Um seletor como `--id LAYRE-003` não corresponde a nenhum caso. Não encontrei validação que recuse IDs desconhecidos ou que diferencie uma execução pretendida sem nenhum teste selecionado de uma rodada concluída.

A matriz continua presente nos resultados como não selecionada, e o cálculo de exit code não depende de testes efetivamente executados. Assim, pode haver exit 0 sem executar o cenário pretendido.

Critério de correção: um erro de seleção deve ser visível e não parecer sucesso de teste. Modo de listagem e seleção vazia deliberada podem existir, mas precisam ser explicitamente distinguidos de uma rodada executada.

## 6. R-04 — Portabilidade dos nomes internos do ZIP

**Prioridade: média/empacotamento. Observado nesta revisão.**

O ZIP enviado contém nomes como `source\\AGENTS.md`, com barra invertida no próprio nome da entrada. O empacotador verifica a extração em Windows normalizando os separadores, por isso sua validação local pode passar.

Nesta revisão foi feita a extração convencional de **uma entrada** com `zipfile.ZipFile.extract` no Linux. O resultado foi um arquivo cujo nome literal era `source\\AGENTS.md`, sem a hierarquia `source/AGENTS.md`. O conteúdo era idêntico, mas os links e caminhos esperados não se resolvem nessa extração.

Para esta auditoria, os caminhos foram normalizados explicitamente ao ler o ZIP; não houve perda de conteúdo nem divergência de hash.

Critério de correção: o artefato deve preservar hierarquia e links quando extraído por leitores comuns em Windows e em Linux, sem exigir que o destinatário conheça uma correção particular de nomes. Isso é portabilidade do relatório, não exigência de executar o produto Linux agora.

## 7. Defeitos do produto observados pelo Codex

Estes são achados do pacote, não defeitos novos reproduzidos nesta revisão:

| Área | Observação registrada | IDs |
| --- | --- | --- |
| Exportação | Destino novo fica vazio; CLI retorna ERR_FS_CP_EEXIST no ambiente registrado | MODEL-009; LAYER-015; RECOVERY-004 |
| Lock abandonado | Doctor informa safe=true, mas create/recover retornam LOCKED | RECOVERY-004 |
| Metadados inválidos | Doctor, recover e export falham na abertura normal | RECOVERY-009 |
| Captura | Desativar Layer deixa cancelamento dependente de reativação | LAYER-012 |
| Snapshot grande | Projeção de 49 MiB retirada antes de falhar por journal de 64 MiB; recuperação restaura bytes | RECOVERY-012 |
| Ref externa | Exclusão/renomeação quebra referência registrada; dados preservados, resgate limitado | LAYER-015 |
| Seleção nativa | Git direto ainda seleciona `layer/tools` como branch; requisito U-07 não atendido | BRANCH-016/017/018; WORKTREE-014 |

A não correção dessas funções nesta rodada respeita o escopo solicitado. Uma caracterização desses defeitos pode passar e continuar com `PRODUCT_GAP`.

A política de comandos destrutivos nativos e a convivência com concorrência externa precisam de decisão de produto. Testes de `clean`, `stash` e janela de GC não estabelecem por si só um contrato universal.

## 8. Lacunas conhecidas, sem inflar a entrega

### MODEL-008

A campanha de interrupções em todas as fronteiras continua `SPEC_ONLY`. Três mortes Core observadas e dois interleavings não equivalem a campanha exaustiva. Isso deve permanecer no backlog de validação, ligado ao que cada futura implementação alterar.

### Ambiente e plataformas

As seis variantes ENV_BLOCKED são:

| ID | Variante / capacidade ausente no recorte efetivo |
| --- | --- |
| INDEX-018 | `git add --resolved` não anunciado pelo Git efetivo |
| BRANCH-015 | `git branch --delete-merged` não anunciado |
| REWRITE-015 | builtin `history` não disponível |
| REMOTE-014 | builtin `url-parse` não disponível |
| PROTO-007 | executável `git-shell` não encontrado nos caminhos inspecionados |
| TOOLS-003 | CGI Gitweb não encontrado nos caminhos inspecionados |

A execução registrada foi Windows com Git `2.53.0.windows.2` e Node `v24.14.1`; o catálogo documental é 2.56. Não é certificação de todas as versões e plataformas.

O relatório registra ainda limite de isolamento: o Core descarta variáveis Git herdadas, podendo ler configuração de sistema Git apesar do HOME sintético. A infraestrutura não ocultou isso.

### Estudo dos comandos

As fichas entregues distinguem 82 exames semânticos dirigidos e 79 triagens semânticas. Não significam leitura integral de todas as opções. Os 2.003 rótulos extraídos dos manuais e 387 menções em foco não são contagem de funcionalidades certificadas.

### Suíte preexistente

O conjunto de integração existente terminou com 81 testes, 76 aprovados, 2 falhas e 3 skips. Nos logs, as duas falhas correspondem a `Filename too long` em refs de transação. O reteste Windows de seis casos passou, com a mesma fonte identificada.

Isso não equivale a uma nova execução integral aprovada do conjunto de 81. Os dois conjuntos devem permanecer distintos no resumo.

### Desempenho

A rodada final durou 935.875 ms, aproximadamente 15 minutos e 36 segundos, com quatro workers. É duração observada, não previsão. O ledger conta 12.535 comandos diretos, não todos os processos internos do produto. A seleção por ID/área é importante para o ciclo frequente; não há promessa de matriz inteira em segundos.

## 9. Continuidade recomendada

A estrutura já sustenta a conversa sobre o que o Git Layer deve fazer. Não é necessário descartar a entrega nem recomeçar o estudo.

Antes de usá-la como validação automática das próximas implementações, convém fechar R-01, R-02 e R-03, e corrigir a portabilidade R-04 no relatório. Isso continua sendo trabalho de infraestrutura, sem exigir alteração do produto nesta etapa.

Depois, requisitos definidos pelo usuário devem ser ligados aos cenários existentes e às novas variantes pertinentes. Codex escolhe e justifica a implementação técnica. Testes de caracterização de um defeito precisam ser atualizados quando houver uma correção autorizada, preservando o histórico; não devem obrigar o produto corrigido a continuar com o comportamento defeituoso.

Não foi produzido um novo prompt nesta revisão, nem alterado arquivo do repositório remoto/local do usuário.

## Anexo — dados próprios de conferência

```json
{
  "input_zip": "Git-Layers-Relatorio-Validacao-v2.zip",
  "input_zip_sha256": "092ba30d66a6881942f8859a29d167829dd713a2fb6e823f8fe3bd3fd74b5f66",
  "reported_run": "run-2026-10-18T22-30-09-708Z-f19a1412",
  "manifest_files_checked": 71871,
  "manifest_mismatches": 0,
  "result_missing_references": 0,
  "result_evidence_hash_declaration_mismatches": 0,
  "standalone_report_matches_zip": true,
  "counts_recalculated": {
    "scenario_ids": 344,
    "variants": 368,
    "implemented_ids": 323,
    "executed_ids": 317,
    "execution": {
      "PASS": 341,
      "ENV_BLOCKED": 6,
      "NOT_RUN": 21
    },
    "product": {
      "NOT_ASSESSED": 281,
      "VERIFIED_SUPPORTED": 41,
      "PENDING_PRODUCT_SPEC": 19,
      "DOCUMENTED_RESTRICTION": 9,
      "PRODUCT_GAP": 17,
      "TEST_GAP": 1
    },
    "processes": 12535
  },
  "pass_phases": {
    "NATIVE_BASELINE": 243,
    "CURRENT_PRODUCT": 68,
    "USER_REQUIREMENT": 8,
    "HARNESS": 22
  },
  "assertions_recorded": 3217,
  "findings_rows": 25,
  "findings_distinct_identifiers": 15,
  "review_method": "Leitura estática + verificações próprias de arquivo/ZIP; sem execução de Core/CLI/runner."
}
```

## Proveniência dos arquivos citados

Os caminhos `source/...`, `runs/...`, `existing/...` e `audit/...` neste documento referem-se a entradas do ZIP enviado pelo usuário. Os números de linha dos trechos de código foram contados a partir dessas entradas.

| Arquivo de infraestrutura | SHA-256 |
| --- | --- |
| `source/scripts/git-compat/runner.mjs` | `5e7bf4887ef8f3e5381f74187feb9aa5e2af1a101c0910d452260660245f6dc4` |
| `source/scripts/git-compat/report.mjs` | `e8ea52e825b2ceb6994b9471ce8f27ce0fdbb771c9dfcca254518e7ff8dc3201` |
| `source/tests/git-compat/cases/harness.mjs` | `6b3affd21db74c03709e9f20bd4367e7e8e0b763d80059848fe1cdf15dc12b2c` |
| `source/scripts/git-compat/package.ps1` | `4692eda891bb032a0d65a3f3808d6b46a81fc78b1fddb69e5675fe1d252a169a` |
