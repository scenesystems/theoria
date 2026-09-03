/**
 * Re-exports the canvas profile catalog used by browser caches and synthetic
 * regression artifacts.
 *
 * @since 0.2.0
 */
import {
  BrowserSupportManifest as BrowserSupportManifestInternal,
  BrowserSupportManifestSchema as BrowserSupportManifestSchemaInternal,
  type BrowserSupportManifestType as BrowserSupportManifestTypeInternal,
  browserSupportProfile as browserSupportProfileInternal,
  BrowserSupportProfileIdSchema as BrowserSupportProfileIdSchemaInternal,
  type BrowserSupportProfileIdType as BrowserSupportProfileIdTypeInternal,
  BrowserSupportProfileSchema as BrowserSupportProfileSchemaInternal,
  type BrowserSupportProfileType as BrowserSupportProfileTypeInternal,
  DefaultBrowserSupportProfile as DefaultBrowserSupportProfileInternal
} from "../contracts/browserSupport.js"

/**
 * Shipped canvas profiles, font policies, and synthetic scenario coverage.
 *
 * @since 0.2.0
 * @category manifests
 */
export const BrowserSupportManifest = BrowserSupportManifestInternal

/**
 * Decoder for the non-empty browser profile catalog.
 *
 * @since 0.2.0
 * @category schemas
 */
export const BrowserSupportManifestSchema = BrowserSupportManifestSchemaInternal

/**
 * Resolves a shipped profile, using the catalog default when omitted.
 *
 * @since 0.2.0
 * @category manifests
 */
export const browserSupportProfile = browserSupportProfileInternal

/**
 * Decoder for `canvas-monospace` and `canvas-system-ui` profile IDs.
 *
 * @since 0.2.0
 * @category schemas
 */
export const BrowserSupportProfileIdSchema = BrowserSupportProfileIdSchemaInternal

/**
 * Decoder for one profile's font policy, engine settings, and regression metadata.
 *
 * @since 0.2.0
 * @category schemas
 */
export const BrowserSupportProfileSchema = BrowserSupportProfileSchemaInternal

/**
 * Shipped `canvas-monospace` profile.
 *
 * @since 0.2.0
 * @category manifests
 */
export const DefaultBrowserSupportProfile = DefaultBrowserSupportProfileInternal

/**
 * Decoded browser profile catalog.
 *
 * @since 0.2.0
 * @category models
 */
export type BrowserSupportManifestType = BrowserSupportManifestTypeInternal

/**
 * Browser cache and parity profile identifier.
 *
 * @since 0.2.0
 * @category models
 */
export type BrowserSupportProfileIdType = BrowserSupportProfileIdTypeInternal

/**
 * Decoded configuration for one browser profile.
 *
 * @since 0.2.0
 * @category models
 */
export type BrowserSupportProfileType = BrowserSupportProfileTypeInternal
