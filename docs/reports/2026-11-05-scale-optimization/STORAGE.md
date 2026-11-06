# Armazenamento — Etapa 2B

## Fonte da verdade e classes de dados

Objetos, árvores, blobs, commits e branches continuam pertencendo ao Git oficial. Não existe cache físico reutilizável de Layer, banco paralelo de objetos, sincronização automática ou atualização automática de tracking. Checkout-index extrai a imagem vinculada do índice para um prefixo privado; os bytes precisam corresponder ao blob solicitado ou à sua conversão Git oficial antes de autorizar o hash físico da cópia independente.

Cache de projeção ocupa **zero bytes porque não existe**; isso não significa armazenamento adicional zero. O Core 22 medido tem fingerprint por tuplas `807ad17f66e41e3147792049797a48b56c919737734bbe2a847149a07909ee8b`, correspondente ao domínio próprio do benchmark `dcada2527e12c8b65b437f8011125798c484f75adba7c6727cd366657cf3dceb`. A [full V10](VALIDATION-FULL-V10.json) e a [broad V11](VALIDATION-BROAD-V11.json) passaram em snapshots funcionais distintos, ligados pela [prova de escopo](SOURCE-TRANSITION-PROOF.json). Os números atuais abaixo pertencem à nova [campanha final](BENCHMARKS.md); V7 e seus controles ficam históricos, sem transportar inventários antigos para o runtime corrigido.
| Dados | Responsabilidade | Tratamento nesta etapa |
| --- | --- | --- |
| Objetos e refs Git, inclusive checkpoints técnicos | Conteúdo versionado e alcançabilidade da recuperação | Necessários; nenhum expurgo ou substituição por cache |
| Locks de transação de refs Git | Exclusão nativa durante prepare, observação de tipo e commit/abort | Pertencem ao Git oficial; o Core não remove locks disputados para completar uma operação |
| Índice MAIN e índices privados | Staging nativo independente, inclusive B preparado diferente de C no disco | Necessários; cópias preservam também a fronteira temporal racy |
| Registry, workspace e reservas | Coordenação de composição, origem e destino de edição | Necessários; não substituem árvores/blobs Git |
| Backups de transações | Imagens independentes BEFORE autorizadas pelo journal | Retidos; a limpeza nova não os atravessa nem os remove |
| Journal pendente v 2, `events.log`, `events.tip` | Plano durável ordenado, checksum e fronteira de append confirmado | Necessários em conjunto enquanto o manifesto os referencia; corrupção/truncamento recusam |
| Checkpoint de falha v 2 inline com checksum | Plano completo de recuperação com guardas novas de identidade | Autoritativo sem replay; Core antigo recusa seu schema, sem ignorar as guardas |
| Journal concluído schema 1 e eventos históricos retidos | Plano final e evidência técnica anterior | Retidos; a leitura operacional do checkpoint não exige replay dos eventos antigos |
| `materialized/` da transação atual concluída | Extração intermediária reconstruível, sem autoridade de backup | Pode ser retirada somente pelo inventário capturado nesta execução e após `finish` durável |
| `materialized/` antigo, pendente, alterado ou desconhecido | Possível evidência ainda não classificada | Preservado; não há busca nem limpeza retroativa |
| Temporário adjacente `.git-layer-UUID` | Cópia independente sincronizada anterior à publicação | Nome privado retirado na publicação bem-sucedida; falhas podem conservá-lo |
| Cópias de índices para consultas/staging e temporários de recovery | Isolamento, validação e fronteira temporal | Mantêm seus protocolos próprios; não são abrangidos pela limpeza nova |
| `transactions/<id>/activation-<uuid>.index` | Imagem independente consumida pela validação/extracão da ativação | Retida como evidência técnica, O(tamanho do índice) por ativação; fora de `materialized/` e sem função de cache de conteúdo |
| `transactions/<id>/register-<UUID>.index` | Imagem técnica da árvore Git solicitada, preparada e validada antes de criar o índice vivo | Retida como evidência; uma por registro novo compartilhado por create/register/primeiro on, sem repetição em on de Layer já registrada e fora da limpeza de materialized |
| `transactions/<id>/stage-<UUID>.index` | Imagem técnica independente consumida pelo add gerenciado, já retida pelo protocolo anterior | Retida; no add de Layer projetada também é a fonte verificada da árvore fixa B. Não é backup, cache ou novo índice vivo |
| Shelves e snapshots legados, migração e reservas de protect | Compatibilidade, resgate e proteção opcional | Preservados, sem política nova de retenção |
| Projeção limpa reutilizável | Cache de desempenho opcional estudado | Não implementada; zero espaço adicional atribuído a esse cache |

A imagem `register-<UUID>.index` recebe `read-tree` do OID solicitado e validação nativa de árvore em cópia independente. Só depois de provar a árvore A esperada o publicador prepara seu lock independente, registra AFTER e a identidade de criação no journal e reivindica o índice vivo ausente sem substituição. O checkpoint inicial recebe essa árvore fixa com OID anterior zero no CAS nativo. Um erro antes de atribuir `ActivationSource` ou uma falha no marcador posterior não autoriza remover um índice externo: o plano durável anterior continua restringindo rollback a ausência ou à identidade exata criada. Essas imagens são evidência técnica retida, sem papel de cache ou nova fonte da verdade.

Uma ativação descoberta que primeiro registra a Layer pode reter tanto a imagem de registro quanto `activation-<UUID>.index`: duas imagens técnicas de tamanho proporcional ao índice, com responsabilidades distintas. Registro explícito e criação usam somente a imagem de registro nessa classificação; ativação posterior de uma Layer registrada não repete esse registro. O inventário medido de cada benchmark tem suas próprias fontes e condições; não se atribui retroativamente esse custo novo a campanhas anteriores.

### Vinculação dos bytes extraídos ao Git

A [contraprova de fonte materializada](MATERIALIZED-SOURCE-REPRO.json) alterou somente a extração privada, depois do sucesso real de `checkout-index` e antes da primeira abertura para fingerprint. O V7 aceitava o SHA-256 observado de C como fonte, publicava C e concluía a ativação, mantendo blob, índice e checkpoint A. A cópia independente protegia contra alteração posterior daquele hash, mas não demonstrava que seu primeiro valor vinha do Git solicitado.

A implementação calcula, na mesma leitura pelo FD validado, o SHA-256 físico e o OID Git dos bytes crus, com envelope de blob e algoritmo SHA-1 ou SHA-256 conforme o repositório. Aceita o blob canônico A ou a representação convertida oficial de A. Assim, LF canônico continua sendo conteúdo Git válido mesmo quando atributos pedem checkout CRLF; exigir somente os bytes CRLF seria uma restrição nova indevida. A verificação convertida usa `git cat-file --filters` para o OID/caminho vinculados, com os filtros externos já bloqueados pelo contrato do Core, e calcula SHA-256 de um único stream até EOF. O SHA-256 físico aprovado continua sendo o esperado na cópia/publicação posterior.

O consumidor Node não retém toda a saída no antigo limite de captura de 64 MiB. Isso não é uma promessa de memória limitada para o Git filho: a conversão nativa pode carregar o arquivo inteiro. Também pode haver uma chamada Git por arquivo que precise dessa representação; N arquivos convertidos podem acrescentar N spawns. Não se adotou um parser batch para conteúdo filtrado: no probe nativo, o header de tamanho cru 11 enquadrava um corpo convertido de 13 bytes, sem fronteira confiável para esse protocolo. O stream individual até EOF evita inferir o próximo header a partir do tamanho errado. Os benchmarks V7 preservados não incluem esses custos. A campanha final mede o runtime corrigido inteiro, com validação e chamadas nativas incluídas; não há timer exclusivo que atribua toda a diferença a essa conversão.

Para o staging de Layer projetada, `stage-<UUID>.index` conserva a imagem pós-add e serve de fonte à validação nativa de árvore. `queryIndexTree` usa outra cópia independente transitória, com seu protocolo próprio de identidade, timestamp, recibo e limpeza; não executa `write-tree` sobre o scratch pós-add original. A imagem stage permanece na transação; a cópia externa de consulta é normalmente retirada por seu próprio protocolo, e uma falha exige observar a retenção real. Essa cópia externa não entra automaticamente em recovery-export. O passo acrescenta trabalho de validação proporcional ao índice, sem atribuir custo retroativo a benchmarks anteriores.

A recuperação de staging observa somente as identidades BEFORE/AFTER e a árvore/contexto Git duravelmente autorizados. Depois de restaurar o índice, conserva também sua identidade nova durante a execução atual. Se ocorrer outra interrupção antes da conclusão, esse testemunho novo pode não estar durável: o reinício pode recusar e exigir inspeção manual, sem inferir propriedade por bytes iguais ou devolver falso estado saudável. Journals, backups e as imagens técnicas restantes continuam preservados.

### Reconstrução de checkpoint sem regravar o índice vivo

A full V9 confirmou que write-tree sobre o índice vivo podia preencher a extensão TREE e alterar bytes/identidade apesar de manter entradas/OIDs. O checkpoint atual valida a árvore nativa em cópia independente verificada e com fronteira temporal preservada, tanto no privado quanto na validação MAIN do papel Layer-branch. Core.baseCommit explícito continua seguindo seu caminho Git nativo. Não foram retirados rebuilds, refs/CAS, validação de objetos, backups ou barreiras.

Na rota privada, o fingerprint esperado vem da imagem própria conhecida (AFTER, BEFORE após rollback concluído ou token do guard). Track recebe essa expectativa antes de comparar e co-publicar backup/BEFORE em backup-ready; uma fonte C posterior não vira um BEFORE autorizado. Identidade, bytes e locks são reobservados antes/depois da consulta, AFTER esperado e checkpoint. A cópia transitória recebe o refresh; não nasce outro índice vivo ou banco de objetos. [Recuperação e oráculos raw](RECOVERY.md).
### Referências diretas e transação nativa preparada

A [prova Core](CHECKPOINT-SYMREF-REPRO.json) mostrou que um checkpoint simbólico com OID A podia encaminhar o add B para uma tag técnica fora do checkpoint. O [probe no-deref](NO-DEREF-PROBE.json) mostrou uma segunda distinção: a flag impede escrever no destino do alias, mas sozinha pode substituir o próprio alias. Por isso, o helper implementado prepara a transação `update-ref --no-deref --stdin`, conserva os locks nativos e consulta cada ref com `symbolic-ref --quiet --no-recurse` antes de enviar commit. Se observar um alias, envia abort e preserva alias/referent. CAS de OID e prova de tipo têm papéis separados; criação com OID anterior vazio conserva a expectativa nativa de ausência.

O helper coordena o protocolo do próprio Git; não cria uma segunda base de refs, objetos ou histórico. Os checkpoints técnicos e backups anteriores continuam com seus papéis existentes. A transação preparada mantém temporários/locks nativos durante a operação, sem autorização para apagar locks de outro escritor. Abort e EOF liberaram os locks próprios nos casos do [protótipo nativo](PREPARED-REF-PROBE.json); falha ou interrupção pode exigir conservar um lock para diagnóstico. Isso não é atomicidade de uma Layer inteira nem exclusão de escritores que alterem arquivos ignorando locks. O ambiente demonstrado é Git 2.53.0.windows.2 no backend da fixture Windows, sem certificação de perda de energia ou de outros backends.

Os [50 casos de materialização](MATERIALIZED-FOCUSED.json) são intermediários nas fontes 229/`57d3044d…`. O [dirigido de refs](REFS-FOCUSED.json) tem fases A 21/21 e B 6/6 separadas nas fontes 232/`964e3870…`; não é uma full nem se soma aos 50. Os tempos de API e inventários V7 antecedem ambos os reparos. A full V10 e a broad V11 posteriores têm seus próprios recibos; não somam os dirigidos intermediários. Os tempos atuais estão em BENCHMARKS e não são uma renomeação dos dados V7.

## Publicação sem substituição

A cópia por streaming continua independente da extração original. O hash observado na preparação não é substituído pelo hash de uma fonte posteriormente modificada. Para um destino comprovadamente ausente, [publication.ts](../../../src/core/publication.ts) abre e valida a identidade do temporário, confere seu conteúdo esperado e usa `link(temporário, destino)`. Essa operação reivindica o novo nome sem substituir uma entrada existente. Em seguida, confere as identidades e retira exclusivamente o nome privado; o retorno bem-sucedido exige `nlink === 1`. O caller confere o conteúdo físico e publica AFTER na mesma fronteira anterior.

O uso transitório de `link` é uma primitiva de publicação sem substituição de uma cópia **já independente**. Não transforma hardlinks em cópias independentes, backups ou cache. Não há compartilhamento permanente entre a extração e o workspace, nem entre backup e arquivo de trabalho. Dois nomes transitórios referenciam um único payload; não são duas alocações independentes desse payload. A semântica de compartilhamento dos nomes é documentada pela [Microsoft](https://learn.microsoft.com/en-us/windows/win32/fileio/hard-links-and-junctions).

A corrida reproduzida na baseline criava C imediatamente antes do syscall `rename`; a ativação retornava sucesso e substituía C. O teste de regressão agora exige recusa e preservação de C. A mesma proteção é usada no rollback que restaura um destino ausente. A substituição deliberada de um destino existente continua com fingerprint imediatamente anterior e `rename`: uma edição externa entre essa verificação e o rename de substituição ainda pode ser sobrescrita. A reivindicação sem substituição do destino ausente não fecha essa janela do destino existente. Não há CAS nativo universal nem atomicidade de uma Layer inteira, e essa limitação já documentada não é apresentada como novo probe.

Não existe fallback de `link` para `rename` com substituição, inclusive em EXDEV, filesystem sem suporte ou erro de permissão. O temporário de publicação é criado no diretório do próprio destino, evitando cruzamento de volume no caminho normal. EXDEV é coberto tanto por erro sintético quanto por recusa real em fixtures novas nos volumes C: e D:, cujas identidades distintas foram comprovadas. O [dirigido C/D](COPY-FAILURE-FOCUSED.json) observou EXDEV em rename e publicação, conservando a fonte e o destino ausente; não demonstra suporte a movimentação entre volumes.

Uma interrupção entre link/unlink deixa dois nomes. `safePath`/recuperação recusam esse estado com links; não o declaram saudável, não apagam aliases automaticamente e não removem locks órfãos. Após unlink e antes de AFTER, o arquivo pode estar completo, mas o plano continua insuficiente para uma restauração automática segura. Veja [RECOVERY.md](RECOVERY.md). Isso pode exigir inspeção manual, mesmo com bytes preservados.

A segunda cópia também separa o inode publicado dos descritores abertos anteriormente sobre a extração. No [probe isolado de fonte retida](SOURCE-HANDLE-PROBE.json), escrever por um FD da fonte aberto antes da validação alterou o destino depois de link+unlink direto ou rename; com cópia independente, alterou apenas a extração. Isso comprova essa fronteira específica no ambiente observado, sem prometer exclusão universal de escritores do temporário ou do workspace e sem medir ativação completa. A retirada posterior do pathname da extração não revoga, por si só, um descritor já aberto.

## Retirada de novas extrações descartáveis

[disposable-projection.ts](../../../src/core/disposable-projection.ts) recebe somente a transação recém-criada e seu filho exato `materialized/`. A autoridade de limpeza existe apenas em memória durante essa operação. Captura nomes completos, hashes, modos e identidades dos arquivos e diretórios extraídos; recusa extras, links ou entradas que não coincidam com o plano. Não abre um diretório antigo para inferir que seria descartável.

Depois da conclusão durável, compara o journal completo gravado com a imagem exata concluída em memória e captura a identidade física desse journal. Examina dependências do plano e valida a árvore inteira antes da primeira remoção. Cada arquivo é novamente conferido por identidade/hash/modo, com validação dos ancestrais e do journal. A identidade do journal é revalidada por arquivo, evitando rehash quadrático de um journal crescente. A remoção usa somente `unlink` dos arquivos conhecidos e `rmdir` de diretórios vazios conhecidos, sem remoção recursiva.

Uma mudança externa, dependência, arquivo desconhecido, hardlink ou erro de I/O provoca retenção, com contagem precisa caso alguma retirada já tenha ocorrido. O recibo novo `materialized-cleanup.json` é escrito exclusivamente, quando a identidade da transação ainda permite fazê-lo. Falhar na limpeza ou no recibo não transforma uma transação concluída em rollback e não remove backups. O tempo dessa limpeza pertence ao retorno completo da API medido nos benchmarks.

Assim, uma ativação concluída normalmente deixa de reter a segunda extração integral naquela transação. Isso reduz retenção após sucesso; não elimina o pico temporário da extração mais o workspace e a cópia de publicação em andamento. A cópia técnica `activation-<uuid>.index` permanece retida e é medida separadamente. Desativação continua guardando backups independentes necessários à recuperação, sem auto-park. Repetições ainda podem acumular esses backups, cópias técnicas e histórico de journals. Uma política de expurgo histórico exige análise própria e não foi implementada.

### Controle histórico da limpeza e dependências retidas

O controle anterior ao buffer limitado usou um arquivo de 100 MiB, uma primeira ativação e **um** ciclo off/reativação por variante. Com a limpeza original ativa, a primeira ativação/reativação observaram 7,5249049/4,4392239 s; com captura/callback de limpeza desabilitados apenas no contrafactual, 6,1658776/3,9321641 s (n1). Não se interpreta essa observação como tempo da combinação final sem limpeza nem como comparação com o endpoint de três ciclos de mil arquivos. [Fontes e amostras intermediárias preservadas](BENCHMARKS-INTERMEDIATE.json), [qualificação consolidada](BENCHMARKS.md).

| Endpoint equivalente de duas ativações | Limpeza ativa | Limpeza desabilitada |
| --- | ---: | ---: |
| Extrações materialized retidas, bytes lógicos | 0 | 209.715.200 |
| Extrações materialized, alocação de dados reportada | 0 | 209.715.200 |
| Repositório, bytes lógicos | 314.675.040 | 524.389.906 |
| Repositório, alocação de dados reportada | 314.681.344 | 524.396.544 |

Foram evitados **200 MiB de extrações retidas** depois de duas ativações. A diferença lógica total do repositório é 209.714.866 bytes, 334 bytes menor que a diferença de materialized por diferenças de metadados; não se arredonda esse total para criar equivalência exata. A política final conserva a limpeza segura e aceita seu custo. Backups de off, imagens de índices, eventos e snapshots permanecem: cache descartável não é backup, e a limpeza de materialized não autoriza retirar essas dependências.

O journal incremental reduziu os bytes de escrita conhecidos na API JavaScript da primeira ativação de mil arquivos de 1.193.130.811 para 3.850.859, aproximadamente 99,68%, mas registrou 4.024 sincronizações contra 2.013. São bytes acumulados das chamadas observadas e contagens de sync, não espaço lógico retido, alocação física nem I/O total do dispositivo. O snapshot concluído evita replay operacional dos eventos antigos; os eventos continuam retidos como evidência. Nenhum expurgo automático de logs, snapshots, backups, refs ou shelves anteriores foi implementado. [Contadores](BENCHMARKS.md).

### Endpoint atual: menos regravação, mais histórico retido

A campanha final usa o mesmo inventário nos dois endpoints. Em uma Layer de mil arquivos, depois da primeira ativação e dos três ciclos off/reativação, o endpoint de repositório mostra:

| Categoria | Baseline B | Core final B |
| --- | ---: | ---: |
| Journals, snapshots e eventos retidos, lógico | 9.730.092 | 30.427.313 |
| Backups, lógico | 1.188.600 | 924.291 |
| Materialized, lógico | 1.024.000 | 0 |
| Imagens de validação de ativação, lógico | 0 | 352.412 |
| Imagem inicial de registro, lógico | 0 | 88.103 |
| Índice privado vivo, lógico | 88.103 | 88.103 |
| Repositório, lógico | 12.617.916 | 32.468.035 |
| Dados de arquivo alocados reportados | 10.321.920 | 31.207.424 |

O total lógico da fixture, que também inclui HOME isolado e índices de seeding, é outro escopo: 12.707.504→32.557.616 B na tabela completa. Não somar os subtotais ao total nem chamar qualquer endpoint de pico de disco. Materialized dos arquivos pequenos tinha alocação de dados reportada zero também no baseline; arquivos residentes e metadados NTFS têm custo fora dessa medida. Zero não significa ocupação física total zero.

Na primeira ativação de mil arquivos, a escrita acumulada de journal conhecida na API caiu 1.193.130.811→3.850.859 B (cerca de 99,68%), enquanto flushes passaram 2013→4024 e persistência inclusiva 22,2374033→16,1743521 s. Ao mesmo tempo, o espaço lógico dos journals retidos **cresceu** de 9.730.092 para 30.427.313 B. A otimização remove regravação repetida, não os eventos/snapshots necessários ou históricos. Não existe promessa de menor disco em todo cenário.

A extração final foi retirada com segurança nos casos bem-sucedidos medidos, incluindo 10.000; cache continua 0 B e reativação extrai novamente pelo Git. No cenário 100 MiB, materialized retido passou 209.715.200→0 B depois das duas ativações do ciclo n1; isso é ganho real dessa categoria, sem compensar ou esconder a retenção de journals/índices dos outros cenários. Os números atuais e o controle histórico de limpeza acima são campanhas distintas. [Amostras e escopos](BENCHMARKS.md).
### Histórico V7: inventário de uma reativação pendente

O [inventário V7 posterior ao timeout](BENCHMARKS-10K-INVENTORY.json) é uma observação histórica preservada durante reativação interrompida, depois de primeira ativação e off completos e provados. Havia zero arquivos da Layer no worktree, um journal de ativação pendente e os fatos anteriores retidos. Não houve recovery ou limpeza para produzir esse inventário, que não é um endpoint saudável concluído, pico de uso ou resultado de cache.

| Categoria do repositório preservado | Bytes lógicos |
| --- | ---: |
| Journals, snapshots e eventos retidos | 92.365.290 |
| Backups | 2.789.337 |
| Extração materialized pendente | 2.560.000 |
| Imagens de validação de ativação | 1.760.210 |
| Imagem inicial de registro | 880.105 |
| Índice privado vivo | 880.105 |
| Objetos Git | 3.010.328 |
| Repositório inteiro, incluindo demais itens | 104.250.780 |

A alocação de dados de arquivos reportada para o repositório foi 96.380.928 bytes. Algumas categorias pequenas podem ter alocação de dados reportada zero; isso não significa custo físico zero, pois MFT e outros metadados não entram nessa medida. O total da fixture inclui também HOME e índices de seeding e é outro escopo. Esses endpoints não são comparados diretamente com campanhas de número diferente de ciclos.

### Buffer e memória

O leitor solicita `max(1, min(262144, opened.size))` bytes por buffer e mantém o teto de 256 KiB para arquivos grandes. Essa fórmula reduz a capacidade solicitada para um arquivo pequeno; não mede a soma das alocações de toda a API. O [controle de buffer](BENCHMARKS-BUFFER-CONTROL.json) observou aproximadamente 2–3% em algumas operações, com outras diferenças de sinal oposto e RSS não uniformemente menor. RSS amostrado inclui harness/GC, perde picos inferiores ao intervalo de amostragem e exclui processos Git filhos. Não se usa esse contador para prometer uma redução uniforme de memória ou um ganho estatisticamente estável. Guardas, classificação antecipada de crescimento e suas campanhas próprias constam de [BUFFER-FOCUSED.json](BUFFER-FOCUSED.json).

## Medidas e limites físicos

A consulta técnica da etapa confirmou Windows x 64, Node v 24.14.1, libuv 1.51.0 e volume C: NTFS com unidade de alocação de 4.096 bytes; esse recibo identifica sua própria observação, sem fingir uma nova consulta de volume em cada benchmark. O [recibo dirigido](PUBLICATION-FOCUSED.json) preserva o comando nativo `Get-Volume`, a observação e hashes do snapshot funcional revisto, distinguindo-os dos testes dirigidos anteriores sem fingerprint retroativo. A primeira campanha V1 contou espaço **lógico** e bytes escritos observados na API. O observador final acrescenta a alocação de dados de arquivos reportada por `stat.blocks × 512`, deduplicada por dev/inode, com método e validade próprios. Nenhuma dessas medidas é inspeção de extents, bytes físicos gravados no dispositivo ou prova de CoW. Arredondar cada tamanho por cluster também não certifica a ocupação física real de arquivos residentes, comprimidos ou sparse.

Nenhum reflink foi acrescentado. O `COPYFILE_FICLONE_FORCE` ENOSYS do NTFS na Etapa 2 permanece resultado histórico, sem repetição sem hipótese nova. A documentação da [Microsoft sobre block cloning](https://learn.microsoft.com/en-us/windows/win32/fileio/block-cloning) descreve suporte e restrições em ReFS; não demonstra execução neste volume NTFS ou pelo helper usado pelo produto.

## Limites da exportação

`recovery-export` copia metadados Layers, índices e estado Git selecionado; não é clone de todos os objetos e não inclui automaticamente todos os arquivos do workspace. A extração retida em `transactions/<id>/materialized/` entra na árvore de metadados exportada. O temporário adjacente ao alvo e a edição C do workspace não entram automaticamente. Exportação completa dos itens configurados não prova que esses bytes externos foram incluídos. Se uma publicação interrompida deixou aliases ou edições somente no disco, preserve-os separadamente antes de intervenção manual.
### Alocação reportada pelo runtime

Quando o inventário usa `stats.blocks * 512`, mede a alocação de dados de arquivo reportada pelo sistema operacional neste runtime. A [libuv v1.51.0 para Windows, linhas 1772–1775](https://github.com/libuv/libuv/blob/v1.51.0/src/win/fs.c#L1772) obtém st_blocks de AllocationSize deslocado por nove bits; o [Node v24.14.1, linhas 97–106](https://github.com/nodejs/node/blob/v24.14.1/src/node_file-inl.h#L97) encaminha esse campo. A [Microsoft define AllocationSize em bytes](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntifs/ns-ntifs-file_stat_basic_information).

Esse número deve ser distinguido de tamanho lógico, bytes físicos de I/O e ocupação física única de extents. Não inclui automaticamente toda a infraestrutura do filesystem, MFT, streams alternativos ou efeitos de compartilhamento. Dois nomes do mesmo inode não devem duplicar a soma quando houver aliases transitórios. `stats.blksize` não é o multiplicador dos blocks: a [libuv o fixa em 4.096 como valor de I/O, linhas 1778–1794](https://github.com/libuv/libuv/blob/v1.51.0/src/win/fs.c#L1778), sem consultar o cluster nessa atribuição. A confirmação independente de cluster por Get-Volume tem recibo próprio e não deve ser inferida desse campo.

### Objetos ausentes e automatismo de recuperação

No GC agressivo de RECOVERY-013, o algoritmo atual também valida plan.tree B antes de iniciar rollback. A ausência dessa árvore impede concluir automaticamente A apesar do backup A válido; trata-se de regressão de automatismo ainda parcial, sem declarar A irrecuperável ou o bloqueio inerentemente necessário à segurança. O [rerun2 aceito](INFRA-MATRIX-RERUN2.json) comprovou status unsafe e duas recusas cat-file 128 preservando índice/disco B e evidências. Recovery-export não recria os objetos B podados nem inclui automaticamente o B do workspace. Nenhuma limpeza ou cache substitui essas dependências.