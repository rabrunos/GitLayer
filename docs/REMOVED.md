# O que foi removido

A reconstrução parte de `25a4ee5d4a810d458872a9f6e3cf0c8c0feb956e`, com 731 arquivos rastreados no inventário inicial. A revisão anterior continua no histórico Git. A reconstrução foi iniciada em `experimental/minimal-core`; o adendo da missão autoriza integrá-la normalmente à main e publicar sem força após a validação final. O histórico não é reescrito e dispensa preservar arquivos mortos na nova base.

Foram retirados desta base os componentes versionados da arquitetura anterior:

- Core TypeScript de projeção, propriedade avançada, journals, backups transacionais, recuperação, fingerprints, checkpoints técnicos e publicação validada.
- CLI anterior, modos `edit`/`edit-end`, captura, shelves, proteção de branches, migração e rotas de compatibilidade.
- Desktop Electron, IPC, preload, React, Monaco, terminal integrado e assets gráficos.
- Suítes antigas de unidade, integração e interface; matriz extensa de compatibilidade e seus harnesses.
- Scripts antigos de build, debug, workshop, empacotamento, validação, arquivamento e benchmarks.
- Configurações TypeScript, Vite, VS Code e workspace ligadas ao produto anterior.
- Documentação operacional, relatórios e evidências versionadas antigos. Sua fonte preservada é o histórico, por exemplo `git show 25a4ee5d4a810d458872a9f6e3cf0c8c0feb956e:docs/ARCHITECTURE.md`.
- Manifesto e lockfile de dependências anteriores, substituídos por um pacote sem dependências npm.

As responsabilidades necessárias foram reimplementadas em uma base única, pequena: coordenação nativa, CLI, testes essenciais e benchmarks atuais. Não há wrappers para manter a suíte antiga ou um segundo produto funcionando em paralelo.

## Limpeza local e dados preservados

Após o adendo, os outputs antigos identificados `dist/`, `dist-core/` e `dist-debug/` foram removidos. O cache `.workshop/cache/debug.tsbuildinfo`, ligado às fontes TypeScript antigas, também foi retirado. `npm.cmd ci --ignore-scripts --offline --no-audit --no-fund` removeu as dependências antigas usando o manifesto novo sem dependências. Não foi criado arquivo morto.

Perfis, demonstrações e conteúdo local de origem desconhecida em `.workshop/` e `artifacts/` foram preservados. Esses dados não fazem parte do produto, não foram usados como fixtures e não serão publicados. A limpeza atingiu a implementação versionada e seus outputs identificados, sem limpeza indiscriminada do workspace. A configuração global, a instalação do Git e o PATH permanente não foram modificados.
