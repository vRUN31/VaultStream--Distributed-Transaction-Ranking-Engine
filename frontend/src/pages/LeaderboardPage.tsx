import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTilt } from '../hooks/useTilt';
import { RefreshCw, Download, SlidersHorizontal, AlertTriangle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  id: string;
  username: string;
  balance: number;
  tx_count: number;
}

interface Metrics {
  tvl: number;
  activeAccounts: number;
  avgTransactions: number;
}

interface LeaderboardData {
  metrics: Metrics;
  topAccounts: (LeaderboardEntry & { rank: number; tier: string; joinedDate: string })[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(val: number | string): string {
  const value = Number(val) || 0;
  // Manual formatter to avoid toLocaleString inconsistencies across Windows/Mac
  const fixed = value.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  // Indian numbering: last 3 digits, then groups of 2
  const lastThree = intPart.slice(-3);
  const otherDigits = intPart.slice(0, intPart.length - 3);
  const formatted =
    (otherDigits.length > 0
      ? otherDigits.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
      : lastThree);
  return `₹${formatted}.${decPart}`;
}

function formatTX(count: number | string): string {
  const value = Number(count) || 0;
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' TX';
}

function getTier(balance: number): string {
  if (balance >= 500000) return 'APEX';
  if (balance >= 100000) return 'ALPHA';
  if (balance >= 10000) return 'PRIME';
  return 'STANDARD';
}

function getInitial(username: string): string {
  return (username?.[0] ?? '?').toUpperCase();
}

// ─── Skeleton Components ───────────────────────────────────────────────────────

function SkeletonBox({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-neutral-200 dark:bg-neutral-800 ${className}`}
    />
  );
}

function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {[0, 1, 2].map((i) => (
        <div key={i} className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 space-y-3">
          <SkeletonBox className="h-3 w-40" />
          <SkeletonBox className="h-7 w-52" />
        </div>
      ))}
    </div>
  );
}

function PodiumSkeleton() {
  return (
    <div className="flex items-end justify-center gap-4 mb-8">
      {[1, 0, 2].map((i) => (
        <div
          key={i}
          className={`border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 space-y-3 ${
            i === 0 ? 'flex-1 max-w-xs' : 'flex-1 max-w-[200px]'
          }`}
        >
          <SkeletonBox className={`rounded-full mx-auto ${i === 0 ? 'h-14 w-14' : 'h-11 w-11'}`} />
          <SkeletonBox className="h-3 w-24 mx-auto" />
          <SkeletonBox className="h-5 w-32 mx-auto" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
        <SkeletonBox className="h-4 w-36" />
        <div className="flex gap-2">
          <SkeletonBox className="h-7 w-16 rounded-md" />
          <SkeletonBox className="h-7 w-16 rounded-md" />
        </div>
      </div>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5">
            <SkeletonBox className="h-3 w-8" />
            <SkeletonBox className="h-7 w-7 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <SkeletonBox className="h-3 w-28" />
              <SkeletonBox className="h-2 w-20" />
            </div>
            <SkeletonBox className="h-5 w-16 rounded-full" />
            <SkeletonBox className="h-3 w-20" />
            <SkeletonBox className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tier Badge ────────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  // font-label-sm maps to Geist Mono via the design system
  const base = 'inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-label-sm font-bold tracking-[0.18em] uppercase ring-1 ring-inset';
  const variants: Record<string, string> = {
    APEX:     `${base} bg-neutral-900 text-neutral-100 ring-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:ring-neutral-300`,
    ALPHA:    `${base} bg-neutral-200 text-neutral-800 ring-neutral-400 dark:bg-neutral-700 dark:text-neutral-200 dark:ring-neutral-500`,
    PRIME:    `${base} bg-white text-neutral-600 ring-neutral-300 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-600`,
    STANDARD: `${base} bg-neutral-100 text-neutral-400 ring-neutral-200 dark:bg-neutral-800/50 dark:text-neutral-500 dark:ring-neutral-700`,
  };
  return <span className={variants[tier] ?? variants.STANDARD}>{tier}</span>;
}

// ─── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ username, size = 'md', square = false }: { username: string; size?: 'sm' | 'md' | 'lg'; square?: boolean }) {
  const sizeClass = size === 'lg' ? 'h-16 w-16 text-xl' : size === 'md' ? 'h-12 w-12 text-base' : 'h-7 w-7 text-xs';
  const shapeClass = square ? 'rounded-2xl' : 'rounded-full';
  return (
    <div
      className={`${sizeClass} ${shapeClass} flex items-center justify-center flex-shrink-0 font-bold
        bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-sm`}
    >
      {getInitial(username)}
    </div>
  );
}

// ─── Podium Card ───────────────────────────────────────────────────────────────

function PodiumCard({
  entry,
  rank,
  isCenter,
}: {
  entry: LeaderboardEntry & { tier: string };
  rank: number;
  isCenter: boolean;
}) {
  const { containerRef, cardRef } = useTilt();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: isCenter ? 0 : 0.1 }}
      ref={containerRef as any}
      className={`
        tilt-card-container
        ${isCenter ? 'flex-1 max-w-sm z-10 mt-4' : 'flex-1 max-w-[240px] z-0'}
        ${!isCenter ? 'self-end mb-2' : ''}
      `}
    >
      <div 
        ref={cardRef as any}
        className={`
          glass-card tilt-card group relative flex flex-col items-center gap-5 pt-10 pb-7 px-7 rounded-2xl border text-center mt-8 cursor-crosshair
          ${isCenter
            ? 'border-neutral-400 dark:border-neutral-500 bg-neutral-50 dark:bg-neutral-800/70 scale-[1.03] shadow-2xl middle-card'
            : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 shadow-xl'}
        `}
      >
        <div className="card-glow opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      {/* Floating Rank Badge — Cormorant Garamond for the number gives it editorial flair */}
      <div className={`
        absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full border-2 flex items-center justify-center
        font-display text-lg font-bold bg-white dark:bg-neutral-900
        ${isCenter 
          ? 'border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100' 
          : 'border-neutral-400 text-neutral-500 dark:border-neutral-600 dark:text-neutral-400'}
      `}>
        {rank}
      </div>

      <Avatar username={entry.username} size={isCenter ? 'lg' : 'md'} square={true} />

      <div className="space-y-2">
        {/* Username — Outfit for clean UI identity */}
        <p className={`font-headline-md font-semibold tracking-tight ${
          isCenter ? 'text-lg text-on-surface' : 'text-base text-on-surface'
        }`}>
          @{entry.username}
        </p>
        {/* Balance — Cormorant Garamond for the large display number is the key aesthetic move */}
        <p className={`font-display tabular-nums font-bold leading-none ${
          isCenter ? 'text-4xl text-on-surface' : 'text-2xl text-on-surface-variant'
        }`}>
          {formatINR(entry.balance)}
        </p>
      </div>

      {isCenter && (
        <div className="font-label-sm text-[9px] font-bold tracking-[0.25em] px-4 py-1.5 rounded-md border border-neutral-400 dark:border-neutral-500 text-neutral-600 dark:text-neutral-300 uppercase">
          Apex Prime
        </div>
      )}
      </div>
    </motion.div>
  );
}

// ─── Error State ───────────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-12 flex flex-col items-center gap-4 text-center">
      <AlertTriangle className="w-8 h-8 text-neutral-400 dark:text-neutral-600" />
      <div>
        <p className="font-semibold text-on-surface text-sm">Unable to retrieve ledger index.</p>
        <p className="text-xs text-on-surface-variant mt-1 font-mono">Connection refused. Engine may be offline.</p>
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold border border-neutral-300 dark:border-neutral-700 rounded-lg text-on-surface hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Retry Connection
      </button>
    </div>
  );
}

// ─── Metric Card ───────────────────────────────────────────────────────────────

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 bg-white dark:bg-neutral-900/40"
    >
      {/* Label — Geist Mono for a technical/institutional feel */}
      <p className="font-label-sm text-[10px] uppercase tracking-[0.2em] font-bold text-neutral-400 dark:text-neutral-500 mb-4">
        {label}
      </p>
      {/* Value — Cormorant Garamond makes large financial figures look editorial and premium */}
      <p className="font-display tabular-nums text-4xl font-bold text-neutral-900 dark:text-neutral-100 leading-none">
        {value}
      </p>
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function LeaderboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'APEX' | 'ALPHA' | 'PRIME' | 'STANDARD'>('ALL');

  const fetchData = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setIsLoading(true);
    }
    setIsError(false);
    try {
      const response = await axios.get<LeaderboardData>(`${API_URL}/ranking`);
      const rawMetrics = response.data.metrics;
      const rawAccounts = response.data.top_accounts;

      const enriched = rawAccounts.map((e: any, i: number) => ({
        ...e,
        rank: i + 1,
        tier: getTier(e.balance),
        joinedDate: 'N/A',
      }));

      setData({
        metrics: { 
          tvl: rawMetrics.tvl, 
          activeAccounts: rawMetrics.active_accounts, 
          avgTransactions: rawMetrics.avg_transactions 
        },
        topAccounts: enriched,
      });
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false); // Initial load (shows skeleton)
    const interval = setInterval(() => fetchData(true), 15000); // Background refresh (silent update)
    return () => clearInterval(interval);
  }, [fetchData]);

  const podium = data?.topAccounts.slice(0, 3) ?? [];
  const podiumOrder =
    podium.length >= 3
      ? [podium[1], podium[0], podium[2]]
      : podium.length === 2
      ? [podium[1], podium[0]] // Rank 2 on the left, Rank 1 in the middle
      : podium;

  // Table: show ALL accounts (including top 3 so users always see data)
  const tableRows = data?.topAccounts ?? [];
  const filteredRows = tableRows.filter((e) => filterType === 'ALL' || e.tier === filterType);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-10">
        <h1 className="font-headline-lg text-5xl mb-3 text-primary tracking-tight">Global Ranking</h1>
        <p className="font-label-sm text-[11px] uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500">
          Top 100 accounts by balance and transaction volume
        </p>
      </div>

      {/* ── Loading Skeleton ── */}
      {isLoading && (
        <>
          <MetricsSkeleton />
          <PodiumSkeleton />
          <TableSkeleton />
        </>
      )}

      {/* ── Error State ── */}
      {!isLoading && isError && <ErrorState onRetry={fetchData} />}

      {/* ── Populated UI ── */}
      <AnimatePresence>
        {!isLoading && !isError && data && (
          <>
            {/* ── Macro Metrics ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <MetricCard label="Total Value Locked (TVL)" value={formatINR(data.metrics.tvl)} />
              <MetricCard label="Active Vault Accounts" value={Number(data.metrics.activeAccounts).toLocaleString('en-US')} />
              <MetricCard label="Average Transactions / Account" value={`${data.metrics.avgTransactions} TX`} />
            </div>

            {/* ── Podium ── */}
            {podium.length >= 1 && (
              <div className="flex items-end justify-center gap-4 mb-8">
                {podiumOrder.map((entry, i) => {
                  const isCenter = entry.rank === 1; // Rank 1 is always the center, elevated card
                  return (
                    <PodiumCard
                      key={entry.id}
                      entry={entry}
                      rank={entry.rank}
                      isCenter={isCenter}
                    />
                  );
                })}
              </div>
            )}

            {/* ── Global Index Registry Table ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900/40 overflow-hidden"
            >
              {/* Table Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
                <div>
                  <span className="font-headline-md text-base font-semibold text-on-surface tracking-tight">Global Index Registry</span>
                  <span className="ml-3 font-label-sm tabular-nums text-[10px] tracking-[0.15em] uppercase text-neutral-400 dark:text-neutral-500">
                    {filteredRows.length} accounts
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Filter dropdown */}
                  <div className="relative flex items-center">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 pointer-events-none" />
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value as typeof filterType)}
                      className="pl-8 pr-3 py-1.5 text-xs border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-on-surface appearance-none cursor-pointer font-medium focus:outline-none"
                    >
                      <option value="ALL">All Tiers</option>
                      <option value="APEX">APEX</option>
                      <option value="ALPHA">ALPHA</option>
                      <option value="PRIME">PRIME</option>
                      <option value="STANDARD">STANDARD</option>
                    </select>
                  </div>
                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-on-surface font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                    onClick={() => {
                      const csv = [
                        'Rank,Username,Tier,TX Count,Balance',
                        ...filteredRows.map(r => `${r.rank},${r.username},${r.tier},${r.tx_count},${r.balance}`)
                      ].join('\n');
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url; a.download = 'leaderboard.csv'; a.click();
                    }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60">
                      <th className="text-right px-6 py-3.5 font-label-sm text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.18em] w-16">Rank</th>
                      <th className="text-left px-6 py-3.5 font-label-sm text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.18em]">Account Holder</th>
                      <th className="text-left px-6 py-3.5 font-label-sm text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.18em]">Standing</th>
                      <th className="text-right px-6 py-3.5 font-label-sm text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.18em]">Velocity</th>
                      <th className="text-right px-6 py-3.5 pr-7 font-label-sm text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.18em]">Total Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-16 text-center text-sm text-neutral-400 font-mono">
                          No accounts match the selected tier filter.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((entry, idx) => {
                        const isCurrentUser = user?.id === entry.id;
                        return (
                          <motion.tr
                            key={entry.id}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.15, delay: idx < 15 ? idx * 0.02 : 0 }}
                            className={`
                              border-b border-neutral-100 dark:border-neutral-800/60 transition-colors duration-100
                              ${idx % 2 === 1
                                ? 'bg-neutral-50 dark:bg-neutral-900'
                                : 'bg-white dark:bg-transparent'}
                              hover:bg-neutral-100 dark:hover:bg-neutral-800/60
                              ${isCurrentUser ? 'ring-1 ring-inset ring-neutral-400 dark:ring-neutral-600' : ''}
                            `}
                          >
                            {/* Rank */}
                            <td className="px-6 py-4 text-right font-label-sm tabular-nums text-sm font-bold text-neutral-400 dark:text-neutral-500">
                              #{String(entry.rank).padStart(2, '0')}
                            </td>

                            {/* Account Holder */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <Avatar username={entry.username} size="sm" />
                                <p className={`font-headline-md text-sm font-semibold tracking-tight ${
                                  isCurrentUser ? 'text-on-surface' : 'text-on-surface'
                                }`}>
                                  @{entry.username}
                                  {isCurrentUser && (
                                    <span className="ml-2 font-label-sm text-[9px] tracking-[0.15em] uppercase text-neutral-400">(you)</span>
                                  )}
                                </p>
                              </div>
                            </td>

                            {/* Tier */}
                            <td className="px-6 py-4">
                              <TierBadge tier={entry.tier} />
                            </td>

                            {/* TX Count */}
                            <td className="px-6 py-4 font-label-sm tabular-nums text-right text-sm text-neutral-500 dark:text-neutral-400">
                              {formatTX(entry.tx_count)}
                            </td>

                            {/* Balance — Cormorant Garamond makes balance figures feel premium */}
                            <td className="px-6 py-4 pr-7 font-display tabular-nums text-right text-lg font-bold text-neutral-900 dark:text-neutral-100 leading-none">
                              {formatINR(entry.balance)}
                            </td>
                          </motion.tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/20">
                <p className="text-xs font-mono text-neutral-400 dark:text-neutral-600">
                  Auto-refreshes every 15s · Redis ZSET (O log N) · VaultStream Engine v1.0
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
