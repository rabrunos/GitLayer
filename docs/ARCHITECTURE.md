# Arquitetura implementada

**Etapa 2 — 04/11/2026:** [desempenho e recuperação](reports/2026-11-04-performance-recovery/README.md) agrupam consultas oficiais de caminhos/refs e processam hashes, backups e projeção normal por blocos. O Core não mantém cache de refs, índices, configuração ou disco entre comandos. Entradas de árvores por OID imutável podem ser reutilizadas dentro de uma mutação coordenada, com limite de 64 árvores e 100.000 entradas totais; o cache é descartado ao encerrar a transação. A segunda validação de status permanece. A descrição corresponde às fontes V9 da full concluída: 415 resultados, 411 PASS, quatro SKIP e zero FAIL/cancel/todo. Typecheck/build e smoke independente também passaram, em campanhas separadas; a primeira infraestrutura V9 e a matriz V10 permaneceram FAIL. As campanhas inteiras posteriores V11 concluíram infraestrutura 113 PASS/113 e matriz 355 PASS/seis ENV_BLOCKED/zero FAIL em 361, sobre o mesmo Core/runtime/corpus comprovado por equivalência. Cópia nova e fechamento/publicação ainda dependem das fases registradas em [RESULTS.md](reports/2026-11-04-performance-recovery/RESULTS.md).

O primeiro `Core.track` co-publica backup validado e `recovery.files` em `backup-ready` durável antes de efeitos no alvo; `Transaction.backup()` independente continua durável no próprio retorno. Barreiras de revogação, V05 e D-03 permanecem separadas. Os cinco testes de fronteira do journal e a durabilidade independente passaram nos IDs 133–138 da [full V9](reports/2026-11-04-performance-recovery/FULL-V9-RESULTS.json); não são um denominador adicional nem certificação de perda de energia.

A preparação por `checkout-index` conserva seu prefixo privado. Antes de publicar, registra em memória o hash de cada fonte preparada; a cópia independente por streaming compara esse hash antes do rename, preservando a imagem preparada sem base64 agregado. Backups e restauração de backups usam o mesmo leitor de arquivo regular com identidade/modo e validação antes/depois. Shelves legadas e snapshots de troca de branch mantêm seu formato anterior. Journals e suas etapas duráveis continuam existentes.

**Etapa 1B — 03/11/2026:** [correções de segurança](reports/2026-11-03-security-compatibility-implementation/README.md) acrescentam fronteira coerente de edição, reservas transitórias da base e resolução explícita de ambiguidades. src/core/editing-boundary.ts observa Git/propriedade/ignore e revalida a publicação; ownership-state.ts valida os campos opcionais novos. Renomeações conhecidas preservam origem sem staging; ausência+candidato externo não permite escolher origem pelo target. Consultas continuam pontuais, sem observação contínua. Veja [decisões técnicas](reports/2026-11-03-security-compatibility-implementation/DECISIONS.md).

**Contratos de 02/11/2026:** [Core/CLI e novos contratos](IMPLEMENTATION-2026-11-02.md) prevalecem sobre descrições históricas do workshop. Build independente em `dist-core/`, edição explícita, migração/resgate e proteção opt-in de seleção por worktrees são do produto; o laboratório não foi aberto nesta rodada.

Git Layers Lab tem um Core TypeScript comum à CLI e ao processo principal do Electron. O renderer React/Monaco apresenta dados e solicita operações por uma ponte IPC restrita; não lê o sistema de arquivos nem inicia processos. O adaptador `src/core/git.ts` executa o Git do sistema com argumentos separados e sem shell. Não há implementação própria de objetos/índices Git, branch sintética de composição ou montagem virtual; uma Layer pode ser aberta deliberadamente como branch de trabalho.

| Componente | Responsabilidade e limite |
|---|---|
| `src/core/index.ts` | Coordenação de propriedade, Layers, staging, commits, projeção, shelves, captura, branches tradicionais, diagnóstico e recuperação |
| `src/core/ignore.ts` | Avaliação nativa de exclusões sem o bloco temporário, compartilhada pela reconciliação e prévia lógica; scratch externo exclusivo sem escrita no repositório |
| `src/core/layout.ts` e `rescue.ts` | Seleção/migração explícita de layout e diagnóstico/exportação sem abertura normal dos metadados |
| `src/core/branch-protection.ts` | Reservas opt-in de branches em worktrees próprias; remoção condicionada à prova de propriedade |
| `scripts/build-core.mjs` | Bundle independente Core/CLI em `dist-core/`, sem importar o laboratório |
| `src/core/git.ts` | Descoberta oficial dos caminhos, subprocessos Git locais, atributos e envelope de suporte |
| `src/core/paths.ts` | Política portátil, colisões por componentes e travessia sem links |
| `src/core/storage.ts` | Schema 1, publicação JSON, fingerprints, backups, locks, journals e failpoints |
| `src/core/demo.ts` | Criação do repositório demonstrativo em pasta nova/vazia; usada pelo launcher de demonstração e pela integração desktop |
| `src/cli/index.ts` | Parser público, confirmações, captura interativa e resultados/erros estruturados |
| `src/desktop/main` e `preload` | Janela isolada, seleção nativa de pastas, IPC validado, fila, watchers e armazenamento de rascunhos |
| `src/desktop/renderer` | Explorador, abas Monaco, comparação, estados reais, controles Git/Layers e diagnóstico |

## Referências e propriedade

Existe uma branch de trabalho apontada pelo `HEAD` simbólico real, normalmente tradicional ou uma Layer aberta deliberadamente, e zero ou mais Layers ativas. Uma Layer registrada usa `refs/heads/layer/<nome>`; o prefixo é convenção da aplicação. Criar uma Layer gera por `mktree`/`commit-tree` um commit raiz de árvore vazia sem pai na base, explicitamente separado dos commits de conteúdo solicitados pelo usuário. Descobrir uma branch local ou candidata remota de remote configurado com esse prefixo a reconhece sem ativar arquivos. `on`/`register` podem criar tracking local de candidata remota única; ambiguidade é recusada. Prévia/consulta remota não criam refs. A composição continua sujeita a validação.

O proprietário da base considera sua árvore `HEAD`, seu índice principal e marcadores explícitos. Uma entrada nova no MAIN também pode ser candidata de origem incerta quando outro caminho conhecido sumiu: sua presença no índice, isoladamente, não autoriza converter essa ambiguidade em reserva base ao retirar staging. O proprietário de uma Layer ativa considera sua árvore commitada, seu índice alternativo e reservas explícitas. Assim, exclusões preparadas não liberam um caminho cedo demais, e um arquivo novo reservado continua pertencendo à Layer depois de unstage. Editar um arquivo nunca altera o proprietário. Diretórios podem reunir arquivos de várias origens.

Todos os arquivos projetados são arquivos regulares físicos. Há recusa de colisão entre origens mesmo com bytes iguais, além de arquivo versus diretório, caixa e equivalências Unicode da política portátil. Arquivos preexistentes não gerenciados, inclusive ignorados, impedem a materialização no mesmo destino. Uma Layer inativa não reivindica permanentemente o caminho no workspace.

## Fontes persistentes

Os caminhos internos são descobertos por `git rev-parse`; a implementação não depende de concatenar `<workspace>/.git`. Novos dados usam `layers/`; o layout legado `git-layers/` descrito na tabela continua legível e só é migrado explicitamente, por cópia verificada com origem preservada. A estrutura relativa é:

| Caminho relativo | Conteúdo |
|---|---|
| `git-layers/registry.json` | Layers registradas, IDs, refs, OIDs, base dos índices, estados, reservas e shelf ativa |
| `git-layers/workspace.json` | Branch/OID de trabalho reconhecidos pelo coordenador, papel deliberado e destino de edição quando escolhido |
| `git-layers/indexes/<id>.index` | Índice Git alternativo real de cada Layer |
| `git-layers/reservations/<id>.json` | Reserva explícita conferida com o registro |
| `git-layers/capture.json` | Sessão única de captura atualmente aberta |
| `git-layers/captures/<id>.json` | Retratos e resultado de sessões de captura |
| `git-layers/shelves/<layer-id>/<snapshot-id>/` | Cópia do índice e `shelf.json` com reservas, bytes, modos e marcadores de ausência |
| `git-layers/transactions/<id>/` | Journal, cópias de recuperação e arquivos temporários/materializados daquela operação |
| `git-layers/locks/coordinator/` | Lock entre processos com token, PID e host |
| `git-layers/editor-drafts/` | Rascunhos de buffers do desktop, separados dos arquivos no disco |

Os JSON versionados usam `schema: 1`. Conteúdo inválido, schema desconhecido, IDs/caminhos inconsistentes ou metadados incompletos causam erro seguro; não são convertidos em um estado vazio. Índices, refs e arquivos do Git continuam sendo interpretados pelo próprio Git.

## Staging, retenção e commit

`GIT_INDEX_FILE` é definido por subprocesso, sem alterar o ambiente global. O add gerenciado da base, da Layer projetada e da Layer aberta como branch valida o lote e expande diretórios em arquivos explícitos autorizados. O Git oficial prepara uma cópia integral técnica do índice correspondente na transação; um índice ausente permanece ausente até o Git criá-lo. A Layer projetada usa `git add -f -A -- <arquivos>`; a base usa a variante sem force. Não há `add -A .` sobre uma Layer.

Depois do sucesso técnico, [index-stage.ts](../src/core/index-stage.ts) disputa o lock nativo do índice, revalida seu fingerprint e o contexto observado, registra o AFTER planejado no journal e publica por rename. Uma falha na preparação técnica não publica seu staging parcial; os artefatos técnicos ficam na transação. Esse protocolo cobre add gerenciado, sem congelar os arquivos do disco nem estender a garantia a unstage, hunks, checkpoints ou Git direto.

O staging gera uma árvore real com `git write-tree` e a mantém alcançável em `refs/git-layers/state/<layer-id>`. Essa ref aponta para uma **árvore**, não para um commit de usuário, e por isso não avança a branch nem polui seu log. Checkpoints anteriores de uma operação são preservados em `refs/git-layers/transactions/<operation-id>/<layer-id>`. Índices privados sozinhos não são usados como garantia de retenção para garbage collection.

O commit de Layer escreve a árvore exata do índice, valida propriedade e cria `commit-tree <tree> -p <oid-da-layer>`. A atualização é `update-ref <ref-da-layer> <novo> <oid-esperado>`. Não chama `git commit` sobre o índice da Layer e não atualiza `HEAD`. Edições posteriores ao stage permanecem no disco como unstaged. A identidade exigida para commits de usuário é validada; o checkpoint de árvore não exige identidade.

O estado staged é comparado com o commit da própria Layer, e unstaged compara índice com disco apenas nos caminhos próprios. Arquivos sem proprietário aparecem no grupo global de não rastreados. Staging parcial usa patches de hunks suportados e token ligado ao estado do arquivo/índice; um token obsoleto é recusado e não gera fallback para stage integral. A restauração de disco e o unstage são operações distintas.

Uma ref de Layer alterada externamente ou um `indexBase` desconhecido suspende mutações, exceto o avanço legítimo da Layer aberta deliberadamente como branch de trabalho, reconhecido no seu papel nativo sem reinicializar o índice privado retido. O Core não reinicializa silenciosamente um índice sujo a partir da nova referência.

## Fronteira temporal dos índices copiados

A implementação executada nas fontes V9 compartilha [index-timestamp.ts](../src/core/index-timestamp.ts) entre consultas, staging e rollback. A igualdade dos bytes de um índice não preserva, por si só, a detecção nativa de arquivos racy: o Git também usa o mtime do arquivo do índice. O helper observa tempos exatos em nanossegundos com BigInt e só aceita, nas cópias de consulta/staging, um mtime confirmado pelo filesystem de pelo menos um segundo após epoch e não posterior ao da fonte. Arredondamentos são tentados para trás e revalidados; um timestamp sem representação segura provoca `INDEX_TIMESTAMP_UNSAFE`.

A alteração de timestamp usa exclusivamente um descritor aberto do arquivo privado. Identidade, tipo regular, ausência de links, dev/ino, número de links, tamanho, modo e tempos são conferidos no FD e no caminho antes e depois. O índice vivo de origem não recebe essa escrita. O helper não substitui os hashes de conteúdo, tokens de concorrência, revalidação da fonte ou locks nativos mantidos pelos callers.

[index-query.ts](../src/core/index-query.ts) aplica essa fronteira à cópia transitória que recebe o diff oficial. [index-stage.ts](../src/core/index-stage.ts) trata duas cópias separadamente: fonte viva para índice técnico antes do add, e índice produzido pelo Git para lock de publicação antes do rename. Os argumentos de consulta e staging são clonados e validados antes do primeiro await, conservando a mesma seleção durante a preparação assíncrona. As barreiras duráveis de publicação do índice permanecem independentes.

No rollback, somente o índice MAIN descoberto e os índices privados aprovados pelo classificador estrito recebem uma fronteira conservadora de epoch + 1 segundo. Ela é aplicada à cópia privada de restauração, sincronizada no mesmo FD e novamente validada antes do rename. Backups e planos legados continuam sem campo temporal novo; os bytes e modos anteriores permanecem o oráculo. A escolha pode exigir rehash dos arquivos em consultas posteriores à recuperação. Outros arquivos restaurados não recebem esse tratamento. Uma recusa conserva backup/journal e a evidência temporária disponível; reversões anteriores do plano podem já ter ocorrido.

## Plano físico da desativação

A desativação captura caminhos e fingerprints antes de consultar a limpeza da Layer. Após a consulta e as observações de propriedade/destino, revalida o plano inteiro antes de registrar `deactivation-planned` e antes da primeira remoção. Uma mudança observada produz `EXTERNAL_EDIT`, com reason `deactivation-plan-changed`. Cada remoção mantém sua própria comparação com a imagem esperada, cobrindo mudanças posteriores à revalidação global. `--discard` autoriza o descarte da imagem planejada; não incorpora automaticamente uma edição posterior. Essas verificações são otimistas e não serializam escritores externos ao Core.

A full V9 executou as regressões dessas fronteiras: IDs 69–72 para off concorrente, 97–109 para consultas racy/árvore, 201–206 para rollback e 308–319 para staging racy. Os registros constam da [projeção final](reports/2026-11-04-performance-recovery/FULL-V9-RESULTS.json), sem somar recortes. As reproduções históricas permanecem no [relato de integridade](reports/2026-11-04-performance-recovery/INTEGRITY-AUDIT.md); infraestrutura/matriz e demais limites conservam seu alcance.

## Projeção, exclusões e legado de shelves

Antes de ativar, o Core valida composição e destinos, prepara arquivos em área privada usando `checkout-index`, publica somente caminhos aprovados e registra progresso no journal. Antes de substituir/remover compara hashes e modos. As transformações nativas de texto suportadas são feitas pelo Git, e atributos/filtros externos não suportados são recusados.

Um bloco delimitado no `info/exclude` local protege caminhos exatos das Layers ativas, preservando regras fora dele. Com target aberto, inclui exclusão abrangente para novos caminhos e exceções exatas para arquivos anteriores sem dono já elegíveis, protegendo o add comum antes da reconciliação de propriedade. Ao encerrar o target, esse trecho abrangente é removido; regras exatas das Layers permanecem. Negações do usuário em arquivos de maior prioridade e force continuam bypass. A proteção é conferida com `check-ignore`, incluindo a semântica da negação. A segurança dos comandos próprios também usa proprietário explícito; não depende apenas do ignore. Uma mudança incompatível em regras de ignore/atributos interrompe a próxima operação gerenciada.

A reconciliação avalia a intenção de ignore do usuário sem o bloco temporário gerenciado: regras de info/exclude, core.excludesFile e .gitignore mantêm prioridade/negações nativas. Arquivos assim ignorados não são reservados automaticamente; inclusão deliberada continua separada. O helper fornece ao Git um arquivo exclusivo de regras limpas em temporário externo, sem alterar metadata, refs, índices, exclude ou worktree do repositório, e remove sua entrada em finally. As [contraprovas R-02/R-03](evidence/closure-2026-11-02/review-target-preview.json) distinguem falhas anteriores e testes dirigidos aprovados.

A descoberta de candidatos é somente leitura do repositório. A prévia acrescenta reservas virtuais aos caminhos/pendências, informa unreconciled e não as persiste; a mutação chama novamente essa descoberta antes dos efeitos.

Desativar uma Layer limpa retira somente seus arquivos. Com pendências, o fluxo novo exige commit, cancelamento ou descarte explícito (`--discard --yes` na CLI). `--park` é recusado por GL-16. Shelves anteriores continuam preservadas como dados legados; não são criadas para guardar novas pendências na desativação.

Depois de retirar os arquivos, a desativação tenta remover seus diretórios ancestrais vazios, dos mais profundos para os mais rasos, usando somente `rmdir` sem recursão. Ancestrais de caminhos da base em HEAD ou no índice principal e de outras Layers ativas são preservados, inclusive quando seus arquivos estão ausentes no disco. Conteúdo local, ignorado ou subpastas não relacionadas impedem a remoção do diretório. Não há varredura geral de pastas vazias: Git não registra pastas vazias como propriedade da base; a proteção é derivada dos caminhos versionados e preparados.

Cada diretório candidato à remoção é registrado no journal com seu caminho validado e modo antes do `rmdir`. O rollback e `recover` validam o plano completo, recriam diretórios ausentes e restauram os arquivos conforme as verificações de concorrência existentes. Planos com caminhos externos, internos do Git, aliases de caixa/Unicode ou um arquivo ocupando o lugar de diretório são recusados. Diretórios compartilhados nunca são removidos recursivamente.

A troca da branch tradicional exige base tracked limpa. Ela valida a árvore de destino contra todas as Layers ativas e arquivos locais antes da mudança, preserva as projeções em journal, usa a troca normal do Git e rematerializa os arquivos. Essa sequência não é atomicamente invisível a outros programas.

## Destino, captura legada, concorrência e recuperação

Captura é uma sessão temporária compartilhada entre CLI/desktop. Ela grava o conjunto de caminhos preexistentes no escopo e calcula candidatos atuais por nova varredura. Watchers ajudam a atualizar a interface; não decidem propriedade. A confirmação atribui/prepara somente os selecionados. Cancelar mantém os arquivos físicos. Essa captura é a API legada de revisão. O novo destino `edit` é explícito por workspace, persiste até encerramento/troca e reconcilia novos arquivos nos comandos/consultas, sem apropriação retroativa e sem interceptação contínua de programas externos.

O desktop serializa operações de workspace/Core em uma fila, e o Core usa lock por diretório entre processos. Entrada, tamanho e consulta do PTY e cópia de comandos têm caminho síncrono separado para não aguardar varreduras Git; criação/encerramento da sessão continuam serializados. Locks preexistentes ou cuja posse não possa ser comprovada continuam em vigor e são preservados. Locks temporários do índice criados pelo Core só são publicados ou removidos depois de verificar identidade e conteúdo segundo o protocolo de preparação. Um lock existente do coordenador é recusado e preservado para inspeção, sem presumir que um PID antigo autoriza removê-lo.

As operações registram estado anterior, backups, fingerprints, etapas e conclusão. Metadados usam arquivo exclusivo temporário, `fsync`, rename e sincronização de diretório quando o sistema permite. Isso reduz janelas de perda, mas não oferece uma transação ACID que envolva Git, JSON e todos os arquivos físicos. Alguns sistemas não permitem sincronizar diretórios da mesma forma; não há certificação de durabilidade após perda de energia em todas as plataformas.

A confirmação explícita de ausência é revogada quando o reaparecimento é observado ou quando o próprio Core conhece uma materialização, antes da publicação física compartilhada. Isso cobre projeção/ativação, restore, escrita e destino de rename, sem depender de consulta posterior. O journal conserva a revogação durável para que recusa, rollback ou recovery não restaurem silenciosamente a autoridade antiga. BEFORE e backup originais continuam preservados; retirar autoridade não transfere propriedade.

A recuperação distingue arquivos físicos do workspace dos metadados internos aprovados pelo mesmo classificador estrito do validador. Qualquer entrada física validada com BEFORE ausente e caminho atual ausente provoca `RECOVERY_CONFLICT`, reason `workspace-materialization-disappeared`, mesmo sem confirmação anterior de ausência ou AFTER durável. Os fatos não distinguem interrupção anterior à escrita, publicação seguida de movimento externo e rollback parcial. Planos legados não recebem revogações inventadas: BEFORE e backup original precisam concordar; bytes/modos só podem corresponder às imagens registradas ou deterministicamente autorizadas.

O guard é verificado no preflight e na observação do próprio loop. Uma recusa tardia pode ocorrer depois de reversões parciais de metadados; não há promessa de ausência global de efeitos. O journal permanece pendente e bloqueia operações gerenciadas posteriores, inclusive usar resolução de propriedade como desvio da recuperação. Preserve arquivos, índices, refs e backups e use `doctor`/`recovery-export` para pasta externa nova.

Uma ref já avançada para o OID registrado só permite concluir os metadados quando plano, arquivos/backups, fingerprints e contexto também permitem a conclusão. O OID evita commit duplicado, mas não dispensa essas verificações nem o guard de materialização desaparecida. Mudança posterior, dúvida de propriedade ou destino ocupado suspendem a recuperação. A recuperação de um `HEAD` tradicional externo só reconhece uma composição ainda validável; não reconstrói o histórico de escritas externas nem recupera bytes nunca registrados.

## Desktop e verificação

O Electron usa sandbox, isolamento de contexto, Node desabilitado no renderer, protocolo local de assets com escopo restrito, negação de novas janelas/navegação externa e política de conteúdo local. O preload expõe uma lista fixa de ações; o main valida emissor, formatos e caminhos antes de chamar o Core. Conteúdo HTML/JavaScript do repositório é texto no editor, nunca uma página executada. Monaco e workers são assets locais.

Buffers pendentes são diferentes dos bytes no disco. Ações que substituem/removem contexto de arquivos são bloqueadas até salvar ou cancelar; rascunhos privados permitem recuperação de texto. Alterações externas são comparadas antes de salvar para não sobrescrever silenciosamente uma edição concorrente. Watchers têm debounce e limite; refresh manual continua disponível.

A configuração de sandbox e a existência dos testes não comprovam execução gráfica. As execuções do Electron no Windows com sandbox ativa registradas em [TEST-REPORT.md](TEST-REPORT.md) são históricas; não houve execução gráfica na Etapa 2. Tentativas históricas em outros ambientes continuam preservadas no histórico.

Os complementos de amend, tags, stash mutável, merge, cherry-pick e revert permanecem recusados com `NOT_IMPLEMENTED`; a leitura da lista de stash é o único complemento permitido. Não há merge de Layers, transferência de propriedade, commit conjunto ou rede.

## Workshop e terminal integrado (0.1.2)

O workshop entrega fontes, debug separado em dist-debug com sourcesContent, configuração de VS Code e repositórios/perfis/relatórios locais em .workshop. O perfil explícito --lab-profile evita reutilizar o userData normal do aplicativo. O build de produção continua sem mapas.

O processo principal hospeda node-pty e abre PowerShell/ConPTY após ação do usuário; xterm no renderer recebe saída via IPC e envia teclas. Não há servidor WebSocket local nem shell no renderer. O catálogo compartilhado commands.ts gera argumentos literais e prévias; a ação restrita copyCommand valida e copia o texto para a área de transferência. A execução exige colagem e Enter manuais; o antigo IPC terminalCommand foi removido. A CLI executa o Core/Git real. As Tasks de desenvolvimento pertencem ao VS Code.

O módulo node-pty e seus workers/nativos ficam fisicamente em app.asar.unpacked. No pacote Windows só entram prebuilds win32-x64; os caminhos do módulo são resolvidos fora do ASAR para workers e agentes. No PowerShell, helpers restritos à sessão disponibilizam git-layer/git layer e usam JSON para transportar argumentos à CLI compilada. A CLI interativa usa Node instalado 22.12+; o executável gráfico Electron não oferece os handles TTY adequados no Windows. Confirmações e Ctrl+C passam pelo TTY real, sem remover a verificação interativa da CLI.

## Validação de árvore na recuperação sem reconstrução

queryIndexTree, em index-query.ts, é uma entrada interna de validação de recover com argv fixo write-tree. Compartilha com queryIndexDiff todo o worker de cópia, timestamp, locks, observação de fonte, recibos e limpeza; a allowlist e o clone síncrono de argumentos do diff permanecem iguais. Não é uma rota de preview/status nem um executor genérico de comandos.

Quando recover não reconstrói checkpoints por transação recuperada, movimento de branch ou confirmação alterada, a validação ocorre nessa cópia independente. A árvore de índice privado deve coincidir com o checkpoint recém-validado; o papel de branch mantém a seleção legítima do índice MAIN. As validações existentes e as reservas de proteção continuam. Quando há reconstrução efetiva, permanece o fluxo anterior de checkpoint/ref.

Essa validação preserva índices vivos, refs e JSON de Layers, mas write-tree pode criar ou freshen objetos Git. Omitir a chamada não seria equivalente: a contraprova documentada teve cached diff 0 e write-tree 128 com blob ausente. O [relato de recuperação repetida](reports/2026-11-04-performance-recovery/RECOVERY-NOOP-AUDIT.md) explica a escolha e seus limites. Os casos de árvore IDs 108/109 e rollback IDs 201–206 passaram na full V9; os quatro SKIP gerais e os seis ENV_BLOCKED da matriz V11 continuam explícitos em RESULTS.md. Não se infere recuperação universal.
