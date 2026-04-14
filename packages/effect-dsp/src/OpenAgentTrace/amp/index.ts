/**
 * Structured Amp adapter surface under the `OpenAgentTrace` namespace.
 *
 * @since 0.2.0
 */
import { loadCheckedInAmpFixtureCatalog, loadCheckedInAmpFixtureThreadIds } from "./catalog.js"
import {
  AMP_PUBLIC_THREAD_ID,
  loadCaptureEvidence,
  loadPluginAdapterCapture,
  loadPluginCapture,
  loadStreamJsonAdapterCapture,
  loadStreamJsonCapture
} from "./fixture.js"
import { decodePlugin, normalizePlugin, pluginAdapter } from "./plugin.js"
import { decodeStreamJson, normalizeStreamJson, streamJsonAdapter } from "./streamJson.js"

/**
 * Checked-in catalog for package-owned public Amp fixtures.
 *
 * @since 0.2.0
 */
export * from "./catalog.js"

/**
 * Amp Plugin API raw-capture schema, decoder, normalizer, and shared adapter.
 *
 * @since 0.2.0
 */
export * from "./plugin.js"

/**
 * Checked-in provenance and strict fixture loading for the public Amp thread lane.
 *
 * @since 0.2.0
 */
export * from "./captureEvidence.js"

/**
 * Checked-in provenance and strict fixture loading for the public Amp thread lane.
 *
 * @since 0.2.0
 */
export * from "./fixture.js"

/**
 * Amp `--stream-json` raw-capture schema, decoder, normalizer, and shared adapter.
 *
 * @since 0.2.0
 */
export * from "./streamJson.js"

/**
 * Structured Amp adapter surface under the `OpenAgentTrace` namespace.
 *
 * @since 0.2.0
 */
export const Amp = {
  pluginAdapter,
  streamJsonAdapter,
  decodePlugin,
  decodeStreamJson,
  normalizePlugin,
  normalizeStreamJson,
  publicThreadId: AMP_PUBLIC_THREAD_ID,
  loadCheckedInFixtureCatalog: loadCheckedInAmpFixtureCatalog,
  loadCheckedInFixtureThreadIds: loadCheckedInAmpFixtureThreadIds,
  loadCaptureEvidence,
  loadPluginCapture,
  loadStreamJsonCapture,
  loadPluginAdapterCapture,
  loadStreamJsonAdapterCapture
}
