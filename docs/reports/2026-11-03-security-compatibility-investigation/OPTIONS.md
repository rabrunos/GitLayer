# Alternativas de proteção e prioridades

A recomendação é **corrigir o coordenador (A), conservar recursos nativos com limites explícitos (B) e oferecer organização voluntária de caminhos (C)**. Worktrees externas com projeção por cópias (D) merecem um protótipo separado apenas se a recuperação da última cópia sincronizada justificar a complexidade. Nenhuma solução foi implementada nesta etapa.

As decisões aprovadas permanecem: Git oficial; branches `layer/<nome>`; arquivos físicos no mesmo projeto; vários históricos e estágios separados; ativação, destino de edição e abertura como branch distintos; Core independente de editor.

## Evidências que orientam a escolha

Dois defeitos atuais exigem correção antes de ampliar o uso:

- **D01 — atribuição indevida após renomeação.** Com target `b`, renomear um arquivo da base pelo Core ou externamente permite que o novo caminho seja reservado para `b`. Renomear externamente um arquivo da Layer `a` também permite essa reserva; o commit de `b` aceita seus bytes. A renomeação **gerenciada de arquivo da Layer `a`** conserva sua origem e recusa add em `b`: essa variante funciona e não deve ser confundida com a falha da base.
- **D02 — publicação de contexto de edição inválido.** Um processo externo cria `between.txt` depois de `walk` e antes de `ls-files` durante a seleção do target. O comando informa sucesso, mas publica `unassigned` contendo o caminho e `before` sem ele; status e reabertura recusam `METADATA_INVALID`. Foi repetido em fixture nova com barreira de intercalação. Isso prova uma janela possível, sem medir sua frequência no uso normal. Os bytes foram preservados; não houve prova de perda de conteúdo nesse caso.

Os riscos de Git direto têm natureza diferente:

- **S01/S02:** switch/checkout comuns para branch que rastreia o caminho da projeção substituíram a edição C pelo conteúdo da branch de destino. S01 ocorreu inclusive com `protect` ativo. O Git comum com arquivo ignorado teve o mesmo efeito; com não rastreado sem ignore recusou. O produto introduz a classificação de arquivos preciosos como ignorados, ampliando a exposição a uma regra nativa.
- **S03/S04:** `--no-overwrite-ignore` recusou a troca e preservou C, HEAD e índices nas variantes testadas. É uma mitigação real por invocação; não altera todas as chamadas externas.
- **Contraprovas adicionais pareadas:** `clean -fX` apagou C da Layer ativa e do controle ignorado; `reset --hard develop` substituiu C por B tanto na projeção quanto no controle não rastreado sem ignore. Foram quatro casos, quatro PASS, zero FAIL, executados em 82,817 s de tempo total de campanha, incluindo setup, snapshots e Git; isso não é benchmark. C não havia sido preparado, não existia como blob Git nem como arquivo de payload exato nos metadados do produto. Os índices privados e metadados permaneceram intactos imediatamente após os comandos. Após clean, o Core representou a ausência como exclusão unstaged; após reset, diagnosticou `PATH_COLLISION`. Diagnóstico posterior não recuperou C.

**R-02/R-03 não foram reabertos:** os seis testes focados atuais passaram. A avaliação de ignore sem o bloco temporário e a prévia com newcomers são partes a preservar nas correções.

A [matriz](MATRIX.json), o [relatório](REPORT.md) e as [reproduções](REPRODUCTIONS.md) identificam comandos, snapshots e evidências. PASS de contraprova destrutiva significa que o efeito foi confirmado, sem transformar a operação em segura ou certificada.

## Fronteira técnica

Ignore protege a preparação comum de arquivos não rastreados, mas não o conteúdo físico. O índice principal não representa a propriedade das Layers; programas externos não conhecem o mapa privado. Inserir ali entradas normais de Layers tornaria seus conteúdos parte do stage da branch de trabalho e exporia o commit nativo a mistura de origens. Selecionar outro índice por processo preserva separação, porém não redireciona outros processos.

Não foi encontrada estratégia simples que preserve integralmente todos os comandos do Git e impeça toda escrita destrutiva sobre os mesmos arquivos físicos. Isso não torna D01 ou D02 inevitáveis: ambos são problemas corrigíveis do coordenador.

## A — Fortalecer as operações gerenciadas

| Dimensão | Avaliação |
| --- | --- |
| 1. Problemas resolvidos | D01 por preservação de origem e tratamento explícito de ambiguidade; D02 por contexto coerente antes da publicação; validação de lotes, refs, índices e planos antes de efeitos. |
| 2. Problemas restantes | Escritas externas entre verificações, comandos que não chamam o Core e bytes destruídos antes de qualquer cópia. |
| 3. Git tradicional | Mantém objetos e comandos. A rota gerenciada pode recusar mais estados, explicando o impedimento. |
| 4. Riscos novos | Recusas excessivas; recuperação automática que sobrescreva edição posterior; retenção de cópias sensíveis e crescimento de disco. |
| 5. Complexidade | Baixa/média para invariantes locais; média/alta para reconciliar refs externas e recuperação. Dispensa daemon e editor. |
| 6. Experiência | Origem e destino visíveis; erro antes de atribuição ou commit incorreto; instrução localizada para resolver ambiguidade. |
| 7. Windows/Linux | Base técnica disponível nos dois. Windows precisa provas de locks, rename, nomes e reparse points; Linux exige execução própria. |
| 8. Dados existentes | Conservar refs, índices, reservas e histórico. Contextos antigos inválidos devem permitir diagnóstico/exportação; não reatribuir arquivos para fazê-los abrir. |
| 9. Desempenho | Estimativa: hashes/varreduras extras custam caminhos e bytes. Agrupar consultas pode reduzir subprocessos. Nenhuma medição comparativa de uma implementação proposta foi feita. |
| 10. Testes | Renomeações por origem/rota; mesmos bytes; stage B/disco C; criação intercalada; alterações de ignore/refs/índices; falhas após efeitos; recuperação com edição posterior. |

O caso gerenciado tem informação que a renomeação externa pode não ter. A comparação de snapshots externos vê remoção e criação, podendo representar rename, cópia ou ações independentes. Hash igual não prova a intenção; hash diferente não prova que a origem mudou. A correção deve usar o conhecimento disponível e recusar/revisar o caso ambíguo, sem transformar o target em transferência implícita.

Para D02, manter a condição estrutural `unassigned ⊆ before` é necessária, mas isoladamente insuficiente. O contexto precisa respeitar a fronteira temporal escolhida, a intenção de ignore e os caminhos já atribuídos. Não basta afrouxar a validação do JSON para aceitar uma combinação incoerente.

## B — Recursos nativos com alcance demonstrado

Combinar índices por origem, exclusões locais, checkpoints alcançáveis, reservas opcionais de worktrees e opções conservadoras nas invocações que as suportam.

| Dimensão | Avaliação |
| --- | --- |
| 1. Problemas resolvidos | Índices separam stage; refs conservam objetos alcançáveis; exclusões reduzem add acidental; reservas impedem seleção nominal comum; no-overwrite-ignore recusou a colisão testada. |
| 2. Problemas restantes | Ignore não protege disco nem conteúdo já preparado; negações superiores, force, clean/reset, plumbing e referências ainda sem reserva. |
| 3. Git tradicional | Usa semântica oficial; regras locais e worktrees extras ficam visíveis e introduzem recusas adicionais em comandos normais. |
| 4. Riscos novos | Reservas obsoletas/alteradas; ferramentas materializam índice ou arquivos na reserva; caminhos e configuração compartilhada exigem cuidado. |
| 5. Complexidade | Baixa para índices/exclusões existentes; média/alta para lifecycle e recuperação confiáveis de reservas. |
| 6. Experiência | Evita erros comuns, com ruído em listagens e possível necessidade de liberação deliberada. Estado local não viaja com push. |
| 7. Windows/Linux | Recursos Git presentes nos dois; topologia, bloqueios, caminhos e versões precisam de prova em cada plataforma. |
| 8. Dados existentes | Opt-in dispensa migração obrigatória. Layer externa/recebida exige reconhecimento e proteção local; não ativar conteúdo por ser recebido. |
| 9. Desempenho | Estimativa: quantidade de reservas/inspeções cresce com Layers; no-checkout evita copiar seu conteúdo. Escala de dezenas/centenas não foi medida. |
| 10. Testes | Seleção comum e bypass; worktree add -f; branch -f/-D/-m; update-ref; remove/prune/repair/move; conteúdo/índice/lock desconhecido; clone/fetch/push locais; interrupções. |

**Manter `protect` opcional.** Sua prevenção nominal funcionou e sua ausência não deve ser ocultada. Torná-lo padrão é decisão pendente: cria topologia extra, impede alguns comandos legítimos e não protege projeções contra outra branch tradicional. Exigir provas de instalação/desinstalação idempotente, recuperação, clientes externos e escala antes dessa mudança.

Comparação de variantes:

| Variante | Benefício | Custo ou fronteira |
| --- | --- | --- |
| Apenas recusa gerenciada | Menos estado local. | Nenhuma prevenção na seleção direta pelo Git; GL-22 permanece parcial. |
| Reservas atuais de worktrees | Prevenção nominal real antes da troca. | Bypass e manutenção local; continuam parciais. |
| Lock adicional de worktree | Pode reduzir prune/move/remove acidental. | Não impede ignore-other-worktrees/update-ref; exige adaptar o produto, que hoje recusa reserva locked. É proposta não testada. |
| Ref extra ou index.lock permanente | Nenhum benefício universal demonstrado. | Ref não é ACL; lock permanente bloqueia Git legítimo e não escritores externos. Não recomendado. |

Modificar automaticamente .gitignore para elevar prioridade não é solução equivalente: altera arquivos do usuário/projeto, negações mais próximas ainda podem prevalecer e force continua válido. Não substituir uma proteção limitada por mudanças silenciosas nos controles do repositório.

## C — Organização voluntária de caminhos no projeto

Diretórios disjuntos por convenção, por exemplo ferramentas/ e automacao/, podem reduzir colisões. Arquivos continuam físicos no mesmo projeto; branches continuam `layer/<nome>`; caminhos distribuídos continuam permitidos. Não mover conteúdo existente nem impor esse desenho.

| Dimensão | Avaliação |
| --- | --- |
| 1. Problemas resolvidos | Reduz colisões previsíveis e facilita revisão humana; política opcional de escopo pode diagnosticar saídas do combinado. |
| 2. Problemas restantes | Force, clean/reset, uma branch futura que rastreie o mesmo caminho e mudanças fora do escopo. |
| 3. Git tradicional | Convenção de arquivos, sem mudar comandos. Mover arquivos pode exigir ajustar scripts/imports por decisão do projeto. |
| 4. Riscos novos | Quebra de builds por imposição; falsa sensação de isolamento; diretórios continuam podendo reunir origens. |
| 5. Complexidade | Baixa para orientação; média para política opcional versionada. Migração automática não aprovada. |
| 6. Experiência | Útil para scripts/IA já separados; inadequado como obrigação para Layers distribuídas pela árvore. |
| 7. Windows/Linux | Portátil dentro das regras de nomes, caixa e Unicode; scripts exigem sua própria portabilidade. |
| 8. Dados existentes | Adoção voluntária em novos conteúdos; nenhuma reivindicação ou migração silenciosa. |
| 9. Desempenho | Estimativa: escopos poderiam reduzir enumeração, se corretos. Não retirar a varredura de segurança sem análise própria; sem medição. |
| 10. Testes | Colisões futuras da base, diretórios compartilhados, criação/rename fora do escopo, Layers antigas e off preservando arquivos alheios. |

É uma redução de probabilidade, sem substituir A/B ou reduzir o comportamento aprovado.

## D — Worktrees autoritativas externas e projeção por cópias

Cada origem mantém worktree real separada e o projeto composto recebe cópias regulares. Refs/objetos continuam Git. Edições no composto precisam voltar à origem correta; essa reconciliação é parte essencial da proposta.

| Dimensão | Avaliação |
| --- | --- |
| 1. Problemas resolvidos | Uma cópia sincronizada permite restaurar aquele estado após destruir a projeção; índices nativos existem por worktree. |
| 2. Problemas restantes | A edição mais recente só no composto ainda pode perder-se; rename externo e causalidade continuam ambíguos. |
| 3. Git tradicional | Git oficial em cada worktree; papel do composto precisa ser claro, sem redirecionamento oculto de comandos. |
| 4. Riscos novos | Duas versões editáveis, conflitos, cópias divergentes e mais estados de recuperação. |
| 5. Complexidade | Alta: sincronização bidirecional, identidade, checkpoints e falhas em múltiplos diretórios. |
| 6. Experiência | Ajuda a recuperar o último estado sincronizado, mas deve mostrar onde está a edição mais recente; sem exigir vários editores. |
| 7. Windows/Linux | Worktrees/cópias disponíveis nos dois; não presumir overlay comum nem tratar symlinks/hardlinks como equivalentes certificados. |
| 8. Dados existentes | Conversão opt-in com inventário/cópia verificada, índices existentes e origem preservados. Nenhuma migração real nesta etapa. |
| 9. Desempenho | Estimativa: mais disco, hashes e I/O por bytes sincronizados; objetos compartilhados não eliminam cópias de trabalho. Sem comparação medida. |
| 10. Testes | Edições concorrentes, clean no composto, cópia interrompida, stage B/disco C, rename/remove, abrir como branch, clone/move/prune e recuperação conservadora. |

D só será melhor se suas provas compensarem a complexidade. Não resolve D01/D02 automaticamente. Workspace apenas virtual no editor contrariaria os arquivos físicos aprovados; links também não entregam isolamento da escrita. Não se recomenda substituir agora a arquitetura por essas variantes.

## Mecanismos complementares e opções rejeitadas

- **Hook pre-commit local:** pode recusar certos commits contaminados; roda depois de add, admite --no-verify/configuração alternativa e não impede clean/reset/checkout. O Core atual restringe hooks; coexistência exigiria projeto próprio. Não é proteção mínima obrigatória.
- **Post-checkout:** roda depois da atualização e não pode vetar os efeitos já aplicados. Código de erro não prova ausência de escrita. [Manual oficial](https://git-scm.com/docs/githooks#_post_checkout).
- **Alias/wrapper:** aliases que escondem comandos existentes são ignorados. Wrapper só cobre suas invocações; executável absoluto evita a rota. Não é proteção universal. [git-config](https://git-scm.com/docs/git-config#Documentation/git-config.txt-alias).
- **Watcher:** pode sinalizar mudanças ou reduzir latência de cópia, sem decidir propriedade. Node documenta ausência de eventos ao mover diretório observado no Windows, ausência de novos eventos da inode substituta em determinados casos Linux e filename não garantido. Não assegura copiar bytes antes de exclusão. [Node 22, fs.watch caveats](https://nodejs.org/docs/latest-v22.x/api/fs.html#caveats).
- **assume-unchanged/skip-worktree:** não são política de proteger mudanças ou excluir conteúdos de commit. A FAQ desencoraja esse uso; comandos têm suporte parcial ao bit. [gitfaq](https://git-scm.com/docs/gitfaq#_common_issues), [git-update-index](https://git-scm.com/docs/git-update-index#_skip_worktree_bit).
- **ACLs/read-only/interceptação global:** mudam o ambiente e não compõem uma opção de baixa complexidade dentro do escopo. Não instalar hooks, aliases, watchers ou bloqueios globais para simular prevenção.

## Efeito operacional adicional das reservas (R-04 / S20)

A reserva sem checkout é uma worktree Git real. Status mostrou `D scripts.txt` sem criar índice; já `git -C <reserva> commit -a -m ...` criou commit de árvore vazia na Layer. A projeção principal e o commit pai foram preservados, e o Core diagnosticou PROTECTION_CONFLICT pelo índice externo. Isso é risco operacional nativo introduzido pela topologia de B, distinto de corrupção ou perda irrecuperável. Ferramentas que operem todas as worktrees precisam ser testadas. Incluir S13/S20 na aceitação P1 de instalação, remoção e diagnóstico de reservas; preservar refs/objetos/índice externo e oferecer reparo explícito. Reforça manter opt-in até decisão, sem afirmar que a reserva seja isolamento de conteúdo.

## Prioridades e critérios de aceitação

| Prioridade | Recomendação | Aceitação e testes necessários |
| --- | --- | --- |
| **P0 — D01** | Preservar origem em renomeação conhecida; impedir atribuição temporal otimista quando há ambiguidade externa. | Base renomeada pelo Core sob target b continua da base ou é recusada; nunca reservada a b. Layer a renomeada pelo Core conserva a. Remoção/criação externa ambígua não vira b silenciosamente. Cobrir bytes iguais/diferentes, stage B/disco C, base/a/b, rename e cópia+remoção; validar índices, reservas e blobs dos commits. |
| **P0 — D02** | Publicar contexto de edição coerente ou recusar preservando o contexto anterior. | Repetir criação entre walk/ls-files e entre validação/publicação. Comando só retorna sucesso com contexto reabrível e baseline coerente; caso instável recusa de forma segura. Arquivos, índice principal e privados preservados. Cobrir exclusão/rename/mudança rápida de ignore e troca/end de target; manter seis R02/R03. Não afrouxar schema para esconder a falha. |
| **P0 — exposição de conteúdo** | Tornar a perda possível em troca nativa comum parte explícita da condição de uso; oferecer rota segura demonstrada, sem prometer que protect cobre arquivos. | Conservar S01/S02 e controles; S03/S04 preservam C, HEAD e índices. Troca gerenciada compatível conserva Layers, stage e disco; colisão até com bytes iguais recusa. Ajuda/diagnóstico não recomenda switch/checkout simples como seguros com projeções ativas. Esta mitigação não torna toda invocação externa segura. |
| **P1** | Diagnosticar contaminação e ignore por cenário, com saída conservadora. | Negação preexistente/posterior, add -f e commit já preparado são distinguidos; próxima operação não atribui a nova origem para silenciar o problema; exportação e orientação preservam provas. |
| **P1** | Clarificar fronteira temporal de target e ambiguidades externas. | Matriz 0/1/várias Layers, entry/switch/end, prévios/novos/ignorados, rename externo de base/Layer/sem dono. Estado mostra o destino real; não exige editor ou comando especial para criar arquivos. |
| **P1** | Aperfeiçoar lifecycle de protect sem alterar seu default. | Nova Layer externa informa unprotected; reaplicar idempotente; reservas removidas/alteradas/ocupadas/locked nunca são apagadas sem prova; testar interrupções, rename/ref-delete, clone/fetch/push e efeitos em clientes/listagens. |
| **P1** | Documentar comandos destrutivos por variante e diferença entre bytes persistidos e trabalho só no disco. | Manter contraprovas clean -fdx/-fX e reset com/sem destino. Demonstrar dry-run quando suportado. Nunca prometer recuperar C que não entrou em objeto/cópia. Sem interceptação global. |
| **P2** | Organização/escopos opcionais. | Sem migração silenciosa; paths fora do escopo diagnosticados; Layers antigas e diretórios compartilhados preservados. |
| **P2** | Protótipo D ou cópias opcionais de trabalho externo. | Medir disco/I/O e conflitos; testar falhas e restauração; declarar intervalo sem garantia. Aprovar retenção/privacidade antes da implementação desse comportamento. |
| **P2** | Ampliar o envelope por plataforma/versão. | Execuções Windows/Linux independentes, Git mínimo/atual, locks/long paths/reparse/modos; recusa, skip e suporte são resultados diferentes. Sem rodada de desempenho geral nesta etapa. |

A prioridade de exposição não classifica o comportamento nativo como defeito do Git. Ela indica que uma perda comprovada deve ser tratada antes de ampliar o uso. D01/D02 exigem mudanças do produto; a rota nativa exige limites claros e mecanismos opcionais de alcance demonstrado.

## Decisões para a próxima etapa

1. **Proteção de branch:** manter opt-in, recomendado, ou aprovar default depois das provas operacionais, aceitando worktrees extras visíveis.
2. **Mudança externa ambígua:** recomendar recusa/revisão localizada. Aprovar uma política contextual diferente somente com consequências claras; snapshots não revelam intenção.
3. **Cópia de trabalho externo:** decidir se deseja retenção adicional, com custo de espaço e privacidade. Isso não é stage, commit ou shelf automático e não garante o intervalo anterior à cópia.
4. **Organização:** aceitar convenção voluntária quando ajudar, sem impor estrutura nem migrar arquivos existentes.
5. **Arquitetura D:** decidir se vale um protótipo isolado; não aprovar de antemão migração ou substituição da composição atual.
6. **Limite de uso:** decidir se a próxima versão pode continuar com Git direto destrutivo sem garantia universal, desde que a rota segura e os limites sejam explícitos. Tornar todo Git direto preventivo exigiria outra fronteira de execução/isolamento; não foi demonstrada uma solução equivalente sem efeitos de compatibilidade.

Corrigir D01/D02 não significa concluir integralmente os cinco requisitos. **GL-01, GL-09, GL-15, GL-18 e GL-22 permanecem parciais frente a todo Git direto e escritores externos**, mesmo com operações gerenciadas mais seguras. Seus comportamentos verificados devem avançar por variante, sem reduzir o contrato aprovado ou rotular bypass como prevenção.

## Fontes oficiais e alcance

A investigação usou Git **2.53.0.windows.2**. Fontes da tag upstream v2.53.0 fixam a semântica da série; não são certificação de outra compilação/plataforma.

- [gitignore v2.53.0](https://github.com/git/git/blob/v2.53.0/Documentation/gitignore.adoc): precedência .gitignore/info/exclude/excludesFile; negações e arquivos já rastreados.
- [git-add v2.53.0](https://github.com/git/git/blob/v2.53.0/Documentation/git-add.adoc): ignorados, force, -A, preparação no instante do comando.
- [git-commit v2.53.0](https://git-scm.com/docs/git-commit/2.53.0): índice preparado; -a e pathspec têm semânticas próprias.
- [git-checkout v2.53.0](https://git-scm.com/docs/git-checkout/2.53.0): overwrite de ignorados padrão; opção conservadora por invocação.
- [git-switch v2.53.0](https://github.com/git/git/blob/v2.53.0/Documentation/git-switch.adoc): troca não exige sempre índice limpo; exceções e bypass de worktree.
- [git-clean](https://git-scm.com/docs/git-clean) e [git-reset v2.53.0](https://github.com/git/git/blob/v2.53.0/Documentation/git-reset.adoc): efeitos destrutivos nativos demonstrados.
- [git, variáveis de ambiente](https://git-scm.com/docs/git#_environment_variables): GIT_INDEX_FILE seleciona índice por processo.
- [git-worktree v2.53.0](https://git-scm.com/docs/git-worktree/2.53.0) e [git-branch](https://git-scm.com/docs/git-branch/2.51.0): topologia local, recursos de force/lock/repair e recusas adicionais de branch.
- [git-fetch v2.53.0](https://git-scm.com/docs/git-fetch/2.53.0), [git-push v2.53.0](https://git-scm.com/docs/git-push/2.53.0), [git-clone](https://git-scm.com/docs/git-clone/2.52.0): refs/objetos transportados e estado local distinto. Push --all inclui branches Layer; mirror alcança refs privadas também.

Nenhuma medição de alternativa ainda não implementada foi apresentada como fato. A campanha adicional de quatro contraprovas é evidência de efeitos, com setup/snapshots incluídos em seu tempo; não compara throughput, latência ou escala das estratégias.
