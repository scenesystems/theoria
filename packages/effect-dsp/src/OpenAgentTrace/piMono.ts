/**
 * `pi-mono` experimental adapter surface.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

import { migratePiSessionEntries as migratePiSessionEntriesInternal } from "./piMono/migrate.js"
import {
  normalizeDatasetRow as normalizeDatasetRowInternal,
  publishedIntegrityDigest as publishedIntegrityDigestInternal
} from "./piMono/normalize.js"
import { resolvePiSessionContext as resolvePiSessionContextInternal } from "./piMono/resolve.js"
import { PiMonoDatasetRow, PiShareHfManifestEntry, PiShareHfReviewSidecar } from "./schema.js"

/**
 * Structured `pi-mono` adapter surface under the `OpenAgentTrace` namespace.
 *
 * @since 0.2.0
 */
export const PiMono = {
  migrateSessionEntries: migratePiSessionEntriesInternal,
  normalizeDatasetRow: normalizeDatasetRowInternal,
  publishedIntegrityDigest: publishedIntegrityDigestInternal,
  resolveSessionContext: resolvePiSessionContextInternal,
  decodeManifestEntry: Schema.decodeUnknown(PiShareHfManifestEntry),
  decodeDatasetRow: Schema.decodeUnknown(PiMonoDatasetRow),
  decodeReviewSidecar: Schema.decodeUnknown(PiShareHfReviewSidecar)
}
