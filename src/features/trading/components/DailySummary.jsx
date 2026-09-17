import React from 'react';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';

export default function DailySummary({ today, daily }) {
  const history = [...(daily || [])].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 7);

  return (
    <div className="bg-white rounded-2xl shadow-soft p-6 h-full flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <CalendarDaysIcon className="h-5 w-5 text-primary-500" />
        <h2 className="text-lg font-semibold text-neutral-800">Bilan du jour</h2>
      </div>

      {today && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-neutral-50 p-3">
            <div className="text-xs text-neutral-500">Trades</div>
            <div className="text-lg font-bold text-neutral-800">{today.trades}</div>
          </div>
          <div className="rounded-xl bg-neutral-50 p-3">
            <div className="text-xs text-neutral-500">Gagnants</div>
            <div className="text-lg font-bold text-green-600">{today.wins}</div>
          </div>
          <div className="rounded-xl bg-neutral-50 p-3">
            <div className="text-xs text-neutral-500">Perdants</div>
            <div className="text-lg font-bold text-rose-600">{today.losses}</div>
          </div>
        </div>
      )}

      {today && (
        <div className={`rounded-xl p-3 text-center font-semibold ${today.pnl_pct >= 0 ? 'bg-green-50 text-green-700' : 'bg-rose-50 text-rose-700'}`}>
          P&L aujourd'hui: {today.pnl_pct >= 0 ? '+' : ''}
          {today.pnl_pct.toFixed(2)}%
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-2">
          <div className="text-xs text-neutral-500 mb-2">7 derniers jours</div>
          <div className="space-y-1.5">
            {history.map((d) => (
              <div key={d.date} className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">{d.date}</span>
                <span className="text-neutral-400 text-xs">{d.trades} trade{d.trades > 1 ? 's' : ''}</span>
                <span className={`font-medium ${d.pnl_pct >= 0 ? 'text-green-600' : 'text-rose-600'}`}>
                  {d.pnl_pct >= 0 ? '+' : ''}
                  {d.pnl_pct.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
