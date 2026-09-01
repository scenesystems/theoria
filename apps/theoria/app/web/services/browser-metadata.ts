import { Option } from "effect"

import { fullCanonicalUrl, type PageMetadata } from "../../contracts/metadata.js"

const setContent = (selector: string, content: string): void => {
  Option.fromNullable(document.head.querySelector<HTMLMetaElement>(selector)).pipe(
    Option.match({
      onNone: () => undefined,
      onSome: (element) => element.setAttribute("content", content)
    })
  )
}

const setCanonicalUrl = (canonicalPath: string): void => {
  Option.fromNullable(document.head.querySelector<HTMLLinkElement>("link[rel=\"canonical\"]")).pipe(
    Option.match({
      onNone: () => undefined,
      onSome: (element) => element.setAttribute("href", fullCanonicalUrl(canonicalPath))
    })
  )
}

export const applyBrowserMetadata = (metadata: PageMetadata): void => {
  const canonicalUrl = fullCanonicalUrl(metadata.canonicalPath)

  document.title = metadata.title
  setContent("meta[name=\"description\"]", metadata.description)
  setContent("meta[property=\"og:title\"]", metadata.title)
  setContent("meta[property=\"og:description\"]", metadata.description)
  setContent("meta[property=\"og:url\"]", canonicalUrl)
  setContent("meta[property=\"og:type\"]", metadata.ogType)
  setContent("meta[name=\"twitter:title\"]", metadata.title)
  setContent("meta[name=\"twitter:description\"]", metadata.description)
  setCanonicalUrl(metadata.canonicalPath)
}
