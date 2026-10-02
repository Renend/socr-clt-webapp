import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MathText from "@/components/MathText";

export interface LegendItem {
  label: string;
  color: string;
  kind: "dot" | "line" | "dashed" | "bar";
}

const Swatch: React.FC<Omit<LegendItem, "label">> = ({ color, kind }) => {
  switch (kind) {
    case "dot":
      return <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />;
    case "bar":
      return <span className="inline-block h-3 w-3 rounded-sm" style={{ background: color }} />;
    case "line":
      return <span className="inline-block h-0.5 w-5" style={{ background: color }} />;
    case "dashed":
      return <span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: color }} />;
  }
};

interface ChartCardProps {
  title: string;
  description?: React.ReactNode;
  legend?: LegendItem[];
  // Shows a hint over the chart until there is data to plot
  empty?: boolean;
  children: React.ReactNode;
}

const ChartCard: React.FC<ChartCardProps> = ({ title, description, legend, empty, children }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-lg">
        <MathText text={title} />
      </CardTitle>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {legend && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-slate-700">
          {legend.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5">
              <Swatch color={item.color} kind={item.kind} />
              <MathText text={item.label} />
            </span>
          ))}
        </div>
      )}
    </CardHeader>
    <CardContent className="relative">
      {children}
      {empty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-md bg-white/90 px-3 py-1.5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
            Press Play to start drawing samples
          </span>
        </div>
      )}
    </CardContent>
  </Card>
);

export default ChartCard;
