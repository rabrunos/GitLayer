#!/usr/bin/env python3
"""Deliver a full Windows portable ZIP and a separate reproducible source ZIP."""
import argparse
import os
from pathlib import Path
import shutil
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--output-dir', default='..')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
output_dir = Path(args.output_dir).resolve()
output_dir.mkdir(parents=True, exist_ok=True)
portable = root / 'artifacts' / 'Git Layers Lab-win32-x64'
if not (portable / 'git-layers-lab.exe').is_file() or not (portable / 'WINDOWS-PACKAGE.json').is_file():
    raise SystemExit('Execute npm run package:windows antes de criar o ZIP.')

# Verification reports are finalized after packaging; refresh only documentation,
# leaving the inspected PE and ASAR bytes untouched.
documentation = portable / 'Documentacao'
shutil.rmtree(documentation, ignore_errors=True)
documentation.mkdir()
shutil.copy2(root / 'README.md', documentation / 'README.md')
shutil.copytree(root / 'docs', documentation / 'docs')

excluded = {'.git', '.workshop', 'node_modules', 'artifacts', '.local-bin', '.test-runs', '__pycache__', '.cache', '.npm', '.package-stage', 'git-layers-lab'}

def write_zip(output, folder, archive_root, exclude):
    count = 0
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as archive:
        for current, directories, files in os.walk(folder, followlinks=False):
            directories[:] = sorted(d for d in directories if d not in exclude and not d.startswith(('.package-output-', '.package-stage-')) and not Path(current, d).is_symlink())
            for name in sorted(files):
                source = Path(current, name)
                if source.is_symlink() or name in {'Abrir Aplicativo.cmd', 'Preparar Workshop.cmd'} or name.endswith(('.zip', '.tmp', '.tsbuildinfo', '.log')) or source == output:
                    continue
                archive.write(source, (Path(archive_root) / source.relative_to(folder)).as_posix())
                count += 1
    with zipfile.ZipFile(output) as archive:
        bad = archive.testzip()
        if bad:
            raise RuntimeError(f'Corrupt ZIP entry: {bad}')
    print(f'{output}: {count} files, {output.stat().st_size} bytes, CRC validated')

write_zip(output_dir / 'git-layers-lab-windows-x64.zip', portable, 'Git Layers Lab', set())
write_zip(output_dir / 'git-layers-lab-windows-source.zip', root, 'git-layers-lab', excluded)
