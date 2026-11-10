import React, { useState, useRef, useEffect } from 'react';
import { Member, CheckInMethod, CheckInResponse } from '../types';
import { generateQrSvg } from '../utils/qrGenerator';
import { findMemberByCode, playBeep } from '../utils/common';
import { LiveClock } from './LiveClock';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  CheckCircle, 
  XCircle, 
  Volume2, 
  VolumeX, 
  Sparkles,
  ArrowRight,
  Database,
  Lock
} from 'lucide-react';

interface CheckInStationProps {
  members: Member[];
  onCheckIn: (memberId: string, method: CheckInMethod) => CheckInResponse;
}

const checkInPortalUrl = `${window.location.origin}${window.location.pathname}?view=portal`;

export function CheckInStation({ members, onCheckIn }: CheckInStationProps) {
  const [memberIdInput, setMemberIdInput] = useState('');
  const [directorySearch, setDirectorySearch] = useState('');
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string; memberName?: string; plan?: string; id?: string; status?: string; photoUrl?: string } | null>(null);
  const [activeAnimation, setActiveAnimation] = useState<'success' | 'fail' | null>(null);
  const [animatedMemberName, setAnimatedMemberName] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const triggerCheckIn = (code: string, method: CheckInMethod) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;

    const { member } = findMemberByCode(members, cleanCode);
    const result = onCheckIn(member ? member.id : cleanCode, method);
    if (!isMuted) playBeep(result.success);

    setScanResult({
      success: result.success,
      message: result.message,
      memberName: member?.name || 'Unknown Badge ID',
      plan: member?.plan || 'None',
      id: member?.id || cleanCode,
      status: member?.status || 'Unregistered',
      photoUrl: member?.photoUrl,
    });
    setAnimatedMemberName(member?.name || (result.success ? 'Authorized Member' : 'Access Denied'));
    setActiveAnimation(result.success ? 'success' : 'fail');
    setMemberIdInput('');

    timers.current.forEach(clearTimeout);
    timers.current = [setTimeout(() => setActiveAnimation(null), 2500), setTimeout(() => setScanResult(null), 4500)];
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerCheckIn(memberIdInput, 'Front Desk Scan');
  };

  const simulateCardScan = (m: Member) => triggerCheckIn(m.id, 'Self QR Scan');

  const runRandomSimulation = () => members.length && simulateCardScan(members[Math.floor(Math.random() * members.length)]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in text-slate-800" id="checkin-gate-terminal">
      
      <div className="lg:col-span-12 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
        <div className="text-left">
          <h1 className="text-3xl font-sans font-bold tracking-tight text-slate-900 animate-fade-in">
            Gym Check-In Entry Console
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Allow members to check-in manually or select them instantly from the front-gate desk directory
          </p>
        </div>
        <div className="bg-slate-900 text-white rounded-2xl px-5 py-2.5 shadow-sm border border-slate-800 text-right shrink-0 select-none">
          <p className="text-[10px] font-mono font-bold text-sky-400 tracking-wider uppercase block text-left sm:text-right">FRONT DESK MONITOR</p>
          <p className="text-sm font-bold font-sans tracking-tight text-slate-200 mt-0.5">
            <LiveClock render={now => now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} />
          </p>
          <p className="text-xs font-mono font-extrabold text-sky-450 block mt-0.5">
            <LiveClock render={now => now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })} />
          </p>
        </div>
      </div>

      <div className="lg:col-span-7 space-y-6">
        
        {scanResult && (
          <div 
            className={`border rounded-2xl p-5 shadow-xs transition-all flex items-start gap-4 ${
              scanResult.success 
                ? 'bg-emerald-50/70 border-emerald-200/80' 
                : 'bg-rose-50/70 border-rose-200/80'
            }`}
            id="scan-result-banner"
          >
            <div className="flex gap-2 shrink-0">
              {scanResult.photoUrl ? (
                <div className="w-14 h-14 rounded-full border-2 border-white shadow-md overflow-hidden bg-white shrink-0">
                  <img src={scanResult.photoUrl} alt={scanResult.memberName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
              ) : (
                <div className={`p-2.5 rounded-xl ${scanResult.success ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'} self-start shrink-0`}>
                  {scanResult.success ? <CheckCircle className="w-5 h-5 animate-bounce" /> : <XCircle className="w-5 h-5 animate-pulse" />}
                </div>
              )}
            </div>
            
            <div className="space-y-1.5 flex-1 text-left">
              <div className="flex justify-between items-start flex-wrap gap-2">
                <h3 className="font-sans font-extrabold text-base leading-none">
                  {scanResult.success ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
                </h3>
                <div className="text-right flex flex-col items-end">
                  <span className="font-mono text-xs opacity-60 font-bold">{scanResult.id}</span>
                  <span className="text-[10px] text-indigo-700 bg-indigo-50/50 border border-indigo-100/60 px-1.5 py-0.5 rounded font-mono font-bold mt-1.5 inline-block">
                    Entry Stamp: {new Date().toLocaleDateString()} @ {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
              
              <div className="text-sm">
                <span className="font-bold text-slate-900">{scanResult.memberName}</span>
                <span className="opacity-80"> — {scanResult.message}</span>
              </div>
              
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[11px] font-semibold opacity-75 font-sans">
                <span>Tier Plan: {scanResult.plan}</span>
                <span>Verification State: {scanResult.status}</span>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200/85 rounded-2xl p-6 shadow-sm relative overflow-hidden" id="scanner-viewport-panel">
          
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-500" />
              <h2 className="text-base font-sans font-bold text-slate-900">Front Desk Verification</h2>
            </div>

            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1 px-2.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 flex items-center gap-1.5 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span>{isMuted ? 'Muted' : 'Sound On'}</span>
            </button>
          </div>

          <div className="aspect-video bg-slate-950 rounded-2xl relative overflow-hidden group border-2 border-slate-900 flex flex-col justify-center items-center">
            
            <div className="text-center p-8 space-y-4 select-none">
              <div className="relative inline-block">
                <div className="w-16 h-16 rounded-2xl border-4 border-indigo-505/20 flex items-center justify-center mx-auto bg-slate-900">
                  <Lock className="w-8 h-8 text-indigo-400" />
                </div>
                <span className="absolute -inset-1 rounded-2xl border border-indigo-500 animate-pulse opacity-40"></span>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-200 font-sans">Member Gate Ready</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Key in a member's DOB ID below to process entrance or trigger a simulated quick swipe
                </p>
              </div>
            </div>

            <div className="absolute bottom-4 right-4 z-15">
              <button
                type="button"
                onClick={runRandomSimulation}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 shadow-md transition-all active:scale-95 cursor-pointer"
                id="btn-simulate-badge"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Simulate Random Swipe
              </button>
            </div>

            <AnimatePresence>
              {activeAnimation && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`absolute inset-0 z-20 flex flex-col items-center justify-center backdrop-blur-md p-6 text-center ${
                    activeAnimation === 'success' 
                      ? 'bg-emerald-950/90 text-white' 
                      : 'bg-rose-950/90 text-white'
                  }`}
                  id="scanner-active-animation-overlay"
                >
                  <motion.div
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                    className="relative flex items-center justify-center flex-col space-y-4"
                  >
                    <div className="relative">
                      <motion.div
                        animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: 'easeOut' }}
                        className={`absolute inset-0 rounded-full ${
                          activeAnimation === 'success' ? 'bg-emerald-400' : 'bg-rose-500'
                        }`}
                      />

                      <div className={`w-16 h-16 rounded-full flex items-center justify-center relative z-10 border-4 shadow-xl ${
                        activeAnimation === 'success' 
                          ? 'bg-emerald-500 border-white text-white' 
                          : 'bg-rose-500 border-white text-white'
                      }`}>
                        {activeAnimation === 'success' ? (
                          <CheckCircle className="w-8 h-8 animate-bounce" />
                        ) : (
                          <XCircle className="w-8 h-8 animate-pulse" />
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 z-10">
                      <motion.h4
                        initial={{ y: 15, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="text-lg font-black tracking-tight font-sans"
                      >
                        {activeAnimation === 'success' ? 'ACCESS GRANTED' : 'ACCESS RESTRICTED'}
                      </motion.h4>
                      
                      <motion.p
                        initial={{ y: 15, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-xs font-bold opacity-90 max-w-xs mx-auto truncate"
                      >
                        {animatedMemberName}
                      </motion.p>
                      
                      <motion.p
                        initial={{ y: 15, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-[11px] opacity-70"
                      >
                        {activeAnimation === 'success' ? '🔓 Gate Opened • Welcome!' : '🔒 Closed • Contact Desk'}
                      </motion.p>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

          <form onSubmit={handleManualSubmit} className="mt-6 flex gap-3 h-11" id="manual-gate-input-form">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Type member DOB (DDMMYYYY) or Gate PIN (DDMM) to process..."
                value={memberIdInput}
                onChange={e => setMemberIdInput(e.target.value)}
                className="w-full text-slate-950 pl-11 pr-4 py-2.5 h-full rounded-xl border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans font-bold uppercase"
              />
            </div>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 font-sans font-bold text-xs shrink-0 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              Verify Member
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

        </div>

      </div>

      <div className="lg:col-span-5 space-y-6">
        
        <div className="bg-white border border-slate-200/85 rounded-2xl p-6 shadow-sm text-center space-y-4" id="gym-entrance-qr-panel">
          <div className="space-y-1">
            <h2 className="text-base font-sans font-bold text-slate-900">Entrance QR Directory</h2>
            <p className="text-xs text-slate-500">
              Personal self check-in link for members on their smartphones
            </p>
          </div>

          {checkInPortalUrl && (
            <div className="space-y-4">
              <div 
                className="inline-block p-4 border border-slate-200 bg-white shadow-inner rounded-2xl select-none"
                title={checkInPortalUrl}
              >
                <div 
                  dangerouslySetInnerHTML={{ __html: generateQrSvg(checkInPortalUrl, 160) }}
                  className="w-40 h-40 mx-auto"
                />
              </div>

              <div className="border border-slate-100 rounded-xl p-2 bg-slate-50 text-[10px] font-mono break-all text-slate-400 line-clamp-1">
                {checkInPortalUrl}
              </div>
            </div>
          )}

          <div className="pt-2 text-xs text-slate-500 leading-relaxed">
            Members can scan this QR code or use the smartphone frame on the right side screen to check-in themselves instantly in real-time.
          </div>
        </div>

        <div className="bg-white border border-slate-200/85 rounded-2xl p-6 shadow-sm" id="fast-checkin-selector">
          <h2 className="text-base font-sans font-bold text-slate-900 mb-1">Desk Directory Check-In</h2>
          <p className="text-xs text-slate-500 mb-3">Filter member database to instantly check-in with one click</p>

          <div className="relative mb-3.5">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search directory by name or DOB ID..."
              value={directorySearch}
              onChange={e => setDirectorySearch(e.target.value)}
              className="w-full text-slate-950 pl-9 pr-8 py-1.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans font-bold"
            />
            {directorySearch && (
              <button
                type="button"
                onClick={() => setDirectorySearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                title="Clear filter text"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto space-y-2 pr-1" id="fast-sim-list">
            {members.filter(m => 
              m.name.toLowerCase().includes(directorySearch.toLowerCase()) || 
              m.id.includes(directorySearch) ||
              (m.phone && m.phone.includes(directorySearch))
            ).map(m => {
              return (
                <button
                   key={m.id}
                   type="button"
                   onClick={() => simulateCardScan(m)}
                   className="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50/50 transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${
                      m.status === 'Active' ? 'bg-emerald-500' : m.status === 'Paused' ? 'bg-amber-500' : 'bg-rose-500'
                    }`} />
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-905 group-hover:text-indigo-600 transition-colors">{m.name}</p>
                      <p className="text-[10px] font-mono text-slate-500">
                        <span className="font-semibold text-slate-700">DOB:</span> {m.id} • <span className="font-semibold text-sky-700">PIN:</span> {m.id.length >= 4 ? m.id.slice(0, 4) : m.id} • {m.plan}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold font-mono text-indigo-700 border border-indigo-100 rounded px-1.5 py-0.5 bg-indigo-50/50 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-colors">
                      CHECK IN
                    </span>
                  </div>
                </button>
              );
            })}
            {members.filter(m => 
              m.name.toLowerCase().includes(directorySearch.toLowerCase()) || 
              m.id.includes(directorySearch)
            ).length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-xl border border-slate-100">
                No matched profiles found in gym database.
              </p>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
