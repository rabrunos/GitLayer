# Decisões técnicas — Etapa 2B

## Critério

Integridade e compatibilidade precedem ganho de tempo. A baseline é `e8f2e3feba87224246a42337f77f702914df989e`; medições completas identificam suas fontes próprias em [BENCHMARKS](BENCHMARKS.md). Resultados da Etapa 2 são históricos e não substituem o controle congelado desta campanha. Nenhuma medição de movimentação isolada é apresentada como ativação completa.

## A — Journals

Adotado journal incremental com eventos tipados nos pares backup/plano e AFTER, mantendo as barreiras duráveis existentes. O manifesto schema 2 aponta para log e watermark; sequência, ID da transação, checksum e encadeamento verificam o plano. O watermark de tamanho fixo comprova a extensão confirmada, de modo que truncar registros inteiros ou deixar append sem confirmação não pode produzir aceitação silenciosa de um prefixo antigo. Falha parcial deixa o writer recusado para não esconder evidência com um checkpoint de erro.

Registros genéricos de revogação, V05, D-03, diretórios, commit e troca de branch continuam snapshots completos. A seleção de deltas usa a identidade das estruturas do contexto; os BEFORE do Core são imutáveis e as mudanças de outros campos usam atribuição ou registro genérico explícito. Isso não é um algoritmo geral de diff para modificações arbitrárias e simultâneas de `Transaction.data` por terceiros.

`finish` publica schema 1 completo, evitando replay do histórico de eventos concluído. O checkpoint de falha novo usa schema 2 inline com checksum: um Core antigo precisa recusá-lo, pois ignorar os novos testemunhos de identidade de recuperação seria inseguro. O leitor atual normaliza ambos para a representação interna schema 1. Eventos antigos permanecem retidos, não apagados. Uma transação que continua gravando durante rollback/checkpoint após esses métodos atualiza o snapshot autoritativo na versão correspondente ao seu estado. Journals antigos schema 1 não são migrados nem reescritos pela inspeção. O limite materializado de 64 MiB permanece; o log tem limite próprio de 256 MiB. A redução de bytes regravados e as contagens de sync/barreiras devem ser lidas nas amostras, sem atribuir toda a latência da API aos journals.

| Alternativa de journal | Decisão nesta etapa |
| --- | --- |
| Snapshot completo por arquivo | Substituído nas duas rotas dominantes; os bytes regravados cresciam com o plano já acumulado. Mantido nos registros genéricos e na conclusão. |
| Append sem watermark | Rejeitado: uma cadeia válida restante não comprova que registros completos não foram retirados do fim. |
| Deltas, watermark fixo e checkpoint final | Adotado; reduz a serialização repetida e conserva as mesmas fronteiras de confirmação. Gravação rasgada exige recusa, sem escolher um prefixo como recuperação concluída. |
| Snapshots periódicos adicionais | Não adotados sem benefício demonstrado; o checkpoint concluído já evita replay do histórico operacional, e os passos genéricos preservam snapshots quando necessários. |
| Preparar planos em lotes antes dos efeitos | Alternativa possível para estudo próprio, mas não implementada: exige demonstrar a autoridade e a recuperação de cada composição parcialmente publicada. Não equivale a adiar os registros atuais de backup, revogação ou AFTER. |
| Retirar ou postergar flush para reduzir tempo | Rejeitado quando enfraquece as barreiras aprovadas; uma chamada concluída precisa continuar aguardando sua confirmação durável. |

### Container único: análise não adotada

A [medição intermediária](BENCHMARKS-INTERMEDIATE.md) encontrou 6,269 s inclusivos em sincronizações do journal, dentro de 19,450 s de persistência na primeira ativação de mil arquivos. A persistência também valida caminhos, identidades, manifesto e watermark; não se atribui todo esse tempo ao flush.

Foi analisado um container com watermark de 512 bytes e registros no mesmo arquivo, conservando cada barreira. Um único FD em append não permite atualizar o cabeçalho posicionado no Linux; retirar O_APPEND poderia sobrescrever um append externo tardio. Essa restrição é documental, sem execução Linux. [Node 24.14.1](https://github.com/nodejs/node/blob/v24.14.1/doc/api/fs.md#filehandlewritebuffer-offset-length-position).

Dois descritores para o mesmo inode exigiriam prova própria de escrita, flush, identidade e interrupção. A API Windows descreve o flush das informações do arquivo, mas isso não certifica o protocolo proposto. [FlushFileBuffers](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers). Essa alternativa não foi implementada nem introduziu outro schema: a superfície adicional de codec, compatibilidade e falhas não tem benefício comprovado nesta etapa. As barreiras atuais permanecem.

### Buffer de leitura proporcional: implementação dirigida

O buffer de `consumeRegular` passa a respeitar o tamanho observado pelo FD, com mínimo de um byte e teto de 256 KiB. Hash, limites, EOF, modos, identidade, timestamps e fechamento do FD permanecem. O crescimento além do tamanho aberto recebe recusa antes de hash/consume, evitando percorrer um crescimento grande em blocos de um byte. O limite `maxBytes` continua sendo verificado primeiro. Um crescimento percebido antes desse limite pode agora produzir `EXTERNAL_CHANGE` mais cedo, em lugar de alcançar posteriormente `METADATA_INVALID`.

A variante isolada passou nos 24 casos de armazenamento; o teste portado para o repositório também passou nos seus próprios 24 casos. São campanhas distintas, sem somatório. O erro inicial do loader e a primeira tentativa com 23 PASS/um FAIL de injeção Windows foram preservados. A tentativa ajustada substitui de fato o caminho entre o lstat e a abertura, exigindo o diagnóstico preciso e preservando C; o EPERM anterior não foi convertido em prova dessa guarda.

No A/B histórico V7, anterior às correções de integridade, de mil arquivos, a primeira ativação observada foi 48,586→47,320 s (n1), e as medianas de desativação/reativação foram 48,319→46,977 s e 45,542→44,679 s (n3 na mesma fixture por variante). São diferenças modestas, sem significância estatística demonstrada. Bytes/syncs do journal e espaço final permaneceram iguais. O RSS não caiu em todas as operações; não se promete redução universal de memória nem se confunde capacidade solicitada com RSS. A implementação foi incorporada após essa prova dirigida e revisão; a validação final e sua ligação de fontes estão nas campanhas completas de [RESULTS](RESULTS.md).

## B — Rename e publicação do arquivo extraído

**Rename direto do prefixo extraído não foi adotado.** A API `fs.rename` disponível no runtime não oferece flag de não substituição. No Windows, a fonte exata da [libuv v1.51.0](https://github.com/libuv/libuv/blob/v1.51.0/src/win/fs.c#L2109) chama `MoveFileExW` com `MOVEFILE_REPLACE_EXISTING`. A [API Node versionada](https://github.com/nodejs/node/blob/v24.14.1/doc/api/fs.md#fspromisesrenameoldpath-newpath) não acrescenta um modo no-replace. A reprodução do Core confirmou que verificar ausência e depois chamar essa operação permitia perder C criado no intervalo.

O Windows possui primitivas de movimento sem substituição quando a flag de substituição é omitida, mas o contrato de arquivo/diretório, permissões, share modes, volume e persistência precisa ser preservado. `MOVEFILE_COPY_ALLOWED` pode transformar movimento entre volumes em cópia+remoção e até retornar sucesso mantendo a fonte; esse comportamento não pode ser confundido com um rename único. `MOVEFILE_WRITE_THROUGH` descreve flush e não torna atômica a composição de uma Layer. [Contrato oficial MoveFileExW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw).

Linux documenta que rename comum pode substituir o destino; `renameat2(RENAME_NOREPLACE)` oferece recusa condicionada ao suporte do filesystem. O Node do projeto não expõe essa flag. Essa conclusão é documental; não houve execução Linux. [Manual upstream de rename](https://man7.org/linux/man-pages/man2/rename.2.html).

**Adotada correção de integridade:** publicar uma cópia independente e durável já pronta por `link` que recusa EEXIST, conferir identidade e retirar o nome temporário. É uma reivindicação transitória de nome, sem hardlink como cópia, backup ou cache; o sucesso deixa uma única ligação. O índice, o hash capturado da fonte e as barreiras anteriores permanecem. A rota foi aplicada também à restauração de um destino ausente. Não há fallback de substituição em falha dessa primitiva. O módulo é pequeno e usa apenas APIs nativas já disponíveis, sem addon, daemon ou subprocesso por arquivo.

A janela entre os dois nomes é explicitamente conservadora: uma interrupção mantém bytes e journal, podendo exigir inspeção manual. Não foi acrescentado um protocolo de recuperação de aliases para obter ganho marginal de tempo. A promessa corrigida é não substituir um nome criado no intervalo da publicação de um destino ausente. Substituições de arquivos que já existiam mantêm a fronteira anterior de fingerprint+rename, sem CAS nativo universal.

### Por que não mover diretamente a extração usando o mesmo link transitório

Recusar substituição de nomes e isolar os bytes da fonte são propriedades diferentes. O [probe de descritor de fonte retido](SOURCE-HANDLE-PROBE.json) comparou três operações em uma fixture nova própria, com payloads sintéticos de 64 bytes: `publishNewFile` aplicado diretamente ao arquivo extraído, `fs.rename` comum e a rota `copyRegular` para temporário independente seguida de `publishNewFile`. Em cada caso, um descritor `r+` da fonte foi aberto **antes da validação**, permaneceu aberto durante a publicação e só recebeu a escrita posterior depois de o destino já ter o hash original confirmado.

Tanto link+unlink direto quanto rename conservaram o mesmo inode no destino. A escrita posterior pelo descritor antigo alterou o arquivo publicado, mesmo com o nome da fonte ausente e `nlink === 1`. Na rota com cópia independente, o descritor antigo alterou somente a extração: o destino continuou com o hash original em outro inode. Portanto, trocar apenas a chamada rename por link+unlink da extração resolve a disputa pelo nome ausente, mas **não conserva essa fronteira de isolamento da fonte preparada**.

São três observações de semântica de filesystem neste Windows/Node, sem ativação completa, ganho de desempenho ou certificação universal. A cópia também exige as validações já descritas e não impede escritores que tenham acesso ao próprio temporário independente ou ao destino. Um projeto futuro que elimine a cópia precisaria demonstrar uma fronteira adequada de exclusão de escritores e handles da fonte, além de não substituição, modos, persistência e recuperação; este probe não prova impossibilidade de tal projeto nem autoriza adotá-lo. Nenhuma extensão nativa ou mudança de Core foi introduzida para esse experimento.

## C — Projeção limpa reutilizável

**Não adotada como cache do produto.** Um cache correto precisaria vincular bytes, modos, índice atual, OID solicitado, propriedade e plano de recuperação, revalidando todos antes do uso. Mudança externa de ref, divergência ou tracking remoto atualizado não autorizaria adotar outro commit. Falta de cache nunca poderia impedir a extração Git convencional.

A operação continua sem cache físico; primeira ativação e reativação convencional têm rótulos separados. Casos de cache ausente/inválido/parcial não são classificados como suporte executado de uma função inexistente. Não existe ganho de cache demonstrado ou número de reativação com cache a divulgar. A otimização de journals atua em operações completas sem exigir esse armazenamento adicional; não foi criada uma arquitetura maior sem benefício demonstrado.

## D — Diretórios inteiros

**Não adotados no caminho físico.** Diretórios compartilhados por origens, arquivos ignorados e criações externas impedem inferir exclusividade pelo prefixo do nome. Mesmo um inventário exclusivamente da Layer pode ficar obsoleto: a contraprova isolada acrescenta um arquivo externo depois do inventário e mostra que o rename de diretório também o transporta. Esse teste demonstra uma insuficiência do algoritmo proposto, não suporte de movimentação de diretórios pelo Core.

A remoção atual de diretórios usa somente `rmdir` de diretórios vazios com identidade validada e plano recuperável. Não foi substituída por rename recursivo nem foi imposta estrutura de pastas ao usuário. Um protocolo futuro de posse/reserva de diretório e transferência precisaria resolver esses interleavings antes de ser usado.

## E — Reflink e cópias

**Conservado streaming com cópia independente, hash, identidade, modo e flush.** A [extração oficial por checkout-index](https://git-scm.com/docs/git-checkout-index) continua gerando a imagem privada do índice solicitado. A segunda cópia não foi removida por assumir que extração anterior permanecia íntegra: o teste de modificação da fonte preparada exige recusa antes de publicar seus bytes alterados.

Não houve nova evidência de suporte físico a reflink no ambiente desta campanha. O ENOSYS anterior de FICLONE_FORCE não foi repetido sem hipótese nova; sucesso com FICLONE e fallback continua sem provar CoW. Não se publicou um resultado Linux/ReFS não executado. Hardlinks permanentes e symlinks permanecem recusados. O link transitório usado para publicar o temporário já independente não muda essa decisão.

## F — Temporários e retenção

**Adotada retirada restrita da nova extração `materialized/` depois de sucesso durável**, com inventário, identidade/hash/modo, verificação do journal durável, ausência de dependências e remoção exata. Alterações ou extras conservam os dados. Falhas de limpeza produzem recibo quando possível e não disparam rollback de uma transação já concluída. O custo completo entra no tempo da API.

Não foram apagados journals antigos, eventos retidos, backups, refs técnicas, shelves, caches desconhecidos, demonstrações ou dados reais. Não existe política automática de retenção de histórico. Os detalhes e limites de espaço lógico/físico estão em [STORAGE.md](STORAGE.md).

## Normalização de caminhos sem cache de disco

`safePath` calcula uma vez a chave de comparação do componente solicitado, uma string imutável, por enumeração atual de irmãos. A consulta continua lendo todos os nomes atuais e conferindo links, identidades e aliases; não guarda listas mutáveis entre caminhos ou comandos. Isso elimina normalizações repetidas do mesmo argumento sem reduzir a verificação física. O [microexperimento de strings](PATH-KEY-MICRO.json) conserva contagens e amostras com ruído, inclusive pioras individuais; seus milissegundos não são ativação completa. O custo de enumerar diretórios com grande fanout continua podendo crescer quadraticamente. A contribuição sobre operações completas exige a ablação separada do benchmark.

## Observação, teste e suporte

A campanha local confirmou Node v24.14.1/libuv 1.51.0, Windows x64, NTFS e cluster de 4 KiB. A prova de publicação concorrente falhou na baseline e passou após a correção; o [recibo dirigido](PUBLICATION-FOCUSED.json) conserva as campanhas anteriores, inclusive a falha real de fsync e a regressão corrigida de escape do handshake de teste, sem somar denominadores ou certificar fontes posteriores. Interrupções controladas, repetição de recovery e morte de três filhos próprios conservaram os planos/locks e recusaram estados incertos. Erros sintéticos de permissão e ENOSPC não são ACL física, disco real cheio ou certificação de perda de energia. Posteriormente, o [dirigido de três casos](COPY-FAILURE-FOCUSED.json) observou também recusa EXDEV real em C:/D: distintos, com fontes preservadas; isso é recusa testada, não suporte de movimentação entre volumes. O caso real Windows de FileShare.None cobre recusa de publicação com fonte bloqueada; o resultado final executado deve constar em [RESULTS](RESULTS.md).

Os testes dirigidos pertencem a `publication.test.ts`, `disposable-projection.test.ts` e `publication-race.test.ts`; a declaração final de aprovação depende da campanha identificada em RESULTS. Uma suíte de desempenho aprovada não autoriza dizer que os interleavings não executados são seguros.

## Vínculo da extração ao conteúdo Git

A [contraprova](MATERIALIZED-SOURCE-REPRO.json) confirmou que aceitar o primeiro hash físico sem vínculo ao blob permitia adotar C após a extração de A. A correção calcula SHA-256 físico e OID de blob no mesmo FD, usando o [cabeçalho de objeto Git](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects) e os algoritmos SHA-1/SHA-256, verificados contra `git hash-object --no-filters`. Nenhum objeto, ref ou banco novo é criado por esse cálculo. O OID solicitado continua vindo do índice Git independente validado.

O envelope aceita os bytes brutos do blob A ou uma representação convertida de A conferida pela [saída nativa de cat-file --filters](https://git-scm.com/docs/git-cat-file). Isso admite LF canônico mesmo quando a extração configurada usou CRLF, sem aceitar conteúdo Git C semanticamente diferente. O fallback recebe OID e caminho fixos, desabilita filtros externos, hasheia stdout até EOF/código 0 e compara com o hash físico capturado antes. O hash da fonte não é atualizado para legitimar uma alteração posterior. O [dirigido de 50 casos](MATERIALIZED-FOCUSED.json) tem fontes e resultado próprios, anteriores à correção posterior de refs; não equivale à full.

O [batch filtrado foi rejeitado](CATFILE-BATCH-PROBE.json): no Git executado, o header informou 11 bytes brutos e o corpo CRLF teve 13. Os programas de investigação que pressupunham igualdade falharam, embora o comando Git tenha retornado 0. Não se incorporou um parser binário que suponha tamanho convertido no header. O fallback individual evita esse framing, mas pode acrescentar um subprocesso por arquivo convertido. Node não retém o corpo inteiro; isso não limita a memória usada pelo próprio Git para conversão.

## Referências simbólicas e locks nativos

As escritas de refs usam o protocolo de transação do próprio Git. O [manual de update-ref](https://git-scm.com/docs/git-update-ref/2.50.0) define `prepare` para adquirir locks e `abort` para liberá-los. A observação de tipo precisa ocorrer enquanto esses locks estão retidos: CAS por OID e `--no-deref` isolados aceitam uma referência simbólica com o mesmo OID resolvido. No protótipo executado, `--no-deref` preservou a tag de destino, mas substituiu o alias; essa alternativa isolada foi rejeitada.

O helper prepara as operações nativas tipadas, consulta `symbolic-ref --quiet --no-recurse` para cada ref envolvida e somente autoriza `commit` se todas forem diretas. Um alias provoca abort nativo, preservando alias e referent. Mantém OIDs esperados, criação com ausência explícita, mensagens de reflog e a transação conjunta já usada em rename. Guardas atuais de tipo também cercam ativação, staging e recuperação. Não existe interceptador para Git direto, remoção automática de locks ou garantia contra um escritor que altere arquivos internos ignorando os locks do Git. A validação funcional posterior ainda é exigida em RESULTS.

## GC agressivo e automatismo de recuperação

A [primeira campanha da matriz dirigida](INFRA-MATRIX-DIRECTED.json) preserva cinco PASS e dois FAIL. Em RECOVERY-003, o novo teste confundiu a etapa `failed` com o estado contratual `recovery-required`; esse erro do oráculo não altera o produto. Em RECOVERY-013, o Git recusou publicar uma árvore B que o GC podou antes da ref de retenção. O índice B, o arquivo B e o backup A válido permaneceram, com checkpoint A e transação pendente. O antigo oráculo esperava rollback A e estado saudável; essa capacidade automática não ocorreu na implementação atual.

O validador verifica também a disponibilidade nativa da árvore B do plano antes de entrar no rollback. Não foi suprimida essa verificação para produzir um PASS ou mascarar a ausência do objeto. O bloqueio atual não demonstra que restaurar A seja impossível nem que a segurança exija inerentemente essa limitação; é uma regressão observada do automatismo e permanece explícita nos limites. A receita posterior envelhece blob e árvore B na fixture isolada porque o protocolo novo já cria a árvore antes da publicação do índice. Os oráculos posteriores exigem recusa, preservação dos bytes/refs/backups e ausência de falso estado saudável; só sua execução própria pode atestá-los. O catálogo original, os relatórios e os primeiros FAIL não são reescritos.

## Fechamento medido do Core corrigido

A campanha final usa Core22/807 e fonte funcional234/c5f919. A full V10 foi executada em 234/1c0646; somente a receita de RECOVERY-011 mudou depois, com [prova de escopo](SOURCE-TRANSITION-PROOF.json), dirigido próprio e nova broad inteira. O [FAIL V10](VALIDATION-BROAD-V10.json) não foi convertido em PASS. O [port estrito](RECOVERY-011-PORT.patch) acompanha a primeira recusa física EBUSY/exit3 anterior à transação e acrescenta preimages/identidades/fsck; Core e CLI não foram modificados para satisfazê-lo.

O journal incremental foi mantido por eliminar a regravação quadrática dominante, preservando cada barreira e a leitura legada. Na primeira ativação 1k, bytes JS conhecidos escritos caíram1193130811→3850859, enquanto syncs de arquivo aumentaram2013→4024. Persistência inclusiva caiu22,237→16,174s; o tempo total first subiu39,202→41,639s, off mediano caiu47,934→41,122s e react mediano subiu36,613→39,486s. Não se atribui o resultado total somente ao journal: as guardas de integridade acrescentaram cópias, hashes e subprocessos. Os logs retidos também aumentaram9,73→30,43MB nesse endpoint. Não é uma otimização universal de disco ou latência.

Rename direto, cache físico e diretórios inteiros não foram incorporados por falta de prova conjunta de segurança/benefício. Reflink não teve suporte novo demonstrado. A cópia independente com reivindicação sem substituição é a rota adotada para nome ausente, não uma promessa de CAS universal sobre destino existente. A meta10k<5s não foi atingida:412,129s na primeira ativação completa n1. [Dados finais](BENCHMARKS.md).

Os programas [postprocessor](postprocess-final-benchmarks-transition.mjs) e [verificador de escopo](verify-source-transition.mjs) são artefatos técnicos versionados em conjunto, com os hashes exatos usados na campanha. Não fazem parte do runtime. Para repetir o pós-processamento exato é necessário o corpus bruto privado identificado no recibo; os resultados públicos permitem revisar amostras, fórmulas, fontes e hashes sem publicar fixtures ou logs privados. Não se apresenta esse corpus local como disponível pelo GitHub.
