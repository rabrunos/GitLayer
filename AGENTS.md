# GitLayer — instruções do laboratório mínimo

A fase experimental iniciada em 07/11/2026 substitui a arquitetura anterior. O produto é um coordenador pequeno de Git oficial, escrito em JavaScript ESM, com Node.js 22 ou posterior e sem dependências npm. Leia [arquitetura](docs/ARCHITECTURE.md), [limitações](docs/LIMITATIONS.md) e [estado](docs/STATUS.md) antes de alterar o contrato ou afirmar resultados.

## Contrato atual

- Cada Layer é uma branch real `refs/heads/layer/<nome>`, com histórico independente e índice Git próprio.
- Ativação, staging e commits de Layers preservam o HEAD e o índice convencionais.
- Caminhos podem estar em qualquer diretório. A atribuição ocorre no `add`; arquivos novos preparados já têm origem, mesmo antes do commit.
- `git add .` usa o Git convencional. Um bloco local de `info/exclude` esconde caminhos das Layers. Novos arquivos livres mantêm as regras de ignore do usuário.
- `git layer add <nome> <caminhos>` exige Layer ativa, prepara próprios e novos livres e ignora arquivos de outras origens. `.` conserva o escopo do diretório atual.
- `off` exige Layer limpa; remove seus arquivos e mantém diretórios. Não há descarte automático de pendências.
- Objetos, árvores, índices, refs e commits são nativos. Não recriar versionamento, journaling, backups transacionais, locks próprios, recuperação, modo `edit`, desktop ou compatibilidade com o armazenamento antigo.

## Trabalho e validação

Use somente repositórios descartáveis novos para executar o laboratório. As fixtures têm caminhos disjuntos entre aplicação e Layers, sem escritores concorrentes, filtros externos ou topologias complexas. Prepare essas premissas nas fixtures; não construa um sistema para provar todas elas.

Antes de editar, registre branch, SHA e alterações existentes. Preserve arquivos locais não rastreados e ignorados. Não execute o produto no checkout de desenvolvimento, na demonstração antiga ou em repositórios pessoais. Não altere Git global, PATH permanente, políticas do PowerShell ou instalação do Git.

Os comandos da fase são `npm.cmd run check`, `npm.cmd test`, `npm.cmd run benchmark`, `npm.cmd run benchmark:alternatives` e `npm.cmd run benchmark:parallel`. Não há build obrigatório. Inspecione scripts antes de executá-los. Use Git oficial como observador independente e reporte comandos, versões, resultados e limites reais.

Meça preparação, primeira extração, desativação e reativação separadamente. O tempo de uma operação inclui sua conclusão sobre todos os arquivos; a verificação externa deve conferir o conjunto inteiro. A meta de cinco segundos para 10.000 arquivos precisa de medições novas, incluindo diretórios compartilhados por diferentes origens.

A reconstrução parte de `25a4ee5d4a810d458872a9f6e3cf0c8c0feb956e` e foi iniciada em `experimental/minimal-core`. O histórico Git preserva a implementação anterior; não manter arquivos mortos por compatibilidade. O adendo da missão autoriza concluir a reconstrução, validar, commitar, integrar normalmente à main e fazer push sem força. Antes de publicar, revisar o diff, concluir testes e medições e verificar uma cópia nova do estado commitado; depois, conferir a main local, origin/main e o SHA remoto no GitHub. Não usar force, reescrever histórico ou apagar dados ignorados e não rastreados desconhecidos. As remoções da base antiga abrangem arquivos versionados autorizados e outputs, caches e dependências gerados cuja origem na implementação antiga esteja identificada. Preserve perfis, demonstrações, evidências e conteúdo ignorado ou não rastreado desconhecido; não limpar o workspace indiscriminadamente.
