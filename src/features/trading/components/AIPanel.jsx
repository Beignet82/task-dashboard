import React from 'react';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, BoltIcon } from '@heroicons/react/24/outline';

function Gauge({ value, threshold }) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const oversold = value != null && value < threshold;
  return (
    <div>
      <div className="flex justify-between text-xs text-neutral-500 mb-1">
        <span>0</span>
        <span>Seuil survente: {threshold}</span>
        <span>100</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-neutral-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${oversold ? 'bg-green-600' : 'bg-primary-500'}`}
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-rose-500"
          style={{ left: `${threshold}%` }}
        />
      </div>
    </div>
  );
}

export default function AIPanel({ analysis, reasoning, inPosition, entryPrice, movingStopLoss, rsiThreshold = 30 }) {
  if (!analysis) {
    return (
      <div className="bg-white rounded-2xl shadow-soft p-6 h-full flex items-center justify-center text-neutral-400 text-sm">
        Analyse en cours...
      </div>
    );
  }

  const trendUp = analysis.ma_short > analysis.ma_long;

  return (
    <div className="bg-white rounded-2xl shadow-soft p-6 h-full flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <BoltIcon className="h-5 w-5 text-primary-500" />
        <h2 className="text-lg font-semibold text-neutral-800">Analyse de l'IA</h2>
      </div>

      <div>
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-sm font-medium text-neutral-600">RSI (14)</span>
          <span className="text-xl font-bold text-neutral-800">{analysis.rsi.toFixed(1)}</span>
        </div>
        <Gauge value={analysis.rsi} threshold={rsiThreshold} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-neutral-50 p-3">
          <div className="text-xs text-neutral-500 mb-1">MA courte (10)</div>
          <div className="text-base font-semibold text-neutral-800">{analysis.ma_short.toFixed(2)}</div>
        </div>
        <div className="rounded-xl bg-neutral-50 p-3">
          <div className="text-xs text-neutral-500 mb-1">MA longue (20)</div>
          <div className="text-base font-semibold text-neutral-800">{analysis.ma_long.toFixed(2)}</div>
        </div>
      </div>

      <div className={`flex items-center gap-2 rounded-xl p-3 ${trendUp ? 'bg-green-50 text-green-700' : 'bg-rose-50 text-rose-700'}`}>
        {trendUp ? <ArrowTrendingUpIcon className="h-5 w-5" /> : <ArrowTrendingDownIcon className="h-5 w-5" />}
        <span className="text-sm font-medium">{trendUp ? 'Tendance haussière (MA10 > MA20)' : 'Pas de tendance haussière'}</span>
      </div>

      {inPosition && (
        <div className="rounded-xl bg-primary-50 p-3 text-sm text-primary-800 space-y-1">
          <div className="font-medium">En position</div>
          <div>Entrée: {entryPrice?.toFixed(2)} $</div>
          <div>Stop (trailing): {movingStopLoss?.toFixed(2)} $</div>
        </div>
      )}

      <div className="mt-auto text-xs text-neutral-500 border-t border-neutral-100 pt-3">
        {reasoning}
      </div>
    </div>
  );
}
