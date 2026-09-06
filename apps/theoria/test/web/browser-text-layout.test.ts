import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"

import * as BrowserDocument from "../../app/web/platform/BrowserDocument.js"
import { browserTextLayoutLayer } from "../../app/web/text/browserTextLayout.js"

describe("browser text layout", () => {
  it.effect("a document without a 2D canvas fails the layout layer with CanvasUnavailable, not an estimate", () =>
    Effect.gen(function*() {
      const failure = yield* Effect.flip(Layer.build(browserTextLayoutLayer))

      expect(failure).toBeInstanceOf(BrowserDocument.CanvasUnavailable)
    }).pipe(Effect.scoped, Effect.provide(BrowserDocument.layer)))
})
