import { BunContext, BunRuntime } from "@effect/platform-bun"
import { FileSystem } from "@effect/platform"
import { Array as Arr, Effect, Schema } from "effect"
import { exampleDiagnostics } from "./api-reference/review-examples.js"
import { buildInventory } from "./api-reference/review-inventory.js"
import { ReviewError, ReviewRecord, ReviewRecordJson } from "./api-reference/review-model.js"

const key = (value: { readonly package: string; readonly module: string }): string => `${value.package}\u0000${value.module}`
const duplicateKey = (value: { readonly owners: ReadonlyArray<string>; readonly summary: string }): string =>
  `${value.owners.join("\u0000")}\u0001${value.summary}`

const program = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const { inventory, duplicates, examples, importPaths } = yield* buildInventory
  const examplesDiagnostics = exampleDiagnostics(process.cwd(), examples, importPaths)
  const accept = process.argv.includes("--accept")
  const currentRecord = yield* fs.readFileString("scripts/api-reference/review-record.json").pipe(
    Effect.flatMap(Schema.decodeUnknown(ReviewRecordJson)))
  if (accept) {
    const acceptanceDiagnostics = [...inventory.diagnostics, ...examplesDiagnostics]
    if (acceptanceDiagnostics.length > 0) return yield* new ReviewError({ diagnostics: acceptanceDiagnostics })
    const record = yield* Schema.decodeUnknown(ReviewRecord)({
      format: "theoria-api-review-record-v1",
      units: Arr.map(inventory.units, (_) => ({ package: _.package, module: _.module, semanticHash: _.semanticHash })),
      duplicateAllowlist: Arr.filter(currentRecord.duplicateAllowlist, (allowed) =>
        Arr.some(duplicates, (group) => duplicateKey(allowed) === duplicateKey(group)))
    })
    const encoded = yield* Schema.encode(ReviewRecordJson)(record)
    yield* fs.writeFileString("scripts/api-reference/review-record.json", `${encoded}\n`)
    yield* Effect.log(`accepted ${record.units.length} API module hashes; duplicate exceptions require explicit review`)
    return
  }
  const stale = Arr.filter(inventory.units, (unit) =>
    !Arr.some(currentRecord.units, (reviewed) => key(reviewed) === key(unit) && reviewed.semanticHash === unit.semanticHash))
  const removed = Arr.filter(currentRecord.units, (reviewed) =>
    !Arr.some(inventory.units, (unit) => key(reviewed) === key(unit)))
  const unreviewedDuplicates = Arr.filter(duplicates, (group) =>
    !Arr.some(currentRecord.duplicateAllowlist, (allowed) => duplicateKey(allowed) === duplicateKey(group)))
  const diagnostics = [...inventory.diagnostics, ...examplesDiagnostics,
    ...Arr.map(stale, (_) => `${_.package}/${_.module}: stale or missing semantic review hash`),
    ...Arr.map(removed, (_) => `${_.package}/${_.module}: reviewed module is absent`),
    ...Arr.map(unreviewedDuplicates, (_) => `unreviewed duplicate owners: ${_.owners.join(", ")}`)]
  if (diagnostics.length > 0) return yield* new ReviewError({ diagnostics })
  yield* Effect.log(
    `API docs reviewed: ${inventory.totals.packages} packages, ${inventory.totals.modules} modules, ` +
    `${inventory.totals.imports} canonical imports, ${inventory.totals.projections} route projections, ` +
    `${inventory.totals.examples} strict examples`
  )
}).pipe(Effect.catchTag("ReviewError", (error) => Effect.zipRight(
  Effect.forEach(error.diagnostics, Effect.logError), Effect.fail(error))))

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
