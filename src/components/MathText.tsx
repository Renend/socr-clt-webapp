import React from "react";

// Combining macron (as in "X̄"). Most UI fonts position it badly, so it's drawn as a real overline instead.
const COMBINING_MACRON = "̄";

export interface TextSegment {
  text: string;
  bar: boolean;
}

// Split text into runs, marking characters that carried a combining macron
export function splitBars(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === COMBINING_MACRON) continue;
    const bar = chars[i + 1] === COMBINING_MACRON;
    const last = segments[segments.length - 1];
    if (last && last.bar === bar) last.text += chars[i];
    else segments.push({ text: chars[i], bar });
  }
  return segments;
}

// Renders a label, drawing "X̄"-style bars with CSS
const MathText: React.FC<{ text: React.ReactNode }> = ({ text }) => {
  if (typeof text !== "string") return <>{text}</>;
  return (
    <>
      {splitBars(text).map((s, i) =>
        s.bar ? (
          <span key={i} className="overline decoration-from-font">
            {s.text}
          </span>
        ) : (
          <React.Fragment key={i}>{s.text}</React.Fragment>
        )
      )}
    </>
  );
};

export default MathText;
