import { fullCanonicalUrl, type PageMetadata, siteMetadata } from "../../../contracts/presentation/metadata.js"

/**
 * Renders React 19 native metadata tags that are automatically hoisted
 * to `<head>`. Provides per-route title, description, Open Graph, and
 * canonical URL from the shared `PageMetadata` contract.
 *
 * @since 0.1.0
 */
export const DocumentHead = ({ metadata }: { readonly metadata: PageMetadata }) => {
  const canonicalUrl = fullCanonicalUrl(metadata.canonicalPath)

  return (
    <>
      <title>{metadata.title}</title>
      <meta name="description" content={metadata.description} />
      <meta property="og:title" content={metadata.title} />
      <meta property="og:description" content={metadata.description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={metadata.ogType} />
      <meta property="og:site_name" content={siteMetadata.siteName} />
      <link rel="canonical" href={canonicalUrl} />
    </>
  )
}
