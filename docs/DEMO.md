# Demonstração descartável com Git real

Crie uma pasta nova ou vazia escolhida para o teste:

```sh
npm run demo -- "/caminho/novo/git-layers-demo"
```

O script recusa pasta não vazia e caminhos que atravessem links simbólicos. Só cria Git local e configura identidade **nesse repositório de demonstração** (`Git Layers Lab Demo`, `demo@example.invalid`). Não cria remotos nem executa os scripts de exemplo. Se uma etapa falhar, preserva a pasta para inspeção e informa a falha.

Abra a pasta criada no desktop, ou execute os exemplos abaixo dentro dela com a CLI local já habilitada. Consulte `CLI.md` para o `PATH` temporário ou acrescente `--cwd <pasta>` à execução direta.

| Origem | Arquivos principais |
|---|---|
| `main` | `README.md`, `src/app.ts`, `package.json` |
| `dev` | Variação compatível de `src/app.ts` |
| `collision-demo` | Base que possui `scripts/debug.py`, em colisão proposital |
| `layer/ai` | `AGENTS.md`, `.codex/config.toml` |
| `layer/scripts` | `scripts/debug.py`, `tools/analyze.py` |

O estado inicial é `HEAD -> main`, duas Layers ativas e limpas. As Layers têm históricos independentes da base. O `package.json` da demonstração contém somente dados, sem comandos executáveis.

## 1. Confira a composição

```sh
git symbolic-ref --short HEAD
git layer list
git layer status
git layer doctor --fsck
git ls-tree -r --name-only main
git ls-tree -r --name-only layer/ai
git ls-tree -r --name-only layer/scripts
```

Os arquivos das três origens aparecem fisicamente no mesmo diretório. Inspecionar ou selecionar uma Layer no painel não muda o `HEAD` real.

## 2. Prepare três destinos diferentes

No editor, modifique `README.md`, `AGENTS.md` e `scripts/debug.py`, depois salve cada arquivo. Prepare os destinos explicitamente:

```sh
git layer base-add -- README.md
git layer add ai -- AGENTS.md
git layer add scripts -- scripts/debug.py
git layer diff base --staged
git layer diff ai --staged
git layer diff scripts --staged
```

Agora edite e salve `scripts/debug.py` outra vez, **sem preparar de novo**. O painel da Layer scripts deve mostrar conteúdo staged e mudanças posteriores unstaged.

```sh
git layer commit ai -m "Instruções alteradas"
git layer commit scripts -m "Somente a versão preparada"
git layer base-commit -m "README da base"
git layer status
```

O commit da Layer scripts contém a versão preparada; a segunda edição permanece no disco como unstaged. Os commits de Layers não avançam `main`.

## 3. Demonstre o Git tradicional

Crie e salve `arquivo-normal.txt`, depois execute:

```sh
git add .
git diff --cached --name-only
git layer status
```

O arquivo normal é preparado na base. Os arquivos ativos das Layers ficam excluídos pelos padrões locais exatos no cenário suportado. O aplicativo valida essa proteção; regras de negação conflitantes suspendem operações. Não use `-f`, `clean -fdx` ou `reset --hard` para esse fluxo.

Conclua o staging da base antes da troca de branch:

```sh
git layer base-commit -m "Arquivo normal da demonstração"
```

## 4. Capture somente arquivos criados durante a sessão

Antes da captura, crie `scripts/preexistente.py`. Depois inicie:

```sh
git layer capture scripts --path scripts
```

Enquanto a captura estiver ativa, crie `scripts/novo capturado.py` em outro terminal ou no desktop. Volte à CLI e pressione **q**. A revisão deve listar o arquivo novo, sem oferecer `preexistente.py` apenas por ele existir ou ter sido editado. Selecione o número do candidato e confirme com `sim`.

```sh
git layer status scripts
git layer unstage scripts -- "scripts/novo capturado.py"
```

O arquivo permanece reservado à Layer após unstage. Para abandoná-lo explicitamente, sem apagá-lo:

```sh
git layer release scripts -- "scripts/novo capturado.py"
```

Depois da confirmação ou cancelamento, novos arquivos voltam ao fluxo normal da branch tradicional. Uma nova captura seguida de Ctrl+C deve preservar os arquivos sem atribuí-los.

## 5. Guarde e recupere alterações

Edite um arquivo da Layer scripts; prepare uma versão e depois salve outra edição. Crie também um novo arquivo e prepare-o nessa Layer. Observe o status antes de guardar:

```sh
git layer status scripts --json
git layer off scripts --park
git layer list
git layer on scripts
git layer status scripts --json
```

Os arquivos próprios saem e retornam ao workspace. As distinções entre staged, unstaged e reservas devem ser as mesmas. O stash da base não participa. Arquivos da base e da outra Layer não são removidos de diretórios compartilhados.

No desktop, salve ou cancele buffers pendentes antes de ações que rematerializam arquivos. Rascunhos de recuperação do editor contêm o texto local; consulte as limitações de privacidade e retenção na documentação.

## 6. Troque a base e provoque uma colisão

Com a base tracked limpa:

```sh
git layer switch dev
git layer status
git layer switch main
git layer switch collision-demo
```

A troca para `dev` é compatível e mantém a composição. A tentativa de `collision-demo` deve falhar antes de alterar `HEAD`, pois base e Layer scripts disputam `scripts/debug.py`, mesmo se os bytes coincidirem. Confira:

```sh
git symbolic-ref --short HEAD
git layer doctor
```

Se quiser visitar a branch de colisão, guarde/desative a Layer scripts explicitamente primeiro. Reativá-la nessa branch deve continuar recusando a colisão sem destruir a shelf.

## Limites do roteiro

É um laboratório para repositório descartável, não um isolamento contra qualquer programa externo. O editor não executa o Python, TypeScript, HTML ou a configuração TOML abertos como texto. Não há rede. A demonstração só comprova os comportamentos registrados nos testes efetivamente executados em `TEST-REPORT.md`; não comprova outras plataformas nem proteção contra bytes que nunca tenham sido preservados.
