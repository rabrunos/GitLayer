# Protocolo de publicação — Etapa 2B

A missão autoriza commit e push em main sem força. O commit inicial A reúne implementação, testes e relatórios. A cópia nova A só será atestada depois de existir e passar; seu recibo público entra em um commit documental B. Os 234 inputs funcionais de B devem continuar byte a byte iguais ao manifesto atual. B também exige cópia nova local antes do push e cópia nova do GitHub depois.

Cada cópia usa clone independente sem hardlinks/alternates, checkout do SHA exato, instalação pelo lockfile com scripts de ciclo desativados, typecheck, build Core/CLI, help e smoke relocado sem dependências. A instalação traz os pacotes de desenvolvimento do lockfile, sem executar Electron nem baixar seu binário. Nenhuma dessas cópias é nova execução da full/matriz ou CI remoto.

O driver externo revisado tem SHA-256 **90cc9284a9374dfd6d963d85a00980af62fd80122cf26accecbaefb10b81364f**. Ele compara blobs commitados, projeto e clone ao [manifesto funcional atual](SOURCE-MANIFEST-c5f919feb2de4cb4ef81d6011dcf1193eca5441afcdb6023f065e202e61350fc.json), deriva a contagem234, isola configs/credenciais/HOME/TEMP/npm e conserva logs/instalações próprios em saída nova. O recibo público usa allowlist, raízes simbólicas e hashes dos streams, sem IDs de processos nem logs privados.

Antes do push: revisar o diff preparado, arquivos grandes e segredos; consultar main no servidor; preservar todos os dados ignorados legítimos. A consulta anterior ao commit ainda encontrou a baseline e8f2e3feba87224246a42337f77f702914df989e. Não há reset/clean, reescrita de histórico ou envio de refs de fixtures.

Depois do push: exigir igualdade entre HEAD local, origin/main e SHA consultado no servidor, diferença0/0, upstream correto e código limpo; validar a cópia GitHub e os nove links públicos. O SHA final é informado no encerramento depois dessas verificações. Não se tenta incluir o próprio hash antecipadamente no commit.

## Inventário preservado

A revisão identificou como raízes ignoradas legítimas .workshop/, artifacts/, dist-core/, dist-debug/, dist/ e node_modules/. Elas permanecem no checkout. Perfis, demonstrações, relatórios privados e evidências temporárias não foram usados como material descartável. Nenhum journal antigo, backup, shelf, ref técnica ou dado desconhecido foi apagado nesta revisão para economizar disco.

Os novos temporários materialized/ do produto seguem a limpeza restrita descrita em [STORAGE](STORAGE.md). Fixtures de benchmark com PASS podem ser removidas pelo runner depois dos oráculos/inventário; resultados e hashes persistem. Fixtures de falha/timeout e evidências dos validadores permanecem nos diretórios isolados da rodada. Essa diferença de retenção não deve ser confundida com limpeza do repositório do usuário.

## Reproduzir a cópia nova

O [driver exato](validate-fresh-commit.mjs) e seu [helper exato](audited-lib.mjs) estão lado a lado. A execução exige todos os parâmetros e uma saída nova diretamente no TEMP canônico. Use Node/Git/npm-cli absolutos e o SHA concreto em --expected-sha:

```text
node validate-fresh-commit.mjs --execute --mode local --project <PROJECT> --expected-sha <SHA> --manifest <SOURCE-MANIFEST> --out <NEW_TEMP_ROOT> --git <GIT_EXE> --npm-cli <NPM_CLI_JS>
```

Após publicar, --mode github clona a URL pública fixa do projeto. O driver preserva resultados/instalações em saídas próprias, não executa push, não limpa dados do usuário e não roda a full. A primeira cópia é deliberadamente posterior ao commit A; os campos PASS só são atestados em seu recibo depois da execução.

## Cópia A observada

O commit de implementação **f213022bd121648fa4e9e1bb1ecf9af27c4c998b** passou na [validação em cópia nova](FRESH-COMMIT-A.json), com [recibo de privacidade](FRESH-COMMIT-A-PRIVACY.json). Instalação, typecheck, build, help e smoke82/quatro/sete concluíram; código de origem e clone estavam limpos na observação independente anterior à gravação destes recibos. O fechamento B acrescenta somente documentação e evidências; a fonte funcional234/c5f919 permanece. A cópia local de B e a cópia GitHub são conferidas após B existir, sem reivindicar antecipadamente uma execução.
