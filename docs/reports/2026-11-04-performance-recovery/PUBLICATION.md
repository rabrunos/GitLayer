# Publicação e verificação em cópia nova

Este documento registra o protocolo da entrega, com os resultados efetivamente observados separados das etapas futuras. Não contém SHA inventado nem atesta publicação por antecipação. Nesta revisão, nenhum receipt de commit A, cópia nova A, commit B, push ou cópia nova B foi fornecido ao lote documental: essas etapas permanecem **PENDENTES/NÃO ATESTADAS**.

A referência inicial confirmada foi d71ccc7d188500a22e56ea93c70ac946dba9db60. Ela identifica a baseline, não o commit final. As [fontes e campanhas executadas](RESULTS.md) e a [equivalência V9/V11](SOURCE-EQUIVALENCE-V9-V11.json) conservam seus fingerprints e limites próprios.

| Etapa | Ordem e evidência exigida | Estado nesta revisão |
| --- | --- | --- |
| Commit A: implementação | Revisar alterações/segredos, conciliar a main/remoto sem força e registrar o SHA que contém Core/CLI, testes, scripts e documentação/evidências preparadas. | PENDENTE; SHA não atestado |
| Cópia nova A | Antes do push, criar checkout externo próprio do commit A, sem hardlinks/alternates. Instalar pelo lockfile, conferir fontes e executar typecheck, build independente, help e smoke compilado/relocado com ambiente isolado. Preservar comandos, códigos, hashes e limites do receipt. | PENDENTE |
| Commit B: documentação | Registrar o SHA A e o resultado real da cópia nova A. B contém somente documentação/evidências revistas; comparar os domínios funcionais com A. Uma diferença funcional exige validação própria e não pode ser declarada equivalente por este protocolo. | PENDENTE; SHA não atestado |
| Push A/B | Conferir novamente o remoto, incluir apenas os commits necessários na main e publicar sem force. Resolver concorrência normalmente. Push não é prova de instalação nem de CI remoto. | PENDENTE |
| Cópia nova B | Depois do push, obter uma cópia nova do commit B publicado e repetir instalação/execução/verificação de fontes no alcance definido. Registrar o SHA efetivamente recebido e os resultados reais; não reutilizar o receipt A como se fosse uma execução de B. | PENDENTE |
| Sincronia final | Confrontar HEAD local, origin/main, ls-remote e consulta direta ao commit no GitHub; exigir diferença zero, upstream correto e código versionado limpo. Conferir links publicados. | PENDENTE |

A passagem A→B é uma atualização documental somente quando os hashes de Core, CLI, scripts, testes, dependências e configurações funcionais permanecem iguais. Isso deve ser demonstrado, sem renomear uma campanha anterior ou somar denominadores. A cópia nova B continua sendo uma execução distinta, posterior à publicação; seu resultado só pode ser declarado depois de observado.

As cópias novas usam raízes externas exclusivas, marcador/nonce e ancestralidade conferida. HOME/USERPROFILE/XDG, configuração/identidade Git, credenciais, editores/pagers e temporários ficam isolados. Não se usam repositórios pessoais, a demonstração preservada ou o origin do projeto como fixtures destrutivas. Instalação por lockfile e build Core/CLI não certificam Electron, instalador, assinatura ou distribuição pública.

A validação já concluída permanece identificada por fonte: full V9 com 415 resultados/411 PASS/quatro SKIP; infraestrutura V11 com 113 PASS/113; matriz V11 com 355 PASS/seis ENV_BLOCKED/zero FAIL em 361 selecionados; typecheck/build/smoke V9 sobre o Core/runtime/corpus equivalente. Os FAIL históricos e quiet=false originais continuam preservados em [RESULTS.md](RESULTS.md). Esses resultados não atestam os SHAs A/B ainda ausentes.

Os receipts das cópias novas serão vinculados apenas após existirem e passarem a revisão de privacidade. Uma falha deve conservar saída, evidências e resultado próprio; não é convertida em SKIP ou sucesso para liberar publicação. Nenhum check de CI do GitHub é inferido de execução local.

A preparação para uso público pode avançar com os [limites documentados](LIMITATIONS.md), mas prontidão pública ampla, publicação e sincronização não estão atestadas nesta revisão. Consulte o [índice da etapa](README.md) para as evidências disponíveis.
