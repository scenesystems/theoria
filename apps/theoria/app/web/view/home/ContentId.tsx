import { Tooltip } from "@base-ui/react/tooltip"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Option } from "effect"

import { copyDocsCodeAtom, docsCopiedCodeAtom, docsCopyFailedCodeAtom } from "../../atoms/docs.js"
import { toneClassesFor } from "../primitives/designSystem.js"
import { Layer, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"

import { shortId } from "./placeViewModel.js"

const digestTone = toneClassesFor("digest")

const triggerClassName =
  "-mx-1 inline-flex min-w-0 max-w-full cursor-copy items-center rounded-md px-1 py-0.5 text-left transition-colors duration-150 hover:bg-stage-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20"

const popupClassName = [
  "max-w-[min(26rem,calc(100vw-2rem))] rounded-lg border border-stage-200/90 bg-stage-0/96 px-3 py-2.5 shadow-chip backdrop-blur-sm",
  "transition-[opacity,transform] duration-150",
  "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
  "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
  "origin-[var(--transform-origin)]"
].join(" ")

const copyStateText = ({ copied, failed }: { readonly copied: boolean; readonly failed: boolean }): string =>
  copied ? "Copied" : failed ? "Copy failed" : "Click to copy"

/**
 * A content ID as the page shows it everywhere: the digest in the digest
 * tone, cut short where there is no room. Hover or focus shows the whole ID;
 * a click copies it, so two IDs on the page can be compared character by
 * character instead of trusting the first ten.
 */
export const ContentId = ({ className = "", form, id }: {
  readonly className?: string
  readonly form: "short" | "full"
  readonly id: string
}) => {
  const copy = useAtomSet(copyDocsCodeAtom)
  const copied = Option.contains(useAtomValue(docsCopiedCodeAtom), id)
  const failed = Option.contains(useAtomValue(docsCopyFailedCodeAtom), id)

  return (
    <Tooltip.Root
      onOpenChange={(open, details) => {
        // A click copies; the tooltip stays to show "Copied" instead of vanishing.
        if (!open && details.reason === "trigger-press") details.cancel()
      }}
    >
      <Tooltip.Trigger
        aria-label={`Content ID ${id}`}
        className={`${triggerClassName} ${className}`}
        data-place-content-id={id}
        onClick={() => {
          copy(id)
        }}
      >
        <SemanticText
          as="code"
          className={form === "full" ? `block truncate ${digestTone.textStrong}` : digestTone.text}
          role="code-meta"
          text={form === "full" ? id : shortId(id)}
        />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner align="start" collisionPadding={16} side="bottom" sideOffset={6}>
          <Tooltip.Popup className={popupClassName}>
            <Stack className="gap-1">
              <Layer className="min-w-0">
                <SemanticText
                  as="p"
                  className={`break-all ${digestTone.textStrong}`}
                  role="code-meta"
                  text={id}
                  variant="compact"
                  wrapAuthority="native-browser"
                />
              </Layer>
              <SemanticText
                as="span"
                className="text-ink-500"
                role="row-label"
                text={copyStateText({ copied, failed })}
                variant="compact"
              />
            </Stack>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
