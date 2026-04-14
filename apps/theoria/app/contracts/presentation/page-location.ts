import { Schema } from "effect"

export class PageLocation extends Schema.Class<PageLocation>("PageLocation")({
  pathname: Schema.String,
  search: Schema.String
}) {
  static fromPathnameSearch(pathname: string, search = ""): PageLocation {
    return PageLocation.make({
      pathname,
      search
    })
  }

  static fromUrl(rawUrl: string): PageLocation {
    const url = new URL(rawUrl, "http://127.0.0.1")

    return PageLocation.fromPathnameSearch(url.pathname, url.search)
  }
}
