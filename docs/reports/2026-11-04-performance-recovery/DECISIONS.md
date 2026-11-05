# Decisões técnicas — Etapa 2

## Materialização e alternativas

O experimento reproduzível está em [benchmark-materialization.mjs](../../../scripts/benchmark-materialization.mjs). Usa arquivo de 100 MiB gerado em streaming a partir de um bloco aleatório de 1 MiB repetido, três amostras por método, rotação da ordem, fixtures próprias externas e orçamento de pico 1 GiB/tempo 300 s. A geração do arquivo e do objeto Git antecede o relógio; não se esvazia o cache do sistema operacional. Não há p95 para três amostras.

A comparação mede operação e flush do arquivo de destino. Para `copyFile` e `checkout-index`, o flush é acrescentado e mostrado separadamente; `copyRegular` já valida origem, calcula hash e faz flush dentro da operação. Checksums independentes e edições nos dois sentidos ficam fora do tempo. O experimento não equivale a ativação Core: faltam propriedade, backups, journal, CAS e publicação da composição.

| Alternativa | Avaliação e decisão |
| --- | --- |
| Objetos/índice Git com `checkout-index` | Protótipo usa índice real e escreve para prefixo externo. Mantém o índice original, verifica o hash e a independência do destino. Plumbing eficiente pode reduzir o custo de extração, mas não substitui as verificações e a publicação segura do Core; nenhuma troca de arquitetura foi aplicada a partir do microbenchmark. |
| Gravação/cópia por streaming | A implementação adotada limita o buffer por leitura, conserva hash do conteúdo, identidade/modo e revalidação e evita carregar o arquivo inteiro na RAM. O custo adicional dessas verificações aparece na linha do helper; a decisão de desempenho deve usar também as medições Core e os testes de integridade. |
| Reflink obrigatório (`COPYFILE_FICLONE_FORCE`) | Testado diretamente, sem fallback silencioso. Erro do ambiente é resultado do experimento, não sucesso nem demonstração de impossibilidade em outros volumes/APIs. Nenhum reflink foi adotado como mecanismo do produto. |
| Tentativa com fallback (`COPYFILE_FICLONE`) | Sucesso e independência demonstram uma cópia utilizável; não provam compartilhamento de extents nem CoW físico. Sem inspeção de extents ou API nativa específica, não atribuir ganhos a reflink. |
| Cache transitório | Adotado somente para árvores identificadas por OID imutável dentro da mesma mutação coordenada: até 64 árvores/100.000 entradas, com cópias dos resultados e descarte ao sair. Refs e índices vivos nunca entram nesse cache; a próxima transação observa o Git novamente. Não existe cache permanente duplicando bytes de trabalho. |
| Paralelismo controlado | Não adotado no caminho físico por este experimento. Poderia sobrepor extração de blobs/leituras, mas publicação concorrente, memória, I/O e revalidação exigem medição e oráculos próprios. Não paralelizar a publicação para devolver sucesso antecipado. |
| Hardlink | Contraprova isolada cria dois nomes para o mesmo arquivo e grava pelo segundo; a alteração chega ao primeiro. Portanto não é cópia independente e não foi adotado. |
| Symlink/junction | Não adotados nem usados na materialização. Acrescentam travessia/identidade e incompatibilidades já recusadas no envelope conservador. Nenhuma promessa de compatibilidade foi inferida. |

O comando oficial `checkout-index` copia conteúdo do índice, tem prefixo de destino e não sobrescreve arquivos por padrão; `--force` tem significado separado. O protótipo não usa força no destino. [Manual oficial do Git](https://git-scm.com/docs/git-checkout-index).

No Node v24.14.1, `COPYFILE_FICLONE` permite fallback e `COPYFILE_FICLONE_FORCE` pede falha quando a operação não está disponível. A API `copyFile` não promete atomicidade; os temporários, validações e publicação durável do Core continuam necessários. [Documentação versionada do Node](https://github.com/nodejs/node/blob/v24.14.1/doc/api/fs.md#fspromisescopyfilesrc-dest-mode).

O Windows documenta block cloning em ReFS, mantendo isolamento por allocate-on-write e exigindo suporte real do filesystem/alinhamento/contexto. Isso não certifica NTFS nem todos os builds do Windows 10/11, e não demonstra que a API Node efetiva chama a operação nativa apropriada. Sem volume ReFS nesta campanha, a alternativa nativa permanece não executada. [Microsoft: Block Cloning](https://learn.microsoft.com/en-us/windows/win32/fileio/block-cloning).

No Linux, a interface FICLONE depende de suporte do filesystem e de origem/destino no mesmo filesystem. Esta é avaliação documental, sem execução Linux nem declaração de suporte do produto nessa plataforma. [Linux man-pages 6.8, hospedado pelo kernel.org](https://cdn.kernel.org/pub/linux/docs/man-pages/book/man-pages-6.8.pdf).

Hardlinks compartilham um arquivo entre nomes; escritas são visíveis por esses nomes. O comportamento documentado foi demonstrado somente em fixture própria, sem introduzir links em repositórios reais ou no produto. [Microsoft: Hard links and junctions](https://learn.microsoft.com/en-us/windows/win32/fileio/hard-links-and-junctions).

## Publicação física da ativação

O caminho `on` usa o índice Git atual para extrair os arquivos com `checkout-index` para a área privada da transação. A preparação registra, para cada fonte privada, o caminho, o modo e o hash do conteúdo observado. Esse `sourceHash` pertence ao retrato preparado; não é substituído por um novo hash durante a publicação.

A cópia em streaming escreve em um arquivo temporário exclusivo, valida a identidade da fonte, calcula o hash dos bytes copiados, aplica o modo e sincroniza o arquivo. Antes do rename para o destino físico, `writeCopy` exige que esse hash ainda corresponda ao `sourceHash` preparado e que o destino corresponda ao fingerprint esperado. Uma fonte privada alterada entre preparação/publicação recebe `EXTERNAL_EDIT`; não passa a ser conteúdo aprovado apenas porque a cópia atual foi bem-sucedida. O journal, as cópias e a revogação durável da autoridade de ausência continuam sendo parte dessa fronteira.

O rename de um arquivo não torna atômica a composição de todos os arquivos. Uma recusa pode deixar temporários e journal pendente para inspeção; não se afirma ausência global de efeitos. O teste de [fonte privada modificada](../../../tests/integration/performance-streaming.test.ts#L136) verifica que os bytes alterados não alcançam o caminho pretendido, conserva refs/índices e permite exportar a evidência; o caso passou como ID 159 na full V9 concluída, dentro dos 411 PASS, sem somar o foco histórico.

Fontes: [materialize/publish](../../../src/core/index.ts#L312) e [writeCopy](../../../src/core/index.ts#L116). O cache de árvores descrito na tabela acima guarda somente entradas de árvores por OID imutável, limitado à mesma mutação coordenada. Não conserva respostas de refs, índices, configuração, propriedade ou disco entre operações.

## Resultados de materialização de 100 MiB

A rodada r4 ocorreu numa janela coordenada sem outros testes/benchmarks da equipe, com Node v24.14.1/libuv 1.51.0, Windows x64 e NTFS com clusters de 4 KiB. Não controlou atividade do sistema operacional nem esvaziou cache físico. São três amostras, sem p95.

| Método | Mediana operação + flush | Mínimo–máximo | Resultado observado |
| --- | ---: | ---: | --- |
| `copyFile` comum | 151,0 ms | 136,4–309,8 ms | Três cópias independentes |
| `COPYFILE_FICLONE` com fallback | 143,3 ms | 130,3–183,7 ms | Três cópias independentes; CoW físico não demonstrado |
| `COPYFILE_FICLONE_FORCE` | Não se aplica | 0,14–0,36 ms até erro | Três recusas reais `ENOSYS`; zero cópia concluída |
| `copyRegular` seguro em streaming | 608,2 ms | 418,0–972,7 ms | Três cópias independentes, com validação/hash/flush internos |
| `git checkout-index` + flush | 390,9 ms | 322,1–1.242,3 ms | Três extrações independentes; índice semântico preservado |

O pequeno diferencial entre cópia comum/fallback não demonstra vantagem de reflink: as amplitudes se sobrepõem e o FORCE foi indisponível nesta API/ambiente. A cópia nativa e a extração Git omitem verificações presentes no helper; os números não autorizam substituí-lo diretamente. O custo da transação Core continua sendo medido pelo benchmark principal.

A fixture teve pico lógico medido abaixo de 301 MiB e orçamento de 1 GiB. Essa medida soma tamanhos de arquivos e não extents físicos. Os contadores de I/O do sistema também não são bytes; leituras de checksum e gravações lógicas conhecidas estão contabilizadas separadamente no JSON. O orçamento é de pico de disco, não um limite de I/O acumulado.

A rodada r3 sob validações concorrentes permaneceu documentada: o helper variou de 1,08 a 11,35 s e sua ordenação de latência é inconclusiva devido à carga. Não se selecionaram amostras dessa rodada para compor a mediana r4. A contraprova de hardlink confirmou compartilhamento indesejado de alterações; nenhum link foi adotado.

## Recuperação

A mudança é de diagnóstico e cobertura: reutilizar o validador estrito por journal, mantendo a recusa operacional global. Um journal inválido não deve ocultar os demais diagnósticos; um plano válido não deve ser apresentado como recuperação concluída. Veja [RECOVERY.md](RECOVERY.md). Não houve relaxamento de V05, revogação durável, `RECOVERY_CONFLICT`, locks ou autorização de descarte.

Os resultados completos estão em [MATERIALIZATION.json](MATERIALIZATION.json), com fingerprints de fontes antes/depois iguais. A rodada sob carga anterior foi preservada em [MATERIALIZATION-LOADED.json](MATERIALIZATION-LOADED.json). A comparação de ativação/desativação do Core é separada, em [BENCHMARKS.md](BENCHMARKS.md). No microbenchmark, `gitSubprocesses` representa as invocações diretas do helper Git dentro de cada amostra: as três extrações `checkout-index` concluíram normalmente. Não houve observação de descendentes do Git; esse campo não é um inventário de toda a árvore de processos.

## Inicialização do Git no Windows: experimento separado

O [runner de startup](../../../scripts/benchmark-git-startup.mjs) compara dois executáveis nomeados explicitamente da mesma instalação: `C:\Program Files\Git\cmd\git.exe` (wrapper) e `C:\Program Files\Git\mingw64\bin\git.exe` (backend). O produto continua usando sua resolução existente; não houve alteração do Core, de `PATH`, da instalação ou da configuração global por esse experimento.

A documentação do Git for Windows explica que o wrapper prepara variáveis como `PATH`, `HOME` e `MSYSTEM` antes de iniciar o programa real. Também documenta o uso de caminho absoluto para o backend. Isso torna a alternativa investigável, mas não torna equivalentes todos os fluxos de bootstrap apenas porque consultas simples coincidiram. [Git for Windows: Git wrapper](https://gitforwindows.org/git-wrapper.html).

A execução `startup-02`, com `HOME` explícito e demais diretórios/configurações isolados, terminou **PASS no escopo do microbenchmark**: 42 invocações medidas, 55 tentativas diretas no total, sete consultas e três amostras por executável/consulta. Os vetores de argv são idênticos entre os executáveis; a ordem AB/BA alterna por consulta/amostra. Há uma consulta de aquecimento não medida por executável, sem expulsão do cache do sistema operacional. Não se mede latência do Core, e não há p95 com n=3. Os descendentes iniciados pelo wrapper/Git não foram observados; 55 não é uma contagem física de toda a árvore de processos.

| Consulta | Wrapper: mediana [mín.–máx.] | Backend: mediana [mín.–máx.] | Variação da mediana |
| --- | ---: | ---: | ---: |
| `version --build-options` | 376,0 [270,4–1.629,6] ms | 189,7 [60,5–633,6] ms | −49,5% |
| `--exec-path` | 246,3 [128,8–1.316,3] ms | 175,0 [78,6–811,9] ms | −29,0% |
| Configuração com escopo/origem | 175,4 [148,5–1.751,8] ms | 607,7 [100,0–1.635,3] ms | +246,4% |
| Identidade sintética | 246,1 [183,8–336,4] ms | 419,8 [130,9–514,9] ms | +70,6% |
| Descoberta `rev-parse` | 345,2 [249,9–530,3] ms | 133,7 [113,4–252,8] ms | −61,3% |
| `status --porcelain=v2` | 282,3 [234,5–763,3] ms | 142,6 [124,6–218,4] ms | −49,5% |
| `for-each-ref` | 202,7 [183,8–830,4] ms | 215,4 [103,2–254,3] ms | +6,3% |

O resultado é misto: quatro medianas menores e três maiores, com amplitudes largas. Os deltas de cada par também estão preservados no JSON. Não há demonstração de ganho global, significância estatística ou economia previsível para as transações do Git Layer. Os bytes das saídas de todas as consultas medidas coincidiram, assim como os escopos/origens/chaves de configuração. HEAD, refs, índice principal e bytes/modos do workspace permaneceram iguais no retrato antes/depois; os hashes dos dois executáveis também permaneceram iguais. Isso certifica somente as observações declaradas.

A execução anterior `startup-01` incluiu o controle opcional sem `HOME` e terminou **FAIL**, preservado em [STARTUP-UNCONFINED.json](STARTUP-UNCONFINED.json). Ambos os caminhos retornaram, ao expandir a string sintética `~/git-startup-probe`, um caminho fora da fixture. A expectativa de isolamento não foi atendida; o probe consultava a expansão de uma configuração, sem abrir o arquivo designado por esse caminho. As 84 invocações medidas tiveram saídas equivalentes e os retratos do repositório foram preservados, mas isso não converte o resultado global em aprovação. As amostras desse controle não são somadas às de `startup-02`.

Os dados de `startup-02` estão em [STARTUP.json](STARTUP.json). As projeções públicas omitem caminhos privados, conteúdo de identidade/configuração e conteúdo dos streams, conservando argv, chaves/escopos/origens, contagens e hashes de saída. Os originais continuam externos, com seu tamanho e SHA-256 registrados nas projeções. Os hashes do runner e dependências foram observados ao projetar os resultados; não foram registrados automaticamente antes/depois pelo experimento. Essa proveniência é mais limitada que o congelamento de fontes do benchmark Core e não deve ser apresentada como equivalente.

**Decisão:** conservar o executável atual do produto. Uma fase posterior pode avaliar a seleção explícita do backend da mesma instalação, caso a repetição controlada confirme benefício no Core e a compatibilidade de bootstrap seja comprovada. Esta campanha de consultas não cobriu hooks, comandos em shell, helpers, transporte, credenciais nem a variedade de instalações/versões do Git for Windows. A alternativa não foi adotada devido aos resultados mistos e à cobertura de bootstrap insuficiente.

## Publicação conjunta do backup/plano — candidato V5

O perfil de escala motivou eliminar uma publicação atômica redundante do journal por novo caminho acompanhado. A implementação introduzida no V5 e incluída nas fontes V9 separa somente a preparação privada (`prepareBackup`) da publicação; não separa a durabilidade da chamada pública. `backup()` continua registrando sua entrada antes do retorno. O método específico `backupTracked` exige a mesma lista de arquivos do plano da transação, valida BEFORE/entrada/cópia e publica backup e arquivo juntos em `backup-ready`, aguardado antes de qualquer escrita, unlink ou publicação de índice pelo caller. `track`/`after` normalizam a mesma identidade absoluta do caminho.

A decisão preserva bytes independentes, flush, sincronização de diretório quando suportada, hashes, modos e revalidações. Não agrupa revogação durável, AFTER ou `index-publication-prepared` com uma publicação posterior. V05 continua recusando materialização física ausente/indistinguível, inclusive quando a interrupção antecedeu a primeira escrita.

Uma cópia concluída antes de `backup-ready` pode ficar órfã; a janela já existia entre copiar e registrar. A implementação não a apaga, não a usa como autoridade e não modifica o alvo antes do plano durável. Uma morte real conserva o lock órfão e exige inspeção. Os [cinco testes de fronteira](RECOVERY.md#fronteiras-da-publicação-conjunta-do-journal--candidato-v5) passaram nos IDs 133–137 da full V9, dentro dos 411 PASS, sem somar focos históricos ou antecipar a matriz ampla. O protocolo foi incluído no pacote V9 medido/testado; não houve ablação para atribuir isoladamente ganhos ou regressões a esta mudança; eliminar uma publicação não elimina o crescimento acumulado de serialização do journal.

## Proposta posterior: journal incremental e checkpoints

A coalescência de uma publicação por caminho reduz trabalho constante, mas conserva a serialização integral repetida do journal: o custo acumulado continua podendo crescer como O(N²) com a quantidade de arquivos e passos. Isso não torna 10.000 caminhos instantâneos e não autoriza omitir barreiras duráveis.

Uma evolução futura pode investigar log incremental/append e checkpoints. Ela exige protocolo e versão próprios, regras de replay idempotente, tratamento de append parcial/corrupção, validação de concorrência, compactação segura e prova de durabilidade de cada fronteira. Backups, publicação de índices, V05 e revogação de propriedade precisariam de contraprovas próprias antes da adoção. Essa arquitetura não foi implementada nesta etapa.

Cache persistente de journals concluídos baseado somente em timestamps não é aceitável como prova de integridade ou ausência de alteração externa. O caminho de status sem reconciliação persistente evita gerar novas transações sem mudança; ele não limpa, compacta nem deixa de validar o histórico já retido.

## Consulta nativa sem publicar refresh do índice

O Git 2.53.0.windows.2 observado pode regravar campos de stat do índice ao executar diff. O probe com índice de 1.200 caminhos demonstrou que somente `diff.autoRefreshIndex=false` mantinha os bytes, mas reportava 1.200 caminhos modificados em vez dos dois reais. Essa alternativa foi rejeitada.

A solução mantém o diff nativo sobre cópia independente, com fonte e locks revalidados, marcador/nonce, argumentos clonados antes do primeiro await e limpeza de entradas exatas. Falha ou identidade desconhecida conserva diagnóstico sobre o que realmente permaneceu; não promete cópia completa após uma remoção com erro. Os temporários externos não entram em recovery-export. O custo adicional é proporcional ao índice e aparece no pacote final medido, sem atribuição isolada de latência. [Investigação e contraprovas](INDEX-QUERY.md).

## Preservar a fronteira temporal do índice Git

As reproduções de [integridade](INTEGRITY-AUDIT.md) demonstraram que copiar bytes exatos para um arquivo de índice mais novo pode mascarar C posterior a B quando o stat do workfile permanece igual. O defeito atingia consulta, as duas fronteiras de cópia do staging e a restauração por rollback. Preservar somente hash/bytes do índice não basta para conservar o oráculo nativo.

No código primário do Git v2.53.0, [index_state.timestamp](https://github.com/git/git/blob/v2.53.0/read-cache-ll.h#L159) é um cache_time; [cache_time](https://github.com/git/git/blob/v2.53.0/statinfo.h#L10) guarda segundos/nanossegundos em uint32. O [predicado racy](https://github.com/git/git/blob/v2.53.0/read-cache.c#L327) exige segundos do timestamp do índice diferentes de zero e compara a fronteira com o mtime da entrada. **Inferência de engenharia a partir desse código:** uma cópia com fronteira positiva não posterior à fonte conserva ou amplia a necessidade de checagem de conteúdo, enquanto uma cópia mais nova pode removê-la. Essa inferência orienta a implementação e não substitui as contraprovas executáveis.

A decisão implementada nas fontes V9 é compartilhar [index-timestamp.ts](../../../src/core/index-timestamp.ts). O cálculo usa nanossegundos inteiros exatos, arredonda apenas para trás e confirma o resultado real do filesystem. Nenhuma cópia de consulta/staging pode ficar abaixo de epoch + 1 segundo ou posterior à fonte; segundos fora do domínio uint32 são recusados. O timestamp é aplicado pelo FD cuja identidade e vínculo com o caminho foram comprovados, sem abrir/escrever o índice vivo de origem. Hash, modo, tokens de concorrência, locks e revalidação permanecem nos callers. A API fixa os argumentos por clone e validação antes do primeiro await.

Consultas preservam a fronteira da fonte na cópia transitória. Staging aplica o mesmo protocolo tanto à cópia inicial quanto ao lock copiado do índice efetivamente produzido pelo Git. A decisão não muda os comandos nativos, não une índices e não usa a fronteira extrema de recuperação nas consultas comuns.

## Rollback de índices legados sem fronteira temporal registrada

Os backups existentes registram a imagem anterior, mas não a fronteira temporal original do índice. A decisão implementada nas fontes V9 conserva o schema e os backups e aplica somente aos índices MAIN/privados aprovados a fronteira **epoch + 1 segundo** na cópia privada a restaurar. Na representação cache_time do Git, um segundo é a menor fronteira com segundos não nulos; epoch zero desabilitaria o predicado racy. **Inferência:** essa escolha conservadora amplia rechecks sem precisar inventar o timestamp original. Ela não prova o comportamento de toda versão/plataforma do Git.

O helper faz sync no mesmo FD comprovado depois da escrita temporal, revalida identidade/tempo/caminho e devolve a observação exata. O rollback ainda confere bytes/modo e a imagem atual do destino antes do rename. Outros arquivos restaurados mantêm o caminho anterior. O custo aceito é mais rehash depois da recuperação, em vez de uma janela falsamente limpa. Erro ou interferência preserva backup, journal e a evidência temporária disponível; não relaxa V05, revogação durável ou `RECOVERY_CONFLICT`. Os [seis testes novos](../../../tests/integration/recovery-index-timestamp.test.ts) passaram no gate recovery5 V9, dentro de seus 61 PASS; a full final concluiu 415 resultados, com 411 PASS e quatro SKIP, sem somar esse dirigido; infraestrutura V11 e matriz V11 passaram em campanhas próprias; cópia nova e publicação permanecem pendentes.

O [replay nativo dos índices privados](AUDIT-PRIVATE-INDEX-REPLAY.md) explica os dois FAIL do gate V7 que exigiam raw B após o checkpoint: o write-tree oficial reproduziu integralmente os bytes finais, com C detectado. A revisão implementada exige raw B exato no rename de restauração, antes do checkpoint, e igualdade integral com um replay nativo independente no índice privado final. MAIN conserva sua comparação raw exata. Não se ignora stat/checksum nem se reclassifica o gate V7. Esse recorte passou no dirigido V9 e na full concluída; os quatro SKIP gerais e os gates posteriores conservam seus escopos explícitos.

## Fixar o plano de off antes da prova de limpeza

O plano de caminhos e fingerprints agora antecede a consulta real de mudanças. Depois da consulta e das observações de propriedade/destino, o Core revalida todos os caminhos antes de registrar o plano e antes do primeiro remove; mantém também o expected fingerprint em cada remoção. Essa ordem impede que uma edição observada após o diff limpo seja adotada como imagem autorizada para descarte. A mesma regra vale com `--discard`: a autorização não inclui uma edição posterior ao plano. Os casos de primeira remoção, segundo arquivo e rollback após efeito anterior passaram na full V9, IDs 69–72, dentro dos 411 PASS; não constituem aprovação da infraestrutura ou matriz ampla.

## Serialização compacta: alternativa ainda não medida

Uma revisão estática considerou retirar a indentação dos journals. Isso pode diminuir o texto serializado, mas não elimina o número de flushes, as visitas a objetos, o crescimento O(N²) ou os payloads base64 legados. Não houve implementação nem medição de ganho dessa alternativa no candidato final.

Seria necessário tratar os quatro escritores de journal (início/persistência e dois caminhos de recuperação), aceitar ambos os formatos sem reescrever evidências antigas e testar fronteiras do limite de 64 MiB. Não se pode mudar indiscriminadamente a serialização de workspace/registry: a recuperação usa fingerprints das imagens esperadas, inclusive sua representação. Compactar whitespace também permitiria planos semanticamente maiores dentro do mesmo limite bruto; uma regravação posterior em formato indentado poderia ultrapassá-lo. A proposta permanece separada da evolução de protocolo incremental descrita acima.

## Recuperação sem pendências: validar a árvore na cópia

A proposta de apenas condicionar o checkpoint final foi superada pela [contraprova de objeto ausente](RECOVERY-NOOP-AUDIT.md#contraprova-de-objeto-ausente-e-decisão-v9): cached diff igual retornou 0, enquanto write-tree retornou 128 com blob ausente em índice válido sem TREE opcional. Omitir o comando perderia uma verificação nativa, mesmo que a árvore do índice coincidisse com o checkpoint.

V9 mantém o comando com queryIndexTree(repo,index), sem argumentos de operação fornecidos pelo caller: o argv é sempre write-tree. O helper reaproveita o worker de index-query, incluindo cópia independente, fronteira temporal conservadora próxima à fonte, hashes, locks, identidade, recibos e limpeza exata. No caso privado, o OID retornado precisa coincidir com o checkpoint recém-validado. Não há cache de respostas mutáveis entre chamadas.

Somente a publicação de reconstrução é condicionada: transações recuperadas, movimento de branch ou confirmações alteradas mantêm o checkpoint anterior. A repetição sem essa reconstrução usa a validação na cópia; não publica índice/ref/JSON de Layer e conserva os checks e reservas de proteção. Não há retorno antecipado. Write-tree pode criar/freshen objetos Git como antes; por isso não se descreve a operação como totalmente somente leitura do filesystem. Essa entrada é exclusiva de recover, não de preview/status, e não amplia a allowlist de diff.

A alteração e os dois testes novos de validação passaram no dirigido recovery5 e nos IDs 108/109 da full final V9; não se somam aos 411 PASS. Os FAIL V8 e os fatos das duas auditorias continuam preservados. Não se atribui a essa escolha isolada o ganho do pacote medido; não houve ablação por otimização.

## Leitura do perfil final V9 e limites da decisão

A comparação válida é baseline d71→V9 na mesma campanha. Os nove pares completos usam fontes e scripts identificados, cache aquecido após setup e ordem fixa por cenário. Diferenças entre V6 e V9 não são ablações ou ganhos atribuíveis ao código. n1 permanece observação única; p95 não é estimado com as amostras disponíveis.

A redução de subprocessos é observável: com uma Layer, on 66→45, off 67→44, status 123→90 e on-repeat 49→34. Isso não prevê o tempo de todas as escalas. Com cinco Layers, on/status/repetição pioraram 3,7%/40,0%/18,2% nas observações únicas, embora os contadores tenham caído. Sem Layers, recover-empty também piorou em n3: mediana 282,978→348,117 ms (+23,019%; MEASURED_HIGHER_LATENCY), sem atribuição causal isolada. As regressões observadas e todos os 130 registros permanecem no [relatório de benchmarks](BENCHMARKS.md).

A cópia por streaming atende à redução de buffers integrais, com RSS do worker observado de cerca de 399→69 MiB em 100 MiB. Não se atribui todo delta de tempo ou memória a essa mudança isolada. Em mil arquivos, publish/writeCopy/transaction.record e deactivateInternal/remove/track ainda acumulam dezenas de segundos inclusivos; não somar métodos aninhados nem remover barreiras para alcançar a meta de latência. backupTracked não foi envelopado, e ausência de um contador não demonstra ausência de cópia.

A decisão é conservar as verificações e documentar o limite de escala. Os dois endpoints de dez mil arquivos ficaram TIMEOUT_OWNED; esse resultado não vira PASS nem prova uma latência de on/off. Journal incremental, compactação e paralelismo continuam propostas separadas, com contratos de durabilidade/recuperação próprios antes da adoção.

## Distribuição fiel das evidências

O [índice compacto](BENCHMARKS.json) mantém todos os 130 registros de comparação e aponta os dez cases integrais em benchmarks/cases/. Campos fora de cases permanecem em sourceMetadata. A [prova de conservação](BENCHMARKS-SHARDS.json) remonta toda a estrutura e exige igualdade e digest canônico de 319.987 nós; não recalcula estatísticas nem arredonda valores. O JSON integral original permanece preservado. A mudança é de distribuição documental e não de armazenamento do produto.

O Markdown original de benchmarks foi conservado como prefixo, com apêndice editorial identificado para os links. A projeção normaliza somente o argv técnico exato do observador nativo config/core.hooksPath/dispositivo nulo Windows, com índice do argumento, hash original e motivo; caminhos UNC arbitrários continuam recusados. A [auditoria independente](BENCHMARKS-PRIVACY-AUDIT.json) cobriu treze artefatos e terminou NO_CANDIDATES_OBSERVED. Este lote de prosa posterior requer nova auditoria. Controles de projetores, remontagem e auditoria não são testes Core/CLI nem somam ao denominador da full.

A full final terminou com 415 resultados, 411 PASS, quatro SKIP e zero FAIL/cancel/todo, exit 0 e fonte igual. Depois disso, o coordenador externo ficou HALTED ao exigir executável não nulo de uma observação de memória. A decisão é conservar esse FINAL quiet=false. Uma prova posterior independente confirmou CLOSURE_PROVEN/quiet=true, com 128 identidades, duas consultas e nenhum processo sinalizado; isso não reinterpreta o HALTED como PASS nem altera o resultado Node. A continuação posterior concluiu typecheck/build/smoke com PASS, fonte209 igual e quiet=true; a primeira infraestrutura V9 terminou FAIL sob D1; a infraestrutura posterior V10 passou com 113 PASS/113 sob D2, preservado e concluído. A broad V10 permaneceu FAIL (354 PASS/um FAIL/seis ENV_BLOCKED em 361); infraestrutura e broad inteira V11 passaram depois em novas campanhas, sem somatório. Nenhum commit, push, cópia nova ou resultado remoto é antecipado. [Evidências e SKIP](FULL-V9-RESULTS.json).

A correção posterior V10 permanece na infraestrutura: o teste de portabilidade deve fornecer explicitamente um pai externo validado para as fixtures internas do checkout copiado. O TEMP isolado desse checkout não satisfaz essa regra, e a recusa EXISTING_FIXTURE_PARENT_INVALID não deve ser enfraquecida. Foi acrescentada uma asserção de localização externa, sem retirar oráculos. Core/CLI, corpus full e benchmarks não mudaram; o fingerprint global mudou apenas por esse teste. Conservam-se [o FAIL original 112/1 em 113](INFRA-V9-FAILED-RESULTS.json), a identificação V9 da full415 e a infraestrutura posterior V10 PASS113/113, sem somar campanhas. D2 foi concluído com docs/runner/fontes iguais; A broad V10 permaneceu FAIL (354 PASS/um FAIL/seis ENV_BLOCKED em 361); infraestrutura e broad inteira V11 passaram depois em novas campanhas, sem somatório. [Fontes e congelamento D1](RESULTS.md#primeira-infraestrutura-v9-e-correção-restrita-v10).

A matriz V10 posterior terminou FAIL no HARNESS-021: o teste ainda reconhecia 1B como autoridade atual. A correção V11 distingue a missão atual Etapa 2 da referência histórica 1B, mantém checks e hash anteriores e passou em nove controles locais. Isso corrige a expectativa documental, sem mudar o produto nem aprovar a matriz por composição. O FAIL V10 permanece registrado, incluindo seis ENV_BLOCKED; infraestrutura e matriz inteira V11 foram executadas depois: 113 PASS/113 e 355 PASS/seis ENV_BLOCKED/zero FAIL em 361, respectivamente. Full415 e benchmark permanecem V9. [Campanha e separação dos estados do coordenador](RESULTS.md#matriz-v10-fail-e-correção-restrita-v11).
