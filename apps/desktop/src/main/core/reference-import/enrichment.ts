import type { Capture } from "@pond/schema/raw";
import { z } from "zod";

const FilmSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  original_title: z.string().optional(),
  release_date: z.string().optional(),
  overview: z.string().nullish(),
  poster_path: z.string().nullish(),
  runtime: z.number().nullish(),
  credits: z
    .object({ crew: z.array(z.object({ name: z.string(), job: z.string() })) })
    .optional(),
});

export interface ReferenceEnrichment {
  fetch: typeof fetch;
  tmdbKey?: string | null;
}

function normalizedTitle(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export async function enrichFilm(
  capture: Capture,
  dependencies: ReferenceEnrichment,
): Promise<Capture> {
  const key = dependencies.tmdbKey?.trim();
  if (!key) return capture;
  const headers = new Headers({ accept: "application/json" });
  const query = new URLSearchParams();
  if (key.includes(".")) headers.set("Authorization", `Bearer ${key}`);
  else query.set("api_key", key);
  const request = async (path: string, params = new URLSearchParams()) => {
    const url = new URL(`https://api.themoviedb.org/3/${path}`);
    url.search = new URLSearchParams([...query, ...params]).toString();
    const response = await dependencies.fetch(url, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`TMDB returned HTTP ${response.status}.`);
    return response.json();
  };
  let id = capture.extras?.film?.tmdbId;
  if (!id) {
    const params = new URLSearchParams({ query: capture.title ?? "" });
    const year = capture.extras?.film?.year;
    if (year) params.set("year", year);
    const { results } = z
      .object({ results: z.array(FilmSchema) })
      .parse(await request("search/movie", params));
    const matches = results.filter(
      (film) =>
        (!year || film.release_date?.slice(0, 4) === year) &&
        [film.title, film.original_title ?? ""].some(
          (title) =>
            normalizedTitle(title) === normalizedTitle(capture.title ?? ""),
        ),
    );
    if (matches.length !== 1)
      return {
        ...capture,
        extras: {
          ...capture.extras,
          film: {
            ...capture.extras?.film,
            match: matches.length ? "ambiguous" : "unresolved",
          },
        },
      };
    id = matches[0]?.id;
  }
  const film = FilmSchema.parse(
    await request(
      `movie/${id}`,
      new URLSearchParams({ append_to_response: "credits" }),
    ),
  );
  const directors =
    film.credits?.crew
      .filter((person) => person.job === "Director")
      .map((person) => person.name) ?? [];
  return {
    ...capture,
    description: film.overview || capture.description,
    author: directors.length ? { name: directors.join(", ") } : capture.author,
    media:
      film.poster_path && /^\/[\w./-]+$/.test(film.poster_path)
        ? [
            {
              type: "image",
              url: `https://image.tmdb.org/t/p/w780${film.poster_path}`,
            },
          ]
        : capture.media,
    extras: {
      ...capture.extras,
      film: {
        ...capture.extras?.film,
        tmdbId: film.id,
        year: film.release_date?.slice(0, 4) || capture.extras?.film?.year,
        originalTitle: film.original_title,
        directors,
        runtime: film.runtime ?? undefined,
        match: "matched",
      },
    },
  };
}

export async function enrichBook(
  capture: Capture,
  dependencies: ReferenceEnrichment,
): Promise<Capture> {
  const isbn = capture.extras?.book?.isbn;
  if (!isbn) return capture;
  const response = await dependencies.fetch(
    `https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok) return capture;
  const book = z
    .object({ works: z.array(z.object({ key: z.string() })).optional() })
    .parse(await response.json());
  const work = book.works?.[0]?.key;
  if (!work || !/^\/works\/[A-Za-z0-9]+$/.test(work)) return capture;
  const details = await dependencies.fetch(
    `https://openlibrary.org${work}.json`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!details.ok) return capture;
  const data = z
    .object({
      description: z
        .union([z.string(), z.object({ value: z.string() })])
        .optional(),
    })
    .parse(await details.json());
  const description = z.string().safeParse(data.description);
  return {
    ...capture,
    description: description.success
      ? description.data
      : (z.object({ value: z.string() }).safeParse(data.description).data
          ?.value ?? capture.description),
  };
}
