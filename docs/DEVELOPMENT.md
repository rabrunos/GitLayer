# Desenvolvimento e testes locais

Abra `Git-Layers-Lab.code-workspace` no VS Code. Requisitos: Windows 10 1903+/11 x64, Node.js 22.12+ com npm e Git for Windows 2.43+. A extensão **Task Buttons** (`spencerwmiles.vscode-task-buttons`) usa os botões definidos no arquivo de workspace e os nomes de `.vscode/tasks.json`. As mesmas definições estão em `.vscode/settings.json` para abrir apenas a pasta; configurações da janela precisam estar no arquivo de workspace quando ele é usado.

## Barra de status

| Botão | Tarefa | Comportamento |
| --- | --- | --- |
| **Dev** | `Workshop: Dev` | Prepara uma vez, abre o build atual e observa as fontes. Salvar recompila e reinicia a janela, preservando buffers como rascunhos. |
| **Debug** | `Workshop: Debug` | Mesmo ciclo Dev, com inspectors locais main/Core em 9229 e renderer em 9222. |
| **Workshop** | Menu | Preparar, diagnosticar, abrir sem observação, testes rápidos, smoke, suíte completa, interface, typecheck, builds, pacote Windows e mapas. |

Cada tarefa usa um processo Node com argumentos separados e diretório na raiz. Não depende de `npm.ps1`, da política de execução do PowerShell ou de launchers manuais. Os testes/builds do menu registram comando, plataforma, duração, código de saída e ambos os streams em `.workshop/reports/check-*.json` e `*.log`. Um código de erro interrompe tarefas dependentes.

**Preparar** instala pelo lockfile somente se faltarem dependências/runtime ou se a árvore instalada estiver inválida. Os caches npm/Electron ficam em `.workshop`. Para forçar uma reinstalação deliberada: `node scripts/setup.mjs --install`. O lockfile não é refeito automaticamente.

**A pasta padrão de uso e testes manuais é `C:\Dev\GitLayerTest`.** Ela usa somente Git local; a preparação não adiciona remotos nem envia conteúdo ao GitHub. Uma demonstração existente e suas edições são preservadas. A antiga demonstração em `.workshop/repositories/demo`, se existir, também não é apagada. O perfil de desenvolvimento continua em `.workshop/profiles/debug`.

Fechar a janela encerra o modo Dev. A preparação recusa iniciar outra sessão Dev/Debug enquanto a sessão deste workshop estiver viva. Não use builds concorrentes sobre `dist-debug`. Uma falha de compilação mantém o observador ativo; corrija a fonte e salve novamente. A distribuição `dist/` e o portátil só mudam nas tarefas de produção/empacotamento.

Ao iniciar Dev/Debug, o terminal informa `Iniciando Electron (PID ...)` e, após a interface carregar com janela visível, `Editor aberto: C:\Dev\GitLayerTest`. Os lançadores da GUI não usam `windowsHide`, que pode ocultar a primeira janela no Windows. O observador compara nomes e conteúdo das fontes para ignorar notificações repetidas de uma mesma gravação, preservando mudanças reais durante o build.

## F5 e inspectors

Depois do botão **Debug**, selecione **Workshop: conectar ao botão Debug** e pressione F5. Essa configuração conecta main/Core e renderer à instância existente. Não execute uma configuração de lançamento para se conectar a uma janela já aberta. Depois de um reinício por alteração de fonte, reconecte o debug se a sessão tiver terminado.

Para iniciar diretamente pelo F5, use **Workshop: Desktop (main + Core)** ou **Workshop: main + renderer (debug local)**. A preparação roda uma vez antes do lançamento. Há também **Workshop: CLI (status da demonstração)** e a configuração de teste selecionado. A CLI usa `C:\Dev\GitLayerTest` por padrão; prefira uma fixture descartável para reproduções destrutivas.

Coloque breakpoints em `src/**/*.ts`/`tsx`. Os mapas de main/Core/CLI e renderer têm fontes embutidas; os mapas do renderer usam a raiz portável `gitlayers-workshop:///`. `npm.cmd run verify:maps` detecta mapas ausentes ou desatualizados. `npm.cmd run verify:dev` verifica automaticamente pausa/retomada nos inspectors, recompilação, reinício e recuperação de buffer em repositório/perfil temporários. Não exige controlar a tela do Windows.

## Escolher a verificação adequada

| Comando no PowerShell | Escopo |
| --- | --- |
| `node scripts/setup.mjs` | Dependências, build debug e preparação/reutilização da pasta padrão. |
| `npm.cmd run dev` | Observação das fontes, depois de preparar. |
| `npm.cmd run dev -- --debug` | Observação com inspectors locais. |
| `npm.cmd run test:unit` | Testes rápidos de contratos, validação, serialização e ferramentas. |
| `npm.cmd run typecheck` | Análise TypeScript strict. |
| `npm.cmd run workshop:smoke` | Core/CLI e Git real, em fixture temporária. |
| `npm.cmd test` | Toda a suíte unitária e de integração; múltiplos processos e operações Git reais. |
| `npm.cmd run test:desktop` | Electron local e Playwright: UI, IPC, arquivos, Git e terminal reais. |
| `npm.cmd run verify:dev` | Fluxo automatizado de debug/atualização e rascunhos. |
| `npm.cmd run package:windows` | Build de produção e pacote portátil Windows. |
| `npm.cmd run verify:package` | Comparação do ASAR/CLI/nativos com o build e as dependências locais. |

No PowerShell, use `npm.cmd`: `npm` pode selecionar `npm.ps1`, bloqueado pela política da máquina. Não é necessário alterar a política. As Tasks já evitam esse problema.

O teste desktop usa Playwright diretamente no Electron, com perfis e repositórios descartáveis, asserts, logs e capturas. Não usa controle remoto do PC, outro navegador baixado ou sandbox desabilitado. Testes de captura/restauração/recuperação não usam a pasta padrão do usuário como fixture destrutiva. A integração é mais lenta porque verifica refs, índices, blobs e arquivos com o Git instalado; os testes rápidos não substituem essa evidência.

O harness PTY compila as fontes atuais em um diretório temporário próprio e inicia Node sem loaders, evitando transmitir `--import tsx` ao Worker do `node-pty`. Isso preserva fontes atuais e um PowerShell/ConPTY real. Symlinks de arquivos exigem privilégio que algumas contas Windows não possuem; nesses casos os testes específicos informam skip. Junctions têm verificação Windows separada. Não habilite permissões globais para mascarar essa limitação.

As Tasks pertencem ao **VS Code**. Dentro do aplicativo, o catálogo oferece os 33 comandos com **Copiar comando**; cole e execute manualmente no terminal real. No Windows, a CLI interativa usa o Node instalado; o editor usa Electron. Buffer, disco e staging continuam distintos. Veja [TERMINAL.md](TERMINAL.md), [TEST-REPORT.md](TEST-REPORT.md) e [LIMITATIONS.md](LIMITATIONS.md).

A suíte completa limita a concorrência a dois arquivos de teste, evitando saturar Git/ConPTY no Windows. O harness PTY usa uma fixture mínima com base e Layer reais; a demonstração completa tem teste separado.
