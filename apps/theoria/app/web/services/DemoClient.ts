import { Effect, Schema } from "effect"
import * as ParseResult from "effect/ParseResult"

import { DemoDecodeError, type DemoError, DemoExecutionError, DemoRequestError } from "../../contracts/demo-error.js"
import type { Metadata } from "../../contracts/envelope.js"
import type { ErrorModel } from "../../contracts/error.js"
import type { Id } from "../../contracts/id.js"
import { type PackageVersions, PackageVersionsEnvelope } from "../../contracts/package-versions.js"
import { type ProgramPreview, ProgramPreviewEnvelope } from "../../contracts/program-preview.js"
import { type RunData, RunEnvelope } from "../../contracts/run.js"

const formatParseError = (error: ParseResult.ParseError): string => ParseResult.TreeFormatter.formatErrorSync(error)

type SuccessEnvelopeData<A> = {
  readonly data: A
  readonly meta: Metadata
}

type DecodedEnvelope<A> =
  | { readonly ok: true; readonly meta: Metadata; readonly data: A }
  | { readonly ok: false; readonly meta: Metadata; readonly error: ErrorModel }

const fetchJson = (path: string) =>
  Effect.tryPromise({
    try: () =>
      fetch(path, {
        method: "GET",
        headers: {
          accept: "application/json"
        }
      }),
    catch: (cause) => new DemoRequestError({ message: String(cause) })
  }).pipe(
    Effect.flatMap((response) =>
      Effect.tryPromise({
        try: () => response.json(),
        catch: (cause) => new DemoRequestError({ message: String(cause) })
      })
    )
  )

const requestDecodedEnvelope = <A, I>(
  path: string,
  schema: Schema.Schema<DecodedEnvelope<A>, I>
) =>
  fetchJson(path).pipe(
    Effect.flatMap((json) =>
      Schema.decodeUnknown(schema)(json).pipe(
        Effect.mapError((error) => new DemoDecodeError({ message: formatParseError(error) }))
      )
    )
  )

const requestEnvelope = <A, I>(
  path: string,
  schema: Schema.Schema<DecodedEnvelope<A>, I>
): Effect.Effect<SuccessEnvelopeData<A>, DemoError> =>
  requestDecodedEnvelope(path, schema).pipe(
    Effect.flatMap((envelope) =>
      envelope.ok
        ? Effect.succeed({
          data: envelope.data,
          meta: envelope.meta
        })
        : Effect.fail(
          new DemoExecutionError({
            code: envelope.error.code,
            message: envelope.error.message,
            retryable: envelope.error.retryable
          })
        )
    )
  )

const runPath = (id: Id): string => `/api/demos/${id}/run`
const preloadPath = (id: Id): string => `/api/demos/${id}/preload`
const streamPath = (id: Id): string => `/api/demos/${id}/stream`

const streamQuery = ({
  manifest,
  runToken
}: {
  readonly manifest: string | null
  readonly runToken: string | null
}): string => {
  const params = new URLSearchParams()

  if (runToken !== null && runToken.trim().length > 0) {
    params.set("runToken", runToken.trim())
  }

  if (manifest !== null && manifest.trim().length > 0) {
    params.set("manifest", manifest.trim())
  }

  const encoded = params.toString()

  return encoded.length > 0 ? `?${encoded}` : ""
}

export class DemoClient extends Effect.Service<DemoClient>()("theoria/DemoClient", {
  succeed: {
    run: (id: Id): Effect.Effect<RunData, DemoError> =>
      requestEnvelope(runPath(id), RunEnvelope).pipe(Effect.map(({ data }) => data)),
    runWithMeta: (id: Id): Effect.Effect<SuccessEnvelopeData<RunData>, DemoError> =>
      requestEnvelope(runPath(id), RunEnvelope),
    preload: (id: Id): Effect.Effect<ProgramPreview, DemoError> =>
      requestEnvelope(preloadPath(id), ProgramPreviewEnvelope).pipe(Effect.map(({ data }) => data)),
    versions: (): Effect.Effect<PackageVersions, DemoError> =>
      requestEnvelope("/api/versions/packages", PackageVersionsEnvelope).pipe(Effect.map(({ data }) => data)),
    streamUrl: (id: Id, manifest: string | null = null, runToken: string | null = null): string =>
      `${streamPath(id)}${streamQuery({ manifest, runToken })}`
  }
}) {}
