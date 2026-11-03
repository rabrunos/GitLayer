# Modelo do relatório completo para devolução ao ChatGPT

**MODELO NÃO PREENCHIDO. Nenhum item deste arquivo é resultado observado.**

O Codex deve produzir `artifacts/git-compat/RELATORIO-COMPLETO.md`, autossuficiente, preenchido por evidências, e empacotá-lo com os anexos em `artifacts/git-compat/Git-Layers-Relatorio-Validacao-v2.zip`.

O Markdown principal deve permitir entender a tarefa e todas as conclusões sem o computador original. Evidências volumosas podem estar em anexos relativos. Conteúdo sintético de fixtures pode ser incluído; arquivos e segredos reais não. Não preencher números estimados, copiar aprovações do relatório antigo ou escrever apenas “tudo passou”.

## 1. Identificação

Registrar nome/versão da entrega, data/hora com fuso, run-id, tarefa/brief e hashes; projeto/branch/SHA inicial e final; fingerprints das fontes, testes, configuração e catálogo; ambiente/runtime e versão do runner. Diferenciar SHA commitado de alterações locais não commitadas.

## 2. Resumo executivo

Responder em texto: o que foi preparado, o que realmente executou, quais problemas do produto foram encontrados e não corrigidos, o que impede uma afirmação de compatibilidade, e se a base está utilizável para começar a discutir/implementar futuras funcionalidades.

Expor em tabela números separados de comandos, opções, cenários, variantes, escopos, falhas e lacunas. Não confundir os 344 roteiros do pacote com 344 testes implementados ou aprovados.

## 3. Escopo autorizado e limites preservados

Listar mudanças permitidas e realizadas, e confirmar por evidência que não houve alteração do Core/CLI/desktop, migração, mudança de refs do produto, instalação de interceptação nem publicação remota. Se houve interferência externa durante a tarefa, descrevê-la e separar autoria sem revertê-la.

Indicar em quais tarefas futuras a proibição desta rodada deixará de valer. Não transformar escopo pontual em regra permanente.

## 4. Estado inicial e final do workspace

Status inicial/final, arquivos previamente alterados, delta atribuível à tarefa, hashes das fontes protegidas, branch/SHA e efeitos de scripts utilizados. O registro deve demonstrar que dados da demonstração e arquivos pessoais não foram utilizados como fixtures destrutivas.

## 5. Ambiente e capacidades

Git absoluto e `version --build-options`, runtime, SO, arquitetura, filesystem, shell/PTY, capacidades de hash/ref/topologia e ferramentas oficiais opcionais. Identificar o que estava instalado e o que foi instalado para testes, com justificativa e versões.

Não certificar outro SO por leitura de código. Diferenciar comando disponível, capacidade testada e capacidade ausente. Não registrar variáveis de ambiente/credenciais indiscriminadamente; relatar apenas configuração sintética relevante.

## 6. Fontes e estudo do Git

Catálogo upstream fixado e inventário local, diferenças, novas entradas, comandos externos separados, manuais/fichas examinados e lacunas em opções. Para cada conclusão relevante, indicar fonte oficial e versão ou evidência da fixture.

Registrar o que foi atualizado do estudo v1/v2 e por quê. Uma fonte apontada para pesquisa posterior não deve aparecer como integralmente estudada.

## 7. Documentação reorganizada

Inventário de novos/alterados/movidos documentos, finalidade e links. Separar fatos do Git, estado implementado do projeto, comportamentos U-xx, alternativas técnicas e hipóteses. Explicar como a documentação será mantida em novas rodadas.

## 8. AGENTS e regras

Tabela de regra antiga → regra atual/destino → razão → requisito de origem → proteção mantida. Anexar diff local. Explicar a separação Core/CLI versus editor e demonstrar que nenhuma decisão histórica virou proibição imutável ou remoção de segurança.

## 9. Infraestrutura implementada

Arquivos e responsabilidades do runner, fixtures, oráculos, build headless, seleção, logs, relatórios, reprodução, geração de casos e cleanup. Identificar as decisões técnicas tomadas pelo Codex e por que foram adequadas.

Distinguir código executável de manifestos ainda documentais. Informar quais scripts/entradas de package.json existem e os comandos completos para usá-los; não listar interfaces aspiracionais como prontas.

## 10. Matriz completa por ID

O corpo ou anexo Markdown navegável deve conter **todos os 344 IDs**, sem omitir adiados. Colunas mínimas: ID/título; família/comando; requisito/origem; escopo; implementação; variantes; selecionado; execução; cobertura de produto; conhecido/inesperado; evidência ou razão de não execução; reprodução.

Cada variante executada precisa ter registro estruturado com contexto/fingerprint. Cada roteiro não executado precisa de uma razão específica. Se forem criados IDs adicionais, incluir também, mantendo histórico e contagens consistentes.

## 11. Resultados por rodada

Para cada run-id: seleção, duração, fontes/build/testes, número de selecionados/omitidos/executados, saídas, falhas, retentativas e relação com a rodada final. Não juntar resultados de snapshots distintos sem rótulo de proveniência.

O reteste depois da última alteração precisa estar identificado. Falha antes de correção de infraestrutura não desaparece da linha do tempo. Registrar explicitamente se o conjunto amplo não foi repetido.

## 12. Resultados por família e comando

Tabela por família, principais opções examinadas, etapas e estados. Separar cenário de variante. Mostrar cobertura nativa versus cobertura do produto. O relatório deve evidenciar áreas não estudadas mesmo que todos os nomes de comando tenham sido mapeados.

## 13. Ficha detalhada de falha ou lacuna

Para cada item material usar um ID de achado, por exemplo `FINDING-0001`. Incluir:

- Categoria: infraestrutura/teste, produto, ambiente, requisito indefinido ou item fora do escopo.
- Severidade e grau de confiança, com explicação (não confundir hipótese com bug reproduzido).
- IDs/variantes afetados; versão, configuração e pré-condições exatas.
- Setup/reprodução mínima, argv/stdin/cwd sintéticos e seed quando existir.
- Expectativa e origem: manual do Git, contrato atual ou requisito U-xx.
- Resultado observado: estado, código/timeout/sinal e diferenças concretas.
- Evidências relativas e hashes; trecho mínimo de saída útil.
- Causa confirmada ou hipótese técnica; arquivos/linhas quando inspecionados.
- Impacto real demonstrado, distinguindo risco potencial de perda efetiva.
- Ação nesta rodada: correção de infraestrutura com antes/depois, ou registro sem mudança do produto.
- Trabalho futuro necessário e qual teste deverá comprovar a solução.

Não exigir implementar a correção futura nesta tarefa. Não usar um diagnóstico inconclusivo como prova de segurança.

## 14. Hipóteses da revisão anterior

Tabela com cada hipótese recebida, estado CONFIRMADA/REFUTADA/PARCIAL/NAO_REPRODUZIDA, condições, IDs, evidências e limites. Ex.: metadados inválidos e resgate, lock abandonado, tamanho do journal, capture/off/cancel, ref externa e escala. A hipótese refutada precisa de contexto; ausência de um erro numa única execução não prova impossibilidade.

## 15. Testes do próprio harness

Falhas deliberadas e resultado esperado/observado: assertion falsa, filho pendurado, timeout, setup inválido, cleanup recusado, evidência faltante, JSON inconsistente, seleção/capacidade e origem de build. Provar que os controles negativos foram detectados e não confundidos com defeitos do produto.

## 16. Desempenho e execução frequente

Tempos medidos, contagem de subprocessos, tamanhos de fixtures, concorrência e gargalos. Quando houver várias amostras, registrar distribuição; não inventar percentis com uma única medição. Comparar perfis pequenos e amplos com o mesmo contexto.

Dar comandos reais para ciclo curto, área afetada, amplo headless, stress e reprodução de falha. Nenhuma promessa de que centenas de casos ou todo Git rodam instantaneamente.

## 17. Segurança e limpeza

Raízes de fixture, critérios de propriedade, destino de evidências, processos criados/encerrados, ausência de acesso a remotos pessoais e revisão de segredos. Dados úteis à falha podem ser exportados de forma sanitizada. Declarar qualquer fixture/processo que permaneceu e o motivo, com escopo exato; não alegar limpeza sem conferir.

## 18. Pendências e próximos comportamentos

Separar prioridades técnicas detectadas de decisões de produto que aguardam o usuário. Confirmar que a convenção `layer/<nome>` não foi substituída e `layers/` não foi migrado. Identificar U-07 (ativar/desativar versus selecionar branch) como requisito investigado, não solução implementada sem prova.

Listar áreas em que o Codex poderá pesquisar/implementar na próxima tarefa com autonomia, sem pedir ao usuário detalhes de engenharia comuns. A decisão de qual funcionalidade implementar continua sendo do usuário.

## 19. Guia de reprodução e continuidade

Sequência mínima para preparar o runner a partir das fontes entregues; comandos por ID/seed; versão/capacidades; como consultar resultados; como adicionar um requisito de comportamento, ligar cenários, executar testes e entregar novo relatório. Não usar interface gráfica.

## 20. Índice de anexos e auditoria final

Links relativos para resultados JSON/JSONL, inventário, cobertura, diário, evidências, diffs de docs/scripts/AGENTS, fingerprints e verificação estática. Hashes e tamanhos dos arquivos. Relatar abertura/verificação do ZIP final, ausência de caminhos absolutos quebrados nos links e consistência de todas as contagens.

Terminar com parecer delimitado: infraestrutura utilizável ou não, bloqueios objetivos e o que ainda falta testar. Não declarar Git Layer pronto para o público como efeito automático de concluir esta etapa.
