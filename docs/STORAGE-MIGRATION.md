# Armazenamento e resgate — implementação de 02/11/2026

**Complemento de 04/11/2026:** [recuperação da etapa 2](reports/2026-11-04-performance-recovery/RECOVERY.md) amplia o diagnóstico independente por journal. Planos inválidos, backups ausentes/alterados, V05 e imagens posteriores incompatíveis são apresentados sem tentar reparo; uma entrada inválida não esconde as demais. `planValid` descreve o alcance do check e não dispensa as revalidações operacionais de `recover`. Nenhum schema, regra de migração, retenção do legado ou autorização de descarte foi relaxado.

O Core descobre o diretório Git com o Git oficial. Um repositório novo usa layers/ nesse diretório. Um git-layers/ anterior continua sendo aberto no lugar; abertura, diagnóstico e build não o migram. Índices, árvores, blobs, commits e referências continuam sendo formatos nativos do Git.

A migração é uma cópia explícita e verificada. Ela não altera HEAD, referências, índice principal ou arquivos de trabalho. O legado integral permanece como evidência: journals concluídos podem conter caminhos absolutos que continuam apontando para as cópias originais. Não apague nem edite o legado retido. O marcador layers/layout-migration.json registra manifesto/hash do legado; mudança posterior no legado impede nova abertura para evitar duas cópias ativas silenciosamente.

## Procedimento

Execute primeiro em uma cópia descartável. Estes comandos são exemplos para um repositório cuja migração o usuário escolheu; esta rodada não os aplicou ao checkout de desenvolvimento nem à demonstração.

~~~powershell
npm.cmd run build:core
node dist-core/cli/index.js --cwd C:\CopiaDescartavel doctor --json
node dist-core/cli/index.js --cwd C:\CopiaDescartavel recovery-export C:\Exportacoes\resgate-novo --json
node dist-core/cli/index.js --cwd C:\CopiaDescartavel unprotect --json
node dist-core/cli/index.js --cwd C:\CopiaDescartavel migrate --yes --json
node dist-core/cli/index.js --cwd C:\CopiaDescartavel doctor --json
~~~

unprotect só se aplica quando a proteção foi habilitada; migração recusa reservas ativas, incompletas ou locks desse controle. O estado liberado pode ser preservado como histórico e reativado no layout novo pelo mecanismo de proteção. Transações pendentes devem ser recuperadas no legado antes da migração. Exportar preserva evidências; não resolve uma transação nem apaga seu lock.

## Falha, destino ocupado e reinício

A cópia intermediária recebe nome exclusivo .layers-migration-<uuid>. O destino layers é reservado com mkdir exclusivo; arquivos usam criação/cópia exclusiva, e o marcador concluído só é gravado depois das verificações. Um destino desconhecido, inclusive vazio, nunca é adotado nem sobrescrito quando também há legado.

Falha anterior à reserva do destino deixa o legado utilizável e a cópia intermediária identificada; uma nova migração pode ser tentada. Falha depois de reservar o destino deixa marcador incompleto, legado e cópia intermediária. Nova abertura recusa a ambiguidade: use doctor e exportação antes de qualquer intervenção manual. Não há remoção automática de destino incompleto, backups, shelves ou locks. Uma migração concluída é idempotente; repeti-la retorna o resultado já concluído após verificar o legado.

A verificação de hash do legado lê seus arquivos a cada abertura de um repositório migrado. Essa escolha conservadora tem custo proporcional ao legado retido. Não há certificação de perda de energia, de todos os reparse points Windows nem de ausência absoluta de corridas contra programas externos.

## Diagnóstico e exportação independentes

doctor e recovery-export descobrem o repositório diretamente pelo Git, sem exigir GitLayers.open ou registry/workspace válidos. Doctor relata metadados inválidos, journals pendentes, locks do coordenador e locks Git principais, diferenças de refs/índices/reservas, colisões de origem e exclusões inefetivas. Distingue o índice principal de uma Layer aberta deliberadamente como branch do seu índice privado retido. safe:false produz código CLI 3; não significa que uma operação foi reparada.

O destino da exportação precisa ser absoluto, novo, fora do workspace e diretórios Git, com pai existente sem links. A exportação não remove locks. Copia os dois layouts quando presentes, seus índices, journals, backups, shelves e locks; guarda HEAD, índice principal, locks de índice/HEAD, info/exclude e lista de refs. Não copia configuração Git nem um clone completo de objetos. Links nos metadados viram registros de target no manifesto, sem percorrer ou recriar links vivos. Tipos especiais são registrados como não copiados.

A exportação conserva manifesto incompleto e cópias parciais quando ocorre erro real de IO ou alteração durante cópia. O manifesto final contém hashes dos arquivos copiados e sua completude. É evidência para inspeção, não um instalador de restauração automática nem um snapshot atômico de todo o repositório. Revise o conteúdo antes de compartilhá-lo: backups podem conter versões antigas sensíveis.

## Evidência específica

A suíte tests/integration/layout-rescue.test.ts usa Git oficial por caminho absoluto e fixtures temporárias com nonce/ancestralidade validados. Cobre layout novo/legado, confirmação, destino desconhecido, journals pendentes, bytes binários/shelves, paths históricos, failpoints antes e depois da reserva, gitfile e refs empacotadas, Core/CLI públicos, avanço de Layer pós-migração, contaminação do índice principal, modo branch, junctions e erro real de leitura causado por FileShare.None no Windows. Resultados públicos, snapshots e limites estão no [relatório de fechamento](reports/2026-11-02-closure/REPORT.md) e na [validação compacta](evidence/closure-2026-11-02/validation.json). O caminho original dos logs de armazenamento/resgate era `artifacts/implementation-2026-11-02/storage-rescue/`; seu conteúdo é preservado no arquivo externo verificado, sem exigir esse diretório em um clone novo. Evidências parciais anteriores não são somadas como uma aprovação única.

## Endurecimento após a primeira suíte ampla

A reprodução namespace-export-pre-fix.json confirmou que um destino Windows com prefixo de namespace podia ultrapassar a checagem lexical e criar a exportação dentro da própria fixture. A correção compara namespaces equivalentes e resolve o pai existente por realpath antes de reservar o novo diretório. Workspace e diretórios Git continuam protegidos, inclusive quando o usuário fornece esse alias; a regressão também exige ausência física do destino recusado.

Doctor consulta a proteção configurada diretamente, mesmo quando o Git volta a listar somente o worktree principal depois de uma intervenção externa nas reservas. A coerência dos owner markers e registros nativos, assim como o lock próprio desse controle, entra no resultado safe. O diagnóstico permanece somente leitura e não remove reservas, metadados ou locks inconsistentes.

Antes da cópia de migração, a abertura estrutural normal do Core valida o legado sob lock. Essa etapa usa somente open/load: não chama status, list nem reconciliação do destino de edição. Um registry que a abertura rejeita não é publicado no layout novo. A validação não é uma reconstrução de histórico perdido nem reparo de metadados incoerentes.

As três regressões foram acrescentadas a layout-rescue.test.ts após a primeira execução ampla. Portanto, os resultados anteriores de 15 casos pertencem ao snapshot anterior; execução posterior e respectivos fingerprints são necessários para aprovar este endurecimento. O relatório principal e os arquivos novos de resultado registram a repetição efetivamente realizada.
