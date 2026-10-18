import { useEffect, useLayoutEffect, useRef } from 'react';
// Register standalone contributions before the first model initializes services.
// Language modes may otherwise load them lazily after the service collection
// has frozen, leaving CodeLens, inlay hints, suggestions and drop/paste broken.
import 'monaco-editor/editor/editor.main.js';
import * as monaco from 'monaco-editor/editor/editor.api.js';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import TSWorker from 'monaco-editor/language/typescript/ts.worker?worker';
import JSONWorker from 'monaco-editor/language/json/json.worker?worker';
import CSSWorker from 'monaco-editor/language/css/css.worker?worker';
import HTMLWorker from 'monaco-editor/language/html/html.worker?worker';
import 'monaco-editor/language/typescript/monaco.contribution';
import 'monaco-editor/language/json/monaco.contribution';
import 'monaco-editor/language/css/monaco.contribution';
import 'monaco-editor/language/html/monaco.contribution';
import 'monaco-editor/languages/definitions/python/register.js';
import 'monaco-editor/languages/definitions/markdown/register.js';
import 'monaco-editor/languages/definitions/yaml/register.js';
import 'monaco-editor/languages/definitions/shell/register.js';
import 'monaco-editor/languages/definitions/typescript/register.js';
import 'monaco-editor/languages/definitions/javascript/register.js';
import 'monaco-editor/languages/definitions/css/register.js';
import 'monaco-editor/languages/definitions/html/register.js';
import 'monaco-editor/editor/contrib/find/browser/findController.js';
import 'monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching.js';
import 'monaco-editor/editor/contrib/clipboard/browser/clipboard.js';
import 'monaco-editor/editor/contrib/multicursor/browser/multicursor.js';
import 'monaco-editor/editor/browser/coreCommands.js';
import { typescriptDefaults } from 'monaco-editor/languages/features/typescript/register.js';
import { jsonDefaults } from 'monaco-editor/languages/features/json/register.js';

(globalThis as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker: (_id: string, label: string) => label === 'typescript' || label === 'javascript' ? new TSWorker() : label === 'json' ? new JSONWorker() : label === 'css' || label === 'scss' || label === 'less' ? new CSSWorker() : label === 'html' || label === 'handlebars' || label === 'razor' ? new HTMLWorker() : new EditorWorker()
};
// TOML tokenization, intentionally without promising a formatter or language server.
monaco.languages.register({ id: 'diff', extensions: ['.diff', '.patch'] });
monaco.languages.setMonarchTokensProvider('diff', { tokenizer: { root: [[/^\+.*$/, 'string'], [/^-.*$/, 'keyword'], [/^@@.*$/, 'type'], [/^diff.*$/, 'comment']] } });
monaco.languages.register({ id: 'toml', extensions: ['.toml'] });
monaco.languages.setMonarchTokensProvider('toml', { tokenizer: { root: [[/#.*$/, 'comment'], [/\[.*?\]/, 'type'], [/\b(?:true|false)\b/, 'keyword'], [/[\w.-]+(?=\s*=)/, 'key'], [/"([^"\\]|\\.)*"|'[^']*'/, 'string'], [/[+-]?\d+(?:\.\d+)?/, 'number']] } });
typescriptDefaults.setEagerModelSync(false);
typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
jsonDefaults.setDiagnosticsOptions({ validate: true, enableSchemaRequest: false });

export function languageFor(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase() ?? '';
  return ({ ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript', py: 'python', json: 'json', md: 'markdown', markdown: 'markdown', html: 'html', htm: 'html', css: 'css', scss: 'scss', yaml: 'yaml', yml: 'yaml', toml: 'toml', sh: 'shell', diff: 'diff' } as Record<string, string>)[extension] ?? 'plaintext';
}
interface Props { path: string; text: string; eol?: string; theme: string; readOnly?: boolean; language?: string; onChange?: (text: string) => void }
export function Editor(props: Props): React.JSX.Element {
  const container = useRef<HTMLDivElement>(null);
  const handler = useRef(props.onChange);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const changing = useRef(false);
  // React may acknowledge an earlier keystroke after Monaco has already
  // accepted the next one. An old echo must never replace the live model,
  // reset its cursor or discard newer input.
  const pendingEdits = useRef<string[]>([]);
  handler.current = props.onChange;
  useEffect(() => {
    if (!container.current) return;
    const model = monaco.editor.createModel(props.text, props.language ?? languageFor(props.path));
    model.setEOL(props.eol === 'CRLF' || props.eol === '\r\n' ? monaco.editor.EndOfLineSequence.CRLF : monaco.editor.EndOfLineSequence.LF);
    const instance = monaco.editor.create(container.current, { model, theme: props.theme === 'light' ? 'vs' : 'vs-dark', automaticLayout: true, fontSize: 13, lineHeight: 21, fontFamily: "'Cascadia Code', 'SFMono-Regular', Consolas, monospace", minimap: { enabled: false }, padding: { top: 18 }, scrollBeyondLastLine: false, readOnly: props.readOnly, renderWhitespace: 'selection', tabSize: 2, wordWrap: 'off', ariaLabel: props.readOnly ? `Conteúdo ${props.path}` : `Editor de ${props.path}`, bracketPairColorization: { enabled: true } });
    editor.current = instance;
    pendingEdits.current = [];
    const listener = model.onDidChangeContent(() => {
      if (!changing.current) {
        const value = model.getValue(monaco.editor.EndOfLinePreference.TextDefined);
        pendingEdits.current.push(value);
        handler.current?.(value);
      }
    });
    return () => { listener.dispose(); instance.dispose(); model.dispose(); editor.current = null; };
  }, [props.path]);
  useEffect(() => { monaco.editor.setTheme(props.theme === 'light' ? 'vs' : 'vs-dark'); }, [props.theme]);
  useLayoutEffect(() => {
    const model = editor.current?.getModel();
    if (!model) return;
    const acknowledged = pendingEdits.current.lastIndexOf(props.text);
    if (acknowledged >= 0) {
      pendingEdits.current.splice(0, acknowledged + 1);
      return;
    }
    if (model.getValue(monaco.editor.EndOfLinePreference.TextDefined) !== props.text) {
      pendingEdits.current = [];
      changing.current = true;
      try { model.setValue(props.text); } finally { changing.current = false; }
    }
  }, [props.text]);
  useEffect(() => { editor.current?.updateOptions({ readOnly: props.readOnly }); }, [props.readOnly]);
  return <div className="monaco-host" data-testid="editor" ref={container} />;
}
