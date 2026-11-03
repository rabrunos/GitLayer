export function Codicon({ name, className = '' }: { name: string; className?: string }): React.JSX.Element {
  return <span className={`codicon codicon-${name} ${className}`} aria-hidden="true" />;
}

/** All icons ship locally with Monaco, from VS Code's MIT-licensed Codicons. */
export function FileIcon({ path, directory = false, expanded = false }: { path: string; directory?: boolean; expanded?: boolean }): React.JSX.Element {
  if (directory) return <Codicon name={expanded ? 'folder-opened' : 'folder'} className="explorer-file-icon icon-folder" />;
  const name = path.split('/').at(-1)!.toLowerCase();
  const ext = name.split('.').at(-1)!;
  if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) return <span aria-hidden="true" className={`explorer-file-icon language-icon icon-${ext}`}>{ext.endsWith('x') ? <Codicon name="symbol-event" /> : ext.toUpperCase()}</span>;
  const [icon, color] = name === '.gitignore' || name === '.gitattributes' ? ['source-control', 'git']
    : name === 'package.json' || name.endsWith('lock.json') ? ['package', 'json']
    : ['json', 'jsonc'].includes(ext) ? ['json', 'json']
    : ['md', 'mdx'].includes(ext) ? ['markdown', 'markdown']
    : ['html', 'htm', 'xml', 'svg'].includes(ext) ? ['code', 'html']
    : ['css', 'scss', 'less'].includes(ext) ? ['symbol-color', 'css']
    : ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico'].includes(ext) ? ['file-media', 'media']
    : ['ps1', 'sh', 'bat', 'cmd'].includes(ext) ? ['terminal', 'shell']
    : ['yml', 'yaml', 'toml', 'ini'].includes(ext) ? ['settings-gear', 'config']
    : ['zip', 'gz', 'tar'].includes(ext) ? ['file-zip', 'default'] : ['file', 'default'];
  return <Codicon name={icon} className={`explorer-file-icon icon-${color}`} />;
}
