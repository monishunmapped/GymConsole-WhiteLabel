import React, { useState, useMemo } from 'react';
import { Member, Feedback } from '../types';
import { useBrand } from '../lib/brand';
import { motion, AnimatePresence } from 'motion/react';
import { 
  HeartHandshake, 
  MessageSquare, 
  Star, 
  CheckCircle, 
  ShieldAlert, 
  Sparkles,
  Search,
  X
} from 'lucide-react';

interface FeedbackFormProps {
  members: Member[];
  onSubmitFeedback: (feedback: Omit<Feedback, 'id' | 'timestamp' | 'status'>) => Promise<void>;
}

const CATEGORIES = [
  { value: 'Facilities', label: 'Facilities 🏢', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-200' },
  { value: 'Equipment', label: 'Equipment 🏋️', color: 'bg-amber-500/10 text-amber-600 border-amber-200' },
  { value: 'Trainers', label: 'Trainers 🏃', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
  { value: 'Cleanliness', label: 'Cleanliness ✨', color: 'bg-sky-500/10 text-sky-600 border-sky-200' },
  { value: 'Classes', label: 'Classes 🧘', color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
  { value: 'Other', label: 'Other 💬', color: 'bg-slate-500/10 text-slate-600 border-slate-200' }
] as const;

export function FeedbackForm({ members, onSubmitFeedback }: FeedbackFormProps) {
  const brand = useBrand();
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [category, setCategory] = useState<Feedback['category']>('Equipment');
  const [suggestion, setSuggestion] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matchedMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q === '') return [];
    return members.filter(m => 
      m.name.toLowerCase().includes(q) || 
      m.id.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [searchQuery, members]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestion.trim()) {
      setError('Please share your thoughts before submitting!');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmitFeedback({
        rating,
        category,
        suggestion: suggestion.trim(),
        memberName: isAnonymous ? 'Anonymous Member' : (selectedMember?.name || 'Registered Member'),
        memberEmail: isAnonymous ? undefined : selectedMember?.email
      });
      setSubmitSuccess(true);
      setSuggestion('');
      setSelectedMember(null);
      setSearchQuery('');
    } catch (err: any) {
      setError(err.message || 'Something went wrong while logging your feedback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRatingEmoji = (r: number) => {
    if (r === 5) return 'Lovin\' it! 🔥';
    if (r === 4) return 'Very Good 👍';
    if (r === 3) return 'Could be better 😐';
    if (r === 2) return 'Disappointed 🙁';
    return 'Terrible 😡';
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-250/70 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-md transition-colors" id="feedback-form-card">
      <AnimatePresence mode="wait">
        {!submitSuccess ? (
          <motion.form 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleSubmit} 
            className="space-y-5 text-left"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1 px-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-sans font-bold text-[10px] rounded-full uppercase tracking-wider border border-indigo-100 dark:border-indigo-900/60">
                    Improve {brand.name}
                  </span>
                </div>
                <h2 className="text-base font-bold font-sans tracking-tight text-slate-900 dark:text-slate-100">
                  Feedback & Suggestions 💡
                </h2>
                <p className="text-xs text-slate-450 dark:text-slate-400">
                  Help us make your workouts better! Your suggestions are routed directly to management.
                </p>
              </div>
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                <HeartHandshake className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                1. What is this suggestion about?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      category === cat.value
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm scale-[1.02]'
                        : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 bg-slate-50/75 dark:bg-slate-850/60 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  2. Overall Gym Rating
                </label>
                <span className="text-[11px] font-bold font-sans text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/40">
                  {getRatingEmoji(rating)}
                </span>
              </div>
              
              <div className="flex items-center gap-2.5 py-1 justify-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    onClick={() => setRating(star)}
                    className="p-1 cursor-pointer transition-transform duration-100 active:scale-90"
                    id={`feedback-star-${star}`}
                    aria-label={`Rate ${star} Stars`}
                  >
                    <Star 
                      className={`w-7.5 h-7.5 transition-colors ${
                        star <= (hoverRating ?? rating)
                          ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                          : 'text-slate-300 dark:text-slate-700'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                3. Your Thoughts & Detailed Suggestion
              </label>
              <textarea
                value={suggestion}
                onChange={(e) => {
                  setSuggestion(e.target.value);
                  setError(null);
                }}
                maxLength={400}
                placeholder="Share your ideas (e.g., Please add more 20kg plates to the free weight zone or extend Sunday hours)..."
                rows={4}
                className="w-full text-slate-900 dark:text-white p-3.5 rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50/30 dark:bg-slate-850/30 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-sans transition-all resize-none"
              />
              <div className="flex justify-between text-[10px] text-slate-450 dark:text-slate-400">
                <span>Please be constructive.</span>
                <span className={`${suggestion.length >= 380 ? 'text-rose-500 font-bold' : ''}`}>
                  {suggestion.length}/400 characters
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  4. Submit Anonymously?
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAnonymous(true);
                      setSelectedMember(null);
                      setSearchQuery('');
                    }}
                    className={`px-3 py-1 text-[11px] font-bold rounded-lg border transition-all ${
                      isAnonymous
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    Anonymous 👤
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAnonymous(false)}
                    className={`px-3 py-1 text-[11px] font-bold rounded-lg border transition-all ${
                      !isAnonymous
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    Under My Profile 🏷️
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {!isAnonymous && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-2"
                  >
                    {!selectedMember ? (
                      <div className="relative">
                        <Search className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search your name or Member ID..."
                          className="w-full text-slate-950 dark:text-white pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-sans transition-all"
                        />
                        {searchQuery && (
                          <div className="absolute right-2 top-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg z-20 w-full left-0 mt-10 p-1.5 space-y-1 text-xs">
                            {matchedMembers.map(m => (
                              <button
                                type="button"
                                key={m.id}
                                onClick={() => {
                                  setSelectedMember(m);
                                  setSearchQuery('');
                                }}
                                className="w-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-left rounded-lg transition-colors flex items-center justify-between"
                              >
                                <div>
                                  <span className="font-bold text-slate-900 dark:text-white">{m.name}</span>
                                  <span className="text-[10px] text-slate-400 ml-1.5">({m.id})</span>
                                </div>
                                <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-900">Select</span>
                              </button>
                            ))}
                            {matchedMembers.length === 0 && (
                              <p className="p-2 text-slate-450 italic text-center text-[11px]">No registered members found</p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-150 dark:border-emerald-900 p-2.5 rounded-xl">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold font-sans text-xs">
                            {selectedMember.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">{selectedMember.name}</p>
                            <p className="text-[9px] font-mono text-slate-400">Linked Profile: {selectedMember.id}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedMember(null)}
                          className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 p-3 rounded-xl border border-rose-150 dark:border-rose-900 text-xs font-semibold">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || (!isAnonymous && !selectedMember)}
              className={`w-full py-3 rounded-xl font-sans font-bold text-xs transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2 ${
                !isAnonymous && !selectedMember
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-800'
                  : 'bg-indigo-600 hover:bg-indigo-750 text-white shadow-md active:scale-98'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Logging your thoughts...</span>
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4" />
                  <span>Submit Member Suggestion</span>
                </>
              )}
            </button>
          </motion.form>
        ) : (
          /* Success Screen */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="py-8 text-center space-y-4"
          >
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle className="w-8 h-8 animate-bounce" />
            </div>
            <div className="space-y-1.5 max-w-xs mx-auto">
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-sans">
                Suggestion Submitted! 🎉
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Thank you for your valuable feedback. Our administrative team will review it within 24 hours to help improve {brand.name}!
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSubmitSuccess(false);
                setRating(5);
              }}
              className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
              Submit Another Suggestion
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
