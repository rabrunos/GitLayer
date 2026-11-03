# Estudo versionado do Git oficial

Preparação de 18/10/2026, America/Sao_Paulo. O binário inventariado é `C:\Program Files\Git\cmd\git.exe`, versão **2.53.0.windows.2**, commit de build `e9edee0b34751bf4d7d1feda0e2535bff64d4e77`, x86_64, ref-format padrão files, hash padrão sha1. O build anuncia SHA-256 e fsmonitor daemon; anúncio não substitui experimento de capacidade. Não foi instalado ou atualizado Git global.

## Recortes e graus de exame

O [catálogo recebido](reference/02-Catalogo-Git-v2.json) permanece fixado em **v2.56.0**, 161 comandos/ferramentas + 14 guias + 8 interfaces + 11 formatos/protocolos = 194 entradas. A comparação de nomes com [command-list v2.53.0](https://github.com/git/git/blob/v2.53.0/command-list.txt) e [v2.56.0](https://github.com/git/git/blob/v2.56.0/command-list.txt) foi consultada em fontes primárias. [Tokens normalizados](upstream/classification-v2.53-v2.56.json) preservam versões/URLs e a exceção `git-stage`, sem categoria primária na lista. Não são cópias byte a byte dos arquivos upstream.

| Medida documental | Quantidade | O que significa |
| --- | ---: | --- |
| Comandos/ferramentas fixados | 161 | Inventário do recorte, sem afirmar todas opções estudadas |
| Fichas com nota semântica dirigida | 82 | Leituras/efeitos/opções em foco e relação com roteiros |
| Fichas com triagem semântica | 79 | Efeitos individuais e limites; opções extraídas, exame de opções incompleto |
| Fichas só catálogo/fonte por revisar | 0 | As seis anteriores receberam leitura primária web dirigida; ausência de manual local permanece |
| Rótulos `::` extraídos dos manuais locais | 2003 | Extração mecânica, não 2003 opções examinadas/executadas |
| Menções de opções/subcomandos em foco | 387 | Soma com sobreposição; candidatos de grupo ausentes no manual do comando foram separados; não unidades de cobertura |
| Guias/interfaces/formatos | 33 | 8 conceitos com exame dirigido; demais inventariados, sem leitura integral alegada |

As [fichas Markdown](FICHAS-COMANDOS.md) e [JSON](fichas-comandos.json) registram para cada comando invocação, versão/capacidade, origem, leitura/escrita, opções, IDs relacionados e grau. As 79 triagens complementam a extração com o papel individual e os efeitos do comando, sem se apresentarem como revisão exaustiva de suas opções. Extração literal não expande includes, configurações ou todas opções de subcomandos. Nenhuma ficha certifica comportamento do produto; use os resultados independentes da rodada.

## Diferenças 2.53 → 2.56

No inventário upstream comparado, 190 entradas passam a 194: entram três comandos e um guia, sem remoção de nomes. Isso é diferença de catálogo, não diff completo de comportamento/opções/releases.

| Entrada adicionada no recorte | Semântica examinada | Limite local |
| --- | --- | --- |
| `git-history` | Reescrita experimental por drop/fixup/reword/split; atualização padrão pode alcançar branches descendentes; dry-run ainda escreve objetos; fixup lê índice | Não listado como builtin local; nenhuma execução alegada. [Manual v2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-history.adoc) |
| `git-format-rev` | Formata revisões recebidas em stdin nos modos revs/text; separação NUL pode ser escolhida por entrada/saída | Não listado local; experimental. [Manual v2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-format-rev.adoc) |
| `git-url-parse` | Valida sintaxe e extrai scheme/user/password/host/port/path; URL válida não significa transporte suportado | Ausente do builtin local; sem conexão de rede. [Manual v2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-url-parse.adoc) |
| `gitdatamodel` | Explica objetos, refs, índice e reflogs; não introduz por si um formato Layer | Guia novo na lista comparada; não supor que todos manuais surgiram no mesmo release. [Guia v2.56](https://git-scm.com/docs/gitdatamodel/2.56.0) |

Na instalação: 131 entradas do catálogo aparecem no inventário de builtins, 19 têm arquivo no exec-path sem invocação e 11 não foram achadas por esses dois meios. Este último grupo **não significa ausência em toda instalação/PATH**: gitk e outros componentes podem estar em diretórios diferentes. Não foram executados binários externos desconhecidos. Nove entradas não têm `.adoc` correspondente na pasta instalada. Os nomes e hashes estão no [inventário JSON](inventario-git.json), com sete comandos de leitura e suas saídas/códigos.

Há ainda builtins internos/adicionais fora do catálogo fixado, incluindo helpers e `survey`; permanecem separados. Não atualizar silenciosamente o baseline por nomes descobertos. Manual instalado é fonte primária distribuída com o Git local, com hash, mas seus patches Windows não são idênticos por definição à tag upstream 2.53.0. As versões mínimas de todas opções não foram determinadas nesta rodada.

## Modelo e contratos observáveis

O [estado e a direção de produto](ARQUITETURA-E-CONTRATOS.md) separam Git, implementação e U-xx. Esta tabela organiza o exame por mecanismo; vínculos nominais são roteiro de cobertura, não execução garantida.

| Tema | Semântica relevante e observação independente | Relações na matriz | Fonte primária |
| --- | --- | --- | --- |
| Objetos/grafo | Blob/tree/commit/tag são objetos identificados por conteúdo. Comparar pais/tree/bytes/modos; compressão/deltas físicos não tornam commit um patch | OBJECT, COMMIT, INSPECT | [gitdatamodel](https://git-scm.com/docs/gitdatamodel/2.56.0), [cat-file](https://github.com/git/git/blob/v2.53.0/Documentation/git-cat-file.adoc) |
| Índice/stages | Índice escolhido por subprocesso, normalmente por worktree. Stage 0 resolvido; 1/2/3 base/ours/theirs. write-tree não resolve conflito | INDEX, MERGE, LAYOUT-011 | [gitformat-index](https://github.com/git/git/blob/v2.53.0/Documentation/gitformat-index.adoc), [read-tree](https://github.com/git/git/blob/v2.53.0/Documentation/git-read-tree.adoc) |
| Alternativo/flags | GIT_INDEX_FILE é índice real; cacheinfo/index-info permitem escrita nativa. skip-worktree e assume-unchanged são flags, não propriedade permanente | WORKTREE-011/012/013, OBJECT-009 | [update-index](https://github.com/git/git/blob/v2.53.0/Documentation/git-update-index.adoc), [ambiente](https://git-scm.com/docs/git/2.53.0) |
| Sparse/split | Sparse pode representar diretórios fora do cone; split depende de sharedindex. Formato 4 comprime caminhos. Snapshot binário e semântico respondem questões diferentes | WORKTREE-010/011/012, ENV, PATH | [sparse-checkout](https://github.com/git/git/blob/v2.53.0/Documentation/git-sparse-checkout.adoc), formato/índice acima |
| Refs/reflogs | OID esperado permite CAS; refs podem ser files/packed/reftable. Reflogs locais e expiráveis não são backup eterno | REF, BRANCH, RECOVERY | [update-ref](https://github.com/git/git/blob/v2.53.0/Documentation/git-update-ref.adoc), [reflog](https://github.com/git/git/blob/v2.53.0/Documentation/git-reflog.adoc) |
| Hash/backend | init pode selecionar sha1/sha256 e backend disponível. Descobrir formato/caminho pelo Git; não fixar 40 caracteres ou refs soltas | INIT, ENV, REF | [init](https://github.com/git/git/blob/v2.53.0/Documentation/git-init.adoc), [rev-parse](https://github.com/git/git/blob/v2.53.0/Documentation/git-rev-parse.adoc) |
| Topologia | `.git` pode ser gitfile; HEAD/índice são por worktree, objetos e muitas refs compartilhados. Bare não possui worktree normal | INIT, WORKTREE, LAYOUT | [layout](https://github.com/git/git/blob/v2.53.0/Documentation/gitrepository-layout.adoc), [worktree](https://git-scm.com/docs/git-worktree/2.53.0) |
| EOL/atributos/filtros | Conteúdo canônico de blob pode diferir do disco. clean atua na entrada, smudge na saída; process filter é protocolo com subprocesso | PATH, HOOK, INDEX | [gitattributes](https://github.com/git/git/blob/v2.53.0/Documentation/gitattributes.adoc), [check-attr](https://github.com/git/git/blob/v2.53.0/Documentation/git-check-attr.adoc) |
| Ignore/add/commit | Ignore impede adição normal de novo caminho, não transforma tracked nem protege contra force. add prepara; commit cria snapshot de índice | INDEX, LAYER, COMMIT, MODEL | [add](https://github.com/git/git/blob/v2.53.0/Documentation/git-add.adoc), [gitignore](https://github.com/git/git/blob/v2.53.0/Documentation/gitignore.adoc) |
| Checkout/clean/stash | Checkout pode substituir ignorados conforme modo; clean -x inclui e -X limita a ignorados; stash -u/-a diferem. Nenhuma regra Layer é inferida do prefixo | BRANCH, STASH, RECOVERY | [checkout](https://github.com/git/git/blob/v2.53.0/Documentation/git-checkout.adoc), [clean](https://github.com/git/git/blob/v2.53.0/Documentation/git-clean.adoc), [stash](https://github.com/git/git/blob/v2.53.0/Documentation/git-stash.adoc) |
| Hooks/sequencer | Eventos têm fases diferentes; post-checkout é posterior. Continue/abort/skip dependem estado do sequencer. Hook sintético prova interface oficial | HOOK, REWRITE, MERGE | [githooks](https://github.com/git/git/blob/v2.53.0/Documentation/githooks.adoc), [rebase](https://github.com/git/git/blob/v2.53.0/Documentation/git-rebase.adoc) |
| Subcomando/bypass | Despacho de `git layer` para executável externo não redefine builtin switch/checkout; caminho absoluto do Git alcança implementação nativa | ENV-002, BRANCH-017/018/019/020 | [git.c v2.53](https://github.com/git/git/blob/v2.53.0/git.c), [manual git](https://git-scm.com/docs/git/2.53.0) |
| Clone/transporte | Refspecs selecionam refs; push envia objetos associados, nunca índice como stage. Clone local pode usar hardlinks; isolar GC/corrupção | REMOTE, INIT, PROTO | [push](https://git-scm.com/docs/git-push/2.53.0), [clone](https://github.com/git/git/blob/v2.53.0/Documentation/git-clone.adoc) |
| Protocolo/credenciais | v2 separa anúncio ls-refs e fetch; capacidades negociadas (filtro/object-format) não implicam servidor disponível. Helpers só sintéticos | PROTO, REMOTE, HOOK | [protocol-v2](https://github.com/git/git/blob/v2.53.0/Documentation/gitprotocol-v2.adoc), [credential](https://github.com/git/git/blob/v2.53.0/Documentation/git-credential.adoc) |
| Retenção/manutenção | Refs/checkpoints, reflogs, expiração, cruft e concorrência afetam coleta. fsck distingue integridade e alcançabilidade; manutenção não é migração de produto | REF, RECOVERY, MODEL | [gc](https://github.com/git/git/blob/v2.53.0/Documentation/git-gc.adoc), [fsck](https://github.com/git/git/blob/v2.53.0/Documentation/git-fsck.adoc), [maintenance](https://github.com/git/git/blob/v2.53.0/Documentation/git-maintenance.adoc) |

## Fontes de código/testes e limites

### Discrepância versionada reference-transaction

**GIT253-REFERENCE-TRANSACTION-ABORTED / HOOK-008.** O manual [githooks v2.53.0](https://github.com/git/git/blob/v2.53.0/Documentation/githooks.adoc#reference-transaction) afirma que uma recusa na fase prepared não dispara a fase aborted. O ensaio HOOK-008 desta rodada no Git **2.53.0.windows.2** observou a sequência prepared → aborted na transação recusada; a ref recusada permaneceu ausente. A transação aceita anterior observou prepared → committed. O resultado e os streams pertencem à evidência da variante, não a uma leitura de ajuda.

O [código refs.c v2.53.0, linhas 2416–2444](https://github.com/git/git/blob/v2.53.0/refs.c#L2416-L2444) explica a observação: o retorno não zero do hook prepared chama `ref_transaction_abort`, e essa rotina chama o hook aborted. Trata-se de divergência entre documentação, código e observação versionados; não de defeito confirmado do Git Layer. A asserção do harness foi alinhada à implementação nativa e ao estado observado, com esta justificativa, sem mudar o produto nem silenciar a divergência. Outras versões/backends não foram automaticamente certificados.

Foi examinado o despacho/inventário em [git.c v2.53.0](https://github.com/git/git/blob/v2.53.0/git.c), incluindo a diferença entre builtin, alias e comando externo. [t2400-worktree-add.sh v2.53.0](https://github.com/git/git/blob/v2.53.0/t/t2400-worktree-add.sh) foi consultado como fonte primária de cenários de worktree. Não foi importado nem executado o teste upstream; ele não certifica Layers. Tentativas web de obter t2100-update-cache e t3001-ls-files-others-exclude não retornaram conteúdo nesta sessão, portanto não são consideradas leituras concluídas. O mesmo vale para alguns redirects dos manuais versionados; para as matérias correspondentes foram usados `.adoc` oficiais locais e links fixos de fonte.

O acesso HTTPS por PowerShell/curl falhou com TLS/SChannel; não foi alterada configuração de sistema nem desabilitada validação de certificados. A comparação de catálogo foi feita pelo navegador de documentação web, com parsing da saída e sem alegar hash de download bruto. O material recebido permanece byte a byte preservado em reference, verificado contra sua origem local.

Não foram examinadas integralmente todas opções dos 161 comandos, todos guias ou todas mudanças entre releases. As seis fichas anteriormente só de catálogo foram elevadas a exame semântico dirigido por fontes primárias web, sem alterar o escopo de execução. As 79 triagens continuam com revisão de opções incompleta. Não houve execução visual de GUI oficial nem pontes que exigem outros sistemas/serviços. A documentação não é certificação completa de compatibilidade.

## Complemento documental das seis fichas sem manual local

As primeiras tentativas raw em v2.56 devolveram cache miss e continuam excluídas da evidência de leitura. Nesta extensão foram consultados os manuais oficiais publicados em git-scm.com, incluindo descrição, opções/configuração pertinentes, limitações e histórico por versão. Fichas/JSON preservam o recorte consultado e a data; não se alega download bruto, hash do HTML, leitura integral ou execução. Os históricos consultados indicam ausência de alterações documentais cobrindo 2.53–2.56; isto não demonstra igualdade dos binários ou versões mínimas de cada opção.

| Ficha / fonte primária consultada | Última mudança do manual indicada | Relação / escopo preservado |
| --- | --- | --- |
| [git-archimport](https://git-scm.com/docs/git-archimport) | 2.35.0 | LEGACY-007 / OFFICIAL_BRIDGE_INVENTORY_ONLY |
| [git-cvsexportcommit](https://git-scm.com/docs/git-cvsexportcommit) | 2.35.0 | LEGACY-005 / OFFICIAL_BRIDGE_INVENTORY_ONLY |
| [git-cvsimport](https://git-scm.com/docs/git-cvsimport) | 2.43.1 | LEGACY-005 / OFFICIAL_BRIDGE_INVENTORY_ONLY |
| [git-cvsserver](https://git-scm.com/docs/git-cvsserver) | 2.50.0 | LEGACY-006 / OFFICIAL_BRIDGE_INVENTORY_ONLY |
| [git-p4](https://git-scm.com/docs/git-p4) | 2.52.0 | LEGACY-004 / OFFICIAL_BRIDGE_INVENTORY_ONLY |
| [gitweb](https://git-scm.com/docs/gitweb) | 2.50.0 | TOOLS-003 / OFFICIAL_HEADLESS_WHEN_AVAILABLE |

O complemento acrescenta 32 focos documentais de opção/configuração, sobrepostos e sem denominador funcional. Rótulos locais extraídos permanecem 2003, manuais locais ausentes permanecem nove; disponibilidade, variantes e resultado da rodada canônica não foram reclassificados por leitura documental. Gitweb teve inventário headless em TOOLS-003; conteúdo do manual não transforma o bloqueio do CGI observado em PASS.
