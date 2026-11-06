"""Offline checks for skill discovery and essential factory wiring."""
from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / '.claude/skills/VENDORED.json').read_text())
problems = []
for name in manifest['skills']:
    link = root / '.agents/skills' / name
    expected = root / '.claude/skills' / name
    if not link.is_symlink() or link.resolve() != expected.resolve():
        problems.append(f'{name}: Codex discovery link missing or incorrect')
    skill = expected / 'SKILL.md'
    if not skill.is_file():
        problems.append(f'{name}: missing skill')
    elif not skill.read_text().startswith(f'---\nname: {name}\n'):
        problems.append(f'{name}: unexpected metadata')
for rel in ['AGENTS.md', 'CLAUDE.md', 'GLOSSARY.md',
            'docs/product/north-star.md', 'docs/process/build-loop.md',
            'docs/process/issue-tracker.md', 'docs/process/agent-adapters.md',
            'docs/process/recovery.md', '.claude/skills/LICENSE.mattpocock-skills']:
    if not (root / rel).is_file():
        problems.append(f'missing {rel}')
if not (root / 'CLAUDE.md').read_text().startswith('@AGENTS.md\n'):
    problems.append('Claude adapter must import shared instructions')
for retired in ['apps', 'packages', 'supabase', 'render.yaml', '.mcp.json', 'package.json']:
    if (root / retired).exists():
        problems.append(f'retired application surface remains: {retired}')
if problems:
    raise SystemExit('\n'.join(problems))
print(f'Factory wiring valid: {len(manifest["skills"])} shared skills; retired app removed')
