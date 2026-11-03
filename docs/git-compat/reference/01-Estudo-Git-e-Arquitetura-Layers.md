# Git oficial e Git Layer — estudo revisado v2

**18/10/2026 | Projeto consultado: `37887aad107bd751a3687bc660a6644ef5d90c54`.**

As decisões de escopo estão em `06-Decisoes-e-Autonomia.md`. Esta é uma base de investigação, não um desenho técnico fechado para o futuro produto. As referências [Sxx]/[Pxx] estão em `07-Fontes-e-Proveniencia.md`.

## 1. O que já foi levantado e o que falta comprovar

O pacote mantém o catálogo v1 baseado em `command-list.txt` do Git v2.56.0: 161 entradas de comandos/ferramentas e 33 entradas de guias/interfaces/formatos. A v2 preserva os 320 IDs originais, revisa o escopo e adiciona 24 roteiros, totalizando 344 especificações em 24 famílias. [S02]

Nenhum Git, Core, CLI ou teste do produto foi executado na elaboração deste pacote. A validação feita aqui é dos documentos, JSONs, IDs, relações e integridade dos arquivos. O inventário é um recorte versionado, não uma afirmação de todas as opções de todos os comandos terem sido examinadas ou de compatibilidade comprovada. O Codex deve conferir o binário instalado, completar fichas de opções, realizar experimentos e registrar fontes/versões.

O alvo atual é o Git oficial. Componentes gráficos oficiais podem permanecer inventariados, mas suas janelas não serão abertas nesta etapa. Aplicações externas e outras implementações do Git ficam adiadas. Esses itens são contados separadamente; não somem do inventário e não viram testes aprovados.

## 2. O que o Git representa

Blobs representam conteúdo; trees associam nomes e modos a objetos; commits apontam para uma tree raiz e seus pais; refs fornecem nomes mutáveis para o histórico. Uma branch não possui uma pasta de cópias de seus arquivos. Compressão/deltas de packs não mudam esse modelo lógico. [S04, S05]

```text
HEAD → refs/heads/main → commit → tree → blobs e subtrees
       refs/heads/layer/scripts → outro commit → outra tree
```

A segunda linha descreve a convenção atual do projeto, não um tipo novo reconhecido pelo Git. [P01]

**Correção importante de vocabulário:** o Git não cria um índice permanente para cada branch. Normalmente há um índice por worktree; trocar branch reutiliza esse contexto. `GIT_INDEX_FILE` seleciona um índice alternativo para um subprocesso. O índice prepara conteúdo para commit, não para push: push publica refs e objetos associados, não o staging local. [S03, S06, S09, S16]

Logo, o objetivo é reutilizar índices Git reais e seu funcionamento, sem assumir que já existem índices próprios de cada branch prontos para serem “direcionados”. O projeto já utiliza índices alternativos reais. Como coordená-los no produto futuro é uma questão de engenharia a ser investigada pelo Codex quando autorizada. [P01]

## 3. Reutilizar significa usar o formato real, não copiar sua aparência

A intenção do usuário é máxima reutilização e familiaridade. Quando o Git oferece um índice adequado, o arquivo deve ser operável pelas ferramentas nativas, não uma imitação JSON chamada `index`. Quando oferece objetos e referências, estes devem continuar sendo objetos e refs reconhecidos pelo Git. [U-04; S03, S06, S11]

Isso não obriga a duplicar `objects/`, `refs/` ou toda a árvore de `.git` dentro do armazenamento privado. Tampouco exige remover informações de coordenação que sejam realmente necessárias. Repetir um OID para reconhecer a versão-base de uma transação pode ter função de concorrência, diferente de inventar um segundo histórico. [P01]

Índices são formatos binários com versões, flags, extensões e estágios de conflito. Um arquivo “quase igual” não garante compatibilidade. Qualquer futura adaptação precisa ser demonstrada com leitores/escritores do Git oficial; detalhes que não pertencem ao índice podem precisar de armazenamento próprio. Não haverá alteração do formato nesta rodada. [S06]

Os testes devem distinguir árvore commitada, entradas semânticas do índice e bytes/modes no disco. A=B=C não pode ser uma suposição: alguém pode commitar A, preparar B e continuar editando C. [S06, S23]

## 4. Estrutura física e descoberta

Em uma disposição simples, há `HEAD`, `config`, `index`, `objects/`, `refs/`, `logs/`, `hooks/` e `info/`. A pasta histórica `branches/` é relacionada a abreviações antigas de destinos remotos, não às árvores de conteúdo das branches. [S08]

`.git` pode ser gitfile, e parte dos dados pode estar em GIT_COMMON_DIR enquanto outra parte é específica do worktree. Refs podem estar em arquivos, packed-refs ou outro backend suportado. Não confundir endereço lógico com nome de arquivo físico. [S08–S10]

Comandos de investigação incluem `rev-parse --absolute-git-dir`, `rev-parse --git-common-dir`, `rev-parse --git-path index`, `for-each-ref` e `show-ref`. Conferir opções na versão efetiva e documentar a versão mínima; a saída do Git é a observação independente, não uma árvore de pastas presumida. [S11]

A separação futura de estado compartilhado e estado por worktree deve ser investigada, não imposta por um desenho estático deste pacote. O comportamento de `info/exclude` compartilhado é um caso importante da matriz, não uma solução definida. [S09]

## 5. Nome `layers`

O usuário prefere `layers`, em minúsculas, para o armazenamento privado que hoje se chama `git-layers`. Não há requisito de compatibilidade com projetos externos de mesmo nome. A implementação atual permanece inalterada nesta fase. [U-01, U-03; P01]

O layout oficial consultado não define um diretório `layers/`; isso não reserva universalmente o nome. Preservar conteúdo desconhecido no destino é proteção de dados, mesmo sem integração com terceiros. Identidade de armazenamento, versão, concorrência e recuperação durante mudança precisam de critérios observáveis. [S08]

Não anunciar `extensions.layers` como se o Git oficial já reconhecesse um novo formato. O manual estabelece que extensões de repositório desconhecidas em formato 1 devem provocar recusa. A escolha futura de metadados deve ser compatível com o alcance declarado, e não apenas parecer nativa. [S08]

A matriz LAYOUT prepara testes de destino ocupado, estado anterior, dados guardados, interrupção e múltiplos worktrees. Não se deve escrever agora um migrador escondido nos testes nem simular sua aprovação quando não existe implementação.

## 6. `layer/<nome>` e a seleção como branch

A convenção escolhida permanece `refs/heads/layer/<nome>`. Não reabrir a escolha de namespace nem migrar para `refs/layers/` nesta tarefa. O usuário deseja que a experiência de produto trate essas entradas como Layers ativáveis/desativáveis, e não como branches tradicionais selecionáveis. [U-02, U-07]

**Estado do Git oficial:** uma ref nesse namespace continua sendo uma branch para comandos nativos. Um executável externo `git-layer` permite a chamada `git layer`, mas não muda, por instalação apenas, a lógica de `git switch`, `git checkout` ou `for-each-ref`. [S03, S32]

Isso gera uma investigação, não uma decisão automática de arquitetura. O Codex deverá separar o que uma interface controla do que o executável nativo pode fazer. A futura extensão de VS Code poderá oferecer UX própria quando entrar no escopo; não é requisito para o Core nem alvo de implementação agora. [U-05–U-07]

A prova precisa observar HEAD, refs, índice e arquivos, não apenas código de saída. Em particular, `post-checkout` ocorre depois de atualizar a árvore; erro de hook não prova que a mudança foi impedida. [S12]

Registrar o comportamento desejado e a lacuna atual, preparar casos para `checkout`, `switch`, caminhos absolutos do Git e `worktree add`. Não escolher agora wrapper, hook, fork, extensão visual ou outro mecanismo. Não impor ao usuário a escolha técnica antecipada; a engenharia futura deverá propor solução e expor limites reais quando a funcionalidade for autorizada.

## 7. Compatibilidade observável

A suíte precisa medir operações usuais e avançadas: índices, refs, conflitos, alterações externas, transporte, recuperação e manutenção. `add .` não commita; `add -f`, `clean -x/-X`, `stash -a` e checkout sobre ignorados têm semânticas específicas. Não colapsar essas variantes em um único “teste Git”. [S06, S13–S15]

O alvo de uma operação Layer é o produto. O oráculo precisa ser independente: um Git nativo e leituras de filesystem em fixtures. Não usar somente o adaptador do Core para observar um recurso que esse adaptador filtra ou desabilita. [P02]

A execução de um comando nativo pode passar e revelar uma lacuna no produto. O contrato do protótipo pode recusar uma topologia, sem isso significar compatibilidade nessa topologia. O relatório deve manter as duas conclusões e seus denominadores.

O diretório privado não é transportado como parte automática do snapshot de branch; objetos alcançáveis por refs podem ser publicados. `push --all`, `--mirror`, refspecs e clone precisam de testes locais próprios. Não denominar “privado” como sinônimo de “impossível enviar”. [S16, S19, S20]

## 8. Engenharia agora e depois

**Agora:** o Codex estrutura documentação, instruções e harness, executa experimentos headless e entrega o relatório. Pode corrigir o próprio harness, nunca a implementação do produto nesta tarefa.

**Depois:** o usuário descreve funcionalidades e experiências desejadas; o Codex pesquisa, decide detalhes internos, implementa e usa esta base para verificar. Novas evidências podem revisar hipóteses técnicas e restrições antigas, sem alterar silenciosamente requisitos do usuário ou apagar histórico de testes.

A autonomia técnica inclui escolher a organização mais adequada dos testes e a linguagem da infraestrutura, preferindo reutilização quando útil. Não exige instalação do editor nem mudança de Node/Git global. A velocidade será medida; nenhum número de roteiros justifica prometer execução instantânea do conjunto inteiro.

## 9. Próximas fichas de investigação

O catálogo é ponto de partida para fichas por comando/opção: semântica documentada, capacidades por versão, estado lido/modificado, interação com índices/refs/worktree, fonte, cenários e limites de validação. A tarefa não termina com uma lista de nomes ou com invocações de ajuda.

As hipóteses da revisão estática anterior devem ser reproduzidas: resgate com metadados danificados, lock abandonado por morte real, snapshots grandes/journal, captura seguida de desativação, referências apagadas externamente e custo de varreduras. Só registrar como defeito confirmado quando houver evidência; nada disso autoriza correção no Core nesta rodada.
