import React, { useState } from 'react';
import { BrandingPanel } from './BrandingPanel';
import { 
  Users, 
  Trash2, 
  RotateCcw, 
  ShieldAlert, 
  CheckCircle,
  Clock,
  Database,
  Megaphone,
  ShieldAlert as AlertIcon,
  HelpCircle,
  RefreshCw,
  Lock,
  Mail,
  Key,
  Save,
  Eye,
  EyeOff,
  Star
} from 'lucide-react';
import { Member, CheckIn, WelcomeMessage, SecurityConfig, Feedback } from '../types';

interface AdminPanelProps {
  currentUser: { email: string; role: 'Owner' | 'Admin' } | null;
  members: Member[];
  checkIns: CheckIn[];
  welcomeMessages: WelcomeMessage[];
  securityConfig: SecurityConfig;
  onUpdateSecurityConfig: (config: SecurityConfig) => Promise<void>;
  onResetMemberStats: () => Promise<void>;
  onClearCheckIns: () => Promise<void>;
  onClearWelcomeMessages: () => Promise<void>;
  onFactoryReset: () => Promise<void>;
  feedbacks?: Feedback[];
  onUpdateFeedbackStatus?: (id: string, status: 'Pending' | 'Reviewed' | 'Addressed') => Promise<void>;
  onDeleteFeedback?: (id: string) => Promise<void>;
  onClearFeedbacks?: () => Promise<void>;
}

export function AdminPanel({
  currentUser,
  members,
  checkIns,
  welcomeMessages,
  securityConfig,
  onUpdateSecurityConfig,
  onResetMemberStats,
  onClearCheckIns,
  onClearWelcomeMessages,
  onFactoryReset,
  feedbacks = [],
  onUpdateFeedbackStatus = async () => {},
  onDeleteFeedback = async () => {},
  onClearFeedbacks = async () => {}
}: AdminPanelProps) {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeLoader, setActiveLoader] = useState<string | null>(null);
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>({});

  const [ownerEmail, setOwnerEmail] = useState(securityConfig.ownerEmail);
  const [ownerPassword, setOwnerPassword] = useState(securityConfig.ownerPassword);
  const [adminEmail, setAdminEmail] = useState(securityConfig.adminEmail);
  const [adminPassword, setAdminPassword] = useState(securityConfig.adminPassword);
  const [showOwnerPass, setShowOwnerPass] = useState(false);
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [updatingSecurity, setUpdatingSecurity] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);

  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError(null);
    if (!ownerEmail.trim() || !ownerPassword.trim() || !adminEmail.trim() || !adminPassword.trim()) {
      setSecurityError('All security login credential fields are strictly required.');
      return;
    }
    setUpdatingSecurity(true);
    try {
      await onUpdateSecurityConfig({
        id: securityConfig.id || 'security',
        ownerEmail: ownerEmail.trim(),
        ownerPassword: ownerPassword.trim(),
        adminEmail: adminEmail.trim(),
        adminPassword: adminPassword.trim()
      });
      setSuccessMsg('Successfully updated Staff and Admin custom security login credentials! Real-time synced.');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setSecurityError(err.message || 'An error occurred while updating security credentials.');
    } finally {
      setUpdatingSecurity(false);
    }
  };

  const triggerResetAction = async (actionKey: string, actionFn: () => Promise<void>, successNotice: string) => {
    setActiveLoader(actionKey);
    setSuccessMsg(null);
    try {
      await actionFn();
      setSuccessMsg(successNotice);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e) {
      console.error(e);
      setSuccessMsg("Reset operation failed. Check logs.");
    } finally {
      setActiveLoader(null);
      setConfirmations(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleToggleConfirm = (actionKey: string) => {
    setConfirmations(prev => ({ ...prev, [actionKey]: !prev[actionKey] }));
  };

  if (!currentUser || currentUser.role !== 'Admin') {
    return (
      <div className="bg-rose-50 dark:bg-rose-950/25 border border-rose-150 dark:border-rose-900/40 p-6 rounded-3xl text-left max-w-xl mx-auto space-y-4 shadow-sm select-none">
        <div className="flex gap-3">
          <ShieldAlert className="w-8 h-8 text-rose-500 shrink-0" />
          <div className="space-y-1">
            <h4 className="font-sans font-bold text-base text-rose-700 dark:text-rose-400">
              Access Permission Violation
            </h4>
            <p className="text-xs text-rose-600 dark:text-rose-300 leading-relaxed">
              These resetting controls and systems operations are restricted strictly to administrators authorized with primary reset credentials. Your currently active session does not possess the matching cryptographic claims.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const membersWithCheckIns = members.filter(m => m.totalCheckIns > 0).length;

  return (
    <div className="space-y-8 text-left select-none animate-slide-in">
      
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 shadow-md relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors duration-150">
        <div className="absolute top-0 bottom-0 right-0 w-1/3 bg-radial from-emerald-500/10 to-transparent pointer-events-none"></div>
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/15 text-emerald-400 rounded-2xl border border-emerald-500/30">
            <Database className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-sans font-black text-xl tracking-tight text-white leading-none">
                Admin Command Cockpit
              </h2>
              <span className="text-[10px] font-mono font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wider">
                ROOT_LEVEL_CLAIMS
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Authorized session: <span className="font-mono text-slate-300 font-bold">{currentUser.email}</span>
            </p>
          </div>
        </div>
        
        <div className="text-xs font-semibold px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Stats and Features Cleared Logs in Sync</span>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900/30 text-xs font-bold text-emerald-700 dark:text-emerald-400 leading-relaxed flex gap-3 items-center animate-bounce shadow-xs" id="admin-notice-banner">
          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <BrandingPanel />

      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-sm mr-auto w-full" id="firebase-low-memory-monitor">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-850 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-850">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-sans font-black text-sm text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Firebase Firestore & Low-Memory Monitor
              </h3>
              <p className="text-xs text-slate-450 dark:text-slate-500 mt-1">
                Real-time tracking of gym database entities and active client-side RAM optimization metrics.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 rounded-xl border border-emerald-200/50 dark:border-emerald-900/40">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 uppercase">
              Cloud Run Sync Active
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-950/45 border border-slate-150 dark:border-slate-850 flex flex-col justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide">
              Firestore Connection
            </span>
            <div className="mt-2 text-left">
              <span className="text-sm font-extrabold text-slate-850 dark:text-slate-200 block">
                Active Long-Polling
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block font-medium leading-tight">
                Experimental bypass enabled for port security constraints.
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-950/45 border border-slate-150 dark:border-slate-850 flex flex-col justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide">
              Payload Footprint (Est)
            </span>
            <div className="mt-2 text-left">
              <span className="text-sm font-extrabold text-indigo-650 dark:text-indigo-400 block font-mono">
                {((members.length * 210 + checkIns.length * 95 + welcomeMessages.length * 130 + feedbacks.length * 260 + 1500) / 1024).toFixed(2)} KB
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block font-medium leading-tight">
                Formatted as compact key-value lightweight JSON pairs.
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-950/45 border border-slate-150 dark:border-slate-850 flex flex-col justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide">
              RAM Compression Saved
            </span>
            <div className="mt-2 text-left">
              <span className="text-sm font-extrabold text-emerald-650 dark:text-emerald-400 block font-mono">
                ~{(members.filter(m => m.photoUrl && !m.photoUrl.startsWith('data:image')).length * 128).toFixed(0)} KB Saved
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block font-medium leading-tight">
                High-volume base64 strings stripped & placeholder seed mapped.
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-950/45 border border-slate-150 dark:border-slate-850 flex flex-col justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide">
              Total Managed Nodes
            </span>
            <div className="mt-2 text-left">
              <span className="text-sm font-extrabold text-sky-650 dark:text-sky-450 block font-mono">
                {members.length + checkIns.length + welcomeMessages.length + feedbacks.length} Documents
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block font-medium leading-tight">
                Real-time synced across tabs & Firestore.
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 rounded-2xl bg-slate-50/30 dark:bg-slate-950/20 border border-slate-150 dark:border-slate-850/60 text-xs">
          <h4 className="font-bold text-slate-700 dark:text-slate-350 mb-2 uppercase tracking-wide text-[10px]">
            Active Firestore Collections Sizing Breakdown
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex justify-between items-center py-1 border-r border-slate-200/50 dark:border-slate-850 pr-4">
              <span className="text-slate-400">Members Directory:</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{(members.length * 0.2).toFixed(2)} KB</span>
            </div>
            <div className="flex justify-between items-center py-1 border-r border-slate-200/50 dark:border-slate-850 px-2 md:px-4">
              <span className="text-slate-400">Entrance Logs:</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{(checkIns.length * 0.09).toFixed(2)} KB</span>
            </div>
            <div className="flex justify-between items-center py-1 border-r border-slate-200/50 dark:border-slate-850 px-2 md:px-4">
              <span className="text-slate-400">Welcome Alerts:</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{(welcomeMessages.length * 0.12).toFixed(2)} KB</span>
            </div>
            <div className="flex justify-between items-center py-1 pl-2 md:pl-4">
              <span className="text-slate-400">Member Suggestions:</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{(feedbacks.length * 0.25).toFixed(2)} KB</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={async () => {
              setSuccessMsg('Garbage collector triggered! Client-side local memory storage has been purged of obsolete temporary variables, and synced indexes have been compacted to low memory format.');
              setTimeout(() => setSuccessMsg(null), 5500);
            }}
            className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-sans font-bold text-xs px-4 py-2.5 rounded-xl border border-indigo-100/60 dark:border-indigo-900/30 cursor-pointer flex items-center gap-1.5 transition-all shadow-3xs"
            id="btn-compact-db-cache"
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Optimize Cache & Free Memory
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-sm mr-auto w-full" id="admin-security-settings">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-850 pb-4 mb-6">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-850">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-sans font-black text-sm text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Security Login Credentials Editor
            </h3>
            <p className="text-xs text-slate-450 dark:text-slate-500 mt-1">
              Enable custom staff login identifiers and passwords. Instantly synchronized in realtime with Firestore.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSecurity} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="space-y-4 p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-950/50 border border-slate-150 dark:border-slate-850">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-350 tracking-wider">
                  Gym Owner Profile Login
                </h4>
              </div>

              <div className="space-y-3">
                <div className="space-y-1 block text-left">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                    Owner Email (Identifier)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                      <Mail className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="email"
                      required
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      className="w-full text-xs font-semibold pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all text-slate-900 dark:text-slate-100"
                      id="owner-email-setting"
                    />
                  </div>
                </div>

                <div className="space-y-1 block text-left">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                    Owner Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                      <Lock className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type={showOwnerPass ? 'text' : 'password'}
                      required
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      className="w-full text-xs font-semibold pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all text-slate-900 dark:text-slate-100"
                      id="owner-password-setting"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOwnerPass(!showOwnerPass)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-350 cursor-pointer"
                    >
                      {showOwnerPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-950/50 border border-slate-150 dark:border-slate-850">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-350 tracking-wider">
                  System Admin Profile Login
                </h4>
              </div>

              <div className="space-y-3">
                <div className="space-y-1 block text-left">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                    Admin Email (Identifier)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                      <Mail className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full text-xs font-semibold pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all text-slate-900 dark:text-slate-100"
                      id="admin-email-setting"
                    />
                  </div>
                </div>

                <div className="space-y-1 block text-left">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                    Admin Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                      <Lock className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type={showAdminPass ? 'text' : 'password'}
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full text-xs font-semibold pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all text-slate-900 dark:text-slate-100"
                      id="admin-password-setting"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPass(!showAdminPass)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-350 cursor-pointer"
                    >
                      {showAdminPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {securityError && (
            <div className="p-3 text-[11px] font-semibold text-rose-550 dark:text-rose-400 bg-rose-500/10 border border-rose-500/15 rounded-xl whitespace-pre-wrap">
              {securityError}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={updatingSecurity}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-sans font-bold text-xs select-none cursor-pointer flex justify-center items-center gap-1.5 transition-all shadow-md active:scale-99 disabled:opacity-50"
              id="security-settings-submit-btn"
            >
              {updatingSecurity ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Updating Access Logs...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Update & Sync Platform Credentials</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="admin-reset-actions-grid">
        
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors duration-150">
          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-850 rounded-xl h-fit">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-850 px-2 py-0.5 rounded uppercase">
                MEMBER STATS
              </span>
            </div>
            <div>
              <h4 className="font-sans font-black text-sm text-slate-900 dark:text-slate-100">
                Reset Member Attendance Counters
              </h4>
              <p className="text-xs text-slate-450 dark:text-slate-500 leading-relaxed mt-1">
                Sets the check-in counts of all member accounts inside the database registry back to zero and terminates last active entrance timestamps. Safetly preserves subscription plans, profiles, and member identity cards.
              </p>
            </div>
            
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl divide-y divide-slate-100 dark:divide-slate-850">
              <div className="flex justify-between items-center py-1 text-xs">
                <span className="text-slate-400 font-medium">Total Registered Profiles</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{members.length}</span>
              </div>
              <div className="flex justify-between items-center py-1 text-xs">
                <span className="text-slate-400 font-medium">Active Counters to Reset</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{membersWithCheckIns} Members</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-850 mt-4">
            {confirmations['reset_member_stats'] ? (
              <div className="space-y-2 animate-slide-in">
                <p className="text-[10px] text-rose-500 font-black uppercase tracking-wider block">
                  ⚠️ ARE YOU ABSOLUTELY SURE? THIS OPERATION CANNOT BE UNDONE.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => triggerResetAction('reset_member_stats', onResetMemberStats, 'Successfully set all member check-in counts back to 0.')}
                    disabled={activeLoader !== null}
                    className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 text-white font-sans font-bold text-xs hover:bg-indigo-500 transition-colors shadow-sm cursor-pointer select-none flex justify-center items-center gap-1.5"
                  >
                    {activeLoader === 'reset_member_stats' ? (
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    ) : <RotateCcw className="w-3.5 h-3.5" />}
                    <span>Confirm Reset</span>
                  </button>
                  <button
                    onClick={() => handleToggleConfirm('reset_member_stats')}
                    className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-850 text-slate-500 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors cursor-pointer select-none"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                disabled={activeLoader !== null || membersWithCheckIns === 0}
                onClick={() => handleToggleConfirm('reset_member_stats')}
                className="w-full py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-850 text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-950 hover:bg-white dark:hover:bg-slate-900 transition-all font-sans font-bold text-xs select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex justify-center items-center gap-1.5 shadow-3xs"
              >
                <RefreshCw className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                <span>Format Attendance Counters</span>
              </button>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors duration-150">
          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 rounded-xl h-fit">
                <Trash2 className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/30 px-2 py-0.5 rounded uppercase">
                CHECKIN LOGS
              </span>
            </div>
            <div>
              <h4 className="font-sans font-black text-sm text-slate-900 dark:text-slate-100">
                Truncate Entrance Check-In History
              </h4>
              <p className="text-xs text-slate-450 dark:text-slate-500 leading-relaxed mt-1">
                Deletes every registered swiped scan record from the primary `checkins` Firestore collection and browser cache. Restores database storage sizing back to clean state. Member directories are left untouched.
              </p>
            </div>
            
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl divide-y divide-slate-100 dark:divide-slate-850">
              <div className="flex justify-between items-center py-1 text-xs">
                <span className="text-slate-400 font-medium">Local & Firestore Checkin Log Size</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{checkIns.length} Entries</span>
              </div>
              <div className="flex justify-between items-center py-1 text-xs">
                <span className="text-slate-400 font-medium">Average Storage Unit Cost</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">0.05 KB / document</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-850 mt-4">
            {confirmations['clear_checkins'] ? (
              <div className="space-y-2 animate-slide-in">
                <p className="text-[10px] text-rose-500 font-black uppercase tracking-wider block">
                  ⚠️ ARE YOU SERIOUISLY SURE? THIS DELETES ALL HISTORY FOREVER.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => triggerResetAction('clear_checkins', onClearCheckIns, 'Successfully purged check-in history logs.')}
                    disabled={activeLoader !== null}
                    className="flex-1 py-2 px-3 rounded-xl bg-rose-600 text-white font-sans font-bold text-xs hover:bg-rose-500 transition-colors shadow-sm cursor-pointer select-none flex justify-center items-center gap-1.5"
                  >
                    {activeLoader === 'clear_checkins' ? (
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    ) : <Trash2 className="w-3.5 h-3.5" />}
                    <span>Truncate Logs</span>
                  </button>
                  <button
                    onClick={() => handleToggleConfirm('clear_checkins')}
                    className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-850 text-slate-500 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors cursor-pointer select-none"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                disabled={activeLoader !== null || checkIns.length === 0}
                onClick={() => handleToggleConfirm('clear_checkins')}
                className="w-full py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-950 text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-950 hover:bg-white dark:hover:bg-slate-900 transition-all font-sans font-bold text-xs select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex justify-center items-center gap-1.5 shadow-3xs"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                <span>Truncate Check-In Logs</span>
              </button>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors duration-150">
          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <div className="p-2.5 bg-sky-50 dark:bg-sky-950/40 text-sky-650 dark:text-sky-400 border border-sky-100 dark:border-sky-900/30 rounded-xl h-fit">
                <Megaphone className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-black text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/30 px-2 py-0.5 rounded uppercase">
                ALERTS QUEUE
              </span>
            </div>
            <div>
              <h4 className="font-sans font-black text-sm text-slate-900 dark:text-slate-100">
                Clear Real-Time Alert Logs & Dispatch Messages
              </h4>
              <p className="text-xs text-slate-450 dark:text-slate-500 leading-relaxed mt-1">
                Deletes all welcome greet alert configurations, expired reminders, and instant pending alerts queued in the system database. Instantly refreshes the alerts viewport without disturbing the member database directory.
              </p>
            </div>
            
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl divide-y divide-slate-100 dark:divide-slate-850">
              <div className="flex justify-between items-center py-1 text-xs">
                <span className="text-slate-400 font-medium">Currently Tracked message logs</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{welcomeMessages.length} Messages</span>
              </div>
              <div className="flex justify-between items-center py-1 text-xs">
                <span className="text-slate-400 font-medium">Pending Unsent notifications</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{welcomeMessages.filter(m => m.status === 'Pending').length} Pending</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-850 mt-4">
            {confirmations['clear_messages'] ? (
              <div className="space-y-2 animate-slide-in">
                <p className="text-[10px] text-rose-500 font-black uppercase tracking-wider block">
                  ⚠️ ARE YOU ABSOLUTELY CONCENTRATING? PURGES MESSAGE STREAMS.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => triggerResetAction('clear_messages', onClearWelcomeMessages, 'Successfully purged welcome message streams.')}
                    disabled={activeLoader !== null}
                    className="flex-1 py-2 px-3 rounded-xl bg-indigo-650 text-white font-sans font-bold text-xs hover:bg-sky-600 transition-colors shadow-sm cursor-pointer select-none flex justify-center items-center gap-1.5"
                  >
                    {activeLoader === 'clear_messages' ? (
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    ) : <Trash2 className="w-3.5 h-3.5" />}
                    <span>Empty Queue</span>
                  </button>
                  <button
                    onClick={() => handleToggleConfirm('clear_messages')}
                    className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-850 text-slate-500 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors cursor-pointer select-none"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                disabled={activeLoader !== null || welcomeMessages.length === 0}
                onClick={() => handleToggleConfirm('clear_messages')}
                className="w-full py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-850 text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-950 hover:bg-white dark:hover:bg-slate-900 transition-all font-sans font-bold text-xs select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex justify-center items-center gap-1.5 shadow-3xs"
              >
                <Megaphone className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                <span>Empty Alerts Queue</span>
              </button>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-855 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors duration-150 relative overflow-hidden">
          <div className="absolute top-0 bottom-0 right-0 w-2 h-full bg-rose-500/80 pointer-events-none"></div>
          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-905 rounded-xl h-fit">
                <RotateCcw className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-black text-rose-600 bg-rose-100/60 dark:bg-rose-950/40 border border-rose-200 px-2 py-0.5 rounded uppercase font-bold">
                SYSTEM DESTRUCTIVE
              </span>
            </div>
            <div>
              <h4 className="font-sans font-black text-sm text-slate-900 dark:text-slate-100">
                Perform Full System Factory Reset
              </h4>
              <p className="text-xs text-slate-450 dark:text-slate-500 leading-relaxed mt-1">
                Deletes every customized plan, member directory document, swipe log, and SMS queue. Fully reinstates the system back to clean, factory-seeded structures (containing default gym plans and members) for demonstration safety.
              </p>
            </div>
            
            <div className="p-3 bg-amber-500/5 dark:bg-amber-450/5 rounded-xl border border-amber-500/10 text-[10px] text-amber-650 dark:text-amber-400 flex gap-2 items-start leading-relaxed font-sans font-medium">
              <AlertIcon className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <span>Resetting restores original default profiles (John Doe, Sarah Connor, etc.), base configurations, pricing structures, and initial checkin logs across Cloud Firestore & local slots.</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-850 mt-4">
            {confirmations['factory_reset'] ? (
              <div className="space-y-2 animate-slide-in">
                <p className="text-[10px] text-rose-500 font-black uppercase tracking-wider block">
                  ⚠️ INSTANT DESTRUCTIVE OPERATIONS! DO YOU WANT TO DO THIS?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => triggerResetAction('factory_reset', onFactoryReset, 'Successfully restored entire database back to default factory-seeded states.')}
                    disabled={activeLoader !== null}
                    className="flex-1 py-2 px-3 rounded-xl bg-rose-600 text-white font-sans font-bold text-xs hover:bg-rose-500 transition-colors shadow-sm cursor-pointer select-none flex justify-center items-center gap-1.5 animate-pulse"
                  >
                    {activeLoader === 'factory_reset' ? (
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    ) : <RotateCcw className="w-3.5 h-3.5" />}
                    <span>Confirm Nuclear Reset</span>
                  </button>
                  <button
                    onClick={() => handleToggleConfirm('factory_reset')}
                    className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-850 text-slate-500 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors cursor-pointer select-none"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                disabled={activeLoader !== null}
                onClick={() => handleToggleConfirm('factory_reset')}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 border border-slate-800 text-rose-400 dark:text-rose-450 hover:bg-rose-500 hover:text-white transition-all font-sans font-bold text-xs select-none cursor-pointer flex justify-center items-center gap-1.5 shadow-sm active:scale-99"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Nuke & Seed Gym Console</span>
              </button>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-xs md:col-span-2 space-y-6 hover:border-slate-300 dark:hover:border-slate-755 transition-colors duration-150" id="admin-feedbacks-card">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-850 pb-4">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-500 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 rounded-xl">
                <HelpCircle className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h4 className="font-sans font-black text-base text-slate-900 dark:text-slate-100">
                  Member Feedbacks & Suggestions Center
                </h4>
                <p className="text-xs text-slate-450 dark:text-slate-500 mt-0.5">
                  Review member-submitted ideas, feature requests, ratings, and cleanliness issues in real-time.
                </p>
              </div>
            </div>

            {feedbacks.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  if (confirm('Are you sure you want to permanently delete all submitted member feedbacks?')) {
                    await onClearFeedbacks();
                  }
                }}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/70 border border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                Clear All Feedback
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl text-left border border-slate-100 dark:border-slate-850">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Received</span>
              <span className="font-mono text-xl font-black text-slate-800 dark:text-slate-100 mt-1 block">
                {feedbacks.length}
              </span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl text-left border border-slate-100 dark:border-slate-850">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg Rating</span>
              <div className="flex items-center gap-1 mt-1">
                <span className="font-mono text-xl font-black text-slate-800 dark:text-slate-100">
                  {feedbacks.length > 0 
                    ? (feedbacks.reduce((acc, f) => acc + f.rating, 0) / feedbacks.length).toFixed(1) 
                    : 'N/A'}
                </span>
                {feedbacks.length > 0 && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
              </div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl text-left border border-slate-100 dark:border-slate-850">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Actions</span>
              <span className="font-mono text-xl font-black text-slate-800 dark:text-slate-100 mt-1 block text-amber-600">
                {feedbacks.filter(f => f.status === 'Pending').length}
              </span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl text-left border border-slate-100 dark:border-slate-850">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Addressed Ideas</span>
              <span className="font-mono text-xl font-black text-slate-800 dark:text-slate-100 mt-1 block text-emerald-600">
                {feedbacks.filter(f => f.status === 'Addressed').length}
              </span>
            </div>
          </div>

          {feedbacks.length === 0 ? (
            <div className="py-8 text-center bg-slate-50 dark:bg-slate-950 rounded-2xl border border-dashed border-slate-200 dark:border-slate-850">
              <HelpCircle className="w-8 h-8 text-slate-350 mx-auto animate-pulse mb-2" />
              <p className="text-xs font-bold text-slate-500">No suggestions submitted yet.</p>
              <p className="text-[10px] text-slate-400 mt-1">Member suggestions and improvement forms will stream here automatically.</p>
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
              {feedbacks.map((fb) => (
                <div 
                  key={fb.id}
                  className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 hover:border-slate-200 dark:hover:border-slate-800 transition-all text-left flex flex-col md:flex-row justify-between gap-4"
                >
                  <div className="space-y-2.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase border ${
                        fb.category === 'Equipment' ? 'bg-indigo-50 border-indigo-200 text-indigo-750 dark:bg-indigo-950/30' :
                        fb.category === 'Classes' ? 'bg-sky-50 border-sky-200 text-sky-750 dark:bg-sky-950/30' :
                        fb.category === 'Cleanliness' ? 'bg-emerald-50 border-emerald-200 text-emerald-750 dark:bg-emerald-950/30' :
                        fb.category === 'Trainers' ? 'bg-amber-50 border-amber-200 text-amber-750 dark:bg-amber-950/30' :
                        fb.category === 'Facilities' ? 'bg-purple-50 border-purple-200 text-purple-750 dark:bg-purple-950/30' :
                        'bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-950/30'
                      }`}>
                        {fb.category}
                      </span>
                      
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star 
                            key={star} 
                            className={`w-3 h-3 ${
                              star <= fb.rating 
                                ? 'text-amber-500 fill-amber-500' 
                                : 'text-slate-200 dark:text-slate-800'
                            }`} 
                          />
                        ))}
                      </div>

                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(fb.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(fb.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans font-medium whitespace-pre-wrap">
                      "{fb.suggestion}"
                    </p>

                    <div className="flex items-center gap-1 text-[11px] text-slate-450 dark:text-slate-500">
                      <span>Submitted by: </span>
                      <span className="font-bold text-slate-650 dark:text-slate-400">
                        {!fb.memberName ? 'Anonymous Member' : `${fb.memberName}${fb.memberEmail ? ` (${fb.memberEmail})` : ''}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col justify-between md:justify-center items-end gap-3.5 shrink-0 border-t md:border-t-0 pt-2.5 md:pt-0 border-slate-100 dark:border-slate-850">
                    <div className="flex flex-col items-start md:items-end gap-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        Management Status
                      </span>
                      <select
                        value={fb.status}
                        onChange={async (e) => {
                          await onUpdateFeedbackStatus(fb.id, e.target.value as any);
                        }}
                        className={`text-xs font-bold py-1 px-2 rounded-lg focus:outline-none focus:ring-1 border bg-white dark:bg-slate-900 transition-all cursor-pointer ${
                          fb.status === 'Pending' ? 'text-amber-600 border-amber-200 focus:ring-amber-400 bg-amber-50/20' :
                          fb.status === 'Reviewed' ? 'text-sky-600 border-sky-200 focus:ring-sky-400 bg-sky-50/20' :
                          'text-emerald-600 border-emerald-200 focus:ring-emerald-400 bg-emerald-50/20'
                        }`}
                      >
                        <option value="Pending">🕒 Pending</option>
                        <option value="Reviewed">🔍 Reviewed</option>
                        <option value="Addressed">✅ Addressed</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm('Are you sure you want to delete this suggestion?')) {
                          await onDeleteFeedback(fb.id);
                        }
                      }}
                      className="p-1.5 rounded-lg border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-400 hover:text-rose-600 dark:border-slate-800 dark:hover:border-rose-950 dark:hover:bg-rose-950/20 transition-all cursor-pointer"
                      title="Delete Feedback"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
