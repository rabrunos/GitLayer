# Git Layers Lab 0.1.2 — Workshop Windows

Esta pasta reúne **o aplicativo portátil e o projeto completo** para abrir no VS Code e trabalhar com o Codex: fontes TypeScript/React, Git local real, CLI, testes, scripts, configuração de debug e sourcemaps.

**Experimental parcial.** Consulte [TEST-REPORT.md](docs/TEST-REPORT.md) para as novas verificações nativas Windows e seus limites. Os complementos amend, tags mutáveis, stash de escrita, merge, cherry-pick e revert continuam incompletos.

## Abrir o aplicativo pronto

Extraia todo o ZIP. Abra **artifacts/Git Layers Lab-win32-x64/git-layers-lab.exe**. Mantenha os arquivos do runtime juntos. Para desenvolver, use as Tasks do VS Code.

Requer Git for Windows 2.43+ instalado. O editor portátil inclui Electron; a CLI interativa do terminal Windows usa Node.js instalado 22.12+. Não exige Linux ou WSL. Alvo Windows 10/11 x64; ConPTY requer Windows 10 1903+ ou Windows 11. Não há assinatura digital ou instalador.

No editor, **Abrir pasta** escolhe um repositório Git existente. **Inicializar pasta com Git** prepara uma pasta sem Git. Layers exigem primeiro commit da base. Há **Criar demonstração** para explorar sem usar seus projetos. Veja [WORKSPACE.md](docs/WORKSPACE.md).

## Indicadores de arquivos

Explorer e abas usam os marcadores convencionais do Git: M modificado, A adicionado, D removido e U não rastreado. Staging e disco aparecem no tooltip. Um ícone discreto de camadas indica apenas que o arquivo pertence a uma Layer; o nome aparece ao passar o mouse. Alteração ainda não salva usa um ponto separado.

## Terminal integrado e comandos por clique

Abra **Terminal** no aplicativo. É um PowerShell interativo real em um pseudoterminal ConPTY, com teclado, Ctrl+C e redimensionamento. Não é apenas uma lista de logs.

O painel **Comandos Git Layers** oferece os 33 comandos disponíveis na CLI, com campos, prévia e **Copiar comando**. Cole no terminal e pressione Enter para executar. O painel serve como catálogo; as Tasks de desenvolvimento pertencem ao VS Code.

Use o prompt vazio antes de clicar. Durante capture ou confirmação de restore, responda no próprio terminal. Também é possível digitar comandos manualmente. O terminal permite executar ferramentas locais deliberadamente; abrir um arquivo no editor não executa seu conteúdo. Comandos Git externos têm os mesmos limites de proteção que em outro terminal.

O [guia do terminal](docs/TERMINAL.md) e a [referência da CLI](docs/CLI.md) explicam o fluxo.

## Abrir o workshop no VS Code

1. Abra **Git-Layers-Lab.code-workspace**, ou abra esta pasta pelo VS Code.
2. Para desenvolver, instale Node.js 22.12+ e Git for Windows 2.43+.
3. Use os botões **Dev**, **Debug** e o menu **Workshop** na barra de status. Task Buttons já está configurada no workspace. Alternativamente, no PowerShell:

```powershell
node scripts/setup.mjs
npm.cmd run workshop:doctor
npm.cmd run dev
```

A instalação inicial das dependências precisa de rede. O aplicativo pronto e o fluxo Git local não precisam de serviço remoto. Não é necessário alterar a política de execução do PowerShell.

Escolha **Workshop: Desktop (main + Core)** no painel Executar e Depurar e pressione **F5**. Há também configurações para CLI, teste selecionado e main + renderer. Os mapas apontam para os arquivos originais em src, mesmo depois de extrair o ZIP em outro caminho.

A pasta padrão de desenvolvimento e testes manuais é **C:\Dev\GitLayerTest**, somente local e preservada entre execuções. O perfil de debug e os relatórios ficam em .workshop, separados dos dados normais do aplicativo. O build de debug é dist-debug; produção é dist. O modo Dev recompila e reinicia ao salvar as fontes, recuperando buffers por rascunhos. Os testes rápidos e desktop automatizados estão em [DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Comandos para o Codex

```powershell
npm.cmd run workshop:start
npm.cmd run workshop:debug
npm.cmd run workshop:smoke
npm.cmd run workshop:ui
npm.cmd run workshop:verify
```

start/debug aceitam **-- --repo 'C:\caminho\repositorio'** e **--profile** opcional. debug usa o inspector local 127.0.0.1:9229; **--renderer** habilita também 127.0.0.1:9222 somente nessa execução. Esses listeners não são abertos pelo aplicativo normal.

smoke executa CLI e Git real em repositório descartável. ui abre o Electron local com sandbox e executa o E2E; falha de inicialização é registrada como falha, sem simular aprovação. verify reúne typecheck, suíte de domínio, smoke e validação de sourcemaps.

O Codex deve começar por **AGENTS.md** e [WORKSHOP.md](docs/WORKSHOP.md). Pode criar scripts locais, reproduzir erros, colocar breakpoints e executar verificações conforme a tarefa. Logs/JSON ficam em **.workshop/reports/**. Nada precisa ser enviado automaticamente.

## Arquitetura e alcance

O editor e a CLI compartilham um Core TypeScript. Layers são branches Git reais refs/heads/layer/<nome>, com índices alternativos e commits independentes. O HEAD permanece na branch tradicional. Não existe Git simulado.

Estão implementados arquivos UTF-8/EOL, Monaco, stage/unstage, hunks suportados, commits, histórico/diff, branches, composição de Layers, captura, shelves e recuperação conservadora. Nenhum novo recurso incompleto foi apresentado como comando funcional no catálogo.

O aplicativo não oferece sincronização Git remota automática. Os assets são locais. Um terminal real permite ao usuário executar comandos e ferramentas do computador, inclusive fora dessas operações gerenciadas; o Core não intercepta comandos externos destrutivos.

- [Arquitetura](docs/ARCHITECTURE.md), [Segurança](docs/SAFETY.md), [Limitações](docs/LIMITATIONS.md).
- [Testes](docs/TESTING.md), [Relatório](docs/TEST-REPORT.md), [Fontes e licenças](docs/SOURCES.md).

O código original permanece UNLICENSED/private, pendente de decisão do titular. Licenças do Electron e das dependências acompanham o projeto e o runtime.
