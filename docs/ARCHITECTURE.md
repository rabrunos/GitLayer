# Arquitetura implementada

Git Layers Lab tem um Core TypeScript comum à CLI e ao processo principal do Electron. O renderer React/Monaco apresenta dados e solicita operações por uma ponte IPC restrita; não lê o sistema de arquivos nem inicia processos. O adaptador `src/core/git.ts` executa o Git do sistema com argumentos separados e sem shell. Não há implementação própria de objetos/índices Git, checkout de Layer, branch sintética de composição ou montagem virtual.

| Componente | Responsabilidade e limite |
|---|---|
| `src/core/index.ts` | Coordenação de propriedade, Layers, staging, commits, projeção, shelves, captura, branches tradicionais, diagnóstico e recuperação |
| `src/core/git.ts` | Descoberta oficial dos caminhos, subprocessos Git locais, atributos e envelope de suporte |
| `src/core/paths.ts` | Política portátil, colisões por componentes e travessia sem links |
| `src/core/storage.ts` | Schema 1, publicação JSON, fingerprints, backups, locks, journals e failpoints |
| `src/core/demo.ts` | Criação do repositório demonstrativo em pasta nova/vazia; usada pelo launcher de demonstração e pela integração desktop |
| `src/cli/index.ts` | Parser público, confirmações, captura interativa e resultados/erros estruturados |
| `src/desktop/main` e `preload` | Janela isolada, seleção nativa de pastas, IPC validado, fila, watchers e armazenamento de rascunhos |
| `src/desktop/renderer` | Explorador, abas Monaco, comparação, estados reais, controles Git/Layers e diagnóstico |

## Referências e propriedade

Existe uma branch tradicional ativa, apontada pelo `HEAD` simbólico real, e zero ou mais Layers ativas. Uma Layer registrada usa `refs/heads/layer/<nome>`; o prefixo é convenção da aplicação. Criar uma Layer gera por `mktree`/`commit-tree` um commit raiz de árvore vazia sem pai na base, explicitamente separado dos commits de conteúdo solicitados pelo usuário. Descobrir uma branch com esse prefixo não a registra nem ativa automaticamente.

O proprietário da base considera sua árvore `HEAD` e seu índice principal. O proprietário de uma Layer ativa considera sua árvore commitada, seu índice alternativo e reservas explícitas. Assim, exclusões preparadas não liberam um caminho cedo demais, e um arquivo novo reservado continua pertencendo à Layer depois de unstage. Editar um arquivo nunca altera o proprietário. Diretórios podem reunir arquivos de várias origens.

Todos os arquivos projetados são arquivos regulares físicos. Há recusa de colisão entre origens mesmo com bytes iguais, além de arquivo versus diretório, caixa e equivalências Unicode da política portátil. Arquivos preexistentes não gerenciados, inclusive ignorados, impedem a materialização no mesmo destino. Uma Layer inativa não reivindica permanentemente o caminho no workspace.

## Fontes persistentes

Os caminhos internos são descobertos por `git rev-parse`; a implementação não depende de concatenar `<workspace>/.git`. A estrutura efetiva sob o diretório Git é:

| Caminho relativo | Conteúdo |
|---|---|
| `git-layers/registry.json` | Layers registradas, IDs, refs, OIDs, base dos índices, estados, reservas e shelf ativa |
| `git-layers/workspace.json` | Branch/OID tradicional reconhecidos pelo coordenador |
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

`GIT_INDEX_FILE` é passado somente ao subprocesso da Layer correspondente. O ambiente do processo principal e os comandos da base não recebem um índice alternativo global. O stage valida o lote completo, expande diretórios em arquivos explícitos autorizados e só então executa `git add -f -A -- <arquivos>` nesse índice. Não há `add -A .` sobre uma Layer.

O staging gera uma árvore real com `git write-tree` e a mantém alcançável em `refs/git-layers/state/<layer-id>`. Essa ref aponta para uma **árvore**, não para um commit de usuário, e por isso não avança a branch nem polui seu log. Checkpoints anteriores de uma operação são preservados em `refs/git-layers/transactions/<operation-id>/<layer-id>`. Índices privados sozinhos não são usados como garantia de retenção para garbage collection.

O commit de Layer escreve a árvore exata do índice, valida propriedade e cria `commit-tree <tree> -p <oid-da-layer>`. A atualização é `update-ref <ref-da-layer> <novo> <oid-esperado>`. Não chama `git commit` sobre o índice da Layer e não atualiza `HEAD`. Edições posteriores ao stage permanecem no disco como unstaged. A identidade exigida para commits de usuário é validada; o checkpoint de árvore não exige identidade.

O estado staged é comparado com o commit da própria Layer, e unstaged compara índice com disco apenas nos caminhos próprios. Arquivos sem proprietário aparecem no grupo global de não rastreados. Staging parcial usa patches de hunks suportados e token ligado ao estado do arquivo/índice; um token obsoleto é recusado e não gera fallback para stage integral. A restauração de disco e o unstage são operações distintas.

Uma ref de Layer alterada externamente ou um `indexBase` desconhecido suspende mutações. O Core não reinicializa silenciosamente um índice sujo a partir da nova referência.

## Projeção, exclusões e shelves

Antes de ativar, o Core valida composição e destinos, prepara arquivos em área privada usando `checkout-index`, publica somente caminhos aprovados e registra progresso no journal. Antes de substituir/remover compara hashes e modos. As transformações nativas de texto suportadas são feitas pelo Git, e atributos/filtros externos não suportados são recusados.

Um bloco delimitado no `info/exclude` local protege caminhos exatos das Layers ativas, preservando regras fora dele. A proteção é conferida com `check-ignore`, incluindo a semântica da negação. A segurança dos comandos próprios também usa proprietário explícito; não depende apenas do ignore. Uma mudança incompatível em regras de ignore/atributos interrompe a próxima operação gerenciada.

Desativar uma Layer limpa retira somente seus arquivos. Com alterações, `--park` copia separadamente o índice, as reservas e um snapshot do disco, incluindo arquivo ausente e modo. Não usa stash da base. A reativação restaura essa distinção e conserva a shelf em caso de colisão. Diretórios compartilhados não são removidos recursivamente.

A troca da branch tradicional exige base tracked limpa. Ela valida a árvore de destino contra todas as Layers ativas e arquivos locais antes da mudança, preserva as projeções em journal, usa a troca normal do Git e rematerializa os arquivos. Essa sequência não é atomicamente invisível a outros programas.

## Captura, concorrência e recuperação

Captura é uma sessão temporária compartilhada entre CLI/desktop. Ela grava o conjunto de caminhos preexistentes no escopo e calcula candidatos atuais por nova varredura. Watchers ajudam a atualizar a interface; não decidem propriedade. A confirmação atribui/prepara somente os selecionados. Cancelar mantém os arquivos físicos. Não há um destino global permanente para arquivos futuros.

O desktop serializa operações de workspace/Core em uma fila, e o Core usa lock por diretório entre processos. Entrada, tamanho e consulta do PTY e cópia de comandos têm caminho síncrono separado para não aguardar varreduras Git; criação/encerramento da sessão continuam serializados. Locks normais do Git continuam em vigor e nunca são apagados automaticamente. Um lock existente do coordenador é recusado e preservado para inspeção, sem presumir que um PID antigo autoriza removê-lo.

As operações registram estado anterior, backups, fingerprints, etapas e conclusão. Metadados usam arquivo exclusivo temporário, `fsync`, rename e sincronização de diretório quando o sistema permite. Isso reduz janelas de perda, mas não oferece uma transação ACID que envolva Git, JSON e todos os arquivos físicos. Alguns sistemas não permitem sincronizar diretórios da mesma forma; não há certificação de durabilidade após perda de energia em todas as plataformas.

Na recuperação, uma ref já avançada para o commit registrado é reconhecida e o estado é finalizado, sem criar commit duplicado. Backups só são aplicados quando o estado atual pode ser relacionado ao estado anterior ou ao estado aplicado pelo journal. Mudança posterior, dúvida de propriedade ou destino ocupado suspende recuperação e conserva cópias para exportação. A recuperação de um `HEAD` tradicional externo só reconhece uma composição ainda validável; não reconstrói o histórico de escritas que programas externos fizeram no disco.

## Desktop e verificação

O Electron usa sandbox, isolamento de contexto, Node desabilitado no renderer, protocolo local de assets com escopo restrito, negação de novas janelas/navegação externa e política de conteúdo local. O preload expõe uma lista fixa de ações; o main valida emissor, formatos e caminhos antes de chamar o Core. Conteúdo HTML/JavaScript do repositório é texto no editor, nunca uma página executada. Monaco e workers são assets locais.

Buffers pendentes são diferentes dos bytes no disco. Ações que substituem/removem contexto de arquivos são bloqueadas até salvar ou cancelar; rascunhos privados permitem recuperação de texto. Alterações externas são comparadas antes de salvar para não sobrescrever silenciosamente uma edição concorrente. Watchers têm debounce e limite; refresh manual continua disponível.

A configuração de sandbox e a existência dos testes não comprovam execução gráfica. Há novas execuções do Electron no Windows com sandbox ativa; o resultado e o alcance estão em [TEST-REPORT.md](TEST-REPORT.md). Tentativas históricas em outros ambientes continuam preservadas no histórico.

Os complementos de amend, tags, stash mutável, merge, cherry-pick e revert permanecem recusados com `NOT_IMPLEMENTED`; a leitura da lista de stash é o único complemento permitido. Não há merge de Layers, transferência de propriedade, commit conjunto ou rede.

## Workshop e terminal integrado (0.1.2)

O workshop entrega fontes, debug separado em dist-debug com sourcesContent, configuração de VS Code e repositórios/perfis/relatórios locais em .workshop. O perfil explícito --lab-profile evita reutilizar o userData normal do aplicativo. O build de produção continua sem mapas.

O processo principal hospeda node-pty e abre PowerShell/ConPTY após ação do usuário; xterm no renderer recebe saída via IPC e envia teclas. Não há servidor WebSocket local nem shell no renderer. O catálogo compartilhado commands.ts gera argumentos literais e prévias; a ação restrita copyCommand valida e copia o texto para a área de transferência. A execução exige colagem e Enter manuais; o antigo IPC terminalCommand foi removido. A CLI executa o Core/Git real. As Tasks de desenvolvimento pertencem ao VS Code.

O módulo node-pty e seus workers/nativos ficam fisicamente em app.asar.unpacked. No pacote Windows só entram prebuilds win32-x64; os caminhos do módulo são resolvidos fora do ASAR para workers e agentes. No PowerShell, helpers restritos à sessão disponibilizam git-layer/git layer e usam JSON para transportar argumentos à CLI compilada. A CLI interativa usa Node instalado 22.12+; o executável gráfico Electron não oferece os handles TTY adequados no Windows. Confirmações e Ctrl+C passam pelo TTY real, sem remover a verificação interativa da CLI.
