/**
 * `pi-mono` experimental adapter surface.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

import { migratePiSessionEntries as migratePiSessionEntriesInternal } from "./piMono/migrate.js"
import {
  normalizePiMonoDatasetRow as normalizePiMonoDatasetRowInternal,
  publishedIntegrityDigest as publishedIntegrityDigestInternal
} from "./piMono/normalize.js"
import { resolvePiSessionContext as resolvePiSessionContextInternal } from "./piMono/resolve.js"
import { PiMonoDatasetRow, PiShareHfManifestEntry, PiShareHfReviewSidecar } from "./schema.js"

/**
 * `migratePiSessionEntries` — migrate raw `pi` traces into the canonical entry family.
 *
 * @since 0.2.0
 */
export const migratePiSessionEntries = migratePiSessionEntriesInternal

/**
 * `normalizePiMonoDatasetRow` — normalize one public `pi-mono` row into `OpenAgentTraceRecord`.
 *
 * @since 0.2.0
 */
export const normalizePiMonoDatasetRow = normalizePiMonoDatasetRowInternal

/**
 * `publishedIntegrityDigest` — read the published corpus integrity identity from one manifest entry.
 *
 * @since 0.2.0
 */
export const publishedIntegrityDigest = publishedIntegrityDigestInternal

/**
 * `resolvePiSessionContext` — resolve the active path, compaction view, and branch lineage for one migrated session.
 *
 * @since 0.2.0
 */
export const resolvePiSessionContext = resolvePiSessionContextInternal

/**
 * Decodes one `pi-share-hf` manifest entry.
 *
 * @since 0.2.0
 * @category combinators
 */
export const decodePiShareHfManifestEntry = Schema.decodeUnknown(PiShareHfManifestEntry)

/**
 * Decodes one `badlogicgames/pi-mono` dataset row.
 *
 * @since 0.2.0
 * @category combinators
 */
export const decodePiMonoDatasetRow = Schema.decodeUnknown(PiMonoDatasetRow)

/**
 * Decodes one `pi-share-hf` review sidecar.
 *
 * @since 0.2.0
 * @category combinators
 */
export const decodePiShareHfReviewSidecar = Schema.decodeUnknown(PiShareHfReviewSidecar)
