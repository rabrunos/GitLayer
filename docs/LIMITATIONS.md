# Limitações do Core/CLI e do workshop

**Fase de 02/11/2026:** [novos contratos e limites](IMPLEMENTATION-2026-11-02.md) distinguem edição, abertura como branch, lifecycle, resgate e migração. GL-01/GL-22 não têm proteção universal de Git direto: `protect` usa reservas opt-in em worktrees, com bypass `--ignore-other-worktrees`; o target protege preparação nativa comum antes da observação e reconcilia propriedade nos comandos/consultas, mas force e ignore de maior prioridade continuam bypass. As seções gráficas abaixo e seus resultados são do workshop anterior, não execução desta rodada.

## Estado da entrega

**Core/CLI experimental, com requisitos parciais.** Esta implementação é validada por comandos headless, Git oficial e fixtures descartáveis. Os resultados, falhas, snapshots e limites estão no [relatório de 02/11/2026](reports/2026-11-02-closure/REPORT.md); suporte e execução são dimensões distintas. O build `build:core` usa `dist-core/`, com Node e Git como requisitos de runtime. Não houve abertura ou desenvolvimento do laboratório nem teste gráfico nesta rodada.

### Workshop legado — distribuição e execuções históricas

As afirmações de Electron, Monaco, pacote portátil e validação gráfica abaixo descrevem o workshop anterior. O [TEST-REPORT.md](TEST-REPORT.md) conserva a procedência de suas execuções Windows; elas não certificam este snapshot do Core/CLI.

O pacote é portátil para Windows 10/11 x64, sem instalador e sem assinatura digital. Não foi produzido pacote macOS ou ARM64 nativo. Git for Windows 2.43+ era o pré-requisito histórico do laboratório. A renomeação Core/CLI atual requer a feature `--show-ref-format`, presente na fonte Git 2.44; sem ela retorna `RENAME_UNSUPPORTED`. A execução deste fechamento usou Git 2.53.0.windows.2, sem campanha runtime 2.44/2.43. Veja o [envelope GL-20 e as fontes oficiais](reports/2026-11-02-closure/REPORT.md#gl-20-preservação-nativa-e-envelope-restante). O editor usa Electron embutido; a CLI interativa do terminal Windows exige Node.js instalado 22.12+. O launcher portátil com Electron atende comandos não interativos, mas não fornece TTY para `capture`.

## Implementação existente e contrato atual

- Core compartilhado, Git CLI real, refs convencionais, índices alternativos, checkpoints alcançáveis e commits independentes com atualização condicionada ao OID anterior.
- Exclusões exatas no info/exclude, preservação de regras, detecção de negação, reservas persistentes e captura revisável legada. Shelves antigas são preservadas; o novo fluxo de desativação recusa auto-park.
- Stage/unstage por arquivo e por hunk de arquivos regulares de texto já rastreados, sem mudanças de modo. Novos/removidos, binários e patches incompatíveis exigem arquivo inteiro. Tokens obsoletos são recusados.
- Histórico de até 50 commits por chamada, detalhes e comparação. Renomear/excluir arquivos com backups.
- Troca de branch com base tracked limpa e Layers preservadas. Mudanças em .gitignore/.gitattributes podem exigir resolver pendências/desativar Layers antes da troca.
- Journals, backups e recuperação conservadora. Troca interrompida pode ser concluída no destino preservando staged/unstaged. Alterações posteriores impedem sobrescrita.
- Integração histórica do laboratório, preservada: desktop React/Monaco, UTF-8/EOL, temas, abas, rascunhos, diff/histórico, captura, demonstração, identidade local, branches, diagnóstico e exportação conectados ao Core.
- Contrato preservado do laboratório: preload restrito, emissor IPC verificado, sandbox/contextIsolation ligados, Node desligado no renderer, CSP e bloqueio de navegação/rede.
- Busca do Git no PATH e pastas convencionais do Windows, ambiente sem duplicação Path/PATH e tratamento de separadores.
- Distribuição histórica do laboratório: CLI portátil com Node embutido, diagnóstico local e pacote .exe com DLLs, recursos, workers e licenças. O novo build Core/CLI separado usa Node instalado.

O fechamento corrigiu o mascaramento de ignore do usuário e a omissão de newcomers na prévia: [prova dirigida](evidence/closure-2026-11-02/review-target-preview.json). A consulta lógica usa Git oficial com scratch externo transitório, sem escrita no repositório inspecionado. Isso não certifica toda regra/configuração possível nem elimina bypass nativo; os resultados amplos das fontes finais pertencem ao [relatório público](reports/2026-11-02-closure/REPORT.md).

## Workshop legado — terminal e evidências históricas

Terminal integrado real node-pty/xterm, PowerShell/ConPTY no Windows, Bash/PTY para desenvolvimento no host. O catálogo contém os 33 comandos CLI, com formulário, prévia e **Copiar comando**. A execução acontece após colar e pressionar Enter manualmente. O aplicativo não é um mecanismo de tarefas.

Há testes do PowerShell/ConPTY real e do componente xterm no Electron Windows. Alterar a função prompt ou executar programas que removam o marcador da sessão pode deixar o indicador de estado desatualizado; a digitação normal continua sendo do terminal.

Apenas um repositório Git por janela, sem workspace multirroot. As fontes do workshop abrem no VS Code; debug usa sourcemaps/perfil separados. Inspectors são verificados automaticamente; a interação física com F5 e todas as combinações de extensões do usuário não equivalem a esse teste.

## Workshop legado — limites da validação gráfica histórica

Nas execuções históricas registradas, Playwright verificou a janela real, edição/commit, fronteira IPC, assets locais, indicadores e terminal. A verificação Dev cobre reinício e restauração de rascunho. Isso não certifica acessibilidade completa, DPI físico, todos os diálogos, todos os conflitos de buffers ou toda combinação de software do Windows. Consulte as execuções efetivamente concluídas no relatório.

A comparação de alteração externa usa conteúdo rotulado em leitura, sem mesclador de três vias. Binários/UTF-8 inválido são somente leitura; arquivos acima de 4 MiB não abrem para edição. Não há formatter automático. Uma morte abrupta pode perder a última alteração de buffer ainda não persistida.

## Não implementado

- Amend, criação/exclusão de tags, stash de escrita/pop, merge, cherry-pick, revert e resolução/continue/abort desses conflitos. Apenas stash-list está disponível como leitura.
- Reconciliação automática de refs/índices de Layer alterados por terceiros; mutações são suspensas com diagnóstico/exportação.
- Renomear/excluir árvores de diretórios recursivamente.
- Instalador, assinatura digital, notarização, atualizador e manual do help interceptado pelo Git.
- Isolamento ACID contra programas externos, recuperação de bytes nunca salvos ou copiados e observação contínua universal.
- Transferência de propriedade, commit conjunto e merge de Layers. Rede, rebase interativo, bisect e cliente integral de todos os subcomandos Git permanecem fora da v0.1.

## Envelope e cuidados específicos do Windows

Um worktree principal normal, não bare, HEAD simbólico tradicional ou Layer aberta deliberadamente, histórico completo e sem operações externas pendentes. Reservas de worktrees próprias de `protect` são reconhecidas; múltiplos worktrees arbitrários continuam fora do envelope certificado. Layers exigem o primeiro commit. O nome de Layer base é reservado. Todo o workspace é validado; links, hardlinks, repositórios aninhados e nomes não portáteis podem suspender o modo gerenciado mesmo em arquivos ignorados.

Symlinks/junctions reconhecidos pelo Node são recusados. Não há classificação completa de todos os reparse points de terceiros nem garantia de abertura atômica sem seguir links quando O_NOFOLLOW não existe. As verificações de lstat, links e identidade continuam ativas.

Modos Git como 100755 são preservados no índice. No Windows, permissões físicas são comparadas pelo suporte a somente leitura/gravação do Node; não há promessa de semântica chmod POSIX. core.filemode=false não registra mudanças físicas de executabilidade. Transformações nativas LF/CRLF são suportadas; filtros/LFS e conversões por código externo são recusados.

Arquivos somente leitura ou bloqueados por outro processo podem impedir substituição. Há tentativas curtas para gravações privadas do desktop, sem fallback destrutivo. Limites de caminho e políticas do Windows continuam se aplicando. Prefira pasta local curta, sem sincronizador concorrente.

Unicode NFC, caixa, equivalências por componentes e nomes reservados portáteis são validados; nenhuma renomeação silenciosa é feita. .gitignore, .gitattributes e .gitmodules pertencem à base. Hooks/assinatura, fsmonitor externo, split/sparse index, alternates, replace refs e filtros externos são recusados.

Journals JSON e shelves legadas têm limite de 64 MiB. Backups, shelves, refs de recuperação e rascunhos não têm expurgo automático nem criptografia. Não foram medidos desempenho amplo, corte real de energia ou todos os casos de interferência externa. Locks próprios ou do Git nunca são apagados automaticamente.

## Histórico

O relatório e as limitações da edição 0.1.0 foram preservados em history/. Seus resultados Linux e falhas de ambiente são históricos e não certificam Windows. As fixtures atuais usam os.tmpdir() em diretórios exclusivos, mantendo as asserções e a recusa de destinos que surjam após a validação.
