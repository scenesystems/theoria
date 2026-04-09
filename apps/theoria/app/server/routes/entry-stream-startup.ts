import { Match, Option, Schema } from "effect"

import type { RunnableEntryId } from "../../contracts/entry/id.js"
import { type EntryRunRequest, EntryRunRequest as EntryRunRequestSchema } from "../../contracts/entry/registry.js"
import { decodeStreamManifest, type StreamManifest } from "../../contracts/evidence/manifest.js"
import type { EntryStreamRequest } from "../kernel/stream-request.js"

const EntryRunRequestJson = Schema.parseJson(EntryRunRequestSchema)

export type StreamStartup =
  | { readonly _tag: "DraftStartup"; readonly request: EntryRunRequest }
  | { readonly _tag: "ManifestStartup"; readonly manifest: StreamManifest | null; readonly runToken: string }

export type ParsedEntryStreamQuery =
  | { readonly _tag: "ParsedStreamQuery"; readonly startup: StreamStartup }
  | { readonly _tag: "InvalidStreamQuery"; readonly message: string }

const draftStartup = (request: EntryRunRequest): StreamStartup => ({
  _tag: "DraftStartup",
  request
})

const manifestStartup = ({
  manifest,
  runToken
}: {
  readonly manifest: StreamManifest | null
  readonly runToken: string
}): StreamStartup => ({
  _tag: "ManifestStartup",
  manifest,
  runToken
})

const parsedStreamQuery = (startup: StreamStartup): ParsedEntryStreamQuery => ({
  _tag: "ParsedStreamQuery",
  startup
})

const invalidStreamQuery = (message: string): ParsedEntryStreamQuery => ({
  _tag: "InvalidStreamQuery",
  message
})

export const streamRequestFromStartup = ({
  definitionId,
  startup
}: {
  readonly definitionId: RunnableEntryId
  readonly startup: StreamStartup
}): EntryStreamRequest =>
  Match.value(startup).pipe(
    Match.tag("DraftStartup", ({ request }) => ({
      runToken: request.runToken,
      draft: request.draft,
      plan: null
    })),
    Match.tag("ManifestStartup", ({ manifest, runToken }) => ({
      runToken,
      draft: null,
      plan: {
        id: definitionId,
        manifest
      }
    })),
    Match.exhaustive
  )

export const parseEntryStreamQuery = (rawUrl: string | null): ParsedEntryStreamQuery => {
  if (rawUrl === null) {
    return invalidStreamQuery("Streaming runs require a run token.")
  }

  const url = new URL(rawUrl, "http://127.0.0.1")
  const rawRequest = url.searchParams.get("request")

  if (rawRequest !== null && rawRequest.trim().length > 0) {
    return Schema.decodeUnknownEither(EntryRunRequestJson)(rawRequest.trim()).pipe(
      Match.value,
      Match.tag("Right", ({ right }) => parsedStreamQuery(draftStartup(right))),
      Match.tag("Left", () => invalidStreamQuery("Stream request did not decode against the entry-run contract.")),
      Match.exhaustive
    )
  }

  const rawRunToken = url.searchParams.get("runToken")
  const rawManifest = url.searchParams.get("manifest")
  const manifest = rawManifest !== null && rawManifest.trim().length > 0
    ? Option.getOrElse(decodeStreamManifest(rawManifest.trim()), () => null)
    : null

  if (rawManifest !== null && rawManifest.trim().length > 0 && manifest === null) {
    return invalidStreamQuery("Stream manifest did not decode against the contract.")
  }

  if (rawRunToken === null || rawRunToken.trim().length === 0) {
    return invalidStreamQuery("Streaming runs require a run token.")
  }

  return parsedStreamQuery(
    manifestStartup({
      manifest,
      runToken: rawRunToken.trim()
    })
  )
}
