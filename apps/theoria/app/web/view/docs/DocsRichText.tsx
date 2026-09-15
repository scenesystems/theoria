import { Option } from "effect"
import * as Arr from "effect/Array"
import type { ReactNode } from "react"

import type { ApiDocPart, GuideInline } from "@theoria/docs-model"
import { ExternalLink, InternalLink } from "../primitives/Link.js"

type RichPart = ApiDocPart | GuideInline

const richLink = (href: string, text: string, key: string): ReactNode => {
  const className = "font-medium text-ink underline decoration-accent underline-offset-4 hover:text-ink-strong"

  return href.startsWith("/") || href.startsWith("#")
    ? <InternalLink className={className} href={href} key={key}>{text}</InternalLink>
    : <ExternalLink className={className} href={href} key={key}>{text}</ExternalLink>
}

const richPart = (part: RichPart, key: string): ReactNode => {
  if (part.kind === "text") return part.text
  if (part.kind === "code") {
    return (
      <code
        className="rounded-mark border border-hairline-glass bg-instrument-glass px-1.5 py-0.5 font-mono text-[0.88em] text-ink"
        key={key}
      >
        {part.text}
      </code>
    )
  }

  return typeof part.href === "string"
    ? richLink(part.href, part.text, key)
    : Option.match(part.href, { onNone: () => part.text, onSome: (href) => richLink(href, part.text, key) })
}

export const DocsRichText = ({ parts }: { readonly parts: ReadonlyArray<RichPart> }) => (
  <>
    {Arr.map(parts, (part, index) => {
      const key = `${part.kind}:${String(index)}:${part.text.length}`

      return richPart(part, key)
    })}
  </>
)
