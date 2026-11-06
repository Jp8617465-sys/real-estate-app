# Retired-application recovery

Before tracked files were removed, a full-history Git bundle was created and git bundle verify succeeded.

- Original main: 09303565dfed8cf3b667e91a8ec2273f603c2848.
- Annotated tag: archive/realflow-pre-rebuild-2026-11-06.
- Local bundle: ../real-estate-app-pre-rebuild-2026-11-06.bundle, outside this checkout, not committed.

Inspect without disturbing this branch:

    git show archive/realflow-pre-rebuild-2026-11-06:README.md
    git worktree add ../realflow-recovery archive/realflow-pre-rebuild-2026-11-06

Recover from the standalone bundle into a separate directory:

    git clone ../real-estate-app-pre-rebuild-2026-11-06.bundle ../realflow-recovery

This archives source history, not deployed services, external credentials or database contents. Those systems have not been changed.
