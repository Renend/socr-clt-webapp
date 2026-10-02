import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Pause, RotateCcw, Download, StepForward } from "lucide-react";

interface SliderFieldProps {
  id: string;
  label: string;
  display: React.ReactNode;
  hint?: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

const SliderField: React.FC<SliderFieldProps> = ({ id, label, display, hint, value, min, max, step, onChange }) => (
  <div>
    <div className="flex items-baseline justify-between gap-2">
      <Label htmlFor={id}>{label}</Label>
      <span className="text-sm font-semibold tabular-nums">{display}</span>
    </div>
    <Slider id={id} value={[value]} min={min} max={max} step={step} className="mt-4" onValueChange={(v) => onChange(v[0])} />
    {hint && <p className="mt-3 text-sm text-muted-foreground">{hint}</p>}
  </div>
);

interface SimulationControlsProps {
  distributions: { value: string; label: string }[];
  distribution: string;
  distributionDescription: string;
  onDistributionChange: (value: string) => void;
  sampleSize: number;
  onSampleSizeChange: (value: number) => void;
  numSamples: number;
  onNumSamplesChange: (value: number) => void;
  speed: number;
  onSpeedChange: (value: number) => void;
  samplesPerSecond: number;
  count: number;
  isRunning: boolean;
  onToggle: () => void;
  onStep: () => void;
  onReset: () => void;
  onDownload: () => void;
}

// Controls shared by the 1D and 2D simulation pages
const SimulationControls: React.FC<SimulationControlsProps> = (props) => {
  const finished = props.count >= props.numSamples;
  const playLabel = props.isRunning ? "Pause" : finished ? "Run again" : props.count > 0 ? "Resume" : "Play";

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <Label htmlFor="distribution">Population</Label>
            <Select value={props.distribution} onValueChange={props.onDistributionChange}>
              <SelectTrigger id="distribution" className="mt-2 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {props.distributions.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-2 text-sm text-muted-foreground">{props.distributionDescription}</p>
          </div>

          <SliderField
            id="sampleSize"
            label="Sample size (n)"
            display={props.sampleSize}
            hint={props.sampleSize === 1 ? "With n = 1 each 'mean' is a single draw, so the means look like the population." : "Values averaged into each sample mean."}
            value={props.sampleSize}
            min={1}
            max={100}
            step={1}
            onChange={props.onSampleSizeChange}
          />

          <SliderField
            id="numSamples"
            label="Number of samples"
            display={props.numSamples.toLocaleString()}
            hint="How many sample means to draw in one run."
            value={props.numSamples}
            min={100}
            max={5000}
            step={100}
            onChange={props.onNumSamplesChange}
          />

          <SliderField
            id="animationSpeed"
            label="Speed"
            display={`${Math.round(props.samplesPerSecond)}/s`}
            hint="Samples drawn per second."
            value={props.speed}
            min={1}
            max={100}
            step={1}
            onChange={props.onSpeedChange}
          />
        </div>

        <div className="flex flex-col gap-4 border-t pt-5 md:flex-row md:items-center">
          <div className="flex flex-wrap gap-2">
            <Button onClick={props.onToggle} className="min-w-[7.5rem]">
              {props.isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {playLabel}
            </Button>
            <Button variant="outline" onClick={props.onStep} disabled={finished}>
              <StepForward className="h-4 w-4" />
              Step
            </Button>
            <Button variant="outline" onClick={props.onReset} disabled={props.count === 0}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button variant="outline" onClick={props.onDownload} disabled={props.count === 0}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
          </div>
          <div className="flex flex-1 items-center gap-3">
            <Progress value={(100 * props.count) / props.numSamples} className="h-2" />
            <span className="whitespace-nowrap text-sm text-muted-foreground tabular-nums">
              {props.count.toLocaleString()} / {props.numSamples.toLocaleString()} samples
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SimulationControls;
