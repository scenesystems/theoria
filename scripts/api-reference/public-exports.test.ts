import { Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Option } from "effect"
import { Comment, CommentTag, DeclarationReflection, ReflectionKind } from "typedoc"

import { publicExportsFromReflection } from "./public-exports.js"

const documented = (summary: string, since: string, category: string) =>
  new Comment(
    [{ kind: "text", text: summary }],
    [
      new CommentTag("@since", [{ kind: "text", text: since }]),
      new CommentTag("@category", [{ kind: "text", text: category }])
    ]
  )

const reflectionFixture = () => {
  const module = new DeclarationReflection("Example", ReflectionKind.Module)
  const alpha = new DeclarationReflection("Alpha", ReflectionKind.TypeAlias, module)
  alpha.comment = documented("  Alpha data.  ", "1.0.0", "models")

  const modelType = new DeclarationReflection("Model", ReflectionKind.Interface, module)
  modelType.comment = documented("Model shape.", "1.0.0", "models")
  const modelValue = new DeclarationReflection("Model", ReflectionKind.Variable, module)
  modelValue.comment = documented("Construct a model.", "1.1.0", "constructors")

  const widgets = new DeclarationReflection("Widgets", ReflectionKind.Namespace, module)
  widgets.comment = documented("Widget operations.", "1.2.0", "namespaces")
  module.children = Arr.make(widgets, modelType, alpha, modelValue)
  return module
}

const collect = (reflection: DeclarationReflection) =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    return yield* publicExportsFromReflection({
      path,
      packageName: "@scenesystems/example",
      packageRoot: "/repo/packages/example",
      entrypoint: {
        subpath: ".",
        sourceFile: { absolute: "/repo/packages/example/src/index.ts", relative: "src/index.ts" }
      },
      reflection
    })
  }).pipe(Effect.provide(BunContext.layer))

describe("public export presentation", () => {
  it.effect("classifies merged declarations, prefers value documentation, trims text, and sorts exports", () =>
    Effect.gen(function*() {
      const exports = yield* collect(reflectionFixture())

      expect(Arr.map(exports, ({ exportName, kind, summary, since, category }) => ({
        exportName,
        kind,
        summary,
        since,
        category
      }))).toEqual([
        { exportName: "Alpha", kind: "type", summary: "Alpha data.", since: "1.0.0", category: "models" },
        {
          exportName: "Model",
          kind: "value",
          summary: "Construct a model.",
          since: "1.1.0",
          category: "constructors"
        },
        {
          exportName: "Widgets",
          kind: "namespace",
          summary: "Widget operations.",
          since: "1.2.0",
          category: "namespaces"
        }
      ])
    }))

  it.effect("reports every missing documentation field", () =>
    Effect.gen(function*() {
      const reflection = reflectionFixture()
      const incomplete = new DeclarationReflection("Incomplete", ReflectionKind.Variable, reflection)
      incomplete.comment = new Comment([])
      reflection.children = Arr.append(
        Option.fromNullable(reflection.children).pipe(Option.getOrElse(Arr.empty)),
        incomplete
      )

      const result = yield* Effect.either(collect(reflection))
      expect(Either.isLeft(result)).toBe(true)
      expect(Either.getLeft(result)).toMatchObject({
        _tag: "Some",
        value: {
          _tag: "ApiReferenceGenerationError",
          detail: "public API documentation is incomplete: .#Incomplete (summary, @since, @category)"
        }
      })
    }))
})
