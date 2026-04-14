import type { PayloadModel } from "../../../../contracts/presentation/interactions.js"
import { DetailBadge } from "../../../ui/components/detail/DetailBadge.js"
import { PayloadBlock } from "../../../ui/components/detail/PayloadBlock.js"

const payloadFormatTone = (format: PayloadModel["format"]): "neutral" | "info" => format === "json" ? "info" : "neutral"

export const InteractionPayloadBlock = ({ payload }: { readonly payload: PayloadModel }) => (
  <PayloadBlock
    actions={<DetailBadge tone={payloadFormatTone(payload.format)}>{payload.format}</DetailBadge>}
    code={payload.payload}
    label={payload.title ?? "Payload"}
    meta={payload.format === "json"
      ? "Structured payload preserved from the trace."
      : "Opaque text payload preserved from the trace."}
    wrap
  />
)
