#!/usr/bin/env node
import { GitLayer } from './core.mjs';
import { createInterface } from 'node:readline/promises';

const help = `GitLayer — laboratório experimental para repositórios descartáveis
  git layer create <nome>
  git layer on|off <nome>
  git layer list|status [--json]
  git layer add <nome> [--] <caminho...>     (padrão: . no diretório atual)
  git layer commit <nome> -m <mensagem>
  git layer commit                        (interação simples)
  git layer log <nome> [opções do git log]
  git layer --cwd <diretório> <comando>
`;

async function main() {
  const args = process.argv.slice(2);
  let cwd = process.cwd();
  if (args[0] === '--cwd') { args.shift(); cwd = args.shift(); if (!cwd) throw new Error('Falta diretório para --cwd.'); }
  const command = args.shift();
  if (!command || ['help', '--help', '-h'].includes(command)) { console.log(help); return; }
  const core = new GitLayer(cwd);
  const name = args.shift();
  switch (command) {
    case 'create': console.log(`${name}: ${core.create(name)}`); break;
    case 'on': core.on(name); console.log(`${name}: ativa`); break;
    case 'off': await core.off(name); console.log(`${name}: inativa`); break;
    case 'add': {
      if (args[0] === '--') args.shift();
      const result = core.add(name, args.length ? args : ['.']);
      console.log(`${name}: ${result.updated} próprios atualizados, ${result.added} novos preparados`);
      break;
    }
    case 'commit': {
      if (name) {
        if (args[0] !== '-m' || args.length !== 2) throw new Error('Uso: git layer commit <nome> -m <mensagem>');
        console.log(`${name}: ${core.commit(name, args[1])}`);
        break;
      }
      const pending = core.status().layers.filter(layer => layer.staged.length);
      if (!pending.length) { console.log('Nenhuma alteração preparada nas Layers.'); break; }
      if (!process.stdin.isTTY) throw new Error('Commit interativo exige terminal; use commit <nome> -m <mensagem>.');
      const input = createInterface({ input: process.stdin, output: process.stdout });
      try {
        for (const layer of pending) {
          console.log(`\nLayer ${layer.name}\n${layer.staged.map(f => `  ${f.status} ${f.path}`).join('\n')}`);
          const message = await input.question('Mensagem (vazia cancela as próximas): ');
          if (!message.trim()) break;
          const answer = await input.question('Confirmar commit? [s/N] ');
          if (!/^(s|sim|y|yes)$/i.test(answer.trim())) break;
          console.log(`${layer.name}: ${core.commit(layer.name, message)}`);
        }
      } finally { input.close(); }
      break;
    }
    case 'list':
    case 'status': {
      const state = core.status();
      if (name === '--json' || args.includes('--json')) console.log(JSON.stringify(state, null, 2));
      else {
        if (!state.layers.length) console.log('Nenhuma Layer.');
        for (const layer of state.layers) {
          console.log(`${layer.name}: ${layer.active ? 'ativa' : 'inativa'}; ${layer.staged.length} preparados, ${layer.modified.length} alterados`);
          if (command === 'status') {
            for (const file of layer.staged) console.log(`  stage ${file.status} ${file.path}`);
            for (const file of layer.modified) console.log(`  disco ${file.status} ${file.path}`);
          }
        }
      }
      break;
    }
    case 'log': process.stdout.write(core.log(name, args)); break;
    default: throw new Error(`Comando desconhecido: ${command}\n${help}`);
  }
}
main().catch(error => { console.error(`git-layer: ${error.message}`); process.exitCode = 1; });
