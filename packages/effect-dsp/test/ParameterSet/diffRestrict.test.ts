/**
 * ParameterSet.diff and ParameterSet.restrict contracts over real program snapshots.
 */
import { expect, it } from "@effect/vitest"
import { Demonstration } from "@scenesystems/effect-dsp/Demonstration"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters, withDemos, withInstructions } from "@scenesystems/effect-dsp/ModuleParameters"
import * as ParameterSet from "@scenesystems/effect-dsp/ParameterSet"
import * as Predictor from "@scenesystems/effect-dsp/Predictor"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Effect, Option, Record, Schema, String as Str } from "effect"

const program = Effect.gen(function*() {
  const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
  const draft = yield* Module.predict("draft", signature)
  const judge = yield* Module.predict("judge", signature)
  const root = yield* Module.compose(
    new Module.ComposeOptions({
      name: "root",
      signature,
      subModules: { draft, judge },
      forward: ({ input }) => judge.forward(input)
    })
  )
  return root
})

const path = (value: string) => Predictor.Path.make(value)
const get = (set: ParameterSet.ParameterSet, key: string) => Option.getOrThrow(Record.get(set, path(key)))

it.effect("diff keeps exactly the added and changed paths, compares structurally and never reports removals", () =>
  Effect.gen(function*() {
    const root = yield* program
    const before = yield* ParameterSet.snapshot(root)
    expect(Record.keys(before)).toEqual(["root.draft", "root.judge"])
    const draft = get(before, "root.draft")
    const judge = get(before, "root.judge")
    // A fresh, structurally identical value is unchanged even though it is a different object.
    const sameJudge = new ModuleParameters({
      instructions: judge.instructions,
      demos: judge.demos,
      outputStrategy: judge.outputStrategy
    })
    expect(sameJudge).not.toBe(judge)
    const changedDraft = withInstructions(draft, "revised draft instructions")
    const added = withDemos(draft, [new Demonstration({ input: { question: "q" }, output: { answer: "a" } })])
    const after = { [path("root.draft")]: changedDraft, [path("root.judge")]: sameJudge, [path("root.extra")]: added }
    expect(ParameterSet.diff(before, after)).toEqual({ "root.draft": changedDraft, "root.extra": added })
    expect(get(ParameterSet.diff(before, after), "root.draft")).toBe(changedDraft)
    expect(ParameterSet.diff(before, before)).toEqual({})
    // Paths present only in the first snapshot are removals and are not part of the diff.
    expect(ParameterSet.diff(after, before)).toEqual({ "root.draft": draft })
    expect(ParameterSet.diff(before, { [path("root.judge")]: sameJudge })).toEqual({})
    // Demo-only and output-strategy-only changes are changes.
    const demoOnly = withDemos(judge, [new Demonstration({ input: { question: "x" }, output: { answer: "y" } })])
    const strategyOnly = new ModuleParameters({
      instructions: judge.instructions,
      demos: judge.demos,
      outputStrategy: "text"
    })
    expect(ParameterSet.diff(before, Record.set(before, path("root.judge"), demoOnly))).toEqual({
      "root.judge": demoOnly
    })
    expect(ParameterSet.diff(before, Record.set(before, path("root.judge"), strategyOnly))).toEqual({
      "root.judge": strategyOnly
    })
  }))

it.effect("diff of snapshots around an explicit install reports only the installed predictor", () =>
  Effect.gen(function*() {
    const root = yield* program
    const before = yield* ParameterSet.snapshot(root)
    const installed = withInstructions(get(before, "root.judge"), "installed judge instructions")
    yield* Module.install(root, { [path("root.judge")]: installed })
    const after = yield* ParameterSet.snapshot(root)
    expect(ParameterSet.diff(before, after)).toEqual({ "root.judge": installed })
    expect(get(after, "root.draft")).toEqual(get(before, "root.draft"))
  }))

it.effect("restrict keeps exactly the paths accepted by the predicate, preserving values and the input", () =>
  Effect.gen(function*() {
    const root = yield* program
    const before = yield* ParameterSet.snapshot(root)
    const judgeOnly = ParameterSet.restrict(before, Str.endsWith(".judge"))
    expect(judgeOnly).toEqual({ "root.judge": get(before, "root.judge") })
    expect(get(judgeOnly, "root.judge")).toBe(get(before, "root.judge"))
    expect(ParameterSet.restrict(before, () => false)).toEqual({})
    expect(ParameterSet.restrict(before, () => true)).toEqual(before)
    expect(Record.keys(before)).toEqual(["root.draft", "root.judge"])
    // restrict then diff isolates changes to the retained predictors.
    const after = Record.map(before, (parameters, key) => withInstructions(parameters, `${key} revised`))
    expect(ParameterSet.restrict(ParameterSet.diff(before, after), Str.endsWith(".draft"))).toEqual({
      "root.draft": get(after, "root.draft")
    })
  }))
