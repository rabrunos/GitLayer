# Limitações aceitas

Este laboratório serve somente para repositórios descartáveis. A simplificação é deliberada e substitui as garantias da implementação anterior.

- A aplicação e cada Layer possuem caminhos disjuntos. Diretórios podem ser compartilhados, mas um mesmo caminho não pode ter duas origens.
- Não há escritores externos concorrentes, operações destrutivas externas, ataques ou necessidade de suportar topologias complexas. Worktrees, submódulos e configurações Git especiais ficam fora do laboratório.
- Não há journals, backups transacionais, locks próprios, rollback, sincronização durável por arquivo ou recuperação após falhas de processo ou energia. Uma operação interrompida pode deixar estado parcial, exigindo recriar a fixture.
- `on` materializa diretamente com Git. As premissas excluem colisões e arquivos externos ocupando os caminhos da Layer.
- `off` exige Layer sem mudanças preparadas ou não preparadas. Não oferece descarte, shelf, estacionamento ou backup de pendências. Diretórios vazios permanecem.
- O bloco `info/exclude` protege o add convencional comum. `git add -f`, comandos externos e negações em `.gitignore` de maior prioridade podem contorná-lo. Fixtures não usam negações conflitantes; isto não é uma ACL.
- Não há hooks, assinaturas, LFS ou filtros externos no fluxo certificado. A criação de commits usa plumbing Git; não equivale a executar todos os comportamentos de `git commit`.
- Não há migração, descoberta remota, transporte automático, editor, desktop, proteção avançada de branch ou compatibilidade com os metadados antigos.
- Os caminhos do add são arquivos e diretórios literais; glob e magic pathspec não são suportados. O ponto `.` mantém o escopo do diretório atual e descendentes.
- Índices e refs alterados externamente não são sincronizados. Não se deve editá-los fora do coordenador nem selecionar uma branch `layer/*` como HEAD enquanto o laboratório as coordena.
- Não há garantia de desempenho universal. Arquivos maiores, antivírus, quantidade de diretórios e estado do filesystem afetam os tempos. Cinco segundos para 10.000 arquivos é uma meta, comprovável somente pelas amostras publicadas.
- A execução nativa aceita somente sintaxe TypeScript removível e não lê `tsconfig.json`. A checagem de tipos é separada (`npm.cmd run check`). O checkout deve ficar fora de `node_modules`, onde o Node recusa remover tipos. Não há distribuição npm certificada. Veja a [migração](TYPESCRIPT.md).

O alvo desta rodada é Windows x64 com Git oficial e Node.js 22.18+ ou 24+; a série 23 exige 23.6+. As versões efetivamente executadas e o alcance dos testes pertencem aos [resultados](STATUS.md), sem inferir suporte a plataformas não testadas. Dados locais antigos, ignorados ou pessoais não são migrados nem removidos.
