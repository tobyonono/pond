# Source integration validation

Validated on macOS with Node 24 and pnpm 11, from upstream `dc31d4d5` on branch
`codex/artifact-sources`.

- `pnpm check`: all 24 tasks passed, including generation, Biome, Oxlint,
  architecture, Knip, typechecks and offline tests. Desktop: 3,831 tests passed,
  5 skipped. Extension: 73 tests passed. Other workspace tests also passed.
- `pnpm exec turbo run build --filter=@pond/desktop --filter=@pond/extension`:
  desktop production build and Chrome/Firefox extension builds passed.
- The final movie-only TMDB ID guard was followed by a desktop rebuild, main
  TypeScript check, formatting check, and all 17 reference import tests passing.
- Chrome unpacked output: 1,845,686 bytes against the existing 1,900,000-byte
  budget. Service worker: 136,418 bytes against the 150,000-byte budget.
- Built manifest includes optional bookmark permission and both site hooks.
  `git diff --check` passed. Artifact's working tree remained unchanged.

The unfiltered `pnpm build` includes a Raycast installation step that writes to
`~/.config/raycast/extensions/pond`; the sandbox blocked that unrelated step.
The desktop and extension were then built directly. The website and complete
repository performance-budget command were not validated by those builds.

Browser interactions in the import dialog are covered with the real React
controls and a fixture IPC boundary. Save-action parsers, folder selection,
offline acknowledgment/retry, moved bookmarks, mutation failures, ambiguous
TMDB matching, edited metadata on re-import, and Library changes are covered
offline. The signed-in site hooks, Chrome permission/native-host setup, and
old-Library migration still need live verification before installation.

No custom application was launched against a personal Library, no installed app
or downloaded extension was replaced, and no public release or remote fork was
created. The local `upstream` remote remains available for future updates.

## Local fork installation — 2026-10-20

The later local-installation phase rebuilt and packaged `1.2.0-fork.1` for Apple
Silicon. Ten update-channel/coordinator tests, main-process TypeScript, focused
Oxlint, and the desktop/Chrome/Firefox builds passed. Packaging verified native
SQLite, vector, sharp, ffmpeg and native-host resources. The fork package has no
update feed and its updater rejects fork-marked versions.

After user confirmation, the original installation, extension, Library and
application-support directory were backed up before switching versions. The
installed native host reported `1.2.0-fork.1` and the original Library path. The
desktop displayed the existing Library, while Chrome's existing unpacked
extension showed **Pond (Toby) 1.2.0 (Toby fork)**, enabled and connected. No
re-import was required. Browser-folder watching remains opt-in; this check did
not select folders or grant the optional bookmarks permission. Signed-in site
save-action behavior remains separate from installation verification.
