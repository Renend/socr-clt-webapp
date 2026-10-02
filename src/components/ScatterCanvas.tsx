import React, { useEffect, useRef, useState } from "react";
import { niceTicks, type Vec } from "@/lib/multivariate";
import { splitBars } from "@/components/MathText";

export interface PointLayer {
  points: Vec[];
  color: string;
  radius: number;
}

export interface CurveLayer {
  points: Vec[];
  color: string;
  dashed?: boolean;
  width?: number;
}

interface ScatterCanvasProps {
  layers: PointLayer[];
  curves?: CurveLayer[];
  xDomain: [number, number];
  yDomain: [number, number];
  xLabel: string;
  yLabel: string;
  height?: number;
  // Use the same scale on both axes so shapes (circles, correlation) aren't distorted
  equalAspect?: boolean;
}

const MARGIN = { top: 12, right: 16, bottom: 42, left: 52 };

const formatTick = (t: number) => Number(t.toPrecision(4)).toString();

// fillText centred on x, drawing "X̄"-style bars as real lines rather than relying on the font
function fillLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  const segments = splitBars(text);
  const total = segments.reduce((w, s) => w + ctx.measureText(s.text).width, 0);
  ctx.save();
  ctx.textAlign = "left";
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = 1;
  let cursor = x - total / 2;
  for (const s of segments) {
    const m = ctx.measureText(s.text);
    ctx.fillText(s.text, cursor, y);
    if (s.bar) {
      const top = Math.round(y - m.actualBoundingBoxAscent - 2) + 0.5;
      ctx.beginPath();
      ctx.moveTo(cursor + 0.5, top);
      ctx.lineTo(cursor + m.width - 0.5, top);
      ctx.stroke();
    }
    cursor += m.width;
  }
  ctx.restore();
}

// Canvas scatter plot: SVG charts slow down badly with thousands of points
const ScatterCanvas: React.FC<ScatterCanvasProps> = ({
  layers,
  curves = [],
  xDomain,
  yDomain,
  xLabel,
  yLabel,
  height = 360,
  equalAspect = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Redraw on every render; callers mutate point arrays in place and re-render to refresh
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const plotW = width - MARGIN.left - MARGIN.right;
    const plotH = height - MARGIN.top - MARGIN.bottom;
    if (equalAspect) {
      // Widen whichever domain is tighter (in data units per pixel) around its centre
      const unitsPerPx = Math.max((xDomain[1] - xDomain[0]) / plotW, (yDomain[1] - yDomain[0]) / plotH);
      const widen = (d: [number, number], px: number): [number, number] => {
        const mid = (d[0] + d[1]) / 2;
        return [mid - (unitsPerPx * px) / 2, mid + (unitsPerPx * px) / 2];
      };
      xDomain = widen(xDomain, plotW);
      yDomain = widen(yDomain, plotH);
    }
    const sx = (x: number) => MARGIN.left + ((x - xDomain[0]) / (xDomain[1] - xDomain[0])) * plotW;
    const sy = (y: number) => MARGIN.top + (1 - (y - yDomain[0]) / (yDomain[1] - yDomain[0])) * plotH;

    // Grid and tick labels
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const t of niceTicks(xDomain[0], xDomain[1])) {
      const x = sx(t);
      ctx.beginPath();
      ctx.moveTo(x, MARGIN.top);
      ctx.lineTo(x, MARGIN.top + plotH);
      ctx.stroke();
      ctx.fillText(formatTick(t), x, MARGIN.top + plotH + 6);
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const t of niceTicks(yDomain[0], yDomain[1])) {
      const y = sy(t);
      ctx.beginPath();
      ctx.moveTo(MARGIN.left, y);
      ctx.lineTo(MARGIN.left + plotW, y);
      ctx.stroke();
      ctx.fillText(formatTick(t), MARGIN.left - 6, y);
    }
    ctx.strokeStyle = "#94a3b8";
    ctx.strokeRect(MARGIN.left, MARGIN.top, plotW, plotH);

    // Axis titles
    ctx.fillStyle = "#334155";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    fillLabel(ctx, xLabel, MARGIN.left + plotW / 2, height - 4);
    ctx.save();
    ctx.translate(14, MARGIN.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = "middle";
    fillLabel(ctx, yLabel, 0, 0);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(MARGIN.left, MARGIN.top, plotW, plotH);
    ctx.clip();

    for (const layer of layers) {
      ctx.fillStyle = layer.color;
      for (const p of layer.points) {
        ctx.beginPath();
        ctx.arc(sx(p[0]), sy(p[1]), layer.radius, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    for (const curve of curves) {
      if (curve.points.length < 2) continue;
      ctx.strokeStyle = curve.color;
      ctx.lineWidth = curve.width ?? 2;
      ctx.setLineDash(curve.dashed ? [6, 4] : []);
      ctx.beginPath();
      curve.points.forEach((p, i) => (i === 0 ? ctx.moveTo(sx(p[0]), sy(p[1])) : ctx.lineTo(sx(p[0]), sy(p[1]))));
      ctx.stroke();
    }
    ctx.restore();
  });

  return (
    <div ref={containerRef} className="w-full">
      <canvas ref={canvasRef} style={{ width: "100%", height }} />
    </div>
  );
};

export default ScatterCanvas;
