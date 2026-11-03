# Revisão das instruções do repositório — v2

**Autorizada pelo usuário nesta rodada. Este arquivo não substitui automaticamente o AGENTS existente.**

## 1. Por que revisar

O AGENTS consultado apresenta o projeto principalmente como workshop Electron, com instruções de Dev/F5 e testes gráficos. Ele também descreve contratos e limitações atuais do protótipo. Essa descrição é útil para o laboratório, mas não deve obrigar a abrir uma interface para desenvolver o produto de Core/CLI nem eternizar cada restrição técnica. [P05]

Não é necessário que o ChatGPT altere previamente o GitHub. O prompt do usuário autoriza o Codex a revisar localmente o AGENTS e as demais instruções como parte da tarefa, mantendo a trilha de mudanças.

## 2. Procedimento

Ler AGENTS da raiz e instruções aplicáveis às subpastas. Registrar conteúdo/hash inicial. Classificar cada regra como proteção de dados/evidência, fluxo do editor, estado implementado, direção de produto ou regra histórica superada. Alterar com parcimônia estrutural, não por remoção indiscriminada.

O Codex pode reorganizar documentos e criar instruções com escopo mais adequado. Não é obrigatório usar nomes de arquivos propostos aqui; preservar links corretos e uma fonte inequívoca de regras vigentes.

Criar um registro legível de mudança: regra anterior; interpretação; nova redação ou destino; justificativa; origem na mensagem/decisão U-xx; escopo e efeito. Um diff bruto deve acompanhar, mas não substituir a explicação.

## 3. O que o AGENTS raiz deve comunicar

O produto principal é Git Layer Core/CLI para o Git oficial. O desktop é ferramenta auxiliar e só será alterado/testado graficamente mediante tarefa específica. A validação de domínio ocorre por comandos headless, com Git real e oráculos independentes.

O repositório informa o estado atual; requisitos aprovados informam o comportamento desejado. Arquivos que descrevem limitações não são um veto permanente. Decisões técnicas podem ser revistas pelo Codex durante uma implementação autorizada, com evidência de preservação dos contratos.

O fluxo futuro deve ser: entender a tarefa de comportamento, investigar alternativas, definir critérios observáveis, implementar dentro do escopo, executar testes proporcionais ao risco e registrar resultados. Não exigir que o usuário escolha detalhes técnicos comuns nem impor que toda ideia futura siga exatamente o mecanismo do protótipo.

Na rodada atual, a autorização é apenas infraestrutura/documentação/testes. Essa restrição deve ficar em documento de tarefa ou texto condicionado à rodada, não como regra global “nunca altere Core/CLI”.

## 4. Exemplos de classificação, não texto para copiar cegamente

| Tipo de orientação antiga | Tratamento recomendado |
|---|---|
| Comece abrindo Dev/F5/Electron | Pertence ao desenvolvimento do desktop. Não é pré-requisito do Core/CLI. |
| O projeto é só um laboratório descartável | Descrever a maturidade da versão atual sem reduzir o objetivo do produto público. |
| Atualmente hooks/worktrees/operações avançadas são recusados | Manter como estado implementado e cobertura, não como restrição imutável da arquitetura futura. |
| Não use Git simulado para certificar domínio | Preservar. Mocks da infraestrutura são aceitáveis nos seus próprios testes, não como prova do Git. |
| Nunca sobrescreva trabalho do usuário/locks disputados para limpar erro | Preservar proteção. Um futuro procedimento de recuperação deve ser investigado e validado, não improvisado. |
| Não faça rede alguma | Distinguir publicação/serviços reais de transporte de teste autorizado entre fixtures locais. |
| Não redefina requisito aprovado para fazer o teste passar | Preservar. Rever expectativa errada exige fonte/contrato e histórico de decisão. |

## 5. Proteções a manter

Preservar arquivos existentes, configuração/credenciais pessoais, isolamento de fixtures, honestidade de testes, Git nativo como fonte de semântica, cuidado com migrações, evidências de falha e não publicação sem tarefa autorizadora. Manter o desktop isolado e suas proteções de segurança; esta tarefa não precisa tocá-lo.

Não converter uma falha de teste em skip por conveniência. Não chamar uma feature ausente de ambiente ausente. Não editar asserções para reproduzir uma corrupção conhecida. Não apagar evidência para produzir uma narrativa limpa.

A autorização para revisar um arquivo AGENTS do projeto não autoriza ignorar instruções superiores ou políticas da plataforma. O histórico local não deve ser reescrito nem mudanças do usuário descartadas.

## 6. Critérios verificáveis

O relatório deve mostrar que as novas instruções distinguem produto/editor; que nenhuma inicialização GUI é exigida para Core/CLI; que os limites históricos foram reclassificados com precisão; que autonomia técnica futura foi preservada; que regras de segurança/evidência permanecem; e que links e documentos apontam para a versão correta.

Não afirmar que um mecanismo futuro já existe porque foi descrito no AGENTS. Este é guia de trabalho, não implementação.

Fonte do estado consultado: [P05] em `07-Fontes-e-Proveniencia.md`. Decisões atuais: U-01 a U-10 em `06-Decisoes-e-Autonomia.md`.
