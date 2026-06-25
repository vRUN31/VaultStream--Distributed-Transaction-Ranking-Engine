import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

interface TransactionFormProps {
  onExecute: (type: 'CREDIT' | 'DEBIT', amount: number) => Promise<void>;
  isLoading: boolean;
}

export function TransactionForm({ onExecute, isLoading }: TransactionFormProps) {
  const [amount, setAmount] = useState('');
  const [activeTab, setActiveTab] = useState<'CREDIT' | 'DEBIT'>('CREDIT');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
    
    await onExecute(activeTab, Number(amount));
    setAmount('');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="p-6 md:p-8 rounded-2xl bg-surface border border-black/10 dark:border-white/10 shadow-lg"
    >
      <div className="flex gap-2 mb-6 p-1 bg-black/5 dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/5">
        <button
          type="button"
          onClick={() => setActiveTab('CREDIT')}
          className={`flex-1 py-2.5 font-headline-md text-[13px] tracking-wide rounded-md transition-all flex items-center justify-center gap-2 ${
            activeTab === 'CREDIT' 
              ? 'bg-white dark:bg-surface shadow-sm text-primary' 
              : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <ArrowDownToLine className="w-4 h-4" /> Deposit
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('DEBIT')}
          className={`flex-1 py-2.5 font-headline-md text-[13px] tracking-wide rounded-md transition-all flex items-center justify-center gap-2 ${
            activeTab === 'DEBIT' 
              ? 'bg-white dark:bg-surface shadow-sm text-primary' 
              : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <ArrowUpFromLine className="w-4 h-4" /> Withdraw
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="text-label-sm font-label-sm text-on-surface-variant ml-1 mb-2 block tracking-widest uppercase">Amount (USD)</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg font-body-md">$</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl py-4 pl-8 pr-4 text-primary font-display text-2xl italic focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder:text-on-surface-variant/30 placeholder:not-italic placeholder:font-body-md placeholder:text-base"
              placeholder="0.00"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !amount || Number(amount) <= 0}
          className={`w-full py-4 rounded-xl font-headline-md text-[15px] tracking-wide transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            activeTab === 'CREDIT' 
              ? 'bg-primary text-on-primary btn-primary-glow' 
              : 'bg-transparent border border-primary text-primary hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Loader2 className="w-5 h-5 animate-spin" />
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                {activeTab === 'CREDIT' ? 'Execute Deposit' : 'Execute Withdrawal'}
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </form>
    </motion.div>
  );
}
