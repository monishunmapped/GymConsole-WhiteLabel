import { useState, useEffect, lazy, Suspense } from 'react';
import { Member, CheckIn, MembershipPlan, WelcomeMessage, SecurityConfig, Feedback, CheckInMethod, CheckInResponse, UserSession } from './types';
import { INITIAL_MEMBERS, INITIAL_CHECKINS, MEMBERSHIP_PLANS } from './data/initialData';
import { BrandLogo } from './components/BrandLogo';
import { Toaster } from './components/Toaster';
import { useBrand, brandDb, fillTemplate } from './lib/brand';
import { sendSms } from './lib/messaging';
import { MemberPortal } from './components/MemberPortal';
import { LoginWindow } from './components/LoginWindow';
import { LiveClock } from './components/LiveClock';

const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const MembersList = lazy(() => import('./components/MembersList').then(m => ({ default: m.MembersList })));
const CheckInStation = lazy(() => import('./components/CheckInStation').then(m => ({ default: m.CheckInStation })));
const ExpiryReminders = lazy(() => import('./components/ExpiryReminders').then(m => ({ default: m.ExpiryReminders })));
const InvoiceModal = lazy(() => import('./components/InvoiceModal').then(m => ({ default: m.InvoiceModal })));
const AdminPanel = lazy(() => import('./components/AdminPanel').then(m => ({ default: m.AdminPanel })));
const FeedbackManager = lazy(() => import('./components/FeedbackManager').then(m => ({ default: m.FeedbackManager })));
import { calculateExpiryDate, calculateDaysRemaining, formatDateDDMMYYYY, formatDateISO, todayISO } from './utils/dateUtils';
import { findMemberByCode, newId, whatsappUrl } from './utils/common';
import {
  seedDatabaseIfEmpty,
  membersDb,
  plansDb,
  checkInsDb,
  messagesDb,
  feedbacksDb,
  deleteMember,
  factoryReset,
  securityDb,
} from './lib/firebase';
import {
  LayoutDashboard,
  Users,
  QrCode,
  Smartphone,
  Database,
  Server,
  MessageSquare,
  Megaphone,
  Sparkles,
  X,
  Sun,
  Moon,
  Shield,
  LogOut,
  ThumbsUp,
  LucideIcon,
} from 'lucide-react';

type View = 'dashboard' | 'members' | 'station' | 'portal' | 'reminders' | 'admin' | 'feedbacks';

const DEFAULT_WELCOME = 'Welcome to {GYM}, {NAME}! 🚀 Your account is active under the {PLAN} subscription. We are thrilled to help you achieve your goals!';
const DEFAULT_ENTRY = "Hello {NAME}! 💪 Checked in via {METHOD} for your {PLAN} training session. Let's make today count!";

const NAV_IDLE = 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100';
const NAV_ACTIVE = 'bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-50 shadow-xs border border-transparent dark:border-slate-800';

const NAV: { view: View; label: string; icon: LucideIcon; iconClass?: string; active?: string; idle?: string; adminOnly?: boolean }[] = [
  { view: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { view: 'members', label: 'Members', icon: Users },
  { view: 'station', label: 'Check-In Desk', icon: QrCode },
  { view: 'reminders', label: 'WhatsApp Alerts', icon: MessageSquare, iconClass: 'text-sky-500' },
  { view: 'portal', label: 'Member Portal', icon: Smartphone },
  {
    view: 'feedbacks', label: 'Feedbacks Hub', icon: ThumbsUp,
    active: 'bg-amber-500 text-black shadow-xs border border-transparent font-bold',
    idle: 'text-amber-600 dark:text-amber-400 hover:text-amber-700 font-bold bg-amber-500/10 hover:bg-amber-500/15',
  },
  {
    view: 'admin', label: 'Admin Panel', icon: Shield, adminOnly: true,
    active: 'bg-emerald-600 text-white shadow-xs border border-transparent font-bold',
    idle: 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-bold bg-emerald-500/10 hover:bg-emerald-500/15',
  },
];

export default function App() {
  const brand = useBrand();
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [checkIns, setCheckIns] = useState<CheckIn[]>(INITIAL_CHECKINS);
  const [plans, setPlans] = useState<MembershipPlan[]>(MEMBERSHIP_PLANS);
  const [welcomeMessages, setWelcomeMessages] = useState<WelcomeMessage[]>([]);
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>(securityDb.get);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const currency = brand.currency;
  const setCurrency = (value: string) => brandDb.update({ ...brand, currency: value });
  const [activeInvoiceMember, setActiveInvoiceMember] = useState<Member | null>(null);
  const [isInvoiceNewRegistration, setIsInvoiceNewRegistration] = useState(false);

  const portalOnly = ['portal', 'checkin'].includes(new URLSearchParams(window.location.search).get('view') || '');
  const [currentView, setCurrentView] = useState<View>(portalOnly ? 'portal' : 'dashboard');
  const [isSimulatorEnabled, setIsSimulatorEnabled] = useState(!portalOnly);

  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('gym_user_session') || 'null');
    } catch {
      return null;
    }
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('gym_theme') as 'light' | 'dark') || 'light');

  useEffect(() => {
    if (currentUser) localStorage.setItem('gym_user_session', JSON.stringify(currentUser));
    else localStorage.removeItem('gym_user_session');
  }, [currentUser]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('gym_theme', theme);
  }, [theme]);

  useEffect(() => {
    seedDatabaseIfEmpty();
    const unsubs = [
      membersDb.subscribe(setMembers),
      plansDb.subscribe(setPlans),
      checkInsDb.subscribe(setCheckIns),
      messagesDb.subscribe(setWelcomeMessages),
      feedbacksDb.subscribe(setFeedbacks),
      securityDb.subscribe(setSecurityConfig),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const isExpired = (m: Member) => formatDateISO(m.expiryDate) < todayISO();

  const renewedExpiry = (m: Member) => {
    const plan = plans.find(p => p.name.toLowerCase() === m.plan.toLowerCase()) || plans[0];
    return calculateExpiryDate(isExpired(m) ? todayISO() : m.expiryDate, plan?.durationDays ?? 30).expiryDateIso;
  };

  useEffect(() => {
    members
      .filter(m => m.autoRenew && isExpired(m))
      .forEach(m => membersDb.patch(m.id, { expiryDate: renewedExpiry(m), status: 'Active' }));
  }, [members, plans]);

  const queueMessage = (type: WelcomeMessage['type'], m: Member, text: string, method?: string) =>
    messagesDb.put({
      id: newId('MSG'),
      type,
      memberId: m.id,
      memberName: m.name,
      phone: m.phone,
      messageText: text,
      timestamp: new Date().toISOString(),
      method,
      plan: m.plan,
      status: 'Pending',
    });

  const handleProcessCheckIn = (code: string, method: CheckInMethod): CheckInResponse => {
    const { member, ambiguous } = findMemberByCode(members, code);
    if (!member) {
      return {
        success: false,
        status: 'No Active Plan',
        message: ambiguous
          ? `More than one member matches ${code.trim()}. Please use the full DOB (DDMMYYYY).`
          : `No active profile found matching identity ${code.trim().toUpperCase()}.`,
      };
    }

    if (member.status === 'Paused') {
      return { success: false, status: 'No Active Plan', message: `Membership for ${member.name} is currently PAUSED. Please visit the front desk manager to reactivate.` };
    }

    const updates: Partial<Member> = {};
    if (member.status === 'Expired' || isExpired(member)) {
      if (!member.autoRenew) {
        if (member.status !== 'Expired') membersDb.patch(member.id, { status: 'Expired' });
        return { success: false, status: 'Expired Plan', message: `Membership plan has expired on ${formatDateDDMMYYYY(member.expiryDate)}. Please renew subscription.` };
      }
      updates.expiryDate = renewedExpiry(member);
    }

    const now = new Date().toISOString();
    membersDb.patch(member.id, { ...updates, status: 'Active', totalCheckIns: (member.totalCheckIns || 0) + 1, lastCheckIn: now });
    checkInsDb.put({ id: newId('CI'), memberId: member.id, memberName: member.name, timestamp: now, planType: member.plan, method, status: 'Granted' });
    queueMessage('CheckIn', member, fillTemplate(localStorage.getItem('gym_template_entry') || DEFAULT_ENTRY, { GYM: brand.name, NAME: member.name, METHOD: method, PLAN: member.plan }), method);

    return { success: true, status: 'Granted', message: 'Checked in successfully! Have an excellent training session.' };
  };

  const handleAddMember = (m: Omit<Member, 'totalCheckIns' | 'lastCheckIn'>) => {
    const member: Member = { ...m, totalCheckIns: 0, lastCheckIn: null };
    membersDb.put(member);
    setIsInvoiceNewRegistration(true);
    setActiveInvoiceMember(member);
    queueMessage('Welcome', member, fillTemplate(localStorage.getItem('gym_template_welcome') || DEFAULT_WELCOME, { GYM: brand.name, NAME: member.name, PLAN: member.plan }));
  };

  const handleUpdateMember = (id: string, updates: Partial<Member>) => membersDb.patch(id, updates);

  const handleAddFeedback = (data: Omit<Feedback, 'id' | 'timestamp' | 'status'>) =>
    feedbacksDb.put({ ...data, id: newId('FB'), timestamp: new Date().toISOString(), status: 'Pending' });

  const handleUpdatePlans = async (newPlans: MembershipPlan[]) => {
    const keep = new Set(newPlans.map(p => p.name.trim().toLowerCase()));
    await plansDb.remove(...plans.filter(p => !keep.has(p.name.trim().toLowerCase())).map(p => p.name));
    await plansDb.put(...newPlans.map(p => ({ ...p, name: p.name.trim() })));
  };

  const handleFactoryReset = factoryReset;

  const handleResetDatabase = async () => {
    if (!confirm('Are you sure you want to reset all data in the cloud? This will re-write member directory, plans, and currency back to original factory states across Firebase.')) return;
    await handleFactoryReset();
    alert('Cloud Firestore database re-seeded successfully.');
  };

  const signOut = () => {
    setCurrentUser(null);
    setCurrentView('dashboard');
  };

  if (!currentUser && !(currentView === 'portal' && !isSimulatorEnabled)) {
    return (
      <LoginWindow
        securityConfig={securityConfig}
        onLoginSuccess={session => {
          setCurrentUser(session);
          setCurrentView('dashboard');
        }}
        onBypassToPortal={() => {
          setCurrentView('portal');
          setIsSimulatorEnabled(false);
        }}
      />
    );
  }

  const feedbackProps = {
    feedbacks,
    onUpdateFeedbackStatus: (id: string, status: Feedback['status']) => feedbacksDb.patch(id, { status }),
    onDeleteFeedback: (id: string) => feedbacksDb.remove(id),
    onClearFeedbacks: feedbacksDb.clear,
  };

  const renderView = (view: View) => {
    switch (view) {
      case 'members':
        return <MembersList members={members} onAddMember={handleAddMember} onUpdateMember={handleUpdateMember} onDeleteMember={deleteMember} plans={plans} currency={currency} onTriggerInvoice={setActiveInvoiceMember} />;
      case 'station':
        return <CheckInStation members={members} onCheckIn={handleProcessCheckIn} />;
      case 'reminders':
        return (
          <ExpiryReminders
            members={members}
            onUpdateMember={handleUpdateMember}
            welcomeMessages={welcomeMessages}
            onDeleteMessage={id => messagesDb.remove(id)}
            onUpdateMessageStatus={(id, status) => messagesDb.patch(id, { status })}
          />
        );
      case 'admin':
        return (
          <AdminPanel
            currentUser={currentUser}
            members={members}
            checkIns={checkIns}
            welcomeMessages={welcomeMessages}
            securityConfig={securityConfig}
            onUpdateSecurityConfig={async config => {
              setSecurityConfig(config);
              await securityDb.update(config);
            }}
            onResetMemberStats={() => membersDb.patchAll({ totalCheckIns: 0, lastCheckIn: null })}
            onClearCheckIns={checkInsDb.clear}
            onClearWelcomeMessages={messagesDb.clear}
            onFactoryReset={handleFactoryReset}
            {...feedbackProps}
          />
        );
      case 'feedbacks':
        return <FeedbackManager {...feedbackProps} securityConfig={securityConfig} currentUser={currentUser} />;
      default:
        return (
          <Dashboard
            members={members}
            checkIns={checkIns}
            onNavigate={setCurrentView}
            onAddMember={handleAddMember}
            onDeleteMember={deleteMember}
            onUpdateMember={handleUpdateMember}
            plans={plans}
            onUpdatePlans={handleUpdatePlans}
            currency={currency}
            onUpdateCurrency={setCurrency}
          />
        );
    }
  };

  const pendingMessages = welcomeMessages.filter(m => m.status === 'Pending');
  const hasCriticalReminder = members.some(m => m.status === 'Active' && calculateDaysRemaining(m.expiryDate) === 5);
  const themeIcon = theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-500" />;
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans tracking-normal flex flex-col justify-between relative text-slate-900 dark:text-slate-100 transition-colors duration-150">
      <header className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200/95 dark:border-slate-800 shadow-xs z-40 select-none transition-colors duration-150">
        <div className="max-w-7xl mx-auto px-4 md:px-8 min-h-18 py-3.5 md:py-0 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className="bg-slate-950 p-0.5 rounded-full shadow-md flex items-center justify-center border border-slate-800">
                <BrandLogo size={42} />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="font-sans font-black text-lg text-slate-900 dark:text-slate-100 leading-tight block truncate max-w-48">{brand.name}</span>
                </div>
                <span className="text-[10px] font-semibold text-indigo-500 dark:text-indigo-400 font-sans block mt-0.5">{brand.tagline}</span>
              </div>
            </div>

            <div className="md:hidden flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 flex items-center justify-center"
                aria-label="Toggle Theme"
              >
                {themeIcon}
              </button>
              {currentUser && (
                <button
                  type="button"
                  onClick={signOut}
                  className="p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors cursor-pointer border border-rose-500/10 flex items-center gap-1 text-[11px] font-bold h-[38px]"
                  title="Sign Out Session"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Out</span>
                </button>
              )}
            </div>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-1 bg-slate-100/75 dark:bg-slate-800/60 p-1 rounded-xl w-full md:w-auto border border-transparent dark:border-slate-700/60 transition-colors">
            {NAV.filter(n => !n.adminOnly || currentUser?.role === 'Admin').map(({ view, label, icon: Icon, iconClass, active, idle }) => (
              <button
                key={view}
                onClick={() => setCurrentView(view)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-sans font-semibold text-xs transition-all relative cursor-pointer ${
                  currentView === view ? active || NAV_ACTIVE : idle || NAV_IDLE
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${iconClass || ''}`} />
                {label}
                {view === 'reminders' && hasCriticalReminder && (
                  <span className="absolute -top-1.5 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500"></span>
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-4 text-xs font-mono font-bold text-slate-500">
            <div className="flex items-center gap-2 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 rounded-lg px-3 py-1.5 select-none font-sans">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-mono text-xs font-bold leading-none">
                <LiveClock render={now => `${now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} • ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`} />
              </span>
            </div>

            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 rounded-lg px-3 py-1.5">
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span>DB Size: {members.length} Cards</span>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-sans font-semibold text-xs cursor-pointer select-none"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {themeIcon}
              <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
            </button>

            {currentUser && (
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg select-none font-sans text-xs">
                <span className={`w-2 h-2 rounded-full animate-pulse ${currentUser.role === 'Admin' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                <span className="font-bold text-slate-700 dark:text-slate-300">{currentUser.role}</span>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <button
                  type="button"
                  onClick={signOut}
                  className="text-xs font-bold text-rose-500 hover:text-rose-600 cursor-pointer flex items-center gap-1 hover:underline transition-colors focus:outline-none"
                  title="Sign Out Session"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-6">
        <div className="mb-6 p-4 rounded-2xl bg-slate-900 border border-slate-800 text-white flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm select-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/10 text-sky-500 rounded-xl border border-sky-500/20">
              <Smartphone className="w-5 h-5 animate-pulse" />
            </div>
            <div className="text-left">
              <h4 className="font-sans font-bold text-sm tracking-tight">Interactive Local Simulator</h4>
              <p className="text-xs text-slate-400 mt-0.5">Test DOB check-ins side-by-side with the live administrative database logs!</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-400">Layout Mode:</span>
            <button
              onClick={() => setIsSimulatorEnabled(!isSimulatorEnabled)}
              className={`px-4 py-1.5 rounded-xl font-sans font-bold text-xs transition-all shadow-xs cursor-pointer ${
                isSimulatorEnabled ? 'bg-sky-500 text-black shadow-md hover:bg-sky-400' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white hover:bg-slate-700'
              }`}
            >
              {isSimulatorEnabled ? 'Enabled (Dual-View Monitor)' : 'Disabled (Full-Width view)'}
            </button>
          </div>
        </div>

        {pendingMessages.length > 0 && (
          <div className="mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs text-left space-y-4 animate-slide-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 dark:border-slate-800 pb-3 gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="p-1 px-2.5 bg-emerald-500/10 text-emerald-700 font-sans font-black text-[10px] rounded-full inline-block animate-pulse">PENDING ACTION EXPECTED</span>
                <span className="text-sm font-sans font-bold text-slate-900 dark:text-slate-100">Real-time Sign-Up & Swipe Greet Pending Queue ({pendingMessages.length})</span>
              </div>
              <span className="text-xs font-mono text-slate-400">These actions are matched based on new member sign-ups or desk/scan check-ins</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingMessages.slice(0, 4).map(msg => {
                const markSent = () => messagesDb.patch(msg.id, { status: 'Sent' });
                return (
                  <div key={msg.id} className="bg-slate-900 border border-slate-800 text-white p-4 rounded-2xl shadow-md flex gap-3 text-left relative">
                    <div className="p-2 bg-emerald-500 text-black rounded-xl h-fit">
                      {msg.type === 'Welcome' ? <Sparkles className="w-4 h-4" /> : <Megaphone className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono tracking-wider text-emerald-400 font-bold uppercase bg-slate-800 px-2 py-0.5 rounded">
                          {msg.type === 'Welcome' ? 'New registration invite' : 'member swipe verified'}
                        </span>
                        <button onClick={markSent} className="text-slate-400 hover:text-white transition-colors p-1" title="Dismiss Alert">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div>
                        <h4 className="text-xs font-black font-sans leading-tight">
                          {msg.memberName} ({msg.memberId})
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">
                          Phone: <span className="font-sans font-bold text-slate-300">{msg.phone}</span> {msg.plan && `• Plan: ${msg.plan}`}
                        </p>
                      </div>
                      <div className="text-[10px] text-slate-300 max-h-16 overflow-y-auto font-sans leading-relaxed border-t border-slate-800/80 pt-2 italic">"{msg.messageText}"</div>
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          onClick={() => {
                            window.open(whatsappUrl(msg.phone, msg.messageText, brand.countryCode), '_blank', 'noreferrer,noopener');
                            markSent();
                          }}
                          className="bg-emerald-500 hover:bg-emerald-600 text-black px-2.5 py-1.5 rounded-lg text-[10px] font-bold active:bg-emerald-700 transition-all flex items-center gap-1"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>Shoot WhatsApp</span>
                        </button>
                        <button
                          onClick={async () => (await sendSms(msg.phone, msg.messageText)) && markSent()}
                          className="bg-sky-500 hover:bg-sky-600 text-black px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                        >
                          Send SMS
                        </button>
                        <button onClick={markSent} className="bg-slate-800 text-slate-300 hover:text-white border border-slate-700 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all">
                          Dismiss Alert
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isSimulatorEnabled ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-6">
              <div className="border border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 px-4 py-2.5 rounded-2xl text-left flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full border border-emerald-200">OWNER ADMIN SCREEN</span>
                  <span className="text-xs text-slate-500 font-bold capitalize">{currentView === 'portal' ? 'Dashboard' : currentView} View</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Live Syncing Active
                </span>
              </div>
              <Suspense>{renderView(currentView === 'portal' ? 'dashboard' : currentView)}</Suspense>
            </div>

            <div className="lg:col-span-4 sticky top-24">
              <div className="border border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 px-4 py-2.5 rounded-2xl text-center mb-4">
                <span className="text-[10px] font-mono font-bold text-sky-800 bg-sky-100/70 px-2.5 py-0.5 rounded-full border border-sky-200 uppercase tracking-wider">MEMBER CHECK-IN TERM (QR PORTAL)</span>
              </div>
              <MemberPortal members={members} onCheckIn={handleProcessCheckIn} onSubmitFeedback={handleAddFeedback} />
            </div>
          </div>
        ) : currentView === 'portal' ? (
          <div className="py-6 max-w-md mx-auto space-y-4">
            <MemberPortal members={members} onCheckIn={handleProcessCheckIn} onSubmitFeedback={handleAddFeedback} />
            {!portalOnly && (
              <div className="text-center">
                <button
                  onClick={() => {
                    setCurrentView('dashboard');
                    setIsSimulatorEnabled(true);
                  }}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  ← Back to Central Gym Console (Enable Split-Screen)
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6"><Suspense>{renderView(currentView)}</Suspense></div>
        )}
      </main>

      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200/90 dark:border-slate-800 py-6 select-none">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-400 text-center md:text-left">
            <Server className="w-4 h-4 text-slate-300" />
            <span>{brand.address}</span>
            <span>•</span>
            <span className="font-mono text-[11px]">System Date: {todayISO()}</span>
          </div>
          <div className="flex items-center gap-4">
            {currentUser?.role === 'Admin' && (
              <>
                <button onClick={handleResetDatabase} className="text-rose-500 hover:text-rose-700 font-semibold transition-colors cursor-pointer">
                  Reset Database & Re-Seed
                </button>
                <span className="text-slate-300">|</span>
              </>
            )}
            <span className="text-slate-400 font-medium">{brand.name} Admin Console</span>
          </div>
        </div>
      </footer>

      <Toaster />
      {activeInvoiceMember && (
        <Suspense>
        <InvoiceModal
          member={activeInvoiceMember}
          plans={plans}
          currency={currency}
          isNewRegistration={isInvoiceNewRegistration}
          onClose={() => {
            setActiveInvoiceMember(null);
            setIsInvoiceNewRegistration(false);
          }}
        />
        </Suspense>
      )}
    </div>
  );
}
