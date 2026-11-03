# Estado do Git Layer

O produto é o Core/CLI com Git oficial. Laboratório e integrações visuais são opcionais e não participaram desta validação.

O [relatório público](reports/2026-11-02-closure/REPORT.md), a [matriz dos 27 requisitos](reports/2026-11-02-closure/requirements.json) e a [validação estruturada](evidence/closure-2026-11-02/validation.json) permitem revisão sem ZIP. O suporte permanece em **20 implementados e sete parciais**, nos envelopes declarados.

- `full-final-02`: **229 casos, 225 PASS, zero FAIL, quatro SKIP**. Os 16 R05, seis R02/R03 e seis testes da ferramenta de arquivo passaram juntos. Os skips são três permissões de symlink e o Bash omitido pelo perfil Windows; não é ausência de Git Bash.
- `infra-final-02`: **111/111 PASS**, zero FAIL/SKIP. Typecheck02 exit 0. Full/infra/typecheck conservaram o fingerprint 1bd7 no domínio de 61 inputs; os [173 inputs funcionais](evidence/closure-2026-11-02/functional-inputs.json) têm domínio/fingerprint distintos e permaneceram iguais antes/depois de todas as suítes.
- [Build/smoke compilado](evidence/closure-2026-11-02/build-smoke.json): PASS, três comandos do wrapper, sete fluxos, 82 comandos internos registrados e quatro snapshots. A cópia de runtime sem node_modules continua exigindo Node/Git instalados.
- [Broad2 completa](evidence/closure-2026-11-02/matrix-broad.json): **355 PASS, seis ENV_BLOCKED, zero FAIL em 361 selecionadas**, exit 0, fontes/runner estáveis. Os bloqueios mantêm seus motivos; a [primeira broad](evidence/closure-2026-11-02/matrix-broad-first.json), full01/infra01 e dirigidos conservam snapshots próprios.
- **Pendentes:** cópia nova commitada com instalação/build/smoke, movimentação externa verificada, limpeza, commits/push e confronto real da main com o servidor. A autorização de publicar não comprova que isso ocorreu.

A [missão atual](decisions/2026-11-02-closure.md) autoriza publicar o desenvolvimento acumulado. As [decisões recebidas](decisions/implementation-2026-11-02/README.md) preservam os contratos e sua precedência. Consulte [contratos](IMPLEMENTATION-2026-11-02.md), [CLI](CLI.md), [segurança](SAFETY.md), [limitações](LIMITATIONS.md) e [contribuição](../CONTRIBUTING.md).

A baseline externa verificada desta rodada preservou 324 arquivos, distinta das 301 cópias da primeira implementação. Logs brutos únicos têm retenção externa prevista; sua movimentação final ainda depende de inventário/hashes reais. Perfis, demonstrações, rascunhos e dados reais continuam protegidos.
