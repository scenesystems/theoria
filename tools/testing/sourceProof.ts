import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Data, Effect, Option } from "effect"
import * as ts from "typescript"

export class SourceFilePath extends Data.Class<{
  readonly absolute: string
  readonly relative: string
}> {}

const visitNodes = (sourceFile: ts.SourceFile, onNode: (node: ts.Node) => void): void => {
  const visit = (node: ts.Node): void => {
    onNode(node)
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}

const renderExpressionChain = (expression: ts.Expression): Option.Option<string> => {
  if (ts.isIdentifier(expression)) {
    return Option.some(expression.text)
  }

  if (ts.isPropertyAccessExpression(expression)) {
    return Option.map(renderExpressionChain(expression.expression), (prefix) => `${prefix}.${expression.name.text}`)
  }

  return Option.none()
}

export const toForwardSlashes = (pathService: Path.Path, value: string): string =>
  value.split(pathService.sep).join("/")

export const pathSegments = (value: string): ReadonlyArray<string> =>
  value.split("/").filter((segment) => segment.length > 0)

export const containsPathSegmentSequence = (specifier: string, expected: ReadonlyArray<string>): boolean => {
  const segments = pathSegments(specifier)
  const [firstSegment] = expected

  if (firstSegment === undefined) {
    return false
  }

  const startIndex = segments.indexOf(firstSegment)

  if (startIndex < 0) {
    return false
  }

  return expected.every((segment, index) => segments[index + startIndex] === segment)
}

export const referencesInternalBoundary = (specifier: string): boolean =>
  containsPathSegmentSequence(specifier, ["internal"])

export const resolveRootFrom = (rootUrl: URL): Effect.Effect<string, never, Path.Path> =>
  Effect.gen(function*() {
    const pathService = yield* Path.Path
    return yield* pathService.fromFileUrl(rootUrl).pipe(Effect.orDie)
  })

export const toSourceFilePath = (
  pathService: Path.Path,
  root: string,
  absoluteSourceRoot: string,
  entry: string
): SourceFilePath => {
  const absolutePath = pathService.join(absoluteSourceRoot, entry)

  return new SourceFilePath({
    absolute: absolutePath,
    relative: toForwardSlashes(pathService, pathService.relative(root, absolutePath))
  })
}

export const listTypeScriptFilesInDir = (
  rootUrl: URL,
  dirRelative: string
): Effect.Effect<Array<SourceFilePath>, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const pathService = yield* Path.Path
    const root = yield* resolveRootFrom(rootUrl)
    const absoluteDir = pathService.join(root, dirRelative)
    const exists = yield* fileSystem.exists(absoluteDir).pipe(Effect.orDie)

    if (!exists) {
      return []
    }

    const entries = yield* fileSystem.readDirectory(absoluteDir, { recursive: true }).pipe(Effect.orDie)

    return Arr.flatMap(entries, (entry) =>
      entry.endsWith(".ts")
        ? [toSourceFilePath(pathService, root, absoluteDir, entry)]
        : []
    )
  })

export const readProjectFile = (
  rootUrl: URL,
  relativePath: string
): Effect.Effect<string, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const pathService = yield* Path.Path
    const root = yield* resolveRootFrom(rootUrl)
    const absolutePath = pathService.join(root, relativePath)
    const exists = yield* fileSystem.exists(absolutePath).pipe(Effect.orDie)

    if (!exists) {
      return ""
    }

    return yield* fileSystem.readFileString(absolutePath).pipe(Effect.orDie)
  })

export const parseTypeScript = (fileName: string, source: string): ts.SourceFile =>
  ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

export const moduleSpecifiers = (sourceFile: ts.SourceFile): ReadonlyArray<string> => {
  const specifiers: Array<string> = []

  visitNodes(sourceFile, (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier !== undefined) {
      if (ts.isStringLiteral(node.moduleSpecifier)) {
        specifiers.push(node.moduleSpecifier.text)
      }
    }

    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [firstArgument] = node.arguments

      if (firstArgument !== undefined && ts.isStringLiteral(firstArgument)) {
        specifiers.push(firstArgument.text)
      }
    }
  })

  return specifiers
}

export const propertyAccessChains = (sourceFile: ts.SourceFile): ReadonlyArray<string> => {
  const chains: Array<string> = []

  visitNodes(sourceFile, (node) => {
    if (ts.isPropertyAccessExpression(node)) {
      Option.match(renderExpressionChain(node), {
        onNone: () => undefined,
        onSome: (chain) => {
          chains.push(chain)
          return undefined
        }
      })
    }
  })

  return chains
}

export const callExpressionTargets = (sourceFile: ts.SourceFile): ReadonlyArray<string> => {
  const targets: Array<string> = []

  visitNodes(sourceFile, (node) => {
    if (ts.isCallExpression(node)) {
      Option.match(renderExpressionChain(node.expression), {
        onNone: () => undefined,
        onSome: (chain) => {
          targets.push(chain)
          return undefined
        }
      })
    }
  })

  return targets
}

export const exportedDeclarationNames = (sourceFile: ts.SourceFile): ReadonlyArray<string> => {
  const names: Array<string> = []

  visitNodes(sourceFile, (node) => {
    if (ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      if ((ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.name !== undefined) {
        names.push(node.name.text)
      }

      if (ts.isVariableStatement(node)) {
        node.declarationList.declarations.forEach((declaration) => {
          if (ts.isIdentifier(declaration.name)) {
            names.push(declaration.name.text)
          }
        })
      }
    }
  })

  return names
}

export const stringLiterals = (sourceFile: ts.SourceFile): ReadonlyArray<string> => {
  const literals: Array<string> = []

  visitNodes(sourceFile, (node) => {
    if (ts.isStringLiteral(node)) {
      literals.push(node.text)
    }
  })

  return literals
}

export const numericLiterals = (sourceFile: ts.SourceFile): ReadonlyArray<string> => {
  const literals: Array<string> = []

  visitNodes(sourceFile, (node) => {
    if (ts.isNumericLiteral(node)) {
      literals.push(node.text)
    }
  })

  return literals
}

export const stringLiteralPropertyAssignments = (
  sourceFile: ts.SourceFile,
  propertyName: string
): ReadonlyArray<string> => {
  const values: Array<string> = []

  visitNodes(sourceFile, (node) => {
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === propertyName) {
      if (ts.isStringLiteral(node.initializer)) {
        values.push(node.initializer.text)
      }
    }
  })

  return values
}
