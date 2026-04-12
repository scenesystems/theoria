import { describe, expect, it } from "@effect/vitest"

import { CapabilityAvailabilityRoute } from "../../app/contracts/capability/availability.js"
import { EntryRunRoute } from "../../app/contracts/entry/api-route.js"
import { LiveHealthRoute } from "../../app/contracts/health.js"
import { PackageDocsBundleRoute } from "../../app/contracts/presentation/package-docs.js"
import { appRequestRoute } from "../../app/contracts/request-route.js"

describe("app request route authority", () => {
  it("classifies canonical contract routes through the authoritative nouns", () => {
    expect(appRequestRoute(EntryRunRoute.fromEntryId("effect-search").path())._tag).toBe("run")
    expect(appRequestRoute(LiveHealthRoute.pathname())._tag).toBe("live")
    expect(appRequestRoute(PackageDocsBundleRoute.pathname())._tag).toBe("bundle")
    expect(appRequestRoute(CapabilityAvailabilityRoute.pathname())._tag).toBe("availability")
    expect(appRequestRoute("/api/not-real")._tag).toBe("ApiNotFoundRequestRoute")
    expect(appRequestRoute("/packages")._tag).toBe("StaticRequestRoute")
  })
})
