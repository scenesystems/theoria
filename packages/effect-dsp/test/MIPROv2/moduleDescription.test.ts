/**
 * MIPROv2 grounded-proposer module identity.
 *
 * Upstream (DSPy 3.4.0, dspy/propose/grounded_proposer.py:199-221) describes the module being proposed for
 * with its predictor class and current signature fields, `Predict(question) -> answer`, and passes that
 * same `module` input to describe_module and generate_instruction. Theoria's source representation is
 * the public program structure, so the module input is that predictor's canonical path, name, signature
 * description, effective instructions and effective field metadata, read through parameter overlays.
 */
import { describe, expect, it } from "@effect/vitest"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { predictors } from "@scenesystems/effect-dsp/ModuleGraph"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Chunk, Effect, Option, Ref, Schema, String as Str } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { proposeInstructionCandidates, ProposeInstructionCandidatesOptions } from "../../src/MIPROv2Candidates.js"

const trainset = Arr.make(
  new Example({ input: { question: "What is the capital of France?" }, labels: Option.some({ answer: "Paris" }) })
)

const section = (pattern: RegExp) => (prompt: string) =>
  Effect.fromOption(Option.flatMap(Str.match(pattern)(prompt), (groups) => Arr.get(groups, 1)))

const describedModule = section(/\nmodule:\n([\s\S]*)\n\nReturn only module_description\.$/)
const proposedModule = section(/\nmodule:\n([\s\S]*?)\n\nmodule_description:\n/)

describe("MIPROv2 proposer module identity", () => {
  it.effect("identifies each predictor by path and effective signature, not construct-time instructions", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make(
        "Answer questions with concise facts",
        { question: Schema.String },
        { answer: Schema.String }
      )
      const first = yield* Module.predict("first", signature)
      const second = yield* Module.predict("second", signature)
      const root = yield* Module.compose(
        new Module.ComposeOptions({
          name: "pipeline",
          signature,
          subModules: { first, second },
          forward: ({ input }) => first.forward(input).pipe(Effect.andThen(second.forward(input)))
        })
      )
      // Both predictors share signature and effective instructions; upstream's class/fields form would
      // render both as `Predict(question) -> answer`.
      const program = Module.bound(root, {
        "pipeline.first": new ModuleParameters({
          instructions: "Effective shared instruction",
          demos: [],
          fields: { answer: { prefix: Option.some("Reply:"), description: Option.none() } }
        }),
        "pipeline.second": new ModuleParameters({ instructions: "Effective shared instruction", demos: [] })
      })
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed("Generated"))

      yield* proposeInstructionCandidates(
        new ProposeInstructionCandidatesOptions({
          module: program,
          trainset,
          demoCandidates: [],
          numInstructions: 1,
          dataAwareProposer: false,
          tipAwareProposer: false
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))

      const prompts = Arr.map(yield* Ref.get(mock.calls), (call) => call.prompt)
      const expected = [
        `{"path":"pipeline.first","name":"first","signature":{"description":"Answer questions with concise facts","instructions":"Effective shared instruction"},"fields":{"answer":{"prefix":"Reply:","description":null}}}`,
        `{"path":"pipeline.second","name":"second","signature":{"description":"Answer questions with concise facts","instructions":"Effective shared instruction"},"fields":{}}`
      ]

      expect(Arr.map(Chunk.toReadonlyArray(predictors(program)), (predictor) => predictor.path)).toEqual([
        "pipeline.first",
        "pipeline.second"
      ])
      expect(
        yield* Effect.forEach(
          Arr.filter(prompts, Str.endsWith("Return only module_description.")),
          describedModule
        )
      ).toEqual(expected)
      expect(
        yield* Effect.forEach(
          Arr.filter(prompts, Str.endsWith("Return only proposed_instruction.")),
          proposedModule
        )
      ).toEqual(expected)
      expect(Arr.some(prompts, Str.includes(`module:\n${signature.instructions}\n`))).toBe(false)
      // Proposal reads the overlay without installing it.
      expect((yield* Ref.get(first.parameters)).instructions).toBe(signature.instructions)
    }))
})
