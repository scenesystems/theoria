/**
 * Prints the "Imagined Place" home-page demo move by move, using the same
 * server pipeline the page would call. Run from the repository root:
 *
 *   bun apps/theoria/scripts/imagined-place-walkthrough.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Console, Effect, Option } from "effect"
import * as Arr from "effect/Array"

import { type PlaceBuild, type PlaceRendering } from "../app/contracts/imagined-place-result.js"
import { type PlaceBuildRequest, placeFeatures } from "../app/contracts/imagined-place.js"
import { ParticipantsLive } from "../app/server/imagined-place/authority.js"
import { render } from "../app/server/imagined-place/render.js"
import { buildPlace } from "../app/server/imagined-place/run.js"
import { scenarioById } from "../app/server/imagined-place/scenarios.js"

const scenario = scenarioById("unfinished-light")

const request: PlaceBuildRequest = {
  scenario: scenario.id,
  brief: scenario.brief,
  acceptNeighbor: true,
  acceptProgram: false
}

const wideStage = 660
const narrowStage = 320

const fixed = (value: number, digits = 3) => value.toFixed(digits)
const short = (id: string) =>
  Option.match(Arr.last(id.split(":")), {
    onNone: () => id,
    onSome: (hash) => `${hash.slice(0, 10)}…`
  })
const px = (value: number) => `${String(Math.round(value))}px`

const printPlace = (result: PlaceBuild, rendered: PlaceRendering) =>
  Effect.gen(function*() {
    const { artifact, evidence, proposals } = result
    const { evidence: render, projection } = rendered

    yield* Console.log("1. COMPOSE  (effect-dsp · effect-inference)")
    yield* Console.log(`   brief       ${artifact.brief}`)
    yield* Effect.forEach(
      evidence.inference,
      (run) =>
        Console.log(`   program     ${run.program.padEnd(24)} ${run.mode} · ${run.responseModel} · ${run.serveMode}`)
    )
    yield* Console.log(`   title       ${artifact.composition.title}`)
    yield* Effect.forEach(
      artifact.composition.features,
      (feature) => Console.log(`   feature     ${feature.name.padEnd(18)} weight ${fixed(feature.weight, 2)}`)
    )
    yield* Console.log("")

    yield* Console.log("2. PROPOSE  (sign · seal)")
    yield* Effect.forEach(
      proposals,
      (record) =>
        Console.log(
          `   proposal    ${record.proposal.proposer.padEnd(9)} "${record.proposal.feature.name}"  ${
            record.accepted ? "accepted" : "declined"
          }  id ${short(record.contentId)}  ${record.signature.algorithm} ${
            record.signature.valid ? "valid for session key" : "INVALID"
          } ${record.signature.keyFingerprint}`
        )
    )
    yield* Console.log(
      `   sealed note ${evidence.sealedNote.from} → ${evidence.sealedNote.to}: ${evidence.sealedNote.agreement} + ${evidence.sealedNote.kdf} → ${evidence.sealedNote.algorithm}, ${
        String(evidence.sealedNote.envelopeBytes)
      } byte envelope`
    )
    yield* Console.log(`               opened by author: "${evidence.sealedNote.openedText}"`)
    yield* Console.log("")

    yield* Console.log("3. RECORD  (digest · sign)")
    yield* Effect.forEach(
      evidence.lineage,
      (version) =>
        Console.log(
          `   version ${String(version.version)}   ${short(version.contentId)}  ${
            String(version.featureCount)
          } features${
            Option.match(Option.fromNullable(version.parent), {
              onNone: () => "  (origin)",
              onSome: (parent) => `  parent ${short(parent)}`
            })
          }`
        )
    )
    yield* Effect.forEach(
      Arr.filter(evidence.signatures, (signature) => signature.signer === "author"),
      (signature) =>
        Console.log(
          `   signature   ${signature.signer.padEnd(9)} over ${short(signature.subject)}  ${
            signature.valid ? "valid for session key" : "INVALID"
          } ${signature.keyFingerprint}`
        )
    )
    yield* Console.log("")

    yield* Console.log("4. ARRANGE  (effect-search · effect-text · effect-math)")
    yield* Console.log(
      `   search      ${render.sampler} seed ${String(render.seed)}, ${String(render.trials)} trials, best loss ${
        fixed(render.bestLoss)
      }, min separation ${fixed(render.minimumSeparation)}`
    )
    yield* Console.log(
      `   stage       ${px(projection.stageWidth)} × ${px(projection.stageHeight)}; ${
        String(render.lineCount)
      } lines, narrowest ${fixed(render.narrowestLine, 2)} of column, raggedness ${fixed(render.raggedness, 2)}`
    )
    yield* Effect.forEach(
      projection.markers,
      (marker) =>
        Console.log(
          `   marker      ${marker.name.padEnd(24)} (${px(marker.x).padStart(5)}, ${px(marker.y).padStart(5)}) r ${
            px(marker.radius)
          }${
            Option.match(Option.fromNullable(marker.contributedBy), {
              onNone: () => "",
              onSome: (by) => `  from ${by}`
            })
          }`
        )
    )
    yield* Effect.forEach(
      projection.lines,
      (line) => Console.log(`   ${px(line.maxWidth).padStart(6)} | ${line.text}`)
    )
    yield* Console.log(`   built in    ${String(result.durationMs)} ms`)
  })

const program = Effect.gen(function*() {
  yield* Console.log(`Imagined Place — ${scenario.label}\n`)
  const result = yield* buildPlace(request)
  const wide = yield* render(result.artifact, wideStage)
  yield* printPlace(result, wide)

  yield* Console.log("\nWHAT CHANGES WHAT")
  const narrow = yield* render(result.artifact, narrowStage)
  const versionTwo = (r: PlaceBuild) => Arr.last(r.evidence.lineage).pipe(Option.map((v) => v.contentId))
  yield* Console.log(
    `   stage ${String(wideStage)} → ${String(narrowStage)}: ${String(wide.projection.lines.length)} → ${
      String(narrow.projection.lines.length)
    } lines; the content ID is a function of the artifact alone, so it is unchanged`
  )
  const none = yield* buildPlace({ ...request, acceptNeighbor: false })
  yield* Console.log(
    `   decline both: ${String(placeFeatures(none.artifact).length)} features; lineage has ${
      String(none.evidence.lineage.length)
    } version(s); declined proposals still listed: ${String(none.proposals.length)}`
  )
  const both = yield* buildPlace({ ...request, acceptProgram: true })
  yield* Console.log(
    `   accept both:  ${String(placeFeatures(both.artifact).length)} features; version 2 id ${
      short(Option.getOrElse(versionTwo(both), () => "?"))
    } differs from neighbor-only ${short(Option.getOrElse(versionTwo(result), () => "?"))}`
  )
}).pipe(Effect.provide(ParticipantsLive))

BunRuntime.runMain(program)
