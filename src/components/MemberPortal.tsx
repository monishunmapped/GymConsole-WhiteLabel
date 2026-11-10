import { useState, useMemo, useEffect, useRef } from 'react';
import { Member, Feedback, CheckInMethod, CheckInResponse } from '../types';
import { FeedbackForm } from './FeedbackForm';
import { LiveClock } from './LiveClock';
import { useBrand } from '../lib/brand';
import { findMemberByCode, playBeep } from '../utils/common';
import { 
  CheckCircle, 
  XCircle, 
  X,
  Clock,
  Search,
  Smartphone,
  Volume2,
  VolumeX,
  Fingerprint,
  Zap,
  Sparkles,
  Keyboard
} from 'lucide-react';

interface MemberPortalProps {
  members: Member[];
  onCheckIn: (memberId: string, method: CheckInMethod) => CheckInResponse;
  onSubmitFeedback: (feedback: Omit<Feedback, 'id' | 'timestamp' | 'status'>) => Promise<void>;
}

const PIN_LENGTHS = [4, 6, 8];

export function MemberPortal({ members, onCheckIn, onSubmitFeedback }: MemberPortalProps) {
  const brand = useBrand();
  const [authMode, setAuthMode] = useState<'search' | 'pin' | 'biometrics' | 'feedback'>('search');
  const [nameQuery, setNameQuery] = useState('');
  const [dobPin, setDobPin] = useState('');
  const [biometricQuery, setBiometricQuery] = useState('');
  const [biometricSelectedMember, setBiometricSelectedMember] = useState<Member | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatusMsg, setScanStatusMsg] = useState('Place finger on pad to scan');
  const scanIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const [checkInResult, setCheckInResult] = useState<(CheckInResponse & { memberName: string; plan: string; id: string }) | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);
  const [keyboardCaps, setKeyboardCaps] = useState(false);

  useEffect(() => () => clearInterval(scanIntervalRef.current), []);

  const beep = (success: boolean) => isSoundEnabled && playBeep(success);

  const triggerCheckIn = (member: Member, method: CheckInMethod) => {
    const response = onCheckIn(member.id, method);
    beep(response.success);
    setCheckInResult({ ...response, memberName: member.name, plan: member.plan, id: member.id });
  };

  const handleSelfCheckIn = (pin: string) => {
    if (!PIN_LENGTHS.includes(pin.length)) {
      setInputError('Please enter your 4-digit Gate PIN (DDMM) or full DOB.');
      return;
    }
    const { member, ambiguous } = findMemberByCode(members, pin);
    if (!member) {
      setInputError(ambiguous ? 'More than one member shares this PIN. Please enter your full DOB (DDMMYYYY).' : `No member registered matching Gate PIN or DOB: ${pin}.`);
      beep(false);
      return;
    }
    triggerCheckIn(member, 'Self QR Scan');
  };

  const handleKeyPress = (num: string) => {
    setInputError(null);
    setDobPin(prev => (prev.length < 8 ? prev + num : prev));
  };

  const handleBackspace = () => {
    setInputError(null);
    setDobPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setInputError(null);
    setDobPin('');
  };

  const resetPortalState = () => {
    setDobPin('');
    setNameQuery('');
    setInputError(null);
    setCheckInResult(null);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (checkInResult) {
        if (['Enter', 'Escape', ' '].includes(e.key)) {
          e.preventDefault();
          resetPortalState();
        }
        return;
      }
      if (authMode !== 'pin' || tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (/^[0-9]$/.test(e.key)) handleKeyPress(e.key);
      else if (e.key === 'Backspace') handleBackspace();
      else if (e.key === 'Enter') handleSelfCheckIn(dobPin);
      else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') handleClear();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [authMode, dobPin, checkInResult, members]);

  const startFingerprintScan = () => {
    const member = biometricSelectedMember;
    if (!member) return;
    const stages: Record<number, string> = { 30: 'Scanning fingerprint ridges...', 60: 'Matching template with database...', 90: 'Verifying membership status...' };
    let progress = 0;
    setIsScanning(true);
    setScanProgress(0);
    setScanStatusMsg('Initializing biometric scanner...');
    clearInterval(scanIntervalRef.current);
    scanIntervalRef.current = setInterval(() => {
      progress += 10;
      if (stages[progress]) setScanStatusMsg(stages[progress]);
      if (progress < 100) {
        setScanProgress(progress);
        return;
      }
      clearInterval(scanIntervalRef.current);
      setIsScanning(false);
      triggerCheckIn(member, 'Biometric Fingerprint');
      setBiometricSelectedMember(null);
      setBiometricQuery('');
      setScanProgress(0);
      setScanStatusMsg('Place finger on pad to scan');
    }, 200);
  };

  const handleVirtualKeyClick = (char: string) => {
    if (authMode === 'pin') {
      if (char === 'BACKSPACE') handleBackspace();
      else if (char === 'CLEAR') handleClear();
      else if (/^[0-9]$/.test(char)) handleKeyPress(char);
      return;
    }
    const setQuery = authMode === 'biometrics' ? setBiometricQuery : authMode === 'search' ? setNameQuery : null;
    if (!setQuery) return;
    if (char === 'BACKSPACE') setQuery(prev => prev.slice(0, -1));
    else if (char === 'CLEAR') setQuery('');
    else setQuery(prev => prev + (char === 'SPACE' ? ' ' : keyboardCaps ? char.toUpperCase() : char.toLowerCase()));
  };

  const search = (query: string, byEmail = false) => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return members.filter(m => m.name.toLowerCase().includes(q) || m.id.includes(q) || (byEmail && m.email?.toLowerCase().includes(q))).slice(0, 5);
  };

  const searchResults = useMemo(() => search(nameQuery, true), [nameQuery, members]);
  const biometricSearchResults = useMemo(() => search(biometricQuery), [biometricQuery, members]);
  const suggestedMembers = useMemo(() => members.filter(m => m.status === 'Active').slice(0, 4), [members]);

  return (
    <div className="max-w-md mx-auto bg-slate-50 border border-slate-200/60 rounded-3xl overflow-hidden shadow-md font-sans text-slate-800 relative" id="standalone-member-portal">
      
      <div className="bg-slate-900 text-white p-5 relative select-none">
        <div className="absolute inset-0 bg-radial-gradient from-sky-500/15 to-transparent opacity-40 pointer-events-none"></div>
        <div className="relative flex justify-between items-center text-left">
          <div className="space-y-1">
            <span className="text-[10px] bg-sky-500 text-black font-bold px-2.5 py-0.5 rounded-full inline-block font-mono tracking-wider">
              PUBLIC MEMBER PORTAL
            </span>
            <h1 className="text-lg font-bold font-sans tracking-tight">{brand.name} Self-Check-In</h1>
            <p className="text-xs text-slate-400">Scan-free, instant gate entrance kiosk</p>
          </div>
          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={() => setShowVirtualKeyboard(!showVirtualKeyboard)}
              className={`p-2 transition-all rounded-xl border flex items-center justify-center cursor-pointer ${
                showVirtualKeyboard 
                  ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold shadow-xs' 
                  : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:border-slate-600'
              }`}
              title={showVirtualKeyboard ? "Hide Touch Keyboard" : "Open Touch Keyboard"}
            >
              <Keyboard className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsSoundEnabled(!isSoundEnabled)}
              className="p-2 bg-slate-800 text-slate-300 hover:text-white transition-all rounded-xl border border-slate-700 hover:border-slate-600 flex items-center justify-center cursor-pointer relative group"
              title={isSoundEnabled ? "Mute Check-In Sound" : "Enable Check-In Sound"}
            >
              {isSoundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500" />
              )}
            </button>
            <div className="bg-slate-800 text-sky-500 p-2.5 rounded-xl">
              <Smartphone className="w-5 h-5 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">

        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-550">
            <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="text-[11px] font-mono font-extrabold tracking-wider text-slate-500">GATE CLOCK</span>
          </div>
          <span className="text-xs font-mono font-black text-indigo-950">
            <LiveClock render={now => `${now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} • ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`} />
          </span>
        </div>

        {!checkInResult ? (
          <div className="space-y-5">
            
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-150 rounded-2xl">
              <button
                type="button"
                onClick={() => { setAuthMode('search'); setInputError(null); }}
                className={`py-2 px-1 text-xs font-bold rounded-xl transition-all ${
                  authMode === 'search' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🔍 Name Search
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('pin'); setInputError(null); }}
                className={`py-2 px-1 text-xs font-bold rounded-xl transition-all ${
                  authMode === 'pin' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🔢 Birthdate Pin
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('biometrics'); setInputError(null); }}
                className={`py-2 px-1 text-xs font-bold rounded-xl transition-all ${
                  authMode === 'biometrics' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                👤 Biometric Scan
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('feedback'); setInputError(null); }}
                className={`py-2 px-1 text-xs font-bold rounded-xl transition-all ${
                  authMode === 'feedback' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                💡 Gym Feedback
              </button>
            </div>

            {showVirtualKeyboard && (
              <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-lg border border-slate-800 space-y-2 select-none animate-fadeIn text-center">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] font-mono font-bold text-sky-400 flex items-center gap-1">
                    <Keyboard className="w-3 h-3" /> ON-SCREEN TOUCH KEYBOARD
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowVirtualKeyboard(false)}
                    className="text-[10px] text-slate-400 hover:text-white font-bold bg-slate-800 px-2 py-0.5 rounded-lg"
                  >
                    Close ✕
                  </button>
                </div>

                <div className="flex justify-center gap-1">
                  {['1','2','3','4','5','6','7','8','9','0'].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleVirtualKeyClick(num)}
                      className="flex-1 py-1.5 bg-slate-800 hover:bg-sky-600 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95"
                    >
                      {num}
                    </button>
                  ))}
                </div>

                <div className="flex justify-center gap-1">
                  {['Q','W','E','R','T','Y','U','I','O','P'].map(char => (
                    <button
                      key={char}
                      type="button"
                      onClick={() => handleVirtualKeyClick(char)}
                      className="flex-1 py-1.5 bg-slate-800 hover:bg-sky-600 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95"
                    >
                      {keyboardCaps ? char : char.toLowerCase()}
                    </button>
                  ))}
                </div>

                <div className="flex justify-center gap-1 px-2">
                  {['A','S','D','F','G','H','J','K','L'].map(char => (
                    <button
                      key={char}
                      type="button"
                      onClick={() => handleVirtualKeyClick(char)}
                      className="flex-1 py-1.5 bg-slate-800 hover:bg-sky-600 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95"
                    >
                      {keyboardCaps ? char : char.toLowerCase()}
                    </button>
                  ))}
                </div>

                <div className="flex justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => setKeyboardCaps(!keyboardCaps)}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      keyboardCaps ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    ⇪ CAPS
                  </button>
                  {['Z','X','C','V','B','N','M'].map(char => (
                    <button
                      key={char}
                      type="button"
                      onClick={() => handleVirtualKeyClick(char)}
                      className="flex-1 py-1.5 bg-slate-800 hover:bg-sky-600 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95"
                    >
                      {keyboardCaps ? char : char.toLowerCase()}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleVirtualKeyClick('BACKSPACE')}
                    className="px-2 py-1.5 bg-rose-900/80 hover:bg-rose-700 text-rose-200 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95"
                  >
                    ⌫
                  </button>
                </div>

                <div className="flex justify-center gap-1 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleVirtualKeyClick('CLEAR')}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                  >
                    CLEAR ALL
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVirtualKeyClick('SPACE')}
                    className="flex-1 py-1.5 bg-slate-800 hover:bg-sky-600 text-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95"
                  >
                    SPACEBAR
                  </button>
                </div>
              </div>
            )}

            {authMode === 'search' && (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block text-left">
                    Search Registered Member Name or ID
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={nameQuery}
                      onChange={(e) => {
                        setNameQuery(e.target.value);
                        setInputError(null);
                      }}
                      placeholder="Type name (e.g., Alex, Sarah)..."
                      className="w-full text-xs font-bold pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    {nameQuery && (
                      <button
                        type="button"
                        onClick={() => setNameQuery('')}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {searchResults.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">
                        Matching Active Members
                      </p>
                      <div className="space-y-1.5">
                        {searchResults.map((member) => (
                          <div
                            key={member.id}
                            onClick={() => triggerCheckIn(member, 'Manual Select')}
                            className="p-2.5 rounded-xl border border-slate-150 bg-slate-50 hover:bg-slate-900 hover:text-white cursor-pointer transition-all flex justify-between items-center group text-left"
                          >
                            <div className="flex items-center gap-2.5">
                              {member.photoUrl ? (
                                <img src={member.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-200 group-hover:bg-slate-800 flex items-center justify-center font-bold text-xs shrink-0">
                                  {member.name.charAt(0)}
                                </div>
                              )}
                              <div>
                                <h4 className="text-xs font-bold group-hover:text-white">{member.name}</h4>
                                <p className="text-[10px] text-slate-400 group-hover:text-slate-300 font-mono">
                                  ID: {member.id} • {member.plan}
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] bg-sky-100 group-hover:bg-sky-500 text-sky-800 group-hover:text-black font-bold px-2 py-1 rounded-lg">
                              TAP TO ENTER
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {nameQuery && searchResults.length === 0 && (
                    <p className="text-xs text-slate-400 py-3">No matching registered member found.</p>
                  )}
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2 text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Quick Gate Entry (Frequent Members)
                    </span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {suggestedMembers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => triggerCheckIn(member, 'Manual Select')}
                        className="p-2 rounded-xl border border-slate-150 hover:border-slate-900 bg-slate-50 hover:bg-slate-100 transition-all text-left flex items-center gap-2 cursor-pointer"
                      >
                        <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                          {member.name.charAt(0)}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold truncate text-slate-800">{member.name}</p>
                          <p className="text-[9px] text-slate-400 font-mono truncate">{member.plan}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {authMode === 'pin' && (
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    ENTRY GATE PIN (DATE OF BIRTH: DDMM)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Use 4-digit <strong className="text-slate-800 font-bold">DDMM</strong> (e.g. <strong className="text-emerald-600 font-bold">2502</strong> for 25th Feb), or your full DOB if asked.
                  </p>
                </div>

                <div className="flex justify-center gap-2 py-2">
                  {Array.from({ length: Math.max(4, dobPin.length) }, (_, index) => {
                    const digit = dobPin[index];
                    return (
                      <div
                        key={index}
                        className={`${dobPin.length > 4 ? 'w-9' : 'w-12'} h-14 rounded-xl border-2 flex items-center justify-center text-xl font-mono font-black transition-all ${
                          digit 
                            ? 'border-slate-900 bg-white text-slate-900 shadow-sm' 
                            : 'border-slate-200 bg-slate-100 text-slate-300'
                        }`}
                      >
                        {digit || ''}
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleKeyPress(num)}
                      className="py-3.5 bg-white border border-slate-200/90 rounded-2xl text-lg font-extrabold text-slate-800 hover:bg-slate-900 hover:text-white transition-all shadow-xs active:scale-98 cursor-pointer"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleClear}
                    className="py-3.5 bg-slate-100 border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
                  >
                    CLEAR
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeyPress('0')}
                    className="py-3.5 bg-white border border-slate-200/90 rounded-2xl text-lg font-extrabold text-slate-800 hover:bg-slate-900 hover:text-white transition-all shadow-xs active:scale-98 cursor-pointer"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleBackspace}
                    className="py-3.5 bg-slate-100 border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all flex items-center justify-center cursor-pointer"
                  >
                    ⌫
                  </button>
                </div>

                {inputError && (
                  <p className="text-[11px] text-rose-600 font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-100 text-center">
                    {inputError}
                  </p>
                )}

                <button
                  type="button"
                  disabled={!PIN_LENGTHS.includes(dobPin.length)}
                  onClick={() => handleSelfCheckIn(dobPin)}
                  className="w-full py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 transition-all shadow-md cursor-pointer flex justify-center items-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  <span>SUBMIT BIRTHDATE PIN</span>
                </button>
              </div>
            )}

            {authMode === 'biometrics' && (
              <div className="space-y-4 text-left">
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 text-indigo-600">
                    <Fingerprint className="w-5 h-5 animate-pulse" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Biometric Touch Scanner
                    </h3>
                  </div>

                  {!biometricSelectedMember ? (
                    <div className="space-y-3">
                      <p className="text-[11px] text-slate-500">
                        Select member to scan fingerprint or verify identity:
                      </p>
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          value={biometricQuery}
                          onChange={(e) => setBiometricQuery(e.target.value)}
                          placeholder="Search member name..."
                          className="w-full text-xs font-bold pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                        />
                      </div>

                      {biometricSearchResults.length > 0 && (
                        <div className="space-y-1 pt-2">
                          {biometricSearchResults.map((m) => (
                            <div
                              key={m.id}
                              onClick={() => setBiometricSelectedMember(m)}
                              className="p-2.5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 cursor-pointer transition-all flex justify-between items-center"
                            >
                              <span className="text-xs font-bold text-slate-800">{m.name}</span>
                              <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded">
                                Select
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4 text-center py-2">
                      <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 flex justify-between items-center text-left">
                        <div>
                          <p className="text-xs font-bold text-indigo-950">{biometricSelectedMember.name}</p>
                          <p className="text-[10px] text-indigo-600 font-mono">ID: {biometricSelectedMember.id}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setBiometricSelectedMember(null)}
                          className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                        >
                          Change
                        </button>
                      </div>

                      <div className="flex flex-col items-center justify-center gap-3 py-4">
                        <button
                          type="button"
                          disabled={isScanning}
                          onClick={startFingerprintScan}
                          className={`w-24 h-24 rounded-full border-4 flex flex-col items-center justify-center transition-all cursor-pointer relative ${
                            isScanning 
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-600 animate-pulse' 
                              : 'border-slate-300 hover:border-indigo-500 bg-slate-50 hover:bg-indigo-50/30 text-slate-600'
                          }`}
                        >
                          <Fingerprint className="w-10 h-10" />
                          <span className="text-[9px] font-bold mt-1 uppercase">
                            {isScanning ? 'Scanning...' : 'Touch Scanner'}
                          </span>
                        </button>

                        <p className="text-xs font-medium text-slate-600">{scanStatusMsg}</p>

                        {isScanning && (
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-indigo-600 h-2 transition-all duration-200" 
                              style={{ width: `${scanProgress}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {authMode === 'feedback' && (
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                <FeedbackForm members={members} onSubmitFeedback={onSubmitFeedback} />
              </div>
            )}

          </div>
        ) : (
          /* CHECK-IN RESULT CARD */
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md text-center space-y-4 animate-scale-up">
            <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center ${
              checkInResult.success ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
            }`}>
              {checkInResult.success ? (
                <CheckCircle className="w-10 h-10 animate-bounce-slow" />
              ) : (
                <XCircle className="w-10 h-10" />
              )}
            </div>

            <div>
              <span className={`text-[10px] font-mono font-bold px-3 py-1 rounded-full uppercase tracking-wider inline-block mb-1 ${
                checkInResult.status === 'Granted' 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-rose-100 text-rose-800'
              }`}>
                {checkInResult.status}
              </span>
              <h2 className="text-xl font-black text-slate-900">{checkInResult.memberName}</h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {checkInResult.id} • {checkInResult.plan}</p>
            </div>

            <p className={`text-xs font-semibold p-3 rounded-xl ${
              checkInResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}>
              {checkInResult.message}
            </p>

            <button
              type="button"
              onClick={resetPortalState}
              className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              Done / Check In Next Member
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
