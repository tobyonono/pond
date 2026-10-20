import type { Capture } from "@pond/schema/raw";
import { userError } from "../../../shared/user-error";

export type ReferenceSource = "goodreads" | "letterboxd";

export interface ReferenceRecord {
  capture: Capture;
  folders: string[];
  rating?: number;
  note?: string;
  savedAt?: Date;
}

/** Export CSVs contain quoted commas, escaped quotes, BOMs and multiline reviews. */
export function csvRecords(
  text: string,
  required: string[],
): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(cell);
      cell = "";
    } else if (!quoted && (char === "\r" || char === "\n")) {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      rows.push([...row, cell]);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (quoted) throw userError("The CSV has an unterminated quoted field.");
  rows.push([...row, cell]);
  const headerIndex = rows.findIndex((cells) =>
    required.every((name) => cells.includes(name)),
  );
  const header = rows[headerIndex];
  if (!header)
    throw userError(`Expected an export with ${required.join(", ")} columns.`);
  return rows
    .slice(headerIndex + 1)
    .filter((cells) => cells.some((value) => value.trim()))
    .map((cells) =>
      Object.fromEntries(
        header.map((name, index) => [name.trim(), cells[index]?.trim() ?? ""]),
      ),
    );
}

function exportDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  // Date-only export values are interpreted at UTC midnight on every machine.
  const normalized = value.replace(/\//g, "-");
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? `${normalized}T00:00:00Z` : value,
  );
  return Number.isFinite(date.getTime()) ? date : undefined;
}

export function parseGoodreadsExport(text: string): ReferenceRecord[] {
  const records = new Map<string, ReferenceRecord>();
  for (const row of csvRecords(text, ["Book Id", "Title", "Author"])) {
    const id = row["Book Id"];
    if (!id || !/^\d+$/.test(id) || !row.Title) continue;
    const isbn = (row.ISBN13 || row.ISBN || "").replace(/[^\dX]/gi, "");
    const shelves = [
      ...new Set(
        [row["Exclusive Shelf"], ...(row.Bookshelves ?? "").split(",")]
          .map((s) => s?.trim())
          .filter((s): s is string => Boolean(s)),
      ),
    ];
    const rating = Number(row["My Rating"]);
    const previous = records.get(id);
    records.set(id, {
      capture: {
        id,
        source: "goodreads",
        url: `https://www.goodreads.com/book/show/${id}`,
        title: row.Title,
        author: row.Author ? { name: row.Author } : undefined,
        media: isbn
          ? [
              {
                type: "image",
                url: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
              },
            ]
          : [],
        extras: {
          book: {
            isbn: isbn || undefined,
            year: row["Original Publication Year"] || undefined,
          },
        },
      },
      folders: [
        ...new Set([
          ...(previous?.folders ?? []),
          ...shelves.map((s) => `Goodreads/${s}`),
        ]),
      ],
      rating: rating > 0 && rating <= 5 ? rating : undefined,
      note: row["My Review"] || undefined,
      savedAt: exportDate(row["Date Added"]),
    });
  }
  return [...records.values()];
}

export interface FilmExport {
  name: string;
  text: string;
}

export function parseLetterboxdExport(files: FilmExport[]): ReferenceRecord[] {
  const films = new Map<string, ReferenceRecord>();
  for (const file of files) {
    const list =
      file.name === "likes/films.csv"
        ? "liked"
        : file.name === "ratings.csv"
          ? "rated"
          : file.name === "diary.csv"
            ? "watched"
            : file.name.replace(/^lists\//, "").replace(/\.csv$/i, "");
    for (const row of csvRecords(file.text, [
      "Name",
      "Year",
      "Letterboxd URI",
    ])) {
      if (!row.Name) continue;
      const url = row["Letterboxd URI"];
      if (!url || !/^https:\/\/(?:letterboxd\.com|boxd\.it)\//.test(url))
        continue;
      const identity = `${row.Name.toLowerCase()} (${row.Year})`;
      const previous = films.get(identity);
      const rating = Number(row.Rating);
      films.set(identity, {
        capture: {
          id: identity,
          source: "letterboxd",
          url,
          title: row.Name,
          media: [],
          extras: { film: { year: row.Year || undefined } },
        },
        folders: [
          ...new Set([...(previous?.folders ?? []), `Letterboxd/${list}`]),
        ],
        rating: rating > 0 && rating <= 5 ? rating : previous?.rating,
        savedAt: previous?.savedAt ?? exportDate(row.Date),
      });
    }
  }
  return [...films.values()];
}

function xmlText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_match, digits: string) => {
      const code = Number(digits);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Only reads RSS item fields; never expands XML entities or external resources. */
export function parseLetterboxdRss(xml: string): ReferenceRecord[] {
  if (!/<rss\b/i.test(xml) || /<!DOCTYPE|<!ENTITY/i.test(xml))
    throw userError("Expected a Letterboxd RSS feed.");
  const records: ReferenceRecord[] = [];
  for (const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const item = match[1] ?? "";
    const field = (name: string) =>
      xmlText(
        item
          .match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1]
          ?.trim() ?? "",
      );
    const title = field("letterboxd:filmTitle");
    const year = field("letterboxd:filmYear");
    const url = field("link");
    if (!title || !url.startsWith("https://letterboxd.com/")) continue;
    const poster = xmlText(field("description")).match(
      /<img\b[^>]*src=["']([^"']+)/i,
    )?.[1];
    const tmdbId = Number(field("tmdb:movieId"));
    const rating = Number(field("letterboxd:memberRating"));
    records.push({
      capture: {
        id: `${title.toLowerCase()} (${year})`,
        source: "letterboxd",
        url,
        title,
        media: poster?.startsWith("https://")
          ? [{ type: "image", url: poster }]
          : [],
        extras: {
          film: {
            year: year || undefined,
            tmdbId: Number.isInteger(tmdbId) && tmdbId > 0 ? tmdbId : undefined,
          },
        },
      },
      folders: ["Letterboxd/watched"],
      rating: rating > 0 && rating <= 5 ? rating : undefined,
      savedAt: exportDate(field("letterboxd:watchedDate") || field("pubDate")),
    });
  }
  return records;
}
