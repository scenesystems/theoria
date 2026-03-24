/**
 * Inverse error function and inverse complementary error function kernels.
 *
 * Uses rational polynomial approximations from Boost.Math (John Maddock,
 * 2006) based on J.M. Blair, C.A. Edwards & J.H. Johnson, "Rational
 * Chebyshev Approximations for the Inverse of the Error Function",
 * Math. Comp., 30, 1976.
 *
 * Five piecewise regions cover the full domain with ~10⁻¹⁸ accuracy.
 * Boost Software License 1.0 applies to the coefficient tables.
 *
 * @since 0.1.0
 * @category internal
 */
import { Chunk, Number as N } from "effect"

/**
 * Evaluate polynomial via Horner's method. Coefficients are ordered
 * lowest-degree-first: [c₀, c₁, c₂, …] → c₀ + c₁t + c₂t² + …
 *
 * Horner processes from highest to lowest, so we reverse first.
 *
 * @since 0.1.0
 * @category internal
 */
const evalPoly = (coeffs: Chunk.Chunk<number>, t: number): number =>
  Chunk.reduce(Chunk.reverse(coeffs), 0, (acc, c) => N.sum(N.multiply(acc, t), c))

// ---------------------------------------------------------------------------
// Region 1: p ≤ 0.5 — result = g * (Y + R(p)) where g = p(p+10)
// ---------------------------------------------------------------------------

const Y1 = 0.089131474494934082

const P1: Chunk.Chunk<number> = Chunk.fromIterable([
  -0.00050878194965828065,
  -0.0083687481974173677,
  0.033480662540974461,
  -0.012692614766297404,
  -0.036563797141176267,
  0.021987868111116891,
  0.0082268787467691569,
  -0.0053877296507124292
])

const Q1: Chunk.Chunk<number> = Chunk.fromIterable([
  1,
  -0.97000504330329063,
  -1.5657455823417585,
  1.5622155839842302,
  0.66232884047200302,
  -0.71228902341542844,
  -0.05273963823400997,
  0.079528368734157168,
  -0.0023339375937419002,
  0.00088621639045642468
])

// ---------------------------------------------------------------------------
// Region 2: q ≥ 0.25 — result = g / (Y + R(xs))
//   where g = sqrt(-2 log(q)), xs = q - 0.25
// ---------------------------------------------------------------------------

const Y2 = 2.249481201171875

const P2: Chunk.Chunk<number> = Chunk.fromIterable([
  -0.20243350835593876,
  0.10526468069939171,
  8.3705032834311996,
  17.644729840837403,
  -18.851064805871424,
  -44.638232444178698,
  17.445385985570866,
  21.129465544834051,
  -3.6719225470772936
])

const Q2: Chunk.Chunk<number> = Chunk.fromIterable([
  1,
  6.2426412485424754,
  3.9713437953343869,
  -28.660818049980001,
  -20.14326346804852,
  48.560921310873994,
  10.826866735546016,
  -22.643693341313973,
  1.7211476576120028
])

// ---------------------------------------------------------------------------
// Region 3a: x < 3 (where x = sqrt(-log(q)))
//   result = x * (Y + R(xs)), xs = x - 1.125
// ---------------------------------------------------------------------------

const Y3A = 0.807220458984375

const P3A: Chunk.Chunk<number> = Chunk.fromIterable([
  -0.1311027816799519,
  -0.16379404719331705,
  0.11703015634199525,
  0.38707973897260434,
  0.33778553891203589,
  0.14286953440815717,
  0.029015791000532906,
  0.0021455899538880526,
  -6.7946557518112632e-7,
  2.8522533178221704e-8,
  -6.8114995685377697e-10
])

const Q3A: Chunk.Chunk<number> = Chunk.fromIterable([
  1,
  3.4662540724256723,
  5.3816834570700687,
  4.778465929458438,
  2.5930192162362027,
  0.84885434345790201,
  0.15226433829533179,
  0.011059242293464892
])

// ---------------------------------------------------------------------------
// Region 3b: x < 6, xs = x - 3
// ---------------------------------------------------------------------------

const Y3B = 0.93995571136474609

const P3B: Chunk.Chunk<number> = Chunk.fromIterable([
  -0.0350353787183178,
  -0.0022242652921344794,
  0.018557330651423107,
  0.0095080470132591962,
  0.0018712349281955923,
  0.00015754461742496055,
  0.0000046046989058431797,
  -2.3040477691188261e-10,
  2.6633922742578204e-12
])

const Q3B: Chunk.Chunk<number> = Chunk.fromIterable([
  1,
  1.3653349817554064,
  0.76205916455362344,
  0.22009110576413124,
  0.03415891436709477,
  0.0026386167665701601,
  0.000076467529230279444
])

// ---------------------------------------------------------------------------
// Region 3c: x < 18, xs = x - 6
// ---------------------------------------------------------------------------

const Y3C = 0.98362827301025391

const P3C: Chunk.Chunk<number> = Chunk.fromIterable([
  -0.016743100507663373,
  -0.0011295143874558028,
  0.001056288621524929,
  0.00020938631748758808,
  0.000014962478375834237,
  4.4969678992770644e-7,
  4.6259616352287857e-9,
  -2.8112873562883179e-14,
  9.9055709973310331e-17
])

const Q3C: Chunk.Chunk<number> = Chunk.fromIterable([
  1,
  0.59142934488641752,
  0.13815186574908331,
  0.016074608709367652,
  0.00096401180700516557,
  0.000027533547476472603,
  2.8224317201610801e-7
])

// ---------------------------------------------------------------------------
// Region 3d: x < 44, xs = x - 18
// ---------------------------------------------------------------------------

const Y3D = 0.99714565277099609

const P3D: Chunk.Chunk<number> = Chunk.fromIterable([
  -0.0024978212791898131,
  -0.0000077919071922905396,
  0.000025472303741302746,
  0.0000016239777734251093,
  3.9634101130480117e-8,
  4.1163283119094419e-10,
  1.4559628671867504e-12,
  -1.1676501239718427e-18
])

const Q3D: Chunk.Chunk<number> = Chunk.fromIterable([
  1,
  0.20712311221442251,
  0.01694108381209759,
  0.00069053826562268464,
  0.000014500735981823264,
  1.4443775662814415e-7,
  5.0976127659977847e-10
])

// ---------------------------------------------------------------------------
// Region 3e: x >= 44, xs = x - 44
// ---------------------------------------------------------------------------

const Y3E = 0.99941349029541016

const P3E: Chunk.Chunk<number> = Chunk.fromIterable([
  -0.00053904291101907853,
  -2.8398759004727723e-7,
  8.994651148922914e-7,
  2.2934585926592085e-8,
  2.2556144486350015e-10,
  9.478466275030226e-13,
  1.3588013010892486e-15,
  -3.4889039339994887e-22
])

const Q3E: Chunk.Chunk<number> = Chunk.fromIterable([
  1,
  0.084574623400189938,
  0.002820929847262647,
  0.000046829292194089421,
  3.999688121938621e-7,
  1.6180929088790448e-9,
  2.315586083102596e-12
])

/**
 * Core erfinv implementation operating on p ∈ [0, 1] and q = 1 − p.
 * Delegates to the appropriate piecewise rational approximation.
 *
 * @since 0.1.0
 * @category internal
 */
const erfinvCore = (p: number, q: number): number => {
  if (p <= 0.5) {
    const g = N.multiply(p, N.sum(p, 10))
    const r = evalPoly(P1, p) / evalPoly(Q1, p)
    return N.multiply(g, N.sum(Y1, r))
  }

  if (q >= 0.25) {
    const g = Math.sqrt(N.multiply(-2, Math.log(q)))
    const xs = N.subtract(q, 0.25)
    const r = evalPoly(P2, xs) / evalPoly(Q2, xs)
    return g / N.sum(Y2, r)
  }

  const x = Math.sqrt(N.negate(Math.log(q)))

  if (x < 3) {
    const xs = N.subtract(x, 1.125)
    const r = evalPoly(P3A, xs) / evalPoly(Q3A, xs)
    return N.multiply(x, N.sum(Y3A, r))
  }

  if (x < 6) {
    const xs = N.subtract(x, 3)
    const r = evalPoly(P3B, xs) / evalPoly(Q3B, xs)
    return N.multiply(x, N.sum(Y3B, r))
  }

  if (x < 18) {
    const xs = N.subtract(x, 6)
    const r = evalPoly(P3C, xs) / evalPoly(Q3C, xs)
    return N.multiply(x, N.sum(Y3C, r))
  }

  if (x < 44) {
    const xs = N.subtract(x, 18)
    const r = evalPoly(P3D, xs) / evalPoly(Q3D, xs)
    return N.multiply(x, N.sum(Y3D, r))
  }

  const xs = N.subtract(x, 44)
  const r = evalPoly(P3E, xs) / evalPoly(Q3E, xs)
  return N.multiply(x, N.sum(Y3E, r))
}

/**
 * erfinv(x) — inverse of the error function.
 *
 * Returns y such that erf(y) = x.
 * - Returns 0 for x = 0
 * - Returns ±Infinity for x = ±1
 * - Returns NaN for |x| > 1
 *
 * @since 0.1.0
 * @category internal
 */
export const erfinvKernel = (x: number): number => {
  if (x === 0) return 0
  if (x === 1) return Infinity
  if (x === -1) return -Infinity
  if (x < -1 || x > 1) return NaN

  const sign = x < 0 ? -1 : 1
  const p = Math.abs(x)
  const q = N.subtract(1, p)

  return N.multiply(sign, erfinvCore(p, q))
}

/**
 * erfcinv(x) — inverse of the complementary error function.
 *
 * Returns y such that erfc(y) = x, computed as erfinv(1 − x).
 *
 * @since 0.1.0
 * @category internal
 */
export const erfcinvKernel = (x: number): number => erfinvKernel(N.subtract(1, x))
