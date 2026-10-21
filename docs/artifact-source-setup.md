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

## Connected books and films

Open **Sources → New Source → Goodreads / Letterboxd**. Pond opens the normal
browser sign-in flow, the extension transfers that source's signed-in session,
and Pond verifies the actual viewer before creating the Account. Choose the
shelves/lists to sync in the existing import-scope dialog. These are connected
Accounts with the same status, Sync Now, pause, reconnect and scheduled-sync
controls as the original Sources.

Goodreads sync reads all books or selected shelves using the account's paginated
shelf feeds. Letterboxd sync covers Watchlist, Watched, Diary / Logged and Liked
Films. Initial histories checkpoint between batches; incremental runs stop at
known pages. Add to Folders files known items into their source collections too.
Captures use the existing public-page pipeline and optional TMDB enrichment.

The Chrome hooks capture confirmed Goodreads shelving, custom tags and rating
changes, plus Letterboxd watchlist additions, watched toggles and diary saves.
Confirmed actions also request a bounded refresh of an existing connected Account,
so a film logged from a modal can sync even if its canonical URL is absent from
the current page. Notifications cannot create Accounts and are checked against
the current source and enabled setting. Scheduled sync catches changes made on
other devices. Source un-saves retain the archived Pond item, as for other Sources.

## Optional export imports

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

Export imports remain available separately. They also provide reviews, user
ratings and export-only fields; browser action capture does not overwrite locally
edited Pond titles, notes or ratings.

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
location, marks the version `1.2.0-fork.5`, and disables publishing. Fork-marked
builds disable the updater, including manual download and installation paths,
so an upstream release cannot replace custom changes. This local package is
ad-hoc signed and not notarized. Packaging verifies the complete signature after
signing. A Developer ID signature is still needed for a distributed macOS release
and stable Keychain trust across updates. The extension is labelled **Pond (Toby)** and keeps
the same unpacked extension ID, preserving its settings and native-host access.

Before replacing an installed version, quit Pond and back up both the Library
and its application-support directory. Keep the original app and extension for
rollback. Reusing the same app identity avoids importing the existing Library
again. Automatic browser-folder sync is opt-in after the extension is updated.

## Source setup and Instagram pacing

**Sources → New Source** and **New → Sources → New Source** include Goodreads,
Letterboxd and Bookmark Folders. Goodreads and Letterboxd open account connection; Bookmark Folders opens its
file-import setup and links to the extension instructions. Continuous bookmark folder watching
is configured in the Chrome extension's **Bookmark Folders** screen.

The desktop's Instagram capture sessions serialize API requests through the shared
persistent governor, including saved-feed pagination, likes and collection pages.
The local targets are a minimum 15-second gap with jitter, at most four requests
per minute, 60 per hour and 200 per day, shared across accounts. Window acquisition
also consumes a permit, so these are upper ceilings, not a promised throughput.
A 429 starts at least a 15-minute cooldown; repeated signals increase the fallback
and longer server Retry-After values take priority. Pending requests are cancelled
when their capture window is released. These conservative local policies cannot
guarantee that Instagram will never rate-limit an account. Likes hydration allows
more time for the slower API responses.
