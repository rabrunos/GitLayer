> Auditoria posterior ao gate V6: a cópia por streaming recebeu mtime novo e pôde ocultar C no caso racy, inclusive com configuração padrão. O Git original detectou M; o V6 retornou diff limpo. O gate de 25 testes abaixo continua um fato histórico daquele snapshot, mas não cobriu esse caso e não autoriza publicar o V6. A correção de timestamp e os novos testes estão em implementação.

# Consulta de índices: efeito persistente e diagnóstico limitado

A investigação confirmou uma mutação inesperada do índice privado numa consulta e um problema separado no formatador de falhas do Node. **A correção Core por índice transitório passou no gate dirigido de 25 testes; o arquivo R-02/R-03 passou em seis testes separados. A campanha integral e a medição final permanecem PENDENTES.** Os fatos portáteis e hashes das evidências estão em [INDEX-QUERY.json](INDEX-QUERY.json).

## O que ocorreu

O teste original de 1200 caminhos falhou depois de Core.status terminar com safe=true. Na reprodução 01, status terminou em 5707,6431 ms e, cerca de 809 ms depois, o monitor externo já observava o processo próprio acima de 1 GiB. O JavaScript ficou bloqueado na formatação síncrona da asserção; seu timer interno deixou de capturar o crescimento, enquanto o Windows continuou observando alocação.

O pico amostrado do Node foi 82.298.068.992 bytes privados e 25.593.745.408 bytes RSS. No mesmo instante, Windows registrou 113.821.970.432 bytes committed para limite de 114.288.377.856 bytes (99%). O limite mudou durante a execução; valores de horários diferentes não foram combinados.

A árvore própria foi encerrada para preservar o host. A reprodução 01 permanece FAIL, sem resumo TAP completo. Na reprodução 02, um observador limitado manteve o oráculo byte a byte e apresentou FAIL normal: MAIN permaneceu igual; o índice privado de 144.101 bytes diferia a partir do offset 132. Node atingiu 120.918.016 bytes RSS nas amostras. Nenhuma dessas durações é benchmark de latência do produto. A execução isolada confirmou a alocação do processo próprio, sem atribuí-la a carga externa não controlada.

## Asserção: preservar o oráculo e limitar o erro

Na versão Node 24.14.1, a construção do erro inspeciona arrays integralmente, ignora o custom inspector do Buffer e prepara o diff antes de truncar a apresentação; até uma mensagem customizada de deepStrictEqual mantém essa rota. [Código primário do Node](https://github.com/nodejs/node/blob/v24.14.1/lib/internal/assert/assertion_error.js#L66). O algoritmo conserva uma cópia de Int32Array por nível de edição, permitindo crescimento elevado com muitos bytes diferentes. A relação com a alocação observada é inferida desse código e da localização da falha, sem executar novamente o formatador perigoso. [Implementação primária do diff](https://github.com/nodejs/node/blob/v24.14.1/lib/internal/assert/myers_diff.js#L32).

O novo [assertBytesEqual](../../../tests/helpers/assert-bytes.ts) compara todos os bytes com Buffer.equals. Hashes, comprimentos e primeiro offset servem apenas ao diagnóstico; o erro recebe booleanos, nunca os buffers. Foram migradas 48 comparações binárias explícitas dos novos testes, mantendo objetos, listas, modos e expectativas semânticas.

O controle intermediário executou 6 testes: 6 PASS, 0 FAIL, 0 SKIP, exit 0 e hashes inalterados dos três arquivos de entrada selecionados. O filho próprio apresentou mensagens de 276/286/289 caracteres e pico RSS de 63.979.520 bytes, com crescimento de 700.416 bytes. Muitas diferenças usam somente 256 B; 144 KiB e 1 MiB alteram um byte. Isso permite detectar regressão sem pedir ao antigo formatador um diff de megabytes totalmente diferentes. O limite de heap de 96 MiB não limita ArrayBuffers nem RSS; os limites RSS são observações verificadas depois da execução. A suíte final deve repetir esses controles.

## Git: a alteração foi de stat, mas continua sendo persistente

O Git oficial leu as cópias capturadas com ls-files --stage -v -z. Ambas produziram os mesmos 1200 registros, com mesmo path/modo/OID/stage/flags expostos nessa saída. A análise binária encontrou 1198 entradas com stat diferente: 20.282 bytes nesses campos e 20 bytes de checksum; nenhum outro byte mudou e os 69 bytes de extensões permaneceram iguais. O formato do índice contém esses campos de cache além dos objetos preparados. [Formato oficial](https://git-scm.com/docs/index-format#_index_entry).

A fixture preparou o índice com read-tree e materializou arquivos com checkout-index sem -u, deixando stat vazio nos arquivos A. A consulta diff compara conteúdo, detecta stat divergente e pode atualizar esse cache no índice. A rota observada no Git 2.53 segura lock e escreve o índice após a consulta, sem consultar GIT_OPTIONAL_LOCKS nessa rota. [Código primário do Git](https://github.com/git/git/blob/v2.53.0/builtin/diff.c#L222).

A igualdade semântica explica a alteração; não autoriza reduzir a expectativa de bytes. A [prévia declara readOnly](../../../src/core/index.ts) e a [contraprova R-03](../../../tests/integration/review-target-preview.test.ts) preserva índices e metadados. Uma consulta que publica stat viola esse alcance mesmo sem alterar blobs preparados.

## Alternativa descartada e correção candidata

O probe usou quatro cópias independentes, sem alterar capturas nem repositório original:

| Imagem de partida | diff.autoRefreshIndex | Índice permaneceu igual | Caminhos M |
| --- | --- | --- | ---: |
| stat vazio capturado antes | padrão | não | 2 |
| stat vazio capturado antes | false | sim | 1200 |
| stat atualizado capturado depois | padrão | sim | 2 |
| stat atualizado capturado depois | false | sim | 2 |

Todos usaram GIT_OPTIONAL_LOCKS=0 e Git retornou 0. Desabilitar autoRefreshIndex isoladamente produz falsos modificados no estado com stat vazio; por isso a flag não foi adotada como correção. A documentação descreve o tratamento de mudanças apenas de stat e seu default verdadeiro. [Documentação primária](https://github.com/git/git/blob/v2.53.0/Documentation/config/diff.adoc#L1).

A candidata [index-query.ts](../../../src/core/index-query.ts) fornece ao diff oficial uma cópia independente de índice em temporário externo, com marcador/nonce, validações de hash/identidade/modo/locks e revalidação da origem antes/depois. Somente a cópia recebe o refresh nativo. Não há cache permanente, hardlink, symlink, mudança global ou alteração do Git nativo do usuário. Estado desconhecido e falhas de limpeza preservam evidências e retornam diagnóstico. O gate dirigido de 25 testes terminou com 25 PASS, zero FAIL/SKIP/cancelamento e fontes inalteradas; a campanha integral e a medição final continuam PENDENTES.

O custo adicional inclui copiar/ler o índice, publicar recibos e verificar/limpar o temporário; stat antigo pode exigir ler conteúdo novamente. O tamanho do índice escala com caminhos, separadamente do tamanho dos blobs. Ganhos de desempenho não são prometidos para essa correção de integridade. O caso de 1200 caminhos passou no gate dirigido, incluindo status e diff padrão, preservação de bytes e argv limitado. Sua duração de teste não será apresentada como benchmark do produto.