import { useState, FormEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import { X, Mail, Lock, User, Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export type AuthMode = 'login' | 'signup' | 'forgot-password' | 'update-password';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
}

export function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (mode !== 'signup' || username.length < 3) {
      setIsUsernameAvailable(null);
      return;
    }
    
    const timer = setTimeout(async () => {
      setIsCheckingUsername(true);
      try {
        const res = await axios.get(`http://localhost:8000/auth/check-username?username=${username}`);
        setIsUsernameAvailable(res.data.available);
      } catch (err) {
        setIsUsernameAvailable(null);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username, mode]);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setShowPassword(false);
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    setShowPassword(false);
  }, [mode]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === 'login') {
        try {
          const res = await axios.post('http://localhost:8000/auth/login', { email, password });
          const { access_token, refresh_token } = res.data;
          
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token
          });
          
          if (error) throw error;
          
          showToast('Successfully logged in!', 'success');
          onClose();
          navigate('/dashboard');
        } catch (err: any) {
          if (err.response && err.response.status === 429) {
            throw new Error(err.response.data.detail || "Too many failed attempts. Please wait 5 minutes.");
          } else if (err.response && err.response.data && err.response.data.detail) {
            throw new Error(err.response.data.detail);
          }
          throw err;
        }
      } else if (mode === 'signup') {
        if (isUsernameAvailable === false) {
           showToast('Please choose a different username', 'error');
           setIsLoading(false);
           return;
        }
        
        try {
          const res = await axios.post('http://localhost:8000/auth/register', { email, password, username });
          
          if (res.data.access_token) {
             const { error } = await supabase.auth.setSession({
               access_token: res.data.access_token,
               refresh_token: res.data.refresh_token
             });
             if (error) throw error;
          }
          
          showToast('Account created successfully!', 'success');
        } catch (err: any) {
          if (err.response && err.response.status === 429) {
            throw new Error("Too many sign up attempts. Please try again later.");
          } else if (err.response && err.response.data && err.response.data.detail) {
            throw new Error(err.response.data.detail);
          }
          throw err;
        }
      } else if (mode === 'forgot-password') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        showToast('Password reset link sent! Check your email.', 'success');
        setMode('login');
      } else if (mode === 'update-password') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        showToast('Password updated successfully!', 'success');
        setTimeout(onClose, 1000);
      }
    } catch (err: any) {
      showToast(err.message || 'An error occurred during authentication.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = () => {
    if (mode === 'login') return 'Welcome Back';
    if (mode === 'signup') return 'Create Account';
    if (mode === 'forgot-password') return 'Reset Password';
    if (mode === 'update-password') return 'Set New Password';
  };

  const getSubtitle = () => {
    if (mode === 'login') return 'Enter your credentials to access the console.';
    if (mode === 'signup') return 'Join VaultStream for high-throughput transactions.';
    if (mode === 'forgot-password') return 'Enter your email to receive a recovery link.';
    if (mode === 'update-password') return 'Enter your new secure password.';
  };

  const formVariants = {
    hidden: { opacity: 0, x: -20, filter: 'blur(4px)' },
    visible: { opacity: 1, x: 0, filter: 'blur(0px)' },
    exit: { opacity: 0, x: 20, filter: 'blur(4px)', transition: { duration: 0.15 } }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl bg-[#fdfbf7] dark:bg-[#050505] border border-black/5 dark:border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-2xl backdrop-blur-md"
          >

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-on-surface-variant hover:text-primary transition-colors z-20"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8 relative z-10 min-h-[460px] flex flex-col">
              <AnimatePresence mode="wait">
                <motion.div
                  key={mode + "-header"}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={formVariants}
                  transition={{ duration: 0.2 }}
                  className="text-center mb-8"
                >
                  <h2 className="font-display text-[36px] italic font-semibold text-primary mb-2 leading-tight">
                    {getTitle()}
                  </h2>
                  <p className="text-on-surface-variant text-body-md font-body-md font-light">
                    {getSubtitle()}
                  </p>
                </motion.div>
              </AnimatePresence>

              <div className="flex-1 relative">
                <AnimatePresence mode="wait">
                  <motion.form
                    key={mode + "-form"}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={formVariants}
                    transition={{ duration: 0.2 }}
                    onSubmit={handleSubmit}
                    className="space-y-5"
                  >
                    {mode === 'signup' && (
                      <div className="space-y-1">
                        <label className="text-label-sm font-label-sm text-on-surface-variant ml-1 tracking-widest uppercase">Username</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                            <User className="w-5 h-5" />
                          </div>
                          <input
                            type="text"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className={`w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg py-3 pl-10 pr-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 transition-colors ${
                              username.length >= 3 && isUsernameAvailable === false ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 
                              username.length >= 3 && isUsernameAvailable === true ? 'border-green-500 focus:border-green-500 focus:ring-green-500' :
                              'focus:border-primary focus:ring-primary'
                            }`}
                            placeholder="Choose a username"
                          />
                        </div>
                        {mode === 'signup' && username.length >= 3 && (
                          <div className={`text-xs mt-1 ml-1 flex items-center gap-1 ${
                            isCheckingUsername ? 'text-on-surface-variant' : 
                            isUsernameAvailable ? 'text-green-500' : 'text-red-500'
                          }`}>
                             {isCheckingUsername ? (
                               <span>Checking availability...</span>
                             ) : isUsernameAvailable ? (
                               <span>Username is available</span>
                             ) : (
                               <span>Username is already taken</span>
                             )}
                          </div>
                        )}
                      </div>
                    )}

                    {(mode === 'login' || mode === 'signup' || mode === 'forgot-password') && (
                      <div className="space-y-1">
                        <label className="text-label-sm font-label-sm text-on-surface-variant ml-1 tracking-widest uppercase">Email</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                            <Mail className="w-5 h-5" />
                          </div>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg py-3 pl-10 pr-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                            placeholder="you@example.com"
                          />
                        </div>
                      </div>
                    )}

                    {(mode === 'login' || mode === 'signup' || mode === 'update-password') && (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center ml-1">
                          <label className="text-label-sm font-label-sm text-on-surface-variant tracking-widest uppercase">Password</label>
                          {mode === 'login' && (
                            <button
                              type="button"
                              onClick={() => setMode('forgot-password')}
                              className="text-label-sm text-primary hover:text-primary-fixed-dim transition-colors"
                            >
                              Forgot Password?
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                            <Lock className="w-5 h-5" />
                          </div>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg py-3 pl-10 pr-10 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface-variant hover:text-primary transition-colors focus:outline-none"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-primary text-on-primary font-headline-md text-[15px] tracking-wide py-3 rounded-lg hover:bg-primary-fixed-dim transition-all active:scale-[0.98] duration-200 flex items-center justify-center gap-2 btn-primary-glow disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : mode === 'login' ? (
                        'Access Console'
                      ) : mode === 'signup' ? (
                        'Initialize Account'
                      ) : mode === 'forgot-password' ? (
                        'Send Reset Link'
                      ) : (
                        'Update Password'
                      )}
                    </button>

                    <div className="mt-6 text-center">
                      <p className="text-on-surface-variant text-body-sm">
                        {mode === 'login' && (
                          <>
                            Don't have an account?{' '}
                            <button
                              type="button"
                              onClick={() => setMode('signup')}
                              className="text-primary hover:text-primary-fixed-dim transition-colors font-medium focus:outline-none"
                            >
                              Sign Up
                            </button>
                          </>
                        )}
                        {mode === 'signup' && (
                          <>
                            Already have an account?{' '}
                            <button
                              type="button"
                              onClick={() => setMode('login')}
                              className="text-primary hover:text-primary-fixed-dim transition-colors font-medium focus:outline-none"
                            >
                              Log In
                            </button>
                          </>
                        )}
                        {(mode === 'forgot-password' || mode === 'update-password') && (
                          <button
                            type="button"
                            onClick={() => setMode('login')}
                            className="text-primary hover:text-primary-fixed-dim transition-colors font-medium focus:outline-none flex items-center justify-center gap-1 mx-auto"
                          >
                            <ArrowLeft className="w-4 h-4" /> Back to Log In
                          </button>
                        )}
                      </p>
                    </div>
                  </motion.form>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
