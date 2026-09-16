/**
 * Prints the "Imagined Place" home-page demo move by move, using the same
 * server pipeline the page would call. Run from the repository root:
 *
 *   bun apps/theoria/scripts/imagined-place-walkthrough.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Cipher } from "@scenesystems/seal"
import { Boolean as Bool, Console, Effect, Number as Num, Option, Schema, String as Str } from "effect"
import * as Arr from "effect/Array"

import { type PlaceBuild, type PlaceRendering } from "../app/contracts/imagined-place-result.js"
import { PlaceBuildRequest, placeFeatures } from "../app/contracts/imagined-place.js"
import { ParticipantsLive } from "../app/server/imagined-place/authority.js"
import { render } from "../app/server/imagined-place/render.js"
import { buildPlace } from "../app/server/imagined-place/run.js"
import { scenarioById } from "../app/server/imagined-place/scenarios.js"

const scenario = scenarioById("unfinished-light")

const request = PlaceBuildRequest.make({
  scenario: scenario.id,
  brief: scenario.brief,
  acceptNeighbor: true,
  acceptProgram: false
})

const wideStage = 660
const narrowStage = 320

const numberText = Schema.encodeSync(Schema.NumberFromString)
const fixed = (value: number, digits = 3) => numberText(Num.round(value, digits))
const short = (id: string) => `${Str.slice(0, 10)(Arr.lastNonEmpty(Str.split(id, ":")))}…`
const px = (value: number) => `${numberText(Num.round(value, 0))}px`

const printPlace = (result: PlaceBuild, rendered: PlaceRendering) =>
  Effect.gen(function*() {
    const { artifact, evidence, proposals } = result
    const { evidence: render, projection } = rendered

    yield* Console.log("1. COMPOSE  (effect-dsp · effect-inference)")
    yield* Console.log(`   brief       ${artifact.brief}`)
    yield* Effect.forEach(
      evidence.inference,
      (run) =>
        Console.log(
          `   program     ${Str.padEnd(24)(run.program)} ${run.mode} · ${run.responseModel} · ${run.serveMode}`
        )
    )
    yield* Console.log(`   title       ${artifact.composition.title}`)
    yield* Effect.forEach(
      artifact.composition.features,
      (feature) => Console.log(`   feature     ${Str.padEnd(18)(feature.name)} weight ${fixed(feature.weight, 2)}`)
    )
    yield* Console.log("")

    yield* Console.log("2. PROPOSE  (sign · seal)")
    yield* Effect.forEach(
      proposals,
      (record) =>
        Console.log(
          `   proposal    ${Str.padEnd(9)(record.proposal.proposer)} "${record.proposal.feature.name}"  ${
            Bool.match(record.accepted, { onTrue: () => "accepted", onFalse: () => "declined" })
          }  id ${short(record.contentId)}  ${record.signature.algorithm} ${
            Bool.match(record.signature.valid, {
              onTrue: () => "valid for session key",
              onFalse: () => "INVALID"
            })
          } ${record.signature.keyFingerprint}`
        )
    )
    yield* Console.log(
      `   sealed note ${evidence.sealedNote.from} → ${evidence.sealedNote.to}: ${evidence.sealedNote.agreement} + ${evidence.sealedNote.kdf} → ${evidence.sealedNote.algorithm}, ${
        numberText(evidence.sealedNote.envelopeBytes)
      } byte envelope`
    )
    yield* Console.log(`               opened by author: "${evidence.sealedNote.openedText}"`)
    yield* Console.log("")

    yield* Console.log("3. RECORD  (digest · sign)")
    yield* Effect.forEach(
      evidence.lineage,
      (version) =>
        Console.log(
          `   version ${numberText(version.version)}   ${short(version.contentId)}  ${
            numberText(version.featureCount)
          } features${
            Option.match(Option.fromNullable(version.parent), {
              onNone: () => "  (origin)",
              onSome: (parent) => `  parent ${short(parent)}`
            })
          }`
        )
    )
    yield* Effect.forEach(
      Arr.filter(evidence.signatures, (signature) => Str.Equivalence(signature.signer, "author")),
      (signature) =>
        Console.log(
          `   signature   ${Str.padEnd(9)(signature.signer)} over ${short(signature.subject)}  ${
            Bool.match(signature.valid, {
              onTrue: () => "valid for session key",
              onFalse: () => "INVALID"
            })
          } ${signature.keyFingerprint}`
        )
    )
    yield* Console.log("")

    yield* Console.log("4. ARRANGE  (effect-search · effect-text · effect-math)")
    yield* Console.log(
      `   search      ${render.sampler} seed ${numberText(render.seed)}, ${
        numberText(render.trials)
      } trials, best loss ${fixed(render.bestLoss)}, min separation ${fixed(render.minimumSeparation)}`
    )
    yield* Console.log(
      `   stage       ${px(projection.stageWidth)} × ${px(projection.stageHeight)}; ${
        numberText(render.lineCount)
      } lines, narrowest ${fixed(render.narrowestLine, 2)} of column, raggedness ${fixed(render.raggedness, 2)}`
    )
    yield* Effect.forEach(
      projection.markers,
      (marker) =>
        Console.log(
          `   marker      ${Str.padEnd(24)(marker.name)} (${Str.padStart(5)(px(marker.x))}, ${
            Str.padStart(5)(px(marker.y))
          }) r ${px(marker.radius)}${
            Option.match(Option.fromNullable(marker.contributedBy), {
              onNone: () => "",
              onSome: (by) => `  from ${by}`
            })
          }`
        )
    )
    yield* Effect.forEach(
      projection.lines,
      (line) => Console.log(`   ${Str.padStart(6)(px(line.maxWidth))} | ${line.text}`)
    )
    yield* Console.log(`   built in    ${numberText(result.durationMs)} ms`)
  })

const program = Effect.gen(function*() {
  yield* Console.log(`Imagined Place — ${scenario.label}\n`)
  const result = yield* buildPlace(request)
  const wide = yield* render(result.artifact, wideStage)
  yield* printPlace(result, wide)

  yield* Console.log("\nWHAT CHANGES WHAT")
  const narrow = yield* render(result.artifact, narrowStage)
  const versionTwo = (r: PlaceBuild) => Arr.lastNonEmpty(r.evidence.lineage).contentId
  yield* Console.log(
    `   stage ${numberText(wideStage)} → ${numberText(narrowStage)}: ${
      numberText(Arr.length(wide.projection.lines))
    } → ${
      numberText(Arr.length(narrow.projection.lines))
    } lines; the content ID is a function of the artifact alone, so it is unchanged`
  )
  const none = yield* buildPlace(PlaceBuildRequest.make({ ...request, acceptNeighbor: false }))
  yield* Console.log(
    `   decline both: ${numberText(Arr.length(placeFeatures(none.artifact)))} features; lineage has ${
      numberText(Arr.length(none.evidence.lineage))
    } version(s); declined proposals still listed: ${numberText(Arr.length(none.proposals))}`
  )
  const both = yield* buildPlace(PlaceBuildRequest.make({ ...request, acceptProgram: true }))
  yield* Console.log(
    `   accept both:  ${numberText(Arr.length(placeFeatures(both.artifact)))} features; version 2 id ${
      short(versionTwo(both))
    } differs from neighbor-only ${short(versionTwo(result))}`
  )
}).pipe(Effect.provide([ParticipantsLive, Cipher.layer]))

BunRuntime.runMain(program)
