# Arquitetura mínima

JavaScript ESM com APIs nativas do Node.js e subprocessos Git por argv, sem shell e sem dependências npm. O coordenador não implementa objetos, formato de índice ou histórico. O estado versionado pertence ao Git.

## Estado

- `refs/heads/layer/<nome>`: commit atual e histórico da Layer.
- `.git/git-layer-lab/indexes/`: um índice Git nativo por Layer, com nome codificado em base64url.
- `.git/git-layer-lab/state.json`: estado auxiliar de ativação.
- `.git/info/exclude`: bloco local gerenciado de caminhos exatos das Layers, preservando as demais regras locais.

O coordenador descobre os caminhos do repositório pelo Git. Não mantém cache persistente de conteúdo nem cópia paralela dos arquivos versionados. O HEAD e o índice principal pertencem à branch convencional durante todos os comandos de Layers.

## Comandos nativos

| Fluxo | Mecanismo |
| --- | --- |
| Criar | `mktree` para árvore vazia, `commit-tree` sem pai, `update-ref` para a branch e `read-tree` no índice próprio. |
| Ativar | `GIT_INDEX_FILE` seleciona o índice; `checkout-index -a -f -u` extrai tudo em um processo e atualiza stat no índice. |
| Desativar | `diff` compara índice, commit da Layer e disco; uma Layer limpa tem seus arquivos removidos pelo Node. Diretórios permanecem. |
| Preparar | `ls-files`, `ls-tree` e `add` selecionam próprios e novos livres; lotes NUL evitam argv por arquivo e limites de linha de comando. |
| Commit | `write-tree` lê a árvore preparada; `commit-tree -p <tip-layer>` cria o commit; `update-ref` avança só a Layer. |
| Estado e histórico | `diff`, `for-each-ref` e `log`, interpretados pelo próprio Git. |

O primeiro commit é raiz independente, com árvore vazia. Commits seguintes apontam para o tip da própria Layer. Identidade e mensagem seguem o Git; não há troca temporária de HEAD ou chamada a `git commit` com índice alternativo.

## Seleção do add

A propriedade é derivada da união entre árvore commitada e índice de cada origem. Assim, novos arquivos preparados pertencem à origem escolhida, e uma exclusão preparada não libera o caminho antes do commit. A mesma regra vale para a aplicação e todas as Layers, inclusive inativas.

Arquivos próprios selecionados podem ser preparados apesar da exclusão local. Novos livres são enumerados por `ls-files --others --exclude-standard` com o índice convencional e filtrados contra todas as origens; seu add não usa force. Regras usuais de ignore continuam valendo para esses arquivos. Nomes enumerados são tratados como literais.

O cwd da consulta conserva o significado de `.` e de diretórios relativos. Os caminhos finais são enviados ao Git em lote, sem uma operação Git por arquivo. Uma exclusão preparada seguida de recriação continua sendo tratada como caminho próprio.

## Escopo deliberado

A materialização escreve diretamente no worktree. A desativação remove arquivos individualmente; não exige pastas exclusivas e não move diretórios compartilhados. Não há journals, backups transacionais, locks próprios, rollback ou recuperação automática. As [limitações](LIMITATIONS.md) fazem parte do contrato deste laboratório; os [benchmarks](BENCHMARKS.md) registram o custo completo medido.
