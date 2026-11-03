# Execução nativa Windows — 18/10/2026

**Relatório histórico — 18/10/2026 e complementos daquela fase:** “fontes atuais” e resultados abaixo referem-se aos snapshots registrados à época. Não certificam a implementação de 02/11/2026. Consulte os [contratos novos do Core/CLI](IMPLEMENTATION-2026-11-02.md) e o [relatório público de fechamento](reports/2026-11-02-closure/REPORT.md); esta rodada não abriu nem revalidou o laboratório gráfico. O conteúdo histórico permanece preservado abaixo. Referências a .workshop identificam a localização local original dos logs/capturas; não são dependências nem links públicos exigidos. A retenção externa verificada e os resultados essenciais publicados são identificados pelo relatório de fechamento; os fatos e contagens históricos não foram reinterpretados.

Executado em **C:\Dev\GitLayer**, com as fontes atuais. O [relatório anterior](history/TEST-REPORT-WORKSHOP-PRE-WINDOWS.md) foi preservado como histórico; ele não comprova esta execução.

## Complemento: pastas vazias ao desativar Layers e tooltips

Reproduzido em fixture Git descartável: desativar `scripts` retirava `scripts/nested/run.ps1`, mas deixava `scripts/` no disco. O novo teste falhou antes da correção. A desativação agora remove apenas ancestrais vazios dos arquivos daquela Layer, dos mais profundos para os mais rasos, sem remoção recursiva. Pastas necessárias a caminhos da Base em HEAD/índice e a outras Layers ativas são preservadas mesmo se esses arquivos estiverem ausentes no disco; conteúdo local/ignorado e subpastas não relacionadas também são preservados. A última Layer ativa pode liberar uma pasta compartilhada vazia. A remoção é registrada no journal e pode ser revertida por recuperação conservadora.

Os tooltips das badges de propriedade em arquivos, abas e pastas usam `layer/nome`, por exemplo `layer/scripts`.

Verificações desta alteração no Windows x64:

- **Typecheck, build de debug e sourcemaps:** aprovados.
- **Unitários, recuperação e integrações selecionadas:** 64 casos, 62 aprovados, 2 skips (Bash e criação de symlink sem privilégio), zero falhas. Incluem os três novos cenários de limpeza/reativação/proteção/recuperação, quatro regressões de parking/diretório compartilhado/failpoints de projeção e seis casos de compatibilidade Windows com Git real, CRLF, binários e junctions.
- **`node scripts/workshop-ui.mjs --no-build`:** três testes gráficos aprovados, saída 0. A janela Electron foi confirmada visível, com sandbox ativo; o teste usa a bolinha para desativar `scripts`, confirma a ausência da pasta no disco e na árvore, reativa, confere o conteúdo e verifica os tooltips no novo formato.

Uma tentativa gráfica inicial detectou que a fixture esperava LF enquanto o Git materializava CRLF. A configuração de fim de linha foi explicitada apenas no repositório descartável do teste; a repetição passou sem flexibilizar a comparação de conteúdo. Logs e capturas, inclusive dessa tentativa, estão no relatório local original `.workshop/reports/layer-directories/README.md`. O diagnóstico conhecido `AttachConsole failed` do auxiliar de encerramento de ConPTY continua no stderr, embora os testes e o comando tenham encerrado com código 0.

Somente `dist-debug/` foi atualizado. A suíte completa de integração e o pacote portátil não foram repetidos/atualizados. Não houve limpeza retroativa de diretórios em repositórios do usuário: pastas que sobraram anteriormente são tratadas na próxima desativação da respectiva Layer.

## Complemento: explorador e abas

O explorador foi refeito seguindo as referências abertas do VS Code: [ExplorerDelegate/FilesRenderer/FileSorter](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/files/browser/views/explorerViewer.ts) e [tree.css](https://github.com/microsoft/vscode/blob/main/src/vs/base/browser/ui/tree/media/tree.css). Agora usa árvore com pastas recolhíveis, ordenação natural por irmãos, linhas de 22 px, Codicons locais, pastas compactas, teclado, menu de contexto, criação/renomeação inline e largura ajustável. Os marcadores Git e de propriedade das Layers permanecem separados.

**Reprodução do defeito das abas:** seis cliques síncronos em `README.md`, antes do retorno da leitura, criavam seis abas com o mesmo caminho/chave React. A abertura agora compartilha a leitura e verifica novamente o caminho antes de inserir. Leituras antigas são invalidadas ao fechar ou trocar de workspace; o fechamento atualiza a seleção a partir do estado corrente.

Verificações desta alteração no Windows x64:

- **Typecheck, build de debug e sourcemaps:** aprovados.
- **Unitários:** 44 casos, 43 aprovados, um skip Bash, zero falhas.
- **`node scripts/workshop-ui.mjs --no-build`:** três testes gráficos aprovados, saída 0, com Git real, perfis/repositórios descartáveis e sandbox ativo. O novo teste confirma também `BrowserWindow.isVisible() === true`, seis cliques produzindo uma única aba, fechamento de todas as abas sem sobras, teclado, criação/renomeação, colisão sem sobrescrita, cópia validada de caminho, buffer independente, temas e Layers. Esse teste foi integrado a `workshop:ui`; os arquivos E2E rodam em sequência porque compartilham o clipboard do Windows.

O relatório e as capturas locais estão em `.workshop/reports/explorer/README.md` (localização original). O primeiro teste da cópia de caminho detectou bloqueio de permissão no navegador; foi corrigido por uma operação restrita no preload, sem liberar permissões gerais. O auxiliar de encerramento de ConPTY ainda escreveu `AttachConsole failed` no stderr, embora os testes e o processo tenham encerrado com código 0.

Somente `dist-debug/` foi atualizado; o pacote portátil e `dist/` continuam com suas versões anteriores. A suíte completa de integração não foi repetida. Arrastar/soltar, seleção múltipla e renomeação/exclusão recursiva de pastas não fazem parte desta implementação do explorador.

## Complemento: janela oculta ao usar Dev

Após o relato do usuário sobre o botão **Dev**, a execução exata `node scripts/dev.mjs` reproduziu Electron e renderer ativos sem janela visível. O inspector confirmou `BrowserWindow.isVisible() === false`, mesmo com a página `gitlayers://app/index.html` carregada. **Os testes anteriores de DOM e screenshot não detectavam esse defeito na abertura pelo lançador.**

O lançador usava `windowsHide: true`, que neste Windows ocultava também a primeira janela gráfica. Dev/Debug e Abrir passaram a lançar a GUI com `windowsHide: false`; auxiliares de console continuam ocultos. Dev/Debug agora informam o PID na partida e `Editor aberto: ...` somente após a confirmação de uma janela visível enviada pelo main. Erros de inicialização também são escritos no terminal.

O primeiro reteste confirmou a visibilidade e os inspectors, mas falhou no cenário de atualização: notificações repetidas de uma gravação causavam dois reinícios, encerrando a página durante a reconexão. O observador agora compara nomes e bytes das entradas de build para descartar notificações sem alteração de conteúdo. A falha e seu log foram preservados.

Resultados após as duas correções:

- **Dev normal e Abrir:** comandos exatos executados com `C:\Dev\GitLayerTest`; ambos criaram janela nativa com título e handle visível no Windows. Fechar cada janela encerrou a respectiva tarefa com código 0.
- **Debug/atualização:** `verify:dev` aprovado, incluindo a nova asserção `BrowserWindow.isVisible()`, inspectors main/renderer, um reinício, rascunho recuperado sem alterar o disco e encerramento do pai ao fechar a janela.
- **Regressões rápidas:** 41 casos, 40 aprovados, um skip Bash, zero falhas. O novo teste distingue conteúdo idêntico, alteração do mesmo tamanho, inclusão/exclusão de fonte e mudança de configuração.
- **Typecheck e mapas:** aprovados. Nenhuma dependência ou configuração de sandbox foi alterada.

As evidências adicionais estão em [startup](evidence/windows-2026-10-18/startup/README.md). A suíte completa, o pacote e o E2E amplo não foram repetidos neste complemento; seus resultados anteriores abaixo mantêm o escopo original.

## Ambiente confirmado

| Componente | Versão e caminho efetivos |
| --- | --- |
| Windows | Windows 11 Pro x64, 10.0.26200; ConPTY disponível |
| Node de desenvolvimento/CLI interativa | 24.14.1 x64, C:\Program Files\nodejs\node.exe |
| npm | 11.11.0; Tasks chamam Node diretamente e evitam npm.ps1 bloqueado |
| Git | 2.53.0.windows.2, C:\Program Files\Git\cmd\git.exe |
| PowerShell | 5.1.26100.9711, WindowsPowerShell/v1.0/powershell.exe |
| Electron | 44.9.0 x64; Node embutido 24.22.0 |
| node-pty / xterm / fit | 1.1.0 / 6.0.0 / 0.11.0 |
| React / Monaco / TypeScript / Playwright | 19.3.1 / 0.57.0 / 5.9.3 / 1.64.1 |
| VS Code / Task Buttons | 1.142.0 x64 / spencerwmiles.vscode-task-buttons 1.4.2, já instalada |

A instalação pelo lockfile passou usando caches locais .workshop/npm-cache e .workshop/electron-cache. **Nenhuma versão de dependência foi atualizada e package-lock.json permanece idêntico ao snapshot inicial.** A instalação inicial falhou com EPERM no cache Electron de AppData; o cache local resolveu essa etapa. A política do PowerShell e a configuração Git global não foram alteradas. npm audit informa duas vulnerabilidades baixas transitivas; não foi aplicado audit fix indiscriminado.

## Problemas reproduzidos e correções

1. **Mutações falhavam com ENOENT em .git/git-layers/locks/C:**. mkdir retornava um caminho Windows com namespace e path.relative comparava raízes diferentes. O armazenamento agora compara os dois caminhos no mesmo namespace e mantém as verificações de ancestralidade e links. Há regressão para caminhos normais e namespace nativos.
2. **A demonstração falhava com fatal: unable to access '\\.\nul': Invalid argument.** A configuração Git isolada passou a usar /dev/null, aceito pelo Git for Windows. Fixtures também definem autocrlf localmente, sem depender da configuração pessoal.
3. **Monaco gerava UNKNOWN service ICodeLensCache/IInlayHintsCache e serviços correlatos.** As contribuições standalone são registradas antes do primeiro editor. O E2E final não registra erros JavaScript ou de console no renderer.
4. **Digitação rápida podia perder/reordenar texto e reposicionar o cursor.** O editor distingue a confirmação atrasada de uma edição React da atualização externa do modelo. E2E verifica digitação, bytes salvos e commit real; o fluxo Dev verifica recuperação do buffer após recompilar.
5. **A CLI interativa não recebia TTY ao usar o executável gráfico Electron.** O terminal Windows agora seleciona Node instalado 22.12+ em caminho absoluto e valida seu runtime. PowerShell/ConPTY, confirmações e Ctrl+C continuam reais; a checagem TTY da CLI permanece ativa. O launcher portátil Electron atende comandos não interativos; captura externa exige Node.
6. **Teclas do terminal aguardavam consultas Git na fila IPC.** Entrada, Ctrl+C, resize, estado do PTY e cópia têm caminho síncrono separado; criar/fechar a sessão e trocar workspace continuam serializados. O E2E verifica que a consulta do terminal responde antes de um snapshot Git real.
7. **O painel foi simplificado conforme a decisão do usuário:** catálogo de 33 comandos, campos, prévia e Copiar comando. Não insere nem executa no shell. O antigo terminalCommand foi removido do preload/main e sua recusa é testada. Colagem e Enter são deliberados; copiar preserva processos interativos e linhas já em edição.
8. **O harness PTY podia bloquear o Worker ou manter Node vivo.** Ele agora compila as fontes atuais para um processo sem loader herdado pelo Worker. O fechamento libera o Worker inclusive após saída natural do shell. A fixture mínima mantém base, Layer, CLI e Git reais; a demonstração completa tem teste próprio.
9. **Esperas assíncronas do E2E podiam avançar antes da condição.** O polling agora aguarda cada resultado no Node. Há regressão com resultados false atrasados e timeout; verificações de saída exigem novas ocorrências, sem aproveitar JSON anterior.
10. **O verificador ASAR falhava no Windows embora o arquivo existisse.** A API usa path.sep; a inspeção passou a usar separadores nativos. Todas as comparações de bytes e a integridade PE/ASAR continuam ativas.
11. **O preflight --version do pacote abria a aplicação em vez de terminar.** O probe agora consulta a versão em modo runtime. A execução gráfica isolada subsequente é que verifica sandbox e UI. A tentativa anterior não deixou processo --version ativo.
12. **A execução ampla anterior teve timeouts na demonstração, no PTY e no caso de renomeação do editor.** Foram 120 casos: 113 aprovados, duas falhas, um cancelado pelo limite de tempo e quatro skips. O limite da CLI passou a 150 s, a concorrência foi limitada a dois arquivos e a fixture do PTY foi reduzida ao necessário. Não foram removidas as asserções sobre staging real nem o teste completo da demonstração.
13. **O caso extenso de renomeação/backup ainda excedeu o limite global de 180 s na execução ampla seguinte.** Esse caso tem agora limite explícito de 300 s e reexecução isolada registrada. A suíte ampla não foi repetida integralmente depois desse último ajuste de timeout; os resultados abaixo distinguem as duas execuções.

## Operação pelo VS Code

Abra **Git-Layers-Lab.code-workspace**. Há três botões: **Dev**, **Debug** e **Workshop**. O menu oferece preparação, diagnóstico, testes rápidos, smoke, suíte completa, interface, typecheck, builds, pacote Windows e mapas. O esquema foi conferido no código/manifesto da extensão instalada. Os botões estão definidos no arquivo de workspace e também em .vscode/settings.json para abertura apenas da pasta; todos os destinos correspondem aos nomes exatos das Tasks.

Dev observa fontes, recompila e reinicia, preservando buffers como rascunhos. Debug abre inspectors locais em 9229/9222. Use F5 com **Workshop: conectar ao botão Debug** para anexar à instância existente. Há lançamentos diretos, CLI e teste selecionado. A automação pausou/retomou main, renderer e CLI/Core, verificou reinício, rascunho e encerramento do processo pai. Isso não equivale a clicar fisicamente todos os botões ou validar todas as combinações de extensões do usuário.

**C:\Dev\GitLayerTest** é a demonstração padrão, exclusivamente local e sem remotos. Preparação inicial e reutilização preservando uma edição foram executadas; o teste removeu somente seu arquivo de prova exclusivo e manteve o README existente. A demonstração antiga, perfis, rascunhos e backups foram preservados. Testes destrutivos usam fixtures temporárias.

Abrir Aplicativo.cmd e Preparar Workshop.cmd foram removidos. Os arquivadores excluem esses nomes e .workshop. git-layer.cmd e Diagnostico.cmd do portátil mantêm suas funções de CLI/suporte. O git-layer.cmd real foi executado com status JSON e exit 0.

## Resultados observados

Evidências selecionadas estão em [evidence/windows-2026-10-18](evidence/windows-2026-10-18/README.md); os logs completos locais ficam em .workshop/reports. Os relatórios históricos de outros ambientes não substituem estes resultados.

| Verificação | Resultado |
| --- | --- |
| Preparação usada pelas Tasks | Exit 0; instalação preservada, build debug atual e demonstração reutilizada |
| Typecheck | Aprovado, exit 0 |
| Testes rápidos | 40 casos: 39 aprovados, 1 skip Bash, 0 falhas; cerca de 1,45 s |
| Suíte completa final | 121 casos: 116 aprovados, 0 falhas, 4 skips, 1 cancelados; exit 1; 26.8 min |
| Renomeação, propriedade e backup após ajuste | Exit 0; cenário completo reexecutado isoladamente em 164.4 s, com limite explícito de 300 s |
| Smoke Core/CLI | Oito etapas aprovadas: refs/blobs reais, HEAD main, bytes CRLF e fsck |
| PowerShell/ConPTY isolado | Digitação, captura q/todos/sim e staging real aprovados; processo encerrou |
| UI local Electron/Playwright | 2 testes aprovados, 0 falhas; cerca de 92 s |
| Abrir/inicializar | UI recusa pasta sem Git sem inicializar; inicialização explícita preserva arquivo; abre Git existente. Somente a escolha no diálogo nativo é substituída |
| Buffer/disco/staging/commit | UI real verifica distinção, salvamento, diff, staging e commit main com árvore Layer independente |
| Explorer/abas/propriedade | M aparece após salvar e desaparece após commit; ícone Layer tem proprietário no tooltip, sem nome inline |
| Terminal na UI | Copiar/colar, linha em edição, digitação, captura, confirmação restore e Ctrl+C aprovados, com espaços e acentos |
| Debug real | Inspectors main/renderer/CLI pausaram e retomaram; recompilação restaurou rascunho sem alterar disco; fechar encerrou o pai Dev |
| Sourcemaps | 115 mapas, 93 renderer, 1.715 fontes embutidas, 21 fontes de projeto e cinco workers Monaco; conferidos também após limpar o probe Dev |
| Pacote Windows | PE/ASAR, CLI e sete nativos aprovados; 152 arquivos de produção comparados byte a byte |
| UI do executável portátil | 2 testes aprovados, 0 falhas; cerca de 235 s; runtime e caminho do pacote registrados |

O E2E mantém sandbox, contextIsolation, webSecurity e Node desativado no renderer; verifica assets/workers locais e ausência de rede. Não usa controle visual do PC. O sandbox restrito da ferramenta não conseguia lançar Electron; a execução autorizada fora dessa restrição preservou a sandbox do aplicativo.

Na execução ampla mais recente houve um cancelamento por tempo, sem falha de asserção; veja a reexecução do caso no registro separado. Os logs também contêm uma falha exit 7 deliberada, produzida pelo teste de propagação de erro do runner gráfico. Esse caso é aprovado quando registra corretamente a falha. A execução anterior com timeouts está preservada separadamente.

## Limites e pendências

O node-pty 1.1.0 ainda pode escrever **AttachConsole failed** no agente de enumeração ao encerrar ConPTY. A interação e a saída dos testes passam, mas esse diagnóstico de fechamento não foi eliminado nem ocultado. Nenhum módulo upstream foi modificado silenciosamente.

Os casos de symlink sem privilégio Windows informam skip; junctions têm verificação separada. Não foram certificados DPI físico, acessibilidade completa, todos os diálogos nativos, interferência externa ou corte de energia. Não foi reexecutada uma nova extração ZIP; o pacote local tem verificação própria. Python não está disponível como executável funcional para os arquivadores existentes.

Amend, tags mutáveis, stash de escrita/pop, merge, cherry-pick, revert, continue/abort e resolução de seus conflitos continuam **NOT_IMPLEMENTED**. Também permanecem fora do escopo instalador/assinatura, transferência de propriedade, merge de Layers e reconciliação automática de refs externas. Veja [LIMITATIONS.md](LIMITATIONS.md).

A autorização de salvar no GitHub aplica-se às fontes deste projeto. A pasta C:\Dev\GitLayerTest e os dados privados de .workshop não participam desse envio.
