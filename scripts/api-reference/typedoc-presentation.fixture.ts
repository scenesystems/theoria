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

const summary = (text: string) => new Comment([{ kind: "text", text }])

const project = new ProjectReflection("@scenesystems/example", new FileRegistry())
export const moduleReflection = new DeclarationReflection(
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

export const sourceUrl = "https://github.com/scenesystems/theoria/blob/revision/packages/example/src/Study.ts"
export const routes: ReadonlyArray<ApiReferenceRoute> = [
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
        source: "src/Study.ts",
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
        source: "src/Study.ts",
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
