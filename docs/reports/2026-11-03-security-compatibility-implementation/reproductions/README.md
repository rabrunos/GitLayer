# Reproduções históricas de D-01

Estas receitas reproduzem defeitos de fontes intermediárias do Git Layer em repositórios descartáveis. Não são correções nem devem ser executadas em dados reais. As duas receitas 49BA ESM V2 foram executadas e tiveram os efeitos históricos confirmados por observadores independentes. A [evidência compacta](../d01-evidence/RECIPES49BA-RUNTIME.json), SHA-256 `114621a312d33c2d8c23faf660e89ae15b786112fe9ce9b6dcb524f8b329edb3`, conserva proveniência, classificação, objetos, índices, tempos e hashes dos registros.

## Arquivos e fontes

Mantenha os arquivos do harness numa cópia própria fora de repositórios Git:

| Arquivo | SHA-256 |
| --- | --- |
| [ack-rollback49ba-eio.test.ts](ack-rollback49ba-eio.test.ts) | `28229464e5fa118b762a1dc50acb0860125df167a584ad7ce990eae58c2baf97` |
| [ack-rollback49ba-noeio.test.ts](ack-rollback49ba-noeio.test.ts) | `d5f247712e89651a8406d4e7083c429047f30073a84f486e8da23e81288f51e8` |
| [package.json](package.json) | `3ca9d4afd21425087cf31893b8f9f63c81b0b8408db5e343ca76e5f8aa26ab9a` |
| [SOURCE-MANIFEST49BA.json](SOURCE-MANIFEST49BA.json) | `966a21ce8f1740872e1f5d5e8445071ea25cddf9e2508e00768b903272986ff7` |
| [SOURCE-MANIFEST6994.json](SOURCE-MANIFEST6994.json) | `16ca59a351a470a97167a2c3cff4d795a7722ee55c7e51b303a490b799b20f52` |

O package adjacente aos testes contém `{"type":"module"}`. Ele estabelece o contexto ESM do harness; não substitua o package da fonte histórica. A execução V1 sem esse contexto falhou ao transformar top-level await como CJS, antes de importar o produto.

Obtenha a fonte pela [cadeia estática ACE17 →6994 →49BA](../acknowledgement-reconstruction/CHAIN-PLAN.md). Confira os183 caminhos e hashes em cada etapa. Os manifestos registram somente file/sha256; confira modos separadamente nos metadados Git, patches e recibos, sem inferi-los do fingerprint. A fonte executada precisa corresponder a `49ba56cd980e339bd00770d8b4a294914b7b30236923da79008b966961567d09`, um fingerprint funcional intermediário sem commit próprio, não o commit `e7f245a`. Se a origem disponível tiver outro fingerprint, essa ponte não se aplica diretamente a ela. Os testes verificam o domínio 183 antes de importar o Core e ao terminar.

A cópia histórica, o harness e os pais de fixtures precisam ser diretórios próprios independentes, sem `.git`, links ou hardlinks, fora de qualquer repositório e sem ancestralidade entre si. Use dependências instaladas pelo lockfile numa cópia própria e o caminho absoluto do Git oficial. O loader observado foi `tsx/dist/loader.mjs`, SHA-256 `17e2a92c5f1f70065b01c65d5ee9ac260839d4fc0ea78fdbb4db7b1155ccd32f`. A fonte ACE17 corrente serviu apenas de origem de loader/dependências na validação: o Core importado era 49BA independente.

## Preparação e chamada por subprocesso

Cada caso exige dois pais novos e vazios diferentes, com caminhos curtos:

- O pai de controle recebe uma fixture própria para HOME, configurações Git sintéticas, temporários e logs.
- `GL_REPRO_PARENT` é exclusivamente o pai das fixtures do teste. Ele precisa continuar vazio até o bootstrap do candidato; não crie HOME, marker de controle ou logs nele antes da chamada.

Não altere HOME, PATH ou Git global do processo do usuário. Passe o ambiente isolado somente ao subprocesso. Os repositórios de teste são criados pelo candidato; a preparação de controle não inicializa um repositório Git. Todas as fixtures e evidências ficam preservadas.

O exemplo ESM abaixo é novo e declarativo: ilustra essa preparação, não é o controlador byte a byte que produziu os recibos citados e não foi executado nesta preparação documental. Os dois testes V2 e o package listados acima, com aqueles hashes exatos, foram efetivamente executados.

```javascript
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 6,
  'source49ba gitExe loader.mjs controlParent fixtureParent testFile: todos absolutos');
const [sourceArg, gitArg, loaderArg, controlArg, fixtureArg, testArg] = args;
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function directory(value) {
  assert(path.isAbsolute(value));
  for (let current = value; ; current = path.dirname(current)) {
    const stat = fs.lstatSync(current);
    assert(stat.isDirectory() && !stat.isSymbolicLink());
    assert(!fs.existsSync(path.join(current, '.git')), 'Diretório dentro de Git');
    assert(!(fs.existsSync(path.join(current, 'HEAD')) &&
      fs.existsSync(path.join(current, 'objects')) &&
      fs.existsSync(path.join(current, 'refs'))), 'Ancestral parece bare Git');
    if (path.dirname(current) === current) break;
  }
  return fs.realpathSync(value);
}
function regularFile(value) {
  assert(path.isAbsolute(value));
  const stat = fs.lstatSync(value);
  assert(stat.isFile() && !stat.isSymbolicLink());
  return fs.realpathSync(value);
}
const source = directory(sourceArg), controlParent = directory(controlArg);
const fixtureParent = directory(fixtureArg), testFile = regularFile(testArg);
const harness = directory(path.dirname(testFile));
const dirs = [source, controlParent, fixtureParent, harness];
const contains = (a, b) => {
  const relative = path.relative(a, b);
  return relative === '' || (relative !== '..' &&
    !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
};
for (let i = 0; i < dirs.length; i++) for (let j = i + 1; j < dirs.length; j++)
  assert(!contains(dirs[i], dirs[j]) && !contains(dirs[j], dirs[i]));
assert.equal(fs.readdirSync(controlParent).length, 0);
assert.equal(fs.readdirSync(fixtureParent).length, 0);
const scripts = {
  'ack-rollback49ba-eio.test.ts': '28229464e5fa118b762a1dc50acb0860125df167a584ad7ce990eae58c2baf97',
  'ack-rollback49ba-noeio.test.ts': 'd5f247712e89651a8406d4e7083c429047f30073a84f486e8da23e81288f51e8'
};
assert(scripts[path.basename(testFile)], 'Receita desconhecida');
assert.equal(hash(testFile), scripts[path.basename(testFile)]);
assert.equal(hash(path.join(harness, 'package.json')),
  '3ca9d4afd21425087cf31893b8f9f63c81b0b8408db5e343ca76e5f8aa26ab9a');
const manifestFile = path.join(harness, 'SOURCE-MANIFEST49BA.json');
assert.equal(hash(manifestFile),
  '966a21ce8f1740872e1f5d5e8445071ea25cddf9e2508e00768b903272986ff7');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const lib = path.join(source, 'scripts/git-compat/lib.mjs');
assert.equal(hash(lib), manifest.inputs.find(e => e.file === 'scripts/git-compat/lib.mjs').sha256);
const git = regularFile(gitArg), loader = regularFile(loaderArg);
assert.equal(hash(loader), '17e2a92c5f1f70065b01c65d5ee9ac260839d4fc0ea78fdbb4db7b1155ccd32f');
const { createFixture, isolatedEnvironment } = await import(pathToFileURL(lib).href);
const control = createFixture(controlParent, 'r49-control');
const env = { ...isolatedEnvironment(control.root, git),
  GL_REPRO_SOURCE: source, GL_REPRO_PARENT: fixtureParent, GL_REPRO_GIT: git };
assert.equal(fs.readdirSync(fixtureParent).length, 0, 'Controle não pode ocupar o pai do teste');
const result = spawnSync(process.execPath, [
  '--import', pathToFileURL(loader).href,
  '--test-reporter=spec', '--test-reporter-destination=stdout',
  '--test-reporter=tap', '--test-reporter-destination=stderr',
  '--test', '--test-concurrency=1', '--test-timeout=900000', testFile
], { cwd: source, env, shell: false, windowsHide: true, encoding: 'utf8',
  timeout: 950000, maxBuffer: 4 * 1024 * 1024 });
fs.writeFileSync(path.join(control.root, 'stdout.log'), result.stdout ?? '', { flag: 'wx' });
fs.writeFileSync(path.join(control.root, 'stderr.log'), result.stderr ?? '', { flag: 'wx' });
const summary = { status: result.status, signal: result.signal,
  error: result.error && { code: result.error.code, message: result.error.message } };
fs.writeFileSync(path.join(control.root, 'process.json'),
  JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
console.log({ control: control.root, fixtureParent, ...summary });
if (result.error || result.status !== 0) throw Error('Chamada falhou; preserve e examine os registros');
console.log('Chamada encerrada: ainda é necessário conferir classificação e oráculos.');
```

Forneça os seis argumentos absolutos ao executar uma cópia `.mjs` do exemplo. Execute apenas um teste por chamada. Para o segundo, use outros pais novos/vazios; não reutilize o `GL_REPRO_PARENT` preenchido pela primeira prova. O timeout e o limite de saída ajudam a delimitar a chamada, mas não certificam o encerramento de toda a árvore de processos. Em erro, timeout ou saída truncada, preserve os registros e não declare reprodução confirmada nem encerre processos desconhecidos. Os logs locais podem conter caminhos; revise-os antes de compartilhar.

## Resultado que confirma a reprodução

PASS do corpo ou exit0 não bastam: os corpos históricos também registram alternativas de recusa. A reprodução do defeito exige a classificação `CONFIRMED_LAYER_ORIGIN_BYTES_ENTERED_MAIN_AFTER_ACK_ROLLBACK` e oráculos independentes do Git/arquivos que confirmem:

- Reconhecimento antigo restaurado após a falha/recusa, seguido de reopen/status indevidamente `safe:true`.
- `baseStage`/`baseCommit` incorporando `again.txt` na MAIN. Nas execuções registradas: commit `b34b4d43e197b60edaf73500c1325564d166ced4`, tree `388e14d8e175d75a5014aa9b63e6d5e72c4d47d2` e blob `b1b62d539faf7848b59b1f6b1858fa2a60ed07bc`, conteúdo `observed reappearance C2` com newline.
- Refs e índices privados de A/B preservados; índice MAIN restaurado no rollback e depois alterado conforme o staging/commit indevido; bytes físicos coerentes com o movimento externo observado.

O conteúdo de `again.txt` não é o conteúdo HEAD de A nem seu conteúdo B preparado. A origem foi conhecida pela sequência anterior; igualdade de conteúdo, hash ou inode não é usada para decidir propriedade. Os hashes de índice físico podem variar entre fixtures; compare cada estado com sua própria preimagem. Não se demonstrou corrupção de objetos ou perda física de bytes nessas duas execuções.

O Git independente confirmou as árvores, blobs, refs e índices. Cada array bruto `independent-git-observations.json` tem 12 comandos; a contagem em memória de `verified.json` é 13 porque `rev-parse HEAD^{tree}` ocorreu depois de serializar o array. A árvore está em `verified.commit.tree`. O compacto preserva essa distinção, sem reescrever os registros originais. O controller registrou o término do trabalho; o pai observou seu fechamento depois, com exit_code 0 e sem campo signal exposto. Isso não autoriza inventar signal nulo do controller; os dois filhos têm fechamento 0/sinal nulo efetivamente registrados.

## Tentativas e alcance preservados

| Fase | Observação |
| --- | --- |
| V1/CJS | Falha de transformação de top-level await antes do produto; segundo caso não executado. |
| V2/pai longo | Core iniciou; setup falhou criando lock de ref técnica, `Filename too long`, antes dos hooks históricos; segundo caso não executado. |
| V2/pais curtos | EIO sintético confirmado em 04/11/2026 às 08:25:42.253 UTC (150200ms); recusa comum sem EIO confirmada às 08:27:34.600 UTC (111108ms); ambos filhos código 0/sinal nulo. |

Os pais curtos efetivamente exercitados registraram estimativa 196 caracteres para o caminho do lock de checkpoint. É uma característica daquela configuração Windows, não um limite universal nem garantia de que qualquer caminho de 196 caracteres funciona. Não estender esse resultado a outros Git, sistemas ou políticas de caminhos.

As falhas anteriores permanecem FAIL das tentativas respectivas; não viram SKIP ou resultados aprovados do produto. As duas execuções V2 curtas confirmam um defeito histórico de 49BA, não a segurança de 49BA ou ACE17 e não aprovam FULL14. Não somar esses resultados aos focos ou ao corpus integral. A contagem de famílias permanece D-01/D-02/D-03/D-04.

A [receita de materialização 6994](MATERIALIZATION6994-RECIPE.md) continua textual: conserva o erro inicial de observador `app.stage` e a continuação correta `app.add`, sem nova execução de um harness 6994. A [prova do overlay experimental V02](../d01-evidence/MATERIALIZATION-RECOVERY-BEFORE.json) continua qualificada por sua composição; estas receitas 49BA não executam esse overlay. A cadeia de patches reconstrói fontes; a execução das duas receitas V2 é uma evidência distinta da reconstrução estática.
