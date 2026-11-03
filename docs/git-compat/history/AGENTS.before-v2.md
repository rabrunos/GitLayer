# Git Layers Lab — instruções para trabalhar neste workshop

Este é o código-fonte de um aplicativo Electron com Core e CLI compartilhados. O alvo de uso é **Windows 10/11 x64**; o terminal ConPTY requer Windows 10 1903+ ou Windows 11. Abra `Git-Layers-Lab.code-workspace` no VS Code e leia [docs/WORKSHOP.md](docs/WORKSHOP.md) para executar e depurar. Consulte [docs/TEST-REPORT.md](docs/TEST-REPORT.md) antes de afirmar que algo foi testado; gerar um `.exe` não comprova execução nativa em Windows.

## Começar

Abra o workspace e use os botões **Dev**, **Debug** e o menu **Workshop** da extensão Task Buttons (`spencerwmiles.vscode-task-buttons`). O fluxo está em [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). No terminal PowerShell da raiz, com Node.js 22.12+ e Git 2.43+ instalados:

```powershell
node scripts/setup.mjs
npm.cmd run workshop:doctor
npm.cmd run dev
```

`setup` verifica/instala as dependências do lockfile e prepara o build debug. `workshop:prepare` compila e cria a demonstração em **`C:\Dev\GitLayerTest`** quando necessário. Essa é a pasta padrão local para uso e testes manuais, sem remoto. **Preserva uma demonstração existente e suas edições.** A antiga demonstração sob `.workshop` também é preservada. O perfil de desenvolvimento fica em `.workshop/profiles/debug`; relatórios ficam em `.workshop/reports`. Não apague esses diretórios para tentar corrigir um problema sem antes preservar os dados necessários.

## Localizar a alteração

| Área | Caminho |
| --- | --- |
| Git real, Layers, projeção, backups e recuperação | `src/core/` |
| Subcomandos e saída da CLI | `src/cli/` |
| Janela Electron, arquivos e handlers IPC | `src/desktop/main/` |
| Sessão do terminal real e ciclo de vida do shell | `src/desktop/main/terminal.ts` |
| Catálogo de comandos e serialização dos argumentos | `src/desktop/commands.ts` |
| Ponte restrita do renderer | `src/desktop/preload/` |
| Interface React/Monaco | `src/desktop/renderer/` |
| Terminal xterm e formulário dos comandos | `src/desktop/renderer/TerminalPanel.tsx`, `CommandPanel.tsx` |
| Contratos compartilhados | `src/desktop/shared/` |
| Build, empacotamento e ferramentas do workshop | `scripts/` |
| Testes unitários, de integração e gráficos | `tests/` |

## Reproduzir, depurar e verificar

- Reproduza em um repositório descartável. Registre comando, entrada, comportamento esperado e observado antes de corrigir.
- Prefira testes Node e Playwright diretamente no Electron. Não use controle visual do PC para investigar o aplicativo quando esses instrumentos resolverem a verificação. `test:unit` é o ciclo rápido; a suíte de integração mantém Git real.
- Ao verificar abertura pelo Dev/Debug/Abrir, confira também a janela nativa visível (`BrowserWindow.isVisible()` ou handle visível do Windows). DOM e screenshot de renderer podem existir em uma janela oculta. Não use `windowsHide: true` ao lançar a GUI Electron; mantenha essa opção apenas nos auxiliares de console.
- O botão Debug inicia o modo de observação com inspectors. Use **Workshop: conectar ao botão Debug** para anexar main/Core e renderer sem abrir outra instância. Dev preserva buffers como rascunhos antes de reiniciar. Fechar a janela encerra a tarefa.
- Use F5 e as configurações fornecidas no workspace para o processo principal/Core, CLI ou conexão ao renderer. `npm.cmd run workshop:debug` abre o inspector do processo principal em `127.0.0.1:9229`; acrescente `-- --renderer` para habilitar também a conexão ao renderer em `127.0.0.1:9222`. As fontes de depuração ficam em `dist-debug/`, separadas de `dist/` de produção.
- Depois de alterar fontes, recompile com `npm.cmd run build:debug` e reinicie a sessão de depuração. Um breakpoint deve vincular à fonte `.ts`/`.tsx`; se ficar pendente, verifique o build e o processo selecionado.
- Execute `npm.cmd run typecheck` e os testes pertinentes. `npm.cmd run workshop:smoke` exercita o Core/CLI com Git real. `npm.cmd run workshop:ui` executa a verificação gráfica com repositório e perfil descartáveis. Para verificar regressões mais amplas, use `npm.cmd test`.
- Salve evidências úteis em `.workshop/reports`: comando, saída, código de retorno, plataforma e, para interface, captura de tela. Diga explicitamente quais verificações passaram, quais não puderam rodar e o que continua incompleto. Não registre credenciais nem conteúdo de repositórios pessoais sem necessidade.

Pode criar scripts locais e testes relevantes, instalar as dependências do lockfile e fazer correções reversíveis dentro deste workshop, conforme a tarefa do usuário. Não peça confirmação para cada comando rotineiro autorizado. Não exija que o usuário tenha Linux ou faça testes nele.

## Preservar os contratos do laboratório

- Use o Git local real. Não substitua comandos Git, refs, índices ou objetos por simulação.
- Base e Layers mantêm histórico e stage separados; uma Layer usa `refs/heads/layer/<nome>`, com índice alternativo. O HEAD continua na branch tradicional. Não atribua arquivos silenciosamente a uma Layer.
- Preserve validações de caminhos, propriedade de arquivos, tokens de concorrência, backups, journals e recuperação conservadora. Um teste deve detectar uma regressão real, sem apenas repetir a implementação.
- Mantenha sandbox e `contextIsolation` ativos, Node desativado no renderer, preload restrito, validação de emissor IPC, CSP, workers e assets locais. Não resolva erros de execução com `--no-sandbox` nem expondo acesso irrestrito ao sistema pelo renderer.
- O terminal usa `node-pty` 1.1.0 e xterm: é um shell real, com as permissões do usuário. No Windows a CLI interativa usa Node instalado 22.12+, preservando TTY, confirmações e Ctrl+C. Os 33 comandos do catálogo oferecem prévia e **Copiar comando**, sem inserir ou executar no shell. A colagem e o Enter são deliberados. Preserve a validação de sessão e o encerramento ao trocar de workspace. Tasks são do VS Code. Veja [docs/TERMINAL.md](docs/TERMINAL.md).
- Testes devem criar repositórios temporários próprios. Não use repositórios pessoais como fixture, altere configuração global do Git, apague locks externos, faça push/fetch, publique ou configure serviços remotos sem uma tarefa que autorize isso.
- Não sobrescreva o pacote portátil ou `dist/` durante um build de depuração. Use `npm.cmd run build` e `npm.cmd run package:windows` quando a tarefa exigir atualizar a distribuição.
- Amend, tags mutáveis, stash de escrita/pop, merge, cherry-pick, revert e seus conflitos continuam incompletos. Não apresente esses fluxos como implementados sem concluí-los e verificá-los.

O editor já pode abrir uma pasta Git como workspace e inicializar Git em uma pasta adequada. A pasta do workshop no VS Code contém o código do aplicativo; a pasta aberta **dentro** do aplicativo contém o repositório que ele vai editar. São escolhas independentes. Scripts podem ser executados deliberadamente no terminal integrado do aplicativo ou no terminal do VS Code. O shell não intercepta comandos Git externos para aplicar as proteções do Core.
