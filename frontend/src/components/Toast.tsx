import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

export function Toast({ toast, onClose }: ToastProps) {
  const { id, message, type, duration = 4000 } = toast;

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);
    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-primary shrink-0" />,
  };

  const borders = {
    success: 'border-l-emerald-500 shadow-emerald-500/10',
    error: 'border-l-red-500 shadow-red-500/10',
    info: 'border-l-primary shadow-primary/10',
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.9, transition: { duration: 0.2 } }}
      className={`flex items-start gap-3 w-80 p-4 bg-surface/90 border-y border-r border-black/10 dark:border-white/10 border-l-4 rounded-r-xl rounded-l shadow-2xl backdrop-blur-md pointer-events-auto relative overflow-hidden ${borders[type]}`}
    >
      <div className="mt-0.5">{icons[type]}</div>
      <div className="flex-1 text-body-sm text-on-surface leading-relaxed pr-2 font-medium">
        {message}
      </div>
      <button
        onClick={() => onClose(id)}
        className="text-on-surface-variant hover:text-on-surface transition-colors shrink-0 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Progress Bar */}
      <motion.div
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: duration / 1000, ease: 'linear' }}
        className={`absolute bottom-0 left-0 h-0.5 ${type === 'success'
            ? 'bg-emerald-500'
            : type === 'error'
              ? 'bg-red-500'
              : 'bg-primary'
          }`}
      />
    </motion.div>
  );
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  return (
    <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none max-w-full">
      <AnimatePresence>
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </AnimatePresence>
    </div>
  );
}
