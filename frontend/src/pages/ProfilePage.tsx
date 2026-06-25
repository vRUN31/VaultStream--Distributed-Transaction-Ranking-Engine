import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import { 
  User, 
  Mail, 
  Hash, 
  ShieldAlert, 
  Trash2, 
  X, 
  Loader2,
  Wallet,
  Activity
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function ProfilePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [isFetching, setIsFetching] = useState(true);
  const [profileData, setProfileData] = useState<{ username: string; balance: number; tx_count: number } | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const response = await axios.get(`${API_URL}/summary/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfileData({
        username: response.data.username,
        balance: Number(response.data.balance),
        tx_count: Number(response.data.tx_count)
      });
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      showToast('Failed to load profile data', 'error');
    } finally {
      setIsFetching(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleDeleteAccount = async () => {
    if (confirmText !== 'DELETE') {
      showToast('Please type DELETE to confirm', 'error');
      return;
    }

    setIsDeleting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      await axios.delete(`${API_URL}/account`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      showToast('Account permanently deleted', 'success');
      setIsModalOpen(false);
      await supabase.auth.signOut();
      navigate('/');
    } catch (error: any) {
      console.error('Failed to delete account:', error);
      showToast(error.response?.data?.detail || 'Failed to delete account. Please try again.', 'error');
      setIsDeleting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col max-w-4xl mx-auto h-full w-full">
      {/* Header */}
      <div className="mb-8">
        <h1 
          className="text-[28px] font-bold text-neutral-900 dark:text-white leading-tight tracking-tight mb-2"
          style={{ fontFamily: '"Outfit", system-ui, sans-serif' }}
        >
          Profile Settings
        </h1>
        <p 
          className="text-[12px] text-neutral-500 dark:text-neutral-400"
          style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
        >
          Manage your account data and authentication settings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Col: Details */}
        <div className="md:col-span-2 flex flex-col gap-6">
          <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 transition-colors">
            <h2 className="text-[14px] font-semibold text-neutral-900 dark:text-white uppercase tracking-wider mb-6" style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}>
              Identity Configuration
            </h2>

            {isFetching ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 text-neutral-400 animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase tracking-widest flex items-center gap-2 mb-2" style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}>
                    <Hash className="w-3.5 h-3.5" /> Identity UID
                  </label>
                  <p className="text-[14px] text-neutral-900 dark:text-white font-medium bg-neutral-50 dark:bg-neutral-900 px-4 py-3 rounded-lg border border-neutral-100 dark:border-neutral-800" style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}>
                    {user.id}
                  </p>
                </div>
                
                <div>
                  <label className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase tracking-widest flex items-center gap-2 mb-2" style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}>
                    <Mail className="w-3.5 h-3.5" /> Registered Email
                  </label>
                  <p className="text-[14px] text-neutral-900 dark:text-white font-medium bg-neutral-50 dark:bg-neutral-900 px-4 py-3 rounded-lg border border-neutral-100 dark:border-neutral-800" style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}>
                    {user.email}
                  </p>
                </div>

                <div>
                  <label className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase tracking-widest flex items-center gap-2 mb-2" style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}>
                    <User className="w-3.5 h-3.5" /> VaultStream Username
                  </label>
                  <p className="text-[14px] text-neutral-900 dark:text-white font-medium bg-neutral-50 dark:bg-neutral-900 px-4 py-3 rounded-lg border border-neutral-100 dark:border-neutral-800" style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}>
                    {profileData?.username || 'Loading...'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Stats & Danger */}
        <div className="flex flex-col gap-6">
          <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 transition-colors">
            <h2 className="text-[14px] font-semibold text-neutral-900 dark:text-white uppercase tracking-wider mb-6" style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}>
              Ledger Metrics
            </h2>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                  <Wallet className="w-4 h-4" />
                  <span className="text-[11px] uppercase tracking-wider" style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}>Balance</span>
                </div>
                <span className="text-[16px] font-bold text-neutral-900 dark:text-white tabular-nums">
                  ₹{profileData?.balance.toLocaleString('en-IN') || '0.00'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                  <Activity className="w-4 h-4" />
                  <span className="text-[11px] uppercase tracking-wider" style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}>Transactions</span>
                </div>
                <span className="text-[16px] font-bold text-neutral-900 dark:text-white tabular-nums">
                  {profileData?.tx_count || 0}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl p-6 transition-colors mt-auto">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-500" />
              <h2 className="text-[14px] font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider" style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}>
                Danger Zone
              </h2>
            </div>
            <p className="text-[12px] text-red-600/80 dark:text-red-400/80 mb-5 leading-relaxed" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
              Permanently delete your account, purge all ledger history, and remove your identity from the network. This action cannot be undone.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors duration-200"
              style={{ fontFamily: '"Geist Mono", "Courier New", monospace', fontSize: '11px', letterSpacing: '0.05em' }}
            >
              <Trash2 className="w-4 h-4" />
              DELETE ACCOUNT
            </button>
          </div>
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => !isDeleting && setIsModalOpen(false)}
            />
            
            {/* Modal Content */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-[18px] font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-red-500" />
                    Confirm Deletion
                  </h3>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    disabled={isDeleting}
                    className="p-1 rounded-md text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <p className="text-[14px] text-neutral-600 dark:text-neutral-400 mb-6 leading-relaxed" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
                  This will permanently delete your account, <strong className="text-neutral-900 dark:text-white">₹{profileData?.balance.toLocaleString('en-IN') || 0}</strong> in unwithdrawn ledger balance, and purge your history from the global ranking engine. 
                  <br /><br />
                  Please type <strong className="text-red-500 select-none">DELETE</strong> to confirm.
                </p>

                <input 
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  disabled={isDeleting}
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-3 text-[14px] font-bold text-center text-neutral-900 dark:text-white placeholder:font-normal focus:outline-none focus:border-red-500 dark:focus:border-red-500 transition-colors mb-6"
                  style={{ fontFamily: '"Geist Mono", "Courier New", monospace', letterSpacing: '0.1em' }}
                />

                <div className="flex gap-3">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    disabled={isDeleting}
                    className="flex-1 py-3 px-4 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                    style={{ fontFamily: '"Geist Mono", "Courier New", monospace', fontSize: '12px' }}
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeleting || confirmText !== 'DELETE'}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    style={{ fontFamily: '"Geist Mono", "Courier New", monospace', fontSize: '12px' }}
                  >
                    {isDeleting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> PURGING...</>
                    ) : (
                      'CONFIRM'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
