import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { ReferenceLine } from "recharts";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import SimulationControls from "@/components/SimulationControls";
import ChartCard from "@/components/ChartCard";
import StatsTable, { formatNumber as fmt } from "@/components/StatsTable";
import DensityHistogram from "@/components/DensityHistogram";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import ScatterCanvas from "@/components/ScatterCanvas";
import {
  parentDistributions,
  vecMean,
  vecCov,
  scaleMatrix,
  ellipsePoints,
  mahalanobis2,
  chiSq2Quantile,
  histogram,
  normalPdf,
  chiSq2Pdf,
  dot,
  quadForm,
  type Vec,
} from "@/lib/multivariate";

const initialSampleSize = 10;
const initialNumSamples = 1000;
const initialAnimationSpeed = 50;
const populationCloudSize = 3000;
const ellipseLevel = 0.95;
const histogramBins = 30;
const initialAngle = 45;
// χ²₂ histogram range; P(χ²₂ > 12) ≈ 0.25%
const chiSqMax = 12;

const COLORS = {
  population: "rgba(100, 116, 139, 0.25)",
  currentSample: "#f97316",
  means: "rgba(79, 70, 229, 0.45)",
  latestMean: "#f97316",
  ellipse: "#dc2626",
  meanBars: "#818cf8",
  direction: "#0f766e",
};

// Slider 1..100 → roughly 1.6 to 1300 samples per second
const samplesPerSecond = (speed: number) => 1.5 * Math.pow(1.07, speed);

const Multivariate = () => {
  const [distributionValue, setDistributionValue] = useState(parentDistributions[0].value);
  const [sampleSize, setSampleSize] = useState(initialSampleSize);
  const [numSamples, setNumSamples] = useState(initialNumSamples);
  const [animationSpeed, setAnimationSpeed] = useState(initialAnimationSpeed);
  const [isRunning, setIsRunning] = useState(false);
  const [angle, setAngle] = useState(initialAngle);
  // Sample data lives in refs (mutated in place); `count` triggers re-renders
  const [count, setCount] = useState(0);
  const meansRef = useRef<Vec[]>([]);
  const lastSampleRef = useRef<Vec[]>([]);

  const parent = parentDistributions.find((d) => d.value === distributionValue) ?? parentDistributions[0];

  const populationCloud = useMemo(
    () => Array.from({ length: populationCloudSize }, () => parent.sample()),
    [parent]
  );

  // CLT limit: sample mean ≈ N(μ, Σ/n)
  const theoryCov = useMemo(() => scaleMatrix(parent.cov, 1 / sampleSize), [parent, sampleSize]);
  const theorySd = [Math.sqrt(theoryCov[0][0]), Math.sqrt(theoryCov[1][1])];
  const r2 = chiSq2Quantile(ellipseLevel);
  const meansEllipse = useMemo(() => ellipsePoints(parent.mean, theoryCov, r2), [parent, theoryCov, r2]);

  // Zoom the means plot so its shape stays visible as it shrinks with n
  const meansDomain = [0, 1].map((i) => [
    parent.mean[i] - 4 * theorySd[i],
    parent.mean[i] + 4 * theorySd[i],
  ]) as [number, number][];

  const reset = useCallback(() => {
    setIsRunning(false);
    meansRef.current = [];
    lastSampleRef.current = [];
    setCount(0);
  }, []);

  // Means drawn with a different population or n would mix two different sampling distributions
  useEffect(() => {
    reset();
  }, [distributionValue, sampleSize, reset]);

  const drawOneSample = useCallback(() => {
    const sample = Array.from({ length: sampleSize }, () => parent.sample());
    lastSampleRef.current = sample;
    meansRef.current.push(vecMean(sample));
  }, [parent, sampleSize]);

  useEffect(() => {
    if (!isRunning) return;
    let frame: number;
    let last = performance.now();
    let pending = 1; // draw the first sample immediately
    const rate = samplesPerSecond(animationSpeed);

    const tick = (now: number) => {
      pending += ((now - last) / 1000) * rate;
      last = now;
      const k = Math.min(Math.floor(pending), numSamples - meansRef.current.length);
      pending -= Math.floor(pending);
      for (let i = 0; i < k; i++) drawOneSample();
      if (k > 0) setCount(meansRef.current.length);

      if (meansRef.current.length >= numSamples) {
        setIsRunning(false);
        toast.success(`Completed ${numSamples} samples of size ${sampleSize}`);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isRunning, animationSpeed, numSamples, sampleSize, drawOneSample]);

  const toggleSimulation = () => {
    // Play after a finished run starts a fresh one
    if (!isRunning && meansRef.current.length >= numSamples) {
      meansRef.current = [];
      setCount(0);
    }
    setIsRunning((prev) => !prev);
  };

  const stepOnce = () => {
    setIsRunning(false);
    if (meansRef.current.length >= numSamples) return;
    drawOneSample();
    setCount(meansRef.current.length);
  };

  const downloadData = () => {
    const rows = meansRef.current.map((m, i) => `${i + 1},${m[0]},${m[1]}`);
    const csv = ["sample,mean_x,mean_y", ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `clt2d_${parent.value}_n${sampleSize}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const means = meansRef.current;
  const lastSample = count > 0 ? lastSampleRef.current : [];
  const latestMean = means.length ? [means[means.length - 1]] : [];

  // Observed vs. theoretical summary of the sample means
  const observedMean = means.length ? vecMean(means) : null;
  const observedCov = means.length > 1 ? vecCov(means) : null;
  const fractionInside = means.length
    ? means.filter((m) => mahalanobis2(m, parent.mean, theoryCov) <= r2).length / means.length
    : null;
  const corr = (c: number[][]) => c[0][1] / Math.sqrt(c[0][0] * c[1][1]);

  const marginals = [0, 1].map((i) =>
    histogram(
      means.map((m) => m[i]),
      meansDomain[i][0],
      meansDomain[i][1],
      histogramBins,
      (x) => normalPdf(x, parent.mean[i], theorySd[i])
    )
  );

  // Projection onto direction a = (cos θ, sin θ): by the CLT, aᵀX̄ ≈ N(aᵀμ, aᵀΣa / n)
  const theta = (angle * Math.PI) / 180;
  const direction = [Math.cos(theta), Math.sin(theta)];
  const projMean = dot(direction, parent.mean);
  const projSd = Math.sqrt(quadForm(direction, theoryCov));
  const projDomain: [number, number] = [projMean - 4 * projSd, projMean + 4 * projSd];
  const projection = histogram(
    means.map((m) => dot(direction, m)),
    projDomain[0],
    projDomain[1],
    histogramBins,
    (x) => normalPdf(x, projMean, projSd)
  );
  // Long enough to cross the whole zoomed-in means plot
  const reach = 10 * Math.max(...theorySd);
  const directionLine = [-1, 1].map((s) => [parent.mean[0] + s * reach * direction[0], parent.mean[1] + s * reach * direction[1]]);

  // Squared Mahalanobis distance of each mean from μ: ≈ χ² with 2 degrees of freedom
  const distances = means.map((m) => mahalanobis2(m, parent.mean, theoryCov));
  const chiSq = histogram(distances, 0, chiSqMax, histogramBins, chiSq2Pdf);

  const projObserved = means.length > 1 ? means.map((m) => dot(direction, m)) : null;
  const projObservedSd = projObserved
    ? Math.sqrt(vecCov(projObserved.map((v) => [v]))[0][0])
    : null;

  const statsRows = [
    { label: "Mean of X̄₁", theory: parent.mean[0], observed: observedMean?.[0] },
    { label: "Mean of X̄₂", theory: parent.mean[1], observed: observedMean?.[1] },
    { label: "Var(X̄₁)  = Σ₁₁ / n", theory: theoryCov[0][0], observed: observedCov?.[0][0] },
    { label: "Var(X̄₂)  = Σ₂₂ / n", theory: theoryCov[1][1], observed: observedCov?.[1][1] },
    { label: "Corr(X̄₁, X̄₂)", theory: corr(parent.cov), observed: observedCov ? corr(observedCov) : null },
    { label: `SD along the ${angle}° direction  = √(aᵀΣa / n)`, theory: projSd, observed: projObservedSd },
    {
      label: `Share inside the ${ellipseLevel * 100}% ellipse`,
      theory: ellipseLevel,
      observed: fractionInside,
    },
  ];

  const subscript = ["₁", "₂"];

  return (
    <AppShell
      title="Multivariate Central Limit Theorem (2D)"
      subtitle="The same idea in two dimensions: average samples of 2D points. Whatever the population's shape, the mean vectors form a bivariate normal cloud centred at μ with covariance Σ/n."
    >
      <details className="group rounded-lg border bg-white px-5 py-3 text-sm text-slate-700 shadow-sm">
        <summary className="cursor-pointer select-none font-medium text-slate-900">What am I looking at?</summary>
        <div className="mt-3 space-y-3 max-w-3xl">
          <p>
            <strong>Same idea as the 1D page, but with points instead of numbers.</strong> On the 1D page, you average
            n numbers from a population and repeat. The averages form a bell curve, whatever the population looked like.
          </p>
          <p>
            Here, each data point has two numbers (X₁, X₂), like height and weight. Each sample grabs n random points
            from the population (<strong>left</strong>) and averages them into one point (<strong>right</strong>). Repeat
            that many times.
          </p>
          <p>
            <strong>The result:</strong> the averages always form an oval blob, the 2D version of a bell curve. That
            holds even when the population is a square, a ring or two separate clumps.
          </p>
          <p>
            <strong>The red ellipse</strong> is the CLT's prediction of where 95% of the averages will land. It is worked
            out from just three facts about the population: its centre, how spread out it is and which way it tilts.
            Every other detail of the population's shape stops mattering once you average.
          </p>
          <p>
            <strong>The charts further down</strong> show that 2D isn't a new theorem. Look at only the X₁ values of the
            averages, only the X₂ values, or any diagonal slice, and you get an ordinary 1D bell curve.
          </p>
          <p className="text-slate-500">
            Try this: pick <em>Ring</em> and press Play. Every data point is on the ring, but the averages pile up in the
            empty middle. Then pick <em>Two clusters</em> and move n from 2 up to 50. The averages start out lumpy and
            smooth into an oval.
          </p>
        </div>
      </details>

      <SimulationControls
        distributions={parentDistributions}
        distribution={distributionValue}
        distributionDescription={parent.description}
        onDistributionChange={setDistributionValue}
        sampleSize={sampleSize}
        onSampleSizeChange={setSampleSize}
        numSamples={numSamples}
        onNumSamplesChange={setNumSamples}
        speed={animationSpeed}
        onSpeedChange={setAnimationSpeed}
        samplesPerSecond={samplesPerSecond(animationSpeed)}
        count={count}
        isRunning={isRunning}
        onToggle={toggleSimulation}
        onStep={stepOnce}
        onReset={reset}
        onDownload={downloadData}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Population"
          description="Every grey dot is one possible data point. Each sample picks some of these at random and averages them into one point on the right."
          legend={[
            { label: "Population", color: "#94a3b8", kind: "dot" },
            { label: `Current sample (${sampleSize} points)`, color: COLORS.currentSample, kind: "dot" },
          ]}
        >
          <ScatterCanvas
            layers={[
              { points: populationCloud, color: COLORS.population, radius: 1.8 },
              { points: lastSample, color: COLORS.currentSample, radius: 3.5 },
            ]}
            xDomain={parent.domain[0]}
            yDomain={parent.domain[1]}
            xLabel="X₁"
            equalAspect
            yLabel="X₂"
          />
        </ChartCard>

        <ChartCard
          title="Sample means (X̄₁, X̄₂)"
          description="One point per sample: the average of its points. The CLT predicts 95% of these land inside the red ellipse, which is worked out from just the population's centre, spread and tilt. The axes zoom with n, so the ellipse stays the same size on screen."
          legend={[
            { label: "Sample means", color: "#4f46e5", kind: "dot" },
            { label: "Latest mean", color: COLORS.latestMean, kind: "dot" },
            { label: "CLT prediction: 95% ellipse of N(μ, Σ/n)", color: COLORS.ellipse, kind: "line" },
            { label: `Projection direction (${angle}°)`, color: COLORS.direction, kind: "dashed" },
          ]}
          empty={count === 0}
        >
          <ScatterCanvas
            layers={[
              { points: means, color: COLORS.means, radius: 2 },
              { points: latestMean, color: COLORS.latestMean, radius: 5 },
            ]}
            curves={[
              { points: directionLine, color: COLORS.direction, dashed: true, width: 1.5 },
              { points: meansEllipse, color: COLORS.ellipse },
            ]}
            xDomain={meansDomain[0]}
            yDomain={meansDomain[1]}
            xLabel="X̄₁"
            equalAspect
            yLabel="X̄₂"
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {marginals.map((data, i) => (
          <ChartCard
            key={i}
            title={`Marginal of X̄${subscript[i]}`}
            description={`One coordinate of the sample means on its own. This is the ordinary 1D CLT: the predicted curve is N(${fmt(parent.mean[i], 3)}, ${fmt(theorySd[i], 3)}²).`}
            legend={[
              { label: `X̄${subscript[i]} of each sample`, color: COLORS.meanBars, kind: "bar" },
              { label: "CLT prediction", color: COLORS.ellipse, kind: "line" },
            ]}
            empty={count === 0}
          >
            <DensityHistogram
              data={data}
              xDomain={meansDomain[i]}
              xLabel={`X̄${subscript[i]}`}
              curvePeak={normalPdf(0, 0, theorySd[i])}
              barColor={COLORS.meanBars}
              curveColor={COLORS.ellipse}
            />
          </ChartCard>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Projection onto any direction"
          description={
            <>
              Project each mean onto the dashed direction in the sample-means plot. The multivariate CLT says every such
              projection is normal (the Cramér–Wold theorem); the two marginals above are just 0° and 90°. Predicted:
              N({fmt(projMean, 3)}, {fmt(projSd, 3)}²).
            </>
          }
          legend={[
            { label: "Projected sample means", color: COLORS.meanBars, kind: "bar" },
            { label: "CLT prediction", color: COLORS.ellipse, kind: "line" },
          ]}
          empty={count === 0}
        >
          <div className="mb-4">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="angle">Direction angle</Label>
              <span className="text-sm font-semibold tabular-nums">{angle}°</span>
            </div>
            <Slider id="angle" value={[angle]} min={0} max={179} step={1} className="mt-3" onValueChange={(v) => setAngle(v[0])} />
          </div>
          <DensityHistogram
            data={projection}
            xDomain={projDomain}
            xLabel={`aᵀX̄ with a = (cos ${angle}°, sin ${angle}°)`}
            curvePeak={normalPdf(0, 0, projSd)}
            barColor={COLORS.meanBars}
            curveColor={COLORS.ellipse}
            height={200}
          />
        </ChartCard>

        <ChartCard
          title="Distance from the centre"
          description={
            <>
              Squared Mahalanobis distance of each mean from μ, which accounts for the ellipse's shape. If the means are
              bivariate normal, these follow a χ² distribution with 2 degrees of freedom. This check still works in 3D
              and beyond, where the cloud can't be drawn.
            </>
          }
          legend={[
            { label: "Distances of sample means", color: COLORS.meanBars, kind: "bar" },
            { label: "χ²₂ prediction", color: COLORS.ellipse, kind: "line" },
            { label: "Edge of the 95% ellipse", color: "#334155", kind: "dashed" },
          ]}
          empty={count === 0}
        >
          <DensityHistogram
            data={chiSq}
            xDomain={[0, chiSqMax]}
            xLabel="Squared distance  (X̄ − μ)ᵀ (Σ/n)⁻¹ (X̄ − μ)"
            curvePeak={chiSq2Pdf(0)}
            barColor={COLORS.meanBars}
            curveColor={COLORS.ellipse}
            height={266}
          >
            <ReferenceLine x={r2} stroke="#334155" strokeDasharray="5 4" />
          </DensityHistogram>
        </ChartCard>
      </div>

      <StatsTable rows={statsRows} />
    </AppShell>
  );
};

export default Multivariate;
