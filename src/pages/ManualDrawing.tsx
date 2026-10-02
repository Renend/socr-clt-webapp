
import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ManualDistribution } from '@/lib/distributions';
import AppShell from '@/components/AppShell';
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/use-toast";

const ManualDrawing: React.FC = () => {
  const [manualDist] = useState<ManualDistribution>(new ManualDistribution());
  const [points, setPoints] = useState<[number, number][]>([]);
  const [samples, setSamples] = useState<number[]>([]);
  const [sampleSize, setSampleSize] = useState(100);
  const [smoothingFactor, setSmoothingFactor] = useState(5);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(600);
  const [canvasHeight, setCanvasHeight] = useState(300);
  const lastPointRef = useRef<[number, number] | null>(null);
  const { toast } = useToast();

  // Resize canvas based on container
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const parent = canvasRef.current.parentElement;
        if (parent) {
          setCanvasWidth(parent.clientWidth);
          setCanvasHeight(300); // Fixed height
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Draw the current distribution curve
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set coordinate system where (0,0) is bottom-left
    ctx.save();
    ctx.translate(0, canvas.height);
    ctx.scale(1, -1);
    
    // Draw axes
    ctx.beginPath();
    ctx.strokeStyle = '#aaa';
    ctx.moveTo(0, 0);
    ctx.lineTo(canvas.width, 0);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, canvas.height);
    ctx.stroke();
    
    // Draw curve
    if (points.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      
      // Convert data points to canvas coordinates
      const scaledPoints = points.map(([x, y]) => [
        (x - -3) / (3 - -3) * canvas.width, 
        y * (canvas.height * 0.8)
      ]);
      
      ctx.moveTo(scaledPoints[0][0], scaledPoints[0][1]);
      for (let i = 1; i < scaledPoints.length; i++) {
        ctx.lineTo(scaledPoints[i][0], scaledPoints[i][1]);
      }
      
      ctx.stroke();
      
      // Fill area under curve
      ctx.lineTo(scaledPoints[scaledPoints.length - 1][0], 0);
      ctx.lineTo(scaledPoints[0][0], 0);
      ctx.closePath();
      ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
      ctx.fill();
    }
    
    // Draw samples as points
    if (samples.length > 0) {
      ctx.fillStyle = 'rgba(220, 38, 38, 0.7)';
      samples.forEach(sample => {
        const x = (sample - -3) / (3 - -3) * canvas.width;
        ctx.beginPath();
        ctx.arc(x, 10, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    
    ctx.restore();
  }, [points, samples]);

  // Interpolate between two points using linear interpolation
  const interpolatePoints = (
    start: [number, number], 
    end: [number, number], 
    steps: number
  ): [number, number][] => {
    const interpolated: [number, number][] = [];
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = start[0] + t * (end[0] - start[0]);
      const y = start[1] + t * (end[1] - start[1]);
      interpolated.push([x, y]);
    }
    
    return interpolated;
  };

  // Handle mouse/touch events for drawing
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / canvas.width;
    const y = 1 - (e.clientY - rect.top) / canvas.height;
    
    // Convert to distribution space
    const xDist = -3 + x * 6; // Map [0,1] to [-3,3]
    const yDist = Math.max(0, y); // Ensure y is non-negative
    
    // Reset the manual distribution
    manualDist.clearPoints();
    setPoints([]);
    setSamples([]);
    
    // Add first point and update
    manualDist.addPoint(xDist, yDist);
    setPoints(manualDist.getPoints());
    
    // Save this point for interpolation
    lastPointRef.current = [xDist, yDist];
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPointRef.current) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / canvas.width;
    const y = 1 - (e.clientY - rect.top) / canvas.height;
    
    // Convert to distribution space
    const xDist = -3 + x * 6; // Map [0,1] to [-3,3]
    const yDist = Math.max(0, y); // Ensure y is non-negative
    
    const lastPoint = lastPointRef.current;
    
    // If points are too close, skip
    const distance = Math.sqrt(Math.pow(xDist - lastPoint[0], 2) + Math.pow(yDist - lastPoint[1], 2));
    if (distance < 0.03) return;
    
    // Interpolate between last point and current point
    const interpolated = interpolatePoints(
      lastPoint, 
      [xDist, yDist],
      Math.ceil(distance * smoothingFactor) // More points for smoother curves
    );
    
    // Add interpolated points
    for (let i = 1; i < interpolated.length; i++) {
      manualDist.addPoint(interpolated[i][0], interpolated[i][1]);
    }
    
    setPoints(manualDist.getPoints());
    lastPointRef.current = [xDist, yDist];
  };
  
  const handleMouseUp = () => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    lastPointRef.current = null;
    
    // Normalize the distribution
    manualDist.normalize();
    setPoints(manualDist.getPoints());
    
    if (points.length < 2) {
      toast({
        title: "Drawing incomplete",
        description: "Please draw more points to create a valid distribution.",
        variant: "destructive"
      });
    }
  };

  const generateSamples = () => {
    if (points.length < 2) {
      toast({
        title: "Drawing incomplete",
        description: "Please draw a complete distribution curve first.",
        variant: "destructive"
      });
      return;
    }
    
    const newSamples = Array.from({ length: sampleSize }, () => manualDist.sample());
    setSamples(newSamples);
    
    toast({
      title: "Samples generated",
      description: `Generated ${sampleSize} samples from your custom distribution.`
    });
  };

  const clearAll = () => {
    manualDist.clearPoints();
    setPoints([]);
    setSamples([]);
    lastPointRef.current = null;
    
    toast({
      title: "Canvas cleared",
      description: "The drawing has been cleared. Start drawing a new distribution."
    });
  };

  return (
    <AppShell
      title="Draw a Distribution"
      subtitle="Sketch any probability density with the mouse, then generate random samples from it."
    >

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Draw your distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="border border-gray-300 rounded-md p-2 mb-4"
              style={{ width: '100%', height: `${canvasHeight}px` }}
            >
              <canvas
                ref={canvasRef}
                width={canvasWidth}
                height={canvasHeight}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="cursor-crosshair"
              />
            </div>
            
            <div className="flex space-x-4">
              <Button onClick={clearAll} variant="destructive">Clear Canvas</Button>
              <Button onClick={generateSamples} disabled={points.length < 2}>
                Generate Samples
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sampleSize">Sample Size</Label>
                <Input
                  id="sampleSize"
                  type="number"
                  min="1"
                  max="10000"
                  value={sampleSize}
                  onChange={(e) => setSampleSize(parseInt(e.target.value) || 100)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="smoothing">Smoothing Factor</Label>
                <Slider
                  id="smoothing"
                  min={1}
                  max={20}
                  step={1}
                  value={[smoothingFactor]}
                  onValueChange={(value) => setSmoothingFactor(value[0])}
                />
                <p className="text-xs text-muted-foreground">
                  Higher values create smoother curves
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-medium">Instructions:</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Click and drag to draw your probability density function</li>
                  <li>The area under the curve will be automatically normalized</li>
                  <li>Click "Generate Samples" to create random samples</li>
                  <li>Red dots show the distribution of generated samples</li>
                </ul>
              </div>
              
              {samples.length > 0 && (
                <div className="pt-4 border-t">
                  <h3 className="font-medium mb-2">Sample Statistics:</h3>
                  <div className="text-sm">
                    <p>Sample Size: {samples.length}</p>
                    <p>Mean: {(samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(4)}</p>
                    <p>Min: {Math.min(...samples).toFixed(4)}</p>
                    <p>Max: {Math.max(...samples).toFixed(4)}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};

export default ManualDrawing;
