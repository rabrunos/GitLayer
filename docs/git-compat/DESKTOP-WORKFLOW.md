# Desenvolvimento do laboratório desktop

Estas orientações foram separadas do AGENTS raiz na preparação v2 de 18/10/2026. Aplicam-se a tarefas que autorizem trabalhar no desktop. **Não executar nesta rodada de documentação e validação headless.** A mudança é de escopo documental; nenhum launcher, Task ou fonte desktop foi alterado.

Abra `Git-Layers-Lab.code-workspace` no VS Code e siga [WORKSHOP](../WORKSHOP.md) e [DEVELOPMENT](../DEVELOPMENT.md). O alvo é Windows 10/11 x64; ConPTY requer Windows 10 1903+ ou Windows 11. Node.js instalado 22.12+ e Git 2.43+ são pré-requisitos históricos deste fluxo. O workspace fornece botões Dev, Debug e menu Workshop via `spencerwmiles.vscode-task-buttons`.

```powershell
node scripts/setup.mjs
npm.cmd run workshop:doctor
npm.cmd run dev
```

`setup` verifica/instala dependências do lockfile e prepara debug; não é instalação mínima do Core. `workshop:prepare` compila e cria, se necessário, a demonstração em `C:\Dev\GitLayerTest`, preservando demonstração existente e edições. A demonstração antiga sob `.workshop` também é preservada. Perfil debug: `.workshop/profiles/debug`; relatórios: `.workshop/reports`. Não apagar para tentar corrigir erro sem preservar dados/evidência.

Debug inicia observação com inspectors. **Workshop: conectar ao botão Debug** anexa main/Core e renderer sem abrir outra instância. Dev preserva buffers como rascunhos antes de reiniciar; fechar a janela encerra a tarefa. F5 e configurações do workspace oferecem main/Core, CLI e renderer. `npm.cmd run workshop:debug` usa `127.0.0.1:9229`; `-- --renderer` também habilita `127.0.0.1:9222`. Compile fontes em `dist-debug/` com `npm.cmd run build:debug` e reinicie para vincular breakpoints `.ts`/`.tsx`; produção permanece separada em `dist/`.

Quando a tarefa exigir verificação gráfica, prefira Playwright diretamente no Electron. Confira também `BrowserWindow.isVisible()` ou handle nativo visível: DOM/screenshot de renderer não provam janela visível. Não use `windowsHide: true` para a GUI; mantenha-o apenas em auxiliares de console. `workshop:ui` usa perfil/repositório descartáveis. Não execute testes destrutivos na demonstração preservada. Gerar `.exe` não comprova execução nativa; registre o comando, saída, código, plataforma e screenshot na evidência da rodada.

Preserve sandbox, isolamento de contexto, Node desativado no renderer, preload restrito, validação de emissor IPC, CSP e assets/workers locais. Não use `--no-sandbox` nem acesso genérico ao sistema no renderer.

O terminal usa `node-pty` 1.1.0 e xterm com shell real. No Windows, CLI interativa usa Node instalado, TTY real, confirmações e Ctrl+C. O catálogo de 33 comandos oferece prévia e **Copiar comando**; não insere/executa no shell. Colagem e Enter são deliberados. Preserve validação de sessão e encerramento na troca de workspace. Tasks pertencem ao VS Code. Consulte [TERMINAL](../TERMINAL.md).

Orientações históricas completas estão no [AGENTS anterior](history/AGENTS.before-v2.md). Elas continuam úteis para o laboratório sem obrigar GUI na validação de domínio.
