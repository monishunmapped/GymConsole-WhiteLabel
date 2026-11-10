import React, { useState, useMemo } from 'react';
import { 
  Lock, 
  Unlock, 
  Key, 
  Check, 
  Clock, 
  Trash2, 
  Star, 
  Search, 
  Filter, 
  AlertCircle, 
  MessageSquare
} from 'lucide-react';
import { Feedback, SecurityConfig } from '../types';

interface FeedbackManagerProps {
  feedbacks: Feedback[];
  onUpdateFeedbackStatus: (id: string, status: 'Pending' | 'Reviewed' | 'Addressed') => Promise<void>;
  onDeleteFeedback: (id: string) => Promise<void>;
  onClearFeedbacks: () => Promise<void>;
  securityConfig: SecurityConfig;
  currentUser: { email: string; role: 'Owner' | 'Admin' } | null;
}

export function FeedbackManager({
  feedbacks,
  onUpdateFeedbackStatus,
  onDeleteFeedback,
  onClearFeedbacks,
  securityConfig,
  currentUser
}: FeedbackManagerProps) {
  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return currentUser?.role === 'Owner';
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Reviewed' | 'Addressed'>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    const ownerPassword = securityConfig.ownerPassword;
    if (password === ownerPassword) {
      setIsUnlocked(true);
      setPassword('');
    } else {
      setPasswordError('Incorrect owner password. Access denied.');
    }
  };

  const handleLock = () => {
    setIsUnlocked(false);
  };

  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter(fb => {
      const matchesStatus = statusFilter === 'All' || fb.status === statusFilter;
      const matchesCategory = categoryFilter === 'All' || fb.category === categoryFilter;
      
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = query === '' || 
        fb.suggestion.toLowerCase().includes(query) ||
        (fb.memberName && fb.memberName.toLowerCase().includes(query)) ||
        (fb.memberEmail && fb.memberEmail.toLowerCase().includes(query)) ||
        fb.category.toLowerCase().includes(query);

      return matchesStatus && matchesCategory && matchesSearch;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [feedbacks, statusFilter, categoryFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = feedbacks.length;
    const pending = feedbacks.filter(f => f.status === 'Pending').length;
    const reviewed = feedbacks.filter(f => f.status === 'Reviewed').length;
    const addressed = feedbacks.filter(f => f.status === 'Addressed').length;
    
    const sumRatings = feedbacks.reduce((sum, f) => sum + f.rating, 0);
    const avgRating = total > 0 ? (sumRatings / total).toFixed(1) : 'N/A';

    return { total, pending, reviewed, addressed, avgRating };
  }, [feedbacks]);

  if (!isUnlocked) {
    return (
      <div className="max-w-md mx-auto my-12" id="feedback-lock-screen">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl relative overflow-hidden transition-all duration-150 text-center">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500" />
          
          <div className="mx-auto w-16 h-16 bg-amber-50 dark:bg-amber-950/40 text-amber-500 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 rounded-3xl flex items-center justify-center mb-6">
            <Lock className="w-8 h-8 animate-pulse" />
          </div>

          <h2 className="text-xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
            Owner Security Gate
          </h2>
          <p className="text-xs text-slate-450 dark:text-slate-500 mt-2 mb-6 max-w-sm mx-auto">
            Viewing member feedback, ratings, and gym complaints is restricted. Please enter the gym Owner password to unlock.
          </p>

          <form onSubmit={handleVerifyPassword} className="space-y-4 text-left">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Owner Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <Key className="w-4 h-4 text-slate-400/90" />
                </span>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs font-semibold pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 dark:focus:ring-amber-500/20 transition-all font-sans text-slate-900 dark:text-slate-100 placeholder-slate-400"
                  id="owner-gate-password"
                />
              </div>
              {passwordError && (
                <p className="text-[10px] text-rose-500 font-bold mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {passwordError}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-black py-3 rounded-xl text-xs font-black tracking-wider transition-all shadow-md active:scale-98 cursor-pointer uppercase flex items-center justify-center gap-2"
            >
              <Unlock className="w-4 h-4" />
              <span>Verify Owner Password</span>
            </button>
          </form>

          {currentUser?.role === 'Admin' && (
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-850">
              <p className="text-[10px] font-semibold text-slate-400">
                Current Session: <span className="text-emerald-600 font-bold">Admin</span> (requires Owner privilege escalation)
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="feedback-manager-workspace">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
        <div className="flex items-center gap-4 text-left">
          <div className="p-3.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-2xl">
            <MessageSquare className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                Gym Feedback Hub
              </h2>
              <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-100/70 dark:text-amber-350 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/30 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                <Unlock className="w-2.5 h-2.5" />
                Unlocked
              </span>
            </div>
            <p className="text-xs text-slate-450 dark:text-slate-500 mt-1">
              Process and complete suggestions submitted from the Member Portal.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-stretch md:self-auto">
          {feedbacks.length > 0 && (
            <button
              type="button"
              onClick={async () => {
                if (confirm('Are you absolutely sure you want to permanently delete all member feedback logs? This action is irreversible.')) {
                  await onClearFeedbacks();
                }
              }}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/30 px-4 py-2.5 rounded-xl transition-all cursor-pointer flex-1 md:flex-none text-center"
            >
              Reset Feedback Database
            </button>
          )}
          
          <button
            type="button"
            onClick={handleLock}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
            title="Lock access"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Lock Gate</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 text-left">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Total Submissions</span>
          <span className="font-mono text-2xl font-black text-slate-900 dark:text-slate-100 mt-1.5 block">
            {stats.total}
          </span>
        </div>
        
        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 text-left">
          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">Unresolved (Pending)</span>
          <span className="font-mono text-2xl font-black text-amber-600 mt-1.5 block">
            {stats.pending}
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 text-left">
          <span className="text-[10px] font-bold text-sky-500 uppercase tracking-wider block">Reviewed / Active</span>
          <span className="font-mono text-2xl font-black text-sky-600 mt-1.5 block">
            {stats.reviewed}
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 text-left">
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block">Completed (Addressed)</span>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className="font-mono text-2xl font-black text-emerald-600">
              {stats.addressed}
            </span>
            {stats.total > 0 && (
              <span className="text-[10px] font-mono text-slate-400">
                ({Math.round((stats.addressed / stats.total) * 100)}%)
              </span>
            )}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 text-left col-span-2 md:col-span-1">
          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">Avg Rating Score</span>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="font-mono text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {stats.avgRating}
            </span>
            {feedbacks.length > 0 && (
              <div className="flex text-amber-500">
                <Star className="w-4 h-4 fill-amber-500" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col md:flex-row gap-4 items-stretch md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search feedback suggestions or member details..."
            className="w-full text-xs font-semibold pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 dark:focus:ring-indigo-500/20 transition-all font-sans text-slate-900 dark:text-slate-100 placeholder-slate-400"
          />
        </div>

        <div className="flex flex-wrap gap-2.5 items-center">
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 p-1.5 border border-slate-200/80 dark:border-slate-800 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Status:</span>
            {(['All', 'Pending', 'Reviewed', 'Addressed'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-850 dark:text-slate-400'
                }`}
              >
                {st === 'All' ? 'All' : st === 'Pending' ? '🕒 Pending' : st === 'Reviewed' ? '🔍 Reviewed' : '✅ Completed'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs font-bold">
            <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
            <span className="text-slate-400">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent border-none text-slate-700 dark:text-slate-300 font-bold focus:outline-none focus:ring-0 pr-6 cursor-pointer"
            >
              <option value="All">All Categories</option>
              <option value="Facilities">Facilities</option>
              <option value="Equipment">Equipment</option>
              <option value="Trainers">Trainers</option>
              <option value="Cleanliness">Cleanliness</option>
              <option value="Classes">Classes</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {filteredFeedbacks.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-12 text-center">
          <MessageSquare className="w-12 h-12 text-slate-300 mx-auto animate-pulse mb-3" />
          <h3 className="font-sans font-bold text-slate-850 dark:text-slate-100 text-sm">No match found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
            There are no feedback submissions that match your status, category, or search filters. Try adjusting your settings.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="owner-feedbacks-grid">
          {filteredFeedbacks.map((fb) => (
            <div 
              key={fb.id}
              className={`bg-white dark:bg-slate-900 border rounded-3xl p-6 shadow-xs flex flex-col justify-between gap-5 relative transition-all duration-200 hover:shadow-md ${
                fb.status === 'Addressed' 
                  ? 'border-emerald-200 dark:border-emerald-950 bg-emerald-50/5 dark:bg-emerald-950/5' 
                  : fb.status === 'Reviewed'
                    ? 'border-sky-200 dark:border-sky-950 bg-sky-50/5 dark:bg-sky-950/5'
                    : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="space-y-3 text-left">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase border ${
                      fb.category === 'Equipment' ? 'bg-indigo-50 border-indigo-200 text-indigo-750 dark:bg-indigo-950/30 dark:border-indigo-900/30' :
                      fb.category === 'Classes' ? 'bg-sky-50 border-sky-200 text-sky-750 dark:bg-sky-950/30 dark:border-sky-900/30' :
                      fb.category === 'Cleanliness' ? 'bg-emerald-50 border-emerald-200 text-emerald-750 dark:bg-emerald-950/30 dark:border-emerald-900/30' :
                      fb.category === 'Trainers' ? 'bg-amber-50 border-amber-200 text-amber-750 dark:bg-amber-950/30 dark:border-amber-900/30' :
                      fb.category === 'Facilities' ? 'bg-purple-50 border-purple-200 text-purple-750 dark:bg-purple-950/30 dark:border-purple-900/30' :
                      'bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-900 dark:border-slate-800'
                    }`}>
                      {fb.category}
                    </span>

                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star 
                          key={star} 
                          className={`w-3.5 h-3.5 ${
                            star <= fb.rating 
                              ? 'text-amber-500 fill-amber-500' 
                              : 'text-slate-200 dark:text-slate-800'
                          }`} 
                        />
                      ))}
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-bold shrink-0">
                    {new Date(fb.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(fb.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="bg-slate-50/50 dark:bg-slate-950/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-850">
                  <p className="text-xs text-slate-750 dark:text-slate-200 font-sans leading-relaxed whitespace-pre-wrap font-medium">
                    "{fb.suggestion}"
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-850">
                <div className="text-left">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Submitted By</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-sans block mt-0.5 truncate max-w-[200px]">
                    {!fb.memberName ? (
                      <span className="text-slate-400 dark:text-slate-550 font-normal italic">Anonymous Member</span>
                    ) : (
                      fb.memberName
                    )}
                  </span>
                  {fb.memberEmail && (
                    <span className="text-[10px] text-indigo-500 hover:underline cursor-pointer font-sans block mt-0.5">
                      {fb.memberEmail}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 justify-end">
                  {fb.status !== 'Addressed' ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await onUpdateFeedbackStatus(fb.id, 'Addressed');
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1 active:scale-97"
                      title="Mark as Addressed"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Complete</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        await onUpdateFeedbackStatus(fb.id, 'Pending');
                      }}
                      className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-650 dark:text-slate-300 font-sans font-bold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1 active:scale-97 border border-slate-200/80 dark:border-slate-700"
                      title="Reopen suggestions ticket"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Reopen</span>
                    </button>
                  )}

                  <select
                    value={fb.status}
                    onChange={async (e) => {
                      await onUpdateFeedbackStatus(fb.id, e.target.value as any);
                    }}
                    className={`text-xs font-bold py-2 px-2.5 rounded-xl focus:outline-none focus:ring-1 border bg-white dark:bg-slate-900 transition-all cursor-pointer ${
                      fb.status === 'Pending' ? 'text-amber-600 border-amber-200 focus:ring-amber-400 bg-amber-50/20' :
                      fb.status === 'Reviewed' ? 'text-sky-600 border-sky-200 focus:ring-sky-400 bg-sky-50/20' :
                      'text-emerald-600 border-emerald-200 focus:ring-emerald-400 bg-emerald-50/20'
                    }`}
                  >
                    <option value="Pending">🕒 Pending</option>
                    <option value="Reviewed">🔍 Reviewed</option>
                    <option value="Addressed">✅ Addressed</option>
                  </select>

                  <button
                    type="button"
                    onClick={async () => {
                      if (confirm('Are you sure you want to delete this specific feedback?')) {
                        await onDeleteFeedback(fb.id);
                      }
                    }}
                    className="p-2 rounded-xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-400 hover:text-rose-600 dark:border-slate-850 dark:hover:border-rose-950 dark:hover:bg-rose-950/20 transition-all cursor-pointer"
                    title="Delete suggestion log"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
