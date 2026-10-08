/**
 * Module discovery contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import * as Ensemble from "@scenesystems/effect-dsp/Ensemble"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as ModuleGraph from "@scenesystems/effect-dsp/ModuleGraph"
import { withInstructions } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Data, Deferred, Effect, Equal, Fiber, Layer, Option, Record, Ref, Result, Schema } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"

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
  readonly subModuleIds: Module.Discovered["subModuleIds"]
}> {}

const registrationProjection = (
  registrations: Iterable<Module.Discovered>
) =>
  Arr.map(Arr.fromIterable(registrations), (registration) =>
    new RegistrationProjection({
      id: registration.id,
      subModuleIds: registration.subModuleIds
    }))

const registrationById = (
  registrations: Iterable<Module.Discovered>,
  moduleId: string
): Option.Option<Module.Discovered> =>
  Arr.findFirst(
    Arr.fromIterable(registrations),
    (registration) => Equal.equals(registration.id, moduleId)
  )

class DiscoveryScopeRejected extends Schema.TaggedError<DiscoveryScopeRejected>()(
  "DiscoveryScopeRejected",
  { message: Schema.String }
) {}

describe("Module discovery", () => {
  it.effect("reports a missing root and projects an observed root", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const observed = yield* Module.compose(
        new Module.ComposeOptions({
          name: "observed",
          signature,
          subModules: Record.empty(),
          forward: () => Effect.succeed(QaOutput.make({ answer: "Observed" }))
        })
      )
      const absent = yield* Schema.decodeEffect(Module.Id)("absent")
      const id = yield* Schema.decodeEffect(Module.Id)(observed.name)
      const model = yield* MockLanguageModel.make(
        MockLanguageModel.succeed(QaOutput.make({ answer: "Observed" }))
      )
      const operation = observed.forward(QaInput.make({ question: "Observe native registration" })).pipe(
        Effect.provideService(LanguageModel.LanguageModel, model.service)
      )
      const error = yield* Module.discoverModuleGraph(absent, operation).pipe(Effect.flip)
      expect(error._tag).toBe("CompositionError")
      const graph = yield* Module.discoverModuleGraph(id, operation)
      expect(ModuleGraph.traversal(graph)).toEqual(Arr.make("observed"))
    }))

  it.effect("collects both concurrent ensemble lineages and their parameters", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const leafA = yield* Module.compose(
        new Module.ComposeOptions({
          name: "ensemble-leaf-a",
          signature,
          subModules: Record.empty(),
          forward: () => Effect.succeed(QaOutput.make({ answer: "A" }))
        })
      )
      const memberA = yield* Module.compose(
        new Module.ComposeOptions({
          name: "ensemble-member-a",
          signature,
          subModules: Record.singleton("leaf", leafA),
          forward: ({ input }) => leafA.forward(input)
        })
      )
      const leafB = yield* Module.compose(
        new Module.ComposeOptions({
          name: "ensemble-leaf-b",
          signature,
          subModules: Record.empty(),
          forward: () => Effect.succeed(QaOutput.make({ answer: "B" }))
        })
      )
      const memberB = yield* Module.compose(
        new Module.ComposeOptions({
          name: "ensemble-member-b",
          signature,
          subModules: Record.singleton("leaf", leafB),
          forward: ({ input }) => leafB.forward(input)
        })
      )
      const ensemble = yield* Ensemble.make(
        new Ensemble.Options({
          name: "concurrent-ensemble",
          programs: Arr.make(memberA, memberB)
        })
      )
      const rootId = yield* Schema.decodeEffect(Module.Id)(ensemble.name)
      const memberAId = yield* Schema.decodeEffect(Module.Id)(memberA.name)
      const memberBId = yield* Schema.decodeEffect(Module.Id)(memberB.name)
      const leafAId = yield* Schema.decodeEffect(Module.Id)(leafA.name)
      const leafBId = yield* Schema.decodeEffect(Module.Id)(leafB.name)
      const model = yield* MockLanguageModel.make(
        MockLanguageModel.succeed(QaOutput.make({ answer: "unused" }))
      )
      const operation = ensemble.forward(QaInput.make({ question: "Run both branches" })).pipe(
        Effect.provideService(LanguageModel.LanguageModel, model.service)
      )
      const graph = yield* Module.discoverModuleGraph(rootId, operation)
      const registrations = yield* Module.discoverModules(operation)
      const lineageA = Option.getOrThrow(ModuleGraph.lineage(graph, leafAId))
      const lineageB = Option.getOrThrow(ModuleGraph.lineage(graph, leafBId))
      const leafARegistration = Option.getOrThrow(registrationById(registrations, leafAId))
      const leafBRegistration = Option.getOrThrow(registrationById(registrations, leafBId))

      expect(lineageA.path).toEqual(Arr.make(rootId, memberAId, leafAId))
      expect(lineageB.path).toEqual(Arr.make(rootId, memberBId, leafBId))
      expect(leafARegistration.parameters).toBe(leafA.parameters)
      expect(leafBRegistration.parameters).toBe(leafB.parameters)

      yield* Ref.update(leafA.parameters, (parameters) => withInstructions(parameters, "Updated A"))
      yield* Ref.update(leafB.parameters, (parameters) => withInstructions(parameters, "Updated B"))

      expect((yield* Ref.get(leafARegistration.parameters)).instructions).toBe("Updated A")
      expect((yield* Ref.get(leafBRegistration.parameters)).instructions).toBe("Updated B")
    }))

  it.effect("atomically rejects one concurrent conflicting registration and retains the winner", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const winner = yield* Module.compose(
        new Module.ComposeOptions({
          name: "shared-registration-id",
          signature,
          subModules: Record.empty(),
          forward: () => Effect.succeed(QaOutput.make({ answer: "winner" }))
        })
      )
      const conflicting = yield* Module.compose(
        new Module.ComposeOptions({
          name: "shared-registration-id",
          signature,
          subModules: Record.empty(),
          forward: () => Effect.succeed(QaOutput.make({ answer: "conflict" }))
        })
      )
      const winnerRegistered = yield* Deferred.make<void>()
      const model = yield* MockLanguageModel.make(
        MockLanguageModel.succeed(QaOutput.make({ answer: "unused" }))
      )
      const registrations = yield* Module.discoverModules(
        Effect.gen(function*() {
          const outcomes = yield* Effect.all(
            Arr.make(
              winner.forward(QaInput.make({ question: "winner" })).pipe(
                Effect.tap(() => Deferred.succeed(winnerRegistered, undefined)),
                Effect.result
              ),
              Deferred.await(winnerRegistered).pipe(
                Effect.andThen(conflicting.forward(QaInput.make({ question: "conflict" }))),
                Effect.result
              )
            ),
            { concurrency: "unbounded" }
          )
          const failures = Arr.filter(outcomes, Result.isFailure)
          const failure = Option.getOrThrow(Arr.head(failures))

          expect(failures).toHaveLength(1)
          expect(failure.failure._tag).toBe("CompositionError")
        }).pipe(Effect.provideService(LanguageModel.LanguageModel, model.service))
      )
      const registration = Option.getOrThrow(Arr.head(registrations))

      expect(registrations).toHaveLength(1)
      expect(registration.parameters).toBe(winner.parameters)
    }))

  it.effect("isolates nested scopes and restores the outer collector after failure and interruption", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const makeModule = (name: string) =>
        Module.compose(
          new Module.ComposeOptions({
            name,
            signature,
            subModules: Record.empty(),
            forward: () => Effect.succeed(QaOutput.make({ answer: name }))
          })
        )
      const outer = yield* makeModule("scope-outer")
      const nested = yield* makeModule("scope-nested")
      const afterFailure = yield* makeModule("scope-after-failure")
      const afterInterruption = yield* makeModule("scope-after-interruption")
      const nestedStarted = yield* Deferred.make<void>()
      const model = yield* MockLanguageModel.make(
        MockLanguageModel.succeed(QaOutput.make({ answer: "unused" }))
      )
      const registrations = yield* Module.discoverModules(
        Effect.gen(function*() {
          yield* outer.forward(QaInput.make({ question: "outer" }))
          const nestedRegistrations = yield* Module.discoverModules(
            nested.forward(QaInput.make({ question: "nested" }))
          )
          expect(Arr.map(nestedRegistrations, (registration) => registration.id)).toEqual(
            Arr.make("scope-nested")
          )

          const rejected = new DiscoveryScopeRejected({ message: "expected" })
          const failed = yield* Module.discoverModules(
            nested.forward(QaInput.make({ question: "fail" })).pipe(
              Effect.andThen(Effect.fail(rejected))
            )
          ).pipe(Effect.result)
          expect(failed).toEqual(Result.fail(rejected))
          yield* afterFailure.forward(QaInput.make({ question: "after failure" }))

          const interrupted = yield* Module.discoverModules(
            nested.forward(QaInput.make({ question: "interrupt" })).pipe(
              Effect.andThen(Deferred.succeed(nestedStarted, undefined)),
              Effect.andThen(Effect.never)
            )
          ).pipe(
            Effect.ensuring(
              afterInterruption.forward(QaInput.make({ question: "after interruption" })).pipe(
                Effect.exit,
                Effect.asVoid
              )
            ),
            Effect.forkChild
          )
          yield* Deferred.await(nestedStarted)
          yield* Fiber.interrupt(interrupted)
        }).pipe(Effect.provideService(LanguageModel.LanguageModel, model.service))
      )

      expect(Arr.map(registrations, (registration) => registration.id)).toEqual(
        Arr.make("scope-after-failure", "scope-after-interruption", "scope-outer")
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
      const qaId = yield* Schema.decodeEffect(Module.Id)(qa.name)
      const pipelineId = yield* Schema.decodeEffect(Module.Id)(pipeline.name)
      const rootId = yield* Schema.decodeEffect(Module.Id)(root.name)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed(QaOutput.make({ answer: "Paris" }))
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

      const qaRegistration = Option.getOrThrow(registrationById(first, qaId))
      const pipelineRegistration = Option.getOrThrow(registrationById(first, pipelineId))
      const rootRegistration = Option.getOrThrow(registrationById(first, rootId))

      expect(qaRegistration.subModuleIds).toEqual(Arr.empty())
      expect(pipelineRegistration.subModuleIds).toEqual(Arr.make(qaId))
      expect(rootRegistration.subModuleIds).toEqual(Arr.make(qaId, pipelineId))
    }))
})
