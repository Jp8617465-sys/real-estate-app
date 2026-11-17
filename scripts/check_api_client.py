"""Fail if the front end's typed client has drifted from the back end's API description.

Regenerates the OpenAPI document from the Python app and the TypeScript schema from that
document, then compares both with the committed copies. Fix with `make generate-client`.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]


def run(cmd: list[str], cwd: Path) -> str:
    return subprocess.run(cmd, cwd=cwd, check=True, capture_output=True, text=True).stdout


with tempfile.TemporaryDirectory() as tmp:
    spec = Path(tmp) / 'openapi.json'
    schema = Path(tmp) / 'schema.d.ts'
    spec.write_text(run(['uv', 'run', 'python', '-m', 'buyers_desk.openapi'], root / 'api'))
    run(['npx', '--no-install', 'openapi-typescript', str(spec), '-o', str(schema)], root / 'web')
    stale = [
        name for name, fresh, committed in [
            ('web/openapi.json', spec, root / 'web/openapi.json'),
            ('web/src/api/schema.d.ts', schema, root / 'web/src/api/schema.d.ts'),
        ]
        if not committed.is_file() or committed.read_text() != fresh.read_text()
    ]
if stale:
    sys.exit(f'Stale generated client: {", ".join(stale)}. Run `make generate-client`.')
print('Generated client matches the API description')
