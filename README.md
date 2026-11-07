# GitLayer

Laboratório experimental mínimo: branches Git independentes cujos arquivos podem aparecer no mesmo diretório de trabalho da aplicação. O GitLayer seleciona índices nativos, direciona staging e commits e materializa ou retira arquivos. O HEAD convencional permanece selecionado.

**Use somente em repositórios descartáveis.** Esta fase assume caminhos disjuntos e ausência de concorrência; não possui recuperação após falhas. [Limitações](docs/LIMITATIONS.md).

## Executar no Windows

Requer Git oficial disponível no PATH e Node.js 22 ou posterior. Não há dependências npm nem etapa de build.

Na raiz deste checkout, disponibilize o comando somente na sessão atual:

```powershell
$env:PATH = "${PWD}\bin;$env:PATH"
git layer --help
```

Os launchers ficam em `bin/git-layer` e `bin/git-layer.cmd`. Nenhuma configuração global ou privilégio administrativo é necessário. Execute os próximos comandos em um repositório descartável novo, com identidade Git local configurada e uma branch convencional, normalmente `main`.

```powershell
git layer create scripts       # branch layer/scripts, inicialmente inativa
git layer on scripts
New-Item -ItemType Directory src,tools,agents -Force | Out-Null
Set-Content src/novo.js 'export const novo = true;'
Set-Content tools/teste.js 'console.log("teste");'
Set-Content agents/instrucoes.md 'Instruções experimentais'
git layer add scripts .
git layer status
git layer commit scripts -m 'Adicionar ferramentas'
git layer off scripts
git layer on scripts
git layer log scripts
```

Os arquivos podem ficar em quaisquer pastas, inclusive junto de arquivos da aplicação ou de outra Layer. Nenhum caminho pode pertencer a duas origens.

## Comandos

| Comando | Resultado |
| --- | --- |
| `git layer create <nome>` | Cria branch com commit raiz vazio e índice próprio; começa inativa. |
| `git layer on <nome>` | Extrai os arquivos do índice da Layer para o diretório de trabalho. |
| `git layer off <nome>` | Retira arquivos de uma Layer limpa, preservando branch e histórico. |
| `git layer list` | Mostra Layers ativas e inativas. |
| `git layer status` | Mostra alterações preparadas e não preparadas. |
| `git layer add <nome> <caminhos...>` | Prepara próprios e novos livres na Layer ativa. |
| `git layer commit <nome> -m "mensagem"` | Commita a árvore preparada somente na referência da Layer. |
| `git layer commit` | Percorre Layers com staging em uma interação simples. |
| `git layer log <nome>` | Consulta o histórico com Git nativo. |

`--cwd <diretório>` seleciona o diretório de execução. `list` e `status` aceitam `--json`. Caminhos são relativos ao diretório de execução: dentro de `src`, `git layer add scripts .` seleciona somente `src` e descendentes. Também é possível informar um ou vários arquivos explícitos.

## A origem é escolhida pelo add

`git add .` prepara alterações e exclusões da aplicação e arquivos novos livres, respeitando ignore. Caminhos já pertencentes às Layers ficam no `info/exclude` local, sem `.gitignore` compartilhado obrigatório.

`git layer add scripts .` prepara alterações e exclusões de `scripts` e todos os arquivos novos livres elegíveis no escopo. Arquivos da aplicação ou de outras Layers são ignorados. Se três arquivos novos estiverem livres, os três entram na origem cujo add ocorrer primeiro. Staging sem commit já estabelece origem. Não existe modo de edição ou destino persistente.

O commit usa o conteúdo preparado. Editar novamente um arquivo após o add mantém essa edição no disco, enquanto o commit registra a versão preparada. Resolva pendências antes de `off`.

## Validar e medir

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run benchmark
npm.cmd run benchmark:alternatives
npm.cmd run benchmark:parallel
```

Os 14 testes da cópia nova passaram. Foram concluídas 15 amostras de benchmark: com 10.000 arquivos em diretórios compartilhados, as medianas da CLI foram 2,59 s para ativar, 1,62 s para desativar e 2,42 s para reativar. O relatório inclui conferência integral, custos iniciais e os cenários que ultrapassaram cinco segundos. Os scripts `benchmark:alternatives` e `benchmark:parallel` são comparações opcionais.

Consulte [estado e validação](docs/STATUS.md), [arquitetura](docs/ARCHITECTURE.md), [benchmarks](docs/BENCHMARKS.md) e [remoções](docs/REMOVED.md). A implementação mínima é a nova base do projeto. A implementação anterior permanece no histórico Git, sem necessidade de conservar código morto. Resultados antigos não certificam esta versão.
