# Fontes e benchmarks intermediários current-v6

Esta página preserva o candidato medido **antes das correções de integridade identificadas depois da campanha**. Os resultados são observações históricas; não certificam o código final.

A revisão confirmou uma regressão no índice transitório: o horário novo da cópia podia ocultar uma edição dentro da janela de stat do Git. Também confirmou uma janela anterior à etapa 2 na desativação, em que uma edição posterior à consulta limpa podia ser removida sem descarte explícito. A comparação e a correção desses achados estão sendo registradas em [RESULTS.md](RESULTS.md), [RECOVERY.md](RECOVERY.md) e no relatório principal. Nenhum ganho desta versão autoriza enfraquecer essas garantias.

## Cópias exatas dos resultados

Os dois arquivos abaixo são cópias byte a byte, sem editar métricas, classificações, títulos ou referências históricas:

| Arquivo | Bytes | SHA256 |
| --- | ---: | --- |
| [BENCHMARKS-INTERMEDIATE-V6.md](BENCHMARKS-INTERMEDIATE-V6.md) | 23.959 | `13f7c387c373e078bc79deb0b733b1cfae01b4ab0f8780f6559e7ab75642f06d` |
| [BENCHMARKS-INTERMEDIATE-V6.json](BENCHMARKS-INTERMEDIATE-V6.json) | 1.851.021 | `445abc5edc2aab5485b46a3b367ace2cbeaf3a6e8a444531f903359428365718` |

O título histórico “finais” e os links relativos internos do Markdown foram preservados para manter a cópia exata. Para consultar os dados correspondentes, use o JSON intermediário explicitamente vinculado nesta página. Referências como `BENCHMARKS.json` ou `RESULTS.md` dentro da cópia podem passar a apontar para documentos de rodadas posteriores; não associam essas rodadas às fontes intermediárias.

As medições principais de 90 minutos e o suplemento independente de dez Layers permanecem separados. Não foram repetidos benchmarks ou testes de produto para produzir este arquivo de preservação.

## Fontes reconstruíveis

- Baseline: commit `d71ccc7d188500a22e56ea93c70ac946dba9db60`, 16 arquivos Core, fingerprint `49e48c0604fbbf37587f7eee5b1b7b4dad8fcb1f6712c3318626e9f79a43fe4b`.
- Candidato imutável `current-v6`: 17 arquivos Core, fingerprint `aab512270756d7888e5c1af60df6cc4b17d08a4376f4161552190a7115d32b35`.
- Conjunto funcional arquivado: 205 entradas, fingerprint `f72502adcfd332e3109ad3e82ec845731f376cfc41d5e4a44be5ce89a6c4a825`.
- CLI: um arquivo, 27.035 bytes, SHA256 `345a04436519f740e017cfc0ada8f1359d6ea2d454f897f81a19ef29f03b442c`, idêntico à baseline. A latência da CLI não foi medida nesta campanha.

O [manifesto de fontes](CORE-INTERMEDIATE-CURRENT-V6.json) identifica os bytes e hashes de todos os arquivos e a relação com o arquivo funcional congelado. O [patch bruto](CORE-INTERMEDIATE-CURRENT-V6.patch) contém as cinco diferenças Core, incluindo o novo módulo de índice transitório: 129.912 bytes, SHA256 `f47a8c738416784ba33657bc7010981290f01b99509a81affe7de936130b038e`.

A [prova de aplicação oficial](CORE-INTERMEDIATE-CURRENT-V6-APPLY.json) executou `git apply --check` e `git apply` em outra fixture externa independente. Os 17 caminhos, tamanhos e SHA256 resultantes coincidiram exatamente com o snapshot imutável. A configuração isolada usou `core.autocrlf=false`; não houve normalização de CRLF/LF, correção de whitespace, tolerância de bytes, remotos ou mudanças de configuração real.

Essa prova certifica somente a reconstrução das fontes históricas. Não é validação funcional, benchmark adicional nem aprovação dos defeitos de integridade.
