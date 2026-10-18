# Limitações e pendências verificáveis

## Classificação da entrega

**Experimental parcial**, sem alegação de compatibilidade universal nem de conclusão dos 30 critérios. Git real e fluxo principal estão implementados. TypeScript, testes de domínio/CLI e build podem ser executados neste ambiente; a execução do desktop com sandbox foi bloqueada. A tabela final de resultados está em TEST-REPORT.md.

## Implementado, com alcance conservador

- Core compartilhado, Git CLI real, referências convencionais, índices alternativos, staging/checkpoints alcançáveis sem identidade pessoal e commits independentes com compare-and-swap.
- Exclusões exatas no info/exclude, preservação de regras anteriores, detecção de negação, reservas persistentes, shelves de índice+bytes+modos+ausências e captura de arquivos novos com revisão.
- Stage/unstage por arquivo e hunk de **arquivos regulares de texto já rastreados, sem alterações de modo**. Arquivos novos/removidos, binários e outros patches não suportados exigem arquivo inteiro. Há validação do índice/disco por token; erro não prepara tudo.
- Histórico de até 50 commits por chamada, detalhes e comparação de revisões. Renomear/excluir **arquivos** com backups; renomear/excluir árvores de diretórios não foi implementado.
- Switch compatível com base tracked limpa e preservação das Layers. Se os controles `.gitignore`/`.gitattributes` do destino diferirem, exige guardar/desativar Layers antes de tentar. É uma restrição conservadora, mesmo que as novas regras pudessem ser compatíveis.
- Recuperação de operações interrompidas apenas quando fingerprints/refs/backups provam o estado. Troca interrompida pode ser **concluída na branch de destino**, preservando a distinção staged/unstaged, em vez de obrigatoriamente voltar à branch anterior. Alterações posteriores impedem sobrescrita; os backups permanecem exportáveis.
- Estado público recovery-required é apresentado quando há journal pendente; os journals também retêm o estado anterior. Locks próprios existentes nunca são apagados automaticamente. Depois de uma morte abrupta pode ser necessária inspeção manual de um lock comprovadamente órfão antes de executar recover. Locks Git não são removidos pelo aplicativo.

## Desktop implementado, sem validação gráfica neste ambiente

React/Monaco local, temas, abas e realce de sintaxe, EOL UTF-8, indicação de buffer/disco/staging, rascunhos locais, captura, demo, explorador, diff, histórico, branches, identidade local com consentimento, diagnóstico e exportação estão conectados ao Core. O renderer não tem acesso direto a Node ou Git. Configuração: contextIsolation e sandbox ligados, Node desligado, preload restrito, verificação de emissor IPC, bloqueio de rede/navegação/janelas e CSP.

O binário Linux x64 foi produzido; o ambiente executa como root e não autoriza mudar de usuário nem abrir o sandbox do Chromium. O teste de lançamento falhou antes da janela. Portanto não foram verificados visualmente o renderer empacotado, execução dos workers, acessibilidade, atalhos, watchers, IPC real ou recuperação de buffers na reabertura. Essas funcionalidades existem no código, mas **não têm confirmação E2E** nesta entrega.

A comparação de edição externa usa conteúdo rotulado no editor de leitura, sem mesclador de três vias. Não há formatter automático. Arquivos binários/UTF-8 inválido são somente leitura; arquivos acima de 4 MiB não abrem para edição. Rascunhos ficam em arquivos privados schema1 e podem conter dados sensíveis. O fechamento normal solicita flush; uma morte abrupta pode perder o último evento ainda não persistido.

## Não implementado

- Complementos: amend, criação/exclusão de tags, stash de escrita/pop, merge, cherry-pick, revert e resolução/continue/abort desses conflitos. A interface identifica sua indisponibilidade e o Core recusa. Apenas `stash-list` é uma leitura real disponível.
- Reconciliação automática de uma Layer cuja ref/índice tenha sido alterada por terceiros. O app suspende mutações e oferece evidência/exportação; não faz reset de índice sujo para esconder a divergência.
- Instalação de manual `git-layer` para o help interceptado pelo Git. Use `git layer -h`, `git layer help` ou `git-layer --help`.
- Pacotes Windows/macOS, instaladores, assinatura e notarização; configurações/scripts permitem selecionar plataforma no host adequado, sem resultados alegados.
- Proteção ACID ou isolamento contra programas externos; observação contínua universal; recuperação de bytes nunca salvos/copied pelo aplicativo.
- Transferência de propriedade, commit conjunto ou merge de Layers; rede, rebase interativo, bisect, submódulos ou cliente completo de todos os subcomandos Git. São fora do escopo solicitado da v0.1.

## Envelope do laboratório

O nome literal de Layer `base` é reservado ao destino da branch tradicional nas APIs/CLI. Um worktree normal, não bare, HEAD simbólico tradicional, histórico completo e sem operações Git externas pendentes. Layers exigem o primeiro commit. Todo o workspace é percorrido conservadoramente; symlinks, hardlinks, repositórios aninhados e nomes não portáteis, mesmo ignorados e fora das Layers, suspendem o modo gerenciado. Isso também pode recusar `node_modules/.bin` em projetos reais.

Caminhos Unicode NFC, comparação de caixa/equivalências por componentes e nomes reservados portáteis são verificados; nenhuma renomeação silenciosa é feita. Somente arquivos regulares, sem junctions/reparse points suportados. `.gitignore`, `.gitattributes` e `.gitmodules` pertencem exclusivamente à base. Filtros/LFS, working-tree-encoding, ident, diff drivers externos, hooks/assinatura, fsmonitor externo, split/sparse index, alternates e replace refs são recusados.

Modos seguem o índice do Git; com core.filemode=false, o Git não registra mudanças de executabilidade. Transformações nativas LF/CRLF via Git são suportadas; controles que exigem código externo são recusados. O editor salva UTF-8 e preserva o EOL do buffer; nenhuma codificação desconhecida é convertida automaticamente.

Shelves/journals JSON têm limite de 64 MiB. Operações com grandes conjuntos de arquivos podem ultrapassá-lo e falhar conservadoramente. Sem limites de desempenho medidos; árvores são revalidadas por segurança a cada mutação. Backups, shelves e refs de recuperação não têm expurgo automático e podem consumir espaço. Não se promete transparência entre múltiplas escritas no disco; fsync de diretórios depende do suporte do sistema.

O ZIP de fontes exclui node_modules/caches/repositórios de teste. O pacote Electron inclui o runtime mas depende do Git do sistema. Uma instalação de desenvolvimento requer rede; a operação normal não requer rede.

## Interferência observada no workspace da tarefa

Uma execução ampliada em scratch terminou em 80/81: um destino reapareceu entre validação e publicação e foi recusado. Instrumentação posterior observou arquivo deletado reaparecendo com novo inode e bytes antigos durante chamadas Git de leitura, sem escrita correspondente do Node; isso também ocorreu com outra versão do Git. A causa exata no sistema de arquivos/ambiente não foi comprovada. O mesmo cenário repetido 18 vezes em diretório temporário local passou. As fixtures finais usam os.tmpdir(), sem enfraquecer asserções, e a falha original permanece no relatório/evidência. A ausência de nova falha em outro local não certifica isolamento contra sincronizadores ou outros programas.
