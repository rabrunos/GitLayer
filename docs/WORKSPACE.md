# Abrir uma pasta e trabalhar nela

**Escopo deste guia:** o fluxo visual abaixo descreve o laboratório manual existente. O produto Core/CLI de 02/11/2026 tem [build e uso independentes](CLI.md), destino explícito edit sem captura obrigatória e abertura deliberada open-branch; consulte os [contratos atuais](IMPLEMENTATION-2026-11-02.md). O laboratório não foi aberto nem revalidado nesta rodada. Fontes e demonstração existentes permanecem preservadas.

Há duas pastas de trabalho: a pasta deste **workshop**, aberta no VS Code para o Codex desenvolver e depurar o Git Layers Lab; e a pasta de um **projeto de teste**, aberta dentro do Git Layers Lab para editar arquivos e exercitar o Git. Mantenha o projeto de teste fora da árvore do workshop quando quiser um histórico independente.

## No VS Code e no Codex

Extraia o ZIP completo. Abra a pasta do workshop em **Arquivo → Abrir Pasta** no VS Code, ou abra o arquivo `.code-workspace` incluído. O código-fonte, os testes, os scripts e as instruções para o Codex ficam juntos. Use o fluxo de desenvolvimento do workshop para instalar dependências e iniciar o editor com depuração.

O Codex pode editar o código, criar scripts, executar a CLI e os testes pelo terminal local. As fixtures da suíte criam seus próprios repositórios temporários; elas não precisam apontar para seu projeto. Para reproduzir um problema da interface, crie um projeto descartável e abra esse projeto no aplicativo.

## Dentro do Git Layers Lab

O editor já abre uma pasta como workspace. Ele usa o Git instalado, o explorador de arquivos e o Monaco para editar o código dessa pasta. Não é necessário importar cada arquivo separadamente.

| Situação da pasta | Ação no aplicativo |
| --- | --- |
| Já tem um repositório Git local | **Abrir pasta** e selecionar a pasta. |
| Já tem Git, mas ainda não tem metadados Git Layers | Abrir e usar **Inicializar Layers neste repositório** para habilitar edição e operações gerenciadas. Antes disso, o repositório fica disponível para inspeção. |
| Ainda não tem Git | Na tela inicial, usar **Inicializar pasta com Git** ou **Inicializar Git**, e escolher uma pasta nova ou existente. Isso cria o repositório real e os metadados locais. |
| Quer conhecer o fluxo sem preparar arquivos | **Criar demonstração**, escolhendo uma pasta nova ou vazia. |

Se selecionar uma subpasta de um repositório existente, o Git descobre a raiz desse repositório. A barra superior mostra a raiz que o aplicativo realmente abriu. Confirme essa pasta antes de editar ou inicializar Layers.

Depois de abrir, selecione os arquivos no **Explorador**. Os botões **Novo arquivo** e **Nova pasta** criam caminhos relativos à raiz. O editor permite salvar (`Ctrl+S`), renomear, excluir com cópia de recuperação e acompanhar mudanças, staging e histórico. Caminhos como `src/game.ts` ou `src\game.ts` são aceitos no Windows. O destaque de sintaxe depende da extensão do arquivo.

Para um repositório recém-criado, use **Configurar identidade local** no painel de versão, crie um arquivo, prepare-o na **Base** e faça o primeiro commit. A identidade fica somente nesse repositório. As Layers exigem esse primeiro commit; depois, crie uma Layer e ative-a explicitamente. Selecionar o nome de uma Layer inspeciona seu histórico: a atribuição de arquivos acontece no fluxo explícito de staging/captura, não por selecionar seu nome.

A bolinha à direita da Layer ativa/desativa seus arquivos no workspace físico. Ao desativar, as pastas ancestrais que ficarem vazias e não forem necessárias à Base ou a outra Layer ativa também são removidas. Pastas com conteúdo local são preservadas; a ativação recria as pastas necessárias aos arquivos. O tooltip da badge de propriedade usa a referência `layer/nome`, no explorador e nas abas.

Ao trocar de pasta com buffers não salvos, o aplicativo pede que sejam salvos e preserva rascunhos. Arquivos alterados por outro programa são sinalizados para comparação/recarregamento; uma gravação obsoleta não substitui silenciosamente esses bytes. A última pasta aberta é lembrada para a próxima inicialização.

## Abrir uma pasta diretamente pelo terminal

No pacote portátil, em PowerShell:

```powershell
& 'C:\Apps\GitLayersLab\git-layers-lab.exe' '--repo=C:\Projetos\Meu jogo'
```

`--repo=` abre um repositório existente. Não inicializa automaticamente uma pasta sem Git. Nesse caso, use a ação de inicialização da interface ou o comando `init` da CLI.

Na CLI do código-fonte, a partir da raiz do workshop, depois de compilar:

```powershell
node dist/cli/index.js --cwd 'C:\Projetos\Meu jogo' status --json
# Para criar Git + metadados locais numa pasta de teste escolhida:
node dist/cli/index.js --cwd 'C:\Projetos\Teste Layers' init --json
```

Consulte [CLI.md](CLI.md) para o fluxo completo e os códigos de saída. A CLI e a interface compartilham o mesmo Core e os mesmos arquivos Git locais.

## Limites atuais

O editor abre um repositório por janela; não carrega um workspace multirraiz do VS Code. O arquivo `.code-workspace` organiza o desenvolvimento no VS Code, e não é um formato de projeto próprio do Git Layers Lab.

Arquivos de texto UTF-8 até 4 MiB são editáveis; binários, arquivos grandes e encodings incompatíveis ficam em somente leitura. O aplicativo incorpora um terminal real, mas não um compilador ou depurador de jogos nem execução automática de scripts do projeto aberto. As ferramentas podem ser executadas deliberadamente no terminal do aplicativo ou do VS Code. A demonstração não executa o conteúdo que cria.

Links simbólicos/junctions, caminhos fora do repositório e acesso direto aos arquivos internos de `.git` são recusados pelas operações do editor. Confira outras restrições em [LIMITATIONS.md](LIMITATIONS.md).

Os testes de integração existentes comprovam inicialização, leitura/gravação e commit usando Git real no ambiente em que foram executados. Eles não substituem a validação da janela, dos diálogos nativos nem da execução em Windows. Consulte o relatório atual para as verificações nativas Windows e os limites restantes.
