import { describe, expect, it } from "vitest";
import type { JsonValue } from "@/utils/json";
import { collectGoodreadsBookIds, goodreadsSaveRequest } from "./save-request";

describe("Goodreads save capture", () => {
  const body = JSON.stringify({
    operationName: "ShelveBook",
    variables: { input: { id: "kca://book/example", shelfName: "to-read" } },
  });
  const response = {
    data: { shelveBook: { shelving: { book: { id: "kca://book/example" } } } },
  };

  it("resolves the public book ID from the site's normalized page state", () => {
    const ids = new Map<string, string>();
    collectGoodreadsBookIds(
      {
        props: {
          pageProps: {
            apolloState: JSON.stringify({
              "Book:example": {
                __typename: "Book",
                id: "kca://book/example",
                legacyId: 4671,
              },
            }),
          },
        },
      },
      ids,
    );
    expect(
      goodreadsSaveRequest(body, response, (id) => ids.get(id) ?? null),
    ).toEqual({ bookId: "4671", shelf: "to-read" });
  });

  it("does not capture errors, unrelated operations, or unresolved book IDs", () => {
    expect(
      goodreadsSaveRequest(
        body,
        { errors: [{ message: "not signed in" }] },
        () => "4671",
      ),
    ).toBeNull();
    expect(
      goodreadsSaveRequest(body, { data: { shelveBook: null } }, () => "4671"),
    ).toBeNull();
    expect(goodreadsSaveRequest(body, response, () => null)).toBeNull();
    expect(
      goodreadsSaveRequest(
        JSON.stringify({ operationName: "UnshelveBook" }),
        response,
        () => "4671",
      ),
    ).toBeNull();
  });

  it("captures ratings and custom shelf tags only after a successful mutation", () => {
    const cases: Array<[string, string, JsonValue, string]> = [
      ["RateBook", "rateBook", { review: { id: "review" } }, "rated"],
      [
        "TagBook",
        "tagBook",
        { taggings: [{ tag: { name: "design" } }] },
        "tagged",
      ],
    ];
    for (const [operationName, field, value, shelf] of cases) {
      const body = JSON.stringify({
        operationName,
        variables: { input: { id: "4671" } },
      });
      expect(
        goodreadsSaveRequest(body, { data: { [field]: value } }, () => null),
      ).toEqual({ bookId: "4671", shelf });
      expect(
        goodreadsSaveRequest(body, { data: { [field]: null } }, () => null),
      ).toBeNull();
    }
  });

  it("accepts a numeric ID without reading unrelated page data", () => {
    expect(
      goodreadsSaveRequest(
        JSON.stringify({
          operationName: "ShelveBook",
          variables: { input: { id: "4671", shelfName: "read" } },
        }),
        response,
        () => null,
      ),
    ).toEqual({ bookId: "4671", shelf: "read" });
  });
});
