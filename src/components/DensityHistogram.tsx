import React from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { niceCeil, niceTicks, type HistogramBin } from "@/lib/multivariate";
import { formatNumber as fmt } from "@/components/StatsTable";
import MathText from "@/components/MathText";

interface DensityHistogramProps {
  data: HistogramBin[];
  xDomain: [number, number];
  xLabel: string;
  // Height of the theoretical curve's peak; keeps the y-axis steady while bars fill in
  curvePeak: number;
  barColor: string;
  curveColor: string;
  height?: number;
  // Extra Recharts elements (reference lines etc.) drawn on top
  children?: React.ReactNode;
}

const Y_TICK_COUNT = 4;
const X_LABEL_HEIGHT = 28;

// Histogram (density scale) of simulated values with the theoretical density curve overlaid
const DensityHistogram: React.FC<DensityHistogramProps> = ({
  data,
  xDomain,
  xLabel,
  curvePeak,
  barColor,
  curveColor,
  height = 240,
  children,
}) => {
  const yMax = niceCeil(Math.max(curvePeak * 1.15, ...data.map((b) => b.density)), Y_TICK_COUNT);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height={height - X_LABEL_HEIGHT}>
        <ComposedChart data={data} barCategoryGap={1} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="x"
            type="number"
            domain={xDomain}
            ticks={niceTicks(xDomain[0], xDomain[1])}
            tickFormatter={(v) => fmt(v, 3)}
            height={24}
          />
          <YAxis
            domain={[0, yMax]}
            ticks={niceTicks(0, yMax, Y_TICK_COUNT)}
            // Our ticks are already spaced; don't let Recharts drop some on short charts
            interval={0}
            tickFormatter={(v) => fmt(v, 3)}
            width={52}
            label={{ value: "Density", angle: -90, position: "insideLeft", offset: 10 }}
          />
          <Bar dataKey="density" fill={barColor} isAnimationActive={false} />
          <Line dataKey="theory" stroke={curveColor} strokeWidth={2} dot={false} isAnimationActive={false} />
          {children}
        </ComposedChart>
      </ResponsiveContainer>
      {/* HTML rather than an SVG axis label, so "X̄" bars render reliably */}
      <div className="pl-[52px] text-center text-sm text-slate-500" style={{ lineHeight: `${X_LABEL_HEIGHT}px` }}>
        <MathText text={xLabel} />
      </div>
    </div>
  );
};

export default DensityHistogram;
