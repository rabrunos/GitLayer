# Relatório — Git Layers Lab Workshop Windows 0.1.2

Data: 18/10/2026. **Entrega experimental parcial.** O ZIP reúne fontes, testes, scripts, configuração VS Code, build de debug e aplicativo portátil Windows x64. O usuário não precisa de Linux ou WSL.

## Implementado nesta atualização

- Workshop abrível por Git-Layers-Lab.code-workspace, AGENTS.md e guia para o Codex; comandos para preparar, diagnosticar, abrir, depurar, testar e empacotar.
- Debug separado em dist-debug com mapas e fontes embutidas, perfil isolado e demonstração persistente. F5 para main/Core, CLI, teste selecionado e renderer; inspeção limitada a loopback quando solicitada.
- Terminal integrado real node-pty/xterm, PowerShell/ConPTY no Windows e Bash/PTY no host de desenvolvimento. Inicia por ação do usuário; há teclado, Ctrl+C, redimensionamento, saída e encerramento.
- Catálogo com os **33 comandos existentes da CLI**, campos de argumentos e prévia. Os botões escrevem a CLI no mesmo shell e pressionam Enter; não chamam uma implementação alternativa nem um motor de tarefas.
- Indicadores convencionais no Explorer e abas: uma letra por arquivo, com prioridade para alterações no disco; U para não rastreado, ! para conflito, detalhes do índice/disco no hover. Buffer não salvo tem ponto separado.
- Identificação de Layer por ícone discreto de camadas, sem nome na linha; nome acessível no tooltip/aria. Base limpa não recebe badge de propriedade.
- Abrir pasta Git e inicializar uma pasta já existiam; esses fluxos foram preservados e documentados.

O editor, CLI e botões usam o Core/Git real. O terminal também permite comandos manuais normais, que têm as permissões do usuário e os limites das ferramentas externas.

## Testado, com alcance exato

**118 cenários distintos aprovados em duas execuções:** a suíte ampla concluiu **115/115**; os três casos adicionados depois para os indicadores do Explorer passaram **3/3** separadamente. Não se apresenta uma saída única 118/118 que não foi executada.

| Verificação executada | Resultado e evidência |
| --- | --- |
| Suíte ampla npm test | 115 aprovados, 0 falhas/skips/cancelados; 160672,097734 ms. evidence/WORKSHOP-TESTS-115.txt |
| Indicadores finais do Explorer | 3/3 aprovados: estado limpo, staging/disco, untracked/conflitos, buffer separado, propriedade e arquivos removidos. evidence/WORKSHOP-DECORATIONS-3.txt |
| TypeScript strict final | Exit 0 após as últimas alterações. evidence/WORKSHOP-TYPECHECK.txt |
| PTY interativo real | Incluído na suíte: digitou git layer status e completou capture com q, todos e sim; o staging real de arquivo Unicode foi conferido. Foi Bash/PTY no host, não PowerShell Windows. |
| Catálogo/argumentos | 33 comandos comparados com a CLI; quoting e roundtrip real Bash; geração PowerShell e limites testados estaticamente. Restore não ganha --yes automaticamente. |
| Smoke do workshop | Oito chamadas CLI reais: status, criar/ativar Layer, preparar/commit, desativar/reativar, doctor --fsck; HEAD base, blob real e CRLF físico conferidos. evidence/WORKSHOP-SMOKE.txt e WORKSHOP-SMOKE.JSON |
| Instalação limpa extraída | npm ci instalou 89 pacotes pelo lockfile; prepare, mapas, smoke e nova preparação preservando edições rastreadas e Unicode não rastreadas. O comando verify:extracted também passou com a nova raiz do workshop, instalando, compilando e executando CLI/demo/doctor de uma nova extração; 71 fontes/configurações tiveram hashes conferidos. Detalhes em evidence/WORKSHOP-EXTRACTED.json/.txt. |
| Depuração real da CLI | Inspector local, breakpoint em GitLayers.open, inspeção do argumento, pausa/retomada e status com exit 0. Evidência WORKSHOP-CLI-INSPECTOR.json. Foi no host; não F5 no Windows. |
| Debug build final | 41 mapas, 1.565 fontes embutidas, 20 fontes de projeto conferidas com src e cinco workers Monaco com mapas. evidence/WORKSHOP-DEBUG-MAPS.json |
| Pacote Windows final | Executável PE32+ AMD64, versão 0.1.2; 78 arquivos de produção iguais ao ASAR, 18 arquivos externos CLI/Core iguais, cinco workers; 24 arquivos node-pty iguais ao upstream, todos fora do ASAR; sete binários nativos Windows AMD64. evidence/WORKSHOP-PACKAGE.json |
| Integridade do ZIP | Reabertura e CRC de todas as entradas pelo script de arquivo; perfis, testes descartáveis, dependências de desenvolvimento e nativos de outras plataformas excluídos. |

Os testes são processos/arquivos/Git reais quando assim identificados. Os testes unitários de geração PowerShell usam um provider falso explicitamente declarado; não são contados como execução do PowerShell. O Git não foi substituído por uma simulação.

A suíte contém um teste que provoca deliberadamente falha exit7 de um processo de teste gráfico para verificar logs e códigos. Esse texto aparece na saída, mas o caso de regressão passou; a contagem consolidada continua 115 aprovados e nenhuma falha na suíte de domínio.

## O que não pôde ser testado

**Não foi executado Windows nativo.** Não há máquina ou VM Windows disponível nesta sessão. Portanto ainda faltam comprovação da abertura do .exe, PowerShell/ConPTY, comportamento NTFS, launchers .cmd, F5 no VS Code Windows e interação visual completa.

Foi feita uma tentativa final de npm run workshop:ui -- --no-build no host Linux. A fixture Git/Layer real foi criada, mas o Electron abortou no preflight com SIGTRAP por execução como root sem sandbox disponível. **0 asserções gráficas foram alcançadas.** Não se utilizou --no-sandbox para declarar sucesso. Saída e fase exata em evidence/WORKSHOP-UI.json, WORKSHOP-UI-EVIDENCE.json e WORKSHOP-UI.txt.

Os E2E entregues cobrem edição/commit real, limites IPC, assets locais, indicadores M, tooltip da Layer e terminal integrado. A existência desses testes não significa que passaram visualmente. O PTY independente passou no host; o componente xterm dentro da janela e ConPTY Windows permanecem sem execução comprovada.

## Ambiente efetivamente utilizado

| Item | Versão |
| --- | --- |
| Host | Ubuntu 24.04, Linux x64 |
| Node / npm / Git | 24.19.0 / 11.9.0 / Git real 2.51.1 |
| Alvo do portátil | Windows 10/11 x64; terminal ConPTY: Windows 10 1903+ / Windows 11 |
| Electron | 44.9.0 oficial win32-x64 |
| node-pty / xterm / addon-fit | 1.1.0 / 6.0.0 / 0.11.0 |
| React / Monaco / TypeScript | 19.3.1 / 0.57.0 / 5.9.3 |

O lockfile foi produzido pelo npm, com versões e integridades reais. A primeira instalação nativa Linux falhou ao extrair headers por fchown no host; foram obtidos os headers oficiais 24.19.0 com SHA256 verificado e usados apenas nesse ambiente via npm_config_nodedir. A instalação limpa posterior passou. Isso não é uma etapa a executar no Windows. O pacote portátil usa os prebuilds Windows do node-pty, inspecionados, sem incluir o módulo compilado Linux.

Nenhuma configuração Git global, remoto ou repositório pessoal foi alterado. A preparação/demo preserva edições existentes. Os perfis e relatórios de execução ficam em .workshop e são excluídos do ZIP; somente evidências estáticas selecionadas estão em docs/evidence.

## O que continua incompleto

Amend, tags mutáveis, stash de escrita/pop, merge, cherry-pick, revert e resolução/continue/abort de conflitos permanecem indisponíveis. Também faltam reconciliação automática de refs externas, renomeação/exclusão recursiva de diretórios, instalador e assinatura digital.

Não há garantia de isolamento contra processos externos, durabilidade ACID/corte de energia ou desempenho amplo. O envelope conservador de repositórios, arquivos e links continua documentado em LIMITATIONS.md. O indicador de conflito não acrescenta um resolvedor de merge.

## Usar e depurar

Para o aplicativo pronto, execute Abrir Aplicativo.cmd ou o .exe em artifacts/Git Layers Lab-win32-x64. Para o Codex, abra o workspace e siga AGENTS.md: npm ci, workshop:prepare, workshop:doctor e F5. O terminal integrado e os botões são operações do aplicativo; as tarefas npm do workspace servem apenas ao build/debug no VS Code.

Veja WORKSHOP.md, WINDOWS.md, TERMINAL.md e WORKSPACE.md. Os relatórios 0.1.0/0.1.1 foram preservados em history/ como histórico, sem certificação Windows.
