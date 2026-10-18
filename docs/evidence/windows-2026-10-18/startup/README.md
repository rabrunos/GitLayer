# Abertura nativa pelo lançador — 18/10/2026

- `hidden-before.json`: inspector da reprodução, com página carregada e janela invisível.
- `native-window-launch.json`: Dev normal e Abrir no workspace padrão; título/handle visível e encerramento com código 0.
- `dev-session.json`, `dev-session.log.txt` e `dev-verified.png`: teste Debug aprovado após as correções, com janela visível, inspectors, atualização e recuperação de rascunho em fixture descartável.
- `dev-session-before-notification-fix.json` e `.log.txt`: reteste que expôs o reinício duplicado antes da comparação de conteúdo.
- `check-typecheck.json`, `check-test-unit.json` e `check-verify-maps.json`: verificações complementares com códigos de saída.
- `SOURCE-HASHES.json`: hashes das fontes e configurações alteradas nesta correção; o snapshot da pasta superior permanece como evidência da execução anterior.

A captura do renderer complementa a consulta de visibilidade; sozinha ela não prova que a janela aparecia na área de trabalho. Não foi usado controle visual do PC. As cópias `.log.txt` usam finais de linha LF; os logs originais permanecem em `.workshop/reports`.
