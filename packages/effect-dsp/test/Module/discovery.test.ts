/**
 * Module discovery contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it, vi } from "@effect/vitest"
import * as Contracts from "@scenesystems/effect-dsp/contracts"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Optimizer from "@scenesystems/effect-dsp/Optimizer"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import type { Option } from "effect"
import {
  Array as Arr,
  Data,
  Deferred,
  Effect,
  Either,
  Equal,
  Fiber,
  Iterable,
  Layer,
  Record,
  Ref,
  Schema,
  Tuple
} from "effect"

const QaInput = Schema.Struct({
  question: Signature.describe(Schema.String, "The question to answer")
})

const QaOutput = Schema.Struct({
  answer: Signature.describe(Schema.String, "A concise factual answer")
})

const makeQaSignature = () =>
  Signature.make(
    "Answer questions with concise facts",
    QaInput.fields,
    QaOutput.fields
  )

class RegistrationProjection extends Data.Class<{
  readonly id: string
  readonly subModuleIds: Module.ModuleRegistration["subModuleIds"]
}> {}

const registrationProjection = (
  registrations: Iterable<Module.ModuleRegistration>
) =>
  Arr.map(Arr.fromIterable(registrations), (registration) =>
    new RegistrationProjection({
      id: registration.id,
      subModuleIds: registration.subModuleIds
    }))

const registrationById = (
  registrations: Iterable<Module.ModuleRegistration>,
  moduleId: string
): Option.Option<Module.ModuleRegistration> =>
  Arr.findFirst(
    Arr.fromIterable(registrations),
    (registration) => Equal.equals(registration.id, moduleId)
  )

class DiscoveryScopeRejected extends Schema.TaggedError<DiscoveryScopeRejected>()(
  "DiscoveryScopeRejected",
  { message: Schema.String }
) {}

class DiscoveryScopeSnapshot extends Schema.Class<DiscoveryScopeSnapshot>("DiscoveryScopeSnapshot")({
  moduleIds: Schema.Array(Contracts.ModuleId)
}) {}

describe("Module discovery", () => {
  it.effect("defers registration traversal until execution and reports a missing root", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const observed = yield* Module.compose({
        name: "observed",
        signature,
        subModules: Record.empty(),
        forward: () => Effect.succeed(QaOutput.make({ answer: "Observed" }))
      })
      const absent = yield* Schema.decodeUnknown(Contracts.ModuleId)("absent")
      const id = yield* Schema.decodeUnknown(Contracts.ModuleId)(observed.name)
      const model = yield* MockLanguageModel.make(
        MockLanguageModel.fixed(QaOutput.make({ answer: "Observed" }))
      )
      const registrations = yield* Module.discoverModules(
        observed.forward(QaInput.make({ question: "Observe native registration" })).pipe(
          Effect.provideService(LanguageModel.LanguageModel, model.service)
        )
      )
      const observeRegistration = vi.fn((registration: Module.ModuleRegistration) => registration)
      const lazyRegistrations = Iterable.map(registrations, observeRegistration)
      const missing = Module.registrationsToModuleGraph(absent, lazyRegistrations)
      expect(observeRegistration).not.toHaveBeenCalled()
      const error = yield* Effect.flip(missing)
      expect(error.moduleName).toBe("absent")
      expect(observeRegistration).toHaveBeenCalledTimes(1)
      const graph = yield* Module.registrationsToModuleGraph(id, registrations)
      expect(Contracts.stableModuleGraphTraversal(graph)).toEqual(Arr.make("observed"))
    }))

  it.effect("collects both concurrent ensemble lineages and their live parameters", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const leafA = yield* Module.compose({
        name: "ensemble-leaf-a",
        signature,
        subModules: Record.empty(),
        forward: () => Effect.succeed(QaOutput.make({ answer: "A" }))
      })
      const memberA = yield* Module.compose({
        name: "ensemble-member-a",
        signature,
        subModules: Record.singleton("leaf", leafA),
        forward: ({ input }) => leafA.forward(input)
      })
      const leafB = yield* Module.compose({
        name: "ensemble-leaf-b",
        signature,
        subModules: Record.empty(),
        forward: () => Effect.succeed(QaOutput.make({ answer: "B" }))
      })
      const memberB = yield* Module.compose({
        name: "ensemble-member-b",
        signature,
        subModules: Record.singleton("leaf", leafB),
        forward: ({ input }) => leafB.forward(input)
      })
      const ensemble = yield* Optimizer.ensemble({
        name: "concurrent-ensemble",
        programs: Arr.make(memberA, memberB)
      })
      const rootId = yield* Schema.decodeUnknown(Contracts.ModuleId)(ensemble.name)
      const memberAId = yield* Schema.decodeUnknown(Contracts.ModuleId)(memberA.name)
      const memberBId = yield* Schema.decodeUnknown(Contracts.ModuleId)(memberB.name)
      const leafAId = yield* Schema.decodeUnknown(Contracts.ModuleId)(leafA.name)
      const leafBId = yield* Schema.decodeUnknown(Contracts.ModuleId)(leafB.name)
      const model = yield* MockLanguageModel.make(
        MockLanguageModel.fixed(QaOutput.make({ answer: "unused" }))
      )
      const operation = ensemble.forward(QaInput.make({ question: "Run both branches" })).pipe(
        Effect.provideService(LanguageModel.LanguageModel, model.service)
      )
      const graph = yield* Module.discoverModuleGraph(rootId, operation)
      const registrations = yield* Module.discoverModules(operation)
      const lineageA = yield* Contracts.moduleGraphLineage(graph, leafAId)
      const lineageB = yield* Contracts.moduleGraphLineage(graph, leafBId)
      const leafARegistration = yield* registrationById(registrations, leafAId)
      const leafBRegistration = yield* registrationById(registrations, leafBId)

      expect(lineageA.path).toEqual(Arr.make(rootId, memberAId, leafAId))
      expect(lineageB.path).toEqual(Arr.make(rootId, memberBId, leafBId))
      expect(leafARegistration.params).toBe(leafA.params)
      expect(leafBRegistration.params).toBe(leafB.params)

      yield* Ref.update(leafA.params, (params) => Contracts.withModuleParamsInstructions(params, "Updated A"))
      yield* Ref.update(leafB.params, (params) => Contracts.withModuleParamsInstructions(params, "Updated B"))

      expect((yield* Ref.get(leafARegistration.params)).instructions).toBe("Updated A")
      expect((yield* Ref.get(leafBRegistration.params)).instructions).toBe("Updated B")
    }))

  it.effect("atomically rejects one concurrent conflicting registration and retains the winner", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const winner = yield* Module.compose({
        name: "shared-registration-id",
        signature,
        subModules: Record.empty(),
        forward: () => Effect.succeed(QaOutput.make({ answer: "winner" }))
      })
      const conflicting = yield* Module.compose({
        name: "shared-registration-id",
        signature,
        subModules: Record.empty(),
        forward: () => Effect.succeed(QaOutput.make({ answer: "conflict" }))
      })
      const winnerRegistered = yield* Deferred.make<void>()
      const result = yield* Module.withDiscoveryScope(
        Effect.gen(function*() {
          const outcomes = yield* Effect.all(
            Arr.make(
              Module.registerModule(winner).pipe(
                Effect.tap(() => Deferred.succeed(winnerRegistered, undefined)),
                Effect.either
              ),
              Deferred.await(winnerRegistered).pipe(
                Effect.zipRight(Module.registerModule(conflicting)),
                Effect.either
              )
            ),
            { concurrency: "unbounded" }
          )
          const registrations = yield* Module.registrySnapshot

          return Data.tuple(outcomes, registrations)
        })
      )
      const outcomes = Tuple.getFirst(result)
      const registrations = Tuple.getSecond(result)
      const failures = Arr.filter(outcomes, Either.isLeft)
      const failure = yield* Arr.head(failures)
      const registration = yield* Arr.head(registrations)

      expect(failures).toHaveLength(1)
      expect(failure.left._tag).toBe("CompositionError")
      expect(registrations).toHaveLength(1)
      expect(registration.params).toBe(winner.params)
    }))

  it.effect("lazily shares an outside registry with children forked after initialization", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const parentRegistration = yield* Module.compose({
        name: "lazy-parent-registration",
        signature,
        subModules: Record.empty(),
        forward: () => Effect.succeed(QaOutput.make({ answer: "parent" }))
      })
      const childRegistration = yield* Module.compose({
        name: "lazy-child-registration",
        signature,
        subModules: Record.empty(),
        forward: () => Effect.succeed(QaOutput.make({ answer: "child" }))
      })

      yield* Module.registerModule(parentRegistration)
      const childFiber = yield* Module.registerModule(childRegistration).pipe(Effect.fork)
      yield* Fiber.join(childFiber)
      const registrations = yield* Module.registrySnapshot

      expect(Arr.map(registrations, (registration) => registration.id)).toEqual(
        Arr.make("lazy-child-registration", "lazy-parent-registration")
      )
    }))

  it.effect("isolates nested scopes and restores the outer collector after failure and interruption", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const outer = yield* Module.compose({
        name: "scope-outer",
        signature,
        subModules: Record.empty(),
        forward: () => Effect.succeed(QaOutput.make({ answer: "outer" }))
      })
      const nested = yield* Module.compose({
        name: "scope-nested",
        signature,
        subModules: Record.empty(),
        forward: () => Effect.succeed(QaOutput.make({ answer: "nested" }))
      })
      const interruptedRestoration = yield* Deferred.make<DiscoveryScopeSnapshot>()
      const nestedStarted = yield* Deferred.make<void>()

      yield* Module.registerModule(outer)
      const nestedRegistrations = yield* Module.discoverModules(Module.registerModule(nested))
      const afterNested = yield* Module.registrySnapshot
      const afterFailure = yield* Module.withDiscoveryScope(
        Module.registerModule(nested).pipe(
          Effect.zipRight(Effect.fail(new DiscoveryScopeRejected({ message: "expected" })))
        )
      ).pipe(
        Effect.catchTag("DiscoveryScopeRejected", () => Module.registrySnapshot)
      )
      const interrupted = yield* Module.withDiscoveryScope(
        Module.registerModule(nested).pipe(
          Effect.zipRight(Deferred.succeed(nestedStarted, undefined)),
          Effect.zipRight(Effect.never)
        )
      ).pipe(
        Effect.onInterrupt(() =>
          Module.registrySnapshot.pipe(
            Effect.map((registrations) =>
              new DiscoveryScopeSnapshot({
                moduleIds: Arr.map(registrations, (registration) => registration.id)
              })
            ),
            Effect.flatMap((snapshot) => Deferred.succeed(interruptedRestoration, snapshot)),
            Effect.asVoid
          )
        ),
        Effect.fork
      )
      yield* Deferred.await(nestedStarted)
      yield* Fiber.interrupt(interrupted)
      const afterInterruption = yield* Deferred.await(interruptedRestoration)

      expect(Arr.map(nestedRegistrations, (registration) => registration.id)).toEqual(
        Arr.make("scope-nested")
      )
      expect(Arr.map(afterNested, (registration) => registration.id)).toEqual(
        Arr.make("scope-outer")
      )
      expect(Arr.map(afterFailure, (registration) => registration.id)).toEqual(
        Arr.make("scope-outer")
      )
      expect(afterInterruption.moduleIds).toEqual(
        Arr.make("scope-outer")
      )
    }))

  it.effect("dedupes composed-of-composed modules by id deterministically", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const qa = yield* Module.predict("qa", signature)
      const pipeline = yield* Module.compose(
        new Module.ComposeOptions({
          name: "qa-pipeline",
          signature,
          subModules: Record.singleton("qa", qa),
          forward: ({ input }) => qa.forward(input)
        })
      )
      const root = yield* Module.compose(
        new Module.ComposeOptions({
          name: "qa-root",
          signature,
          subModules: Record.set(Record.singleton("pipeline", pipeline), "qa", qa),
          forward: ({ input }) =>
            Effect.gen(function*() {
              const nested = yield* pipeline.forward(input)

              yield* qa.forward(input)

              return nested
            })
        })
      )
      const qaId = yield* Schema.decodeUnknown(Contracts.ModuleId)(qa.name)
      const pipelineId = yield* Schema.decodeUnknown(Contracts.ModuleId)(pipeline.name)
      const rootId = yield* Schema.decodeUnknown(Contracts.ModuleId)(root.name)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed(QaOutput.make({ answer: "Paris" }))
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
      const program = root.forward(
        QaInput.make({ question: "What is the capital of France?" })
      ).pipe(Effect.provide(lmLayer))
      const first = yield* Module.discoverModules(program)
      const second = yield* Module.discoverModules(program)

      expect(registrationProjection(first)).toEqual(registrationProjection(second))
      expect(Arr.map(first, (registration) => registration.id)).toEqual(Arr.make(
        qaId,
        pipelineId,
        rootId
      ))

      const qaRegistration = yield* registrationById(first, qaId)
      const pipelineRegistration = yield* registrationById(first, pipelineId)
      const rootRegistration = yield* registrationById(first, rootId)

      expect(qaRegistration.subModuleIds).toEqual(Arr.empty())
      expect(pipelineRegistration.subModuleIds).toEqual(Arr.make(qaId))
      expect(rootRegistration.subModuleIds).toEqual(Arr.make(qaId, pipelineId))
    }))
})
