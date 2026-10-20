import type { Capture } from "@pond/schema/raw";
import { descriptorFor, sourceIdFromUrl } from "@pond/schema/sources";
import { enrichFilm } from "../../../reference-import/enrichment";
import type { ReferenceSource } from "../../../reference-import/records";
import { TerminalError } from "../errors";
import type { ExtractInput, Extractor } from "../types";

interface ReferenceDependencies {
  page: (input: ExtractInput) => Promise<Capture>;
  tmdbKey: () => Promise<string | null>;
}

const defaultDependencies: ReferenceDependencies = {
  page: async (input) => {
    const { WebPageExtractor } = await import("./web");
    const { capture, html } = await new WebPageExtractor().extractWithHtml(
      input,
    );
    const tmdbId = Number(html.match(/data-tmdb-id=["'](\d+)/)?.[1]);
    if (
      Number.isInteger(tmdbId) &&
      tmdbId > 0 &&
      /data-tmdb-type=["']movie["']/.test(html)
    ) {
      capture.extras = { ...capture.extras, film: { tmdbId } };
    }
    return capture;
  },
  tmdbKey: async () => {
    const { getSecret } = await import("../../../../keychain");
    return (
      (await getSecret("reference:tmdb")) ?? process.env.TMDB_API_KEY ?? null
    );
  },
};

/** Public book and film pages share generic page capture, with stable Source identity. */
export class ReferenceExtractor implements Extractor {
  readonly id: string;
  readonly validUrl: readonly RegExp[];
  readonly cookieDomain = null;
  readonly tests;

  constructor(
    readonly source: ReferenceSource,
    private readonly dependencies = defaultDependencies,
  ) {
    this.id = `${source}-reference`;
    this.validUrl = descriptorFor(source).urlPatterns;
    this.tests =
      source === "goodreads"
        ? [
            {
              url: "https://www.goodreads.com/book/show/4671.The_Great_Gatsby",
              id: "4671",
            },
          ]
        : [
            {
              url: "https://letterboxd.com/film/perfect-days-2023/",
              id: "perfect-days-2023",
            },
          ];
  }

  authCookies(): boolean {
    return false;
  }

  suitable(url: URL): boolean {
    return this.validUrl.some((pattern) => pattern.test(url.href));
  }

  async extract(input: ExtractInput): Promise<Capture> {
    const page = await this.dependencies.page(input);
    const canonical =
      this.source === "letterboxd"
        ? page.url.replace(
            /^(https?:\/\/(?:www\.)?letterboxd\.com)\/[^/]+\/film\//,
            "$1/film/",
          )
        : page.url;
    const id = sourceIdFromUrl(this.source, canonical);
    if (!id)
      throw new TerminalError(
        `The page did not resolve to a ${this.source} item.`,
      );
    const capture: Capture = {
      ...page,
      source: this.source,
      id,
      url: canonical,
    };
    if (this.source === "goodreads") return capture;
    const year = page.title?.match(/\((\d{4})\)/)?.[1];
    capture.title = page.title?.replace(/\s*\(\d{4}\).*$/, "");
    capture.extras = {
      ...capture.extras,
      film: { ...capture.extras?.film, year },
    };
    try {
      return await enrichFilm(capture, {
        fetch: input.fetch ?? fetch,
        tmdbKey: await this.dependencies.tmdbKey(),
      });
    } catch {
      // Film capture remains useful when optional TMDB enrichment is unavailable.
      return capture;
    }
  }
}
