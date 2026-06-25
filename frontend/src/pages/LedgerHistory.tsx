import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ClipboardCopy, Check, ListFilter, Loader2, InboxIcon } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface Transaction {
  id: string;
  created_at: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  idemp_key: string;
}

function formatTimestamp(isoString: string): string {
  const d = new Date(isoString);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
  return `${date} ${time}`;
}

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function formatINR(value: number | string): string {
  const val = Number(value) || 0;
  const fixed = val.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const lastThree = intPart.slice(-3);
  const otherDigits = intPart.slice(0, intPart.length - 3);
  const formatted =
    otherDigits.length > 0
      ? otherDigits.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
      : lastThree;
  return `₹${formatted}.${decPart}`;
}

function CopyableId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <button
      onClick={handleCopy}
      title={id}
      className="flex items-center gap-1.5 group"
    >
      <span className="font-mono text-xs text-on-surface-variant group-hover:text-primary transition-colors">
        {truncateId(id)}
      </span>
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="check"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Check className="w-3 h-3 text-emerald-500" />
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <ClipboardCopy className="w-3 h-3 text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

type FilterType = 'ALL' | 'CREDIT' | 'DEBIT';

const FILTER_OPTIONS: { label: string; value: FilterType }[] = [
  { label: 'All Actions', value: 'ALL' },
  { label: 'Credits Only', value: 'CREDIT' },
  { label: 'Debits Only', value: 'DEBIT' },
];

export function LedgerHistory() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('ALL');

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const response = await axios.get(`${API_URL}/transactions/${user.id}?limit=500`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTransactions(response.data);
    } catch (error) {
      console.error('Failed to fetch ledger:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Compute running balance per row
  // Transactions are newest-first from backend; we reverse to compute running balances
  const withBalance: (Transaction & { runningBalance: number })[] = [];
  let runningBalance = 0;
  const reversed = [...transactions].reverse();
  reversed.forEach((tx) => {
    runningBalance = tx.type === 'CREDIT'
      ? runningBalance + tx.amount
      : runningBalance - tx.amount;
    withBalance.push({ ...tx, runningBalance });
  });
  withBalance.reverse(); // newest-first again

  const filteredWithBalance = withBalance.filter(
    (tx) => filter === 'ALL' || tx.type === filter
  );

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-10">
        <h1 className="font-headline-lg text-5xl mb-3 text-primary tracking-tight">Ledger History</h1>
        <p className="font-label-sm text-[11px] uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500">
          Immutable audit log of all account transactions
        </p>
      </div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900/40 shadow-sm overflow-hidden"
      >
        {/* Control Layer */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/50">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5">
            <ListFilter className="w-3.5 h-3.5 text-neutral-400 mr-1" />
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`px-3.5 py-1.5 font-label-sm text-[10px] tracking-[0.15em] uppercase rounded-md font-bold transition-all duration-150 ${
                  filter === opt.value
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:bg-neutral-200/60 dark:hover:bg-neutral-700/40'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Entry counter */}
          <span className="font-label-sm text-[10px] tracking-[0.12em] uppercase text-neutral-400 dark:text-neutral-500 tabular-nums">
            {isLoading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading…
              </span>
            ) : (
              `${filteredWithBalance.length} ${filteredWithBalance.length === 1 ? 'entry' : 'entries'}`
            )}
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/30">
                <th className="text-left px-6 py-3.5 font-label-sm text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.18em]">
                  Timestamp
                </th>
                <th className="text-left px-6 py-3.5 font-label-sm text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.18em]">
                  Transaction ID
                </th>
                <th className="text-left px-6 py-3.5 font-label-sm text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.18em]">
                  Type
                </th>
                <th className="text-right px-6 py-3.5 font-label-sm text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.18em]">
                  Amount
                </th>
                <th className="text-right px-6 py-3.5 font-label-sm text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.18em]">
                  Post-Tx Balance
                </th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3 text-on-surface-variant">
                        <Loader2 className="w-7 h-7 animate-spin" />
                        <span className="text-sm">Fetching transaction log…</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredWithBalance.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3 text-on-surface-variant">
                        <InboxIcon className="w-8 h-8 opacity-40" />
                        <span className="text-sm">No transactions found.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredWithBalance.map((tx, idx) => (
                    <motion.tr
                      key={tx.id}
                      layout
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18, delay: idx < 20 ? idx * 0.02 : 0 }}
                      className={`
                        border-b border-neutral-100 dark:border-neutral-800/60 transition-colors duration-100
                        ${idx % 2 === 1
                          ? 'bg-neutral-50/50 dark:bg-neutral-900/30'
                          : 'bg-white dark:bg-transparent'}
                        hover:bg-neutral-100/70 dark:hover:bg-neutral-800/50
                      `}
                    >
                      {/* Timestamp */}
                      <td className="px-6 py-4 font-label-sm text-xs text-neutral-400 dark:text-neutral-500 tabular-nums whitespace-nowrap">
                        {formatTimestamp(tx.created_at)}
                      </td>

                      {/* Transaction ID */}
                      <td className="px-6 py-4">
                        <CopyableId id={tx.id} />
                      </td>

                      {/* Type Badge */}
                      <td className="px-6 py-4">
                        {tx.type === 'CREDIT' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md
                            font-label-sm text-[9px] font-bold tracking-[0.18em] uppercase
                            bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400
                            ring-1 ring-inset ring-emerald-200/60 dark:ring-emerald-800/50">
                            ▲ Credit
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md
                            font-label-sm text-[9px] font-bold tracking-[0.18em] uppercase
                            bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400
                            ring-1 ring-inset ring-rose-200/60 dark:ring-rose-800/50">
                            ▼ Debit
                          </span>
                        )}
                      </td>

                      {/* Amount — Cormorant Garamond for financial figures */}
                      <td className={`px-6 py-4 font-display tabular-nums text-right text-lg font-bold leading-none ${
                        tx.type === 'CREDIT'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {tx.type === 'CREDIT' ? '+' : '−'}{formatINR(tx.amount)}
                      </td>

                      {/* Post-Tx Balance */}
                      <td className="px-6 py-4 font-display tabular-nums text-right text-lg font-bold leading-none text-neutral-900 dark:text-neutral-100">
                        {formatINR(tx.runningBalance)}
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
