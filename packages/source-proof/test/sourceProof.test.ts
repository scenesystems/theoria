import { Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import {
  callInvocations,
  ConditionalInvocation,
  conditionalInvocations,
  ExpressionInvocation,
  moduleSpecifiers,
  parseJsonc,
  parseTypeScript,
  readProjectFile,
  resolveRootFrom
} from "../src/index.js"

const packageRootUrl = new URL("../", import.meta.url)

describe("source proof", () => {
  it.effect("resolves project roots from file URLs", () =>
    Effect.gen(function*() {
      const pathService = yield* Path.Path
      const expectedRoot = yield* pathService.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
      const resolvedRoot = yield* resolveRootFrom(packageRootUrl)

      expect(resolvedRoot).toBe(expectedRoot)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("reads project files from vite @fs roots", () =>
    Effect.gen(function*() {
      const pathService = yield* Path.Path
      const expectedRoot = yield* pathService.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
      const viteRootUrl = new URL(`http://localhost:5175/@fs${encodeURI(expectedRoot)}`)
      const resolvedRoot = yield* resolveRootFrom(viteRootUrl)
      const packageIndex = yield* readProjectFile(viteRootUrl, "src/index.ts")

      expect(resolvedRoot).toBe(expectedRoot)
      expect(packageIndex.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("collects declaration import-type module specifiers", () =>
    Effect.sync(() => {
      const sourceFile = parseTypeScript(
        "fixture.d.ts",
        "export declare const digest: import(\"@noble/hashes/utils.js\").Hash<unknown>\n"
      )

      expect(moduleSpecifiers(sourceFile)).toEqual(["@noble/hashes/utils.js"])
    }))

  it.effect("parses JSONC without exposing the TypeScript parser to consumers", () =>
    Effect.sync(() => {
      expect(parseJsonc("fixture.jsonc", "{ \"value\": 1, }")).toEqual(Option.some({ value: 1 }))
      expect(parseJsonc("fixture.jsonc", "{ invalid }")).toEqual(Option.none())
    }))

  it.effect("collects structural call and conditional invocation details", () =>
    Effect.sync(() => {
      const sourceFile = parseTypeScript(
        "fixture.ts",
        "const value = Schema.encode(schema)(input)\n"
          + "const result = Num.greaterThan(bytes.byteLength, maximumBytes)"
          + " ? new Excess({}) : digestBytesTagged(algorithm, bytes)\n"
      )

      expect(callInvocations(sourceFile)).toContainEqual(
        new ExpressionInvocation({ kind: "call", target: "Schema.encode()", arguments: ["input"] })
      )
      expect(conditionalInvocations(sourceFile)).toEqual([
        new ConditionalInvocation({
          condition: new ExpressionInvocation({
            kind: "call",
            target: "Num.greaterThan",
            arguments: ["bytes.byteLength", "maximumBytes"]
          }),
          whenTrue: new ExpressionInvocation({ kind: "new", target: "Excess", arguments: ["{}"] }),
          whenFalse: new ExpressionInvocation({
            kind: "call",
            target: "digestBytesTagged",
            arguments: ["algorithm", "bytes"]
          })
        })
      ])
    }))
})
