import React, { useEffect, useRef } from 'react';
import { createChart, AreaSeries } from 'lightweight-charts';

/**
 * Live-updating price chart. Renders the backend's rolling price_history
 * (real ticks in PAPER mode against live Binance market data, or real fills
 * in LIVE mode) as a moving area series.
 */
export default function PriceChart({ priceHistory, symbol }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: 'transparent' },
        textColor: '#52525b',
        fontFamily: 'Inter, sans-serif',
      },
      grid: {
        vertLines: { color: '#f4f4f5' },
        horzLines: { color: '#f4f4f5' },
      },
      rightPriceScale: { borderColor: '#e4e4e7' },
      timeScale: { borderColor: '#e4e4e7', timeVisible: true, secondsVisible: true },
      crosshair: { mode: 0 },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#0ea5e9',
      topColor: 'rgba(14, 165, 233, 0.35)',
      bottomColor: 'rgba(14, 165, 233, 0.02)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    lastTimeRef.current = 0;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !priceHistory || priceHistory.length === 0) return;

    const points = [];
    for (const point of priceHistory) {
      const t = Math.floor(point.time);
      if (t <= lastTimeRef.current) continue;
      lastTimeRef.current = t;
      points.push({ time: t, value: point.price });
    }
    if (points.length === 0) return;

    if (points.length > 1) {
      series.setData(points);
    } else {
      series.update(points[0]);
    }
    chartRef.current?.timeScale().scrollToRealTime();
  }, [priceHistory]);

  const hasData = priceHistory && priceHistory.length > 0;

  return (
    <div className="relative w-full h-full">
      {!hasData && (
        <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-sm">
          En attente des premières données de prix ({symbol})...
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
