/**
 * Browser support data for the canvas-backed measurement layer.
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
 * Browser support data published by the package.
 *
 * @since 0.2.0
 * @category manifests
 */
export const BrowserSupportManifest = BrowserSupportManifestInternal

/**
 * Browser support schema published by the package.
 *
 * @since 0.2.0
 * @category schemas
 */
export const BrowserSupportManifestSchema = BrowserSupportManifestSchemaInternal

/**
 * Browser support profile resolver.
 *
 * @since 0.2.0
 * @category manifests
 */
export const browserSupportProfile = browserSupportProfileInternal

/**
 * Browser support profile identifier schema.
 *
 * @since 0.2.0
 * @category schemas
 */
export const BrowserSupportProfileIdSchema = BrowserSupportProfileIdSchemaInternal

/**
 * Browser support profile schema.
 *
 * @since 0.2.0
 * @category schemas
 */
export const BrowserSupportProfileSchema = BrowserSupportProfileSchemaInternal

/**
 * Default browser support profile.
 *
 * @since 0.2.0
 * @category manifests
 */
export const DefaultBrowserSupportProfile = DefaultBrowserSupportProfileInternal

/**
 * Browser support data type.
 *
 * @since 0.2.0
 * @category models
 */
export type BrowserSupportManifestType = BrowserSupportManifestTypeInternal

/**
 * Browser support profile identifier type.
 *
 * @since 0.2.0
 * @category models
 */
export type BrowserSupportProfileIdType = BrowserSupportProfileIdTypeInternal

/**
 * Browser support profile type.
 *
 * @since 0.2.0
 * @category models
 */
export type BrowserSupportProfileType = BrowserSupportProfileTypeInternal
