import React from 'react';

function Card({ label, value, accent, sub }) {
  return (
    <div className="bg-white rounded-2xl shadow-soft p-5">
      <div className="text-xs font-medium text-neutral-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${accent || 'text-neutral-800'}`}>{value}</div>
      {sub && <div className="text-xs text-neutral-400 mt-1">{sub}</div>}
    </div>
  );
}

export default function KPICards({ kpis, mode }) {
  if (!kpis) return null;

  const pnlPositive = kpis.total_pnl_pct >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card
        label="Capital"
        value={`$${kpis.current_balance.toFixed(2)}`}
        sub={`Départ: $${kpis.starting_balance.toFixed(2)}${mode === 'PAPER' ? ' (simulé)' : ''}`}
      />
      <Card
        label="P&L Total"
        value={`${pnlPositive ? '+' : ''}${kpis.total_pnl_pct.toFixed(2)}%`}
        accent={pnlPositive ? 'text-green-600' : 'text-rose-600'}
        sub={`${pnlPositive ? '+' : ''}$${kpis.total_pnl_usdt.toFixed(2)}`}
      />
      <Card
        label="Taux de réussite"
        value={`${kpis.win_rate.toFixed(0)}%`}
        sub={`${kpis.win_count}W / ${kpis.loss_count}L`}
      />
      <Card label="Total trades" value={kpis.total_trades} sub={`Moy: ${kpis.avg_trade_pct.toFixed(2)}% / trade`} />
    </div>
  );
}
