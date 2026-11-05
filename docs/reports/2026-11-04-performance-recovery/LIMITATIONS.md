# Limitações restantes

## Estado e requisitos

A validação local executada inclui full V9 com 415 resultados/411 PASS/quatro SKIP, infraestrutura V11 com 113 PASS/113 e matriz V11 com 361 selecionados/355 PASS/seis ENV_BLOCKED/zero FAIL. Typecheck/build/smoke V9 passaram sobre o mesmo Core/runtime/corpus comprovados por equivalência V9/V11. Os FAIL anteriores e o HALTED/quiet=false original continuam preservados; na matriz V11 o fechamento independente foi aceito, mantendo nested quiet=false como observado. O fechamento da entrega ainda está **PENDENTE**: cópia nova do commit, auditoria/publicação final e igualdade GitHub não foram atestadas. Nenhuma dessas aprovações amplia automaticamente suporte ou promove requisitos. [Resultados e escopos](RESULTS.md).

A classificação permanece em **20 implementados e sete parciais: GL-01, GL-09, GL-15, GL-18, GL-19, GL-20 e GL-22**. GL-19 avança em diagnóstico independente e testes de interrupção; não recebe fechamento integral. Suporte do produto, caso implementado, seleção executada e resultado de teste são dimensões distintas.

## Desempenho e materialização

As operações continuam observando configuração, objetos, refs, índices, propriedade, controles e arquivos. Não há promessa universal de centenas de milissegundos. Materializar dados exige leitura, escrita, hashes e flush; bytes físicos de disco e efeitos do cache do sistema não são inferidos dos bytes lógicos. O cache de árvores por OID é limitado à mutação coordenada e não substitui observações atuais de estado mutável.

Journals completos ainda são serializados repetidamente por arquivo, e todos os journals retidos são lidos na busca de pendências. Varreduras conservadoras, quantidade de arquivos e histórico acumulado continuam custos de escala. Não houve expurgo automático nem retirada de backups para aparentar rapidez. Os números e as escalas efetivamente concluídas devem ser consultados em [BENCHMARKS.md](BENCHMARKS.md), sem extrapolar cenários não executados.

A campanha V9 concluiu nove pares, mas não sustenta latência uniforme. Com uma Layer/dez arquivos, as medianas foram 3,284 s para on e 3,535 s para off; com 1.000 arquivos, as observações únicas continuaram em 37,198 e 49,111 s. Dez Layers, cem arquivos de Layer e alvo de dez arquivos levaram 9,335 e 8,909 s, com as outras nove Layers ativas. Em 2/5/10 Layers o total nas Layers é cem arquivos e o alvo contém 50/20/10; não há volume movimentado constante.

Sem Layers, recover-empty piorou de mediana 282,978 para 348,117 ms em três amostras (+23,019%; MEASURED_HIGHER_LATENCY). Cinco Layers também tiveram pioras n1: on +3,7%, status +40,0% e on-repeat +18,2%, apesar de menos subprocessos Git. A memória amostrada do worker também subiu nesse caso. Em 100 MiB, o RSS do worker caiu de cerca de 399 para 69 MiB, mas on/off ainda levaram 3,608/4,737 s. Esses pares únicos não estabelecem distribuição ou causa individual. Não se atribui ao código uma diferença de tempos entre as campanhas V6 e V9.

Os dois endpoints V9 de 10.000 arquivos terminaram TIMEOUT_OWNED no limite de vinte minutos, incluindo setup; não há on/off completos nem delta pareado nessa escala. [Todos os dados incompletos](benchmarks/cases/layers1-files10000.json) permanecem preservados. Limite de endpoint não é latência do produto. Fixtures, journals e locks não foram limpos ou recuperados para aparentar sucesso.

O perfil de 1.000 arquivos ainda mostra dezenas de segundos em métodos de publicação/remoção e milhares de chamadas de journal. As durações são inclusivas e não se somam. O método backupTracked não foi envelopado, portanto zero/ausência de backup no profiler não prova ausência de cópias ou persistência. Hashing, fsync e varreduras não têm decomposição exclusiva. Bytes físicos de IO, descendentes do Git e RSS dos filhos não foram medidos; RSS do worker e fronteiras de tamanho de disco podem perder picos.

Um ciclo específico de alternância entre Layers diferentes não foi medido separadamente. Paralelismo físico permaneceu em avaliação estática, sem ganho medido ou adoção; não houve cache frio do SO. As medições anteriores continuam nos [históricos V6](BENCHMARKS-INTERMEDIATE-V6.md) e [V3/V4](BENCHMARKS-INTERMEDIATE-V3-V4.md), sem mesclar amostras. O [índice V9](BENCHMARKS.json), a [prova de conservação](BENCHMARKS-SHARDS.json) e a [auditoria dos artefatos](BENCHMARKS-PRIVACY-AUDIT.json) não substituem as provas próprias da full concluída nem os demais gates ainda pendentes.

Troca de branch e shelves legadas ainda usam snapshots base64 sujeitos ao limite de 64 MiB do JSON. A redução de memória cobre ativação/desativação normal, fingerprints, backups e restauração de backups; não converte o formato legado nem certifica todas as operações com arquivos de qualquer tamanho.

Uma cópia por streaming pode conservar arquivo parcial em caso de erro. Falha anterior ao registro completo pode deixar artefato técnico que não constitui backup autorizado para restauração. O protocolo continua recusando plano incompleto. A comparação do hash da fonte privada preparada, antes do rename de ativação, evita aprovar silenciosamente bytes posteriores dessa fonte.

`COPYFILE_FICLONE_FORCE` retornou `ENOSYS` no runtime/volume NTFS medido. O fallback produziu cópias independentes, mas não demonstrou CoW físico. O resultado não exclui APIs nativas ou volumes não testados. ReFS e Linux não foram executados nesta campanha, e nenhum link foi adotado como materialização.

A full conservou três SKIP por falta de permissão de symlink e um para roundtrip Bash do host; seus [motivos exatos](FULL-V9-RESULTS.json) não foram transformados em PASS ou ENV_BLOCKED. Essa execução não amplia o suporte às operações omitidas. A [auditoria](FULL-V9-PRIVACY-AUDIT.json) e a [classificação](FULL-V9-PRIVACY-CLASSIFICATION.json) tratam os caminhos técnicos das evidências, sem apagar os originais.

RECOVERY-003/external-ref-after-observed-preflight passou na matriz como caracterização e conserva **PENDING_PRODUCT_SPEC**: o stage pode retornar sucesso após a ref externa avançar, preservando ref e stage; uma observação posterior diagnostica a relação stale. Isso não prova serialização universal com Git externo. RECOVERY-005/006/007 são PASS com DOCUMENTED_RESTRICTION: preservar bytes/refs/journals e recusar lock órfão não é recuperar esse lock automaticamente.

## Estados que podem exigir inspeção manual

| Estado | Resposta conservadora e limite |
| --- | --- |
| V05: BEFORE físico ausente e caminho atual ausente | `workspace-materialization-disappeared`; a ausência pode representar interrupção anterior à escrita, movimento externo ou rollback parcial. Não se escolhe uma explicação nem se repõe autorização antiga. |
| Arquivos, refs ou índices posteriores incompatíveis | Preservar o estado externo e as evidências; não sobrescrever para encaixar o plano. O diagnóstico de imagem atual não certifica todos os contextos de ref/HEAD. |
| Backup ausente ou alterado | Recusar a restauração que não possa provar seus bytes/modos. Uma cópia parecida não recebe autoridade por semelhança. |
| JSON, schema ou plano inválido/incompleto | Conservar metadados e artefatos, sem reinicializar estado vazio. `doctor`/exportação independentes continuam úteis quando o Git ainda consegue descobrir o repositório. |
| Lock real, disputado ou órfão | Preservar o lock. Aparência de PID antigo não prova autorização para removê-lo. Término abrupto testado com lock preservado não é recuperação automática concluída. |
| Ambiguidade de propriedade | Exigir decisão explícita com contexto atual. Resolver propriedade não dispensa um journal pendente nem a barreira de recovery. |

Nenhuma dessas recusas autoriza apagar journal, backup, índice, ref privada ou lock para aparentar integridade. Uma recusa tardia pode ocorrer após efeitos parciais em metadados; não promete ausência global de efeitos. Exportação é evidência, não reparo nem clone completo dos objetos Git. Dados nunca preparados, copiados ou persistidos não são recuperáveis por promessa do produto.

## Envelope e próxima fase

Esta etapa não certifica todas as versões Git/Windows, todos os filesystems, reparse points ou políticas de caminho. Os experimentos desta campanha são Windows x64; não ampliam suporte a Linux ou worktrees arbitrárias. Filtros externos, LFS, sparse/partial/shallow e demais restrições existentes continuam no [envelope do Core/CLI](../../LIMITATIONS.md).

Perda real de energia não foi executada. Exceções sintéticas EIO/EPERM/EACCES/ENOSPC, falha real de I/O por lock de arquivo e término abrupto de filhos próprios são experimentos distintos. Não houve exaustão do disco real, morte de processo alheio ou migração de dados reais.

A próxima fase de preparação para uso público precisa tratar, dentro de autorização própria:

- Concluir instalação em cópia nova, auditoria/publicação final e igualdade do commit publicado. Infraestrutura e matriz inteira V11 já foram executadas separadamente; o FAIL da matriz V10 (354 PASS/um FAIL/seis ENV_BLOCKED em 361) permanece preservado. A infraestrutura posterior V10 passou em 113/113. O FAIL V9 permanece registrado; a full415 pertence ao fingerprint V9, embora runtime/Core/CLI não tenham mudado.
- Limites de escala, latência e crescimento do histórico de journals/backups durante uso prolongado.
- Procedimentos operacionais para triagem, exportação e intervenção manual nos estados conservadores descritos acima.
- Envelope de versões e ambientes Windows declarado com base no que foi executado, incluindo interferência externa e filesystem.
- Retenção e exposição de dados sensíveis em backups/journals, que não têm expurgo automático ou criptografia própria.
- Forma de distribuição e requisitos de runtime do Core/CLI. Instalador, assinatura, release pública e deploy não foram implementados nesta missão.

Esses pontos impedem declarar prontidão pública apenas por otimizar o Core. A preparação para a próxima fase pode avançar com esses limites explícitos. Cópia nova, auditoria e publicação ainda podem revelar impedimentos; nenhuma aprovação futura nem prontidão pública ampla é antecipada.
