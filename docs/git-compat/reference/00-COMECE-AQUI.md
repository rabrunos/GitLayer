# Como entregar este pacote ao Codex

## Onde colocar

Salve **Git-Layers-Base-de-Validacao-v2.zip** na raiz do código-fonte do projeto, normalmente:

```text
C:\Dev\GitLayer\Git-Layers-Base-de-Validacao-v2.zip
```

Não coloque dentro de `.git`, não coloque na demonstração `C:\Dev\GitLayerTest` e não confunda esse ZIP com pacote do aplicativo. Não precisa extrair manualmente nem instalar o editor.

Se o projeto estiver em outra pasta, use a raiz real dele e ajuste o caminho informado ao Codex. O agente deve conferir o repositório antes de executar qualquer roteiro.

## Como iniciar

Abra a sessão local do Codex associada ao repositório e envie o texto de `INICIAR-NO-CODEX.txt`. O prompt completo está em `05-Prompt-Codex.md`; a mensagem curta manda ler e executar o arquivo completo, não o substitui por uma tarefa resumida.

O Codex extrairá o material em uma pasta nova sob `.workshop/briefs/` e incorporará a documentação definitiva no local adequado do repositório. A extração tem raiz `Git-Layers-Base-v2/`. O arquivo original deve ser preservado.

## O que ele fará nesta rodada

Documentação/instruções, testes por comandos, scripts de execução/reprodução, resultados e relatório. Ele tem autorização para reorganizar AGENTS e regras históricas sem remover proteções de dados. Não deverá abrir nem modificar o editor, alterar o produto, migrar pastas ou publicar no GitHub.

Não é necessário que o ChatGPT edite previamente o AGENTS remoto: a revisão local está expressamente autorizada no prompt. O Codex deve registrar o antes/depois e manter a separação entre tarefas futuras e o escopo atual.

## O que devolver depois

O prompt exige estes arquivos, relativos à raiz do projeto:

```text
artifacts\git-compat\RELATORIO-COMPLETO.md
artifacts\git-compat\Git-Layers-Relatorio-Validacao-v2.zip
```

No caminho padrão, o ZIP de devolução ficará em:

```text
C:\Dev\GitLayer\artifacts\git-compat\Git-Layers-Relatorio-Validacao-v2.zip
```

Envie ao ChatGPT esse ZIP de relatório/evidências gerado pelo Codex. Ele permitirá conferir o que realmente foi documentado, implementado e executado, inclusive todos os cenários adiados ou falhos.
