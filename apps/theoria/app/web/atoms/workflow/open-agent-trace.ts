import type { Atom as AtomType } from "@effect-atom/atom"
import { Atom, Result } from "@effect-atom/atom"
import { Effect, Option } from "effect"

import {
  OpenAgentTraceCatalog,
  type OpenAgentTraceError,
  OpenAgentTracePanelData,
  OpenAgentTraceRequestError
} from "../../../contracts/study/workflow/open-agent-trace.js"
import { OpenAgentTraceClient } from "../../services/OpenAgentTraceClient.js"

const openAgentTraceRuntime = Atom.runtime(OpenAgentTraceClient.Default)

const catalogFromRegistry = (registry: OpenAgentTraceCatalog["registry"]): OpenAgentTraceCatalog =>
  OpenAgentTraceCatalog.fromParts({
    consumerArtifacts: registry.map((entry) => entry.consumerArtifact),
    registry,
    workflowHookups: registry.map((entry) => entry.workflowHookup)
  })

const mergeCatalogs = (base: OpenAgentTraceCatalog, additive: OpenAgentTraceCatalog): OpenAgentTraceCatalog =>
  catalogFromRegistry([
    ...base.registry.filter((entry) => !additive.registry.some((candidate) => candidate.entryId === entry.entryId)),
    ...additive.registry
  ])

const fixtureCatalogAtom: AtomType.Atom<Result.Result<OpenAgentTraceCatalog, OpenAgentTraceError>> =
  openAgentTraceRuntime.atom(
    Effect.gen(function*() {
      const client = yield* OpenAgentTraceClient

      return yield* Effect.all(
        {
          consumerArtifacts: client.consumerArtifacts(),
          registry: client.registry(),
          workflowHookups: client.workflowHookups()
        },
        {
          concurrency: "unbounded"
        }
      ).pipe(Effect.map(OpenAgentTraceCatalog.fromParts))
    })
  )

export const importedCatalogAtom: AtomType.Writable<OpenAgentTraceCatalog> = Atom.make(
  OpenAgentTraceCatalog.empty()
).pipe(Atom.keepAlive)

export const ampThreadImportDraftAtom: AtomType.Writable<string> = Atom.make("").pipe(Atom.keepAlive)

export const importAmpThreadAtom = openAgentTraceRuntime.fn(
  Effect.fnUntraced(function*(_: void, ctx: AtomType.FnContext) {
    const draft = ctx.registry.get(ampThreadImportDraftAtom).trim()

    if (draft.length === 0) {
      return yield* Effect.fail(
        OpenAgentTraceRequestError.fromMessage("Paste an Amp thread id or URL before importing.")
      )
    }

    const client = yield* OpenAgentTraceClient
    const payload = yield* client.importAmpThread(draft)
    const importedCatalog = ctx.registry.get(importedCatalogAtom)

    ctx.registry.set(importedCatalogAtom, mergeCatalogs(importedCatalog, payload.catalog()))
    ctx.registry.set(ampThreadImportDraftAtom, "")

    return payload
  })
).pipe(Atom.keepAlive)

export const setAmpThreadImportDraftAtom = Atom.fnSync<string>()((draft, ctx) => {
  ctx.set(ampThreadImportDraftAtom, draft)
  ctx.set(importAmpThreadAtom, Atom.Reset)
})

const catalogAtom: AtomType.Atom<Result.Result<OpenAgentTraceCatalog, OpenAgentTraceError>> = Atom.make(
  (get: AtomType.Context) =>
    Result.match(get(fixtureCatalogAtom), {
      onInitial: (result) => Result.initial(result.waiting),
      onFailure: (result) => Result.failure(result.cause, { previousSuccess: result.previousSuccess }),
      onSuccess: (result) =>
        Result.success(mergeCatalogs(result.value, get(importedCatalogAtom)), {
          timestamp: result.timestamp,
          waiting: result.waiting
        })
    })
)

export const openAgentTracePanelAtom: AtomType.Atom<
  Result.Result<OpenAgentTracePanelData, OpenAgentTraceError>
> = Atom.make((get: AtomType.Context) =>
  Result.match(get(catalogAtom), {
    onInitial: (result) => Result.initial(result.waiting),
    onFailure: (result) =>
      Result.failure(result.cause, {
        previousSuccess: Option.map(result.previousSuccess, (success) =>
          Result.success(OpenAgentTracePanelData.fromCatalog(success.value), {
            timestamp: success.timestamp,
            waiting: success.waiting
          }))
      }),
    onSuccess: (result) =>
      Result.success(OpenAgentTracePanelData.fromCatalog(result.value), {
        timestamp: result.timestamp,
        waiting: result.waiting
      })
  })
)
