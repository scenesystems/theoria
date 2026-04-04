import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import packageJson from "../../package.json" with { type: "json" }
import * as BrowserSurface from "../../src/Browser/index.js"
import * as ReactSurface from "../../src/React/index.js"

const ExportsRecordSchema = Schema.Record({ key: Schema.String, value: Schema.Unknown })

const exportsRecord = Schema.decodeUnknownSync(ExportsRecordSchema)(packageJson.exports)

describe("browser and react companion subpaths", () => {
  it.effect("effect-text/browser exports the supported browser companion surface", () =>
    Effect.sync(() => {
      expect(exportsRecord["./browser"]).toStrictEqual("./src/Browser/index.ts")
      expect(BrowserSurface.BrowserStability).toBe("provisional")
      expect(BrowserSurface.CanvasTextMeasurerLive).toBeDefined()
      expect(BrowserSurface.BrowserMeasurementCacheLive).toBeDefined()
      expect(BrowserSurface.BrowserSupportManifest).toBeDefined()
      expect(BrowserSurface.browserParityCaseIds).toBeDefined()
      expect(BrowserSurface.browserParityCasesForProfile).toBeDefined()
      expect(BrowserSurface.renderBrowserParityArtifact).toBeDefined()
      expect("PrepareIdentity" in BrowserSurface).toBe(false)
      expect("prepareIdentityFor" in BrowserSurface).toBe(false)
    }))

  it.effect("effect-text/react exports the supported React companion surface", () =>
    Effect.sync(() => {
      expect(exportsRecord["./react"]).toStrictEqual("./src/React/index.ts")
      expect(ReactSurface.ReactStability).toBe("provisional")
      expect(ReactSurface.PrepareIdentity).toBeDefined()
      expect(ReactSurface.prepareIdentityFor).toBeDefined()
      expect(ReactSurface.prepareIdentityKey).toBeDefined()
      expect(ReactSurface.prepareIdentityFromKey).toBeDefined()
      expect(ReactSurface.engineProfileIdentity).toBeDefined()
      expect(ReactSurface.PreparedLayoutProjection).toBeDefined()
      expect(ReactSurface.layoutSummaryFromLines).toBeDefined()
      expect(ReactSurface.projectPreparedLayout).toBeDefined()
      expect("CanvasTextMeasurerLive" in ReactSurface).toBe(false)
      expect("BrowserMeasurementCacheLive" in ReactSurface).toBe(false)
    }))
})
