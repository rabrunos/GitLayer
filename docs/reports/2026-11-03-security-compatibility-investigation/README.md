# Investigação de segurança e compatibilidade — 03/11/2026

Investigação do Core/CLI no commit 18d26c18d0c9377141af7704bde50ee32b210465, sem implementação de soluções. **Dois defeitos novos e quatro famílias de risco confirmados**, com 69 registros completos/68 IDs; seis são testes existentes reexecutados. Bypasses e recusas não foram contados como suporte à operação impedida.

- [REPORT.md](REPORT.md): resumo executivo, causas, alcance, respostas às dez questões e prioridades.
- [MATRIX.md](MATRIX.md) e [MATRIX.json](MATRIX.json): cenários, comandos, resultados e classificação.
- [EVIDENCE.json](EVIDENCE.json): observações compactas, snapshots, fingerprints e hashes dos registros detalhados.
- [OPTIONS.md](OPTIONS.md): quatro estratégias, dez dimensões, critérios de aceitação e decisões pendentes.
- [REPRODUCTIONS.md](REPRODUCTIONS.md): reproduções seguras e script documental portátil.
- [VERIFICATION.json](VERIFICATION.json): preservação, validação e protocolo da publicação documental.

R-02/R-03 permanecem corrigidos nos seis testes atuais. Os novos P0 são atribuição incorreta após renomeação e baseline de edição inválida sob concorrência. Git direto pode sobrescrever/limpar projeções físicas; reservas são opt-in e worktrees reais. Recomendação: fortalecer operações gerenciadas e combinar recursos nativos com alcance explícito; manter protect opcional até decisão. Nenhuma proteção nova, contrato, teste existente, migração, release ou componente desktop foi alterado.
