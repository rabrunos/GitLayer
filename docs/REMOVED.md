# O que foi removido

A reconstrução parte de `25a4ee5d4a810d458872a9f6e3cf0c8c0feb956e`, com 731 arquivos rastreados no inventário inicial. A revisão anterior continua no histórico Git e na main; a nova base é `experimental/minimal-core`. Não houve reescrita de histórico nem autorização para push nesta missão.

Foram retirados desta base os componentes versionados da arquitetura anterior:

- Core TypeScript de projeção, propriedade avançada, journals, backups transacionais, recuperação, fingerprints, checkpoints técnicos e publicação validada.
- CLI anterior, modos `edit`/`edit-end`, captura, shelves, proteção de branches, migração e rotas de compatibilidade.
- Desktop Electron, IPC, preload, React, Monaco, terminal integrado e assets gráficos.
- Suítes antigas de unidade, integração e interface; matriz extensa de compatibilidade e seus harnesses.
- Scripts antigos de build, debug, workshop, empacotamento, validação, arquivamento e benchmarks.
- Configurações TypeScript, Vite, VS Code e workspace ligadas ao produto anterior.
- Documentação operacional, relatórios e evidências versionadas antigos. Sua fonte preservada é o histórico, por exemplo `git show main:docs/ARCHITECTURE.md`.
- Manifesto e lockfile de dependências anteriores, substituídos por um pacote sem dependências npm.

As responsabilidades necessárias foram reimplementadas em uma base única, pequena: coordenação nativa, CLI, testes essenciais e benchmarks atuais. Não há wrappers para manter a suíte antiga ou um segundo produto funcionando em paralelo.

## O que foi preservado localmente

As pastas ignoradas `.workshop/`, `artifacts/`, `dist/`, `dist-core/`, `dist-debug/` e `node_modules/` continuam no workspace real, sem deleção. Elas não integram o runtime, o build ou os resultados novos. Perfis, demonstrações e evidências locais não foram utilizados como fixtures.

As remoções abrangeram arquivos rastreados da implementação anterior, sem limpeza recursiva de diretórios e sem apagar dados ignorados ou não rastreados. Git, configuração global, instalação do Git e PATH permanente não foram modificados.
