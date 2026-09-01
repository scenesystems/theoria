import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import {
  ArrayType,
  Comment,
  CommentTag,
  DeclarationReflection,
  FileRegistry,
  IntrinsicType,
  ParameterReflection,
  ProjectReflection,
  ReflectionFlag,
  ReflectionKind,
  ReflectionSymbolId,
  SignatureReflection,
  TypeParameterReflection,
  normalizePath
} from "typedoc"

import { type ApiReferenceRoute } from "./model.js"
import { makeApiPresentation } from "./typedoc-presentation.js"

const summary = (text: string) => new Comment([{ kind: "text", text }])

const project = new ProjectReflection("@scenesystems/example", new FileRegistry())
const moduleReflection = new DeclarationReflection(
  "@scenesystems/example/Study",
  ReflectionKind.Module,
  project
)
moduleReflection.comment = new Comment(
  [{ kind: "text", text: "Run and inspect optimization studies." }],
  [new CommentTag("@since", [{ kind: "text", text: "1.0.0" }])]
)

const snapshot = new DeclarationReflection("snapshot", ReflectionKind.Function, moduleReflection)
snapshot.comment = summary("Run and inspect optimization studies.")
const resultSignature = new SignatureReflection("snapshot", ReflectionKind.CallSignature, snapshot)
resultSignature.comment = new Comment(
  [
    { kind: "text", text: "Snapshot a " },
    { kind: "code", text: "`completed`" },
    { kind: "text", text: " study result." }
  ],
  [
    new CommentTag("@example", [{
      kind: "code",
      text: "```ts\nconst encoded = snapshot(result)\n```"
    }]),
    new CommentTag("@see", [{
      kind: "inline-tag",
      tag: "@link",
      text: "snapshot",
      target: resultSignature
    }]),
    new CommentTag("@see", [{
      kind: "inline-tag",
      tag: "@link",
      text: "Scheduler",
      target: new ReflectionSymbolId({
        packageName: "@scenesystems/example",
        packagePath: normalizePath("src/Scheduler.ts"),
        qualifiedName: "Scheduler"
      })
    }]),
    new CommentTag("@see", [{
      kind: "inline-tag",
      tag: "@link",
      text: "import(\"./Report.js\").Report"
    }])
  ]
)
const config = new TypeParameterReflection("Config", resultSignature, undefined)
config.default = new IntrinsicType("unknown")
resultSignature.typeParameters = [config]
const result = new ParameterReflection("result", ReflectionKind.Parameter, resultSignature)
result.type = new IntrinsicType("StudyResult<Config>")
resultSignature.parameters = [result]
resultSignature.type = new IntrinsicType("Effect<StudySnapshot>")

const handleSignature = new SignatureReflection("snapshot", ReflectionKind.CallSignature, snapshot)
handleSignature.comment = summary("Snapshot an active study handle.")
const handle = new ParameterReflection("handle", ReflectionKind.Parameter, handleSignature)
handle.type = new IntrinsicType("StudyHandle")
handle.setFlag(ReflectionFlag.Optional)
handleSignature.parameters = [handle]
handleSignature.type = new IntrinsicType("Effect<StudySnapshot, SnapshotError>")
snapshot.signatures = [resultSignature, handleSignature]

const executeOutcome = new DeclarationReflection("ExecuteOutcome", ReflectionKind.Interface, moduleReflection)
executeOutcome.comment = summary("The result of running a study.")
const outcomeConfig = new TypeParameterReflection("Config", executeOutcome, undefined)
outcomeConfig.default = new IntrinsicType("unknown")
executeOutcome.typeParameters = [outcomeConfig]
const trials = new DeclarationReflection("trials", ReflectionKind.Property, executeOutcome)
trials.comment = summary("All trials in execution order.")
trials.type = new ArrayType(new IntrinsicType("Trial<Config>"))
trials.setFlag(ReflectionFlag.Readonly)
executeOutcome.children = [trials]

const executeOutcomeValue = new DeclarationReflection("ExecuteOutcome", ReflectionKind.Variable, moduleReflection)
executeOutcomeValue.comment = summary("Construct an execution outcome.")
executeOutcomeValue.type = new IntrinsicType("Data.Class.Constructor<ExecuteOutcome>")

moduleReflection.children = [snapshot, executeOutcome, executeOutcomeValue]

const sourceUrl = "https://github.com/scenesystems/theoria/blob/revision/packages/example/src/Study.ts"
const routes: ReadonlyArray<ApiReferenceRoute> = [
  {
    subpath: "./Study",
    slug: "Study",
    canonical: true,
    path: "/docs/example/api/Study",
    page: "packages/example/pages/Study.json",
    imports: [
      {
        name: "snapshot",
        importKind: "value",
        summary: "Barrel module summary.",
        since: "1.0.0",
        category: "persistence",
        reflections: [{
          reflectionId: snapshot.id,
          reflectionKind: "Function",
          sourceUrl: `${sourceUrl}#L20`
        }]
      },
      {
        name: "ExecuteOutcome",
        importKind: "value",
        summary: "The result of running a study.",
        since: "1.0.0",
        category: "models",
        reflections: [
          {
            reflectionId: executeOutcome.id,
            reflectionKind: "Interface",
            sourceUrl: `${sourceUrl}#L40`
          },
          {
            reflectionId: executeOutcomeValue.id,
            reflectionKind: "Variable",
            sourceUrl: `${sourceUrl}#L50`
          }
        ]
      }
    ]
  },
  {
    subpath: "./study",
    slug: "study",
    canonical: false,
    path: "/docs/example/api/study",
    page: "packages/example/pages/study.json",
    imports: []
  }
]

describe("TypeDoc presentation adapter", () => {
  it.effect("creates stable page models with semantic signatures and a canonical search index", () =>
    Effect.gen(function*() {
      const presentation = yield* makeApiPresentation({
        packageName: "@scenesystems/example",
        packageVersion: "1.2.3",
        packageSlug: "example",
        packageDescription: "Optimization primitives for Effect",
        moduleReflection,
        moduleSourceUrl: sourceUrl,
        routes,
        links: [
          ["@scenesystems/example", "Study", "/docs/example/api/Study"],
          ["@scenesystems/example", "snapshot", "/docs/example/api/Study#api-snapshot"],
          ["@scenesystems/example", "ExecuteOutcome", "/docs/example/api/Study#api-ExecuteOutcome"],
          ["@scenesystems/example", "Scheduler", "/docs/example/api/Scheduler"],
          ["@scenesystems/example", "Report", "/docs/example/api/Report#api-Report"]
        ]
      })
      const page = presentation.pages[0]
      const snapshotExport = page?.exports[0]
      const outcomeExport = page?.exports[1]

      expect(page).toMatchObject({
        schemaVersion: 1,
        path: "/docs/example/api/Study",
        canonical: true,
        canonicalPath: "/docs/example/api/Study",
        aliases: ["/docs/example/api/study"],
        module: {
          name: "Study",
          since: "1.0.0",
          sourceUrl
        },
        categories: [
          { name: "persistence", exportIds: ["example/Study#snapshot"] },
          { name: "models", exportIds: ["example/Study#ExecuteOutcome"] }
        ]
      })
      expect(snapshotExport?.facets[0]?.declaration).not.toContain("export declare")
      expect(snapshotExport?.summary).toBe("Snapshot a completed study result.")
      expect(snapshotExport?.facets[0]?.signatures).toHaveLength(2)
      expect(snapshotExport?.facets[0]?.signatures[0]).toMatchObject({
        code: "snapshot<Config = unknown>(result: StudyResult<Config>): Effect<StudySnapshot>",
        typeParameters: [{ name: "Config", constraint: null, default: "unknown" }],
        parameters: [{ name: "result", type: "StudyResult<Config>", optional: false }],
        returns: { type: "Effect<StudySnapshot>" },
        sourceUrl: `${sourceUrl}#L20`
      })
      expect(snapshotExport?.facets[0]?.signatures[0]?.docs.summary).toEqual([
        { kind: "text", text: "Snapshot a " },
        { kind: "code", text: "completed" },
        { kind: "text", text: " study result." }
      ])
      expect(snapshotExport?.facets[0]?.signatures[0]?.docs.examples[0]).toEqual({
        language: "ts",
        code: "const encoded = snapshot(result)",
        parts: []
      })
      expect(snapshotExport?.facets[0]?.signatures[0]?.docs.see).toEqual([
        [{ kind: "link", text: "snapshot", href: "/docs/example/api/Study#api-snapshot" }],
        [{ kind: "link", text: "Scheduler", href: "/docs/example/api/Scheduler" }],
        [{ kind: "link", text: "import(\"./Report.js\").Report", href: "/docs/example/api/Report#api-Report" }]
      ])
      expect(snapshotExport?.facets[0]?.signatures[1]?.code).toBe(
        "snapshot(handle?: StudyHandle): Effect<StudySnapshot, SnapshotError>"
      )
      expect(outcomeExport?.facets).toHaveLength(2)
      expect(outcomeExport?.facets[0]).toMatchObject({
        kind: "interface",
        declaration: "interface ExecuteOutcome<Config = unknown>",
        typeParameters: [{ name: "Config", constraint: null, default: "unknown" }],
        members: [{
          name: "trials",
          kind: "property",
          declaration: "readonly trials: Trial<Config>[]",
          sourceUrl: `${sourceUrl}#L40`
        }]
      })
      expect(presentation.searchEntries.map(({ id, kind, name, path, anchor }) => [
        id, kind, name, path, anchor
      ])).toEqual([
        ["example/Study", "module", "Study", "/docs/example/api/Study", null],
        ["example/Study#snapshot", "symbol", "snapshot", "/docs/example/api/Study", "api-snapshot"],
        ["example/Study#ExecuteOutcome", "symbol", "ExecuteOutcome", "/docs/example/api/Study", "api-ExecuteOutcome"]
      ])
      expect(presentation.searchEntries[1]).toMatchObject({
        package: "@scenesystems/example",
        qualifiedName: "@scenesystems/example/Study.snapshot",
        category: "persistence",
        summary: "Snapshot a completed study result."
      })
    }))
})
