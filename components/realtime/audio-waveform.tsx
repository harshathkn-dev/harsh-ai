"use client";

import { useEffect, useRef } from "react";

export function AudioWaveform({
  stream,
  muted,
}: {
  stream: MediaStream | null;
  muted: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !stream) return;

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let animationFrame = 0;

    function draw() {
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;

      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
        canvas.width = width * ratio;
        canvas.height = height * ratio;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      analyser.getByteFrequencyData(data);

      const bars = 28;
      const gap = 3;
      const barWidth = Math.max(2, (width - gap * (bars - 1)) / bars);
      for (let index = 0; index < bars; index += 1) {
        const sample = muted ? 0 : data[Math.floor((index / bars) * data.length)];
        const barHeight = Math.max(3, (sample / 255) * (height - 4));
        const x = index * (barWidth + gap);
        const y = (height - barHeight) / 2;
        context.fillStyle = muted
          ? "rgba(148, 163, 184, 0.35)"
          : `rgba(101, 228, 196, ${0.35 + (sample / 255) * 0.65})`;
        context.beginPath();
        context.roundRect(x, y, barWidth, barHeight, barWidth / 2);
        context.fill();
      }

      animationFrame = window.requestAnimationFrame(draw);
    }

    draw();
    return () => {
      window.cancelAnimationFrame(animationFrame);
      source.disconnect();
      void audioContext.close();
    };
  }, [muted, stream]);

  return (
    <canvas
      aria-label={muted ? "Microphone muted" : "Live microphone activity"}
      className="h-16 w-full"
      ref={canvasRef}
    />
  );
}
