# Engineering Standards & Workflow

## Git Configuration
- **Commit Signing:** Never sign git commits. GPG signing is explicitly disabled (`git config --global commit.gpgsign false`).
- **Identity:** Always commit as `Jonathan Wilner <jonathan@teamwilner.com>`.
- **Authentication:** Use SSH for all git remotes. The primary key for GitHub is `~/.ssh/id_github`.
- **Remote URLs:** Use `git@github.com:...` instead of `https://github.com/...`.

## RDPECAM Development
- **Branch:** Focus development on the `GUACAMOLE-1415` feature branch.
- **Testing:** Prioritize keyframe synchronization and incremental device discovery.
- **Nix Integration:** The NixOS configuration in `~/src/nixos-amd` is configured to build Guacamole components from local paths in `~/src/guac/`.
- **Known Issues:** Exercise extreme caution when modifying `guacrdpecam.c`. Structural changes frequently lead to brace imbalance loops and nested function errors. Avoid surgical `sed`/`replace` calls for large blocks; instead, use structural analysis tools or full-file writes of verified code.
