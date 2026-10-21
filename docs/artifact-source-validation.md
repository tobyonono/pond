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


## Local corrections — 2026-10-21

Installed `1.2.0-fork.2` after cloning today's Library, app support and application
into `Pond Backups/2026-10-21-before-fork2`. Both staged and installed apps pass
`codesign --verify --deep --strict`; packaging now uses a sealed ad-hoc signature
and checks it after signing. The previous local package had retained Electron's
invalid linker signature. No Developer ID identity is installed, and the exact
reported password prompt has not yet been identified.

Verified the new Goodreads, Letterboxd and Bookmark Folders menu entries in the
installed Sources screen, and opened Goodreads setup. These entries still open
file-import setup in this checkpoint. The user clarified that Goodreads and
Letterboxd must instead be connected Accounts with historical and ongoing sync;
that is the next implementation phase, not completed by these menu shortcuts.

Instagram capture sessions now gate each API XHR through the persistent governor,
serialize capture windows, use lower local ceilings and apply a fifteen-minute
minimum 429 cooldown. A likes 429 remains a failure after partial results.
Production desktop and extension builds and signature-verified packaging passed.
Focused regression tests passed. The full required check completed 23 of 24 tasks;
the desktop suite passed 3,834 tests with five skips and seven unrelated UI timing
failures under system load. All five affected files then passed (24 tests) with
two workers and a 20-second test timeout; test assertions were unchanged. An
earlier new likes test fixture was corrected to use a valid cursor and passed.


## Connected sources — 2026-10-21

Goodreads and Letterboxd now use the existing connected-Account flow, rather than
opening export-import shortcuts. Both share the original import-scope, initial
history, scheduled sync, pause and reconnect paths. Goodreads discovers shelves;
Letterboxd supplies Watchlist, Watched, Diary / Logged and Liked Films. Existing
CSV/export imports remain separate. Chrome hooks notify existing Accounts after
confirmed save actions and respect source enablement and the selected scope.

Validation before installation:

- All 18 static-check tasks passed: generation, formatting, Oxlint, architecture,
  Knip and TypeScript checks.
- Full desktop suite: 573 files passed, two skipped; 3,857 tests passed, five
  skipped, with two workers and a 20-second per-test timeout.
- Extension suite: 14 files and 77 tests passed.
- All six desktop/Chrome/Firefox production-build tasks passed.
- Chrome output: 1,848,405 bytes; background worker: 137,044 bytes, both within
  their existing budgets.
- Current first-party public pages parsed successfully: a Goodreads shelf feed
  and its distinct second page, 72 Letterboxd watched films with pagination,
  and 50 diary rows with pagination. These checks are separate from offline tests.

The installed fork.3 passed strict signature verification. Chrome's existing
unpacked extension was reloaded and visibly reported 1.2.1 (Toby fork), enabled.
Goodreads connected through the user's existing signed-in browser session and
opened the standard Account import controls. Live shelf discovery then exposed
an unbound account-handle callback; the reference extractor now preserves its
source identity when that callback is passed by value. The three account-identity
regression tests pass, including both extracted callbacks. The corrected app is
packaged as fork.4; installation and live verification are recorded below.

The user identified the password dialog as macOS access to "Pond Safe Storage"
and selected Always Allow directly in that system dialog. No password was read,
stored in source code, or entered by the agent. Valid ad-hoc signatures preserve
encryption but do not establish a stable Developer ID identity across local
builds. A new build can require Keychain approval again.
