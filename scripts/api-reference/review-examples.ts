import { Array as Arr, HashMap, Option } from "effect"
import * as ts from "typescript"

export type Example = {
  readonly owner: string
  readonly package: string
  readonly language: string | null
  readonly code: string | null
}

const compilerOptions: ts.CompilerOptions = {
  allowJs: false,
  exactOptionalPropertyTypes: true,
  forceConsistentCasingInFileNames: true,
  isolatedModules: true,
  lib: ["lib.es2024.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
  module: ts.ModuleKind.NodeNext,
  moduleDetection: ts.ModuleDetectionKind.Force,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  noEmit: true,
  noImplicitOverride: true,
  noUncheckedIndexedAccess: true,
  skipLibCheck: true,
  strict: true,
  target: ts.ScriptTarget.ES2022,
  types: [],
  verbatimModuleSyntax: true
}

const virtualFile = (repositoryRoot: string, index: number): string =>
  `${repositoryRoot}/.tmp/api-doc-examples/example-${String(index).padStart(4, "0")}.ts`

const importsOf = (code: string): ReadonlyArray<string> => {
  const source = ts.createSourceFile("example.ts", code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS)
  return Arr.filterMap(
    source.statements,
    (statement) =>
      ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)
        ? Option.some(statement.moduleSpecifier.text)
        : Option.none()
  )
}

const importDiagnostics = (
  example: Example,
  importPaths: HashMap.HashMap<string, string>
): ReadonlyArray<string> => {
  if (example.language !== "ts" || example.code === null) {
    return [`${example.owner}: @example must be a fenced TypeScript block`]
  }
  const imports = importsOf(example.code)
  const unsupported = Arr.filter(
    imports,
    (specifier) => specifier.startsWith("@scenesystems/") && !HashMap.has(importPaths, specifier)
  )
  return [
    ...(Arr.some(imports, (specifier) => specifier.startsWith(".") || specifier.startsWith("node:"))
      ? [`${example.owner}: @example imports a private, relative, or Node module`] :
      []),
    ...Arr.map(unsupported, (specifier) => `${example.owner}: @example imports unsupported path ${specifier}`),
    ...(!Arr.some(imports, (specifier) => HashMap.has(importPaths, specifier))
      ? [`${example.owner}: @example has no canonical Theoria package import`] :
      [])
  ]
}

const formatDiagnostic = (
  owner: string,
  diagnostic: ts.Diagnostic
): string => {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
  if (diagnostic.file === undefined || diagnostic.start === undefined) {
    return `${owner}: TS${String(diagnostic.code)} ${message}`
  }
  const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
  return `${owner}:${String(position.line + 1)}:${String(position.character + 1)} TS${
    String(diagnostic.code)
  } ${message}`
}

export const exampleDiagnostics = (
  repositoryRoot: string,
  examples: ReadonlyArray<Example>,
  importPaths: HashMap.HashMap<string, string>
): ReadonlyArray<string> => {
  const compilable = Arr.filter(examples, (example) => example.language === "ts" && example.code !== null)
  const files = HashMap.fromIterable(Arr.map(compilable, (example, index) => [
    virtualFile(repositoryRoot, index),
    { owner: example.owner, code: example.code ?? "" }
  ]))
  const delegate = ts.createCompilerHost(compilerOptions, true)
  const host: ts.CompilerHost = {
    ...delegate,
    getSourceFile: (fileName, languageVersion, onError, shouldCreateNewSourceFile) =>
      Option.match(HashMap.get(files, fileName), {
        onNone: () => delegate.getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile),
        onSome: ({ code }) => ts.createSourceFile(fileName, code, languageVersion, true, ts.ScriptKind.TS)
      }),
    resolveModuleNames: (moduleNames, containingFile) =>
      Arr.map(moduleNames, (moduleName) =>
        Option.match(HashMap.get(importPaths, moduleName), {
          onNone: () => ts.resolveModuleName(moduleName, containingFile, compilerOptions, delegate).resolvedModule,
          onSome: (resolvedFileName) => ({
            resolvedFileName,
            extension: ts.Extension.Ts,
            isExternalLibraryImport: false
          })
        }))
  }
  const program = ts.createProgram({
    rootNames: Arr.fromIterable(HashMap.keys(files)),
    options: compilerOptions,
    host
  })
  const compilerDiagnostics = Arr.flatMap(ts.getPreEmitDiagnostics(program), (diagnostic) => {
    if (diagnostic.file === undefined) return [formatDiagnostic("API examples", diagnostic)]
    return Option.match(HashMap.get(files, diagnostic.file.fileName), {
      onNone: () => [],
      onSome: ({ owner }) => [formatDiagnostic(owner, diagnostic)]
    })
  })
  return Arr.dedupe([
    ...Arr.flatMap(examples, (example) => importDiagnostics(example, importPaths)),
    ...compilerDiagnostics
  ])
}
