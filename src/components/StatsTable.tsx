import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MathText from "@/components/MathText";

export interface StatsRow {
  label: React.ReactNode;
  theory: number;
  observed: number | null | undefined;
}

export const formatNumber = (v: number | null | undefined, digits = 4) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : Number(v.toPrecision(digits)).toString();

const StatsTable: React.FC<{ rows: StatsRow[] }> = ({ rows }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-lg">CLT prediction vs. simulation</CardTitle>
      <p className="text-sm text-muted-foreground">
        The observed values settle toward the prediction as more samples are drawn.
      </p>
    </CardHeader>
    <CardContent>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 font-medium">Quantity</th>
            <th className="py-2 text-right font-medium">CLT prediction</th>
            <th className="py-2 text-right font-medium">Observed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="py-2">
                <MathText text={row.label} />
              </td>
              <td className="py-2 text-right tabular-nums">{formatNumber(row.theory)}</td>
              <td className="py-2 text-right tabular-nums font-medium">{formatNumber(row.observed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </CardContent>
  </Card>
);

export default StatsTable;
