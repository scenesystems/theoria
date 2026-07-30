import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { cpus, totalmem } from "node:os"
import { performance } from "node:perf_hooks"
import { join } from "node:path"
import process from "node:process"
import { ed25519 } from "@noble/curves/ed25519.js"
import { p256 } from "@noble/curves/nist.js"
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js"
import { Effect } from "effect"

const fixtureRoot = process.argv[2]
const moduleMode = process.argv[3]
const Sign =
  moduleMode === "cjs" ? createRequire(import.meta.url)("@scenesystems/sign") : await import("@scenesystems/sign")
const read = (file) => JSON.parse(readFileSync(join(fixtureRoot, file), "utf8"))
const ed25519Fixture = read("ed25519.json")
const p256Fixture = read("p256.json")
const mlDsaFixture = read("ml-dsa-65.json")
const hex = (value) => Uint8Array.from(value.match(/../g) ?? [], (byte) => Number.parseInt(byte, 16))
const verdict = (effect) =>
  Effect.runSync(
    Effect.match(effect, {
      onFailure: (error) => error._tag,
      onSuccess: (value) => value
    })
  )
const expected = (value) => (value === "valid" ? true : value === "nonmatch" ? false : "InvalidVerificationInput")
const actual = [
  ...ed25519Fixture.cases.map((entry) =>
    verdict(Sign.ed25519Verify(hex(entry.signature), hex(entry.message), hex(entry.publicKey)))
  ),
  ...p256Fixture.cases.map((entry) =>
    verdict(Sign.p256Sha256P1363LowSVerify(hex(entry.signature), hex(entry.message), hex(entry.publicKey.uncompressed)))
  ),
  ...mlDsaFixture.cases.map((entry) =>
    verdict(Sign.mlDsa65Verify(hex(entry.signature), hex(entry.message), hex(entry.publicKey), hex(entry.context)))
  )
]
const expectedResults = [
  ...ed25519Fixture.cases.map((entry) => expected(entry.strictVerdict)),
  ...p256Fixture.cases.map((entry) => expected(entry.strictVerdict)),
  ...mlDsaFixture.strictVerdicts.map((entry) => expected(entry.verdict))
]
if (actual.length !== expectedResults.length || actual.some((value, index) => value !== expectedResults[index])) {
  throw new Error("packed conformance corpus mismatch")
}

const message = new Uint8Array(8_192).fill(0x5a)
const edSecret = new Uint8Array(32).fill(7)
const edPublic = ed25519.getPublicKey(edSecret)
const edSignature = ed25519.sign(message, edSecret)
const pSecret = new Uint8Array(32).fill(9)
const pPublic = p256.getPublicKey(pSecret, false)
const pSignature = p256.sign(message, pSecret, { prehash: true, lowS: true })
const mlKeys = ml_dsa65.keygen(new Uint8Array(32).fill(11))
const mlSignature = ml_dsa65.sign(message, mlKeys.secretKey, {
  context: new Uint8Array(0),
  extraEntropy: false
})
const operations = {
  ed25519: () => verdict(Sign.ed25519Verify(edSignature, message, edPublic)),
  p256: () => verdict(Sign.p256Sha256P1363LowSVerify(pSignature, message, pPublic)),
  mlDsa65: () => verdict(Sign.mlDsa65Verify(mlSignature, message, mlKeys.publicKey, new Uint8Array(0)))
}
const benchmark = (operation) => {
  const samples = Array.from({ length: 120 }, () => {
    const started = performance.now()
    if (operation() !== true) throw new Error("benchmark verification failed")
    return performance.now() - started
  }).sort((left, right) => left - right)
  return {
    p50: samples[Math.floor(samples.length * 0.5)],
    p95: samples[Math.floor(samples.length * 0.95)],
    p99: samples[Math.floor(samples.length * 0.99)],
    max: samples.at(-1)
  }
}
const timing = Object.fromEntries(Object.entries(operations).map(([name, operation]) => [name, benchmark(operation)]))
if (Object.values(timing).some((entry) => entry.p95 > 10 || entry.max > 100)) {
  throw new Error("verification responsiveness profile exceeded")
}
const excessMessage = new Uint8Array(8_193)
const boundPlusOne = {
  ed25519: verdict(Sign.ed25519Verify(edSignature, excessMessage, edPublic)),
  p256: verdict(Sign.p256Sha256P1363LowSVerify(pSignature, excessMessage, pPublic)),
  mlDsa65: verdict(Sign.mlDsa65Verify(mlSignature, excessMessage, mlKeys.publicKey, new Uint8Array(0)))
}
if (Object.values(boundPlusOne).some((entry) => entry !== "InvalidVerificationInput")) {
  throw new Error("bound-plus-one input was admitted")
}
process.stdout.write(
  JSON.stringify({
    runtime: process.versions.bun === undefined ? `Node ${process.version}` : `Bun ${process.versions.bun}`,
    moduleMode,
    corpusCases: actual.length,
    timing,
    peakProcessTreeRssBytes: process.resourceUsage().maxRSS * 1_024,
    hardware: {
      platform: process.platform,
      architecture: process.arch,
      cpuModel: cpus()[0]?.model ?? "unknown",
      logicalCpus: cpus().length,
      totalMemoryBytes: totalmem()
    },
    interruption: "none",
    boundPlusOne
  })
)
