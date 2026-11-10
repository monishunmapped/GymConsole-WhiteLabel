import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ShieldAlert, 
  Smartphone, 
  ArrowRight
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { useBrand } from '../lib/brand';
import { SecurityConfig, UserSession } from '../types';

interface LoginWindowProps {
  onLoginSuccess: (session: UserSession) => void;
  onBypassToPortal: () => void;
  securityConfig: SecurityConfig;
}

export function LoginWindow({ onLoginSuccess, onBypassToPortal, securityConfig }: LoginWindowProps) {
  const brand = useBrand();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    const accounts = [
      { email: securityConfig.ownerEmail, password: securityConfig.ownerPassword, role: 'Owner' as const },
      { email: securityConfig.adminEmail, password: securityConfig.adminPassword, role: 'Admin' as const },
    ];
    const match = accounts.find(a => a.email.toLowerCase() === trimmedEmail && a.password === password);
    if (match) onLoginSuccess({ email: match.email, role: match.role });
    else setError('Invalid email or password.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 font-sans tracking-normal select-none transition-colors duration-150">
      
      <div className="max-w-md w-full space-y-6">
        
        <div className="text-center space-y-3">
          <BrandLogo size={64} className="mx-auto shadow-xl" />
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight leading-none">
              {brand.name}
            </h1>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-2">
              {brand.tagline} • Staff Console
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden transition-colors duration-150">
          
          <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500"></div>

          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest text-center mb-6">
            STAFF SECURITY GATE
          </h3>

          <form onSubmit={handleLogin} className="space-y-4">
            
            <div className="space-y-1 text-left">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Security Identifier (Email)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <Mail className="w-4 h-4 text-slate-400/90" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs font-semibold pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 dark:focus:ring-indigo-500/20 transition-all font-sans text-slate-900 dark:text-slate-100 placeholder-slate-400"
                  id="login-email-input"
                />
              </div>
            </div>

            <div className="space-y-1 text-left">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Security Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <Lock className="w-4 h-4 text-slate-400/90" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs font-semibold pl-10 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 dark:focus:ring-indigo-500/20 transition-all font-sans text-slate-900 dark:text-slate-100 placeholder-slate-400"
                  id="login-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                  title={showPassword ? 'Hide Password' : 'Show Password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div 
                className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-[11px] text-rose-600 dark:text-rose-400 font-medium text-left leading-relaxed flex gap-2.5 items-start mt-2 animate-shake"
                id="login-error-msg"
              >
                <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl font-sans font-bold text-xs uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-indigo-450 dark:disabled:bg-indigo-950/50 transition-all duration-150 cursor-pointer shadow-md select-none mt-2 flex justify-center items-center gap-2"
              id="login-submit-btn"
            >
              <span>Unlock Gym Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        <div className="text-center pt-2 select-none">
          <button
            type="button"
            onClick={onBypassToPortal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-sky-500 dark:text-sky-450 hover:text-sky-650 dark:hover:text-sky-350 transition-colors bg-sky-500/5 hover:bg-sky-500/10 rounded-xl cursor-pointer"
            id="login-bypass-kiosk-btn"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Open Public Member self-Check-In Portal</span>
          </button>
        </div>

      </div>
    </div>
  );
}
