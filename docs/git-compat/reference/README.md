# Git Layer — base de documentação e validação v2

**18/10/2026. Substitui o pacote v1 para a próxima tarefa do Codex.**

Agora: documentar, revisar instruções e construir/executar testes headless. Depois: discutir comportamentos desejados e deixar o Codex investigar/implementar o produto com essa base de validação.

**Este ZIP é material de referência. Não contém o runner implementado, nem resultados de execução do Git.** Todos os 344 cenários permanecem SPEC_ONLY / NOT_RUN.

## Conteúdo

| Arquivo | Finalidade |
|---|---|
| `00-COMECE-AQUI.md` | Onde colocar o ZIP e como iniciar no Codex. |
| `INICIAR-NO-CODEX.txt` | Mensagem curta para carregar a missão completa do pacote. |
| `05-Prompt-Codex.md` | Missão completa, autorização, limites e entregáveis. |
| `06-Decisoes-e-Autonomia.md` | Diretrizes U-01 a U-10; o que está decidido e o que é engenharia futura. |
| `01-Estudo-Git-e-Arquitetura-Layers.md` | Estudo revisado, sem impor mecanismo final do produto. |
| `02-Catalogo-Git-v2.md` / `.json` | 161 comandos/ferramentas e 33 guias/interfaces/formatos do recorte upstream v1. |
| `03-Cenarios-Git-Layers-v2.md` / `.json` | 344 roteiros, com os 320 IDs originais e 24 adicionais; escopos explícitos. |
| `04-Protocolo-de-Testes.md` | Oráculos, execução headless, isolamento, rapidez e classificação de resultados. |
| `08-Modelo-de-Relatorio-Completo.md` | Modelo detalhado do relatório de devolução. |
| `09-Guia-Revisao-AGENTS.md` | Autorização e critérios de atualização das instruções locais. |
| `10-Aceite-e-Continuidade.md` | Critérios da preparação e fluxo das próximas funcionalidades. |
| `07-Fontes-e-Proveniencia.md` | Fontes, versões, limites e origem das decisões. |
| `schemas/resultado.schema.json` | Proposta de registro estruturado por variante; adaptar com versão e justificativa. |
| `CHANGELOG-v2.md` | Diferenças do pacote anterior. |
| `VALIDACAO-DO-MATERIAL.json` / `SHA256SUMS.txt` | Validação estática e integridade deste material, não testes Git. |

## Escopo explícito

Git oficial é o alvo. Aplicações externas estão adiadas. Não abrir/alterar editor ou IDE. Não alterar fontes de produto nem migrar dados. O Codex pode revisar AGENTS/docs e criar scripts/testes/configuração de testes. Defeitos do produto serão reproduzidos e documentados, não corrigidos nesta rodada.

A preferência `layers` e a convenção `layer/<nome>` estão registradas. A implementação técnica futura não foi congelada. O Codex deverá distinguir o que o Git faz, o que o protótipo faz e o que o usuário quer que o produto faça.

## Relatório que deverá voltar

O Codex deverá gerar `artifacts/git-compat/RELATORIO-COMPLETO.md` e `artifacts/git-compat/Git-Layers-Relatorio-Validacao-v2.zip` dentro do workspace do projeto. O usuário enviará esse segundo ZIP ao ChatGPT para análise. Ele é diferente do ZIP de referência recebido agora.
