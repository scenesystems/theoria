/**
 * Prints the "Imagined Place" home-page demo move by move, using the same
 * server pipeline the page would call. Run from the repository root:
 *
 *   bun apps/theoria/scripts/imagined-place-walkthrough.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Numeric } from "@scenesystems/effect-math"
import {
  BigDecimal,
  Boolean as Bool,
  Console,
  Effect,
  Equal,
  Number as Num,
  Option,
  Schema,
  String as Str,
  Struct
} from "effect"
import * as Arr from "effect/Array"

import { type PlaceBuild, type PlaceRendering } from "../app/contracts/imagined-place-result.js"
import { PlaceBuildRequest, placeFeatures } from "../app/contracts/imagined-place.js"
import { ParticipantsLive } from "../app/server/imagined-place/authority.js"
import { render } from "../app/server/imagined-place/render.js"
import { buildPlace } from "../app/server/imagined-place/run.js"
import { scenarioById } from "../app/server/imagined-place/scenarios.js"

const scenario = scenarioById("unfinished-light")

const request = Schema.decodeSync(PlaceBuildRequest)({
  scenario: scenario.id,
  brief: scenario.brief,
  acceptNeighbor: true,
  acceptProgram: false
})

const wideStage = 660
const narrowStage = 320

const encodeNumber = Schema.encodeSync(Schema.NumberFromString)
const fixed = (value: number, digits = 3): string =>
  Option.match(Numeric.toBigDecimal(value), {
    onNone: () => encodeNumber(value),
    onSome: (decimal) => {
      const rounded = BigDecimal.round(decimal, { scale: digits, mode: "half-from-zero" })
      const sign = Bool.match(Bool.and(Num.lessThan(value, 0), BigDecimal.isZero(rounded)), {
        onTrue: () => "-",
        onFalse: () => ""
      })
      const components = Str.split(BigDecimal.format(rounded), ".")
      const whole = Option.getOrElse(Arr.head(components), () => Str.empty)
      const fraction = Option.getOrElse(Arr.get(components, 1), () => Str.empty)
      return Bool.match(Equal.equals(digits, 0), {
        onFalse: () => `${sign}${whole}.${Str.padEnd(digits, "0")(fraction)}`,
        onTrue: () => Str.concat(sign, whole)
      })
    }
  })
const short = (id: string) =>
  Option.match(Arr.last(Str.split(id, ":")), {
    onNone: () => id,
    onSome: (hash) => `${Str.slice(0, 10)(hash)}…`
  })
const px = (value: number) => `${encodeNumber(Num.round(value, 0))}px`

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
            Bool.match(record.accepted, { onFalse: () => "declined", onTrue: () => "accepted" })
          }  id ${short(record.contentId)}  ${record.signature.algorithm} ${
            Bool.match(record.signature.valid, { onFalse: () => "INVALID", onTrue: () => "valid for session key" })
          } ${record.signature.keyFingerprint}`
        )
    )
    yield* Console.log(
      `   sealed note ${evidence.sealedNote.from} → ${evidence.sealedNote.to}: ${evidence.sealedNote.agreement} + ${evidence.sealedNote.kdf} → ${evidence.sealedNote.algorithm}, ${
        encodeNumber(evidence.sealedNote.envelopeBytes)
      } byte envelope`
    )
    yield* Console.log(`               opened by author: "${evidence.sealedNote.openedText}"`)
    yield* Console.log("")

    yield* Console.log("3. RECORD  (digest · sign)")
    yield* Effect.forEach(
      evidence.lineage,
      (version) =>
        Console.log(
          `   version ${encodeNumber(version.version)}   ${short(version.contentId)}  ${
            encodeNumber(version.featureCount)
          } features${
            Option.match(Option.fromNullable(version.parent), {
              onNone: () => "  (origin)",
              onSome: (parent) => `  parent ${short(parent)}`
            })
          }`
        )
    )
    yield* Effect.forEach(
      Arr.filter(evidence.signatures, (signature) => Equal.equals(signature.signer, "author")),
      (signature) =>
        Console.log(
          `   signature   ${Str.padEnd(9)(signature.signer)} over ${short(signature.subject)}  ${
            Bool.match(signature.valid, { onFalse: () => "INVALID", onTrue: () => "valid for session key" })
          } ${signature.keyFingerprint}`
        )
    )
    yield* Console.log("")

    yield* Console.log("4. ARRANGE  (effect-search · effect-text · effect-math)")
    yield* Console.log(
      `   search      ${render.sampler} seed ${encodeNumber(render.seed)}, ${
        encodeNumber(render.trials)
      } trials, best loss ${fixed(render.bestLoss)}, min separation ${fixed(render.minimumSeparation)}`
    )
    yield* Console.log(
      `   stage       ${px(projection.stageWidth)} × ${px(projection.stageHeight)}; ${
        encodeNumber(render.lineCount)
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
    yield* Console.log(`   built in    ${encodeNumber(result.durationMs)} ms`)
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
    `   stage ${encodeNumber(wideStage)} → ${encodeNumber(narrowStage)}: ${
      encodeNumber(Arr.length(wide.projection.lines))
    } → ${
      encodeNumber(Arr.length(narrow.projection.lines))
    } lines; the content ID is a function of the artifact alone, so it is unchanged`
  )
  const none = yield* buildPlace(Struct.evolve(request, { acceptNeighbor: () => false }))
  yield* Console.log(
    `   decline both: ${encodeNumber(Arr.length(placeFeatures(none.artifact)))} features; lineage has ${
      encodeNumber(Arr.length(none.evidence.lineage))
    } version(s); declined proposals still listed: ${encodeNumber(Arr.length(none.proposals))}`
  )
  const both = yield* buildPlace(Struct.evolve(request, { acceptProgram: () => true }))
  yield* Console.log(
    `   accept both:  ${encodeNumber(Arr.length(placeFeatures(both.artifact)))} features; version 2 id ${
      short(Option.getOrElse(versionTwo(both), () => "?"))
    } differs from neighbor-only ${short(Option.getOrElse(versionTwo(result), () => "?"))}`
  )
}).pipe(Effect.provide(ParticipantsLive))

BunRuntime.runMain(program)
