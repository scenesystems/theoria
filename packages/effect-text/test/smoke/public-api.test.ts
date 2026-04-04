import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import * as EffectText from "../../src/index.js"

describe("effect-text public api", () => {
  it.effect("exports stable and provisional namespaces from the root entrypoint", () =>
    Effect.sync(() => {
      expect(EffectText.Browser).toBeDefined()
      expect(EffectText.Browser.BrowserStability).toBe("provisional")
      expect(EffectText.Browser.CanvasTextMeasurerLive).toBeDefined()
      expect(EffectText.Browser.BrowserMeasurementCacheLive).toBeDefined()
      expect(EffectText.Browser.DefaultBrowserSupportProfile).toBeDefined()
      expect(EffectText.Browser.browserSupportProfile).toBeDefined()
      expect(EffectText.Browser.BrowserSupportManifest).toBeDefined()
      expect(EffectText.Browser.BrowserSupportProfileIdSchema).toBeDefined()
      expect(EffectText.Browser.BrowserSupportProfileSchema).toBeDefined()
      expect(EffectText.Browser.BrowserSupportManifestSchema).toBeDefined()
      expect(EffectText.Browser.initialFontReadinessRevision).toBeDefined()
      expect(EffectText.Browser.incrementFontReadinessRevision).toBeDefined()
      expect(EffectText.Browser.FontReadinessRevision).toBeDefined()

      expect(EffectText.Text).toBeDefined()
      expect(EffectText.Text.TextStability).toBe("provisional")
      expect(EffectText.Text.prepare).toBeDefined()
      expect(EffectText.Text.prepareWithSegments).toBeDefined()
      expect(EffectText.Text.layout).toBeDefined()
      expect(EffectText.Text.layoutLinesWith).toBeDefined()
      expect(EffectText.Text.TextLayoutLive).toBeDefined()
      expect(EffectText.Text.PreparedText).toBeDefined()
      expect(EffectText.Text.PreparedTextWithSegments).toBeDefined()

      expect(EffectText.Contracts).toBeDefined()
      expect(EffectText.Contracts.ContractsStability).toBe("stable")
      expect(EffectText.Contracts.WordSegmenter).toBeDefined()
      expect(EffectText.Contracts.TextMeasurer).toBeDefined()
      expect(EffectText.Contracts.MeasurementCache).toBeDefined()
      expect(EffectText.Contracts.EngineProfile).toBeDefined()

      expect(EffectText.Errors).toBeDefined()
      expect(EffectText.Errors.ErrorsStability).toBe("stable")
      expect(EffectText.Errors.TextLayoutDecodeError).toBeDefined()
      expect(EffectText.Errors.MeasurementFailed).toBeDefined()

      expect(EffectText.Experimental).toBeDefined()
      expect(EffectText.Experimental.ExperimentalStability).toBe("experimental")
      expect(EffectText.Experimental.ExperimentalSeams).toContain("Calibration")
      expect(EffectText.Experimental.Calibration).toBeDefined()
      expect(EffectText.Experimental.Calibration.CalibrationStability).toBe("experimental")
      expect(EffectText.Experimental.Calibration.evaluateProfile).toBeDefined()
      expect(EffectText.Experimental.Calibration.makeProfileSearchSpace).toBeDefined()
      expect(EffectText.Experimental.Calibration.optimizeProfile).toBeDefined()
    }))
})
