// Sampling and statistics helpers for the multivariate (2D) CLT demo.
// Vectors are plain number arrays so the same code extends to d > 2 later.

export type Vec = number[];
export type Matrix = number[][];

export interface ParentDistribution {
  value: string;
  label: string;
  description: string;
  sample: () => Vec;
  // Exact population mean and covariance, used for the theoretical CLT limit
  mean: Vec;
  cov: Matrix;
  // Plot window for the population scatter
  domain: [[number, number], [number, number]];
}

// Standard normal via Box-Muller
export function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function randExp(rate: number): number {
  return -Math.log(1 - Math.random()) / rate;
}

// Ring radius ~ Uniform(RING_INNER, RING_OUTER), angle ~ Uniform(0, 2π)
const RING_INNER = 0.8;
const RING_OUTER = 1.0;
const ringR2 = (RING_INNER ** 2 + RING_INNER * RING_OUTER + RING_OUTER ** 2) / 3; // E[r²]

// Two equally weighted round clusters centred at ±CLUSTER_CENTER
const CLUSTER_CENTER = [1.5, 1];
const CLUSTER_SD = 0.3;

// Y = X + noise, X ~ Exp(1)
const SKEW_NOISE_SD = 0.5;

export const parentDistributions: ParentDistribution[] = [
  {
    value: "uniform-square",
    label: "Uniform on a square",
    description: "Every point in the unit square is equally likely. Flat, with sharp edges and corners.",
    sample: () => [Math.random(), Math.random()],
    mean: [0.5, 0.5],
    cov: [[1 / 12, 0], [0, 1 / 12]],
    domain: [[-0.1, 1.1], [-0.1, 1.1]],
  },
  {
    value: "ring",
    label: "Ring (donut)",
    description: "Points on a thin ring. The mean (0, 0) sits in the empty hole, where no data point can ever land.",
    sample: () => {
      const theta = 2 * Math.PI * Math.random();
      const r = RING_INNER + (RING_OUTER - RING_INNER) * Math.random();
      return [r * Math.cos(theta), r * Math.sin(theta)];
    },
    mean: [0, 0],
    cov: [[ringR2 / 2, 0], [0, ringR2 / 2]],
    domain: [[-1.3, 1.3], [-1.3, 1.3]],
  },
  {
    value: "two-clusters",
    label: "Two clusters",
    description: "A 50/50 mix of two separated groups. Bimodal, and correlated through the cluster positions.",
    sample: () => {
      const s = Math.random() < 0.5 ? -1 : 1;
      return [s * CLUSTER_CENTER[0] + CLUSTER_SD * randn(), s * CLUSTER_CENTER[1] + CLUSTER_SD * randn()];
    },
    mean: [0, 0],
    cov: [
      [CLUSTER_CENTER[0] ** 2 + CLUSTER_SD ** 2, CLUSTER_CENTER[0] * CLUSTER_CENTER[1]],
      [CLUSTER_CENTER[0] * CLUSTER_CENTER[1], CLUSTER_CENTER[1] ** 2 + CLUSTER_SD ** 2],
    ],
    domain: [[-2.6, 2.6], [-2, 2]],
  },
  {
    value: "skewed-correlated",
    label: "Skewed & correlated",
    description: "X ~ Exponential(1) and Y = X + noise. Strongly right-skewed with a long tail, and positively correlated.",
    sample: () => {
      const x = randExp(1);
      return [x, x + SKEW_NOISE_SD * randn()];
    },
    mean: [1, 1],
    cov: [[1, 1], [1, 1 + SKEW_NOISE_SD ** 2]],
    domain: [[-0.3, 5], [-1.5, 5.5]],
  },
];

export function vecMean(points: Vec[]): Vec {
  const d = points[0].length;
  const m = new Array(d).fill(0);
  for (const p of points) for (let i = 0; i < d; i++) m[i] += p[i];
  return m.map((s) => s / points.length);
}

// Sample covariance (n - 1 denominator)
export function vecCov(points: Vec[]): Matrix {
  const d = points[0].length;
  const m = vecMean(points);
  const c: Matrix = Array.from({ length: d }, () => new Array(d).fill(0));
  for (const p of points) {
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) c[i][j] += (p[i] - m[i]) * (p[j] - m[j]);
    }
  }
  const denom = Math.max(1, points.length - 1);
  return c.map((row) => row.map((v) => v / denom));
}

export function scaleMatrix(a: Matrix, k: number): Matrix {
  return a.map((row) => row.map((v) => v * k));
}

// Squared radius of the p-level ellipse of a bivariate normal: chi-square(2) quantile
export function chiSq2Quantile(p: number): number {
  return -2 * Math.log(1 - p);
}

// Points tracing {x : (x - mu)ᵀ cov⁻¹ (x - mu) = r²} for a 2x2 covariance
export function ellipsePoints(mu: Vec, cov: Matrix, r2: number, steps = 120): Vec[] {
  const [[a, b], [, c]] = cov;
  const half = (a + c) / 2;
  const disc = Math.sqrt(((a - c) / 2) ** 2 + b ** 2);
  const l1 = half + disc;
  const l2 = Math.max(0, half - disc);
  const theta = 0.5 * Math.atan2(2 * b, a - c);
  const r = Math.sqrt(r2);
  const cos = Math.cos(theta), sin = Math.sin(theta);
  const pts: Vec[] = [];
  for (let k = 0; k <= steps; k++) {
    const phi = (2 * Math.PI * k) / steps;
    const u = r * Math.sqrt(l1) * Math.cos(phi);
    const v = r * Math.sqrt(l2) * Math.sin(phi);
    pts.push([mu[0] + u * cos - v * sin, mu[1] + u * sin + v * cos]);
  }
  return pts;
}

// Squared Mahalanobis distance for 2D
export function mahalanobis2(x: Vec, mu: Vec, cov: Matrix): number {
  const [[a, b], [, c]] = cov;
  const det = a * c - b * b;
  const dx = x[0] - mu[0], dy = x[1] - mu[1];
  return (c * dx * dx - 2 * b * dx * dy + a * dy * dy) / det;
}

// Round axis tick positions covering [min, max]
export function niceTicks(min: number, max: number, count = 5): number[] {
  const rough = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const ticks: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max + step * 1e-9; t += step) {
    ticks.push(Number(t.toPrecision(10)));
  }
  return ticks;
}

// Smallest round axis limit ≥ v (e.g. 4.47 → 5)
export function niceCeil(v: number, count = 5): number {
  if (v <= 0) return 1;
  const ticks = niceTicks(0, v, count);
  const step = ticks.length > 1 ? ticks[1] - ticks[0] : v;
  const top = ticks[ticks.length - 1];
  return top >= v ? top : Number((top + step).toPrecision(10));
}

export function normalPdf(x: number, mu: number, sd: number): number {
  const z = (x - mu) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

// Density of the chi-square distribution with 2 degrees of freedom
export function chiSq2Pdf(x: number): number {
  return x < 0 ? 0 : 0.5 * Math.exp(-x / 2);
}

export function dot(a: Vec, b: Vec): number {
  return a.reduce((sum, v, i) => sum + v * b[i], 0);
}

// Variance of aᵀX when X has covariance `cov`
export function quadForm(a: Vec, cov: Matrix): number {
  return a.reduce((sum, ai, i) => sum + ai * dot(cov[i], a), 0);
}

export interface HistogramBin {
  x: number;
  density: number;
  theory: number;
}

// Density-scaled histogram over [lo, hi], with the theoretical density `pdf` at each bin centre
export function histogram(values: number[], lo: number, hi: number, bins: number, pdf: (x: number) => number): HistogramBin[] {
  const width = (hi - lo) / bins;
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    const k = Math.floor((v - lo) / width);
    if (k >= 0 && k < bins) counts[k]++;
  }
  return counts.map((count, k) => {
    const x = lo + (k + 0.5) * width;
    return {
      x,
      density: values.length ? count / (values.length * width) : 0,
      theory: pdf(x),
    };
  });
}
