# Protocolo de validação — v2

**Especificação a implementar pelo Codex. Não é um relatório de execução.**

## 1. Finalidade

Criar uma base reutilizável para descobrir o comportamento do Git oficial, caracterizar o Git Layer atual e validar futuras funcionalidades a partir de requisitos do usuário. O runner executa comandos e asserções objetivas; a IA não precisa julgar manualmente toda saída a cada rodada. Decisões técnicas da implementação futura ficam com o Codex.

O escopo de produto está em `06-Decisoes-e-Autonomia.md`. Nesta rodada, código de testes, documentação e infraestrutura podem mudar. Core/CLI de produto, editor e dados reais não podem mudar. Corrigir um teste incorreto não significa adaptar seu resultado esperado para esconder um defeito real.

## 2. Unidades de cobertura

Registrar separadamente comandos catalogados, opções examinadas, cenários especificados, testes implementados e variantes selecionadas/executadas. Os 344 IDs são roteiros-base; um pode gerar variantes. Não inflar cobertura dividindo linhas equivalentes e não contar `--help` como validação funcional de merge.

Manter os 320 IDs do v1. Os 24 novos ficam identificados no JSON. Itens externos adiados e componentes gráficos inventariados permanecem visíveis com motivo. A contagem total nunca deve ser apresentada como quantidade de testes headless executados.

Perfis iniciais N0/L0–L6 estão no JSON. Incluir N0-equivalent quando for preciso repetir no Git puro os mesmos bytes e regras de ignore da fixture Layer. Criar apenas combinações válidas. Registrar dimensões não exercitadas: versão, SO, hash de objetos, backend de refs, filesystem, shell/PTY e topologia.

## 3. Quatro perguntas independentes

| Dimensão | O que comprova |
|---|---|
| Git oficial | Transição definida por manual da versão e observada em fixture sem produto. |
| Projeto atual | O que o snapshot real de Core/CLI faz, incluindo recusas e defeitos. |
| Requisito do usuário | Resultado desejado U-xx/decisão posterior, sem prescrever o algoritmo. |
| Qualidade do teste | Setup válido, oráculo independente, detecção de divergência e evidência suficiente. |

O Core pode ser o alvo, nunca o único observador do próprio acerto. `src/core/git.ts` aplica políticas específicas; não é substituto do Git independente para testar comportamentos que filtra. [P02]

## 4. Caminho headless

A rodada não depende de Electron, Monaco, VS Code nem da extensão visual futura. Não abrir Dev/Debug, não iniciar desktop, não usar Playwright ou cliques para Core/CLI. Ferramentas gráficas do catálogo oficial ficam na documentação, sem abrir janelas.

Pode haver pequenos scripts de fixture atuando como GIT_EDITOR/GIT_SEQUENCE_EDITOR, hooks, filtros e helpers controlados para testar mecanismos nativos, sem interface gráfica. Isso não significa usar o editor do laboratório. Interação que depende de TTY exige PTY real headless; substituir por pipe e ignorar a ausência de TTY não é prova equivalente. [S03, S12]

O Codex escolhe como compilar fontes atuais uma vez e rodar Core/CLI sem importar desktop. Pode criar configuração/build só para testes e scripts no package.json. Esses artefatos não são o empacotamento público definitivo. Inspecionar efeitos dos scripts existentes antes de invocá-los; `setup`, `dev`, `demo` ou `workshop` podem preparar/abrir componentes fora do escopo.

## 5. Inventário e proveniência

Registrar caminho absoluto e versão/build do Git, SO, arquitetura, shell, capacidades, Node/runtime necessário, SHA inicial e fingerprint de fontes/testes antes e depois. Não supor que Git 2.56.0 do catálogo seja a instalação local. Comparar inventário local e upstream fixado; qualquer atualização do catálogo deve ser explícita e manter histórico. [S02, S22]

Identificar aliases e executáveis externos sem executá-los indiscriminadamente. Não dedicar a tarefa a compatibilidade com ferramentas de terceiros. Comandos oficiais opcionais continuam catalogados; variantes dependentes de servidores terceiros ficam adiadas quando fora do escopo.

Fichas por comando/opção devem apontar fonte, versão/capacidade, estado lido/escrito, efeitos em refs/índice/worktree, cenários e nível de exame. A existência de um link não significa manual integralmente revisado.

## 6. Casos executáveis e oráculos

Cada variante deve declarar ID, propósito, comandos exatos, contexto e contrato, setup determinístico, entrada, expectativa, snapshots, asserções, timeout, seed, capacidades e cleanup. O produto é invocado por CLI em fluxos públicos representativos; APIs do Core podem complementar cenários finos, sem substituir todas as provas da CLI.

Observar pelo Git nativo absoluto e filesystem: HEAD/symref e pais, entradas de índices (caminho/modo/OID/stage/flags), árvores e blobs, existência/tipo/bytes/modos, ignores/atributos e, quando pertinente, journals/shelves/reservas/retenção. Descobrir caminhos pelo Git e usar formatos de saída apropriados; não presumir SHA-1, refs soltas ou nomes sem espaços. [S06, S08–S11, S23]

Separar comparação semântica de identidade física. Caches legítimos do índice podem mudar; OID, modo ou estágio diferente não pode ser normalizado para esconder falha. Quando for necessário comparar hashes de commits entre fixtures, controlar autoria/tempo/parents ou comparar semanticamente o grafo. [S06]

### Exemplo obrigatório: adição normal à base

Em fixture com `main`, arquivo da base alterado, arquivo novo sem proprietário e uma Layer ativa com conteúdo próprio: registrar os estados; executar **o Git oficial `add .`**; ler o índice principal por observador independente; comprovar que contém as mudanças esperadas da base e não contém o caminho da Layer; conferir índices/refs Layer e bytes; executar um commit nativo da base em variante separada e verificar sua tree e as refs. [S06; U-08]

Não substituir essa execução por `git layer base-add`. É útil testar ambos, mas respondem perguntas diferentes. `add -f` é outra variante e sua política de produto não está implicitamente decidida pela exigência sobre `add .`.

### Exemplo obrigatório: seleção de uma Layer

Caracterizar `git switch layer/...`, `git checkout layer/...`, invocação direta do executável e `worktree add` em fixtures separadas. Registrar efeitos mesmo quando o processo retorna erro; não presumir que um filtro de UI ou falha de post-checkout impediu a transição. A exigência futura U-07 pode permanecer PRODUCT_GAP; não se implementa a solução nesta rodada. [S12, S32]

## 7. Isolamento

Toda operação destrutiva, rede experimental, GC, limpeza, corrupção, migração simulada e interrupção fica em raiz temporária exclusiva com identidade/nonce, ancestralidade validada e sentinelas fora do alvo. Nunca usar o repositório de desenvolvimento, `C:\Dev\GitLayerTest`, `.workshop` preexistente ou dados pessoais como fixture destrutiva.

Criar ambiente por subprocesso: HOME/USERPROFILE/XDG, configs locais e system/global substituídas por arquivos da fixture, identidade, credenciais falsas, pager/editor/helpers controlados. Não modificar estado global de processo compartilhado entre workers nem a instalação/configuração pessoal. Caso cujo objetivo é uma configuração deve defini-la explicitamente; não “limpar” a opção em estudo para obter resultado conveniente.

Rede de teste só entre fixtures locais ou loopback, sem credenciais reais, serviços públicos, e-mails reais, agendadores ou sockets expostos. Acesso à documentação/dependências autorizadas é distinto dos endpoints usados pelos testes. Não usar `origin` real como remoto de laboratório.

Fixtures mutáveis/GC não compartilham hardlinks, alternates ou object stores com o projeto ou outros casos. Cenários de alternates/worktrees possuem grupo temporário dedicado. Cleanup só com prova de propriedade e nunca seguindo links para fora. Encerrar apenas descendentes comprovadamente criados pela rodada; não usar encerramento global por nome de processo.

## 8. Resultado: três eixos e a seleção

| Campo | Valores |
|---|---|
| execution_status | NOT_RUN, PASS, FAIL, ENV_BLOCKED, NOT_APPLICABLE |
| product_status | NOT_ASSESSED, PENDING_PRODUCT_SPEC, TEST_GAP, PRODUCT_GAP, DOCUMENTED_RESTRICTION, VERIFIED_SUPPORTED |
| known_failure | NONE, XFAIL_STRICT, XPASS_NEEDS_REVIEW |
| selection_status | SELECTED, NOT_SELECTED, OUT_OF_SCOPE_CURRENT_PHASE |

Roteiro ainda não implementado é SPEC_ONLY/TEST_GAP. Não executar por escopo é NOT_RUN + OUT_OF_SCOPE_CURRENT_PHASE, não uma aprovação nem um problema do ambiente. Feature ausente do produto é PRODUCT_GAP; pré-requisito comprovadamente ausente pode ser ENV_BLOCKED. Uma falha inesperada de setup é FAIL, salvo diagnóstico comprovando a capacidade ausente.

PASS nativo pode coexistir com PRODUCT_GAP. Caracterizar uma recusa atual pode passar sem significar suporte à operação recusada. XFAIL deve especificar defeito e assinatura esperados; qualquer outra exceção falha normalmente. XPASS é avanço a revisar, não falha a ocultar nem autorização para mudar contrato. A política de exit code da rodada deve ser documentada: separar regressão inesperada de lacunas conhecidas, sem apresentar conjunto com XFAIL como suporte completo.

## 9. Rapidez

Criar seleção por ID, família, comando, tier, perfil e capacidades; modo de listar sem executar; reprodução por seed; repetição dos falhos. Nomes de scripts são escolha do Codex, documentados só depois de existirem. Exemplos de intenção: inventário, smoke, afetados, integração comum, completo headless, capacidades opcionais e stress.

Compilar uma vez; usar fixtures mínimas; paralelizar apenas estados isolados; separar testes caros e interrupção. Medir duração real, quantidade de processos e volume de fixtures. Não prometer todos os cenários em segundos nem aumentar timeouts para ocultar travamentos.

Uma seleção por impacto precisa listar incluídos e omitidos e ter opção ampliada. O teste final deve corresponder ao último fingerprint das alterações; resultados de builds diferentes não podem ser fundidos silenciosamente. Reutilização/caches devem ser invalidados por fonte/configuração/catálogo e identificados no relatório.

## 10. Testar a infraestrutura

Exigir testes de falha deliberada, setup incompleto, filho pendurado, timeout, saída não zero, captura de streams, assertions false, limpeza recusada, evidência faltante, seed reproduzível, versão divergente e esquema de resultado inválido. O runner deve provar que detecta uma divergência controlada. Não alterar o Core de produção para essa prova.

Interrupções reais devem atingir um subprocesso em estado demonstrável; um sleep arbitrário ou failpoint que libera locks em finally não é equivalente. Sem ponto observável apropriado, registrar a limitação em vez de inventar cobertura. Usar barreiras/sinais externos quando possível, sem adicionar funcionalidade ao produto nesta rodada.

## 11. Documentação, relatório e continuidade

O Codex pode adaptar os schemas propostos, mantendo informações e registrando versão/migração. Deve implementar um validador de consistência dos relatórios, não depender apenas da revisão humana. Ver `08-Modelo-de-Relatorio-Completo.md` e `schemas/resultado.schema.json`.

Toda falha tem ID, esperado/observado, reprodução, hipótese, evidência, categoria (infraestrutura, produto, ambiente ou contrato) e destino. Corrigir infraestrutura e repetir; manter defeitos de produto como casos reproduzíveis e backlog. Não apagar resultados anteriores.

A entrega reúne Markdown, dados estruturados, evidências sanitizadas, comparação dos arquivos modificados, comprovação de não alteração das fontes do produto e instruções de reprodução. Um relatório deve continuar legível depois de extraído em outro diretório, sem depender dos caminhos temporários originais.

## Fontes

[Sxx]/[Pxx] referem-se a `07-Fontes-e-Proveniencia.md`. As decisões U-xx estão em `06-Decisoes-e-Autonomia.md`. A organização e as regras de evidência aqui são requisitos do pacote; não são alegações de que a infraestrutura já existe.
