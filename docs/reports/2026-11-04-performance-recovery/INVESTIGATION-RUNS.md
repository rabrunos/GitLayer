# Campanhas intermediárias de investigação

Este índice preserva os resultados da investigação anterior à correção de consultas. Não soma execuções, não substitui a campanha final e não converte falhas em SKIP ou ENV_BLOCKED. Os [dados estruturados](INVESTIGATION-RUNS.json) contêm hashes e proveniência; a análise técnica está em [INDEX-QUERY.md](INDEX-QUERY.md).

| Execução | Classificação | Resultados comprovados | Limite |
| --- | --- | --- | --- |
| focus-01 | FAIL; encerrada por decisão controlada | 87 resultados de topo reportados: 85 ok e 2 falhas | Sem totais finais TAP; restante NOT_COMPLETED. Não é suíte completa. |
| status1200-01 | FAIL | Core.status terminou safe=true; alocação posterior do processo foi observada externamente | Processo próprio interrompido; sem resumo de teste concluído. |
| status1200-02 | FAIL | Um teste executado, uma falha: índice privado com bytes divergentes | Observador limitado preservou a comparação exata; não corrigiu o produto. |
| bounded-assert-unit-01 | PASS de infraestrutura intermediária | 6 PASS, 0 FAIL, 0 SKIP; hashes de três entradas inalterados | Helper, teste unitário e dependência direta; não certifica Core nem campanha final. |
| R-02/R-03 isolados após diagnóstico | PASS no escopo do arquivo | 6 PASS, zero FAIL/SKIP/cancelamento; fontes inalteradas | O FAIL original permanece registrado; não substitui a suíte integral. |
| Consultas corrigidas: gate dirigido | PASS parcial de escopo | 25 PASS, zero FAIL/SKIP/cancelamento; fontes inalteradas | Full e benchmarks finais PENDING. |
| Fontes finais completas | PENDING | Nenhuma aprovação antecipada | Validação e benchmarks finais terão seus próprios recibos. |

As duas falhas do foco original foram:

- O caso de 1200 caminhos: RangeError, Array buffer allocation failed, após 325.223,8546 ms de teste. A investigação isolada localizou uma divergência persistente de bytes do índice e a expansão do formatador de erro do Node.
- R02 target preserves ignored intention from global: GIT_FAILED, Git com código 3221225773 (0xC000012D), após 35.906,236 ms de teste. A reprodução posterior do arquivo terminou com seis PASS; o FAIL original não foi reclassificado por hipótese de ambiente.

O código 0xC000012D corresponde a STATUS_COMMITMENT_LIMIT na [tabela oficial Microsoft MS-ERREF](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-erref/596a1078-e883-4972-9bbc-49e60bebca55). Ele identifica limite de memória comprometida; a causa exata do primeiro teste R-02 não é atribuída sem comparação temporal suficiente. Nenhuma configuração global ou de memória do sistema foi alterada.

O foco e as duas reproduções usam o fingerprint funcional aa87896721bd2c2347c95b3b7dadef163b636e9fc6c95fe3493497baa9050dca, com 201 entradas e igualdade antes/depois. Esse snapshot é histórico e precede a correção por índice transitório e as asserções limitadas permanentes. As durações acima pertencem aos testes instrumentados e não são latências de benchmark do produto.

O encerramento controlado preservou o supervisor e sinalizou somente a árvore própria comprovada por identidade, parentesco e command line; as evidências originais e fixtures pertinentes foram preservadas. O helper histórico de R-02 podia limpar sua fixture na falha, o que limita aquela evidência. As entradas restantes do corpus não concluído não recebem aprovação.

O controle das asserções limitadas foi executado separadamente, em ambiente próprio isolado. A suíte final deve repetir seus seis testes. Nenhum resultado parcial deste índice deve ser somado a uma repetição para construir um denominador final.
