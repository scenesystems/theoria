import { Schema } from "effect"

import { PageLocation } from "../page-location.js"

import { nullablePackageName, type PackageName } from "./shared.js"

const positiveSearchLimit = (rawValue: string | null): number => {
  const parsed = rawValue === null ? Number.NaN : Number(rawValue)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 10
}

export class PackageDocsApiRequestInput extends Schema.Class<PackageDocsApiRequestInput>("PackageDocsApiRequestInput")({
  location: PageLocation
}) {
  static fromLocation(location: PageLocation): PackageDocsApiRequestInput {
    return PackageDocsApiRequestInput.make({ location })
  }

  static fromPathnameSearch(pathname: string, search = ""): PackageDocsApiRequestInput {
    return PackageDocsApiRequestInput.fromLocation(PageLocation.fromPathnameSearch(pathname, search))
  }

  hasPathname(pathname: string): boolean {
    return this.location.pathname === pathname
  }

  limit(): number {
    return positiveSearchLimit(this.searchParams().get("limit"))
  }

  packageId(): PackageName | null {
    return nullablePackageName(this.rawPackageId())
  }

  query(): string {
    return (this.searchParams().get("query") ?? "").trim()
  }

  rawPackageId(): string | null {
    return this.searchParams().get("package")
  }

  private searchParams(): URLSearchParams {
    return new URLSearchParams(this.location.search)
  }
}
