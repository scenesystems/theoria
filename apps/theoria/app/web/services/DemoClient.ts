import { Effect } from "effect"

import { type Capabilities, CapabilitiesEnvelope } from "../../contracts/capabilities.js"
import type { DemoError } from "../../contracts/demo-error.js"
import type { Id } from "../../contracts/id.js"
import { type PackageVersions, PackageVersionsEnvelope } from "../../contracts/package-versions.js"
import { type ProgramPreview, ProgramPreviewEnvelope } from "../../contracts/program-preview.js"
import { type RunData, RunEnvelope } from "../../contracts/run.js"

import { requestEnvelope, type SuccessEnvelopeData } from "./envelopeRequest.js"

const runPath = (id: Id): string => `/api/demos/${id}/run`
const preloadPath = (id: Id): string => `/api/demos/${id}/preload`
const streamPath = (id: Id): string => `/api/demos/${id}/stream`

export class DemoClient extends Effect.Service<DemoClient>()("theoria/DemoClient", {
  succeed: {
    run: (id: Id): Effect.Effect<RunData, DemoError> =>
      requestEnvelope(runPath(id), RunEnvelope, "POST").pipe(Effect.map(({ data }) => data)),
    runWithMeta: (id: Id): Effect.Effect<SuccessEnvelopeData<RunData>, DemoError> =>
      requestEnvelope(runPath(id), RunEnvelope, "POST"),
    preload: (id: Id): Effect.Effect<ProgramPreview, DemoError> =>
      requestEnvelope(preloadPath(id), ProgramPreviewEnvelope).pipe(Effect.map(({ data }) => data)),
    capabilities: (): Effect.Effect<Capabilities, DemoError> =>
      requestEnvelope("/api/capabilities", CapabilitiesEnvelope).pipe(Effect.map(({ data }) => data)),
    versions: (): Effect.Effect<PackageVersions, DemoError> =>
      requestEnvelope("/api/versions/packages", PackageVersionsEnvelope).pipe(Effect.map(({ data }) => data)),
    streamUrl: (id: Id, manifest: string | null = null): string => {
      const base = streamPath(id)

      return manifest !== null && manifest.trim().length > 0
        ? `${base}?manifest=${encodeURIComponent(manifest.trim())}`
        : base
    }
  }
}) {}
