import { useState, useMemo } from 'react';
import { Member, WelcomeMessage } from '../types';
import { calculateDaysRemaining, formatDateDDMMYYYY, todayISO } from '../utils/dateUtils';
import { whatsappUrl } from '../utils/common';
import { useBrand } from '../lib/brand';
import { sendEmail, sendSms } from '../lib/messaging';
import { 
  MessageSquare, 
  Send, 
  Search, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Smartphone, 
  FileText,
  Calendar,
  Sparkles,
  Trash2,
  Check,
  UserCheck,
  Megaphone
} from 'lucide-react';

interface ExpiryRemindersProps {
  members: Member[];
  onUpdateMember: (id: string, updates: Partial<Member>) => void;
  welcomeMessages: WelcomeMessage[];
  onDeleteMessage: (id: string) => void;
  onUpdateMessageStatus: (id: string, status: 'Pending' | 'Sent') => void;
}

export function ExpiryReminders({ 
  members, 
  onUpdateMember, 
  welcomeMessages = [], 
  onDeleteMessage, 
  onUpdateMessageStatus 
}: ExpiryRemindersProps) {
  const brand = useBrand();
  const TODAY_STR = todayISO();

  const [activeTab, setActiveTab] = useState<'renewals' | 'welcome-alerts'>('renewals');

  const [template, setTemplate] = useState<string>(
    "Hello {NAME}! 🏋️‍♂️ This is a friendly reminder from {GYM}. Your {PLAN} membership will end on {DATE} (in {DAYS} days). Renew today to keep your card swipe and lock-box active! Reply here or visit the desk. See you soon!"
  );

  const [welcomeTemplate, setWelcomeTemplate] = useState<string>(() => {
    return localStorage.getItem('gym_template_welcome') || 
      "Welcome to {GYM}, {NAME}! 🚀 Your account is active under the {PLAN} subscription. We are thrilled to help you achieve your goals!";
  });

  const [entryTemplate, setEntryTemplate] = useState<string>(() => {
    return localStorage.getItem('gym_template_entry') || 
      "Hello {NAME}! 💪 Checked in via {METHOD} for your {PLAN} training session. Let's make today count!";
  });


  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'exact-5' | 'soon' | 'expired'>('all');

  const [welcomeSearchQuery, setWelcomeSearchQuery] = useState('');
  const [welcomeFilterType, setWelcomeFilterType] = useState<'all' | 'Welcome' | 'CheckIn'>('all');
  const [welcomeStatusFilter, setWelcomeStatusFilter] = useState<'all' | 'Pending' | 'Sent'>('all');

  const calculateDaysLeft = (expiryDateStr: string) => calculateDaysRemaining(expiryDateStr);

  const compileMessage = (member: Member, daysLeft: number) => {
    let msg = template;
    msg = msg.replace(/{GYM}/g, brand.name);
    msg = msg.replace(/{NAME}/g, member.name);
    msg = msg.replace(/{PLAN}/g, member.plan);
    msg = msg.replace(/{DATE}/g, formatDateDDMMYYYY(member.expiryDate));
    msg = msg.replace(/{DAYS}/g, daysLeft.toString());
    return msg;
  };

  const handleSaveWelcomeTemplate = (text: string) => {
    setWelcomeTemplate(text);
    localStorage.setItem('gym_template_welcome', text);
  };

  const handleSaveEntryTemplate = (text: string) => {
    setEntryTemplate(text);
    localStorage.setItem('gym_template_entry', text);
  };

  const generateWhatsappUrl = (phone: string, text: string) => whatsappUrl(phone, text, brand.countryCode);

  const expirationsData = useMemo(() => {
    return members.map(m => {
      const daysLeft = calculateDaysLeft(m.expiryDate);
      return {
        member: m,
        daysLeft,
        isExact5: daysLeft === 5,
        isSoon: daysLeft > 0 && daysLeft <= 7,
        isExpired: daysLeft <= 0,
      };
    }).sort((a, b) => {
      if (a.daysLeft === 5 && b.daysLeft !== 5) return -1;
      if (b.daysLeft === 5 && a.daysLeft !== 5) return 1;
      return a.daysLeft - b.daysLeft;
    });
  }, [members]);

  const stats = useMemo(() => {
    const exact5Count = expirationsData.filter(d => d.daysLeft === 5 && d.member.status === 'Active').length;
    const totalSoonCount = expirationsData.filter(d => d.daysLeft > 0 && d.daysLeft <= 7).length;
    const remindersSentToday = members.filter(m => m.reminderSentDate === TODAY_STR).length;

    return {
      exact5Count,
      totalSoonCount,
      remindersSentToday
    };
  }, [expirationsData, members]);

  const welcomeStats = useMemo(() => {
    const totalPending = welcomeMessages.filter(m => m.status === 'Pending').length;
    const pendingWelcome = welcomeMessages.filter(m => m.type === 'Welcome' && m.status === 'Pending').length;
    const pendingCheckIn = welcomeMessages.filter(m => m.type === 'CheckIn' && m.status === 'Pending').length;
    const totalSent = welcomeMessages.filter(m => m.status === 'Sent').length;

    return {
      totalPending,
      pendingWelcome,
      pendingCheckIn,
      totalSent
    };
  }, [welcomeMessages]);

  const filteredExpirations = useMemo(() => {
    return expirationsData.filter(item => {
      const matchesSearch = 
        item.member.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.member.phone.includes(searchQuery) || 
        item.member.id.includes(searchQuery);

      if (!matchesSearch) return false;

      if (filterType === 'exact-5') {
        return item.daysLeft === 5;
      }
      if (filterType === 'soon') {
        return item.daysLeft > 0 && item.daysLeft <= 7;
      }
      if (filterType === 'expired') {
        return item.daysLeft <= 0;
      }

      return true;
    });
  }, [expirationsData, searchQuery, filterType]);

  const filteredWelcomeMessages = useMemo(() => {
    return welcomeMessages.filter(msg => {
      const matchesSearch = 
        msg.memberName.toLowerCase().includes(welcomeSearchQuery.toLowerCase()) ||
        msg.phone.includes(welcomeSearchQuery) ||
        msg.memberId.toLowerCase().includes(welcomeSearchQuery.toLowerCase()) ||
        msg.messageText.toLowerCase().includes(welcomeSearchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (welcomeFilterType !== 'all' && msg.type !== welcomeFilterType) {
        return false;
      }

      if (welcomeStatusFilter !== 'all' && msg.status !== welcomeStatusFilter) {
        return false;
      }

      return true;
    });
  }, [welcomeMessages, welcomeSearchQuery, welcomeFilterType, welcomeStatusFilter]);

  const handleLaunchReminder = (memberId: string, phone: string, text: string) => {
    const url = generateWhatsappUrl(phone, text);
    window.open(url, '_blank', 'noopener,noreferrer');
    onUpdateMember(memberId, { reminderSentDate: TODAY_STR });
  };

  const handleSendWelcomeAlert = (msgId: string, phone: string, text: string) => {
    const url = generateWhatsappUrl(phone, text);
    window.open(url, '_blank', 'noopener,noreferrer');
    onUpdateMessageStatus(msgId, 'Sent');
  };

  return (
    <div className="space-y-6" id="whatsapp-reminders-module">
      
      <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit border border-slate-200" id="reminders-hub-tabs">
        <button
          onClick={() => setActiveTab('renewals')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold font-sans tracking-wide transition-all ${
            activeTab === 'renewals' 
              ? 'bg-white text-slate-900 shadow-sm' 
              : 'text-slate-505 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4 text-sky-500" />
          <span>Membership Renewal Warns</span>
        </button>
        <button
          onClick={() => setActiveTab('welcome-alerts')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold font-sans tracking-wide transition-all relative ${
            activeTab === 'welcome-alerts' 
              ? 'bg-white text-slate-900 shadow-sm' 
              : 'text-slate-505 hover:text-slate-800'
          }`}
          id="tab-welcome-alerts-btn"
        >
          <Megaphone className="w-4 h-4 text-emerald-500 animate-bounce" />
          <span>Welcome & Entry Greet Alerts</span>
          {welcomeStats.totalPending > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-mono font-bold px-1.5 py-0.5 text-[9px] rounded-full min-w-[18px] text-center border-2 border-white animate-pulse">
              {welcomeStats.totalPending}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'renewals' ? (
        <>
          <div className="bg-gradient-to-r from-slate-900 to-slate-850 text-white rounded-3xl p-6 relative overflow-hidden select-none shadow-md text-left">
            <div className="absolute inset-0 bg-radial-gradient from-sky-500/15 to-transparent opacity-40 pointer-events-none"></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-1.5">
                <span className="text-[10px] bg-sky-500 text-black font-bold px-3 py-0.5 rounded-full inline-block font-mono tracking-wider">
                  WHATSAPP RENEWAL CONSOLE
                </span>
                <h2 className="text-xl font-bold font-sans tracking-tight">Active Membership Expiration Monitor</h2>
                <p className="text-xs text-slate-400">
                  System Date: <span className="font-mono text-sky-400 font-bold">{TODAY_STR}</span> • Auto-triggers 5 days prior to expiration.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-slate-800 p-2.5 border border-slate-700/60 rounded-2xl">
                <Smartphone className="w-5 h-5 text-sky-500" />
                <span className="text-xs font-mono text-slate-300 font-bold">WhatsApp Trigger Link: Standard Browser Ready</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="reminder-kpi-row">
            <div className="bg-sky-50/50 border border-sky-200 rounded-2xl p-4 flex items-center gap-4 text-left shadow-xs">
              <div className="p-3 bg-sky-500 text-black rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Critical Today (5 Days left)</span>
                <span className="text-2xl font-bold font-sans text-slate-950">{stats.exact5Count} Members</span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center gap-4 text-left shadow-xs">
              <div className="p-3 bg-slate-800 text-slate-100 rounded-xl">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Expiring Next 7 Days</span>
                <span className="text-2xl font-bold font-sans text-slate-950">{stats.totalSoonCount} Members</span>
              </div>
            </div>

            <div className="bg-emerald-50/50 border border-emerald-150 rounded-2xl p-4 flex items-center gap-4 text-left shadow-xs">
              <div className="p-3 bg-emerald-500 text-emerald-950 rounded-xl">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Alerts Dispatched Today</span>
                <span className="text-2xl font-bold font-sans text-slate-950">{stats.remindersSentToday} Sent</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs text-left space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-sans font-bold text-sm text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-500" />
                WhatsApp Expiration Template Editor
              </h3>
              <span className="text-[10px] font-mono text-slate-400">Custom Dynamic Placeholders Supported</span>
            </div>
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={3}
              className="w-full text-slate-950 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/30 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-sans leading-relaxed"
              placeholder="Enter message template..."
            />
            <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 font-mono">
                <span className="font-bold">Tokens:</span>
                <button type="button" onClick={() => setTemplate(p => p + ' {NAME}')} className="bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded border border-slate-200/50 font-bold text-slate-800">{"{NAME}"}</button>
                <button type="button" onClick={() => setTemplate(p => p + ' {PLAN}')} className="bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded border border-slate-200/50 font-bold text-slate-800">{"{PLAN}"}</button>
                <button type="button" onClick={() => setTemplate(p => p + ' {DATE}')} className="bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded border border-slate-200/50 font-bold text-slate-800">{"{DATE}"}</button>
                <button type="button" onClick={() => setTemplate(p => p + ' {DAYS}')} className="bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded border border-slate-200/50 font-bold text-slate-800">{"{DAYS}"}</button>
              </div>
              
            </div>
          </div>

          <div className="bg-white border border-slate-200/85 rounded-3xl p-5 shadow-sm space-y-4">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
              <h3 className="font-sans font-bold text-base text-slate-900">Member Reminders Queue</h3>
              
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-sans transition-all ${
                    filterType === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterType('exact-5')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans transition-all flex items-center gap-1.5 ${
                    filterType === 'exact-5' ? 'bg-sky-500 text-black shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  id="filter-exact5-btn"
                >
                  <Sparkles className="w-3" />
                  Exactly 5 Days Left
                </button>
                <button
                  onClick={() => setFilterType('soon')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-sans transition-all ${
                    filterType === 'soon' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Expiring (1-7 Days)
                </button>
                <button
                  onClick={() => setFilterType('expired')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-sans transition-all ${
                    filterType === 'expired' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Expired
                </button>
              </div>
            </div>

            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search remaining queue by name, phone or ID..."
                className="w-full text-slate-950 pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/10 focus:border-sky-500 font-sans transition-all"
              />
            </div>

            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto pr-1">
              {filteredExpirations.map(({ member, daysLeft, isExact5, isSoon, isExpired }) => {
                const compiledText = compileMessage(member, daysLeft);
                const isSentToday = member.reminderSentDate === TODAY_STR;

                return (
                  <div key={member.id} className="py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 first:pt-0 last:pb-0 text-left">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-sans font-bold text-sm text-slate-900">{member.name}</span>
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200/50">{member.id}</span>
                        <span className="text-[10px] font-mono bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded border border-indigo-100">{member.plan} Plan</span>
                        
                        {isExact5 && (
                          <span className="text-[10px] bg-amber-500/10 text-amber-700 border border-amber-200 font-black px-2 py-0.5 rounded animate-pulse">
                            🚨 Alert Today (5 Days left)
                          </span>
                        )}
                        {isSoon && !isExact5 && (
                          <span className="text-[10px] bg-sky-50 text-sky-600 border border-sky-100 font-semibold px-2 py-0.5 rounded">
                            ⏳ Ends in {daysLeft} days
                          </span>
                        )}
                        {isExpired && (
                          <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded border border-red-200">
                            ✕ Expired ({Math.abs(daysLeft)} days ago)
                          </span>
                        )}
                        {isSentToday && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1">
                            ✓ Sent Today
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-400 font-mono flex-wrap">
                        <span>Phone: <span className="font-sans font-bold text-slate-600">{member.phone}</span>{member.alternatePhone && <span className="text-slate-400 font-sans ml-2">(Alt: <span className="font-bold text-slate-600">{member.alternatePhone}</span>)</span>}</span>
                        <span>Expires: <span className="font-bold text-slate-600">{formatDateDDMMYYYY(member.expiryDate)}</span></span>
                      </div>

                      <div className="mt-2.5 bg-slate-50 border border-slate-100 rounded-xl p-3 text-[11px] text-slate-600 font-sans tracking-wide leading-relaxed relative">
                        <span className="absolute -top-2 left-3 bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest border border-slate-100 rounded">
                          live message draft
                        </span>
                        {compiledText}
                      </div>
                    </div>

                    <div className="flex flex-row md:flex-col items-stretch gap-2 w-full md:w-auto self-stretch justify-end">
                      <button
                        onClick={() => handleLaunchReminder(member.id, member.phone, compiledText)}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all duration-150 flex items-center justify-center gap-1.5 ${
                          isExact5
                            ? 'bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-black font-black shadow-md'
                            : isSentToday
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200'
                              : 'bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white shadow-xs'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Send WhatsApp Alert</span>
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => (await sendSms(member.phone, compiledText)) && onUpdateMember(member.id, { reminderSentDate: TODAY_STR })}
                          className="flex-1 px-3 py-2 rounded-xl font-bold text-xs bg-sky-500 hover:bg-sky-600 text-black transition-all"
                        >
                          SMS
                        </button>
                        <button
                          disabled={!member.email}
                          onClick={async () => (await sendEmail(member.email, `Membership renewal reminder — ${brand.name}`, compiledText)) && onUpdateMember(member.id, { reminderSentDate: TODAY_STR })}
                          className="flex-1 px-3 py-2 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition-all"
                        >
                          Email
                        </button>
                      </div>

                      <button
                        onClick={() => onUpdateMember(member.id, { reminderSentDate: isSentToday ? '' : TODAY_STR })}
                        className="p-1 px-2.5 text-[10px] text-slate-400 hover:text-slate-600 font-sans font-semibold text-center hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        {isSentToday ? "✕ Mark Unsent" : "✔ Mark Sent manually"}
                      </button>
                    </div>

                  </div>
                );
              })}

              {filteredExpirations.length === 0 && (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-2">
                  <AlertCircle className="w-8 h-8 text-slate-350 mx-auto" />
                  <p className="text-sm font-sans text-slate-500 font-bold">No members matches current expiration queue criteria.</p>
                  <p className="text-xs text-slate-400">Try changing your search parameters or select different filter types like "All".</p>
                </div>
              )}
            </div>

          </div>
        </>
      ) : (
        <>
          <div className="bg-gradient-to-r from-teal-900 to-slate-900 text-white rounded-3xl p-6 relative overflow-hidden select-none shadow-md text-left">
            <div className="absolute inset-0 bg-radial-gradient from-emerald-500/15 to-transparent opacity-40 pointer-events-none"></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-1.5">
                <span className="text-[10px] bg-emerald-500 text-black font-bold px-3 py-0.5 rounded-full inline-block font-mono tracking-wider">
                  MEMBER MESSAGING ENGINE
                </span>
                <h2 className="text-xl font-bold font-sans tracking-tight">Welcome Greetings & Check-In Broadcasts</h2>
                <p className="text-xs text-teal-300">
                  Custom templates for automatic triggers when members register or swipe-in.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-slate-800/80 p-2.5 border border-teal-700/60 rounded-2xl">
                <Send className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono text-slate-300 font-bold">Realtime Firebase Synced Log</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="welcome-kpi-row">
            <div className="bg-amber-50/40 border border-amber-200/70 rounded-2xl p-4 flex items-center gap-4 text-left shadow-xs">
              <div className="p-3 bg-amber-500 text-amber-950 rounded-xl relative">
                <Megaphone className="w-5 h-5" />
                {welcomeStats.totalPending > 0 && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>}
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Pending Alerts</span>
                <span className="text-xl font-bold font-sans text-slate-950">{welcomeStats.totalPending} Queue</span>
              </div>
            </div>

            <div className="bg-emerald-50/40 border border-emerald-200/70 rounded-2xl p-4 flex items-center gap-4 text-left shadow-xs">
              <div className="p-3 bg-emerald-500 text-emerald-950 rounded-xl">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">New Invites Pending</span>
                <span className="text-xl font-bold font-sans text-slate-950">{welcomeStats.pendingWelcome} New Members</span>
              </div>
            </div>

            <div className="bg-indigo-50/40 border border-indigo-250/75 rounded-2xl p-4 flex items-center gap-4 text-left shadow-xs">
              <div className="p-3 bg-indigo-500 text-indigo-50 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Entry Greet Pending</span>
                <span className="text-xl font-bold font-sans text-slate-950">{welcomeStats.pendingCheckIn} Swipes</span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-4 text-left shadow-xs">
              <div className="p-3 bg-slate-950 text-white rounded-xl">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Messages Sent</span>
                <span className="text-xl font-bold font-sans text-slate-950">{welcomeStats.totalSent} Dispatched</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs text-left space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-sans font-bold text-sm text-slate-950 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-500" />
                  New Registration Welcome Template
                </h3>
                <span className="text-[9px] bg-emerald-50 text-emerald-700 font-mono font-bold px-2 py-0.5 rounded border border-emerald-100">Live Custom</span>
              </div>
              <textarea
                value={welcomeTemplate}
                onChange={(e) => handleSaveWelcomeTemplate(e.target.value)}
                rows={3}
                className="w-full text-slate-950 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/20 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-sans leading-relaxed"
                placeholder="Ex. Welcome {NAME}! Your {PLAN} registration is successful..."
              />
              <div className="flex flex-wrap gap-1 text-[9px] text-slate-500 font-mono items-center">
                <span className="font-bold">Tokens:</span>
                <button type="button" onClick={() => handleSaveWelcomeTemplate(welcomeTemplate + ' {NAME}')} className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-200/50">{"{NAME}"}</button>
                <button type="button" onClick={() => handleSaveWelcomeTemplate(welcomeTemplate + ' {PLAN}')} className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-200/50">{"{PLAN}"}</button>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs text-left space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-sans font-bold text-sm text-slate-950 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-indigo-500" />
                  Daily Swipe Check-In Greet Template
                </h3>
                <span className="text-[9px] bg-indigo-50 text-indigo-700 font-mono font-bold px-2 py-0.5 rounded border border-indigo-100">Live Custom</span>
              </div>
              <textarea
                value={entryTemplate}
                onChange={(e) => handleSaveEntryTemplate(e.target.value)}
                rows={3}
                className="w-full text-slate-950 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/20 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-sans leading-relaxed"
                placeholder="Ex. Hello {NAME}! Checked in via {METHOD} for your {PLAN}..."
              />
              <div className="flex flex-wrap gap-1 text-[9px] text-slate-500 font-mono items-center">
                <span className="font-bold">Tokens:</span>
                <button type="button" onClick={() => handleSaveEntryTemplate(entryTemplate + ' {NAME}')} className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-200/50">{"{NAME}"}</button>
                <button type="button" onClick={() => handleSaveEntryTemplate(entryTemplate + ' {PLAN}')} className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-200/50">{"{PLAN}"}</button>
                <button type="button" onClick={() => handleSaveEntryTemplate(entryTemplate + ' {METHOD}')} className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-200/50">{"{METHOD}"}</button>
              </div>
            </div>

          </div>

          <div className="bg-white border border-slate-200/85 rounded-3xl p-5 shadow-sm space-y-4">
            
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 text-left">
              <div>
                <h3 className="font-sans font-bold text-base text-slate-900">Broadcast Alerts Dispatch Center</h3>
                <p className="text-[11px] text-slate-400">Newly registered members and recent daily check-ins appear here in real time on all devices.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setWelcomeFilterType('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      welcomeFilterType === 'all' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-505 hover:text-slate-800'
                    }`}
                  >
                    All Types
                  </button>
                  <button
                    onClick={() => setWelcomeFilterType('Welcome')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      welcomeFilterType === 'Welcome' ? 'bg-emerald-500 text-black shadow-xs font-bold' : 'text-slate-550 hover:text-slate-800'
                    }`}
                  >
                    Welcome
                  </button>
                  <button
                    onClick={() => setWelcomeFilterType('CheckIn')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      welcomeFilterType === 'CheckIn' ? 'bg-indigo-500 text-white shadow-xs font-bold' : 'text-slate-550 hover:text-slate-800'
                    }`}
                  >
                    Swipes
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setWelcomeStatusFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      welcomeStatusFilter === 'all' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-550 hover:text-slate-800'
                    }`}
                  >
                    All Status
                  </button>
                  <button
                    onClick={() => setWelcomeStatusFilter('Pending')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      welcomeStatusFilter === 'Pending' ? 'bg-white text-amber-600 shadow-xs font-bold' : 'text-slate-550 hover:text-slate-800'
                    }`}
                  >
                    Pending
                  </button>
                  <button
                    onClick={() => setWelcomeStatusFilter('Sent')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      welcomeStatusFilter === 'Sent' ? 'bg-white text-emerald-600 shadow-xs font-bold' : 'text-slate-550 hover:text-slate-800'
                    }`}
                  >
                    Dispatched
                  </button>
                </div>

              </div>
            </div>

            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </span>
              <input
                type="text"
                value={welcomeSearchQuery}
                onChange={(e) => setWelcomeSearchQuery(e.target.value)}
                placeholder="Search alerts queue by member name, phone text, ID or plan..."
                className="w-full text-slate-950 pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/10 focus:border-emerald-500 font-sans transition-all"
              />
            </div>

            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto pr-1">
              {filteredWelcomeMessages.map((msg) => {
                const isSent = msg.status === 'Sent';
                
                let readableTime = 'Just now';
                try {
                  const dateObj = new Date(msg.timestamp);
                  readableTime = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } catch(e) {}

                return (
                  <div key={msg.id} className="py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 first:pt-0 last:pb-0 text-left animate-slide-in">
                    
                    <div className="flex-1 space-y-1">
                      
                      <div className="flex items-center flex-wrap gap-2">
                        
                        {msg.type === 'Welcome' ? (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-150 font-bold px-2 py-0.5 rounded flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-emerald-500" />
                            New Member Welcome
                          </span>
                        ) : (
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-150 font-bold px-2 py-0.5 rounded flex items-center gap-1">
                            <Clock className="w-3 h-3 text-indigo-500" />
                            Swipe Check-In
                          </span>
                        )}

                        <span className="font-sans font-bold text-sm text-slate-900">{msg.memberName}</span>
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded">{msg.memberId}</span>
                        
                        {isSent ? (
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded border border-emerald-250 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Dispatched
                          </span>
                        ) : (
                          <span className="text-[9px] bg-amber-500/10 text-amber-700 font-black px-2 py-0.5 rounded border border-amber-200 animate-pulse">
                            ⏳ Pending Dispatch
                          </span>
                        )}

                        <span className="text-[10px] text-slate-400 font-mono ml-auto">{readableTime}</span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-500 font-mono flex-wrap">
                        <span>Phone: <span className="font-sans font-bold text-slate-600">{msg.phone}</span></span>
                        {msg.plan && <span>Plan: <span className="font-sans font-bold text-slate-600">{msg.plan}</span></span>}
                        {msg.method && <span>Method: <span className="font-sans font-bold text-slate-600">{msg.method}</span></span>}
                      </div>

                      <div className="mt-2 bg-slate-50 border border-slate-100 rounded-xl p-3 text-[11px] text-slate-600 font-sans tracking-wide leading-relaxed relative">
                        <span className="absolute -top-2 left-3 bg-white px-1.5 py-0.5 text-[8px] font-bold text-slate-400 uppercase tracking-widest border border-slate-100 rounded">
                          Preformatted Message Template
                        </span>
                        {msg.messageText}
                      </div>

                    </div>

                    <div className="flex flex-row md:flex-col items-stretch gap-2 w-full md:w-auto self-stretch justify-end">
                      
                      <button
                        onClick={() => handleSendWelcomeAlert(msg.id, msg.phone, msg.messageText)}
                        className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                          isSent
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200'
                            : 'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-black font-black'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{isSent ? 'Resend WhatsApp' : 'Dispatch Greet'}</span>
                      </button>
                      <button
                        onClick={async () => (await sendSms(msg.phone, msg.messageText)) && onUpdateMessageStatus(msg.id, 'Sent')}
                        className="px-4 py-2 rounded-xl font-bold text-xs bg-sky-500 hover:bg-sky-600 text-black transition-all"
                      >
                        Send SMS
                      </button>

                      <div className="flex items-center justify-between gap-1 w-full md:w-auto">
                        {!isSent ? (
                          <button
                            onClick={() => onUpdateMessageStatus(msg.id, 'Sent')}
                            className="p-1 px-2.5 text-[10px] text-slate-500 hover:text-slate-700 font-sans font-semibold text-center hover:bg-slate-100 rounded-lg transition-colors flex-1"
                          >
                            ✓ Mark Sent
                          </button>
                        ) : (
                          <button
                            onClick={() => onUpdateMessageStatus(msg.id, 'Pending')}
                            className="p-1 px-2.5 text-[10px] text-slate-500 hover:text-slate-700 font-sans font-semibold text-center hover:bg-slate-100 rounded-lg transition-colors flex-1"
                          >
                            ✕ Mark Pending
                          </button>
                        )}

                        <button
                          onClick={() => onDeleteMessage(msg.id)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete message log"
                          aria-label="Delete message log"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                    </div>

                  </div>
                );
              })}

              {filteredWelcomeMessages.length === 0 && (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-2">
                  <Megaphone className="w-8 h-8 text-slate-350 mx-auto" />
                  <p className="text-sm font-sans text-slate-500 font-bold">No welcome message logs found.</p>
                  <p className="text-xs text-slate-400">Add some registered members or pass swipe entries to populate the real-time queue!</p>
                </div>
              )}
            </div>

          </div>
        </>
      )}

    </div>
  );
}
