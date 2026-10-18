#!/usr/bin/env python3
"""Package one reviewable Windows workshop: sources, debug build and portable app.

All runtime profiles, test repositories, logs and caches remain local. The only
node_modules included belong to the inspected native module inside the portable
Windows runtime, never the development installation on the packaging host.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import zipfile


def create_workshop(root: Path, output_dir: Path) -> Path:
    portable = root / 'artifacts' / 'Git Layers Lab-win32-x64'
    required = [
        root / 'package.json', root / 'package-lock.json', root / 'AGENTS.md',
        root / 'README.md', root / 'Git-Layers-Lab.code-workspace',
        root / '.vscode' / 'launch.json', root / '.vscode' / 'tasks.json', root / '.vscode' / 'settings.json', root / 'dist' / 'desktop' / 'main' / 'index.js',
        root / 'dist-debug' / 'desktop' / 'main' / 'index.js.map',
        portable / 'git-layers-lab.exe', portable / 'WINDOWS-PACKAGE.json',
        portable / 'resources' / 'app.asar',
        portable / 'resources' / 'app.asar.unpacked' / 'node_modules' / 'node-pty' / 'prebuilds' / 'win32-x64' / 'conpty.node',
    ]
    missing = [str(path.relative_to(root)) for path in required if not path.is_file()]
    if missing:
        raise SystemExit('Workshop incompleto; gere os builds e o pacote Windows primeiro: ' + ', '.join(missing))
    package_manifest = json.loads((portable / 'WINDOWS-PACKAGE.json').read_text(encoding='utf-8'))
    if package_manifest.get('platform') != 'win32' or package_manifest.get('arch') != 'x64' or package_manifest.get('terminal', {}).get('unpacked') is not True:
        raise SystemExit('O pacote Windows não contém o terminal nativo verificado.')

    # Final reports are written after the executable was inspected. Refresh only
    # the documentation, preserving all compiled and verified runtime bytes.
    documentation = portable / 'Documentacao'
    shutil.rmtree(documentation, ignore_errors=True)
    documentation.mkdir()
    shutil.copy2(root / 'README.md', documentation / 'README.md')
    shutil.copytree(root / 'docs', documentation / 'docs')

    output_dir.mkdir(parents=True, exist_ok=True)
    output = output_dir / 'git-layers-lab-workshop-windows.zip'
    archive_root = Path('git-layers-lab-workshop')
    allowed_directories = {'.vscode', 'src', 'tests', 'scripts', 'docs', 'dist', 'dist-debug', 'artifacts'}
    excluded_directories = {'.git', '.workshop', '.local-bin', '.test-runs', '__pycache__', '.cache', '.npm', '.package-stage'}
    count = 0
    native_files = 0
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as archive:
        for current, directories, files in os.walk(root, followlinks=False):
            current_path = Path(current)
            relative_directory = current_path.relative_to(root)
            if current_path == root:
                directories[:] = sorted(name for name in directories if name in allowed_directories and not (current_path / name).is_symlink())
            elif relative_directory == Path('artifacts'):
                directories[:] = ['Git Layers Lab-win32-x64']
            else:
                directories[:] = sorted(name for name in directories if name not in excluded_directories and not name.startswith(('.package-output-', '.package-stage-', '.previous-')) and not (current_path / name).is_symlink())
                # node_modules is allowed only inside the unpacked native runtime.
                if not current_path.is_relative_to(portable):
                    directories[:] = [name for name in directories if name != 'node_modules']
            for name in sorted(files):
                source = current_path / name
                if source.is_symlink() or source == output or name in {'Abrir Aplicativo.cmd', 'Preparar Workshop.cmd'} or name.endswith(('.zip', '.tmp', '.tsbuildinfo', '.pyc')):
                    continue
                if not source.is_relative_to(root / 'docs') and name.endswith(('.log', '.pdb')):
                    continue
                relative = source.relative_to(root)
                archive.write(source, (archive_root / relative).as_posix())
                count += 1
                if source.is_relative_to(portable) and source.suffix.lower() in {'.node', '.dll', '.exe'}:
                    native_files += 1
        metadata = {
            'format': 'git-layers-lab-workshop', 'version': json.loads((root / 'package.json').read_text())['version'],
            'platform': 'win32', 'arch': 'x64', 'sourceFilesIncluded': True,
            'developmentDependenciesIncluded': False, 'compiledProductionIncluded': True,
            'debugSourceMapsIncluded': True, 'portableApp': 'artifacts/Git Layers Lab-win32-x64/git-layers-lab.exe',
            'fileCountExcludingManifest': count, 'nativeRuntimeFiles': native_files,
            'validation': 'ZIP CRC and static Windows payload validation; native Windows execution is reported separately in docs/TEST-REPORT.md.',
        }
        archive.writestr((archive_root / 'WORKSHOP-CONTENTS.json').as_posix(), json.dumps(metadata, indent=2, ensure_ascii=False) + '\n')
    with zipfile.ZipFile(output) as archive:
        bad = archive.testzip()
        if bad:
            raise RuntimeError(f'Corrupt ZIP entry: {bad}')
        names = archive.namelist()
        if any('/node_modules/' in name and '/artifacts/Git Layers Lab-win32-x64/resources/app.asar.unpacked/node_modules/node-pty/' not in name for name in names):
            raise RuntimeError('Development node_modules unexpectedly included')
        if any('/.workshop/' in name or '/.git/' in name or '/prebuilds/linux-' in name or '/prebuilds/darwin-' in name for name in names):
            raise RuntimeError('Local state or non-Windows native runtime unexpectedly included')
    print(f'{output}: {count + 1} files, {output.stat().st_size} bytes, CRC validated')
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', default='..')
    args = parser.parse_args()
    create_workshop(Path(__file__).resolve().parent.parent, Path(args.output_dir).resolve())
