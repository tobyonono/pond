import type { ExternalSource } from "@pond/schema/sources";
import { inject as arena } from "./arena/inject";
import { inject as cosmos } from "./cosmos/inject";
import { inject as goodreads } from "./goodreads/inject";
import { inject as instagram } from "./instagram/inject";
import { inject as letterboxd } from "./letterboxd/inject";
import { inject as pinterest } from "./pinterest/inject";
import { inject as reddit } from "./reddit/inject";
import { inject as threads } from "./threads/inject";
import { inject as tiktok } from "./tiktok/inject";
import { inject as twitter } from "./twitter/inject";
import { inject as youtube } from "./youtube/inject";

/** MAIN-world hooks; importing this from an isolated script would patch the wrong `fetch`. */
export const INJECTORS = {
  goodreads,
  letterboxd,
  twitter,
  instagram,
  pinterest,
  arena,
  cosmos,
  tiktok,
  youtube,
  reddit,
  threads,
} satisfies Record<ExternalSource, () => void>;
