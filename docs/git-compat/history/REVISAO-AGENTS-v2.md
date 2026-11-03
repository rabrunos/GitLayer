# Revisão auditável de AGENTS — preparação v2

Data: 18/10/2026, America/Sao_Paulo. Autorização: tarefa do usuário e [guia do pacote](../reference/09-Guia-Revisao-AGENTS.md), decisões U-01 a U-10. O conteúdo anterior está preservado byte a byte em [AGENTS.before-v2.md](AGENTS.before-v2.md), SHA-256 `f61bfd346c88714bf32feed912c256c93e2443838d167fbcd37e9c3c565b4695`. A cópia foi feita antes da edição. O [diff bruto](AGENTS-v2.diff), a [cópia depois](AGENTS.after-v2.md) e os [hashes](AGENTS-revision-hashes.json) acompanham esta tabela explicativa. Os links internos dos snapshots brutos mantêm o contexto original da raiz; não foram reescritos na cópia histórica.

| Regra ou enfoque anterior | Classificação | Nova redação ou destino | Razão/origem | Proteção mantida |
| --- | --- | --- | --- | --- |
| Apresentação como código de aplicativo Electron/workshop | Estado e fluxo do editor | Core/CLI como produto; desktop auxiliar | U-05, U-06, U-09 | Alvo Windows e evidências históricas explícitos |
| Começar abrindo workspace/Dev/Debug/F5 | Fluxo do editor | [DESKTOP-WORKFLOW](../DESKTOP-WORKFLOW.md) e docs existentes | Não exigir GUI para testar domínio | Nenhum launcher/Task removido ou alterado |
| `setup`/prepare criam demonstração, perfil debug | Fluxo com efeitos locais | Escopo desktop; scripts devem ser inspecionados antes de uso headless | U-05, U-06 | Preservação de demonstração/perfis/relatórios |
| Reproduzir em repositório descartável | Regra permanente de dados | Mantida e ampliada com nonce, ancestralidade e ambiente por subprocesso | Protocolo v2, seção 7 | Nenhum dado pessoal como fixture |
| Git real, refs Layer e índices alternativos | Fato implementado + contrato | Identificados como implementação atual; namespace mantido | U-02, U-04 | Sem Git simulado para prova de domínio |
| HEAD tradicional e propriedade explícita | Fato implementado + direção | Separado de U-07, que continua requisito futuro | U-07, U-08 | Sem atribuição silenciosa, sem afirmar interceptação |
| Preservar validações, tokens, backups, journals | Regra permanente de preservação | Mantida; revisão futura exige evidência dos contratos | U-09 | Sem apagar locks/metadados para passar testes |
| Testes Node e Playwright/Electron | Fluxos distintos | Headless na raiz; gráfico no guia desktop | U-05, U-06 | Janela nativa visível e sandbox continuam exigidos em tarefa gráfica |
| `npm test` e smoke/UI conforme tarefa | Evidência e escopo | Rodadas identificam subconjunto, fingerprint e limites | U-10 | Não converter existência de teste em aprovação |
| Não executar push/fetch sem tarefa | Regra de autorização/dados | Remotos pessoais proibidos; bare local/loopback de fixture permitido na missão | Missão v2, seção 8 | Sem origin real, credenciais ou serviços pessoais |
| Não sobrescrever `dist/`/portátil em debug | Regra de preservação | Mantida; build de teste em saída isolada | Missão v2, seção 6 | Nenhuma distribuição alterada como efeito do harness |
| Complementos amend/tags/stash/merge/cherry-pick/revert incompletos | Limitação atual | Continua em [LIMITATIONS](../../LIMITATIONS.md) e arquitetura/contratos | U-09 | Não anunciar fluxos recusados como implementados |
| Shell não intercepta Git externo | Fato/limite da proteção | Mantido explicitamente na raiz e estudo | U-07, protocolo v2 | Wrapper não certifica chamadas que o ignoram |
| Restrição atual de não modificar Core/CLI | Escopo temporal autorizado | Expressamente condicionada à preparação v2 | Esclarecimento do usuário e decisão v2 | Tarefa futura continua exigindo autorização de comportamento |
| Escolhas técnicas do protótipo | Estado atual, revisável | Autonomia para investigar/justificar em tarefa futura | Seções 2 e 4 de decisões v2 | Não reduzir requisito humano nem apagar histórico |

Não foi criado AGENTS em `src/desktop/`: o guia documental separa os detalhes sem mudar a árvore protegida de fontes. A raiz é a fonte inequívoca das regras de trabalho. Não foram modificados arquivos Core/CLI/desktop nesta revisão.
