import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { ComposedChart, Bar, Line, ReferenceDot, ReferenceLine, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import SimulationControls from "@/components/SimulationControls";
import ChartCard from "@/components/ChartCard";
import StatsTable, { formatNumber as fmt } from "@/components/StatsTable";
import { histogram, niceCeil, niceTicks, normalPdf } from "@/lib/multivariate";

// mean/sd are the exact population values, used for the CLT prediction N(μ, σ²/n)
const distributionOptions = [
  {
    value: 'normal',
    label: 'Normal',
    description: 'Normal with mean 0.5 and SD 0.1. Already bell-shaped, so the means are normal for every n.',
    mean: 0.5,
    sd: 0.1,
    domain: [0, 1] as [number, number],
  },
  {
    value: 'uniform',
    label: 'Uniform',
    description: 'Every value between 0 and 1 equally likely. Flat, with no peak at all.',
    mean: 0.5,
    sd: Math.sqrt(1 / 12),
    domain: [0, 1] as [number, number],
  },
  {
    value: 'exponential',
    label: 'Exponential',
    description: 'Exponential with rate 1. Strongly right-skewed, so small samples need a larger n to look normal.',
    mean: 1,
    sd: 1,
    domain: [0, 6] as [number, number],
  },
];

const initialSampleSize = 30;
const initialNumSamples = 1000;
const initialAnimationSpeed = 50;
const populationDrawSize = 20000;
const histogramBins = 40;
const Y_TICK_COUNT = 4;

const COLORS = {
  population: "#94a3b8",
  currentSample: "#f97316",
  means: "#818cf8",
  normalCurve: "#dc2626",
};

// Slider 1..100 → roughly 1.6 to 1300 samples per second
const samplesPerSecond = (speed: number) => 1.5 * Math.pow(1.07, speed);

const generateSample = (distribution: string, size: number): number[] => {
  let sample: number[] = [];
  switch (distribution) {
    case 'normal':
      sample = Array.from({ length: size }, () => randomNormal());
      break;
    case 'uniform':
      sample = Array.from({ length: size }, () => Math.random());
      break;
    case 'exponential':
      sample = Array.from({ length: size }, () => randomExponential(1));
      break;
    default:
      sample = Array.from({ length: size }, () => Math.random());
  }
  return sample;
};

// Function to generate a normal distribution random number
function randomNormal() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random(); //Converting [0,1) to (0,1)
  while (v === 0) v = Math.random();
  let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  num = num / 10.0 + 0.5; // Translate to 0 -> 1
  if (num > 1 || num < 0) return randomNormal() // resample between 0 and 1
  return num
}

// Function to generate an exponential distribution random number
function randomExponential(rate: number) {
  let u = Math.random();
  return -Math.log(u) / rate;
}

const Index = () => {
  const [selectedDistribution, setSelectedDistribution] = useState(distributionOptions[0].value);
  const [currentSampleSize, setCurrentSampleSize] = useState(initialSampleSize);
  const [currentNumSamples, setCurrentNumSamples] = useState(initialNumSamples);
  const [animationSpeed, setAnimationSpeed] = useState(initialAnimationSpeed);
  const [isRunning, setIsRunning] = useState(false);
  // Sample data lives in refs (mutated in place); `count` triggers re-renders
  const [count, setCount] = useState(0);
  const samplesRef = useRef<number[][]>([]);
  const meansRef = useRef<number[]>([]);

  const population = distributionOptions.find((d) => d.value === selectedDistribution) ?? distributionOptions[0];

  // A large draw from the population, shown as its histogram
  const populationHistogram = useMemo(() => {
    const draws = generateSample(population.value, populationDrawSize);
    return histogram(draws, population.domain[0], population.domain[1], histogramBins, (x) =>
      normalPdf(x, population.mean, population.sd)
    );
  }, [population]);
  const populationYMax = niceCeil(Math.max(...populationHistogram.map((b) => b.density)) * 1.05, Y_TICK_COUNT);

  // CLT prediction: sample means ≈ N(μ, σ²/n)
  const sdOfMean = population.sd / Math.sqrt(currentSampleSize);
  const meansDomain: [number, number] = [population.mean - 4 * sdOfMean, population.mean + 4 * sdOfMean];
  const normalPeak = 1 / (sdOfMean * Math.sqrt(2 * Math.PI));

  const resetSimulation = useCallback(() => {
    setIsRunning(false);
    samplesRef.current = [];
    meansRef.current = [];
    setCount(0);
  }, []);

  // Means from a different population or n belong to a different sampling distribution
  useEffect(() => {
    resetSimulation();
  }, [selectedDistribution, currentSampleSize, resetSimulation]);

  const drawOneSample = useCallback(() => {
    const sample = generateSample(selectedDistribution, currentSampleSize);
    samplesRef.current.push(sample);
    meansRef.current.push(sample.reduce((sum, val) => sum + val, 0) / sample.length);
  }, [selectedDistribution, currentSampleSize]);

  useEffect(() => {
    if (!isRunning) return;
    let frame: number;
    let last = performance.now();
    let pending = 1; // draw the first sample immediately
    const rate = samplesPerSecond(animationSpeed);

    const tick = (now: number) => {
      pending += ((now - last) / 1000) * rate;
      last = now;
      const k = Math.min(Math.floor(pending), currentNumSamples - meansRef.current.length);
      pending -= Math.floor(pending);
      for (let i = 0; i < k; i++) drawOneSample();
      if (k > 0) setCount(meansRef.current.length);

      if (meansRef.current.length >= currentNumSamples) {
        setIsRunning(false);
        toast.success(`Completed ${currentNumSamples} samples of size ${currentSampleSize}`);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isRunning, animationSpeed, currentNumSamples, currentSampleSize, drawOneSample]);

  const toggleSimulation = () => {
    // Play after a finished run starts a fresh one
    if (!isRunning && meansRef.current.length >= currentNumSamples) {
      samplesRef.current = [];
      meansRef.current = [];
      setCount(0);
    }
    setIsRunning((prev) => !prev);
  };

  const stepOnce = () => {
    setIsRunning(false);
    if (meansRef.current.length >= currentNumSamples) return;
    drawOneSample();
    setCount(meansRef.current.length);
  };

  const downloadData = () => {
    const rows = samplesRef.current.map((sample, i) => `${i + 1},"${sample.join(' ')}",${meansRef.current[i]}`);
    const csv = ["Sample,Values,Mean", ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "clt_simulation_data.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const means = meansRef.current;
  const currentSample = samplesRef.current[samplesRef.current.length - 1] ?? [];
  const currentMean = means[means.length - 1];
  const meansHistogram = histogram(means, meansDomain[0], meansDomain[1], histogramBins, (x) =>
    normalPdf(x, population.mean, sdOfMean)
  );
  // Scaled to the predicted curve's peak so the axis doesn't jump while bars fill in
  const meansYMax = niceCeil(Math.max(normalPeak * 1.15, ...meansHistogram.map((b) => b.density)), Y_TICK_COUNT);

  // Observed vs. predicted summary of the sample means
  const observedMean = means.length ? means.reduce((a, b) => a + b, 0) / means.length : null;
  const observedSd =
    means.length > 1 && observedMean !== null
      ? Math.sqrt(means.reduce((a, m) => a + (m - observedMean) ** 2, 0) / (means.length - 1))
      : null;
  const within95 = means.length
    ? means.filter((m) => Math.abs(m - population.mean) <= 1.96 * sdOfMean).length / means.length
    : null;

  return (
    <AppShell
      title="Central Limit Theorem"
      subtitle="Draw repeated samples from a population and average each one. Whatever the population's shape, the sample means pile up into a normal curve."
    >
      <SimulationControls
        distributions={distributionOptions}
        distribution={selectedDistribution}
        distributionDescription={population.description}
        onDistributionChange={setSelectedDistribution}
        sampleSize={currentSampleSize}
        onSampleSizeChange={setCurrentSampleSize}
        numSamples={currentNumSamples}
        onNumSamplesChange={setCurrentNumSamples}
        speed={animationSpeed}
        onSpeedChange={setAnimationSpeed}
        samplesPerSecond={samplesPerSecond(animationSpeed)}
        count={count}
        isRunning={isRunning}
        onToggle={toggleSimulation}
        onStep={stepOnce}
        onReset={resetSimulation}
        onDownload={downloadData}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Population"
          description="Each sample is drawn from this population and averaged into one sample mean."
          legend={[
            { label: "Population shape", color: COLORS.population, kind: "bar" },
            { label: `Current sample (${currentSampleSize} values)`, color: COLORS.currentSample, kind: "dot" },
            { label: "Its mean", color: COLORS.currentSample, kind: "line" },
          ]}
        >
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={populationHistogram} barCategoryGap={1} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="x"
                type="number"
                domain={population.domain}
                ticks={niceTicks(population.domain[0], population.domain[1])}
                tickFormatter={(v) => fmt(v, 3)}
                label={{ value: "Value", position: "insideBottom", offset: -4 }}
                height={44}
              />
              <YAxis
                domain={[0, populationYMax]}
                ticks={niceTicks(0, populationYMax, Y_TICK_COUNT)}
                tickFormatter={(v) => fmt(v, 3)}
                width={52}
                label={{ value: "Density", angle: -90, position: "insideLeft", offset: 10 }}
              />
              <Bar dataKey="density" fill={COLORS.population} isAnimationActive={false} />
              {/* Reference dots rather than a Scatter series, whose x-values would shrink the bar widths */}
              {currentSample.map((v, i) => (
                <ReferenceDot key={i} x={v} y={0} r={4} fill={COLORS.currentSample} stroke="white" ifOverflow="discard" />
              ))}
              {currentMean !== undefined && (
                <ReferenceLine x={currentMean} stroke={COLORS.currentSample} strokeWidth={2} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Distribution of sample means"
          description={`The x-axis zooms with n, so the predicted curve N(${fmt(population.mean, 3)}, ${fmt(sdOfMean, 3)}²) stays the same size on screen.`}
          legend={[
            { label: "Sample means so far", color: COLORS.means, kind: "bar" },
            { label: "CLT prediction", color: COLORS.normalCurve, kind: "line" },
            { label: "Latest mean", color: COLORS.currentSample, kind: "line" },
          ]}
          empty={count === 0}
        >
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={meansHistogram} barCategoryGap={1} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="x"
                type="number"
                domain={meansDomain}
                ticks={niceTicks(meansDomain[0], meansDomain[1])}
                tickFormatter={(v) => fmt(v, 3)}
                label={{ value: "Sample mean", position: "insideBottom", offset: -4 }}
                height={44}
              />
              <YAxis
                domain={[0, meansYMax]}
                ticks={niceTicks(0, meansYMax, Y_TICK_COUNT)}
                tickFormatter={(v) => fmt(v, 3)}
                width={52}
                label={{ value: "Density", angle: -90, position: "insideLeft", offset: 10 }}
              />
              <Bar dataKey="density" fill={COLORS.means} isAnimationActive={false} />
              <Line dataKey="theory" stroke={COLORS.normalCurve} strokeWidth={2} dot={false} isAnimationActive={false} />
              {currentMean !== undefined && (
                <ReferenceLine x={currentMean} stroke={COLORS.currentSample} strokeWidth={2} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <StatsTable
        rows={[
          { label: "Mean of the sample means (μ)", theory: population.mean, observed: observedMean },
          { label: "SD of the sample means (σ / √n)", theory: sdOfMean, observed: observedSd },
          { label: "Share within μ ± 1.96 σ/√n", theory: 0.95, observed: within95 },
        ]}
      />
    </AppShell>
  );
};

export default Index;
