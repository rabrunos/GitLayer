# Workshop local no Windows

Esta pasta reúne o código do Git Layers Lab, testes, ferramentas e configuração de depuração para trabalhar com o Codex no VS Code. O aplicativo usa **Git local real**. Para abrir o aplicativo pronto, execute `artifacts/Git Layers Lab-win32-x64/git-layers-lab.exe`. O desenvolvimento usa um build e um perfil separados.

O alvo é **Windows 10/11 x64**; o terminal ConPTY requer Windows 10 1903+ ou Windows 11. Não é necessário instalar Linux nem WSL. Novas execuções nativas Windows são registradas no relatório atual. As verificações efetivamente realizadas e as limitações estão em [TEST-REPORT.md](TEST-REPORT.md) e [LIMITATIONS.md](LIMITATIONS.md).

## Abrir e executar

1. Extraia o ZIP inteiro para uma pasta local com permissão de escrita, por exemplo `C:\Workshops\git-layers-lab-workshop`.
2. Para desenvolver, instale **Node.js 22.12 ou superior**, npm, **Git for Windows 2.43 ou superior** e VS Code. Esses requisitos de desenvolvimento são diferentes dos do aplicativo portátil, que já inclui seu runtime.
3. Abra `Git-Layers-Lab.code-workspace` no VS Code. Se aparecer a confirmação de confiança do workspace, revise a pasta antes de habilitar a execução de suas tarefas.
4. Use Dev, Debug e o menu Workshop na barra de status. Veja [DEVELOPMENT.md](DEVELOPMENT.md). Alternativamente, no terminal PowerShell do VS Code, execute:

```powershell
node scripts/setup.mjs
npm.cmd run workshop:doctor
npm.cmd run workshop:start
```

`npm.cmd ci` instala as versões do lockfile e baixa o Electron; essa preparação precisa de rede. O projeto fixa `node-pty` 1.1.0, que fornece prebuilds para Windows x64. O diagnóstico informa o ambiente encontrado e os problemas que impedem iniciar. A preparação compila as fontes para depuração e cria uma demonstração Git real, sem substituir uma demonstração já existente ou suas edições.

O aplicativo de desenvolvimento abre a demonstração por padrão. Para escolher outro repositório Git, use **Abrir pasta** dentro do editor ou inicie com:

```powershell
npm.cmd run workshop:start -- --repo 'C:\Projetos\meu-repositorio'
```

Abrir uma pasta no **VS Code** permite ao Codex modificar o programa. Abrir uma pasta **dentro do Git Layers Lab** escolhe o repositório de trabalho do editor. Ele já permite abrir repositórios existentes e inicializar Git em uma pasta adequada; Layers precisam do primeiro commit da base. Veja [WORKSPACE.md](WORKSPACE.md).

## Terminal do aplicativo

Clique em **›_ Terminal** para iniciar um PowerShell real no workspace aberto, com ConPTY e xterm. Você pode digitar comandos, executar scripts locais deliberadamente, usar ferramentas interativas, pressionar Ctrl+C e redimensionar o painel. Abrir uma pasta ou arquivo não inicia seus scripts.

O painel **Comandos Git Layers** oferece os **33 comandos disponíveis na CLI**, com campos, prévia e **Copiar comando**. Cole no terminal e pressione Enter. Confirmações de `restore` e interação de `capture` acontecem no terminal real. No Windows a CLI interativa usa o Node instalado (22.12+).

O terminal tem as permissões do usuário. Comandos comuns de Git digitados nele seguem o Git instalado; as proteções do Core não interceptam comandos externos. Salve o arquivo antes de executar algo que precise de suas edições, pois o shell enxerga o disco. Para investigar o próprio terminal, veja `src/desktop/main/terminal.ts`, `src/desktop/renderer/TerminalPanel.tsx`, `src/desktop/renderer/CommandPanel.tsx` e `src/desktop/commands.ts`. Os detalhes estão em [TERMINAL.md](TERMINAL.md).

## Depurar com breakpoints

No painel **Executar e Depurar** do VS Code, escolha a configuração adequada e pressione **F5**:

| O que investigar | Sessão |
| --- | --- |
| Janela, arquivos, IPC, shell e operações do Core chamadas pelo editor | `Workshop: Desktop (main + Core)` |
| Comandos e operações do Core chamadas pela CLI | `Workshop: CLI (status da demonstração)` |
| Componentes React, eventos, estado, Monaco e xterm | `Workshop: main + renderer (debug local)` |
| Um teste específico | Abra seu arquivo e escolha `Workshop: teste selecionado (arquivo tests/*.test.*)` |

As configurações prontas estão no workspace. Coloque breakpoints nas fontes em `src/`, não nos arquivos gerados. A sessão da CLI usa um repositório de demonstração; altere seus argumentos na configuração para reproduzir outro comando em uma fixture apropriada.

Também é possível iniciar pelo terminal:

```powershell
npm.cmd run workshop:debug
```

Esse comando abre o inspector do processo principal em `127.0.0.1:9229`. Para habilitar também a porta do renderer, use:

```powershell
npm.cmd run workshop:debug -- --renderer
```

Depois, escolha **Workshop: anexar renderer (127.0.0.1:9222)** no VS Code. Os comandos de início/depuração aceitam `--repo` e `--profile` para escolher outro repositório ou diretório de perfil. As portas ficam restritas ao computador local e não são abertas pelo aplicativo normal. Feche a sessão anterior antes de reutilizá-las. Para uma alteração de código entrar em vigor, recompile e reinicie:

```powershell
npm.cmd run build:debug
```

Se um breakpoint não vincular, confirme que o build terminou, que a sessão aponta para este workshop e que foi selecionado o processo certo: principal e renderer são processos diferentes. Não desative o sandbox para resolver um problema de inicialização.

## Testar e registrar o resultado

| Comando | Finalidade |
| --- | --- |
| `npm.cmd run workshop:doctor` | Diagnóstico local dos requisitos e ferramentas |
| `npm.cmd run typecheck` | Verificação estática TypeScript |
| `npm.cmd run workshop:smoke` | Fluxo curto de Core/CLI com repositório descartável e Git real |
| `npm.cmd run workshop:ui` | Fluxo gráfico automatizado com repositório e perfil descartáveis |
| `npm.cmd test` | Suíte unitária e de integração |
| `npm.cmd run workshop:verify` | Typecheck, suíte de domínio, smoke e validação dos sourcemaps |
| `npm.cmd run build` | Build de produção em `dist/` |
| `npm.cmd run package:windows` | Build e pacote portátil Windows x64 |

O teste gráfico usa Playwright e o Electron local; não exige baixar outro navegador nem controlar a tela do Windows. Verifica copiar/colar comandos, digitação e interação real no PowerShell/ConPTY. Falhas de inicialização e execução são registradas, nunca convertidas em aprovação. Veja [TEST-REPORT.md](TEST-REPORT.md).

Os testes usam seus próprios repositórios descartáveis. A demonstração persistente fica em `C:\Dev\GitLayerTest`, o perfil de desenvolvimento em `.workshop/profiles/debug` e relatórios em `.workshop/reports`. Preserve arquivos úteis de reprodução antes de limpar dados. Para recomeçar uma investigação, prefira uma nova fixture em vez de apagar a demonstração que contém edições.

## Pedir uma correção ao Codex

Abra este workspace, disponibilize ao Codex acesso à pasta e descreva o problema. Um pedido prático seria:

> Leia AGENTS.md e docs/WORKSHOP.md. Reproduza este problema em um repositório descartável: [passos, resultado esperado e observado]. Execute o diagnóstico, use os breakpoints apropriados no Core ou no renderer, corrija a causa e rode os testes pertinentes. Pode criar scripts locais para reproduzir e inspecionar o problema. Preserve meus arquivos e as proteções do aplicativo. Grave os comandos, saídas e capturas relevantes em .workshop/reports e informe o que passou, o que não pôde ser testado e o que ficou incompleto.

O Codex pode modificar as fontes, acrescentar scripts de apoio e executar verificações locais conforme sua tarefa. O terminal e as ferramentas disponíveis dependem do ambiente em que ele estiver aberto. Credenciais, configuração global do Git, repositórios pessoais e serviços remotos não são necessários para esse fluxo.

## Limites que continuam valendo

O workshop facilita a reprodução e a depuração; não conclui funções do produto que estavam pendentes. Amend, tags mutáveis, gravação/pop de stash, merge, cherry-pick, revert e resolução de seus conflitos permanecem incompletos. A distribuição portátil continua sem assinatura digital. Consulte [LIMITATIONS.md](LIMITATIONS.md) para o envelope de repositórios e arquivos aceitos.

Para apenas usar o programa pronto, veja [WINDOWS.md](WINDOWS.md). Para trabalhar no mecanismo, veja [ARCHITECTURE.md](ARCHITECTURE.md), [CLI.md](CLI.md) e [TESTING.md](TESTING.md).
