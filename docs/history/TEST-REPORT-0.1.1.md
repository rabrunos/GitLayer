# Relatório de execução — Git Layers Lab 0.1.1 Windows

Data: 18/10/2026 UTC. **Entrega experimental parcial**, dirigida a Windows 10/11 x64. O usuário não precisa ter Linux nem executar testes em Linux.

## Resultado e distinção de alcance

| Situação | Resultado efetivamente obtido |
| --- | --- |
| Implementado e testado com Git real no host | Core, CLI, arquivos/editor por API, caminhos, armazenamento, locks, journals, recuperação, captura, shelves, commits e índices independentes. **100/100 testes passaram**, sem falhas, skips ou cancelamentos. |
| Implementado e empacotado para Windows | Executável real PE32+ AMD64, versão 0.1.1, runtime Electron 44.9.0, DLLs/locales, renderer/Monaco, CLI portátil e diagnóstico. Conteúdo e hashes conferidos. |
| Compilado, sem execução gráfica comprovada | Janela Electron, IPC real, workers em execução, watchers, atalhos, acessibilidade e recuperação dos buffers. |
| Não pôde ser testado | Executável/CLI no runtime Windows e sistema de arquivos NTFS nativo. Não há Windows disponível. A tentativa isolada via Wine foi bloqueada pelo host antes de executar um programa Windows. |
| Continua incompleto | Amend, tags mutáveis, stash de escrita/pop, merge, cherry-pick, revert e seus conflitos; reconciliação automática de refs externas; renomear/excluir diretórios recursivamente; instalador e assinatura digital. |

Os 100 testes foram executados **em Linux pelo responsável pela implementação**, com processos Git reais. Eles exercitam o domínio compartilhado e casos puros da lógica Windows, mas não certificam execução nativa Windows. Não se declara a especificação inteira concluída.

## Ambiente de verificação

| Item | Versão |
| --- | --- |
| Host de build/testes | Ubuntu 24.04, Linux x64 |
| Node / npm | 24.19.0 / 11.9.0 |
| Git utilizado na suíte final | 2.51.1 real |
| Alvo do pacote | win32 x64, Windows 10/11 |
| Electron incluído | 44.9.0, binário oficial win32-x64 |
| React / Monaco / Vite / TypeScript | 19.3.1 / 0.57.0 / 8.3.4 / 5.9.3 |
| @electron/packager | 20.3.0 |
| Pré-requisito do usuário | Git for Windows >=2.43; sem Node/npm para o portátil |

O lockfile foi atualizado pelo npm, preservando as versões fixadas. Não foram inventados binários ou resoluções. Nenhuma configuração Git global, remoto ou repositório do usuário foi alterado.

## Comandos e evidências

| Verificação | Resultado |
| --- | --- |
| npm run typecheck | Exit 0, TypeScript strict de produção. evidence/WINDOWS-EDITION-TYPECHECK.txt |
| npm test | **100 aprovados**, 0 falhas/cancelados/skips; 157230,886911 ms. evidence/WINDOWS-EDITION-TESTS-100.txt |
| npm run package:windows com cache oficial do Electron | Exit 0; executa build completo antes do empacotamento. Há aviso Vite de chunks acima de 500 kB; build concluído. |
| Inspeção do pacote final | PE AMD64/PE32+, metadados 0.1.1, ASAR e recurso de integridade; 64 arquivos do dist comparados byte a byte, 18 arquivos externos da CLI comparados, diagnóstico idêntico à fonte e cinco workers locais. |
| CLI extraída do pacote via Node do host | --help exit 0. Confirma conteúdo/imports; **não executa o .exe Windows**. |
| Diagnóstico via Node do host | Exit 2, ready=false, plataforma linux e Git encontrado; identifica corretamente ausência de runtime Windows. |
| Extração independente do código-fonte | Exit 0. npm ci instalou 85 pacotes pelo lockfile; build, CLI, demonstração real e doctor concluídos, sem teste gráfico. 44 arquivos de código/scripts/testes/configuração mantiveram hashes idênticos. Saídas em evidence/windows-source-extracted.json e evidence/WINDOWS-SOURCE-EXTRACTED.txt. |
| Teste gráfico nativo Windows | Não executado. Não há máquina/VM Windows acessível. |
| Tentativa Wine isolada | wineserver: socket: Operation not permitted. O host recusa socket AF_UNIX; nenhum programa Windows iniciou. evidence/WINDOWS-WINE-PREFLIGHT.txt |

A suíte soma 85 cenários anteriores e 15 novos: seis de plataforma, seis de compatibilidade/integração e três do pacote. Não soma repetições direcionadas como testes novos. Os testes novos incluem Path/PATH, busca de git.exe, separadores, modos Windows, espaços/acentos, CRLF/binários, índice principal intacto, metadados 100755, hooks explicitamente desabilitados e payload portátil.

O teste de links seleciona junction em Windows e link simbólico no host. A execução feita aqui cobriu a ramificação do host, **não junction NTFS**. Casos puros recebem win32 como argumento; isso também não equivale a executar o sistema operacional.

## Conteúdo do pacote Windows

- git-layers-lab.exe e arquivos oficiais de suporte do Electron, incluindo locales/pt-BR.pak.
- resources/app.asar com main ESM, preload CJS e renderer local; Node desligado no renderer, sandbox e isolamento preservados.
- resources/cli com Core/CLI compilados e diagnóstico; git-layer.cmd usa o Node embutido, sem instalação global.
- Diagnostico.cmd registra runtime/Git, sem abrir repositórios ou enviar relatório.
- Documentacao/ com README, guias, limitações, relatório e evidências; licenças preservadas.

O runtime oficial foi obtido por @electron/get com validação SHASUMS256 habilitada. Seu SHA256, o hash do executável, do ASAR e manifests estão em evidence/windows-package.json, windows-asar-index.txt e windows-source-sha256.txt. A lista mínima de arquivos também acompanha WINDOWS-PACKAGE.json no portátil.

A geração de um PE, a existência dos DLLs e a igualdade dos arquivos não comprovam que a janela abriu. O pacote não tem assinatura digital nem instalador. Git for Windows permanece externo e é detectado pelo aplicativo.

## Validação dos ZIPs

O script scripts/archive-windows.py produz um ZIP portátil com a pasta completa e outro de fontes/build/documentação, excluindo node_modules, caches, repositórios de teste, pacote Linux e runtime do host. Cada ZIP é reaberto e todas as entradas passam por verificação CRC antes da entrega. A documentação é atualizada no portátil após o fechamento deste relatório, sem alterar o PE/ASAR inspecionados.

A licença do código original permanece UNLICENSED/private, pendente da decisão do titular; os avisos das dependências e do Electron estão incluídos.

## Limites que permanecem

Não foram executados em Windows nativo: primeira abertura, instalação/detecção real do Git for Windows, fluxo completo visual, launchers .cmd/Git Bash, arquivos bloqueados/antivírus, junctions/reparse points, corte real de energia e validação ampla de desempenho. Wine não substitui esses testes e sua tentativa não passou da infraestrutura do host.

As implementações desses fluxos permanecem revisáveis nas fontes, com testes fornecidos para um ambiente compatível. O pacote é entregue para Windows; não há instrução de uso ou teste Linux para o usuário. Consulte [WINDOWS.md](WINDOWS.md) e [LIMITATIONS.md](LIMITATIONS.md).

O relatório da edição anterior foi preservado em history/TEST-REPORT-0.1.0.md. Seus resultados e limitações são históricos, sem alegação de teste Windows.
