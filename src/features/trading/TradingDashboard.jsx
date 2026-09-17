import React from 'react';
import { motion } from 'framer-motion';
import { SignalIcon, SignalSlashIcon } from '@heroicons/react/24/outline';

import { useTradingSocket } from './hooks/useTradingSocket';
import PriceChart from './components/PriceChart';
import AIPanel from './components/AIPanel';
import TradeLog from './components/TradeLog';
import DailySummary from './components/DailySummary';
import KPICards from './components/KPICards';

export default function TradingDashboard() {
  const { snapshot, trades, daily, connectionStatus } = useTradingSocket();

  const isConnected = connectionStatus === 'open' || connectionStatus === 'polling';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="bg-white rounded-2xl shadow-soft p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">
            Bot de Trading — {snapshot?.symbol || 'BTC/USDT'}
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Stratégie RSI + Moyennes Mobiles · timeframe {snapshot?.timeframe || '15m'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
              snapshot?.mode === 'LIVE' ? 'bg-rose-100 text-rose-700' : 'bg-green-100 text-green-700'
            }`}
          >
            {snapshot?.mode === 'LIVE' ? 'LIVE — argent réel' : 'PAPER — simulation'}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
              isConnected ? 'bg-primary-50 text-primary-700' : 'bg-neutral-100 text-neutral-500'
            }`}
          >
            {isConnected ? <SignalIcon className="h-4 w-4" /> : <SignalSlashIcon className="h-4 w-4" />}
            {isConnected ? 'Connecté' : 'Backend non connecté'}
          </span>
        </div>
      </div>

      {!isConnected && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 text-sm">
          Impossible de joindre le backend ({import.meta.env.VITE_TRADING_API_URL || 'http://localhost:8000'}).
          Lance-le avec <code className="bg-amber-100 px-1.5 py-0.5 rounded">cd backend && uvicorn main:app --reload --port 8000</code> puis recharge la page.
        </div>
      )}

      <KPICards kpis={snapshot?.kpis} mode={snapshot?.mode} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-soft p-6 h-96">
          <PriceChart priceHistory={snapshot?.price_history} symbol={snapshot?.symbol} />
        </div>
        <div className="h-96">
          <AIPanel
            analysis={snapshot?.analysis}
            reasoning={snapshot?.reasoning}
            inPosition={snapshot?.in_position}
            entryPrice={snapshot?.entry_price}
            movingStopLoss={snapshot?.moving_stop_loss}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-80">
          <TradeLog trades={trades} />
        </div>
        <div className="h-80">
          <DailySummary today={snapshot?.today} daily={daily} />
        </div>
      </div>

      <p className="text-xs text-neutral-400 text-center pb-2">
        Aucune stratégie de trading ne garantit un profit. En mode PAPER, les prix sont réels mais les trades sont simulés — aucun argent réel n'est en jeu.
      </p>
    </motion.div>
  );
}
