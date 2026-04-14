/**
 * Normalize one checked-in `pi-mono` fixture, project it into workflow and artifact
 * surfaces, seal the non-public review boundary, and sign the public corpus manifest.
 *
 * Run: bun run examples/20-open-agent-trace-pi-mono.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { generateKey } from "@scenesystems/seal"
import { generateKeyPair } from "@scenesystems/sign"
import { Effect, Redacted, Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"
import * as SearchContracts from "effect-search/Contracts"

import {
  piMonoTaskFirstRowFixture,
  piShareHfManifestFixture,
  piShareHfReviewSidecarFixture
} from "../fixtures/open-agent-trace/pi-mono/index.js"

const program = Effect.gen(function*() {
  const manifestEntry = yield* Experimental.OpenAgentTrace.PiMono.decodeManifestEntry(piShareHfManifestFixture)
  const reviewSidecar = yield* Experimental.OpenAgentTrace.PiMono.decodeReviewSidecar(piShareHfReviewSidecarFixture)
  const record = yield* Experimental.OpenAgentTrace.PiMono.normalizeDatasetRow({
    datasetId: "badlogicgames/pi-mono",
    datasetRevision: "main",
    split: "train",
    sourceUrl: "https://huggingface.co/datasets/badlogicgames/pi-mono",
    licenseTag: "other",
    row: yield* Experimental.OpenAgentTrace.PiMono.decodeDatasetRow(piMonoTaskFirstRowFixture),
    manifestEntry,
    reviewSidecar
  })
  const workflowProjection = yield* Experimental.OpenAgentTrace.WorkflowProjection.project(record)
  const runId = yield* Schema.decode(SearchContracts.RunId)("01ARZ3NDEKTSV4RRFFQ69G5FAV")
  const packageVersion = yield* Schema.decode(SearchContracts.PackageVersion)("0.1.4")
  const emittedAt = yield* Schema.decode(Schema.DateTimeUtc)("2026-04-06T18:30:00.000Z")
  const artifact = yield* Experimental.OpenAgentTrace.WorkflowProjectionArtifact.project({
    record,
    projection: workflowProjection,
    packageVersion,
    runId,
    sequence: 0,
    emittedAt
  })
  const sealKey = yield* generateKey()
  const sealedReviewBundle = yield* Experimental.OpenAgentTrace.sealOpenAgentTracePrivateReviewBundle({
    record,
    key: sealKey,
    reviewSidecar,
    keyMetadata: { keyId: "open-agent-trace-example", keyVersion: 1 },
    policy: new Experimental.OpenAgentTrace.RedactionPolicy({
      policyId: "open-agent-trace-public-corpus",
      policyVersion: 2,
      imageHandling: "keep-images",
      literalSecrets: [{
        secretId: "runtime-spine",
        secretValue: Redacted.make("server-run authority"),
        replacementToken: "[REDACTED:RUNTIME-SPINE]"
      }],
      curatedPatterns: ["openai-api-key"]
    })
  })
  const manifest = yield* Experimental.OpenAgentTrace.CorpusManifest.fromRecords({
    corpusId: "pi-mono-public-corpus",
    adapterId: "pi-mono",
    adapterVersion: "1",
    normalizationVersion: "1",
    projectionVersion: "workflow-v1",
    generatedAt: "2026-04-06T12:00:00.000Z",
    records: [record]
  })
  const signingKeys = yield* generateKeyPair("ed25519")
  const signedManifest = yield* Experimental.OpenAgentTrace.signCorpusManifest({
    manifest,
    algorithm: "ed25519",
    secretKey: signingKeys.secretKey,
    publicKey: signingKeys.publicKey
  })
  const manifestVerified = yield* Experimental.OpenAgentTrace.verifySignedCorpusManifest(signedManifest)

  yield* Effect.log("open-agent-trace-pi-mono", {
    recordId: record.recordId,
    workflowKind: workflowProjection.workflowRecord.workflowKind,
    coverageKinds: workflowProjection.coverageGaps.map((gap) => gap.sourceKind),
    artifactTag: artifact._tag,
    sealedBundleKind: sealedReviewBundle.bundleKind,
    signedManifestKind: signedManifest.manifestKind,
    manifestVerified
  })
})

BunRuntime.runMain(program)
