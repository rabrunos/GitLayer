#!/usr/bin/env python3
"""Create the reviewable source + actually built artifacts ZIP, never node_modules."""
import argparse
import os
from pathlib import Path
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--output', default='../git-layers-lab.zip')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
output = Path(args.output).resolve()
excluded = {'.git', '.workshop', 'node_modules', '.local-bin', '.test-runs', '__pycache__', '.cache', '.npm', '.package-stage'}
count = 0
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as archive:
    for current, directories, files in os.walk(root, followlinks=False):
        directories[:] = sorted(d for d in directories if d not in excluded and not d.startswith(('.package-output-', '.package-stage-')) and not Path(current, d).is_symlink())
        for name in sorted(files):
            source = Path(current, name)
            if source == output or source.is_symlink() or name in {'Abrir Aplicativo.cmd', 'Preparar Workshop.cmd'} or name.endswith(('.log', '.tmp', '.zip', '.tsbuildinfo')):
                continue
            if name.startswith('.git-layers-lab.'):
                continue
            relative = Path('git-layers-lab') / source.relative_to(root)
            archive.write(source, relative.as_posix())
            count += 1
with zipfile.ZipFile(output) as archive:
    bad = archive.testzip()
    if bad:
        raise RuntimeError(f'Corrupt ZIP entry: {bad}')
print(f'{output}: {count} files, {output.stat().st_size} bytes, CRC validated')
