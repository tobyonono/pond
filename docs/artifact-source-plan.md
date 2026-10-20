# Artifact source integrations

## Scope

Extend Pond with Goodreads, Letterboxd enriched by TMDB, and selected browser
bookmark folders. Preserve Artifact's existing mood analysis, embeddings,
clustering, layout, and publishing pipeline in its separate repository.

Work starts from upstream `dc31d4d5` on `codex/artifact-sources`. Keep the upstream
remote and isolate additions so future upstream merges remain practical. Do not
open, migrate, or change the installed application's personal Library while
developing. Disable upstream binary updates before distributing a custom app.

## Implementation sequence

1. Register Goodreads and Letterboxd as capture-capable Sources. Add public-page
   capture, URL identity tests, and all compiler-enforced source registrations.
2. Add Goodreads CSV import with ISBN, author, publication year, review, rating,
   dates, and shelf-to-Folder mapping. Enrich descriptions/covers through Open
   Library when an ISBN is available. Invalid rows must not abort valid rows.
3. Add Letterboxd export import and public RSS updates. Merge watched, watchlist,
   liked, and rated entries into one Save per film. Resolve TMDB by explicit ID
   first; only accept an unambiguous title/year match, retaining its stable ID.
   Keep source membership separate from editable Pond notes and ratings.
4. Let users choose bookmark folders before import, including descendants,
   without dropping a selected membership when a URL also exists elsewhere.
   Reuse Pond's existing HTML/Chromium parser and folder persistence.
5. Expose each import in the existing Import menu and typed local operations.
   Keep TMDB credentials local and out of the Library and exported packages.
6. Add optional Chrome bookmark permission and a folder picker in the extension.
   Capture existing and newly added bookmarks, including selected descendants.
   Persist retries when Pond is unavailable; bind delivery to the selected Library.
7. Observe successful Goodreads ShelveBook and Letterboxd watchlist mutations in
   the extension. Resolve opaque book IDs from page state; retain public film URLs.
8. Test malformed/quoted CSV, duplicate films/books, source identity, ambiguous
   TMDB results, missing enrichment, folder filtering, and re-import behavior.
   Run generation, repository checks, and production build.

## Follow-on work

- Pond-to-Artifact smart-folder bridge; generated profiles plus durable manual
  overrides in Pond's inspector; publication target configuration.
- Live account verification of the new browser hooks, and an isolated migration
  rehearsal from the installed 1.1.1 app before installing a custom build.
- Fork release identity, signing, native-host registration, and update channel.
  A custom binary must not install Raphael's upstream releases over local changes.
- Optional Jev evaluations for matching/classification; not a dependency of
  these initial integrations.

## Data rules

Imported records retain their original Source and URL. Goodreads shelf names and
Letterboxd list names become source-prefixed Folders. Existing personal notes,
ratings, titles and manually replaced media win on re-import. Ambiguous film
matches remain unresolved rather than silently choosing the first search result.
RSS is a recent-activity feed, not an authoritative full watchlist or deletion
feed. A later missing row never deletes a Save.

Browser bookmark sync also retains archived Saves when a Chrome bookmark is
removed. Moves into selected folders are captured; moves out stop future
capture. Folder memberships in Pond are additive. Browser folder renames add
the new destination without deleting the previous Pond folder. The extension
requires the modified desktop protocol, so the existing 1.1.1 binary cannot
receive automatic folder captures. Existing generic web captures and unresolved
short-link aliases require duplicate review during migration.

TMDB enrichment remains reference metadata. Artifact continues to control what
information its mood prompt uses; synopsis enrichment does not change that prompt.

## Validation and release

Tests use fixtures and temporary Libraries, with no personal accounts or keys.
Document separate live checks and any upstream failures. Verify a copy of an
existing Library before installing a custom build. No public release, GitHub
push, or replacement of the installed Pond app is part of source development.
