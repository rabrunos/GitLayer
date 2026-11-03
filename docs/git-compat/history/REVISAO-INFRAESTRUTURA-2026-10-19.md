# Evolução da infraestrutura — 19/10/2026

A tarefa do usuário autorizou corrigir testes, infraestrutura, configurações e documentação, preservando Core/CLI/desktop. A [revisão recebida](../reviews/Revisao-Tecnica-Git-Layers-Validacao-v2.md) foi lida integralmente como conjunto de achados a investigar. Ela própria declara que não é um prompt de implementação. Esta evolução não altera os requisitos aprovados U-01 a U-10.

## AGENTS antes e depois

Os arquivos [antes desta tarefa](AGENTS.before-infrastructure-review.md) e [depois desta tarefa](AGENTS.after-infrastructure-review.md) preservam o texto completo. Os snapshots anteriores de preparação v2 permanecem intactos: [antes v2](AGENTS.before-v2.md), [depois v2](AGENTS.after-v2.md) e [razões da preparação](REVISAO-AGENTS-v2.md). Links dentro desses snapshots devem ser interpretados a partir da raiz original do projeto.

O AGENTS recebeu um parágrafo sobre a revisão de 19/10 e este vínculo de histórico. O parágrafo esclarece cinco pontos: documento recebido é evidência, baseline pertence a cada execução, fontes untracked também entram na auditoria, os 344 IDs originais são referência preservada e a matriz de trabalho pode crescer, e caracterizações antigas devem evoluir explicitamente quando uma correção de produto for autorizada. A restrição de não editar produto continua sendo desta tarefa.

Não foram removidas instruções de isolamento, Git oficial, backups, journals, tokens, propriedade de fixtures, preservação de alterações, proteção do desktop ou proibição de commit/push sem autorização. A escolha de detalhes comuns de engenharia continua autônoma dentro do escopo autorizado.

## Causa e decisão técnica

R-01 confundia a prova de preservação da preparação com um contrato permanente de imutabilidade do produto. O teste HARNESS-015 e o relatório dependiam de uma pasta privada datada. Agora cada rodada arquiva sua baseline, fontes e matriz; o build usa as fontes arquivadas. Alterações legítimas anteriores são entradas válidas. Alterações durante a rodada continuam invalidando a aprovação. O relatório lê o snapshot arquivado e identifica seu próprio gerador separadamente.

R-02 confundia um JSON proposto pelo worker com o desfecho do processo. O supervisor passou a confrontar proposta, schema, identidade e encerramento real. Timeout, truncamento, sinal, spawn ou saída inesperada prevalecem como falha de infraestrutura e conservam os artefatos.

R-03 confundia ausência de falha com execução pretendida. Seletores inválidos ou interseções vazias acidentais falham antes de build. Listagem, vazio deliberado e retry sem falhas têm outcomes próprios e não são PASS de teste.

R-04 usava separadores dependentes do Windows dentro do ZIP. A criação agora escreve entradas com `/` e UTF-8, valida todo o plano antes de extrair, recusa travessia/links/colisões e verifica bytes e hierarquia. Leitores com falha Unicode são relatados pelo comportamento observado.

A validação adicional reproduziu uma falha de IO do .NET em caminhos longos. O empacotador passou a usar caminhos estendidos nas chamadas de IO, mantendo nomes ZIP canônicos e recusas de segurança. As evidências preservam a falha anterior, controles hostis, caminhos extraídos de até 590 caracteres e leitura independente pelo JDK disponível; não houve alteração de política global.

Uma execução sobreposta da matriz e da integração expôs limites de tempo da infraestrutura. O controle isolado das mesmas sete variantes aprovou com os limites originais e fingerprints idênticos. Foram separados os orçamentos de comando Git (30 segundos) e de operação composta da CLI (90 segundos), com limites por caso e overrides explícitos preservados, sem modificar asserções de produto. Timeouts anteriores permanecem falhas nas respectivas rodadas. O guia passou a orientar execução sequencial das suítes pesadas; desempenho observado não equivale a SLO.

Configurações de build desktop são auditadas quando presentes e deixaram de ser pré-requisitos headless. A cópia descartável da regressão de portabilidade demonstra execução e reexportação sem esses dois arquivos. Os arquivos reais do checkout foram preservados.

A revisão independente reproduziu uma falha adicional no relatório: um resumo com exit 0 e resultado FAIL coerente nas contagens ainda gerava ZIP com elegibilidade verdadeira. O gerador agora confronta outcome, saída global, estados finais e classificações conhecidas com o snapshot arquivado; uma seleção somente ENV_BLOCKED não aprova testes, e o modo forense sempre retorna exit 2. Dezessete controles reais em fixtures sintéticas validaram o candidato completo. A recusa de resultados executados não selecionados já existia no validador e recebeu regressão adicional, sem ser apresentada como novo defeito. O exemplo de reprodução também usa a concorrência arquivada, sem fixar quatro workers.

Após a rodada operacional completa, o dry-run de sanitização encontrou outro defeito de infraestrutura: a descoberta apenas pelo nome `results.json` confundia o resumo objeto de `existing/` com a lista autoritativa de `runs/`. O dry-run falhou antes de gravar derivados. A correção delimita os resultados pelo layout, mantém arquivos homônimos de evidência como texto genérico e acrescenta regressões. Essa etapa offline e seus testes posteriores têm fingerprint próprio; não se atribui a versão corrigida retroativamente à rodada operacional arquivada. As evidências conservam o erro, os arquivos antes/depois, os comandos e a prova de preservação das classificações.

## Continuidade

O [guia atual](../README.md) descreve extensão da matriz, módulos descobertos automaticamente, expectativas versionadas, reprodução headless, sanitização e geração de relatórios sem o brief original. Os artefatos da revisão registram comandos, fingerprints e resultados próprios; não são uma união de aprovações históricas.

Os arquivos originais do pacote v2 e os relatórios de 18/10 não foram reescritos para aparentar uma aprovação nova. Defeitos do produto permanecem identificados separadamente. MODEL-008 não virou uma campanha exaustiva por declaração, e capacidades ausentes não viraram suporte.
