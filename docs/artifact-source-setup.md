# Source integration development build

This branch adds source ingestion to Pond. Artifact's mood analysis, clustering,
editable mood inspector, smart-folder selection bridge, and deployment adapter
are separate follow-on work in [the plan](artifact-source-plan.md).

## Chrome bookmark folders

Build the desktop app and extension from this branch using Node 24 and pnpm 11.
The Chrome extension output is `apps/extension/.output/chrome-mv3/`. This is a new
build; the copy in Downloads does not pick up source changes automatically.

In the extension popup, open **Bookmark Folders**, choose **Allow Bookmark
Access**, select the desired folders, then choose **Sync Selected Folders** with
the intended Library open in the modified desktop app.

- Selected folders include descendants and existing bookmarks.
- New bookmarks and bookmarks moved into the selection are sent automatically.
- Failed deliveries remain queued and retry when Pond becomes available. A
  minute alarm provides recovery after the Chrome service worker restarts.
- Saves go under `Browser Bookmarks` with their original folder path. Existing
  Saves can gain memberships without replacing edited titles or notes.
- The destination is pinned to the Library selected during setup. Opening a
  different Library pauses delivery until the intended Library is reopened.
- Pause Sync stops delivery. Deleting browser bookmarks retains their Pond copy.

The permission is optional and requested from the user's button click. A browser
grants access to the bookmarks API as a whole; this extension filters delivery to
the chosen folders locally.

## Books and films

**Import Goodreads** accepts Goodreads' library CSV and lets you choose shelves.
It retains book identity, author, ISBN, year, rating, review and added date;
available ISBNs provide Open Library covers and descriptions.

**Import Letterboxd** accepts the unzipped export directory. Watched, watchlist,
ratings, diary, likes and custom lists merge per title/year. Public username RSS
imports recent activity, rather than the complete watchlist. Configure an optional
TMDB API key or read access token in this dialog; the app stores it in its
protected credentials, outside the Library. `TMDB_API_KEY` is also supported.
Exact TMDB IDs from Letterboxd take priority over title/year search. Ambiguous
searches remain unresolved, and unavailable enrichment retains the source record.

The extension observes successful Goodreads shelf additions and Letterboxd
watchlist additions. These hooks capture the item URL; CSV imports supply shelf
memberships, ratings and reviews. Public-page capture and TMDB enrichment run in
the desktop pipeline. Full historical account sync and live rating updates are
not implemented by these hooks.

**Import Bookmarks** in the desktop Import menu also supports a one-time Chrome
Bookmarks JSON file or HTML export, with folder selection before import.

## Before installing

Offline tests use fixtures. Verify the browser hooks with a signed-in test account
and test a copy of the old Library before replacing the installed app. Review
generic web Saves and short-link aliases for duplicates during that rehearsal.
Do not install a custom binary with upstream automatic updates enabled. No
installation, account changes, publishing or personal Library migration is part
of this development checkout.

## Local fork package

Build both apps, then package the local Apple Silicon desktop build:

```sh
pnpm exec turbo run build --filter=@pond/desktop --filter=@pond/extension
cd apps/desktop
node scripts/build-native-host.mjs
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm exec electron-builder --config electron-builder.fork.yml --mac --arm64 --dir --publish never
```

`electron-builder.fork.yml` retains Pond's application identity and Library
location, marks the version `1.2.0-fork.1`, and disables publishing. Fork-marked
builds disable the updater, including manual download and installation paths,
so an upstream release cannot replace custom changes. This local package is
unsigned and not notarized. The extension is labelled **Pond (Toby)** and keeps
the same unpacked extension ID, preserving its settings and native-host access.

Before replacing an installed version, quit Pond and back up both the Library
and its application-support directory. Keep the original app and extension for
rollback. Reusing the same app identity avoids importing the existing Library
again. Automatic browser-folder sync is opt-in after the extension is updated.
