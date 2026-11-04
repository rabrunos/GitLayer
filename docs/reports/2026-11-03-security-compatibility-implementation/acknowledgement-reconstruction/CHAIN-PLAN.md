# Reconstruir as fontes históricas ACE17 →6994 →49BA

Os dois patches e os três manifestos permitem reconstruir estaticamente as fontes intermediárias em cópias próprias externas. São fingerprints de manifestos funcionais de183 entradas, não SHAs de commit.49BA é um snapshot intermediário inseguro sem commit próprio;6994 também contém a variante de materialização documentada. Não use essas fontes históricas como produto corrigido.

1. Obtenha uma cópia exatamente correspondente aos183 caminhos e hashes de [SOURCE-MANIFESTACE17.json](SOURCE-MANIFESTACE17.json). Se a fonte disponível tiver outro fingerprint, esta ponte não se aplica diretamente: obtenha a fonte exata ou revise outra ponte.
2. Prepare um diretório externo novo e próprio, fora de repositórios, sem links ou hardlinks, com marcador/nonce e ancestralidade conferidos. Copie somente o domínio funcional183, sem .git, dependências, perfis ou dados de Layers. Preserve bytes e modos.
3. Confira os hashes dos patches e seus cabeçalhos canônicos: somente src/core/index.ts, src/core/recovery.ts e tests/integration/security-ownership.test.ts. Não use caminhos inseguros, tolerância de whitespace, hunks aproximados ou rejeições.
4. Na cópia externa, confira e aplique primeiro [REVERSE-ACE17-TO-6994.patch](REVERSE-ACE17-TO-6994.patch). Verifique os caminhos e hashes dos183 arquivos contra [SOURCE-MANIFEST6994.json](SOURCE-MANIFEST6994.json). Só então confira/aplique [REVERSE-6994-TO-49BA.patch](REVERSE-6994-TO-49BA.patch) e verifique todos183 contra [SOURCE-MANIFEST49BA.json](SOURCE-MANIFEST49BA.json). Não execute esses comandos no checkout de desenvolvimento.
Os manifestos funcionais registram somente file/sha256, sem modos; seus fingerprints não validam modos. Confira-os separadamente nos metadados Git da fonte, cabeçalhos dos patches e recibos físicos. Permissões físicas do host e modo Git são dimensões distintas: os campos históricos 438(decimal)/0666 descrevem o host observado, não o modo Git100644 dos cabeçalhos.

5. O parser literal reconstruiu cada etapa em cópias novas: três arquivos mudam,180 ficam idênticos. Posteriormente, dois comandos oficiais git apply --check encerraram0 nos snapshots adequados; nenhum patch foi aplicado pelo Git nesses checks. São procedimentos distintos e não executam o produto. Veja [STATIC-RECONSTRUCTION.json](STATIC-RECONSTRUCTION.json) e [STATIC-GIT-CHECKS.json](STATIC-GIT-CHECKS.json).
6. Para observar as intercalações temporais49BA, use as [receitas ESM V2](../reproductions/README.md), os hashes executados e o isolamento exigido. As duas repetições reais estão em [RECIPES49BA-RUNTIME.json](../d01-evidence/RECIPES49BA-RUNTIME.json). O êxito do harness confirmou o defeito histórico por oráculos independentes; não aprovou49BA ou o snapshot corrigido.
7. O caso6994 continua com [receita textual](../reproductions/MATERIALIZATION6994-RECIPE.md) e [observação/continuação histórica](../d01-evidence/MATERIALIZATION-BEFORE.json). O [overlay experimentalV02](../d01-evidence/MATERIALIZATION-V02-COMPOSITION.json) e sua [prova](../d01-evidence/MATERIALIZATION-RECOVERY-BEFORE.json) são uma composição diferente; este pacote não fornece um replay temporal público equivalente desse overlay.

| Patch | SHA-256 |
| --- | --- |
| ACE17→6994 | eb447a482272622915d0f0ebda07d71da642d8acffc19e76713e9dc82d0f8eaf |
|6994→49BA |0be03c5839b9c33da302c25345597730e08d45c32a9b5cea604be600771bf97a |

Os patches são verbatim. Suas três linhas necessárias de contexto vazio não devem ser alteradas: ACE→6994 linha77;6994→49BA linhas160 e164. Uma revisão de whitespace deve distinguir esses artefatos do código de produção.

A reconstrução estática não reproduz concorrência, certifica recuperação de bytes ou acrescenta testes ao corpus final. As fontes da campanha14 permanecem ACE17/183; os resultados dessa campanha têm recibos próprios. Bytes nunca registrados ou copiados não podem ser prometidos como recuperáveis.
