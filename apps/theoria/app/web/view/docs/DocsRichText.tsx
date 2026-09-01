import * as Arr from "effect/Array"
import type { ReactNode } from "react"

import type { ApiDocPart, GuideInline } from "@theoria/docs-model"
import { ExternalLink, InternalLink } from "../primitives/Link.js"

type RichPart = ApiDocPart | GuideInline

const richLink = (href: string, text: string, key: string): ReactNode => {
  const className = "font-medium text-ink-800 underline decoration-stage-400 underline-offset-4 hover:text-ink-950"

  return href.startsWith("/") || href.startsWith("#")
    ? <InternalLink className={className} href={href} key={key}>{text}</InternalLink>
    : <ExternalLink className={className} href={href} key={key}>{text}</ExternalLink>
}

const richPart = (part: RichPart, key: string): ReactNode => {
  if (part.kind === "text") return part.text
  if (part.kind === "code") {
    return (
      <code
        className="rounded-md border border-stage-200/80 bg-stage-100/72 px-1.5 py-0.5 font-mono text-[0.88em] text-ink-900"
        key={key}
      >
        {part.text}
      </code>
    )
  }

  return part.href === null ? part.text : richLink(part.href, part.text, key)
}

export const DocsRichText = ({ parts }: { readonly parts: ReadonlyArray<RichPart> }) => (
  <>
    {Arr.map(parts, (part, index) => {
      const key = `${part.kind}:${String(index)}:${part.text.length}`

      return richPart(part, key)
    })}
  </>
)
