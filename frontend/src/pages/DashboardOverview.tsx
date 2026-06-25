import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  Eye,
  EyeOff,
  BadgeCheck,
  Activity,
  ChevronDown,
  Calendar,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const PRESETS = [500, 1000, 2500, 5000];

function getAccountTier(bal: number): { label: string; color: string } {
  if (bal >= 500000) return { label: 'Platinum', color: 'text-purple-600 dark:text-purple-400' };
  if (bal >= 100000) return { label: 'Gold', color: 'text-amber-600 dark:text-amber-400' };
  if (bal >= 10000) return { label: 'Silver', color: 'text-neutral-500' };
  return { label: 'Standard', color: 'text-neutral-500' };
}

function formatINR(value: number): string {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTimestamp(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

interface LedgerEntry {
  id: string;
  timestamp: Date;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
}

export function DashboardOverview() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [balance, setBalance] = useState(0);
  const [txCount, setTxCount] = useState(0);
  const [isFetching, setIsFetching] = useState(true);
  const [isTransacting, setIsTransacting] = useState(false);
  const [amount, setAmount] = useState('');
  const [justSucceeded, setJustSucceeded] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [isLedgerFetching, setIsLedgerFetching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSummary = useCallback(async () => {
    if (!user) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const response = await axios.get(`${API_URL}/summary/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBalance(response.data.balance);
      setTxCount(response.data.tx_count);
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    } finally {
      setIsFetching(false);
    }
  }, [user]);

  const fetchLedger = useCallback(async () => {
    if (!user) return;
    setIsLedgerFetching(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      let queryUrl = `${API_URL}/transactions/${user.id}?limit=100`;
      
      if (dateFilter !== 'all') {
        const now = new Date();
        let startDate = new Date();
        if (dateFilter === 'today') {
          startDate.setHours(0,0,0,0);
        } else if (dateFilter === 'week') {
          startDate.setDate(now.getDate() - 7);
        } else if (dateFilter === 'month') {
          startDate.setMonth(now.getMonth() - 1);
        }
        queryUrl += `&start_date=${startDate.toISOString()}`;
      }

      const response = await axios.get(queryUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const mappedLedger = response.data.map((item: any) => ({
        id: item.id,
        timestamp: new Date(item.created_at),
        type: item.type,
        amount: Number(item.amount)
      }));
      setLedger(mappedLedger);
    } catch (error) {
      console.error('Failed to fetch ledger:', error);
    } finally {
      setIsLedgerFetching(false);
    }
  }, [user, dateFilter]);

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 8000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const handleExecuteTransaction = async (type: 'CREDIT' | 'DEBIT') => {
    if (!user || !amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
    setIsTransacting(true);
    const idempKey = uuidv4();
    const txAmount = Number(amount);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const response = await axios.post(
        `${API_URL}/transaction`,
        { amount: txAmount, type, idemp_key: idempKey },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBalance(response.data.new_balance);
      setTxCount((prev) => prev + 1);
      setAmount('');
      setJustSucceeded(true);

      // Add to in-session ledger optimistically
      setLedger((prev) => [
        {
          id: idempKey,
          timestamp: new Date(),
          type,
          amount: txAmount,
        },
        ...prev,
      ]);
      
      // Fetch latest from backend to ensure persistent consistency
      fetchLedger();

      setTimeout(() => setJustSucceeded(false), 1800);
      showToast(
        `${type === 'CREDIT' ? 'Credited' : 'Debited'} ₹${txAmount.toLocaleString('en-IN')} successfully`,
        'success'
      );
    } catch (error: any) {
      if (error.response?.status === 400) {
        showToast(error.response.data.detail || 'Insufficient funds.', 'error');
      } else if (error.response?.status === 409) {
        showToast('Transaction is already processing.', 'error');
      } else if (error.response?.status === 429) {
        showToast('Rate limit exceeded. Please wait a moment before trying again.', 'error');
      } else {
        showToast('Failed to execute transaction. Please try again.', 'error');
      }
    } finally {
      setIsTransacting(false);
    }
  };

  const tier = getAccountTier(Number(balance));
  const formatted = formatINR(Number(balance || 0));
  const [intPart, decPart] = formatted.split('.');

  const canSubmit = !!amount && !isNaN(Number(amount)) && Number(amount) > 0 && !isTransacting;

  return (
    <div className="flex flex-col min-h-full lg:h-full">
      {/* Page title row */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1
            className="text-[22px] font-bold text-neutral-900 dark:text-white leading-tight tracking-tight"
            style={{ fontFamily: '"Outfit", system-ui, sans-serif', letterSpacing: '-0.02em' }}
          >
            Console Overview
          </h1>
          <p
            className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1 tracking-wide"
            style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
          >
            Live account dashboard — all figures real-time
          </p>
        </div>

      </div>

      {/* ── TWO-COLUMN GRID ── */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">

        {/* ══ LEFT COLUMN (65%) ══════════════════════════════════ */}
        <div className="flex flex-col gap-4 w-full lg:w-[65%] shrink-0">

          {/* ── BALANCE SUMMARY CARD ─────────────────────────── */}
          <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800/70 rounded-xl p-6 transition-colors duration-300">

            {/* Card header */}
            <div className="flex items-start justify-between mb-4">
              <p
                className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.16em]"
                style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
              >
                Total Ledger Balance
              </p>
              <div className="flex items-center gap-2">
                {/* Account type badges */}
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700/60 text-[10px] text-neutral-500 dark:text-neutral-400 font-medium tracking-wide"
                  style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
                >
                  <BadgeCheck className="w-3 h-3" />
                  {tier.label}
                </span>

                {/* Eye toggle */}
                <button
                  onClick={() => setBalanceVisible((v) => !v)}
                  className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
                  aria-label={balanceVisible ? 'Hide balance' : 'Show balance'}
                >
                  {balanceVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Balance figure */}
            <div className="mb-5">
              {isFetching && balance === 0 ? (
                <div className="h-16 flex items-center">
                  <div className="w-6 h-6 rounded-full border-2 border-neutral-300 border-t-neutral-700 animate-spin" />
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  {balanceVisible ? (
                    <motion.div
                      key="visible"
                      initial={{ opacity: 0, filter: 'blur(6px)' }}
                      animate={{ opacity: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, filter: 'blur(6px)' }}
                      transition={{ duration: 0.2 }}
                      className="flex items-baseline gap-1.5"
                    >
                      <span
                        className="text-[22px] text-neutral-300 dark:text-neutral-600 mt-1 font-light"
                        style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
                      >₹</span>
                      <span
                        className="text-[56px] leading-none font-black tabular-nums text-neutral-900 dark:text-white tracking-tighter"
                        style={{ fontFamily: '"Geist Mono", "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}
                      >
                        {intPart}
                      </span>
                      <span
                        className="text-[30px] leading-none tabular-nums text-neutral-300 dark:text-neutral-700 font-light"
                        style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
                      >
                        .{decPart}
                      </span>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="hidden"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center gap-1.5 py-4"
                    >
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="w-2.5 h-2.5 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-6 pt-4 border-t border-neutral-100 dark:border-neutral-800/60">
              <div>
                <p
                  className="text-[9px] font-semibold tracking-[0.16em] text-neutral-400 dark:text-neutral-600 uppercase mb-1"
                  style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
                >
                  Operations
                </p>
                <p
                  className="text-[24px] font-black tabular-nums text-neutral-900 dark:text-white leading-none"
                  style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
                >
                  {txCount}
                </p>
                <p
                  className="text-[10px] text-neutral-400 dark:text-neutral-600 mt-0.5"
                  style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
                >
                  Total executed
                </p>
              </div>
              <div className="w-px h-10 bg-neutral-100 dark:bg-neutral-800" />
              <div>
                <p
                  className="text-[9px] font-semibold tracking-[0.16em] text-neutral-400 dark:text-neutral-600 uppercase mb-1"
                  style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
                >
                  Account Tier
                </p>
                <p
                  className={`text-[24px] font-black tabular-nums leading-none ${tier.color}`}
                  style={{ fontFamily: '"Outfit", system-ui, sans-serif' }}
                >
                  {tier.label}
                </p>
                <p
                  className="text-[10px] text-neutral-400 dark:text-neutral-600 mt-0.5"
                  style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
                >
                  Current standing
                </p>
              </div>
              <div className="w-px h-10 bg-neutral-100 dark:bg-neutral-800" />
              <div>
                <p
                  className="text-[9px] font-semibold tracking-[0.16em] text-neutral-400 dark:text-neutral-600 uppercase mb-1"
                  style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
                >
                  Ledger
                </p>
                <p
                  className="text-[24px] font-black tabular-nums leading-none text-emerald-600 dark:text-emerald-400"
                  style={{ fontFamily: '"Outfit", system-ui, sans-serif' }}
                >
                  Active
                </p>
                <p
                  className="text-[10px] text-neutral-400 dark:text-neutral-600 mt-0.5"
                  style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
                >
                  Immutable record
                </p>
              </div>
            </div>
          </div>

          {/* ── TRANSACTION TERMINAL ─────────────────────────── */}
          <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800/70 rounded-xl p-6 flex-1 transition-colors duration-300">
            <div className="flex items-center justify-between mb-5">
              <p
                className="text-[10px] font-semibold tracking-[0.16em] text-neutral-400 dark:text-neutral-500 uppercase"
                style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
              >
                Transaction Terminal
              </p>
              <p
                className="text-[10px] text-neutral-300 dark:text-neutral-700"
                style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
              >
                Idempotent execution
              </p>
            </div>

            {/* Amount input */}
            <div className="mb-4">
              <p
                className="text-[9px] font-semibold tracking-[0.16em] text-neutral-400 dark:text-neutral-500 uppercase mb-2"
                style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
              >
                Amount
              </p>
              <div
                className={`flex items-center gap-2 bg-neutral-50 dark:bg-neutral-900 border ${
                  isTransacting
                    ? 'border-neutral-100 dark:border-neutral-800/40 opacity-50'
                    : 'border-neutral-200 dark:border-neutral-700/60 focus-within:border-neutral-400 dark:focus-within:border-neutral-500'
                } rounded-xl px-4 py-3 transition-all duration-200 cursor-text`}
                onClick={() => inputRef.current?.focus()}
              >
                <span
                  className="text-[20px] text-neutral-300 dark:text-neutral-600 select-none font-light"
                  style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
                >₹</span>
                <input
                  ref={inputRef}
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={isTransacting}
                  className="flex-1 bg-transparent tabular-nums text-[30px] font-black text-neutral-900 dark:text-white outline-none border-none placeholder:text-neutral-200 dark:placeholder:text-neutral-800 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  style={{ fontFamily: '"Geist Mono", "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}
                />
              </div>
            </div>

            {/* Quick-select chips */}
            <div className="mb-5">
              <p
                className="text-[9px] font-semibold tracking-[0.16em] text-neutral-400 dark:text-neutral-500 uppercase mb-2"
                style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
              >
                Quick Select
              </p>
              <div className="grid grid-cols-4 gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={isTransacting}
                    onClick={() => {
                      setAmount(String(preset));
                      inputRef.current?.focus();
                    }}
                    className={`py-2 px-3 rounded-xl border transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                      amount === String(preset)
                        ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white shadow-sm'
                        : 'bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700/60 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                    style={{ fontFamily: '"Geist Mono", "Courier New", monospace', fontSize: '12px', fontWeight: amount === String(preset) ? 700 : 500 }}
                  >
                    ₹{preset.toLocaleString('en-IN')}
                  </button>
                ))}
              </div>
            </div>

            {/* Execution buttons — side by side */}
            <div className="grid grid-cols-2 gap-3">
              {/* CREDIT */}
              <motion.button
                type="button"
                disabled={!canSubmit}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleExecuteTransaction('CREDIT')}
                className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-700 dark:hover:bg-neutral-100 disabled:opacity-35 disabled:cursor-not-allowed transition-all duration-150 shadow-sm"
                style={{ fontFamily: '"Geist Mono", "Courier New", monospace', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em' }}
              >
                <AnimatePresence mode="wait">
                  {isTransacting ? (
                    <motion.span key="credit-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 uppercase">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Processing…
                    </motion.span>
                  ) : justSucceeded ? (
                    <motion.span key="credit-success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="uppercase">
                      ✓ Confirmed
                    </motion.span>
                  ) : (
                    <motion.span key="credit-idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 uppercase">
                      <ArrowDownToLine className="w-3.5 h-3.5" />
                      Credit Account
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>

              {/* DEBIT */}
              <motion.button
                type="button"
                disabled={!canSubmit}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleExecuteTransaction('DEBIT')}
                className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-35 disabled:cursor-not-allowed transition-all duration-150"
                style={{ fontFamily: '"Geist Mono", "Courier New", monospace', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em' }}
              >
                <AnimatePresence mode="wait">
                  {isTransacting ? (
                    <motion.span key="debit-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 uppercase">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Processing…
                    </motion.span>
                  ) : justSucceeded ? (
                    <motion.span key="debit-success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="uppercase">
                      ✓ Confirmed
                    </motion.span>
                  ) : (
                    <motion.span key="debit-idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 uppercase">
                      <ArrowUpFromLine className="w-3.5 h-3.5" />
                      Debit Account
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          </div>
        </div>

        {/* ══ RIGHT COLUMN (35%) ═════════════════════════════════ */}
        <div className="flex flex-col flex-1 min-w-0 min-h-[400px] lg:min-h-0">

          {/* ── REAL-TIME ACTIVITY LEDGER ───────────────────── */}
          <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800/70 rounded-xl flex flex-col flex-1 overflow-hidden transition-colors duration-300">

            {/* Card header */}
            <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800/60 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
                <p
                  className="text-[10px] font-semibold tracking-[0.16em] text-neutral-400 dark:text-neutral-500 uppercase"
                  style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
                >
                  Activity Ledger
                </p>
              </div>
              <div className="relative animate-fade-in" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] rounded-md border border-neutral-200 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/50 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 transition-all duration-200 focus:outline-none backdrop-blur-sm shadow-sm hover:shadow active:scale-95"
                  style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
                >
                  <Calendar className="w-3 h-3 text-neutral-400 dark:text-neutral-500" />
                  <span>
                    {dateFilter === 'all' && 'All Time'}
                    {dateFilter === 'today' && 'Today'}
                    {dateFilter === 'week' && 'Last 7 Days'}
                    {dateFilter === 'month' && 'Last 30 Days'}
                  </span>
                  <ChevronDown className={`w-3 h-3 text-neutral-400 dark:text-neutral-500 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.95 }}
                      transition={{ duration: 0.12, ease: 'easeOut' }}
                      className="absolute right-0 mt-1 w-36 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md shadow-lg py-1 z-50 overflow-hidden"
                      style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
                    >
                      {[
                        { value: 'all', label: 'All Time' },
                        { value: 'today', label: 'Today' },
                        { value: 'week', label: 'Last 7 Days' },
                        { value: 'month', label: 'Last 30 Days' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setDateFilter(opt.value as any);
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-[10px] transition-all duration-150 flex items-center justify-between ${
                            dateFilter === opt.value
                              ? 'bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-white font-semibold'
                              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 hover:text-neutral-900 dark:hover:text-white'
                          }`}
                        >
                          {opt.label}
                          {dateFilter === opt.value && (
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 dark:bg-white" />
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Column headers */}
            {ledger.length > 0 && (
              <div className="px-6 py-2 grid grid-cols-[1fr_auto_auto] gap-3 border-b border-neutral-50 dark:border-neutral-800/40 flex-shrink-0">
                {['Timestamp', 'Type', 'Amount'].map((col, i) => (
                  <span
                    key={col}
                    className={`text-[9px] font-semibold tracking-[0.18em] text-neutral-300 dark:text-neutral-700 uppercase ${i === 2 ? 'text-right' : ''}`}
                    style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
                  >
                    {col}
                  </span>
                ))}
              </div>
            )}

            {/* Ledger rows */}
            <div className="flex-1 overflow-y-auto">
              {ledger.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center px-6">
                  <div className="w-10 h-10 rounded-xl border border-neutral-100 dark:border-neutral-800/60 flex items-center justify-center mb-3">
                    <Activity className="w-5 h-5 text-neutral-200 dark:text-neutral-800" />
                  </div>
                  <p
                    className="text-[13px] font-medium text-neutral-400 dark:text-neutral-600"
                    style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
                  >
                    No recent activity
                  </p>
                  <p
                    className="text-[11px] text-neutral-300 dark:text-neutral-700 mt-1"
                    style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
                  >
                    Execute a transaction to see it here
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-50 dark:divide-neutral-800/50">
                  <AnimatePresence initial={false}>
                    {ledger.map((entry, index) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: -8, backgroundColor: entry.type === 'CREDIT' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.06)' }}
                        animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(0,0,0,0)' }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                        className="px-6 py-3 grid grid-cols-[1fr_auto_auto] gap-3 items-center hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors duration-100"
                        style={{ opacity: index > 10 ? Math.max(0.35, 1 - (index - 10) * 0.07) : 1 }}
                      >
                        {/* Timestamp */}
                        <span
                          className="text-[10px] tabular-nums text-neutral-400 dark:text-neutral-600 tracking-wide"
                          style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
                        >
                          {formatTimestamp(entry.timestamp)}
                        </span>

                        {/* Type badge */}
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.1em] ${
                            entry.type === 'CREDIT'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                          style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
                        >
                          {entry.type === 'CREDIT' ? (
                            <><span className="text-[13px] leading-none">+</span>CR</>
                          ) : (
                            <><span className="text-[13px] leading-none">−</span>DR</>
                          )}
                        </span>

                        {/* Amount */}
                        <span
                          className={`text-[12px] tabular-nums font-bold text-right ${
                            entry.type === 'CREDIT'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-red-700 dark:text-red-400'
                          }`}
                          style={{ fontFamily: '"Geist Mono", "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}
                        >
                          ₹{formatINR(entry.amount)}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

            </div>

            {/* Footer */}
            {ledger.length > 0 && (
              <div className="px-6 py-3 border-t border-neutral-100 dark:border-neutral-800/60 flex items-center justify-between flex-shrink-0">
                <span
                  className="text-[10px] text-neutral-300 dark:text-neutral-700"
                  style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
                >
                  {ledger.length} record{ledger.length !== 1 ? 's' : ''} loaded
                </span>
                {isLedgerFetching && (
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 animate-pulse">Syncing...</span>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
