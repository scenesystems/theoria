import { Option, Schema } from "effect"

import type { PageLocation } from "../page-location.js"
import { nullablePackageName, type PackageName, PackageNameSchema } from "./shared.js"

const packageDocsLandingPathname = "/packages"

const withOptionalPackageParam = (params: URLSearchParams, packageId: PackageName | null): URLSearchParams => {
  if (packageId !== null) {
    params.set("package", packageId)
  }

  return params
}

export class PackageDocsLandingPageRoute extends Schema.TaggedClass<PackageDocsLandingPageRoute>()(
  "landing",
  {}
) {
  static landing(): PackageDocsLandingPageRoute {
    return packageDocsLandingPageRoute
  }

  static fromLocation(location: PageLocation): Option.Option<PackageDocsLandingPageRoute> {
    return PackageDocsLandingPageRoute.matches(location) &&
        nullablePackageName(new URLSearchParams(location.search).get("package")) === null
      ? Option.some(PackageDocsLandingPageRoute.landing())
      : Option.none()
  }

  static matches(location: PageLocation): boolean {
    return location.pathname === PackageDocsLandingPageRoute.pathname() ||
      location.pathname === `${PackageDocsLandingPageRoute.pathname()}/`
  }

  static pathname(): string {
    return packageDocsLandingPathname
  }

  path(): string {
    return PackageDocsLandingPageRoute.pathname()
  }

  selectedPackageId(): PackageName | null {
    return null
  }
}

export class PackageDocsPackagePageRoute extends Schema.TaggedClass<PackageDocsPackagePageRoute>()(
  "package",
  {
    packageId: PackageNameSchema
  }
) {
  static fromPackageId(packageId: PackageName): PackageDocsPackagePageRoute {
    return PackageDocsPackagePageRoute.make({ packageId })
  }

  static fromLocation(location: PageLocation): Option.Option<PackageDocsPackagePageRoute> {
    const packageId = nullablePackageName(new URLSearchParams(location.search).get("package"))

    return PackageDocsPackagePageRoute.matches(location) && packageId !== null
      ? Option.some(PackageDocsPackagePageRoute.fromPackageId(packageId))
      : Option.none()
  }

  static matches(location: PageLocation): boolean {
    return location.pathname === PackageDocsLandingPageRoute.pathname() ||
      location.pathname === `${PackageDocsLandingPageRoute.pathname()}/`
  }

  path(): string {
    return `${PackageDocsLandingPageRoute.pathname()}?${
      withOptionalPackageParam(new URLSearchParams(), this.packageId).toString()
    }`
  }

  selectedPackageId(): PackageName | null {
    return this.packageId
  }
}

export const PackageDocsPageRouteSchema = Schema.Union(PackageDocsLandingPageRoute, PackageDocsPackagePageRoute)

export type PackageDocsPageRoute = typeof PackageDocsPageRouteSchema.Type

const packageDocsLandingPageRoute = PackageDocsLandingPageRoute.make({})
