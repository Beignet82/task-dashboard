import React from 'react';

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function TradeLog({ trades }) {
  const sorted = [...(trades || [])].sort((a, b) => new Date(b.time) - new Date(a.time));

  return (
    <div className="bg-white rounded-2xl shadow-soft p-6 h-full flex flex-col">
      <h2 className="text-lg font-semibold text-neutral-800 mb-4">Historique des trades</h2>
      {sorted.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm">
          Aucun trade pour l'instant
        </div>
      ) : (
        <div className="overflow-y-auto flex-1 -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-500 text-xs uppercase tracking-wide">
                <th className="px-2 py-2">Heure</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2 text-right">Prix</th>
                <th className="px-2 py-2 text-right">Quantité</th>
                <th className="px-2 py-2 text-right">P&L</th>
                <th className="px-2 py-2">Raison</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.id} className="border-t border-neutral-100">
                  <td className="px-2 py-2 text-neutral-500 whitespace-nowrap">{formatTime(t.time)}</td>
                  <td className="px-2 py-2">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.type === 'BUY' ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      {t.type}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right font-medium text-neutral-800">${t.price.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right text-neutral-600">{t.amount.toFixed(6)}</td>
                  <td className="px-2 py-2 text-right font-semibold">
                    {t.profit_pct != null ? (
                      <span className={t.profit_pct >= 0 ? 'text-green-600' : 'text-rose-600'}>
                        {t.profit_pct >= 0 ? '+' : ''}
                        {t.profit_pct.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-neutral-300">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-neutral-500 text-xs">{t.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
