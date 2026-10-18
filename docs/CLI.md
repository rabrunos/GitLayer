# CLI local `git-layer`

A CLI e o desktop importam o mesmo `GitLayers` do Core. As referências, índices, commits e arquivos usados pelos comandos abaixo são do Git instalado no sistema. A CLI não transforma comandos externos como `git add .` em operações conjuntas.

## Pacote Windows portátil

O pacote pronto inclui `git-layer.cmd` com o Node embutido do Electron; não precisa instalar Node/npm. No PowerShell, a partir do seu repositório:

```powershell
& 'C:\Apps\GitLayersLab\Git Layers Lab\git-layer.cmd' status --json
& 'C:\Apps\GitLayersLab\Git Layers Lab\git-layer.cmd' --help
```

Para usar `git layer`, acrescente a pasta extraída ao PATH somente no terminal atual. Use `git layer -h` ou `git layer help`. O launcher `git-layer` atende ao Git Bash. A CLI preserva o diretório atual e usa o Git instalado. Caminhos de usuário com barras invertidas são aceitos no Windows e validados internamente.

## Instalar e invocar a partir das fontes

Na pasta extraída do projeto:

```sh
npm ci
npm run build
npm run cli -- --help
npm run cli:enable
```

`cli:enable` cria os launchers locais em `.local-bin` e mostra o comando para adicionar essa pasta ao `PATH` **somente do terminal atual**. Nenhum Git é substituído e nenhuma instalação global é feita.

Linux/macOS, a partir da raiz do projeto:

```sh
export PATH="$PWD/.local-bin:$PATH"
git layer -h
```

No PowerShell, a partir da raiz do projeto:

```powershell
$env:Path = "$PWD\.local-bin;" + $env:Path
git layer -h
```

A execução direta compilada também está disponível:

```sh
node dist/cli/index.js --cwd "/caminho/do/repositório" status --json
```

Para ajuda use `git layer -h`, `git layer help` ou `git-layer --help`. O próprio Git intercepta `git layer --help` para abrir a página de manual `git-layer`; esse caminho depende do visualizador de manuais do sistema e não chama a ajuda do executável externo. Este projeto não substitui o Git nem altera aliases/configurações globais para interceptar esse comportamento.

Durante o desenvolvimento, sem depender da compilação:

```sh
node --import tsx src/cli/index.ts --cwd "/caminho/do/repositório" status
```

Node e Git são pré-requisitos da CLI do código-fonte. As invocações e plataformas efetivamente verificadas constam em `TEST-REPORT.md`; a existência de um launcher para Windows/macOS não comprova teste nesses sistemas.

## Fluxo das Layers

```sh
git layer init
git layer create ai
git layer on ai
# Crie os arquivos usando seu editor ou gerenciador de arquivos.
git layer add ai -- AGENTS.md ".codex/config.toml"
git layer diff ai --staged
git layer commit ai -m "Instruções locais"
git layer status
git layer log ai
git layer off ai --park
git layer on ai
```

`init` também inicializa Git quando necessário. Em um repositório sem commits, faça primeiro o commit da branch tradicional; Layers só ficam disponíveis depois dele. O nome de Layer `base` é reservado ao destino tradicional nas APIs; escolha outro nome. Uma Layer nova recebe um commit raiz interno de árvore vazia e começa inativa. A ativação é explícita.

`register <nome>` valida uma branch local `layer/<nome>` que já exista e a registra explicitamente. `list` lista Layers registradas; candidatas ainda não registradas não são ativadas implicitamente. `on` reavalia colisões antes de publicar os arquivos. `off` exige uma Layer limpa, ou `--park` para preservar separadamente índice, reservas e disco em shelf. `--park` não cria commit nem usa o stash da base.

Todos os caminhos de arquivo/diretório devem vir **depois de `--`**. Use aspas do terminal para espaços e acentos. O parser passa strings separadas ao Core; não constrói comandos shell. Diretórios são expandidos pelo Core, e um lote que misture proprietários é recusado em conjunto.

```sh
git layer add scripts -- "scripts/novo arquivo á.py"
git layer unstage scripts -- "scripts/novo arquivo á.py"
git layer release scripts -- "scripts/novo arquivo á.py"
```

`unstage` preserva o disco e a reserva de um arquivo novo. `release` somente libera uma reserva nunca commitada e que já não esteja preparada; mantém o arquivo físico. Não transfere arquivos da base ou de outra Layer.

## Diff, staging parcial e restauração

```sh
git layer diff scripts
git layer diff scripts --staged -- scripts/debug.py
git layer hunks scripts -- scripts/debug.py
git layer stage-hunk scripts --hunk 0 --token "TOKEN_DA_REVISÃO" -- scripts/debug.py
git layer show "layer/scripts"
```

Os índices de hunk começam em **0**. O token é emitido por `hunks` e vincula a seleção ao arquivo e índice exatos. Se qualquer um mudar, atualize a revisão: a tentativa obsoleta falha e não vira stage do arquivo inteiro. Binários e mudanças não suportadas exigem stage do arquivo completo. Para a branch tradicional use o proprietário literal `base` em `diff`, `hunks`, `stage-hunk` e `restore`.

```sh
git layer restore scripts -- scripts/debug.py
# Em execução não interativa, a confirmação deve ser explícita:
git layer restore scripts --yes -- scripts/debug.py
```

`restore` restaura **o disco a partir do índice**, preserva o staging e cria cópia de recuperação antes de descartar bytes locais. No terminal interativo pede `sim`; sem terminal ou com saída JSON exige `--yes`. Não existe `--force` para contornar integridade.

## Captura temporária

```sh
git layer capture scripts --path scripts
```

O comando registra todos os caminhos que já existiam no escopo e permanece observando sem bloquear o workspace. Crie arquivos em outro terminal, editor ou gerenciador. Pressione **q** para abrir a revisão. Digite os números dos candidatos separados por vírgula; `todos` seleciona apenas candidatos não ignorados. Arquivos ignorados são identificados e precisam ser selecionados pelo número. A atribuição e o staging só acontecem depois de digitar `sim` na confirmação. Ctrl+C cancela a sessão preservando os arquivos físicos.

Para automação ou para continuar uma sessão compartilhada com o desktop:

```sh
git layer capture-start scripts --path scripts
# Crie arquivos; nenhuma atribuição automática é feita.
git layer capture-review --json
git layer capture-confirm -- "scripts/arquivo selecionado.py"
# Alternativa: cancelar sem apagar nada.
git layer capture-cancel
```

Há uma sessão por workspace. Uma interrupção inesperada deixa a sessão diagnosticável. `capture-review` consulta os candidatos atuais; `capture-confirm` só aceita os caminhos atualmente elegíveis. Capturar não faz commit nem cria destino permanente para futuros arquivos. Remover e recriar um caminho que existia antes não o torna um candidato novo.

## Branch tradicional e diagnóstico

```sh
git layer base-add -- README.md
git layer base-unstage -- README.md
git layer base-commit -m "Mudança na base"
git layer branches
git layer branch-create trabalho
git layer switch trabalho
git layer branch-delete branch-integrada
git layer doctor --json
git layer doctor --fsck --json
git layer recover
git layer recovery-export "/pasta/nova/para-cópias"
```

O staging da base recusa caminhos de Layers. A troca gerenciada exige base tracked limpa e valida a composição de destino. A exclusão de branch não força histórico não integrado e não remove a branch atual. `doctor` mostra evidência real, e `--fsck` pede inspeção adicional dos objetos. A recuperação conserva backups quando não pode comprovar um rollback seguro; a exportação exige um destino novo.

Os complementos locais eventualmente disponíveis no desktop não ganham um subcomando genérico para executar argumentos Git arbitrários na CLI. Merge de Layers, transferência de proprietário, commit conjunto e rede não são oferecidos.

## Saída e códigos

`--cwd <pasta>` escolhe o workspace sem precisar mudar o diretório do terminal. `--json` está disponível nos comandos não interativos: sucesso escreve `{ "ok": true, "result": ... }` em stdout; erro escreve `{ "ok": false, "error": { "code", "message", "details"? } }` em stderr. Diffs e ajuda sem JSON são texto; demais resultados são JSON legível. A captura interativa deve ser usada sem `--json`.

| Código | Significado |
|---|---|
| 0 | Operação concluída ou cancelada explicitamente na confirmação |
| 2 | Uso inválido, opção/argumento ausente ou confirmação não interativa ausente |
| 3 | Composição, propriedade ou estado recusado |
| 4 | Falha Git/processo/IO ou erro inesperado |
| 5 | Recuperação/journal pendente |
| 130 | Captura cancelada com Ctrl+C |

Os códigos de domínio dentro de `error.code` detalham a causa. A CLI não promete proteger contra `git add -f`, `git clean -fdx`, `reset --hard` ou checkout externos; consulte `SAFETY.md`.
