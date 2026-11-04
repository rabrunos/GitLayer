# Reprodução e resolução seguras

Use apenas fixtures novas fora do checkout, com marcador/nonce e ambiente Git isolado. Os testes versionados criam essas fixtures e invocam o Git oficial por caminho absoluto. Não execute clean, reset destrutivo ou operações forçadas sobre dados reais para repetir contraprovas.

## Executar regressões

A partir de uma cópia do código, com dependências do lockfile e sem scripts de instalação do desktop:

~~~powershell
npm.cmd ci --ignore-scripts
node --import tsx --test --test-concurrency=1 --test-timeout=900000 tests/integration/security-ownership.test.ts
node --import tsx --test --test-concurrency=1 --test-timeout=900000 tests/integration/security-base-origin.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/security-atomic-stage.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/editing-boundary.test.ts tests/integration/security-editing-transition.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/security-diagnostics.test.ts tests/integration/security-protection.test.ts tests/integration/security-ignore-refresh.test.ts
~~~

A campanha original foi repetida em bundle imutável do snapshot e7f245a antes da implementação: as duas regressões D-01 falharam com os efeitos esperados; D-02 retornou sucesso e a reabertura recusou METADATA_INVALID. A reprodução D-02 sincroniza um escritor externo real com a consulta nativa. A consulta mudou na correção; a barreira posterior foi adaptada e verifica explicitamente que o escritor executou, sem inventar uma reprodução sem intercalação.

## Resolver uma renomeação externa

Depois de revisar os arquivos físicos e a origem correta, obtenha o token atual. Exemplo instrutivo; $repo é escolhido pelo usuário:

~~~powershell
node dist-core/cli/index.js --cwd $repo ownership-review --json
node dist-core/cli/index.js --cwd $repo ownership-resolve rename --token TOKEN -- antigo.txt novo.txt
node dist-core/cli/index.js --cwd $repo status --json
~~~

A resolução preserva bytes, índices e histórico. O staging da exclusão antiga e da inclusão nova continua deliberado na origem original. Se o candidato automático já estiver preparado, retire apenas seu staging com unstage e refaça a revisão. Histórico commitado e reservas explícitas de outra origem não são transferidos por esse comando.

Se remoção e criação foram independentes, use ownership-resolve deleted para reconhecer a ausência e independent para declarar a criação. Sem target, independent mantém o fluxo da base; com target, declara a criação para esse destino. Não use essas decisões para silenciar uma dúvida de origem.

Se um newcomer legítimo, sem ambiguidade, foi preparado externamente na base durante edição, retirar staging deve conservar sua origem base; aceite explícito e histórico commitado também não autorizam transferência automática. Quando uma origem conhecida está ausente e o caminho novo é candidato, staging nativo isolado não resolve a relação: examine bytes, índices e histórico, retire a preparação quando permitido e faça uma revisão atual antes de decidir rename, deleted, independent ou base. Aceitar a base é uma decisão explícita; não prepara nem desfaz commit.

## Aceite base e reset misto: variante D-01

A regressão acima cria fixtures novas com nonce e valida a ancestralidade antes do reset. Seu fluxo prepara e commita um rename da base durante edição de b, reconcilia as exclusões com status normal, executa reset --mixed para o HEAD original dentro da fixture e reabre o Core. A origem deve continuar base; preparar o arquivo em b deve ser recusado, sem retirar B preparado ou bytes posteriores do disco. Os outros casos abrangem origem ausente com resolução explícita, troca/fim de edição/restart, desativação/remoção, aposentadoria de marcadores e troca compatível sem reserva fantasma. O caso de origem ausente também injeta deliberadamente uma reserva conflitante nos metadados da fixture e exige diagnóstico inseguro tanto no Core quanto no resgate independente, sem efeitos nas consultas. Essa injeção não é uma transferência executada pelo produto. Os seis casos passaram na FULL14 e no foco09 do mesmo snapshot final, com recibos separados em RESULTS.md/VALIDATION.json, sem somar contagens.

Para avaliar o antes, compare [BASE-ORIGIN-HISTORY](BASE-ORIGIN-HISTORY.json): a tentativa01 não reproduziu a mistura porque EDITING_IGNORE_UNSAFE bloqueou o add. A tentativa02 incluiu a consulta normal anterior ao reset, removeu essa proteção incidental e comprovou o commit indevido no mesmo bundle imutável. Não conclua que toda execução de reset misto reproduz o defeito nem trate o comando nativo como autorização para transferir origem. Execute a receita somente pela fixture dos testes; o histórico errado de versões anteriores exige revisão deliberada, não migração automática.

## Git direto e dados destruídos

Confira git status, os diffs por origem e o preview gerenciado antes de trocar/desativar. Para limpar, a prévia nativa git clean -ndx ou git clean -nX mostra a seleção naquele instante; outra criação posterior pode mudar o resultado. A prévia não é autorização futura nem cópia de recuperação.

Troca gerenciada usa --no-overwrite-ignore; chamadas Git diretas devem escolher essa opção quando aplicável. Protect reserva a seleção nominal de branches Layer, não impede sobrescrita por outra branch tradicional. clean -fdx/-fX, reset --hard para revisão conflitante e mv -f continuam podendo destruir edições apenas no disco. Registre trabalho desejado na origem correta antes dessas operações.

Commits conservam sua árvore enquanto objetos forem alcançáveis; índices/checkpoints conservam o conteúdo preparado. Edição C posterior ao stage B não é B. Um backup técnico só ajuda se seus bytes realmente estiverem nele. Não existe promessa de restaurar C destruído antes de qualquer cópia. Preserve o repositório, execute doctor e recovery-export para pasta nova antes de decidir reparos de refs, reservas ou índices.

## MAIN NEW legítimo e candidato ambíguo: variante D-01

A [prova histórica c7](AMBIGUOUS-UNSTAGE-BEFORE.json) é uma continuação controlada em fixture própria; [AMBIGUOUS-UNSTAGE-REFS](AMBIGUOUS-UNSTAGE-REFS.json) verifica seus efeitos sem nova operação Core. Ela não aprova a correção posterior. Preserve A commitado, B privado, C preparado nativamente e D posterior no disco ao comparar uma reprodução. Não repita a sequência em dados reais.

O contrato distingue duas situações: NEW legitimamente indexado sem ambiguidade conserva a origem base depois de base-unstage; um caminho presente candidato ao rename de origem conhecida continua sem origem decidida após retirar preparação. Neste último caso, obtenha nova revisão e declare a relação correta. Exemplo instrutivo, somente depois de conferir os caminhos e a origem:

~~~powershell
node dist-core/cli/index.js --cwd $repo base-unstage -- moved.txt
node dist-core/cli/index.js --cwd $repo ownership-review --json
node dist-core/cli/index.js --cwd $repo ownership-resolve rename --token TOKEN -- a.txt moved.txt
~~~

Não acrescente release apenas para fazer esse fluxo passar: um unstage de candidato incerto não deve criar reserva base artificial. Se houver autoridade base explícita anterior, histórico ou reserva legítima, respeite suas pré-condições e não use rename para transferi-los silenciosamente. Se o próprio caminho selecionado no MAIN já estiver ausente, resolva a ausência por revisão explícita antes da retirada que eliminaria sua última âncora. Recusa preservando dados é aceitável nessa fronteira; as regressões posteriores foram executadas na campanha14 do snapshot final, conforme [RESULTS](RESULTS.md) e [VALIDATION](VALIDATION.json), dentro do envelope declarado.

## Adendo às reproduções históricas 49BA

As versões sanitizadas ESM V2 de [EIO sintético](reproductions/ack-rollback49ba-eio.test.ts) e [recusa comum sem EIO](reproductions/ack-rollback49ba-noeio.test.ts) foram executadas e tiveram seus efeitos inseguros históricos confirmados por observadores independentes. Consulte o [compacto dos resultados](d01-evidence/RECIPES49BA-RUNTIME.json) e o [README das receitas](reproductions/README.md). São duas execuções históricas suplementares, separadas dos focos ACE17 e de FULL14, não dois novos PASS do produto nem uma quinta família de defeitos.

A preparação precisa preservar o package ESM adjacente aos testes, fonte 49BA independente exatamente reconstruída pela [cadeia ACE17 →6994 →49BA](acknowledgement-reconstruction/CHAIN-PLAN.md), loader/dependências identificados e pai de fixture novo/vazio curto para cada caso. A configuração efetivamente exercitada registrou estimativa 196 para o caminho do lock técnico; não generalizar esse tamanho para todo Windows/Git/filesystem. Não usar o checkout real como fonte/fixture de execução nem alterar o package histórico para tornar o harness ESM.

O histórico das tentativas deve acompanhar o resultado: V1 bloqueou antes do produto por CJS/top-level await; V2 de caminho longo falhou durante setup do Core, antes dos hooks; V2 curta reproduziu EIO e semEIO. O segundo caso não foi executado nas duas primeiras tentativas. Nenhum FAIL anterior é apagado ou convertido em SKIP. A classificação esperada e os commits/blobs/refs/índices/bytes confirmam a reprodução; exit0 sozinho não confirma o defeito.

A projeção conserva os hashes dos recibos, scripts e observações e esclarece 12 comandos serializados versus 13 observados em memória, com a última árvore registrada separadamente. Raw logs/caminhos/identidades permanecem privados. A receita de materialização 6994 e o overlay V02 não ganham execução por consequência desse resultado; seus limites anteriores continuam explícitos.


## Recuperação recusada e experimentos finais

`RECOVERY_CONFLICT` com reason `workspace-materialization-disappeared` mantém o journal pendente. Preserve arquivos, índices, refs e backups; use doctor/recovery-export para uma pasta externa nova. Não apague journal/locks nem use ownership-resolve para contornar a barreira. A [segurança](../../SAFETY.md#transações-e-recuperação) descreve o predicado geral e a possibilidade de efeitos parciais nos metadados numa recusa tardia.

[SUPPLEMENTAL14.json](SUPPLEMENTAL14.json) registra o smoke compilado de propriedade (13 verificações), duas variantes de rename conhecido sem proprietário e a continuação de descarte na mesma fixture. O primeiro observador adicional falhou numa igualdade bruta de índice; a perícia oficial identificou só mudanças de cache, e a continuação posterior confirmou C preservado na base. O segundo observador dedicado não foi executado. Esses procedimentos não acrescentam casos à FULL14.
