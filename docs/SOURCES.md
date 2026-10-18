# Fontes e dependências verificadas

Verificação durante a implementação: 18/10/2026 (UTC). A especificação de produto é `Git_Layers_Lab_Prompt_Work.md`, fornecida pelo usuário. Os mecanismos são implementados por processos do Git instalado; não existe Git simulado.

## Documentação oficial consultada

- Git: execução de comandos, `GIT_INDEX_FILE`, opções e extensões `git-<comando>`: https://git-scm.com/docs/git
- Descoberta dos caminhos internos: https://git-scm.com/docs/git-rev-parse
- Staging, índices, árvores e commits: https://git-scm.com/docs/git-add ; https://git-scm.com/docs/git-read-tree ; https://git-scm.com/docs/git-write-tree ; https://git-scm.com/docs/git-commit-tree
- Atualização com OID anterior esperado: https://git-scm.com/docs/git-update-ref
- Ignore e precedência: https://git-scm.com/docs/gitignore ; https://git-scm.com/docs/git-check-ignore
- Comparações e materialização de índice: https://git-scm.com/docs/git-diff ; https://git-scm.com/docs/git-checkout-index
- Atributos e filtros: https://git-scm.com/docs/gitattributes
- Retenção e inspeção de objetos: https://git-scm.com/docs/git-gc ; https://git-scm.com/docs/git-fsck
- Segurança Electron (sandbox, contexto isolado, remetente IPC, protocolo local e bloqueio de navegação): https://www.electronjs.org/docs/latest/tutorial/security
- Protocolo privilegiado local e carregamento controlado de assets: https://www.electronjs.org/docs/latest/api/protocol
- Monaco e integração de workers: https://github.com/microsoft/monaco-editor ; https://microsoft.github.io/monaco-editor/
- Vite, workers locais e build: https://vite.dev/guide/features#web-workers
- Empacotamento real do Electron: https://github.com/electron/packager
- Automação Electron experimental do Playwright: https://playwright.dev/docs/api/class-electron

A consulta às fontes explica os mecanismos adotados; a evidência de funcionamento está nos testes executados e no `TEST-REPORT.md`. Documentação não equivale a testes de compatibilidade.

## Resolução das dependências

As versões exatas foram verificadas com `npm view <pacote> version` e instaladas com npm. O `package-lock.json` foi gerado pelo npm, inclui integridades e fixa a resolução transitiva. O comando `npm ci` usa essa resolução.

| Pacote | Versão direta |
| --- | --- |
| Electron | 44.9.0 |
| React / React DOM | 19.3.1 |
| Monaco Editor | 0.57.0 |
| Vite | 8.3.4 |
| TypeScript | 5.9.3 |
| esbuild | 0.28.2 |
| Playwright | 1.64.1 |
| @electron/packager | 20.3.0 |
| @electron-internal/extract-zip | 1.0.5 |
| tsx | 4.23.15 |
| @types/node | 24.19.2 |
| @types/react / @types/react-dom | 19.3.0 |
| @vitejs/plugin-react | 6.1.2 |

O ambiente inicial usou Linux, conforme o relatório histórico. A execução atual usa Windows 11 Pro x64, Node 24.14.1, npm 11.11.0 e Git 2.53.0.windows.2. Requisitos, caminhos e resultados estão em `TEST-REPORT.md`; isso não certifica macOS.

## Adaptação Windows 0.1.1

Fontes oficiais consultadas para esta edição:

- Plataformas do Electron e Windows x64: https://github.com/electron/electron#platform-support
- Empacotamento Windows a partir de outro host: https://github.com/electron/packager ; https://electron.github.io/packager/main/interfaces/Options.html
- Git for Windows, wrapper cmd/git.exe e localização estável: https://gitforwindows.org/git-wrapper.html
- Ambiente de processos Node no Windows (Path/PATH): https://nodejs.org/api/child_process.html
- Limites de chmod, links e constantes de abertura no Windows: https://nodejs.org/api/fs.html
- Hooks e configuração Git: https://git-scm.com/docs/git-config
- Compatibilidade de /dev/null e caminhos no Git for Windows: https://github.com/git/git/blob/master/compat/mingw.c
- Sandbox do Electron: https://www.electronjs.org/docs/latest/tutorial/sandbox

O runtime Windows Electron 44.9.0 foi obtido por @electron/get com verificação oficial SHASUMS256 habilitada. O hash e as inspeções estão em evidence/windows-package.json. Consultar documentação e verificar PE/ASAR não equivalem a executar o aplicativo no Windows.

## Atribuições e licença

O build copia as licenças/avisos das dependências de produção (incluindo Monaco, React, React DOM, Scheduler, Marked e DOMPurify) para `dist/licenses`, junto de `dependencies.json`. O pacote Electron inclui seu `LICENSE` e `LICENSES.chromium.html`. Cada dependência mantém a licença própria; os arquivos originais são preservados.

O código original tem `license: UNLICENSED` no package.json: a escolha de licença de distribuição permanece pendente do titular. Esse campo não seleciona silenciosamente uma licença aberta para o projeto e não impede instalação/teste local autorizado.

## Workshop, terminal e indicadores (0.1.2)

- node-pty 1.1.0 (Microsoft), PTY/ConPTY e API: https://github.com/microsoft/node-pty ; versão exata obtida por npm, com integridade no lockfile.
- xterm 6.0.0 e addon-fit 0.11.0: https://xtermjs.org/docs/ ; https://xtermjs.org/docs/guides/using-addons/ ; https://xtermjs.org/docs/guides/security/
- PowerShell 5.1 Start-Process, Wait/NoNewWindow e streams do console: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/start-process?view=powershell-5.1
- Debug no VS Code: https://code.visualstudio.com/docs/nodejs/nodejs-debugging ; https://code.visualstudio.com/docs/nodejs/browser-debugging ; https://www.electronjs.org/docs/latest/tutorial/debugging-vscode
- Indicadores Git convencionais no VS Code: https://code.visualstudio.com/docs/sourcecontrol/staging-commits ; https://github.com/microsoft/vscode/blob/main/extensions/git/src/decorationProvider.ts ; https://github.com/microsoft/vscode/blob/main/extensions/git/src/repository.ts

O Explorer usa um badge por arquivo, com a alteração do disco sobrepondo o staging quando ambos existem e os detalhes no tooltip. O indicador de Layer é separado, discreto e sem nome na linha. As fontes consultadas orientam a implementação; o teste nativo Windows continua uma verificação separada.
