"use client";

import { useEffect, useRef, useState } from "react";

export function Waveform({ file }: { file: File }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(file.size > 50 * 1024 * 1024);

  useEffect(() => {
    if (fallback) return;
    let cancelled = false;
    let closing = false;
    const context = new AudioContext();
    const closeContext = () => {
      if (closing) return;
      closing = true;
      void context.close().catch(() => undefined);
    };
    void file.arrayBuffer()
      .then((buffer) => context.decodeAudioData(buffer))
      .then((audio) => {
        if (cancelled || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ratio = window.devicePixelRatio || 1;
        const width = Math.max(300, canvas.clientWidth * ratio);
        const height = Math.max(48, canvas.clientHeight * ratio);
        canvas.width = width;
        canvas.height = height;
        const drawing = canvas.getContext("2d");
        if (!drawing) return;
        const samples = audio.getChannelData(0);
        const bars = 120;
        const chunk = Math.max(1, Math.floor(samples.length / bars));
        drawing.clearRect(0, 0, width, height);
        drawing.fillStyle = "#7668f7";
        for (let index = 0; index < bars; index += 1) {
          let peak = 0;
          for (let sample = index * chunk; sample < Math.min(samples.length, (index + 1) * chunk); sample += Math.max(1, Math.floor(chunk / 80))) {
            peak = Math.max(peak, Math.abs(samples[sample]));
          }
          const barHeight = Math.max(2 * ratio, peak * height * 0.82);
          const x = (index / bars) * width;
          drawing.globalAlpha = 0.4 + peak * 0.6;
          drawing.fillRect(x, (height - barHeight) / 2, Math.max(1, width / bars - 2 * ratio), barHeight);
        }
      })
      .catch(() => setFallback(true))
      .finally(closeContext);
    return () => {
      cancelled = true;
      closeContext();
    };
  }, [fallback, file]);

  if (fallback) {
    return <div className="waveform-fallback" aria-label="Waveform preview unavailable">{Array.from({ length: 54 }, (_, index) => <i key={index} style={{ height: `${20 + ((index * 17) % 60)}%` }} />)}</div>;
  }
  return <canvas ref={canvasRef} className="waveform" aria-label="Audio waveform preview" />;
}
