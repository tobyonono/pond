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
  get cookieDomain(): string {
    return this.source === "goodreads" ? ".goodreads.com" : ".letterboxd.com";
  }

  get probeExpression(): string {
    if (this.source === "letterboxd")
      return `(() => {
      const person = window.person;
      return person?.loggedIn && /^[A-Za-z0-9_-]{1,64}$/.test(person.username) ? person.username : "";
    })()`;
    return String.raw`(() => {
      if (document.querySelector('header[data-auth="0"]')) return "";
      const own = location.pathname.match(/^\/review\/list\/(\d+)/);
      if (own) return own[1];
      const links = document.querySelectorAll('header a[href*="/review/list/"], header[data-auth="1"] a[href*="/user/show/"], .siteHeader a[href*="/review/list/"], #userDropMenu a[href*="/user/show/"], .personalNav a[href*="/review/list/"]');
      for (const link of links) {
        const match = link.getAttribute("href")?.match(/\/(?:review\/list|user\/show)\/(\d+)/);
        if (match) return match[1];
      }
      return "";
    })()`;
  }

  handleFromPath = (segments: string[]): string | null => {
    const first = segments[0];
    if (!first) return null;
    if (this.source === "goodreads")
      return segments.length === 1 && /^\d+$/.test(first) ? first : null;
    return /^[A-Za-z0-9_-]{1,64}$/.test(first) &&
      !["film", "films", "sign-in", "settings", "people", "member"].includes(
        first,
      )
      ? first
      : null;
  };
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

  authCookies(name: string, value?: string): boolean {
    if (!value) return false;
    return this.source === "goodreads"
      ? ["_session_id2", "jwt_token"].includes(name)
      : [
          "letterboxd.user",
          "letterboxd.session",
          "letterboxd.signed.in.as",
          "JSESSIONID",
        ].includes(name);
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
