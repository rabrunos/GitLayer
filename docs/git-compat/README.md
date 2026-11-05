# Base de validação Git Layer v2

**Precedência da fase atual:** as restrições de preparação/revisão de 18 e 19/10 descritas abaixo são históricas. A missão de 02/11/2026 autoriza implementar Core/CLI e evoluir expectativas com fonte, requisito e evidência, preservando IDs e resultados anteriores. Consulte [contratos atuais](../IMPLEMENTATION-2026-11-02.md). Nenhum resultado v2 certifica automaticamente as novas fontes.

Esta base separa o Git oficial, o comportamento observado do Core/CLI e os requisitos aprovados U-01 a U-10. A rodada v2 autoriza documentação, testes e infraestrutura; defeitos do produto são reproduzidos e registrados para implementação posterior. Não autoriza alterar fontes do produto, abrir o laboratório, migrar armazenamento, instalar interceptadores, fazer commit ou publicar.

## Documentos e procedência

- [Missão recebida](reference/05-Prompt-Codex.md), [decisões e autonomia](reference/06-Decisoes-e-Autonomia.md), [protocolo](reference/04-Protocolo-de-Testes.md), [critérios de continuidade](reference/10-Aceite-e-Continuidade.md).
- [Catálogo original](reference/02-Catalogo-Git-v2.json), [matriz original de 344 IDs](reference/03-Cenarios-Git-Layers-v2.json) e [schema original proposto](reference/schemas/resultado.schema.json). `reference/` preserva os 19 arquivos recebidos; seus status iniciais não são resultados de execução.
- [Matriz de trabalho extensível](../../tests/git-compat/scenarios.json): preserva os IDs originais e permite cenários adicionais. O denominador do relatório vem da matriz arquivada na rodada, sem exigir que o total permaneça 344.
- [Estudo e versões](ESTUDO-GIT.md), [161 fichas](FICHAS-COMANDOS.md), [fichas JSON](fichas-comandos.json) e [inventário](inventario-git.json).
- [Arquitetura e contratos](ARQUITETURA-E-CONTRATOS.md), [histórico AGENTS](history/REVISAO-AGENTS-v2.md), [revisão de infraestrutura de 19/10](history/REVISAO-INFRAESTRUTURA-2026-10-19.md) e [desktop separado](DESKTOP-WORKFLOW.md).
- [Auditoria documental histórica](DOCUMENTATION-VALIDATION.json): evidência da preparação original e baseline dos hashes das 19 referências. Não é substituída pelas novas verificações nem executa cenários Git.

A entrega de 18/10 permanece nos caminhos históricos `artifacts/git-compat/RELATORIO-COMPLETO.md` e `artifacts/git-compat/Git-Layers-Relatorio-Validacao-v2.zip`. A infraestrutura revisada produz novas rodadas e entregas em diretórios próprios; não sobrescreva evidência histórica para representar um reteste.

## Selecionar e executar sem interface

Use Node.js compatível com `package.json`, dependências do lockfile disponíveis e Git oficial instalado. Inspecione scripts antes de executá-los; setup, Dev/Debug, demonstração e UI não são pré-requisitos. O postinstall histórico inclui Electron: considere seus efeitos antes de instalar dependências. O runner usa o `esbuild` já declarado e compila Core/CLI/storage a partir das fontes arquivadas pela própria rodada, em uma fixture temporária exclusiva fora do checkout e de outros repositórios; não importa desktop nem sobrescreve `dist/`. Builds e repositórios descartáveis ficam nessa raiz, identificada por nonce e ancestralidade. Os resultados e fontes arquivadas permanecem no destino de evidências.

```powershell
# Lista seleção, omissões e especificações; não compila nem executa casos.
node scripts/git-compat/runner.mjs --list
node scripts/git-compat/runner.mjs --suite all --family INDEX,BRANCH --list
node scripts/git-compat/runner.mjs --suite all --command git-add --profile N0 --list

# Ciclos headless, conforme o escopo da mudança.
node scripts/git-compat/runner.mjs --suite smoke
node scripts/git-compat/runner.mjs --suite daily --jobs 2
node scripts/git-compat/runner.mjs --suite broad --jobs 2
node scripts/git-compat/runner.mjs --suite all --id LAYER-001 --seed 20261019

# Infraestrutura, opcionais e escala são seleções próprias.
node scripts/git-compat/runner.mjs --suite harness
node scripts/git-compat/runner.mjs --suite optional
node scripts/git-compat/runner.mjs --suite stress --jobs 1

# Verificações existentes, com fixtures e streams isolados.
node scripts/git-compat/existing.mjs --suite typecheck
node scripts/git-compat/existing.mjs --suite unit
node scripts/git-compat/existing.mjs --suite integration
node scripts/git-compat/existing.mjs --suite windows
```

Aliases npm: `compat:list`, `compat:smoke`, `compat:test` (broad), `compat:selftest` (harness) e `compat:report`. `existing.mjs --suite all|typecheck|unit|integration|windows` aceita `--out` para a raiz de evidências; cria uma rodada nova e registra código, timeout, sinal, streams e preservação. `all` reúne os subconjuntos declarados nesse script, não toda a suíte `npm test`.

`existing.mjs` aceita também `--fixture-parent DIRETORIO_EXISTENTE`: escolha um caminho curto, real, sem links e fora de qualquer repositório, incluindo ancestrais com `.git` como diretório ou gitfile. O padrão é o temporário nativo existente (`os.tmpdir()`); se TEMP/TMP herdado apontar para dentro do checkout ou outra cópia Git, a execução recusa esse local antes de criar saída, fixture ou HOME. Informe explicitamente um temporário externo válido; somente depois da validação são criados fixture própria com nonce e ambiente isolado. Não altere TEMP global para contornar a recusa.

O runner da matriz e as fixtures de infraestrutura usam o mesmo validador de raiz externa. Seu padrão também é `os.tmpdir()`; `GIT_COMPAT_EXTERNAL_FIXTURE_PARENT` pode selecionar um diretório externo existente somente no ambiente do processo da rodada. Essa variável não acrescenta uma opção à CLI e não altera o perfil de seleção. O resumo registra `working_storage`, incluindo retenção e resultado da limpeza. Em sucesso, builds transitórios e fixtures próprias são removidos após validar nonce/ancestralidade; `--keep-fixtures`, falha fatal ou limpeza disputada conservam a raiz para inspeção.

Na campanha da Etapa 2, `scripts/validate-performance-recovery.mjs` executa uma fase por invocação e ativa `GL_STAGE2_PRESERVE_FIXTURES=1`. Os arquivos de integração `performance-discovery`, `performance-streaming`, `performance-recovery`, `performance-journal` e `performance-journal-recovery` propagam essa flag para seus filhos e retêm suas fixtures em sucesso ou falha, inclusive falhas de preparação. Cada fixture valida marcador, nonce e ancestralidade, publica seu local nos diagnósticos TAP e grava `RETENTION-RECEIPT.json`. As raízes e os recibos permanecem disponíveis para inspeção; uma repetição da campanha exige nova raiz de saída.

Os parâmetros `--suite-timeout-ms` (padrão 2.400.000) e `--test-timeout-ms` (padrão 300.000) aceitam inteiros de 1 a 2.147.483.647. O primeiro limita cada grupo de comando supervisionado; na seleção `all`, os grupos possuem orçamentos independentes. O segundo fornece o padrão do Node para testes unitários/integração/Windows; overrides internos dos testes continuam aplicáveis. Typecheck tem somente limite de processo. PID, código, sinal, timeout e metadados de encerramento são preservados; término de descendentes não confirmado não vira confirmação por inferência. Uma execução de integração com orçamento total maior deve registrar a opção e conservar a tentativa anterior.

O [seletor](../../scripts/git-compat/selection.mjs) aceita `--id`, `--family`, `--command`, `--profile`, `--tier`, `--capability`, `--module`, `--seed`, `--jobs 1..4`, `--retry-failed caminho/results.json`, `--keep-fixtures`, `--out` e `--matrix caminho/no/projeto.json`. Filtros são interseções com a suíte. Nomes inválidos, opções desconhecidas/repetidas e interseções vazias falham antes do build. Exceções explícitas registram `EMPTY_LIST`, `EMPTY_ALLOWED` (`--allow-empty`) ou `NO_FAILURES_TO_RETRY`; esses estados não são aprovação de testes. Módulos são descobertos em `tests/git-compat/cases/`; `--list` informa o módulo de cada variante.

`affected` seleciona explicitamente LAYER/INDEX/BRANCH/RECOVERY/MODEL/HARNESS; não infere impacto por diff. `--capability` filtra requisitos declarados, sem emular capacidade ausente. `--retry-failed` seleciona pares cenário/variante com execução FAIL; uma variante removida exige mapeamento explícito. Preserve o resultado anterior e identifique o reteste.

O [runner](../../scripts/git-compat/run.mjs) aceita mudanças locais como entrada e registra baseline antes/depois de cada rodada. Não exige igualdade com uma preparação privada ou com o código de 18/10. Matriz, fontes, manifests, fingerprints e entrypoints usados no build são arquivados antes da execução. Alteração durante a rodada é verificada. A proposta JSON do worker não prevalece sobre nonzero, timeout, sinal, erro de spawn ou truncamento observado pelo supervisor.

Os arquivos `tsconfig.debug.json` e `vite.config.ts` entram na auditoria quando presentes; sua existência não é requisito headless. A regressão de portabilidade executa Git/CLI e gera novamente o relatório em uma cópia própria sem esses arquivos e sem brief privado.

Execute as suítes pesadas em sequência. A revisão de 19/10 preserva uma rodada sobreposta interrompida, uma integração que atingiu 40 minutos e um controle isolado das mesmas sete variantes com os limites originais: sete PASS com fontes e infraestrutura estáveis. Essa comparação sustenta uma hipótese de pressão concorrente, sem provar uma causa universal de desempenho. Não some seus resultados como uma única aprovação.

O contexto usa orçamento padrão de **30.000 ms** para `execute`/`run`/Git e **90.000 ms** para uma operação composta da CLI. Casos podem declarar `commandTimeoutMs` e `cliTimeoutMs`; `options.timeout` explícito prevalece. Cada comando e processo supervisionado registra o limite efetivo. Os limites existentes do caso/worker continuam valendo: o primeiro prazo atingido encerra a execução, inclusive quando é menor que o orçamento da CLI. Timeout continua FAIL, mesmo se o código/sinal observado estiver permitido. Esses orçamentos operacionais são configuráveis, não um SLO aprovado do produto nem alteração dos oráculos Git/FS.

Saídas padrão: `artifacts/git-compat/runs/run-*/`, com `baseline-before.json`, `baseline-after.json`, `source-manifest.json`, `source/`, `matrix.json`, ambiente, build, seleção, resumo, resultados e evidências por caso. `latest-run.json` aponta a rodada recente. Cleanup exige propriedade/nonce; `--keep-fixtures` retém somente a raiz criada pela rodada e deve constar no relatório.

Exit codes: **0** sem falha inesperada, inclusive estados vazios explicitamente registrados; **1** falha inesperada de caso; **2** erro de seleção, infraestrutura, validação ou preservação; **3** XPASS que exige revisão. Exit 0 não certifica suporte de toda a matriz nem elimina PRODUCT_GAP, SPEC_ONLY, itens excluídos ou não selecionados. Falha conhecida exige assinatura e fingerprint específicos, nunca tratamento genérico de qualquer falha.

## Relatório e ZIP novos

O [gerador](../../scripts/git-compat/report.mjs) consome rodada autossuficiente schema 3, sem reexecutar o produto. Confere resultados e matriz contra as fontes arquivadas daquela execução, permitindo que o checkout evolua depois. O renderer atual tem procedência própria em `REPORTER.json` e é copiado para `reporter/`. A rodada pode ser lida de seu diretório original ou do ZIP reaberto, com as fontes no topo da entrega; não depende de `.workshop/briefs/`.

O [confronto de integridade](../../scripts/git-compat/report-integrity.mjs) recalcula a saída esperada a partir de outcome, preservação, estados finais e resultados. A classificação conhecida deve concordar com o registro arquivado, a fonte e a assinatura semântica. Contradições são recusadas antes de criar a saída. `EXECUTION-INTEGRITY.json` conserva essa decisão no pacote. Seleção vazia ou somente ENV_BLOCKED pode ter sucesso administrativo, mas não recebe aprovação de testes. `--allow-incomplete` é sempre forense, inclusive para entrada válida: gerador exit 2 e elegibilidade falsa.

```powershell
node scripts/git-compat/report.mjs --help
node scripts/git-compat/report.mjs
# Rodada explícita: node scripts/git-compat/report.mjs run-IDENTIFICADOR
# Raiz alternativa: node scripts/git-compat/report.mjs --root artifacts/git-compat/revisao
# ZIP reaberto: node scripts/git-compat/report.mjs --run-dir CAMINHO/runs/run-IDENTIFICADOR
```

Por padrão, cada geração cria `artifacts/git-compat/reports/run-*/report-*/`, com `RELATORIO-TECNICO.md`, matrizes, achados, manifesto, `Git-Layers-Validacao.zip`, validação do pacote e hash do ZIP. `--out` exige diretório novo; `--zip-name` altera o nome seguro do ZIP. `--context JSON` inclui contexto/anexos explícitos do projeto, sem atribuir aprovação a testes. `--include-history` mantém rodadas separadas. `--allow-incomplete` produz material forense com o erro de integridade declarado e exit 2, sem aprovação. Consulte `--help` para as opções atuais.

Rodadas antigas sem baseline schema 3 são recusadas; seus relatórios/ZIPs originais continuam históricos. O empacotador cria nomes ZIP com `/`, preserva Unicode, espaços e diretórios vazios, recusa travessia/absolutos/duplicações de caixa/symlinks e não sobrescreve ZIP ou extração existentes. O pacote é reaberto e validado. Testes de portabilidade comparam nomes brutos e extração padrão por leitor independente disponível; disponibilidade e limites do leitor pertencem às evidências da rodada.

No Windows, o empacotador usa representação estendida de caminhos somente nas operações de IO. Não muda política global, nomes internos do ZIP ou validação de ancestralidade/entradas. Há regressão real além de MAX_PATH; a conversão de prefixo UNC está implementada, mas não foi certificada contra compartilhamento de rede. Um leitor pode ter limitações próprias, que devem ser registradas sem corrigir silenciosamente seus nomes extraídos.

Quando necessário, saneie evidências concluídas antes de empacotar:

```powershell
node scripts/git-compat/sanitize-history.mjs --root artifacts/git-compat/revisao --dry-run
node scripts/git-compat/sanitize-history.mjs --root artifacts/git-compat/revisao
```

Esse comando exige raiz explícita, preserva crus em backup privado novo e cria derivados identificados de logs em `runs/` e `existing/`, recalculando declarações de hashes. Não muda classificações, fontes arquivadas ou ZIPs publicados. Execute após os produtores terminarem; não substitui revisão de conteúdo pessoal dos anexos.

O recálculo reconhece resultados autoritativos pelo layout da rodada: `runs/ID/results.json` e `runs/ID/cases/CASO/result.json`. O resumo objeto em `existing/ID/results.json` e arquivos homônimos dentro de evidências são texto genérico; seus nomes não os transformam em listas de resultados. O dry-run permanece sem gravações, inclusive nesses formatos.

## Verificação documental reutilizável

O [validador documental](../../scripts/git-compat/docs.mjs) lê `AGENTS.md` e os Markdown de `docs/git-compat/`, verifica links locais/âncoras, hashes dos 19 originais contra a auditoria histórica e preservação dos 344 IDs na matriz extensível. Snapshots históricos `AGENTS.before*.md`/`AGENTS.after*.md` resolvem links relativos como o AGENTS original na raiz. Sem `--out`, o resultado vai para stdout; não executa Git, produto ou rede.

```powershell
node scripts/git-compat/docs.mjs
# O arquivo deve ser novo e ficar fora das árvores de fontes/docs.
node scripts/git-compat/docs.mjs --out artifacts/git-compat/revisao/verification/docs.json
```

O JSON histórico permanece intacto. Exit 0 indica verificações documentais aprovadas; 1 indica divergência; 2 indica entrada/opção/IO inválida. A análise cobre links Markdown inline/imagens/referências, títulos ATX e âncoras explícitas; não é renderer CommonMark completo, não consulta URLs externas e não certifica fragmentos em arquivos não Markdown. O hash histórico é baseline local, sem assinatura independente. Schema completo, execução e suporte pertencem ao runner.

## Interpretar e evoluir expectativas

Cada cenário mantém ID/origem/requisito e pode ter variantes independentes. Especificação, implementação do teste, seleção, execução e suporte são dimensões distintas. Um PASS nativo pode coexistir com PRODUCT_GAP; recusa caracterizada pode passar sem suportar a operação recusada. Variantes N0 aprovadas certificam apenas comportamento nativo observado nessas condições, não compatibilidade integral do produto ou todos os perfis Layer.

Para evoluir o produto em tarefa autorizada, preserve evidência histórica e identifique a nova expectativa/variante ou revisão do contrato. Caracterização de defeito atual não obriga a perpetuá-lo: uma correção aprovada deve atualizar o esperado com fonte, motivo e teste de regressão. Não reduza requisitos aprovados para acomodar o protótipo nem introduza implementação substituta do produto no teste. Registre fixture, comando, oráculo Git/FS independente, timeout, esperado/observado e seleção proporcional ao risco.

O ambiente nativo isola HOME/USERPROFILE/XDG e configurações Git por subprocesso. Na preparação v2, o adaptador daquela fonte descartava inclusive GIT_CONFIG_NOSYSTEM; esse limite observado é histórico. O Core atual preserva a allowlist GIT_CONFIG_GLOBAL/GIT_CONFIG_SYSTEM/GIT_CONFIG_NOSYSTEM para os cenários isolados, mantendo recusados redirecionadores arbitrários de repositório/índice herdados. Isso não certifica isolamento universal de toda configuração/helper externo: consulte o [relatório público](../reports/2026-11-02-closure/REPORT.md), os inputs e a contraprova efetivamente executada.
