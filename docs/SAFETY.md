# Segurança e integridade da v0.1

Este aplicativo é um laboratório para repositórios locais descartáveis. As garantias verificáveis são as dos comandos gerenciados e dos cenários registrados em `TEST-REPORT.md`. Não oferece isolamento de sistema operacional contra ferramentas externas e não substitui uma cópia de segurança independente do repositório.

## Envelope conservador de suporte

O modo Layers exige repositório não bare, um worktree normal, `HEAD` simbólico numa branch tradicional e pelo menos um commit. A edição/inicialização da base pode ocorrer antes do primeiro commit. Linked/múltiplos worktrees, sparse checkout/index, partial clone, objetos ausentes, histórico shallow/alternates/grafts, refs de substituição, submódulos e operações externas de merge/rebase/cherry-pick/revert em andamento são recusados ou diagnosticados em vez de convertidos silenciosamente.

A política de nomes é deliberadamente mais restrita que a de alguns sistemas de arquivos. Caminhos precisam ser relativos, em Unicode NFC, com separadores `/`, sem travessia, componentes vazios, controles, caracteres de alias perigosos, `.git`, nomes reservados do Windows, pontos/espaços finais ou equivalências de caixa/Unicode conflitantes. Os nomes reais não são renomeados automaticamente. Espaços e acentos comuns em NFC são suportados com as aspas normais do terminal.

A varredura conservadora considera o workspace, inclusive arquivos não rastreados/ignorados. A presença de symlink, hardlink, arquivo especial, repositório aninhado ou nome incompatível pode suspender Layers mesmo fora do arquivo que o usuário pretendia alterar. Não há composição por symlink/hardlink. Caminhos que atravessam links são recusados, e a varredura não os segue. Essa restrição não constitui teste de todos os tipos de reparse point/junction em Windows; essa plataforma precisa de validação própria.

Layers só contêm arquivos regulares e preservam o bit executável quando o sistema/Git o suportam. `.gitignore`, `.gitattributes` e `.gitmodules` pertencem à base na v0.1; não podem ser atribuídos a Layers. Filtros externos, LFS, `working-tree-encoding`, transformações não implementadas, diff externo, fsmonitor externo, hooks e assinatura configurada como obrigatória são recusados. Ler um arquivo no editor não executa seu conteúdo ou scripts do projeto.

## Propriedade e staging

Um caminho tem no máximo um proprietário ativo. Uma exclusão preparada não permite que outra origem tome o caminho antes da conclusão coerente. Novos arquivos normais continuam não rastreados; criá-los no disco ou selecionar uma Layer no painel não os atribui a ela. `unstage` preserva reserva de arquivo novo, e `release` exige reserva nunca commitada e já sem staging.

O índice de cada Layer é real e privado; o índice principal continua sendo o da branch tradicional. Commits de Layers usam plumbing e atualização de ref com OID esperado. Não há checkout temporário de Layer nem commit conjunto. Índices e refs modificados externamente causam suspensão; não são resetados para produzir uma falsa aparência de consistência.

O bloco local de `info/exclude` protege somente caminhos exatos, com regras externas preservadas. A efetividade é conferida contra o Git e negações incompatíveis são recusadas. O staging gerenciado da base verifica proprietário explicitamente. O Git convencional continua com seu comportamento normal: `git add .` não é interceptado nem convertido em stage de Layers. Uma tentativa de adicionar diretamente um arquivo ignorado recebe a mensagem normal do Git.

## Limite dos comandos externos

`git add -f`, `git clean -fdx`, `reset --hard`, checkout/switch externos, editores e gerenciadores de arquivos podem ignorar as proteções da aplicação. Um lock próprio não bloqueia esses programas. A aplicação tenta detectar divergências de `HEAD`, refs, índices, regras, hashes e modos antes de mutações; não consegue observar todo o histórico de escritas entre duas verificações.

Não existe recuperação garantida de bytes que nunca foram preparados, guardados, copiados ou registrados como rascunho. Uma ferramenta externa pode destruir bytes entre verificações ou repor bytes iguais; igualdade de hash não prova ausência de uma intervenção histórica. Os testes agressivos autorizados são executados somente em cópias descartáveis. A aplicação não altera aliases, hooks ou configuração Git global para interceptar comandos.

As operações Git gerenciadas não oferecem push, pull, fetch, autenticação, remotos operacionais, downloads preguiçosos, contas, telemetria ou atualização automática. A instalação de dependências pode usar rede; o editor e os fluxos gerenciados usam Git e assets locais. O terminal é um shell real iniciado explicitamente: comandos digitados podem usar as ferramentas, arquivos e rede disponíveis ao usuário, como em outro terminal do Windows.

## Confirmações, cópias e retenção

Restauração de arquivo substitui o disco pelo conteúdo do índice; não faz unstage. Exige confirmação e cria cópia de recuperação. Exclusão de arquivo no explorador também exige confirmação e backup. Renomear arquivo grava backup e preserva a recuperação, sem transferir propriedade. Renomear/excluir diretórios recursivamente não é disponibilizado; a implementação evita apagar conteúdo de outro proprietário em diretório compartilhado.

Desativar Layer com alterações exige guardar localmente ou cancelar. A shelf separa índice, reservas, conteúdo local, modos e marcadores de ausência. Reativação com colisão mantém a shelf e recusa sobrescrita. Uma aba não salva exige resolução antes de desativar, restaurar, excluir ou trocar contexto. Salvar uma aba antiga por cima de conteúdo rematerializado não é uma estratégia de recuperação.

Journals, shelves, backups e checkpoints privados não são expurgados automaticamente. O diagnóstico informa o espaço dos metadados. Essa retenção conserva evidência e pode crescer durante o uso; a v0.1 não oferece uma rotina automática de limpeza segura. Não apague `git-layers/`, índices privados, refs `refs/git-layers/*` ou locks para silenciar um diagnóstico: isso pode destruir staging ou a evidência necessária para recuperar.

Rascunhos do editor e backups podem conter segredos, conteúdo removido e versões anteriores sensíveis. Os rascunhos ficam em armazenamento privado do repositório e não são commits. Eles não são criptografados pela aplicação; permissões do sistema, backups e cópias do diretório continuam relevantes. Um rascunho salvo/removido pelo fluxo normal pode ser substituído, enquanto journals/backups mantêm retenção explícita. Revise as cópias antes de compartilhá-las. A exportação de recuperação deve usar um diretório vazio fora do workspace.

## Transações e recuperação

Locks entre processos serializam ou recusam mutações da própria aplicação. Um lock existente é preservado e diagnosticado; locks do Git nunca são apagados automaticamente. O desktop também usa fila de operações. JSON usa schema 1, arquivo temporário exclusivo, flush e publicação por rename; metadados inválidos ou futuros não são reinicializados.

O journal registra plano, cópias, etapas e estado final. Revalidações por hash/modo reduzem a janela de interferência. `fsync` e sincronização de diretório, quando suportados, não formam uma transação ACID envolvendo Git e todo o disco nem uma certificação de tolerância a perda de energia. Escritas múltiplas podem ser vistas parcialmente por programas externos.

Se um commit já avançou a referência antes da queda, `recover` reconhece o OID registrado e conclui os metadados, sem criar um segundo commit. Se houver edição posterior ou estado que não possa ser comprovado, interrompe e conserva backups. A exportação permite inspeção manual. Ref de Layer alterada externamente congela o fluxo; a recuperação não inventa uma base nova para um índice desconhecido.

## Fronteira desktop

O renderer não recebe Node, filesystem ou uma função genérica de executar Git. O preload expõe ações fixas e o main verifica emissor, argumentos e caminhos; acesso externo ao repositório ou a `.git` pelo explorador é recusado. A API interna autorizada continua usando caminhos Git descobertos para seus próprios metadados. A janela exige isolamento de contexto, sandbox e segurança web, bloqueia navegação inesperada, webviews e novas janelas e usa assets Monaco/worker locais. Conteúdo do repositório é exibido como dados.

O sandbox do aplicativo permanece ativo. O E2E foi executado no Windows nativo fora da restrição de lançamento de processos da ferramenta, preservando a proteção Electron. `TEST-REPORT.md` separa o que passou do que permanece sem comprovação. Um build isolado não certifica execução gráfica, assinatura ou notarização.

## Terminal integrado

A ponte IPC tem ações fixas para abrir, digitar, redimensionar e fechar uma sessão PTY. O processo principal verifica a origem da janela, limita tamanho de entrada e mantém o shell separado do renderer. Saída de terminal é tratada pelo xterm como dados; não é HTML de repositório executado. O catálogo valida os argumentos no main e escreve a mesma CLI visível na sessão.

Abrir ou ler um arquivo não inicia scripts. O terminal permite execução manual deliberada com as permissões do usuário, inclusive comandos Git externos fora das proteções do Core. Os buffers não salvos não são visíveis à CLI até serem gravados no disco.
