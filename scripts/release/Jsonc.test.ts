import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import { parse } from "./Jsonc.js"

const Document = Schema.Struct({
  url: Schema.String,
  values: Schema.Array(Schema.Finite),
  nested: Schema.Struct({ enabled: Schema.Boolean })
})

describe("release JSONC codec", () => {
  it.effect("accepts comments and trailing commas without changing quoted strings", () =>
    Schema.decodeEffect(parse(Document))(`{
      // Comments may precede properties.
      "url": "https://example.test/a//b/*literal*/",
      "values": [1, 2,],
      "nested": {
        "enabled": true, /* and may follow values */
      },
    }`).pipe(
      Effect.map((value) => {
        expect(value.url).toBe("https://example.test/a//b/*literal*/")
        expect(value.values).toEqual([1, 2])
        expect(value.nested.enabled).toBe(true)
      })
    ))

  it.effect("rejects malformed input rather than repairing it", () =>
    Effect.forEach([
      "{\"url\":\"unterminated, \"values\": [], \"nested\": {\"enabled\": true}}",
      "{\"url\":\"ok\", /* unterminated",
      "{\"url\":\"ok\", \"values\":[1,,2], \"nested\":{\"enabled\":true}}"
    ], (source) =>
      Schema.decodeEffect(parse(Document))(source).pipe(Effect.flip), { discard: true }))

  it.effect("encodes decoded values as strict JSON", () =>
    Schema.encodeEffect(parse(Document))({
      url: "https://example.test/a//b",
      values: [1, 2],
      nested: { enabled: true }
    }).pipe(
      Effect.map((encoded) => {
        expect(encoded).toBe("{\"url\":\"https://example.test/a//b\",\"values\":[1,2],\"nested\":{\"enabled\":true}}")
      })
    ))
})
