import { Outlet, Navigate, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  LayoutDashboard,
  History,
  Trophy,
  LogOut,
  Sun,
  Moon,
  Wifi,
  PanelLeftClose,
  PanelLeftOpen,
  User,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardLayoutProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, exact: true },
  { name: 'Transaction insights', path: '/dashboard/history', icon: History },
  { name: 'Leaderboard', path: '/dashboard/leaderboard', icon: Trophy },
  { name: 'Profile', path: '/dashboard/profile', icon: User },
];

export function DashboardLayout({ theme, toggleTheme }: DashboardLayoutProps) {
  const { user, loading } = useAuth();
  const [latency, setLatency] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const measure = () => {
      const start = performance.now();
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      fetch(`${API_URL}/health`, { method: 'HEAD' })
        .then(() => setLatency(Math.round(performance.now() - start)))
        .catch(() => setLatency(null));
    };
    measure();
    const id = setInterval(measure, 10000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 border-neutral-900 dark:border-white border-t-transparent animate-spin" />
      </div>
    );
  }

  const location = useLocation();
  const isPublicRoute = location.pathname === '/dashboard/leaderboard';

  if (!user && !isPublicRoute) {
    return <Navigate to="/" replace />;
  }

  const username =
    user?.user_metadata?.username ||
    user?.email?.split('@')[0] ||
    'Guest';

  const displayInitial = username.charAt(0).toUpperCase();

  return (
    <div className="flex h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 overflow-hidden transition-colors duration-300">

      {/* ── SIDEBAR OVERLAY (when open, dims behind it) ──────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="fixed inset-0 z-20 pointer-events-none"
            style={{ background: 'transparent' }}
          />
        )}
      </AnimatePresence>

      {/* ── LEFT SIDEBAR — slides over main layout ─────────── */}
      <motion.aside
        initial={false}
        animate={{
          x: sidebarOpen ? 0 : -260,
          boxShadow: sidebarOpen
            ? '4px 0 32px 0 rgba(0,0,0,0.10)'
            : '0 0 0 0 rgba(0,0,0,0)',
        }}
        transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
        className="fixed top-0 left-0 h-full w-[260px] z-30 flex flex-col bg-white dark:bg-neutral-950 border-r border-neutral-100 dark:border-neutral-800/60 transition-colors duration-300"
        style={{ willChange: 'transform' }}
      >
        {/* ── Brand header ── */}
        <div className="px-5 pt-6 pb-5 border-b border-neutral-100 dark:border-neutral-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo mark */}
            <div className="w-8 h-8 rounded-xl bg-neutral-900 dark:bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <span
                className="text-white dark:text-neutral-900 font-black text-[11px] tracking-widest"
                style={{ fontFamily: '"Outfit", system-ui, sans-serif', letterSpacing: '0.12em' }}
              >
                VS
              </span>
            </div>
            <div>
              <p
                className="text-[15px] font-bold text-neutral-900 dark:text-white leading-none tracking-tight"
                style={{ fontFamily: '"Outfit", system-ui, sans-serif' }}
              >
                VaultStream
              </p>
              <p
                className="text-[9px] text-neutral-400 dark:text-neutral-600 tracking-[0.18em] uppercase leading-none mt-1"
                style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
              >
                Ledger v1.0
              </p>
            </div>
          </div>
          {/* Close toggle */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg text-neutral-400 dark:text-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-150"
            aria-label="Close sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* ── Section label ── */}
        <div className="px-5 pt-5 pb-2">
          <p
            className="text-[9px] font-semibold tracking-[0.18em] text-neutral-400 dark:text-neutral-600 uppercase"
            style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
          >
            Navigation
          </p>
        </div>

        {/* ── Nav items ── */}
        <nav className="flex-1 px-3 pb-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.filter(item => user || item.path === '/dashboard/leaderboard').map((item) => {
            const Icon = item.icon;
            if (item.disabled) {
              return (
                <div
                  key={item.path}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-neutral-300 dark:text-neutral-700 cursor-not-allowed select-none"
                >
                  <Icon className="w-[15px] h-[15px] flex-shrink-0" />
                  <span
                    className="text-[13px] font-medium flex-1"
                    style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
                  >
                    {item.name}
                  </span>
                  <span
                    className="text-[9px] bg-neutral-100 dark:bg-neutral-800/60 text-neutral-400 dark:text-neutral-600 px-1.5 py-0.5 rounded-md tracking-[0.12em] uppercase"
                    style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
                  >
                    Soon
                  </span>
                </div>
              );
            }
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.exact}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group ${
                    isActive
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm'
                      : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 hover:text-neutral-900 dark:hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-[15px] h-[15px] flex-shrink-0 ${isActive ? '' : 'opacity-70 group-hover:opacity-100'}`} />
                    <span
                      className={`text-[13px] flex-1 ${isActive ? 'font-semibold' : 'font-medium'}`}
                      style={{ fontFamily: '"DM Sans", system-ui, sans-serif', letterSpacing: '-0.005em' }}
                    >
                      {item.name}
                    </span>
                    {isActive && (
                      <div className="w-1 h-1 rounded-full bg-white dark:bg-neutral-900 opacity-60" />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* ── Divider ── */}
        <div className="mx-5 h-px bg-neutral-100 dark:bg-neutral-800/60" />

        <div className="px-3 py-4 space-y-0.5">
          {user ? (
            <>
              {/* Profile row */}
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
                {/* Avatar */}
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-neutral-700 dark:to-neutral-800 flex items-center justify-center flex-shrink-0 ring-1 ring-neutral-200 dark:ring-neutral-700">
                  <span
                    className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300"
                    style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
                  >
                    {displayInitial}
                  </span>
                </div>
                <div className="min-w-0">
                  <p
                    className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300 truncate leading-tight"
                    style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
                  >
                    {username}
                  </p>
                  <p
                    className="text-[10px] text-neutral-400 dark:text-neutral-600 leading-tight tracking-wide"
                    style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
                  >
                    @{username}
                  </p>
                </div>
              </div>
              {/* Sign out */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-neutral-400 dark:text-neutral-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-200 group"
              >
                <LogOut className="w-[15px] h-[15px] flex-shrink-0 opacity-70 group-hover:opacity-100" />
                <span
                  className="text-[13px] font-medium"
                  style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
                >
                  Sign out
                </span>
              </button>
            </>
          ) : (
            <NavLink
              to="/"
              className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-neutral-400 dark:text-neutral-600 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-all duration-200 group"
            >
              <LogOut className="w-[15px] h-[15px] flex-shrink-0 opacity-70 group-hover:opacity-100 rotate-180" />
              <span
                className="text-[13px] font-medium"
                style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
              >
                Back to Home
              </span>
            </NavLink>
          )}
        </div>
      </motion.aside>

      {/* ── MAIN WORKSPACE — always full width ──────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden w-full">

        {/* ── Workspace header bar ── */}
        <header className="h-11 flex-shrink-0 bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800/60 flex items-center justify-between px-4 z-20 transition-colors duration-300">

          {/* Left: sidebar toggle + system status */}
          <div className="flex items-center gap-3">
            {/* Sidebar toggle button */}
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="p-1.5 rounded-lg text-neutral-400 dark:text-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-150"
              aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              <AnimatePresence mode="wait" initial={false}>
                {sidebarOpen ? (
                  <motion.span
                    key="close"
                    initial={{ opacity: 0, rotate: -10 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 10 }}
                    transition={{ duration: 0.18 }}
                    className="block"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="open"
                    initial={{ opacity: 0, rotate: 10 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: -10 }}
                    transition={{ duration: 0.18 }}
                    className="block"
                  >
                    <PanelLeftOpen className="w-4 h-4" />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            {/* Separator */}
            <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-800" />

            {/* System status */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[11px] text-neutral-500 dark:text-neutral-500 tracking-wide"
                  style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
                >
                  System Status
                </span>
                <span
                  className="text-[11px] text-neutral-300 dark:text-neutral-700"
                  style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
                >
                  //
                </span>
                <Wifi className="w-3 h-3 text-neutral-400 dark:text-neutral-600" />
                <span
                  className="text-[11px] text-neutral-400 dark:text-neutral-500"
                  style={{ fontFamily: '"Geist Mono", "Courier New", monospace' }}
                >
                  Latency:{' '}
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {latency !== null ? `${latency}ms` : '—'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Right: theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-150"
            aria-label="Toggle theme"
          >
            <AnimatePresence mode="wait" initial={false}>
              {theme === 'light' ? (
                <motion.span
                  key="moon"
                  initial={{ opacity: 0, rotate: -20, scale: 0.8 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 20, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  className="block"
                >
                  <Moon className="w-4 h-4" />
                </motion.span>
              ) : (
                <motion.span
                  key="sun"
                  initial={{ opacity: 0, rotate: 20, scale: 0.8 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: -20, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  className="block"
                >
                  <Sun className="w-4 h-4" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </header>

        {/* ── Scrollable content area ── */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
