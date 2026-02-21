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
