# Auditoria de integridade: desativação concorrente e índice transitório

Esta revisão encontrou quatro famílias de problemas antes da publicação: desativação concorrente, consulta por índice transitório, staging em duas fronteiras e restauração de índice. Desativação, staging e restauração foram reproduzidos na baseline `d71ccc7d188500a22e56ea93c70ac946dba9db60`; a consulta falsa limpa foi uma regressão da primeira implementação V6. Os processos dos repros terminaram com código zero porque reconheceram os defeitos esperados; isso **não é PASS do produto**. As correções candidatas posteriores precisam de nova validação.

Os resultados de desempenho de `f72502ad…` permanecem como [medições intermediárias V6](BENCHMARKS-INTERMEDIATE-V6.md), sem certificar as fontes corrigidas. Os resultados estruturados desta investigação estão em [INTEGRITY-AUDIT.json](INTEGRITY-AUDIT.json).

## Edição posterior removida pela desativação

O caminho anterior provava que a Layer estava limpa e só depois capturava a imagem física utilizada na remoção. Um editor podia gravar C entre essas observações. O Core aceitava C como imagem esperada, copiava C para o backup técnico e removia o arquivo. A Layer ficava inativa, sem descarte solicitado. A cópia de C persistiu, mas o trabalho posterior saiu silenciosamente do workspace.

O harness envolveu somente `changes` da instância da fixture. Primeiro aguardou o método real executar o Git oficial e devolver `staged: []` e `unstaged: []`; em seguida gravou C e devolveu esse resultado limpo para `deactivate`. Não houve mock do Git nem mudança das fontes.

```ts
const original = internal.changes;
internal.changes = async function (layer) {
  const clean = await original.call(this, layer);
  if (layer.name === 'race' && !injected) {
    assert.equal(clean.staged.length, 0);
    assert.equal(clean.unstaged.length, 0);
    fs.writeFileSync(target, bytesC);
    injected = true;
  }
  return clean;
};
await app.deactivate('race'); // sem discard
```

| Fonte observada | Processo | Desativação | Bytes posteriores | Recover repetido |
| --- | --- | --- | --- | --- |
| current-v6 imutável, Core `aab51227…` | Exit 0, sem timeout | Sucesso; inativa | C removido; backup exato de C | Duas chamadas: `recovered: []`; C continua ausente |
| Baseline imutável `d71ccc7…` | Exit 0, sem timeout | Mesmo defeito | Mesmo comportamento | Mesmo comportamento |

Em ambas as execuções, HEAD, refs, árvores e conteúdos commitado/preparado A ficaram preservados. Os índices MAIN e privado também ficaram byte a byte idênticos. O journal terminou `completed`, com BEFORE correspondente a C e AFTER ausente. Uma cópia técnica não equivale a uma shelf deliberada nem autoriza essa retirada.

A correção candidata captura o plano físico **antes** da prova de limpeza e revalida **todas** as imagens antes da primeira exclusão. Cada remoção continua comparando a imagem esperada para detectar edição posterior durante o loop. Descarte explícito tampouco autoriza adotar edição mais nova que o plano capturado.

Os [quatro testes novos](../../../tests/integration/deactivation-concurrency.test.ts) cobrem: C depois de `changes` limpo com outras origens em A/B/C; C no segundo arquivo impedindo até a primeira remoção; descarte explícito com C posterior; e rollback da primeira remoção preservando C escrito durante o loop. Estão **implementados, ainda não executados** nesta projeção. O [helper limitado](../../../tests/helpers/assert-bytes.ts) mantém igualdade integral dos bytes.

## Mtime novo do scratch pode esconder C

A primeira versão copiava os bytes do índice para um arquivo novo sem conservar sua fronteira temporal. O Git usa também o mtime do próprio arquivo índice para identificar entradas racy e decidir quando conferir conteúdo. Assim, bytes iguais não garantem consulta equivalente se o arquivo índice ficou mais recente. Esse mecanismo está descrito na [documentação oficial](https://git-scm.com/docs/racy-git.html) e nas funções de timestamp do [código oficial do Git](https://github.com/git/git/blob/v2.53.0/read-cache.c).

O probe Windows/NTFS com Git `2.53.0.windows.2` preparou B e gravou C com mesmo tamanho e mtime controlado. O mtime do índice nativo **não foi alterado**. O harness aguardou que a cópia nova fosse estritamente mais recente que o arquivo do worktree. Foram comparadas duas configurações locais:

| Configuração | Índice original | Cópia nova de streaming | Core V6 | Protótipo com mtime conservado | Protótipo com mtime de epoch + 1 s |
| --- | --- | --- | --- | --- | --- |
| `trustctime=false`, `checkStat=minimal` | Detecta M | Vazio | Vazio | Detecta M | Detecta M |
| `trustctime=true`, `checkStat=default` | Detecta M | Vazio | Vazio | Detecta M | Detecta M |

A regressão também ocorreu na configuração padrão desse ambiente. HEAD, A/B/C e os bytes do índice de origem ficaram preservados. Os protótipos só demonstram alternativas isoladas: não certificam a correção posterior, outros filesystems ou a precisão temporal em outra plataforma. O ensaio controlou metadados do arquivo da fixture para tornar a condição determinística; não estimou sua frequência em uso cotidiano.

A correção precisa manter uma fronteira temporal conservadora no scratch, sem arredondar para um instante posterior, preservando o diff oficial e as verificações da origem. Desabilitar `diff.autoRefreshIndex` sozinho continua inadequado pelo problema anterior de stat vazio, registrado em [INDEX-QUERY.md](INDEX-QUERY.md). Os onze novos testes pais de timestamp informados pelo responsável pela correção também aguardam execução.

## Staging: duas fronteiras temporais já existentes

Os probes de `stageIndex` encontraram dois efeitos na mesma família preexistente, tanto em d71 quanto na cópia imutável V6. O arquivo `index-stage.ts` dessas duas fontes tinha o mesmo SHA-256 `69d981eabe8f706a30614e9d176ef07e6d3af7b876a2cc21e18e28efb444c321`.

| Fronteira | Controle Git equivalente | Resultado antigo | Alcance confirmado |
| --- | --- | --- | --- |
| Copiar índice antes do `add` selecionado | Git oficial prepara C no índice nativo da operação correspondente | A cópia mais recente faz o `add` conservar B, embora C tenha sido selecionado | Baseline/V6 × configuração padrão/minimal: quatro observações válidas |
| Copiar/publicar o índice gerado no lock | Diff oficial no MESMO scratch que o `add` acabou de gerar detecta C | Diff no índice publicado fica vazio, mantendo os mesmos bytes preparados B | Baseline/V6 × configuração padrão/minimal: quatro observações válidas |

Nos dois probes, HEAD/A e C no disco permaneceram preservados, e nenhum timestamp de índice foi modificado pelo harness. Somente o arquivo próprio do worktree teve mtime controlado/restaurado. A fronteira de publicação usou a imagem realmente gerada pelo Git antes do callback de publicação, comparando esse scratch com sua cópia publicada.

A primeira investigação tinha outras quatro linhas de publicação que comparavam `add` de outro caminho com um índice original intocado. Esse controle não era equivalente. As observações brutas, inclusive suas flags originais, foram preservadas sob SHA `c35b44b0…`; `QUALIFICATION-PUBLICATION.json` reclassifica **essas quatro linhas como INCONCLUSIVAS**. Só as quatro linhas `selected-add` daquele recibo sustentam confirmação. A publicação tem uma segunda investigação própria, SHA `c40b36b1…`, com quatro controles do mesmo scratch. O JSON público contém exclusivamente essas seleções válidas na família confirmada.

A correção candidata reutiliza a proteção temporal também na cópia anterior ao Git e na publicação do índice gerado, conservando locks, hashes, tokens, callbacks de propriedade e a barreira durável de staging. A cópia do array de argumentos antes dos awaits é um endurecimento de consistência adicional: os probes anteriores não ensaiaram mutação do argv, que não é contada como outro defeito confirmado.

## Recuperação: restaurar B exato pode mascarar C

A investigação seguinte usou o failpoint existente `after-stage-index-publication`, uma exceção controlada depois de publicação real. O journal pendente continha o índice anterior B e seu backup validados. O `recover` real restaurou os bytes exatos de B, mas criou um arquivo índice com mtime novo: o diff nativo que antes mostrava C passou a retornar vazio.

| Fontes/configurações | Antes | Depois do recover antigo | Dados físicos | Repetição |
| --- | --- | --- | --- | --- |
| Baseline e V6, cada uma com padrão e minimal | Diff nativo: M | Diff nativo: vazio; raw B restaurado exato | A commitado, B preparado e C no disco preservados | Nova recuperação não duplica efeitos |

As quatro observações confirmam um defeito preexistente de semântica do índice restaurado. Elas não demonstram perda dos bytes de C. O ensaio usou fontes imutáveis e não auditou o worktree ativo, onde as correções estavam sendo preparadas.

Backups legados guardam bytes/modos sem uma prova do mtime original. A correção candidata usa, somente no temporário de um índice MAIN/privado aprovado pelo plano, uma fronteira conservadora de um segundo após epoch. O `cache_time` do Git tem segundos uint32 e zero desativa a verificação racy; veja [statinfo.h](https://github.com/git/git/blob/v2.53.0/statinfo.h) e [read-cache-ll.h](https://github.com/git/git/blob/v2.53.0/read-cache-ll.h). Essa escolha pode exigir rehash de conteúdo. Ela não substitui validação de plano, backup, bytes, modos, refs, revogação de propriedade ou V05, nem inventa um campo para journals antigos.

Os [seis novos testes de recuperação](../../../tests/integration/recovery-index-timestamp.test.ts) aguardam execução: quatro combinações MAIN/privado × padrão/minimal com plano legado e repetição; duas falhas controladas no FD próprio, após sync ou com adulteração temporal durante sync. Os [doze testes pais de staging](../../../tests/integration/staging-racy.test.ts) estão implementados e permanecem PENDING: oito combinações MAIN/privado × padrão/minimal nas duas fronteiras, dois escritores temporais externos, timestamp não representável e estabilidade do argv. Nenhuma dessas correções candidatas é certificada por esta investigação.

## Tentativas incompletas preservadas

- O primeiro lançamento off-window falhou no PowerShell antes de criar a fixture: `New-Item -LiteralPath` indisponível, seguido de módulo inexistente. Não executou o produto.
- O primeiro off-window real executou setup, mas o Git recusou um caminho de ref excessivamente longo gerado pelo harness. O worker terminou com código 1 antes da injeção. Recibos e fixture ficaram preservados; essa tentativa não confirma nem refuta o defeito.
- O primeiro probe racy usou `fs.copyFile`, que conservou mtime no ambiente observado. A pré-condição de cópia mais recente falhou antes das consultas comparativas. O segundo probe usou `copyRegular`, o mecanismo relevante do Core.
- A primeira comparação de publicação no staging continha quatro controles não equivalentes. Eles permanecem INCONCLUSIVOS, com o recibo original e a qualificação posterior preservados; a confirmação usa somente o segundo controle do mesmo scratch.

Essas falhas não viraram SKIP nem bloqueios ambientais. O retry off-window utilizou raiz nova e curta, sem alteração global do Git.

## Escopo e preservação

Fixtures externas próprias receberam marcador/nonce e verificação de ancestralidade. HOME, identidade, configurações, credenciais e temporários foram isolados pela allowlist do harness. O observador chamou o Git oficial por caminho absoluto e argv separado. Nenhum remoto do projeto foi fixture e nenhum repro alterou fontes do produto.

Off-window tinha teto de 20 minutos/128 MiB. O retry concluído consumiu 182.593 ms. Seu inventário registrou 810.710 bytes no diretório da execução, incluindo bundles e recibos já existentes, antes de gravar o próprio FINAL e a conferência posterior de processos. Também respeitou o deadline original; o recibo técnico do retry continha seu próprio deadline, detalhe preservado no JSON. As fixtures próprias registraram 69.120 e 82.567 bytes antes dos respectivos recibos OBSERVED. O probe racy consumiu 56.049 ms e registrou 175.794 bytes antes de gravar RESULTS, sob teto de 15 minutos/128 MiB. São tempos de experimentos completos, **não latência do produto**. O orçamento de disco foi verificado nos arquivos; não é quota física do volume nem contagem de todo I/O.

Os probes adicionais de staging/rollback tinham tetos individuais de 15 minutos/128 MiB. Seus recibos registraram 310.797 bytes no primeiro staging, 193.844 na publicação equivalente e 742.075 no rollback, antes dos respectivos resultados finais. São inventários lógicos de fixtures próprias, não I/O físico nem pico medido do volume. Os contadores de 164, 84 e 68 invocações são apenas chamadas diretas do observador nativo; não incluem as chamadas internas do Core ou todos os descendentes do Git.

O início do off-window coincidiu com a suíte candidata em andamento, interrompida pela coordenação após confirmação da regressão racy. Não se atribui duração a carga externa nem se utiliza esse experimento como benchmark. Ao final, workers e controlador próprios tinham encerrado; nenhuma instância Node com a raiz exata do repro permaneceu na conferência.

Fontes, fixtures, journals, backups e tentativas anteriores ficaram preservados. O JSON público contém hashes e observações essenciais, omitindo caminhos pessoais e PIDs. Os recibos brutos externos permanecem preservados; os novos testes versionados tornam o comportamento revisável sem depender desses caminhos privados.
