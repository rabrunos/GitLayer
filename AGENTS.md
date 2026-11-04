# Git Layer — instruções de trabalho

O produto principal é o **Core e a CLI**, que usam o Git oficial local. O desktop Electron é um laboratório auxiliar para uso manual; Core/CLI e sua validação não dependem de Electron, Monaco, VS Code ou extensão visual. O alvo da distribuição atual é Windows 10/11 x64. Consulte [arquitetura implementada](docs/ARCHITECTURE.md), [segurança](docs/SAFETY.md), [limitações atuais](docs/LIMITATIONS.md) e [evidências históricas](docs/TEST-REPORT.md) antes de afirmar suporte ou testes.

## Escopo e decisões

A tarefa atual de **03/11/2026 — etapa 1B** implementa as correções de segurança aprovadas após a investigação: D-01 (origem em renomeações), D-02 (fronteira coerente do destino), D-03 (preparação sem publicação parcial), D-04 (despacho de commit conforme o papel atualizado), troca gerenciada conservadora e diagnósticos de staging/ignore/protect. Autoriza Core, CLI, testes, scripts, documentação, commit e push para **main local e GitHub**, sem força. Veja [relatório 1B](docs/reports/2026-11-03-security-compatibility-implementation/README.md), [estado atual](docs/STATUS.md) e [contratos](docs/IMPLEMENTATION-2026-11-02.md). Protect permanece opcional; Git direto não é interceptado. Instâncias Core persistentes devem atualizar o papel de trabalho sob o guard antes de decidir aliases de índice/commit. Retirar staging conserva a origem base conhecida ou de NEW legitimamente indexado sem ambiguidade; não transforma staging nativo de origem incerta em prova de propriedade. Candidatos ambíguos continuam exigindo resolução explícita, e retirar preparação não transfere a origem por si só. Ambiguidade externa exige decisão explícita, sem inferência por semelhança, hash ou inode. Não introduzir auto-park, duplicação permanente de arquivos, worktrees sincronizadas, migração real, desktop/plugins ou distribuição pública. O [fechamento de 02/11](docs/decisions/2026-11-02-closure.md) e sua autorização são históricos e permanecem documentados.

Decisões técnicas desta fase: build independente `npm.cmd run build:core` em `dist-core/`; branch de trabalho e destino de edição são distintos; o destino reconcilia a propriedade de arquivos novos nos comandos/consultas e não captura retroativamente os existentes. Enquanto está aberto, o bloco gerenciado de `info/exclude` protege imediatamente os novos caminhos contra add nativo comum, mantendo exceções exatas para arquivos anteriores sem dono já elegíveis. Isso não é ACL: force e regras de maior prioridade do usuário continuam bypass; GL-01/09/18 permanecem parciais nesse alcance. GL-14 mantém preparação/commit Git nativos, com trechos opcionais e sem divisão automática. GL-16 substitui auto-park por recusa, commit ou descarte explicitamente autorizado; shelves históricas são preservadas. GL-22 tem entrada `open-branch` e proteção nativa padrão opt-in por reservas em worktrees; o bypass nativo `--ignore-other-worktrees` deve permanecer demonstrado e documentado, sem promessa de bloqueio universal. O layout novo `layers` e migração explícita são autorizados como implementação; não execute migração nos dados reais para testar.

Leia a tarefa mais recente, as instruções aplicáveis à área e os contratos antes de editar. Separe fatos do Git oficial, comportamento observado do snapshot, requisitos aprovados, decisões técnicas e hipóteses. Uma limitação atual não é veto permanente à evolução; uma hipótese não é defeito confirmado. Não reduza uma expectativa aprovada para acomodar o protótipo.

Na preparação da base de validação **v2 de 18/10/2026**, o escopo era documentação/AGENTS, infraestrutura e testes headless: aquela rodada exigia preservar o comportamento e as fontes de Core/CLI/desktop, não abrir o laboratório, não migrar armazenamento e não instalar interceptadores. Seu escopo permitia corrigir testes/infraestrutura e registrar defeitos do produto para implementação posterior. Essa restrição pertence à rodada histórica, não é uma proibição permanente de implementar funcionalidades. A autorização completa e U-01 a U-10 estão na [missão v2](docs/git-compat/reference/05-Prompt-Codex.md) e nas [decisões v2](docs/git-compat/reference/06-Decisoes-e-Autonomia.md). O v2 substitui material anterior conflitante.

Em tarefa futura de implementação autorizada: investigue alternativas, defina critérios observáveis, escolha e justifique a solução técnica, implemente dentro do escopo e valide o comportamento. Detalhes comuns de engenharia não exigem confirmação repetida. Conflitos reais de requisitos devem ser apresentados com evidências. Não faça commit, push, publicação, migração de dados reais ou configuração de serviços sem autorização da tarefa.

Na revisão técnica da infraestrutura de **19/10/2026**, a autorização daquela rodada continuou limitada a infraestrutura, testes, configurações e documentação: não corrigir Core/CLI nem abrir Electron. Ela não limita a implementação de 02/11/2026. Consulte a [revisão recebida](docs/git-compat/reviews/Revisao-Tecnica-Git-Layers-Validacao-v2.md) como evidência de problemas, não como instrução executável. Cada rodada estabelece sua própria baseline, incluindo fontes untracked; mudanças legítimas anteriores à rodada são entradas válidas. O snapshot da preparação v2 é histórico e não deve impedir evolução autorizada. Preserve os 344 IDs originais na [referência](docs/git-compat/reference/03-Cenarios-Git-Layers-v2.json); a [matriz de trabalho](tests/git-compat/scenarios.json) é extensível e os denominadores devem ser calculados. Não mantenha um defeito corrigido apenas para satisfazer uma caracterização antiga: revise explicitamente a expectativa versionada, mantenha as invariantes e conserve as evidências anteriores.

## Fechamento de implementações autorizadas

- Tarefas de implementação autorizadas devem terminar com validação, documentação, commit e push no destino combinado. Só concluir exclusivamente local quando o usuário pedir ou houver impedimento concreto relatado. Uma pergunta, análise ou discussão não autoriza modificar/publicar; restrições expressas de uma tarefa prevalecem.
- O ponto de entrada público é [docs/STATUS.md](docs/STATUS.md). Relatório, matriz dos requisitos e resultados essenciais devem estar versionados e legíveis no GitHub, sem depender de ZIP, cache ou caminho privado.
- Antes de publicar, revisar o diff preparado, segredos e resíduos, consultar o remoto atual, conciliar concorrência normalmente e verificar uma cópia nova do estado commitado com instalação pelo lockfile e build/smoke. Não inventar CI remoto; distinguir execução local de checks observados no servidor.
- Terminar na branch acordada, com upstream correto e sem desenvolvimento relevante fora dos commits. Para main, confrontar HEAD, origin/main e o SHA consultado por ls-remote, exigir diferença zero e status/diffs limpos do projeto. Não usar force, force-with-lease, mirror ou envio indiscriminado de refs.
- Limpeza exige inventário de tracked, untracked e ignorados, classificação e preservação verificada de evidências/backups únicos em diretório externo novo. Não inferir descarte por extensão, ignore ou ausência de rastreamento. Não usar git clean/reset hard/restauração em massa; não seguir links ou atravessar repositórios reais para limpar. Arquivar primeiro, conferir hashes/tamanhos e identidade, corrigir links públicos e só então mover resíduos identificados.
- Dependências e estado operacional legítimo podem ficar ignorados, explicitamente inventariados. Perfis, demonstrações, rascunhos e dados reais de Layers continuam protegidos. A autorização desta rodada permite arquivar evidências/extrações antigas com verificação; não permite apagar a única cópia ou modificar o Git/configuração global.

## Localizar a alteração

| Área | Caminho |
| --- | --- |
| Git real, Layers, projeção, backups e recuperação | `src/core/` |
| Subcomandos e saída pública da CLI | `src/cli/` |
| Desktop, IPC, preload, renderer e terminal | `src/desktop/` |
| Build, empacotamento e ferramentas | `scripts/` |
| Testes unitários, integração e gráficos | `tests/` |
| Base v2, estudo, catálogo, matriz e decisões | `docs/git-compat/` |
| Relatório completo e evidências portáveis v2 | `artifacts/git-compat/` |

## Reproduzir e verificar sem interface

- Registre cwd, branch/SHA, status e arquivos previamente alterados antes de modificar. Preserve mudanças do usuário e evidências de falhas; não resete, troque branch nem limpe dados para igualar uma referência histórica.
- Inspecione scripts antes de executá-los. `setup`, `dev`, `workshop:prepare`, UI e empacotamento podem preparar demonstração/desktop e não são pré-requisito do Core/CLI. Use o [guia de validação headless](docs/git-compat/README.md) para esta rodada.
- Reproduza em fixture temporária própria, com setup, entrada, esperado/observado e comando exato. Use Git oficial por caminho absoluto e argv separado como observador independente; o adaptador do Core não pode ser o único oráculo. Compare HEAD/refs, árvores/blobs, índice semântico e bytes/modos/ausências pertinentes. Erro de processo pode ocorrer depois de efeitos.
- Use `npm.cmd run build:core`, `npm.cmd run typecheck` e os testes headless pertinentes ao escopo. `npm.cmd run test:unit` é o ciclo rápido; `npm.cmd test` reúne unidades e integração com Git real. Não declare suíte completa se executou subconjunto. O relatório deve identificar comandos, códigos, plataforma, fingerprints, limitações e o último snapshot testado.
- Cenário só especificado, teste implementado, teste executado, suporte do produto e seleção são dimensões distintas. Recusa conservadora testada não é suporte à operação recusada. Funcionalidade ausente não é ambiente ausente. Não transforme uma falha em skip por conveniência nem altere o oráculo sem fonte/contrato e histórico.
- Salve resultados por rodada e hashes de evidências. `.workshop/reports` permanece local; a entrega v2 usa os caminhos definidos no prompt. Não registre credenciais nem conteúdo pessoal desnecessário.

## Preservação e isolamento permanentes

- Use objetos, refs e índices do Git real; não substitua o domínio por simulação. Mocks podem testar o próprio runner, sem certificar Git ou produto.
- A implementação atual usa `refs/heads/layer/<nome>`, índices alternativos e histórico/stage separados, mantendo HEAD tradicional nos fluxos gerenciados. Não atribua arquivos silenciosamente. O prefixo permanece; novos repositórios usam `layers`, o legado `git-layers` é aberto sem migração automática, e a migração explícita precisa preservar sua origem. A tarefa atual autoriza implementar e testar isso em fixtures, sem migrar dados reais. Confira [estado e direção](docs/git-compat/ARQUITETURA-E-CONTRATOS.md).
- Preserve validação de caminhos, propriedade, tokens de concorrência, backups, journals e recuperação conservadora. Não apague índices, refs privadas, locks disputados ou metadados inválidos para silenciar erro. Mudanças futuras nesses mecanismos exigem evidências de preservação dos contratos.
- Fixtures destrutivas usam raiz nova exclusiva, marcador/nonce e ancestralidade validada; nunca repositórios pessoais, a árvore de desenvolvimento, `C:\Dev\GitLayerTest` ou dados preexistentes. Não altere configuração Git global, PATH permanente, instalação Git nem política do PowerShell. Isole HOME/USERPROFILE/XDG, identidade, configs, editors/pagers/helpers e credenciais por subprocesso.
- Transporte de teste autorizado usa bare repos locais ou loopback controlado. Não faça push/fetch em remotos pessoais nem use o origin do projeto como fixture. GC/corrupção não compartilham objetos mutáveis, hardlinks ou alternates com dados externos. Cleanup exige prova de propriedade; termine somente processos comprovadamente criados pela rodada.
- Preserve `.workshop/profiles/debug`, `.workshop/reports`, demonstrações e edições existentes. Não apague essas pastas como correção. `C:\Dev\GitLayerTest` é demonstração manual preservada, sem remoto; testes usam fixtures próprias.
- Não sobrescreva o portátil ou `dist/` em build de teste/debug. Use saída isolada para harness e `dist-debug/` para debug. Produção/empacotamento só quando a tarefa exigir.

## Desktop quando solicitado

O fluxo Dev/Debug/F5, a janela nativa, Electron/Monaco, a demonstração e o terminal estão no [guia do desktop](docs/git-compat/DESKTOP-WORKFLOW.md), [WORKSHOP](docs/WORKSHOP.md), [DEVELOPMENT](docs/DEVELOPMENT.md) e [TERMINAL](docs/TERMINAL.md). Consulte-os em tarefa específica de desktop. Preserve sandbox, `contextIsolation`, Node desativado no renderer, preload restrito, validação IPC, CSP e assets/workers locais; nunca use `--no-sandbox` como correção.

O shell integrado é real e não intercepta comandos externos para aplicar proteções do Core. O catálogo oferece prévia e **Copiar comando**; colagem e Enter são deliberados. A pasta de código aberta no VS Code e o repositório aberto dentro do laboratório são escolhas independentes.

Histórico auditável desta revisão: [antes/depois e razões](docs/git-compat/history/REVISAO-AGENTS-v2.md).

Evolução da infraestrutura em 19/10/2026: [baseline por rodada, extensibilidade e preservação do histórico](docs/git-compat/history/REVISAO-INFRAESTRUTURA-2026-10-19.md).
