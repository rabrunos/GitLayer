# Contribuir e fechar uma implementação

Leia [AGENTS](AGENTS.md), [estado atual](docs/STATUS.md), contratos da área e a autorização da tarefa. Registre a baseline e integre alterações locais anteriores; não exija árvore limpa nem restaure o checkout para uma referência histórica.

O caminho independente do editor usa Node.js 22.12+, npm e Git oficial. A operação de renomeação exige `git rev-parse --show-ref-format`, presente na fonte oficial desde Git 2.44; sem essa feature, recusa com `RENAME_UNSUPPORTED`. O Git executado neste fechamento foi 2.53.0.windows.2, sem campanha runtime 2.44/2.43; consulte o [envelope GL-20 e as fontes oficiais](docs/reports/2026-11-02-closure/REPORT.md#gl-20-preservação-nativa-e-envelope-restante). Instale as versões do lockfile com npm ci --ignore-scripts: não executa o postinstall do Electron. Na raiz:

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd test
npm.cmd run compat:infra
npm.cmd run build:core
node scripts/smoke-core-cli.mjs --out artifacts/core-cli-smoke
```

Inspecione scripts antes de executá-los. A seleção ampla da matriz tem parâmetros e resultados no relatório do lote e no [guia headless](docs/git-compat/README.md). Testes usam fixtures próprias, HOME/configs/identidade isolados e remotos sintéticos. Não use origin real como laboratório nem altere Git/configuração global. O build Core/CLI não requer abrir Electron, Monaco ou editor.

Depois da implementação autorizada, fixe inputs, execute verificações proporcionais e amplas, atualize o relatório canônico e resultados essenciais versionados e revise segredos/resíduos no diff preparado. Preserve evidências únicas em arquivo externo novo antes de limpeza direcionada; ignorado ou untracked não significa lixo.

Prepare commits claros sem inventar autoria de mudanças anteriores. Valide uma cópia nova commitada com instalação pelo lockfile e no mínimo build/smoke/documentação. Atualize o remoto e concilie concorrência normalmente. Publique apenas a referência combinada; respeite proteções e não force. Uma tarefa de implementação autorizada termina com commit/push no destino combinado, salvo pedido de entrega local ou impedimento concreto.

Se o destino for main, confirme após a publicação: main local e remota no mesmo SHA consultado novamente no servidor; diferença zero; upstream correto; status/diffs do projeto limpos; extras legítimos declarados. Links do commit, relatório e requisitos devem permitir revisão pelo GitHub sem ZIP. Só declare CI aprovado quando o resultado remoto tiver sido observado.
