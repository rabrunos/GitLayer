# Terminal integrado e comandos Git Layers

Abra uma pasta Git ou inicialize uma pasta com Git pelo editor. Clique em **›_ Terminal**, no topo ou na barra de status. O shell inicia somente quando você abre o terminal: PowerShell com ConPTY no Windows, Bash com PTY no ambiente de desenvolvimento Linux. A pasta inicial é o workspace aberto.

O terminal aceita digitação, colagem, comandos interativos, teclas de navegação e **Ctrl+C**. Arraste sua borda superior para redimensionar. **×** oculta o painel e mantém a sessão; **Reiniciar shell** encerra a sessão atual e abre outra. Trocar a pasta do workspace encerra a sessão anterior e limpa seu terminal. Fechar o aplicativo também encerra o processo do terminal.

## Consultar e copiar comandos

O painel **Comandos Git Layers** inclui os **33 comandos disponíveis na CLI**, contando a ajuda. Escolha uma opção, preencha seus argumentos, confira a prévia e clique em **Copiar comando**. Depois focalize o terminal, cole com **Ctrl+V** e pressione **Enter**. Copiar não escreve na sessão nem executa a CLI. O catálogo continua disponível durante um processo interativo ou uma linha em edição.

As prévias usam `git-layer`, disponibilizado apenas no ambiente da sessão. Digitar `git layer status` ou `git-layer status` manualmente também funciona. Os argumentos recebem aspas literais para preservar espaços, acentos, apóstrofos e metacaracteres. Informe os caminhos sem aspas, um por linha; o painel os coloca depois de `--`. O formulário oferece somente argumentos aceitos por cada comando. Você pode marcar **Saída JSON** quando o comando suporta esse formato.

Confira o estado no cabeçalho antes de colar: durante captura ou confirmação, o terminal espera a resposta daquele processo. Termine a interação ou pressione Ctrl+C para voltar ao prompt. A execução automática pelo painel foi removida; não há um mecanismo de tarefas dentro do aplicativo.

No Windows, o terminal usa o **Node.js instalado (22.12+)** para a CLI interativa, pois o executável gráfico Electron não fornece os handles TTY exigidos pela captura. A busca considera caminhos absolutos do PATH e instalações em Program Files, ou `LAB_NODE_EXECUTABLE` explícito. O shell continua sendo PowerShell/ConPTY real. O editor e Core empacotados usam o runtime Electron normalmente.

| Grupo | Comandos |
| --- | --- |
| Consultar | `help`, `status`, `list`, `log`, `show`, `diff` |
| Layers | `init`, `create`, `register`, `on`, `off` |
| Alterações | `add`, `unstage`, `commit`, `restore`, `release`, `hunks`, `stage-hunk` |
| Captura | `capture`, `capture-start`, `capture-review`, `capture-confirm`, `capture-cancel` |
| Branch tradicional | `base-add`, `base-unstage`, `base-commit`, `branches`, `branch-create`, `branch-delete`, `switch` |
| Recuperação | `doctor`, `recover`, `recovery-export` |

## Interação e confirmações

`capture` continua interativo no terminal: **q** inicia a revisão e **Ctrl+C** cancela preservando os arquivos. Seleção e confirmação são feitas no terminal. Os quatro comandos separados de captura permanecem disponíveis para scripts e para o formulário.

`restore` restaura o disco a partir do índice e preserva cópia de recuperação. Por padrão a CLI pergunta no terminal e exige digitar `sim`. A caixa **Confirmar explicitamente sem perguntar (--yes)** é uma escolha sua, desmarcada inicialmente. O painel não adiciona essa confirmação automaticamente. O modo JSON não é oferecido para `restore` interativo ou `capture`.

`hunks` mostra o token e os índices de hunks. Em `stage-hunk`, informe exatamente o token retornado, o índice iniciado em **0** e um arquivo. A CLI verifica se o estado mudou antes de preparar o trecho.

## Ferramentas locais e depuração

Este é um terminal normal do seu computador. Você pode executar scripts e ferramentas instaladas com suas permissões. Nenhum script da pasta é iniciado automaticamente ao abri-la. Os comandos `git layer` passam pelo Core compartilhado com o editor; comandos Git comuns digitados manualmente seguem o comportamento do Git instalado, inclusive podendo alterar o repositório fora das validações de Git Layers. Para os fluxos de composição, prefira os comandos `git layer`.

Alterações no disco são detectadas pelo editor. Se um arquivo aberto mudou externamente, o editor apresenta comparação/recarregamento e preserva rascunhos. Salve as alterações que pretende incluir antes de executar comandos no terminal: o shell enxerga os arquivos no disco, não buffers ainda não salvos.

O teste de interface verifica a área de transferência, a recusa do antigo IPC de execução, colagem manual de `status`, digitação, captura com q/todos/sim, restauração confirmada e Ctrl+C. Consulte [TEST-REPORT.md](TEST-REPORT.md) para os resultados efetivos.
