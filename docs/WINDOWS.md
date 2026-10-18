# Usar no Windows

Esta entrega inclui uma distribuição **portátil para Windows x64**. O editor usa Electron, Monaco e o Git instalado no computador. Não precisa de Linux, WSL, Node.js, npm, GitHub ou conta em serviço online para usar o editor pronto.

## Abrir o aplicativo

1. Instale **Git for Windows 2.43 ou superior**, pelo site oficial: https://git-scm.com/downloads/win. No instalador, mantenha a opção de disponibilizar o Git para outros programas pelo PATH. Se o Git já estiver instalado, o próprio aplicativo verifica sua presença.
2. Extraia o ZIP inteiro para uma pasta local, por exemplo `C:\Apps\GitLayersLab`. Não abra o executável diretamente dentro da janela do ZIP.
3. No workshop, abra **`artifacts/Git Layers Lab-win32-x64/git-layers-lab.exe`** com dois cliques. Mantenha o executável, `resources`, `locales`, DLLs e os demais arquivos juntos.
4. A tela inicial mostra a versão e o caminho do Git encontrado. Se aparecer um aviso de Git ausente, conclua a instalação, feche e reabra o aplicativo. **Verificar Git** atualiza o diagnóstico sem abrir um repositório.
5. Clique em **Criar demonstração** e escolha uma pasta nova ou vazia. O aplicativo cria um repositório Git real de exemplo, com base e Layers prontas para explorar. Para abrir seu próprio repositório, use **Abrir pasta**.

O pacote se destina a **Windows 10/11 x64**; o terminal ConPTY usa Windows 10 1903+ ou Windows 11. Não é um executável ARM64 nativo. Prefira uma pasta local curta e fora de pastas sincronizadas para a demonstração. Os limites de caminho do Windows e políticas do computador continuam se aplicando.

O executável é distribuído **sem assinatura digital**. O Windows pode exibir uma confirmação de editor desconhecido. Não é necessário desativar o antivírus ou executar o aplicativo como administrador.

## Primeiro uso

Na demonstração, abra `src/app.ts`, edite e salve com **Ctrl+S**. O painel Mudanças permite preparar o arquivo e fazer um commit na base. Selecione uma Layer para ver seus arquivos e histórico independentes. Selecionar uma Layer não transfere automaticamente a propriedade de arquivos novos: use a ação explícita para atribuí-los.

Em um repositório próprio, use **Inicializar Layers** quando o aplicativo solicitar. O primeiro commit da branch tradicional precisa existir. Configure nome e e-mail pelo botão **Configurar identidade local** se forem necessários para commits; a alteração é feita somente naquele repositório. O laboratório recusa configurações e tipos de repositório que ainda não suporta, com diagnóstico, sem reescrevê-los para aceitar a operação.

**Ambiente** mostra a plataforma atual, o alvo da distribuição, a versão do aplicativo e o executável Git usado. As operações gerenciadas não oferecem push e não abrem conexões remotas. O terminal integrado permite executar comandos locais explicitamente; abrir um arquivo no editor não executa scripts.

## CLI opcional

O editor funciona sem terminal. O terminal integrado usa Node.js instalado 22.12+ para manter o TTY da CLI interativa. O pacote também inclui **`git-layer.cmd`**, que usa Electron para comandos não interativos sem Node instalado. Para captura interativa externa, use Node diretamente em `resources/cli/cli/index.js`. No PowerShell:

```powershell
& 'C:\Workshops\git-layers-lab-workshop\artifacts\Git Layers Lab-win32-x64\git-layer.cmd' --help
```

Depois, consulte `docs/CLI.md`. A CLI e o editor usam o mesmo mecanismo Git real. O arquivo `git-layer` atende ao Git Bash. Não é necessário alterar o PATH para abrir o editor.

## Se algo falhar

- **Git não encontrado:** instale Git for Windows, mantenha a opção de PATH e reabra o aplicativo. A tela **Ambiente** permite verificar novamente. Uma instalação convencional em `Program Files\Git\cmd` também é procurada.
- **Não abre ou faltam arquivos:** extraia novamente o ZIP completo para uma pasta com permissão de escrita. Use `git-layers-lab.exe`, não um executável Linux ou um arquivo dentro do ZIP.
- **A última pasta não reabriu:** o erro aparece na tela; escolha **Abrir pasta** novamente. Uma pasta removida ou movida não apaga o seu repositório.
- **Arquivo alterado fora do editor:** compare ou recarregue antes de salvar. O aplicativo preserva rascunhos de recuperação e evita sobrescrever uma alteração externa silenciosamente.
- **Operação bloqueada por suporte incompleto:** consulte `docs/LIMITATIONS.md`. Amend, tags, gravação de stash, merge, cherry-pick e revert continuam indisponíveis nesta versão.

O pacote inclui **`Diagnostico.cmd`** para registrar o runtime e verificar a versão do Git, sem abrir ou alterar repositórios. O relatório fica em `%TEMP%\Git-Layers-Lab-diagnostico.json` e não é enviado automaticamente. É uma ferramenta opcional de suporte, sem necessidade de Node.js instalado; não substitui um teste completo da interface. Consulte os resultados efetivamente obtidos em `docs/TEST-REPORT.md`.

## O que foi verificado

O pacote Windows é gerado com os binários oficiais do Electron para `win32-x64`. Compilar código e gerar um `.exe` não equivalem a abrir a interface em um Windows real. **Os resultados efetivamente executados, inclusive os testes nativos Windows disponíveis ou não disponíveis, estão discriminados em `docs/TEST-REPORT.md` e no relatório desta entrega.** Não é necessário fazer nenhum teste em Linux para usar este pacote.
