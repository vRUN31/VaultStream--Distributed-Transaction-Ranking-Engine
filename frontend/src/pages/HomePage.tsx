import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FeatureCard } from '../components/FeatureCard';
import { AuthModal } from '../components/AuthModal';
import type { AuthMode } from '../components/AuthModal';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface HomePageProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export function HomePage({ theme, toggleTheme }: HomePageProps) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const { user } = useAuth();
  const navigate = useNavigate();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
  };

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('update-password');
        setIsAuthModalOpen(true);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const openAuthModal = (mode: AuthMode = 'login') => {
    if (user) {
      navigate('/dashboard');
      return;
    }
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  return (
    <div className="bg-background text-on-surface min-h-screen overflow-x-hidden font-body-md bg-grid-pattern">
      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 dark:bg-surface/80 backdrop-blur-xl border-b border-black/10 dark:border-white/10 transition-colors">
        <div className="flex justify-between items-center h-16 px-margin-desktop max-w-container-max-width mx-auto">
          <div className="flex items-center gap-4">
            <div className="font-display text-[18px] tracking-[0.12em] text-primary uppercase flex items-center gap-2 font-semibold">
              VaultStream
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-center text-on-surface"
              aria-label="Toggle Theme"
            >
              <span className="material-symbols-outlined text-[20px]">
                {theme === 'light' ? 'dark_mode' : 'light_mode'}
              </span>
            </button>
            <button 
              onClick={() => openAuthModal()}
              className="bg-primary text-on-primary font-label-sm text-label-sm px-6 py-2 rounded-DEFAULT hover:bg-primary-fixed-dim transition-colors active:scale-95 duration-200 flex items-center gap-2"
            >
              Launch Console
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 pt-32 pb-24 px-margin-desktop max-w-container-max-width mx-auto min-h-[calc(100vh-200px)] flex flex-col justify-center">
        {/* Hero Section */}
        <motion.div 
          className="text-center max-w-4xl mx-auto mb-24"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >

          <motion.h1 variants={itemVariants} className="text-display font-display mb-8 text-gradient italic">
            High-Throughput Concurrent<br className="hidden md:block" />{" "}Financial Ledger.
          </motion.h1>
          <motion.p variants={itemVariants} className="text-body-lg font-body-lg text-on-surface-variant max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            An immutable transactional ledger engine designed for absolute precision, real-time balance propagation, and multi-factor account ranking under heavy concurrent loads.
          </motion.p>
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-center gap-4 items-center">
            <button 
              onClick={() => navigate('/dashboard/leaderboard')}
              className="bg-primary text-on-primary font-headline-md text-[14px] tracking-wide px-8 py-3.5 rounded-DEFAULT hover:bg-primary-fixed-dim transition-all active:scale-95 duration-200 flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              <span className="material-symbols-outlined text-[18px]">monitoring</span>
              View Live Rankings
            </button>
          </motion.div>
        </motion.div>

        {/* 3D Feature Grid */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <motion.div variants={itemVariants} className="h-full">
            <FeatureCard 
              icon="lock"
              title="Atomic Serialization"
              description="Guarantees absolute account balance integrity during simultaneous multi-client execution states. Prevents race-condition vulnerabilities automatically."
            />
          </motion.div>
          <motion.div variants={itemVariants} className="h-full">
            <FeatureCard 
              icon="fingerprint"
              title="Stateless Verification"
              description="Utilizes decentralized, cryptographically signed access tokens to validate client identities locally in real-time, keeping submission latencies at a minimum."
              isMiddle={true}
            />
          </motion.div>
          <motion.div variants={itemVariants} className="h-full">
            <FeatureCard 
              icon="database"
              title="Immutable Event Streams"
              description="Every credit and debit entry is recorded as a permanent chronological event, guaranteeing comprehensive mathematical auditing."
            />
          </motion.div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full py-8 px-margin-desktop bg-surface-container-lowest border-t border-black/5 dark:border-white/5 relative z-10 transition-colors">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 max-w-container-max-width mx-auto text-body-sm text-on-surface-variant">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-center sm:text-left">
            <span className="font-code-md text-primary font-medium">VaultStream Protocol</span>
            <span className="hidden sm:inline text-black/20 dark:text-white/20">|</span>
            <span>© 2026 VaultStream Systems. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 font-label-sm text-label-sm">
            <a href="#docs" className="hover:text-primary transition-colors">Documentation</a>
            <a href="#api" className="hover:text-primary transition-colors">API Reference</a>
            <a href="#github" className="hover:text-primary transition-colors">GitHub</a>
            <a href="#status" className="hover:text-primary transition-colors flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary-container animate-pulse shadow-[0_0_5px_var(--glow-shadow-secondary)]"></span>
              Status
            </a>
          </div>
        </div>
      </footer>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} initialMode={authMode} />
    </div>
  );
}
