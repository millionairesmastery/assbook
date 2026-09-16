from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
excluded = {'.git', 'node_modules', '.wrangler', '.sites-runtime', '.vinext', '.next', 'dist', 'artifacts', 'outputs', 'work', '.agents', '.codex', '__pycache__'}
target = root / 'public' / 'assbook-source.zip'
with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
    for path in sorted(root.rglob('*')):
        relative = path.relative_to(root)
        if not path.is_file() or any(p in excluded for p in relative.parts):
            continue
        if path == target or path.name.endswith(('.tsbuildinfo', '.log', '.pem')) or path.name == '.DS_Store':
            continue
        if (path.name.startswith('.env') and path.name != '.env.example') or path.name.startswith('.dev.vars'):
            continue
        archive.write(path, 'assbook/' + str(relative))
print('Created public/assbook-source.zip')
