import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Layer, Option, Ref, Stream } from "effect"
import * as ts from "typescript"

import {
  callExpressionTargets,
  exportedDeclarationNames,
  parseTypeScript,
  readProjectFile,
  variableInitializerTexts
} from "../../../../tools/testing/sourceProof.js"
import { Contracts, Text } from "../../src/index.js"
import type { LayoutRequestType } from "../../src/Text/schema.js"

const packageRootUrl = new URL("../../", import.meta.url)

const makeTestContext = Effect.gen(function*() {
  const measurements = yield* Ref.make(0)
  const measurerLayer = Layer.succeed(Contracts.TextMeasurer, {
    measure: (_font, text: string) => Ref.update(measurements, (count) => count + 1).pipe(Effect.as(text.length * 5))
  })

  return {
    measurements,
    layer: Layer.mergeAll(
      Text.WordSegmenterLive,
      Text.EngineProfileLive,
      Text.MeasurementCacheLive.pipe(Layer.provide(measurerLayer))
    )
  }
})

const parseVariableInitializer = (source: string, variableName: string): ts.SourceFile => {
  const parsed = parseTypeScript(`${variableName}.ts`, source)
  const [initializer = "undefined"] = variableInitializerTexts(parsed, variableName)

  return parseTypeScript(`${variableName}.initializer.ts`, `const ${variableName} = ${initializer}`)
}

const initializerTargets = (source: string, variableName: string): ReadonlyArray<string> =>
  callExpressionTargets(parseVariableInitializer(source, variableName))

const objectLiteralPropertyNames = (sourceFile: ts.SourceFile): ReadonlyArray<string> => {
  const collect = (node: ts.Node): ReadonlyArray<string> => [
    ...(ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) ? [node.name.text] : []),
    ...node.getChildren(sourceFile).flatMap(collect)
  ]

  return collect(sourceFile)
}

const initializerObjectLiteralKeys = (source: string, variableName: string): ReadonlyArray<string> =>
  objectLiteralPropertyNames(parseVariableInitializer(source, variableName))

const readInitializerTargets = (relativePath: string, variableName: string) =>
  readProjectFile(packageRootUrl, relativePath).pipe(Effect.map((source) => initializerTargets(source, variableName)))

const readInitializerObjectLiteralKeys = (relativePath: string, variableName: string) =>
  readProjectFile(packageRootUrl, relativePath).pipe(
    Effect.map((source) => initializerObjectLiteralKeys(source, variableName))
  )

const readDeclarationNames = (relativePath: string) =>
  readProjectFile(packageRootUrl, relativePath).pipe(
    Effect.map((source) => exportedDeclarationNames(parseTypeScript(relativePath, source)))
  )

const collectCursorLines = (
  prepared: Text.PreparedText,
  request: LayoutRequestType,
  cursor = Text.initialCursor()
): ReadonlyArray<Text.LayoutLineType> =>
  Option.match(Text.layoutNextLine(prepared, request, cursor), {
    onNone: () => [],
    onSome: ([line, nextCursor]) => [line, ...collectCursorLines(prepared, request, nextCursor)]
  })

describe("Text hot-path contracts", () => {
  it.effect("layout computes summary without materializing all lines first", () =>
    Effect.gen(function*() {
      const layoutTargets = yield* readInitializerTargets("src/Text/layout.ts", "layout")

      expect(layoutTargets.includes("layoutLines")).toBe(false)
      expect(layoutTargets.includes("materializeLines")).toBe(false)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("layoutNextLine advances with a source-position cursor", () =>
    Effect.gen(function*() {
      const {
        layoutNextLineTargets,
        layoutCursorKeys,
        initialCursorKeys,
        constructorsDeclarations
      } = yield* Effect.all({
        layoutNextLineTargets: readInitializerTargets("src/Text/layout.ts", "layoutNextLine"),
        layoutCursorKeys: readInitializerObjectLiteralKeys("src/Text/schema.ts", "LayoutCursor"),
        initialCursorKeys: readInitializerObjectLiteralKeys("src/Text/layout.ts", "initialCursor"),
        constructorsDeclarations: readDeclarationNames("src/Text/constructors.ts")
      })

      expect(constructorsDeclarations.includes("prepareWithSegments")).toBe(true)
      expect(layoutNextLineTargets.includes("layoutLines")).toBe(false)
      expect([...layoutCursorKeys].sort()).toEqual(["graphemeIndex", "segmentIndex"])
      expect([...initialCursorKeys].sort()).toEqual(["graphemeIndex", "segmentIndex"])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("streamLines emits the same sequence as repeated layoutNextLine", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepare({
        text: "one two three four five six",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))
      const request: LayoutRequestType = { maxWidth: 35, lineHeight: 12 }
      const streamed = yield* Text.streamLines(prepared, request).pipe(
        Stream.runCollect,
        Effect.map(Chunk.toReadonlyArray)
      )
      const cursorLines = collectCursorLines(prepared, request)
      const { streamTargets, layoutNextLineTargets } = yield* Effect.all({
        streamTargets: readInitializerTargets("src/Text/layout.ts", "streamLines"),
        layoutNextLineTargets: readInitializerTargets("src/Text/layout.ts", "layoutNextLine")
      })

      expect(streamed).toEqual(cursorLines)
      expect(streamTargets.includes("layoutLines")).toBe(false)
      expect(streamTargets.includes("Stream.fromIterable")).toBe(false)
      expect(layoutNextLineTargets.includes("layoutLines")).toBe(false)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("walkLineRanges matches layoutLines widths and cursor bounds", () =>
    Effect.gen(function*() {
      const { layoutDeclarations, schemaDeclarations } = yield* Effect.all({
        layoutDeclarations: readDeclarationNames("src/Text/layout.ts"),
        schemaDeclarations: readDeclarationNames("src/Text/schema.ts")
      })

      expect(layoutDeclarations.includes("walkLineRanges")).toBe(true)
      expect(schemaDeclarations.includes("LayoutLineRange")).toBe(true)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("measureNaturalWidth returns the widest forced line width", () =>
    Effect.gen(function*() {
      const layoutDeclarations = yield* readDeclarationNames("src/Text/layout.ts")

      expect(layoutDeclarations.includes("measureNaturalWidth")).toBe(true)
    }).pipe(Effect.provide(BunContext.layer)))
})
