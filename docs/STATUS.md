# Estado do Git Layer

A [investigação de segurança e compatibilidade de 03/11/2026](reports/2026-11-03-security-compatibility-investigation/README.md) avaliou este snapshot sem implementar soluções: dois defeitos novos e quatro famílias de risco confirmados. Consulte relatório, matriz, alternativas e reproduções antes de ampliar o uso. Os status da implementação abaixo permanecem históricos; esta investigação não promove requisitos parciais a completos.

O produto é o Core/CLI com Git oficial. Laboratório e integrações visuais são opcionais e não participaram desta validação.

O [relatório público](reports/2026-11-02-closure/REPORT.md), a [matriz dos 27 requisitos](reports/2026-11-02-closure/requirements.json) e a [validação estruturada](evidence/closure-2026-11-02/validation.json) permitem revisão sem ZIP. O suporte permanece em **20 implementados e sete parciais**, nos envelopes declarados.

- `full-final-02`: **229 casos, 225 PASS, zero FAIL, quatro SKIP**. Os 16 R05, seis R02/R03 e seis testes da ferramenta de arquivo passaram juntos. Os skips são três permissões de symlink e o Bash omitido pelo perfil Windows; não é ausência de Git Bash.
- `infra-final-02`: **111/111 PASS**, zero FAIL/SKIP. Typecheck02 exit 0. Full/infra/typecheck conservaram o fingerprint 1bd7 no domínio de 61 inputs; os [173 inputs funcionais](evidence/closure-2026-11-02/functional-inputs.json) têm domínio/fingerprint distintos e permaneceram iguais antes/depois de todas as suítes.
- [Build/smoke compilado](evidence/closure-2026-11-02/build-smoke.json): PASS, três comandos do wrapper, sete fluxos, 82 comandos internos registrados e quatro snapshots. A cópia de runtime sem node_modules continua exigindo Node/Git instalados.
- [Broad2 completa](evidence/closure-2026-11-02/matrix-broad.json): **355 PASS, seis ENV_BLOCKED, zero FAIL em 361 selecionadas**, exit 0, fontes/runner estáveis. Os bloqueios mantêm seus motivos; a [primeira broad](evidence/closure-2026-11-02/matrix-broad-first.json), full01/infra01 e dirigidos conservam snapshots próprios.
- [Cópia nova do commit A](evidence/closure-2026-11-02/fresh-commit.json): **PASS**, instalação pelo lockfile, typecheck/build/help/smoke/verificadores; 358 arquivos preservados, status limpo da cópia, sete fluxos/82 comandos/quatro snapshots. Não repetiu full/broad.
- [Código A no servidor](evidence/closure-2026-11-02/code-checkpoint.json): HEAD/origin/main/ls-remote/API iguais em **fc68d8cc1eb1faccf7dbb654eeb632b0caa9f4fb**, ahead/behind 0/0 na observação de 2026-11-03T02:00:38.979Z. Isso antecede o commit documental B e não é a verificação final dele.
- [Arquivo verificado](evidence/closure-2026-11-02/cleanup.json): **194 movimentos**, 613966 arquivos/2467819045 bytes. Foram 142 raízes+43 filhos+9 descendentes, com dois contêineres sem payload, um run sem propriedade e extras operacionais preservados.
- [Protocolo final](evidence/closure-2026-11-02/finalization.json): esta atestação antecede o commit documental B. O SHA final e a igualdade de B no servidor são conferidos depois da publicação e informados na entrega; não são antecipados por este documento.

A [missão atual](decisions/2026-11-02-closure.md) autoriza publicar o desenvolvimento acumulado. As [decisões recebidas](decisions/implementation-2026-11-02/README.md) preservam os contratos e sua precedência. Consulte [contratos](IMPLEMENTATION-2026-11-02.md), [CLI](CLI.md), [segurança](SAFETY.md), [limitações](LIMITATIONS.md) e [contribuição](../CONTRIBUTING.md).

A baseline externa verificada desta rodada preservou 324 arquivos, distinta das 301 cópias da primeira implementação. Logs brutos classificados têm retenção externa verificada por inventário/hashes e recibos. As preservações locais intencionais não são resíduos apagados para obter status limpo. Perfis, demonstrações, rascunhos e dados reais continuam protegidos.
