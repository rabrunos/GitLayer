# Git Layer — instruções de trabalho

O produto principal é o **Core e a CLI**, que usam o Git oficial local. O desktop Electron é um laboratório auxiliar para uso manual; Core/CLI e sua validação não dependem de Electron, Monaco, VS Code ou extensão visual. O alvo da distribuição atual é Windows 10/11 x64. Consulte [arquitetura implementada](docs/ARCHITECTURE.md), [segurança](docs/SAFETY.md), [limitações atuais](docs/LIMITATIONS.md) e [evidências históricas](docs/TEST-REPORT.md) antes de afirmar suporte ou testes.

## Escopo e decisões

Leia a tarefa mais recente, as instruções aplicáveis à área e os contratos antes de editar. Separe fatos do Git oficial, comportamento observado do snapshot, requisitos aprovados, decisões técnicas e hipóteses. Uma limitação atual não é veto permanente à evolução; uma hipótese não é defeito confirmado. Não reduza uma expectativa aprovada para acomodar o protótipo.

Na preparação da base de validação **v2 de 18/10/2026**, o escopo é documentação/AGENTS, infraestrutura e testes headless: preserve o comportamento e as fontes de Core/CLI/desktop, não abra o laboratório, não migre armazenamento e não instale interceptadores. Corrija erros dos testes e da infraestrutura; reproduza e registre defeitos do produto. Essa restrição é desta rodada, não uma proibição permanente de implementar funcionalidades. A autorização completa e U-01 a U-10 estão na [missão v2](docs/git-compat/reference/05-Prompt-Codex.md) e nas [decisões v2](docs/git-compat/reference/06-Decisoes-e-Autonomia.md). O v2 substitui material anterior conflitante.

Em tarefa futura de implementação autorizada: investigue alternativas, defina critérios observáveis, escolha e justifique a solução técnica, implemente dentro do escopo e valide o comportamento. Detalhes comuns de engenharia não exigem confirmação repetida. Conflitos reais de requisitos devem ser apresentados com evidências. Não faça commit, push, publicação, migração de dados reais ou configuração de serviços sem autorização da tarefa.

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
- Use `npm.cmd run typecheck` e os testes headless pertinentes ao escopo. `npm.cmd run test:unit` é o ciclo rápido; `npm.cmd test` reúne unidades e integração com Git real. Não declare suíte completa se executou subconjunto. O relatório deve identificar comandos, códigos, plataforma, fingerprints, limitações e o último snapshot testado.
- Cenário só especificado, teste implementado, teste executado, suporte do produto e seleção são dimensões distintas. Recusa conservadora testada não é suporte à operação recusada. Funcionalidade ausente não é ambiente ausente. Não transforme uma falha em skip por conveniência nem altere o oráculo sem fonte/contrato e histórico.
- Salve resultados por rodada e hashes de evidências. `.workshop/reports` permanece local; a entrega v2 usa os caminhos definidos no prompt. Não registre credenciais nem conteúdo pessoal desnecessário.

## Preservação e isolamento permanentes

- Use objetos, refs e índices do Git real; não substitua o domínio por simulação. Mocks podem testar o próprio runner, sem certificar Git ou produto.
- A implementação atual usa `refs/heads/layer/<nome>`, índices alternativos e histórico/stage separados, mantendo HEAD tradicional nos fluxos gerenciados. Não atribua arquivos silenciosamente. Essa convenção permanece; o nome desejado de armazenamento é `layers`, mas o atual `git-layers` não deve ser migrado sem tarefa específica. Confira [estado e direção](docs/git-compat/ARQUITETURA-E-CONTRATOS.md).
- Preserve validação de caminhos, propriedade, tokens de concorrência, backups, journals e recuperação conservadora. Não apague índices, refs privadas, locks disputados ou metadados inválidos para silenciar erro. Mudanças futuras nesses mecanismos exigem evidências de preservação dos contratos.
- Fixtures destrutivas usam raiz nova exclusiva, marcador/nonce e ancestralidade validada; nunca repositórios pessoais, a árvore de desenvolvimento, `C:\Dev\GitLayerTest` ou dados preexistentes. Não altere configuração Git global, PATH permanente, instalação Git nem política do PowerShell. Isole HOME/USERPROFILE/XDG, identidade, configs, editors/pagers/helpers e credenciais por subprocesso.
- Transporte de teste autorizado usa bare repos locais ou loopback controlado. Não faça push/fetch em remotos pessoais nem use o origin do projeto como fixture. GC/corrupção não compartilham objetos mutáveis, hardlinks ou alternates com dados externos. Cleanup exige prova de propriedade; termine somente processos comprovadamente criados pela rodada.
- Preserve `.workshop/profiles/debug`, `.workshop/reports`, demonstrações e edições existentes. Não apague essas pastas como correção. `C:\Dev\GitLayerTest` é demonstração manual preservada, sem remoto; testes usam fixtures próprias.
- Não sobrescreva o portátil ou `dist/` em build de teste/debug. Use saída isolada para harness e `dist-debug/` para debug. Produção/empacotamento só quando a tarefa exigir.

## Desktop quando solicitado

O fluxo Dev/Debug/F5, a janela nativa, Electron/Monaco, a demonstração e o terminal estão no [guia do desktop](docs/git-compat/DESKTOP-WORKFLOW.md), [WORKSHOP](docs/WORKSHOP.md), [DEVELOPMENT](docs/DEVELOPMENT.md) e [TERMINAL](docs/TERMINAL.md). Consulte-os em tarefa específica de desktop. Preserve sandbox, `contextIsolation`, Node desativado no renderer, preload restrito, validação IPC, CSP e assets/workers locais; nunca use `--no-sandbox` como correção.

O shell integrado é real e não intercepta comandos externos para aplicar proteções do Core. O catálogo oferece prévia e **Copiar comando**; colagem e Enter são deliberados. A pasta de código aberta no VS Code e o repositório aberto dentro do laboratório são escolhas independentes.

Histórico auditável desta revisão: [antes/depois e razões](docs/git-compat/history/REVISAO-AGENTS-v2.md).
