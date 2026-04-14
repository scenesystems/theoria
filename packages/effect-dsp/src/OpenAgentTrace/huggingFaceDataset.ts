/**
 * Hugging Face dataset document helpers for the experimental open-agent-trace lane.
 *
 * This seam stays package-local to corpus acquisition and intentionally does not
 * reuse `effect-inference/HuggingFace`, which remains inference-runtime only.
 *
 * @since 0.2.0
 */
import { Effect, Schema } from "effect"

import { PiMonoDatasetRow, PiShareHfManifestEntry } from "./schema.js"

const jsonlLines = (document: string) => document.split(/\r?\n/u).filter((line) => line.trim().length > 0)

const decodeJsonlDocument = <A, I>(schema: Schema.Schema<A, I, never>) => {
  const jsonSchema = Schema.parseJson(schema)

  return (document: string) =>
    Effect.forEach(jsonlLines(document), (line) => Schema.decode(jsonSchema)(line), {
      concurrency: 1
    })
}

/**
 * Decodes one `pi-share-hf` `manifest.jsonl` document.
 *
 * @since 0.2.0
 * @category combinators
 */
export const decodePiShareHfManifestDocument = decodeJsonlDocument(PiShareHfManifestEntry)

/**
 * Decodes one `badlogicgames/pi-mono` JSONL dataset document.
 *
 * @since 0.2.0
 * @category combinators
 */
export const decodePiMonoDatasetDocument = decodeJsonlDocument(PiMonoDatasetRow)
