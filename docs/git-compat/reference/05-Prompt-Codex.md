# Missão para o Codex — base de documentação e validação do Git Layer v2

Você está no workspace local do projeto `rabrunos/GitLayer`. O diretório provável é `C:\Dev\GitLayer`; confirme pelo Git e pelos arquivos existentes. O pacote de referência é **Git-Layers-Base-de-Validacao-v2.zip**, com raiz interna **Git-Layers-Base-v2/**. Sua execução é local e não autoriza publicação no GitHub.

## 0. Missão, precedência de escopo e autonomia

**Execute a estruturação de documentação, instruções de desenvolvimento e testes automatizados. Não implemente novas funcionalidades nem corrija o comportamento do Git Layer nesta rodada. Não abra nem altere o editor de laboratório.**

O produto é Core/CLI para o Git oficial. O editor é apenas ferramenta manual do usuário; VS Code e uma eventual extensão visual não são dependências do produto. O trabalho futuro será: o usuário e o ChatGPT descrevem comportamentos desejados; você investiga alternativas técnicas, implementa e demonstra os resultados com a infraestrutura que construir agora.

Leia o repositório primeiro: `AGENTS.md`, instruções aplicáveis em subpastas, README, arquitetura, segurança, limitações, desenvolvimento, testes, relatório atual, package.json e os trechos reais do Core/CLI/harness. Depois leia integralmente os documentos deste pacote, em especial decisões, protocolo, matriz, guia de AGENTS e modelo de relatório. O projeto remoto consultado na preparação estava em `37887aad107bd751a3687bc660a6644ef5d90c54`; não presuma que a árvore local permaneceu igual. Não resetar, trocar branch nem descartar mudanças para coincidir com esse SHA.

O usuário autoriza explicitamente revisar o AGENTS e documentação para esta preparação. Ideias, restrições técnicas e regras históricas que não representam mais a direção do projeto podem ser reclassificadas e reescritas. Preserve a história e justifique mudanças. Isso não autoriza remover proteções contra perda de dados, esconder evidências ou contornar instruções superiores da plataforma.

A v2 substitui o v1 em caso de conflito. A interpretação final é: corrigir erros de infraestrutura/testes/documentação agora; caracterizar e registrar defeitos do produto para depois. Não usar a frase antiga “corrigir erros” como autorização para mudar o Core.

## 1. Autorização por área

**Pode modificar:** documentação e AGENTS pertinentes; catálogo/fichas de estudo; manifests/schemas de cenários; código de testes, fixtures e observadores; scripts de seleção/reprodução/relatório; configuração de build exclusivamente para testes headless; entradas de scripts no package.json e configuração de testes necessária. Escolha a estrutura que melhor se encaixe no repositório, evitando duplicação.

**Não pode modificar nesta tarefa:** comportamento em `src/core/`, `src/cli/`, `src/desktop/`; modelos de propriedade/projeção; formato de armazenamento atual; nomes de refs; integração de checkout/branches; funcionalidades futuras; migração de `git-layers` para `layers`; UX ou configuração de lançamento/Tasks do editor; executável Git instalado; configurações globais; serviços/remotos pessoais. Não criar uma nova implementação de produto dentro do harness para passar testes inexistentes.

Não atualizar versões de dependências indiscriminadamente nem executar audit-fix. Preferir ferramentas já disponíveis e lockfile existente. Se uma dependência de testes for realmente necessária, justifique a escolha, mantenha-a isolada e registre qualquer alteração de manifesto/lock. Não usar instalação de Electron ou preparação da demonstração como pré-requisito automático para testes de Core/CLI.

**Não fazer commit, push, publicação de release ou alteração de serviço remoto.** Entregue alterações locais e relatório; não sobrescreva o pacote portátil do editor. Git write/destruição para cenários apenas nas fixtures autorizadas.

## 2. Preparação e trilha de auditoria

Registre cwd, branch/SHA local, status inicial, versões, arquivos previamente modificados e fingerprints das fontes de produto. Proteja o que já era do usuário; não atribua mudanças prévias a esta tarefa. Inspecione scripts antes de executá-los para evitar side effects de demo/GUI.

Extraia o ZIP em uma pasta nova sob `.workshop/briefs/`, validando caminhos relativos e recusando entradas absolutas, travessia e links. Preserve o ZIP original. Se a pasta de destino já existir, crie uma extração nova identificável, sem misturar conteúdos. Não exigir Python: use as ferramentas disponíveis na máquina. Leia o pacote mesmo que a busca textual normal ignore `.workshop`; o caminho explícito faz parte desta autorização.

Abra um diário de execução desde o início, com comandos, horários, decisões, interrupções e arquivos alterados. Guarde resultados por rodada; não deixe a geração do relatório depender de memória ao final. Crie um plano de execução com checkpoints. Continue trabalho útil diante de capacidade ausente, mantendo rastreabilidade e sem fabricar aprovação.

## 3. Atualize AGENTS e organize a documentação

Siga `09-Guia-Revisao-AGENTS.md`: o foco do AGENTS raiz deve distinguir produto Core/CLI e editor auxiliar. Mova orientações detalhadas de Electron/Monaco/Dev/F5 para escopo/documentação do desktop quando apropriado, sem apagar os recursos existentes.

Separe: fatos implementados; requisitos aprovados do usuário; limitações atuais; hipóteses; decisões técnicas investigadas; regras permanentes de preservação. O estado experimental atual não deve congelar a evolução. “Não mexer no Core” precisa ficar claramente associado à tarefa atual, não virar veto perpétuo. Não espalhar instruções conflitantes em vários arquivos.

O AGENTS deve orientar futuras rodadas a consultar contratos e evidências, escolher o escopo de teste adequado e registrar o resultado. A arquitetura futura será de sua responsabilidade técnica quando houver autorização para implementar. O usuário não precisa ditar algoritmo, linguagem de scripts ou organização interna de cada funcionalidade.

Não transformar estes documentos em aprovação de suporte que o código ainda não oferece. Mantenha histórico das mudanças de instrução com antes/depois, justificativa e escopo. Atualize referências e validação de links.

## 4. Direção de produto já confirmada

Aplicar U-01 a U-10 do documento de decisões:

- Compatibilidade-alvo: Git oficial, não outros aplicativos chamados git-layer, IDEs, libgit2/JGit ou ferramentas de terceiros. Não investigar estrelas/forks nem usar esses projetos como requisito de compatibilidade.
- Convenção atual/futura nesta etapa: `layer/<nome>` em `refs/heads/layer/<nome>`. Não substituir por outro namespace.
- Nome desejado para armazenamento: `layers`, minúsculo, reutilizando a estrutura/recursos Git. Apenas documentar e preparar validação; migração ainda não autorizada.
- Usar formatos/objetos/refs/índices Git reais sempre que adequados. Não duplicar a arquitetura por aparência nem alterar o índice para ficar “quase compatível”. O Codex decidirá detalhes adicionais com evidências, em tarefa futura.
- Produto independente de qualquer interface gráfica. Não abrir o laboratório, VS Code por automação ou ferramentas gráficas oficiais nesta rodada.
- Desejo futuro: Layer é ativada/desativada, não selecionada como branch normal. Investigar e registrar a lacuna com o Git oficial; não fingir que instalação de subcomando, filtro de UI ou erro posterior torna isso universalmente resolvido.
- Adição normal à base não pode incluir indevidamente arquivo pertencente à Layer. `add .` é preparação, não commit; observar ambos em etapas próprias.

A intenção de compatibilidade ampla não permite redefinir silenciosamente comandos destrutivos nativos. Onde falta contrato, caracterizar e identificar a questão de produto. Não escolher agora interceptadores, hooks, wrappers, fork ou extensões visuais. Mecanismos técnicos deverão ser estudados e decididos quando a funcionalidade estiver autorizada.

## 5. Complete o estudo versionado do Git

O catálogo de referência v2 mantém 161 entradas upstream e 33 guias/interfaces/formatos do recorte v2.56.0. Verifique a versão realmente instalada e compare com documentação/tag apropriado, sem atualizar Git global. Use fontes primárias: manuais, código e testes upstream. Não alegue leitura integral de algo que só catalogou.

Mapeie comandos, subcomandos e opções relevantes; arquivos/objetos/refs/índices que leem ou escrevem; topologias e estados de conflito; flags e requisitos por versão. Complete fichas de semântica e relacionamentos com cenários. Inventário de nomes é apenas o início, não aceite final.

Estude modelo de dados, índice/stages, refs/reflogs, hooks/sequencers, worktrees/gitfile/common-dir, formatos de hash/refs, sparse/split index, atributos/filtros/EOL, clone/transporte/manutenção. Não inferir índice permanente por branch nem índice para push. Classifique limites presentes na implementação sem convertê-los em objetivo final.

Mantenha comandos oficiais opcionais no catálogo. Aplicativos externos ficam adiados; GUI oficial fica inventariada sem execução visual. Bridges oficiais que exigem outro sistema podem ter fichas documentais e classificação explícita de end-to-end adiado. Um helper sintético criado pela fixture para testar uma interface oficial não é compatibilidade com aplicativo terceiro.

Não é preciso congelar toda a arquitetura futura para completar esta documentação. Registre alternativas e perguntas técnicas com fontes, sem tornar cada opção uma obrigação do usuário ou pré-requisito artificial.

## 6. Implemente o harness de verdade

A matriz contém 344 roteiros: 320 IDs preservados e 24 adicionais. Conserve IDs e relações. Revise expectativas contra o Git real e requisitos U-xx; acrescente variantes/casos quando uma diferença relevante for descoberta. Documente cada alteração. Não contabilize casos excluídos de escopo como executados.

Escolha uma implementação sustentável na stack disponível. Compile Core/CLI uma vez por rodada em saída separada; não iniciar/importar desktop como dependência de teste. Prove fluxos públicos pela CLI e complemente casos específicos com APIs headless do Core. Nenhuma fonte do produto deve ser alterada para viabilizar isso.

O Git independente deve ser invocado por caminho absoluto, argv separado e ambiente de fixture. Não use `src/core/git.ts` como único oráculo. Compare HEAD/ref/árvore/índice/blobs/bytes/modos/ausências, e metadados quando pertinentes. Não usar mocks de Git para comprovar comportamento do Git.

Cada caso executável possui setup determinístico, comando exato, stdin quando usado, esperado construído independentemente, snapshots antes/depois, asserções, capacidades, timeout, evidências e reprodução. Não reduzir falhas a busca por uma frase de erro. Um código não zero pode ocorrer depois de efeitos; verifique o estado final.

Implemente e execute primeiro validação do harness, smoke e fluxos cotidianos; avance até cobrir todos os roteiros headless exequíveis no ambiente desta tarefa. Não limitar a entrega deliberadamente a um pequeno smoke quando outros casos são viáveis. Onde o produto ainda não permite o cenário, caracterize a recusa e marque PRODUCT_GAP; onde falta teste, marque SPEC_ONLY/TEST_GAP, sem criar PASS vazio.

Inclua explicitamente `git add .` nativo com base + Layers, commit nativo subsequente em variante, índices Git alternativos operáveis pelo Git e push local que distingue commit de conteúdo apenas preparado. Inclua caracterização de checkout/switch de `layer/...` e chamada direta ao Git. Não declarar que testes do wrapper certificam chamadas que o bypassam.

## 7. Regressões e investigação sem corrigir produto

Reproduza as hipóteses já identificadas: abertura de doctor/export com metadados inválidos; lock abandonado por morte real; tamanho de snapshot/journal e interrupções; capture → off → cancel; ref alterada/apagada/renomeada; checkout/clean/stash sobre ignorados; retenção durante GC; custo de varreduras e journals acumulados.

Mantenha cada uma como HYPOTHESIS até confirmação. Quando confirmar, salve contraprova mínima e evidências; quando refutar, explique as condições e a observação. Não exigir que todas sejam bugs. Não adicionar um “fix” ao Core nem desativar uma proteção para avançar os testes.

Se o erro está no harness, fixture, parser de saída, asserção, timeout ou documentação, corrija a causa e repita. Se a interpretação do comportamento Git estava errada, corrija o oráculo com fonte e evidência, não para coincidir cegamente com o produto. Se a especificação é indefinida, registre, sem inventar o desejo do usuário.

## 8. Isolamento obrigatório

Crie fixtures temporárias exclusivas com marcador/nonce e verificação de ancestralidade. Não testar destruição no projeto, em `C:\Dev\GitLayerTest`, em arquivos pessoais ou em `.workshop` preexistente. Não tocar em origin real para testes de rede.

Toda rede de cenário deve usar bare repos locais ou loopback controlado. Nenhuma credencial/e-mail/servidor real, scheduler global ou porta pública. Configs/HOME/USERPROFILE/XDG, identidade, editor/pager/helpers, chaves e armazenamento devem ser exclusivos da fixture. Não mudar política do PowerShell, configuração global, instalação Git ou PATH permanente.

Mantenha isolamento por subprocesso/worker. Não compartilhar índices/objects mutáveis entre casos independentes; GC/corrupção nunca usam hardlinks/alternates com dados fora da fixture. Hooks/helpers sintéticos só com conteúdo inofensivo de teste. Encerrar descendentes comprovadamente criados, sem matar processos pessoais por nome.

Interrupção real e failpoint são provas diferentes. Se não houver observabilidade segura da etapa, registre o limite. Não modificar fontes de produto para criar a aparência de teste real. Simulações do harness podem testar o harness, mas não contam como execução do Git Layer.

## 9. Velocidade, regressão e falsos positivos

Forneça seleção por ID/família/comando/perfil/tier/capacidade e modo de listar sem executar. Acrescente reprodução por seed e repetição dos falhos. Nomes/organização são sua decisão; documente os comandos realmente implementados, não comandos aspiracionais.

Separe smoke, afetados, cotidiano/integrado, amplo headless, opcional e stress. Paralelismo calibrado por medição e isolamento, sem compartilhar `process.env` mutável entre casos concorrentes. Meça duração e quantidade de processos; não prometa toda a matriz em segundos. Testes de escala não substituem provas de integridade.

Teste o próprio runner com assertion falsa, filho pendurado, timeout, setup incorreto, evidência ausente, saída inesperada, limpeza fora de escopo, catálogo novo e resultado malformado. Mostre que a infraestrutura acusa a divergência. Controles negativos não podem afetar o Core real.

Use geração de sequências com seed, invariantes e redução de contraprova para complementar casos fixos. Priorize combinações de risco, não um produto cartesiano cego. Preservar resultados de falhas anteriores e retestes; não fundir aprovações de snapshots distintos em um “full pass”.

## 10. Resultado por caso e política de sucesso

Manter `execution_status`, `product_status`, `known_failure` e `selection_status` independentes conforme protocolo. Roteiro só no JSON não é teste implementado. Item fora do escopo não é ENV_BLOCKED nem PASS. Funcionalidade ausente não é problema do ambiente. Recusa conservadora testada não é suporte à operação recusada.

Defeito conhecido exige ID e assinatura estrita; outra falha não pode ser absorvida como XFAIL. XPASS precisa de revisão. Defina e documente exit codes do runner e portas de qualidade: falha inesperada de infraestrutura/asserção deve falhar; lacunas conhecidas continuam visíveis e não viram certificado de suporte.

Dados por variante: cenário, contrato, fonte, ambiente, fingerprint, comandos, início/fim, duration, exit/timeout/sinal, esperado/observado, assertions, artefatos relativos e hashes, conclusão e reprodução. O schema anexo é ponto de partida; pode ser adaptado preservando o conteúdo e a rastreabilidade.

## 11. Relatório completo obrigatório

Siga `08-Modelo-de-Relatorio-Completo.md`. Produza um arquivo Markdown principal autossuficiente, além de JSON/JSONL e evidências que permitam ao ChatGPT revisar a entrega sem abrir o computador do usuário.

O relatório deve conter: contexto/escopo; estado inicial/final; inventário e fontes; arquitetura documentada sem confundir proposta e implementação; revisão do AGENTS com justificativas; lista de arquivos alterados; descrição e comandos do harness; matriz por todos os IDs; contagens com denominadores; falhas antes/depois; hipóteses confirmadas/refutadas; limitações/requisitos pendentes; desempenho medido; segurança/cleanup; comprovação de não alteração do produto; catálogo de evidências; comandos para reproduzir e roteiro de uso em futuras funcionalidades.

Para cada falha ou lacuna material: condições, comando, esperado, observado, código/estado real, hipótese de causa e seu grau de confiança, impacto, arquivo/linha investigada quando houver, evidências, reprodução mínima e próximo trabalho. Não resumir dezenas de lacunas como “pendente” sem IDs e razões.

A matriz detalhada deve cobrir TODOS os 344 IDs, inclusive excluídos/adiados e não implementados. Separar cenário de variante. Não afirmar 344 aprovados porque existem 344 objetos no JSON. Produzir resumo por categoria de Git, capacidades e escopo.

## 12. Entrega local e verificação final

Coloque o relatório principal final em `artifacts/git-compat/RELATORIO-COMPLETO.md` e o pacote de devolução em `artifacts/git-compat/Git-Layers-Relatorio-Validacao-v2.zip`. Dentro do ZIP: relatório na raiz, resultados estruturados, inventário, matriz, histórico de instruções, diffs permitidos, instruções de reprodução e evidências sintéticas sanitizadas. Pode usar subpastas versionadas por run-id, mantendo os dois caminhos de entrega indicados como ponto de acesso à rodada final e sem apagar rodadas anteriores.

Não incluir node_modules, Electron, repositórios pessoais, dados reais, credenciais, caches enormes nem arquivos com conteúdo sensível. Evidências precisam de caminhos relativos válidos no ZIP e hashes. Gerar um índice/manifesto e validar links, schemas, contagens, IDs e integridade. Reabrir o pacote para verificar que o relatório e as evidências estão presentes.

Compare fingerprints de `src/core`, `src/cli` e desktop antes/depois, incluindo fontes não rastreadas preexistentes quando pertinentes. Se houver mudança externa do usuário durante a tarefa, não revertê-la: relatar a concorrência e separar a autoria. Execute typecheck e testes existentes headless pertinentes sem abrir GUI; não alegar suíte completa se rodou subconjunto. Faça a validação final contra o último estado de scripts/documentos da sua entrega. Se houver bloqueio, entregue o relatório completo com resultado honesto e a parte efetivamente implementada.

Na resposta final ao usuário, indique caminhos exatos, o que foi criado, mudanças de AGENTS/documentação, números de especificados/implementados/executados/falhos/adiados, defeitos de produto encontrados sem correção, ausência de alterações no produto e qual ZIP ele deve devolver ao ChatGPT. Não substituir o arquivo completo por um resumo de conversa.

**Execute esta fase de preparação e validação agora. Não peça confirmação para cada comando rotineiro já autorizado. Não prometa trabalho assíncrono; preserve checkpoints e evidências, conclua o máximo viável dentro do escopo e informe qualquer lacuna.**
