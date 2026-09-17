import { describe, expect, it } from "@effect/vitest"
import { Effect, Match, Option } from "effect"
import * as Arr from "effect/Array"

import { codeSiteOnLine } from "../../app/contracts/demo/imagined-place-provenance.js"
import { placeLiveValues } from "../../app/web/view/home/placeLiveValues.js"
import { referenceLinks, sourceUrl } from "../../app/web/view/home/placeReferences.js"
import { placeSteps } from "../../app/web/view/home/placeSteps.js"
import { segmentLine } from "../../app/web/view/primitives/code/codeLinks.js"
import { highlightCode, makeSyntaxHighlighter } from "../../app/web/view/primitives/code/highlighter.js"

describe("How it's built references", () => {
  it.effect("links the signing call while keeping proposal and version provenance distinct", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const highlighter = yield* makeSyntaxHighlighter
        const line = "const signed = yield* Ed25519.sign(message, secretKey, publicKey)"
        const proposalSite = yield* codeSiteOnLine("propose", line)
        const versionSite = yield* codeSiteOnLine("record", line)
        expect(proposalSite.id).toBe("proposal-signature")
        expect(versionSite.id).toBe("version-signature")
        expect(codeSiteOnLine("compose", line)).toEqual(Option.none())
        Arr.forEach(Arr.make(proposalSite, versionSite), (site) => {
          const lines = highlightCode(highlighter, line, "typescript")
          const linked = Arr.flatMap(lines, (line) =>
            Arr.filterMap(
              segmentLine(line, referenceLinks(site.step)),
              (segment) =>
                Match.value(segment).pipe(
                  Match.tag("Link", (segment) => Option.some(segment.link.href)),
                  Match.tag("Tokens", () => Option.none()),
                  Match.exhaustive
                )
            ))
          expect(linked).toEqual(Arr.of("/docs/sign/api/Ed25519#api-sign"))
        })
      })
    ))

  it.effect("pins source links to the build commit and falls back to HEAD for a local server", () =>
    Effect.sync(() => {
      expect(sourceUrl("0123456789abcdef", "apps/theoria/app/server/imagined-place/run.ts")).toBe(
        "https://github.com/scenesystems/theoria/blob/0123456789abcdef/apps/theoria/app/server/imagined-place/run.ts"
      )
      expect(sourceUrl("dev-local", "x.ts")).toBe("https://github.com/scenesystems/theoria/blob/HEAD/x.ts")
    }))

  it.effect("shows no values before anything has been built", () =>
    Effect.sync(() => {
      Arr.forEach(placeSteps, (step) => {
        expect(placeLiveValues(step, Option.none(), Option.none(), Option.none())).toEqual(Arr.empty())
      })
    }))
})
