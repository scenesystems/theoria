import { Effect, Schema } from "effect"
import { Text } from "effect-text"

import {
  layoutRequestFor,
  prepareInputFor,
  TextProjection,
  type TextProjectionRequest
} from "../../../contracts/text.js"
import { browserTextLayoutLayer } from "../../text/browserTextLayout.js"

export const projectText = (request: TextProjectionRequest, maxWidth: number | null = null) =>
  Effect.gen(function*() {
    const prepared = yield* Text.prepare(prepareInputFor(request.role, request.text))
    const contractLayout = layoutRequestFor(request.role, request.variant)
    const layout: Text.LayoutRequestType = maxWidth !== null
      ? { ...contractLayout, maxWidth: Math.min(contractLayout.maxWidth, maxWidth) }
      : contractLayout

    return yield* Schema.decodeUnknown(TextProjection)({
      role: request.role,
      variant: request.variant,
      text: request.text,
      layout,
      summary: Text.layout(prepared, layout),
      lines: Text.layoutLines(prepared, layout)
    })
  }).pipe(
    Effect.provide(browserTextLayoutLayer)
  )
