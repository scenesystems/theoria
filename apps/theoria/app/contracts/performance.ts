import { Schema } from "effect"

/** The homepage's measured performance limits, shared by build and browser checks. */
export const WebVitalBudgets = Schema.Struct({
  /** Google's good largest contentful paint threshold. */
  lcpMs: Schema.Number,
  /** Google's good cumulative layout shift threshold. */
  cls: Schema.Number,
  /** Google's good interaction to next paint threshold. */
  inpMs: Schema.Number,
  /** Gzip bytes of every script loaded by `dist/index.html` on first paint. */
  homepageScriptGzipBytes: Schema.Number
})

export type WebVitalBudgets = typeof WebVitalBudgets.Type

/**
 * The first three values are Google's good thresholds. The 512 KiB script
 * limit covers the module entry and its modulepreloads, about 5% above the
 * measured 498 KB so growth fails the build.
 */
export const webVitalBudgets: WebVitalBudgets = WebVitalBudgets.make({
  lcpMs: 2500,
  cls: 0.1,
  inpMs: 200,
  homepageScriptGzipBytes: 524_288
})
