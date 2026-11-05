# Publicação e verificação em cópia nova

**Implementação validada em cópia nova; fechamento documental B.** A implementação está no commit local `934befc1516bd12b3aee43c6b4e326d34e647f1b`. A verificação independente da cópia nova A passou, com fontes iguais e runtime relocado sem dependências: [receipt](FRESH-COMMIT-A.json) e [auditoria de privacidade, sem candidatos](FRESH-COMMIT-A-PRIVACY-AUDIT.json). Commit documental B, push, cópia nova B e sincronia serão atestados depois de existirem; nenhum SHA B é antecipado. [Protocolo](PUBLICATION.md).

## Registro pré-A (histórico)

Este documento registra o protocolo da entrega, com os resultados efetivamente observados separados das etapas futuras. Não contém SHA inventado nem atesta publicação por antecipação. Nesta revisão, nenhum receipt de commit A, cópia nova A, commit B, push ou cópia nova B foi fornecido ao lote documental: essas etapas permanecem **PENDENTES/NÃO ATESTADAS**.

A referência inicial confirmada foi d71ccc7d188500a22e56ea93c70ac946dba9db60. Ela identifica a baseline, não o commit final. As [fontes e campanhas executadas](RESULTS.md) e a [equivalência V9/V11](SOURCE-EQUIVALENCE-V9-V11.json) conservam seus fingerprints e limites próprios.

| Etapa | Ordem e evidência exigida | Estado no registro pré-A |
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

## Atualização após validar A

O commit A `934befc1516bd12b3aee43c6b4e326d34e647f1b` foi criado localmente e validado antes do push. A cópia nova A terminou PASS de 2026-11-05T05:13:30.486Z a 05:16:10.140Z, receipt bruto SHA-256 0697d7e2af969aabe1246f67baadeacee3af5010698ab6fe3e9079edbc90958e. Os 22 comandos do supervisor tiveram os códigos esperados: 21 exit 0 e um exit 1 esperado em source-uploadpack-hook-config, que comprova ausência do hook. O smoke compilado passou em 82 comandos, sete fluxos e quatro snapshots; o runtime relocado funcionou sem node_modules. Esses comandos não somam testes à full415 ou à matriz361.

Os quatro grupos ficaram iguais nas quatro fronteiras sourceBefore/sourceAfter/cloneBefore/cloneAfter: functional209 5cc41446889657aee4f4622a0d5ab3ed46483a01f937cab7218a8c297415b44d; source 50f76e9aeeb96f50a618b6069fdc48a672152dac9e34d8aabf50c26d2310d0bc; lock a5fba272cabcce66ea683d9638ec6d1f73e8339de96960691b5c4237c1b4151d; grupo core do supervisor 5a401083c7b79944134c6a28ce80b5577de3c932fa4647d73b2b3e365aa2fa67. O fingerprint compilado 8ef83fc23298f7b22225845e19798b2a92fb3d8d4342fb348f436ffdaf006ab4 permaneceu igual antes/depois do smoke. Esses domínios são distintos do Core18 usado no benchmark.

[Receipt público A](FRESH-COMMIT-A.json), [auditoria sem candidatos](FRESH-COMMIT-A-PRIVACY-AUDIT.json) e [protocolo estruturado](PUBLICATION.json) preservam o alcance. A atualização B contém somente documentação/evidências. Seu SHA, o push, a cópia nova B e a igualdade local/remoto/GitHub serão atestados externamente após B existir, sem autoatestação nem circuito de commits C/D para registrar o hash do próprio documento. A validação A não é renomeada como execução de B.
