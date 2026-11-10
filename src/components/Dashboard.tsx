import React, { useMemo, useState } from 'react';
import { Member, CheckIn, MembershipPlanName, MembershipPlan } from '../types';
import { calculateDaysRemaining, calculateExpiryDate, formatDateISO, todayISO } from '../utils/dateUtils';
import { downloadCsv, fileToDataUrl, parseDobCode, whatsappUrl } from '../utils/common';
import { LiveClock } from './LiveClock';
import { BrandLogo } from './BrandLogo';
import { useBrand } from '../lib/brand';
import { sendEmail, sendSms } from '../lib/messaging';
import { printElement, downloadPdf } from '../utils/print';

import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { 
  Users, 
  CheckSquare, 
  TrendingUp, 
  DollarSign, 
  UserCheck, 
  AlertTriangle,
  Clock,
  MessageSquare,
  BarChart2,
  UserPlus,
  UserX,
  Plus,
  Trash2,
  Camera,
  RefreshCw,
  Upload,
  Target,
  FileSpreadsheet,
  ChevronDown,
  Printer,
  FileText,
  Gift,
  Cake,
  PartyPopper,
  Send,
  Copy,
  Check,
  Search,
  Calendar,
  Sparkles,
  Edit3,
  X,
  Phone,
  Mail
} from 'lucide-react';

const PLAN_COLORS_PALETTE = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

interface DashboardProps {
  members: Member[];
  checkIns: CheckIn[];
  onNavigate: (view: 'dashboard' | 'members' | 'station' | 'portal' | 'reminders') => void;
  onAddMember?: (member: Omit<Member, 'totalCheckIns' | 'lastCheckIn'>) => void;
  onDeleteMember?: (id: string) => void;
  onUpdateMember?: (id: string, updates: Partial<Member>) => void;
  plans: MembershipPlan[];
  onUpdatePlans: (plans: MembershipPlan[]) => void;
  currency: string;
  onUpdateCurrency: (currency: string) => void;
}

export function Dashboard({ 
  members, 
  checkIns, 
  onNavigate, 
  onAddMember, 
  onDeleteMember,
  onUpdateMember,
  plans,
  onUpdatePlans,
  currency,
  onUpdateCurrency
}: DashboardProps) {
  const brand = useBrand();
  const slug = brand.name.replace(/[^a-z0-9]+/gi, '_');
  const TODAY_STR = todayISO();

  const [activeDashboardTab, setActiveDashboardTab] = useState<'overview' | 'birthdays'>('overview');

  const [birthdaySearchQuery, setBirthdaySearchQuery] = useState('');
  const [birthdayFilter, setBirthdayFilter] = useState<'all' | 'today' | 'upcoming'>('all');

  const [greetingModalData, setGreetingModalData] = useState<{
    member: Member;
    turningAge: number;
    birthdayDateStr: string;
    daysLeft: number;
    isToday: boolean;
  } | null>(null);
  const [customGreetingMessage, setCustomGreetingMessage] = useState('');
  const [greetingChannel, setGreetingChannel] = useState<'whatsapp' | 'email' | 'sms'>('whatsapp');

  const [editDobMember, setEditDobMember] = useState<Member | null>(null);
  const [editDobValue, setEditDobValue] = useState('');

  const [dailyCheckInGoal, setDailyCheckInGoal] = useState<number>(() => {
    const saved = localStorage.getItem('gym_daily_checkin_goal');
    return saved ? parseInt(saved, 10) : 15;
  });
  const [isEditingGoal, setIsEditingGoal] = useState<boolean>(false);
  const [tempGoal, setTempGoal] = useState<string>(String(dailyCheckInGoal));
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [volumeChartType, setVolumeChartType] = useState<'bar' | 'area'>('bar');

  const getDaysUntilBirthdayInfo = (dobStr?: string, notes?: string, refDate: Date = new Date()) => {
    let dobVal = dobStr;

    if (!dobVal && notes) {
      const matchSlash = notes.match(/DOB:\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
      if (matchSlash) {
        const [, day, month, year] = matchSlash;
        dobVal = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      } else {
        const matchDash = notes.match(/DOB:\s*(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/i);
        if (matchDash) {
          dobVal = `${matchDash[1]}-${matchDash[2].padStart(2, '0')}-${matchDash[3].padStart(2, '0')}`;
        }
      }
    }

    if (!dobVal) return null;

    const parts = dobVal.split('-');
    if (parts.length !== 3) return null;

    const birthYear = parseInt(parts[0], 10);
    const birthMonth = parseInt(parts[1], 10) - 1;
    const birthDay = parseInt(parts[2], 10);

    if (isNaN(birthYear) || isNaN(birthMonth) || isNaN(birthDay)) return null;

    const currentYear = refDate.getFullYear();
    let candidate = new Date(currentYear, birthMonth, birthDay);

    const todayReset = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
    let candReset = new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate());

    let diffDays = Math.round((candReset.getTime() - todayReset.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      candidate = new Date(currentYear + 1, birthMonth, birthDay);
      candReset = new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate());
      diffDays = Math.round((candReset.getTime() - todayReset.getTime()) / (1000 * 60 * 60 * 24));
    }

    const turningAge = candidate.getFullYear() - birthYear;
    const birthdayDateStr = candidate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return {
      daysLeft: diffDays,
      turningAge,
      birthdayDateStr,
      formattedDob: `${birthYear}-${String(birthMonth + 1).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`
    };
  };

  const birthdayMembersList = useMemo(() => {
    const refDate = new Date();
    const results: {
      member: Member;
      daysLeft: number;
      turningAge: number;
      birthdayDateStr: string;
      isToday: boolean;
      formattedDob: string;
    }[] = [];

    members.forEach(member => {
      const info = getDaysUntilBirthdayInfo(member.dob, member.notes, refDate);
      if (info && info.daysLeft >= 0 && info.daysLeft <= 7) {
        results.push({
          member,
          daysLeft: info.daysLeft,
          turningAge: info.turningAge,
          birthdayDateStr: info.birthdayDateStr,
          isToday: info.daysLeft === 0,
          formattedDob: info.formattedDob
        });
      }
    });

    return results.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [members, TODAY_STR]);

  const filteredBirthdayMembers = useMemo(() => {
    return birthdayMembersList.filter(item => {
      const query = birthdaySearchQuery.toLowerCase();
      const matchesSearch = item.member.name.toLowerCase().includes(query) ||
        item.member.phone.includes(query) ||
        item.member.email.toLowerCase().includes(query) ||
        item.member.plan.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      if (birthdayFilter === 'today') return item.isToday;
      if (birthdayFilter === 'upcoming') return !item.isToday;
      return true;
    });
  }, [birthdayMembersList, birthdaySearchQuery, birthdayFilter]);

  const birthdayMessage = (data: { member: Member; turningAge: number; birthdayDateStr: string; isToday: boolean }) =>
    data.isToday
      ? `Happy Birthday ${data.member.name}! 🎉🎂 Wishing you a fantastic ${data.turningAge}th birthday filled with health, strength, and happiness from all of us at ${brand.name}! Stop by the desk during your next check-in for a complimentary protein shake on us! 🏋️‍♂️💪`
      : `Early Happy Birthday ${data.member.name}! 🎈 Wishing you an incredible year ahead as you turn ${data.turningAge} on ${data.birthdayDateStr}! Keep crushing your fitness goals with ${brand.name}! 🏋️‍♂️🔥`;

  const handleOpenGreetingModal = (data: {
    member: Member;
    turningAge: number;
    birthdayDateStr: string;
    daysLeft: number;
    isToday: boolean;
  }) => {
    setGreetingModalData(data);
    setCustomGreetingMessage(birthdayMessage(data));
  };

  const handleDispatchGreeting = async () => {
    if (!greetingModalData) return;
    const { member } = greetingModalData;
    let sent = true;
    if (greetingChannel === 'whatsapp') window.open(whatsappUrl(member.phone, customGreetingMessage, brand.countryCode), '_blank');
    else if (greetingChannel === 'email') sent = await sendEmail(member.email, `Happy Birthday from ${brand.name}!`, customGreetingMessage);
    else sent = await sendSms(member.phone, customGreetingMessage);
    if (sent) onUpdateMember?.(member.id, { birthdayGreetingSentDate: TODAY_STR });
  };

  const handleSaveDob = () => {
    if (editDobMember && editDobValue && onUpdateMember) {
      onUpdateMember(editDobMember.id, { dob: editDobValue });
      setEditDobMember(null);
      setEditDobValue('');
    }
  };

  const handleExportMembersCSV = () => {
    downloadCsv(`${slug}_Members_List_${TODAY_STR}.csv`, [
      ['Member ID/DOB', 'Name', 'Email', 'Phone', 'Membership Status', 'Plan Type', 'Gender', 'Join Date', 'Expiry Date', 'Total Check-Ins', 'Special Notes'],
      ...members.map(m => [m.id, m.name, m.email, m.phone, m.status, m.plan, m.gender || 'Not Specified', m.joinDate, m.expiryDate, m.totalCheckIns || 0, m.notes]),
    ]);
    setIsExportDropdownOpen(false);
  };

  const handleExportCheckInsCSV = () => {
    downloadCsv(`${slug}_CheckIn_Logs_${TODAY_STR}.csv`, [
      ['Check-In ID', 'Member ID/DOB', 'Member Name', 'Timestamp', 'Plan Type', 'Check-In Method', 'Status'],
      ...checkIns.map(c => [c.id, c.memberId, c.memberName, c.timestamp, c.planType || 'None', c.method, c.status]),
    ]);
    setIsExportDropdownOpen(false);
  };

  const handleExportExecutiveSummaryCSV = () => {
    const activePct = totalMembers > 0 ? ((activeMembersCount / totalMembers) * 100).toFixed(1) : '0';
    downloadCsv(`${slug}_Executive_Operations_Report_${TODAY_STR}.csv`, [
      [`${brand.name.toUpperCase()} - EXECUTIVE GYM OPERATIONS REPORT`],
      ['Generated Date', TODAY_STR],
      [],
      ['SECTION 1: OPERATIONAL KPI SCORECARD'],
      ['Metric', 'Value', 'Details'],
      ['Total Registered Members', totalMembers, 'Cumulative membership profiles in dataset'],
      ['Active Members', activeMembersCount, `(${activePct}% active subscription rate)`],
      ['Paused Members', pausedMembersCount, 'Voluntary paused memberships'],
      ['Expired Members', expiredMembersCount, 'Past-due renewal actions required'],
      ['Estimated Monthly Revenue', `${currency}${estimatedRevenue}`, 'Calculated off active plan rates'],
      ["Today's Entry Goal", dailyCheckInGoal, 'Targeted check-in count'],
      ["Today's Completed Entries", todayCheckIns.length, `(${((todayCheckIns.length / dailyCheckInGoal) * 100).toFixed(1)}% of checklist target met)`],
      [],
      ['SECTION 2: SUBSCRIPTION PLANS ENGAGEMENT DEVIATION'],
      ['Plan Name', 'Active Members Count', 'Monthly Revenue share'],
      ...planRevenueData.map(p => [p.name, p.memberCount, `${currency}${p.value}`]),
      [],
      ['SECTION 3: HISTORICAL ACTIVITY PROFILE BY HOUR'],
      ['Hour', 'Scanned Logs Count'],
      ...peakHoursData.map(pt => [pt.label, pt.count]),
    ]);
    setIsExportDropdownOpen(false);
  };

  const handleSaveGoal = (newGoal: number) => {
    const validatedGoal = Math.max(1, newGoal);
    setDailyCheckInGoal(validatedGoal);
    localStorage.setItem('gym_daily_checkin_goal', String(validatedGoal));
    setTempGoal(String(validatedGoal));
    setIsEditingGoal(false);
  };

  const totalMembers = members.length;
  const activeMembersCount = useMemo(() => members.filter(m => m.status === 'Active').length, [members]);
  const pausedMembersCount = useMemo(() => members.filter(m => m.status === 'Paused').length, [members]);
  const expiredMembersCount = useMemo(() => members.filter(m => m.status === 'Expired').length, [members]);

  const activeRate = totalMembers > 0 ? Math.round((activeMembersCount / totalMembers) * 100) : 0;

  const todayCheckIns = useMemo(() => checkIns.filter(ci => formatDateISO(ci.timestamp) === TODAY_STR), [checkIns, TODAY_STR]);

  const qrCheckInCount = useMemo(() => todayCheckIns.filter(ci => ci.method === 'Self QR Scan').length, [todayCheckIns]);
  const manualCheckInCount = useMemo(() => todayCheckIns.filter(ci => ci.method !== 'Self QR Scan').length, [todayCheckIns]);

  const planRevenueData = useMemo(() => {
    const dataMap: Record<string, { name: string; value: number; memberCount: number }> = {};
    
    plans.forEach(p => {
      dataMap[p.name] = {
        name: p.name,
        value: 0,
        memberCount: 0
      };
    });

    members.forEach(m => {
      if (m.status === 'Active') {
        const planObj = plans.find(p => p.name === m.plan);
        if (planObj) {
          const monthlyContribution = planObj.durationDays > 0 ? (planObj.price * 30 / planObj.durationDays) : 0;
          if (!dataMap[m.plan]) {
            dataMap[m.plan] = { name: m.plan, value: 0, memberCount: 0 };
          }
          dataMap[m.plan].value += monthlyContribution;
          dataMap[m.plan].memberCount += 1;
        }
      }
    });

    return Object.values(dataMap).map(item => ({
      ...item,
      value: Math.round(item.value)
    }));
  }, [members, plans]);

  const estimatedRevenue = useMemo(() => planRevenueData.reduce((sum, p) => sum + p.value, 0), [planRevenueData]);

  const chartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const full = formatDateISO(d);
      const dayLogs = checkIns.filter(ci => formatDateISO(ci.timestamp) === full);
      const label = `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getDate()}${i === 6 ? ' (Today)' : ''}`;
      const qrCount = dayLogs.filter(ci => ci.method === 'Self QR Scan').length;
      return { label, labelShort: label, full, count: dayLogs.length, qrCount, deskCount: dayLogs.length - qrCount };
    });
  }, [checkIns]);

  const total7DayVolume = useMemo(() => chartData.reduce((sum, d) => sum + d.count, 0), [chartData]);
  const avg7DayVolume = useMemo(() => Math.round(total7DayVolume / 7), [total7DayVolume]);
  const peakDay = useMemo(() => {
    return chartData.reduce((max, d) => d.count > max.count ? d : max, chartData[0]);
  }, [chartData]);

  const criticalRemindersCount = useMemo(() => {
    return members.filter(m => {
      if (m.status !== 'Active') return false;
      const diffDays = calculateDaysRemaining(m.expiryDate);
      return diffDays === 5;
    }).length;
  }, [members]);

  const getMemberAge = (member: Member): number | null => {
    const info = getDaysUntilBirthdayInfo(member.dob, member.notes) || getDaysUntilBirthdayInfo(parseDobCode(member.id)?.dob);
    return info ? (info.daysLeft === 0 ? info.turningAge : info.turningAge - 1) : null;
  };

  const ageDistributionData = useMemo(() => {
    const brackets = [
      { range: 'Under 20', count: 0, fill: '#94a3b8' },
      { range: '20-29', count: 0, fill: '#38bdf8' },
      { range: '30-39', count: 0, fill: '#10b981' },
      { range: '40-49', count: 0, fill: '#f59e0b' },
      { range: '50-59', count: 0, fill: '#ef4444' },
      { range: '60+', count: 0, fill: '#8b5cf6' },
    ];

    members.forEach(member => {
      const age = getMemberAge(member);
      if (age === null) return;

      if (age < 20) brackets[0].count++;
      else if (age < 30) brackets[1].count++;
      else if (age < 40) brackets[2].count++;
      else if (age < 50) brackets[3].count++;
      else if (age < 60) brackets[4].count++;
      else brackets[5].count++;
    });

    return brackets;
  }, [members]);

  const genderDistributionData = useMemo(() => {
    const genders: Record<string, { count: number; fill: string }> = {
      'Male': { count: 0, fill: '#0ea5e9' },
      'Female': { count: 0, fill: '#f472b6' },
      'Non-Binary': { count: 0, fill: '#a78bfa' },
      'Other': { count: 0, fill: '#34d399' },
      'Not Specified': { count: 0, fill: '#94a3b8' }
    };

    members.forEach(member => {
      let g = member.gender || 'Not Specified';
      if (g === 'Prefer Not to Say' || g === 'Prefer Not To Say') {
        g = 'Not Specified';
      }
      if (genders[g]) {
        genders[g].count++;
      } else {
        genders['Other'].count++;
      }
    });

    return Object.entries(genders)
      .map(([name, info]) => ({
        name,
        value: info.count,
        fill: info.fill
      }))
      .filter(item => item.value > 0);
  }, [members]);

  const genderSummaryStats = useMemo(() => {
    let male = 0;
    let female = 0;
    members.forEach(m => {
      const g = m.gender || 'Not Specified';
      if (g === 'Male') male++;
      else if (g === 'Female') female++;
    });
    return { male, female };
  }, [members]);

  const getCheckInHour = (timestampString: string) => new Date(timestampString).getHours();

  const hourFormat = (h: number): string => {
    if (h === 12) return '12 PM';
    if (h === 0) return '12 AM';
    return h > 12 ? `${h - 12} PM` : `${h} AM`;
  };

  const [heatmapTab, setHeatmapTab] = useState<'heatmap' | 'chart'>('heatmap');
  const [hoveredCell, setHoveredCell] = useState<{ dayName: string; hourLabel: string; count: number } | null>(null);

  const displayCheckIns = checkIns;

  const heatmapGrid = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const hours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]; // 16 hours
    
    const mapDayToIdx = (jsDay: number) => {
      return jsDay === 0 ? 6 : jsDay - 1;
    };

    const grid = days.map((dayName, dIdx) => {
      return hours.map(h => ({
        dayName,
        dayIndex: dIdx,
        hour: h,
        hourLabel: hourFormat(h),
        count: 0
      }));
    });

    displayCheckIns.forEach(ci => {
      const d = new Date(ci.timestamp);
      if (isNaN(d.getTime())) return;
      const jsDay = d.getDay();
      const dIdx = mapDayToIdx(jsDay);
      const hr = getCheckInHour(ci.timestamp);
      const hIdx = hours.indexOf(hr);
      
      if (dIdx >= 0 && dIdx < 7 && hIdx >= 0) {
        grid[dIdx][hIdx].count += 1;
      }
    });

    return grid;
  }, [displayCheckIns]);

  const peakHoursData = useMemo(() => {
    const CORE_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
    return CORE_HOURS.map(h => {
      const count = displayCheckIns.filter(ci => getCheckInHour(ci.timestamp) === h).length;
      return {
        hour: h,
        label: hourFormat(h),
        count: count,
      };
    });
  }, [displayCheckIns]);

  const peakHourSummaryText = useMemo(() => {
    if (displayCheckIns.length === 0) return "No check-ins logged yet in system database.";
    
    const hourCounts: { [key: number]: number } = {};
    displayCheckIns.forEach(ci => {
      const hr = getCheckInHour(ci.timestamp);
      hourCounts[hr] = (hourCounts[hr] || 0) + 1;
    });

    let maxHr = -1;
    let maxCt = 0;
    Object.entries(hourCounts).forEach(([hrStr, count]) => {
      const hr = parseInt(hrStr, 10);
      if (count > maxCt) {
        maxCt = count;
        maxHr = hr;
      }
    });

    if (maxHr === -1) return "System is identifying operational metrics...";

    const peakTimeLabel = hourFormat(maxHr);
    const nextHourLabel = hourFormat((maxHr + 1) % 24);
    return `Gym peak hour detected at ${peakTimeLabel} - ${nextHourLabel} with ${maxCt} scanned entries.`;
  }, [displayCheckIns]);

  const [quickName, setQuickName] = useState('');
  const [quickEmail, setQuickEmail] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickAltPhone, setQuickAltPhone] = useState('');
  const [quickDob, setQuickDob] = useState('');
  const [quickPlan, setQuickPlan] = useState<MembershipPlanName>('Monthly Core');
  const [quickGender, setQuickGender] = useState('Male');
  const [quickShift, setQuickShift] = useState<'Morning' | 'Evening'>('Morning');
  const [enrollFeedback, setEnrollFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const [reportGymName, setReportGymName] = useState(brand.name.toUpperCase());
  const [reportAddress, setReportAddress] = useState(brand.address);
  const [reportPhone, setReportPhone] = useState(brand.phone);
  const [reportEmail, setReportEmail] = useState(brand.email);
  const [reportGstin, setReportGstin] = useState(brand.gstin);
  const [reportWebsite, setReportWebsite] = useState(brand.website);
  const [reportBadge, setReportBadge] = useState('OPERATIONS REPORT');
  const [reportTitle, setReportTitle] = useState('EXECUTIVE GYM STATISTICAL SCORECARD');
  const [reportDescription, setReportDescription] = useState('An automated compilation of active memberships, daily entries, and revenue projections.');
  const [reportPeakRemarks, setReportPeakRemarks] = useState('Keep front-desk staffing active during these peaks to guide self-service QR code scans.');
  const [reportSig1, setReportSig1] = useState('Prepared By Operations Manager');
  const [reportSig2, setReportSig2] = useState('Authorized Admin Seal');
  const [isReportEditMode, setIsReportEditMode] = useState(false);

  const [quickCapturedPhoto, setQuickCapturedPhoto] = useState<string>('');
  const [quickIsCameraActive, setQuickIsCameraActive] = useState(false);
  const [quickCameraStream, setQuickCameraStream] = useState<MediaStream | null>(null);
  const quickVideoRef = React.useRef<HTMLVideoElement | null>(null);

  const startQuickCamera = async () => {
    try {
      if (quickCameraStream) {
        quickCameraStream.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 320, facingMode: 'user' }
      });
      setQuickCameraStream(stream);
      setQuickIsCameraActive(true);
      setTimeout(() => {
        if (quickVideoRef.current) {
          quickVideoRef.current.srcObject = stream;
          quickVideoRef.current.play().catch(e => console.warn('Video play interrupted', e));
        }
      }, 100);
    } catch (err) {
      console.error("Quick camera access failed:", err);
      alert("Could not access webcam. Please check your browser's frame permissions.");
    }
  };

  const stopQuickCamera = () => {
    if (quickCameraStream) {
      quickCameraStream.getTracks().forEach(track => track.stop());
      setQuickCameraStream(null);
    }
    setQuickIsCameraActive(false);
  };

  const takeQuickSnapshot = () => {
    if (quickVideoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const video = quickVideoRef.current;
        const videoWidth = video.videoWidth || 320;
        const videoHeight = video.videoHeight || 320;
        const size = Math.min(videoWidth, videoHeight);
        const sx = (videoWidth - size) / 2;
        const sy = (videoHeight - size) / 2;
        ctx.drawImage(video, sx, sy, size, size, 0, 0, 240, 240);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setQuickCapturedPhoto(dataUrl);
        stopQuickCamera();
      }
    }
  };

  const handleQuickFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) fileToDataUrl(file).then(setQuickCapturedPhoto);
  };

  React.useEffect(() => {
    return () => {
      if (quickCameraStream) {
        quickCameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [quickCameraStream]);

  const [revokeMemberId, setRevokeMemberId] = useState('');
  const [revokeFeedback, setRevokeFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const [editedCurrency, setEditedCurrency] = useState(currency);
  const [editedPlans, setEditedPlans] = useState<MembershipPlan[]>(() => plans);
  const [configFeedback, setConfigFeedback] = useState<{ success: boolean; message: string } | null>(null);

  React.useEffect(() => {
    setEditedCurrency(currency);
  }, [currency]);

  React.useEffect(() => {
    setEditedPlans(plans);
  }, [plans]);

  const handleUpdateLocalPlan = (index: number, key: keyof MembershipPlan, value: any) => {
    const updated = editedPlans.map((plan, i) => {
      if (i === index) {
        return { ...plan, [key]: value };
      }
      return plan;
    });
    setEditedPlans(updated);
  };

  const handleUpdateLocalPlanFeatures = (index: number, textValue: string) => {
    const featuresArray = textValue.split(',').map(f => f.trim()).filter(f => f.length > 0);
    const updated = editedPlans.map((plan, i) => {
      if (i === index) {
        return { ...plan, features: featuresArray };
      }
      return plan;
    });
    setEditedPlans(updated);
  };

  const handleSaveConfigs = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedCurrency.trim()) {
      setConfigFeedback({ success: false, message: 'Currency symbol cannot be blank!' });
      return;
    }
    
    for (const plan of editedPlans) {
      if (plan.price < 0 || isNaN(plan.price)) {
        setConfigFeedback({ success: false, message: `Price for plan "${plan.name}" must be a valid positive number.` });
        return;
      }
      if (plan.durationDays <= 0 || isNaN(plan.durationDays)) {
        setConfigFeedback({ success: false, message: `Duration for plan "${plan.name}" must be a positive integer in days.` });
        return;
      }
    }

    onUpdateCurrency(editedCurrency.trim());
    onUpdatePlans(editedPlans);
    
    setConfigFeedback({ success: true, message: 'Settings saved and synced across all terminals successfully!' });
    setTimeout(() => {
      setConfigFeedback(null);
    }, 4000);
  };

  const handleQuickEnrollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName.trim() || !quickEmail.trim() || !quickPhone.trim() || !quickDob.trim()) {
      setEnrollFeedback({ success: false, message: 'Please fill name, email, phone, and DOB.' });
      return;
    }

    const parsedDob = parseDobCode(quickDob);
    if (!parsedDob) {
      setEnrollFeedback({ success: false, message: 'DOB/PIN must be a valid date: 4 digits (DDMM), 6 digits (DDMMYY), or 8 digits (DDMMYYYY).' });
      return;
    }

    if (members.some(m => m.id === parsedDob.id)) {
      setEnrollFeedback({ success: false, message: `A member with ID/DOB "${parsedDob.id}" already exists.` });
      return;
    }

    const planObj = plans.find(p => p.name === quickPlan) || plans[0];
    const joinDate = TODAY_STR;
    const { expiryDateIso } = calculateExpiryDate(joinDate, planObj?.durationDays ?? 30);

    if (onAddMember) {
      onAddMember({
        id: parsedDob.id,
        dob: parsedDob.dob,
        name: quickName.trim(),
        email: quickEmail.trim(),
        phone: quickPhone.trim(),
        alternatePhone: quickAltPhone.trim() || undefined,
        status: 'Active',
        plan: quickPlan,
        gender: quickGender,
        shiftTiming: quickShift,
        photoUrl: quickCapturedPhoto || undefined,
        joinDate,
        expiryDate: expiryDateIso,
        notes: `Quick enrolled. Shift: ${quickShift}.`
      });

      setEnrollFeedback({ success: true, message: `Successfully enrolled ${quickName.trim()} (${quickShift} Shift) with ID: ${parsedDob.id}!` });
      
      setQuickName('');
      setQuickEmail('');
      setQuickPhone('');
      setQuickAltPhone('');
      setQuickDob('');
      setQuickPlan('Monthly Core');
      setQuickGender('Male');
      setQuickShift('Morning');
      setQuickCapturedPhoto('');
      stopQuickCamera();
      
      setTimeout(() => setEnrollFeedback(null), 5000);
    }
  };

  const handleQuickRevokeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokeMemberId) {
      setRevokeFeedback({ ...revokeFeedback, success: false, message: 'Please select a member to revoke.' });
      return;
    }

    const targetMember = members.find(m => m.id === revokeMemberId);
    if (!targetMember) {
      setRevokeFeedback({ ...revokeFeedback, success: false, message: 'Selected member profile not found.' });
      return;
    }

    const confirmMessage = `Are you absolutely sure you want to revoke membership and completely delete profile of ${targetMember.name} (ID: ${targetMember.id})? Matches will be permanently discarded.`;
    if (confirm(confirmMessage)) {
      if (onDeleteMember) {
        onDeleteMember(revokeMemberId);
        setRevokeFeedback({ success: true, message: `Successfully deleted member ${targetMember.name}.` });
        setRevokeMemberId('');
        setTimeout(() => setRevokeFeedback(null), 4000);
      }
    }
  };

  return (
    <div className="space-y-8 animate-fade-in" id="dashboard-tab">
      
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-2">
        <div className="text-left flex-1">
          <h1 className="text-3xl font-sans font-bold tracking-tight text-slate-900 flex items-center gap-3 flex-wrap animate-fade-in" id="dash-title">
            <span>Gym Operations</span>
            <span className="text-xs font-mono font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 flex items-center gap-1.5 shrink-0 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>LIVE: <LiveClock render={now => `${now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} • ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`} /></span>
            </span>
          </h1>
          <p className="text-sm text-slate-500 font-sans mt-1">
            Real-time metric monitoring and member entry status
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-4 w-full lg:w-auto shrink-0">
          
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col min-w-[270px] text-left shrink-0" id="daily-goal-tracker-widget">
            <div className="flex items-center justify-between mb-1.5 gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1 px-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600">
                  <Target className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <span className="text-xs font-sans font-bold text-slate-900">Daily Entry Goal</span>
                  <p className="text-[10px] text-slate-400 font-sans font-medium">Goal progress status</p>
                </div>
              </div>
              
              {isEditingGoal ? (
                <div className="flex items-center gap-1" id="goal-editor-controls">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={tempGoal}
                    onChange={(e) => setTempGoal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveGoal(parseInt(tempGoal, 10) || dailyCheckInGoal);
                      } else if (e.key === 'Escape') {
                        setIsEditingGoal(false);
                        setTempGoal(String(dailyCheckInGoal));
                      }
                    }}
                    className="w-12 text-center text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveGoal(parseInt(tempGoal, 10) || dailyCheckInGoal)}
                    className="px-1.5 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-sans font-bold transition-colors cursor-pointer shadow-3xs"
                    title="Save target goal"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingGoal(false);
                      setTempGoal(String(dailyCheckInGoal));
                    }}
                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-sans transition-colors cursor-pointer"
                    title="Cancel"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-800 font-mono">
                    Target: <strong className="text-slate-950 font-extrabold">{dailyCheckInGoal}</strong>
                  </span>
                  <button
                    onClick={() => {
                      setTempGoal(String(dailyCheckInGoal));
                      setIsEditingGoal(true);
                    }}
                    className="text-[10px] font-sans font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 transition-colors cursor-pointer"
                    id="btn-edit-daily-goal"
                    title="Configure target value"
                  >
                    Set
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-baseline text-xs font-mono">
                <span className="text-slate-500 font-semibold font-sans">Progress Today:</span>
                <span className="font-extrabold text-slate-950">
                  {todayCheckIns.length} <span className="text-slate-400 font-medium">/ {dailyCheckInGoal} check-ins</span>
                </span>
              </div>
              
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden relative">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    todayCheckIns.length >= dailyCheckInGoal 
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
                      : todayCheckIns.length >= dailyCheckInGoal * 0.7 
                        ? 'bg-gradient-to-r from-indigo-500 to-sky-500' 
                        : 'bg-indigo-600'
                  }`}
                  style={{ width: `${Math.min(100, (todayCheckIns.length / dailyCheckInGoal) * 100)}%` }}
                />
              </div>

              <div className="flex justify-between items-center mt-1">
                <span className="text-[10px] font-bold font-sans flex items-center gap-1">
                  {todayCheckIns.length >= dailyCheckInGoal ? (
                    <span className="text-emerald-600 flex items-center gap-0.5 animate-pulse font-extrabold">
                      🎉 Goal Achieved! ({Math.round((todayCheckIns.length / dailyCheckInGoal) * 100)}%)
                    </span>
                  ) : (
                    <span className="text-indigo-600 font-bold">
                      {Math.round((todayCheckIns.length / dailyCheckInGoal) * 100)}% of goal reached
                    </span>
                  )}
                </span>
                <span className="text-[9px] font-medium text-slate-400 font-sans italic">Updated live</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => onNavigate('reminders')}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-5 py-2.5 rounded-xl font-sans font-bold text-sm border border-slate-200 transition-all duration-150 relative self-stretch cursor-pointer select-none"
              id="btn-quick-reminders"
            >
              <MessageSquare className="w-4 h-4 text-emerald-600 animate-pulse" />
              <span>WhatsApp Reminders</span>
              {criticalRemindersCount > 0 && (
                <span className="bg-sky-500 text-black font-sans font-extrabold text-[10px] px-2 py-0.5 rounded-full animate-bounce">
                  {criticalRemindersCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setShowReportModal(true)}
              className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-5 py-2.5 rounded-xl font-sans font-bold text-sm border border-indigo-250/30 transition-all duration-150 relative self-stretch cursor-pointer select-none"
              id="btn-generate-print-report"
            >
              <Printer className="w-4 h-4 text-indigo-600" />
              <span>Generate Report</span>
            </button>

            <div className="relative" id="export-csv-dropdown-container">
              <button
                onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-sans font-bold text-sm transition-all duration-150 shadow-md active:scale-99 cursor-pointer select-none"
                id="btn-export-reports-dropdown"
              >
                <FileSpreadsheet className="w-4 h-4 animate-pulse" />
                <span>Export Data Suite</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExportDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isExportDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsExportDropdownOpen(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 py-3 text-left animate-fade-in" id="export-dropdown-menu">
                    <div className="px-4 pb-2 border-b border-slate-100 dark:border-slate-900 mb-2">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">External Reporting Tools</span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Select a spreadsheet output format:</p>
                    </div>

                    <button
                      onClick={handleExportMembersCSV}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 transition-colors text-xs font-semibold cursor-pointer"
                      id="export-members-csv-btn"
                    >
                      <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-lg">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="block text-slate-900 dark:text-slate-100 font-bold">Member Directory CSV</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">Contact details, active plans, log count</span>
                      </div>
                    </button>

                    <button
                      onClick={handleExportCheckInsCSV}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 transition-colors text-xs font-semibold cursor-pointer"
                      id="export-checkins-csv-btn"
                    >
                      <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-lg">
                        <CheckSquare className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="block text-slate-900 dark:text-slate-100 font-bold">Check-In Logs CSV</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">Detailed logs of scans and entry dates</span>
                      </div>
                    </button>

                    <button
                      onClick={handleExportExecutiveSummaryCSV}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 transition-colors text-xs font-semibold cursor-pointer"
                      id="export-summary-csv-btn"
                    >
                      <div className="p-1.5 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-lg">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="block text-slate-900 dark:text-slate-100 font-bold">Executive Operations Summary</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">KPI scorecard, plans & peak analytics</span>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs mb-6">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveDashboardTab('overview')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-sans font-bold text-xs transition-all cursor-pointer ${
              activeDashboardTab === 'overview'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            id="tab-dashboard-overview"
          >
            <BarChart2 className="w-4 h-4 text-indigo-600" />
            <span>Operations Overview</span>
          </button>

          <button
            onClick={() => setActiveDashboardTab('birthdays')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-sans font-bold text-xs transition-all cursor-pointer relative ${
              activeDashboardTab === 'birthdays'
                ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
            }`}
            id="tab-dashboard-birthdays"
          >
            <Cake className="w-4 h-4 animate-bounce" />
            <span>Upcoming Birthdays</span>
            {birthdayMembersList.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-extrabold ${
                activeDashboardTab === 'birthdays' ? 'bg-white text-rose-600' : 'bg-rose-500 text-white'
              }`}>
                {birthdayMembersList.length}
              </span>
            )}
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium px-2 flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
          <span>System Anchor Date: <strong className="font-mono text-slate-800 dark:text-slate-200">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong></span>
        </div>
      </div>

      {activeDashboardTab === 'overview' && (
        <div className="space-y-8 animate-fade-in">
          {birthdayMembersList.length > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-indigo-500/10 border border-amber-300/60 dark:border-amber-500/30 text-slate-900 dark:text-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xs select-none mb-6" id="birthday-announcement-widget">
              <div className="flex items-center gap-3 text-left">
                <div className="p-2.5 bg-gradient-to-br from-amber-500 to-rose-500 text-white rounded-2xl shadow-sm">
                  <Cake className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-sans font-extrabold text-sm tracking-tight text-slate-900 dark:text-slate-100">
                      🎂 {birthdayMembersList.length} Member{birthdayMembersList.length > 1 ? 's' : ''} celebrating birthdays in the next 7 days!
                    </h4>
                    {birthdayMembersList.some(b => b.isToday) && (
                      <span className="bg-rose-500 text-white font-extrabold text-[9px] px-2 py-0.5 rounded-full animate-bounce">
                        1 TODAY!
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    Send quick personalized birthday greetings & offer complimentary gym perks to build community rapport.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setActiveDashboardTab('birthdays')}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-rose-600 text-white font-bold rounded-xl text-xs hover:from-amber-500 hover:to-rose-500 active:scale-95 transition-all shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Gift className="w-4 h-4" />
                <span>View Birthdays & Send Greetings →</span>
              </button>
            </div>
          )}

      {criticalRemindersCount > 0 && (
        <div className="p-4 rounded-2xl bg-sky-50 border border-sky-300 text-slate-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xs select-none" id="critical-alert-banner">
          <div className="flex items-center gap-3 text-left">
            <div className="p-2 bg-sky-500 text-black rounded-xl">
              <AlertTriangle className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h4 className="font-sans font-extrabold text-sm tracking-tight text-slate-900">
                Action Required: {criticalRemindersCount} Membership Renewal alerts due!
              </h4>
              <p className="text-xs text-slate-550 mt-0.5">
                We detected active members with exactly 5 days left on their plans. Send courtesy friendly warning notifications via WhatsApp API.
              </p>
            </div>
          </div>
          <button 
            onClick={() => onNavigate('reminders')}
            className="px-4 py-2 bg-slate-950 text-white font-bold rounded-xl text-xs hover:bg-slate-800 active:scale-95 transition-all shadow-xs"
          >
            Dispatch Alerts Now
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" id="dashboard-metric-cards">
        
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex items-start justify-between" id="metric-active-members">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Members</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-sans font-bold text-slate-900">{activeMembersCount}</span>
              <span className="text-xs text-slate-400 font-mono">/ {totalMembers} total</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-sans mt-2">
              <UserCheck className="w-3.5 h-3.5" />
              <span>{activeRate}% retention rate</span>
            </div>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex items-start justify-between" id="metric-daily-checkins">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Check-ins</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-sans font-bold text-slate-900">{todayCheckIns.length}</span>
              <span className="text-xs text-slate-400 font-sans">completed</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold">QR: {qrCheckInCount}</span>
              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold">Desk: {manualCheckInCount}</span>
            </div>
          </div>
          <div className="bg-sky-50 text-sky-600 p-3 rounded-xl">
            <CheckSquare className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex items-start justify-between" id="metric-revenue">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Monthly MRR Run-rate</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-sans font-bold text-slate-900">{currency}{estimatedRevenue.toLocaleString()}</span>
              <span className="text-xs text-slate-400 font-sans">/ mo</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-sans mt-2">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Projected healthy run-rate</span>
            </div>
          </div>
          <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm" id="metric-status-ratios">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Status Breakdown</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Active
              </span>
              <span className="font-mono font-bold text-slate-900">{activeMembersCount}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Paused
              </span>
              <span className="font-mono font-bold text-slate-900">{pausedMembersCount}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Expired
              </span>
              <span className="font-mono font-bold text-slate-900">{expiredMembersCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm text-left" id="quick-member-operations">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-sans font-bold text-slate-900">Quick Member Management</h2>
          <span className="text-[10px] font-mono bg-indigo-50 text-indigo-705 px-2 py-0.5 rounded border border-indigo-150 font-bold ml-1">DIRECT DATABASE ACTIONS</span>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <div className="space-y-4 border-r border-slate-100 pr-0 lg:pr-8 text-left">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <UserPlus className="w-4 h-4 text-emerald-600" />
              <span>Enroll Gym Member</span>
            </div>
            
            <form onSubmit={handleQuickEnrollSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Full Name</label>
                  <input
                    type="text"
                    required
                    value={quickName}
                    onChange={e => setQuickName(e.target.value)}
                    placeholder="e.g. Liam Sterling"
                    className="w-full text-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-sans"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Email Address</label>
                  <input
                    type="email"
                    required
                    value={quickEmail}
                    onChange={e => setQuickEmail(e.target.value)}
                    placeholder="e.g. liam@gmail.com"
                    className="w-full text-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-sans"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Mobile Phone</label>
                  <input
                    type="text"
                    required
                    value={quickPhone}
                    onChange={e => setQuickPhone(e.target.value)}
                    placeholder="e.g. +91 99999-55555"
                    className="w-full text-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Shift Timing</label>
                  <select
                    value={quickShift}
                    onChange={e => setQuickShift(e.target.value as 'Morning' | 'Evening')}
                    className="w-full text-slate-950 px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50/40 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans font-bold"
                  >
                    <option value="Morning">☀️ Morning Shift</option>
                    <option value="Evening">🌙 Evening Shift</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">DOB / Gate PIN (DDMM)</label>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    value={quickDob}
                    onChange={e => setQuickDob(e.target.value.replace(/\D/g, ''))}
                    placeholder="DDMM (e.g. 2502)"
                    className="w-full text-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 text-xs font-mono font-bold text-center focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Gender</label>
                  <select
                    value={quickGender}
                    onChange={e => setQuickGender(e.target.value)}
                    className="w-full text-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-sans"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-Binary">Non-Binary</option>
                    <option value="Other">Other</option>
                    <option value="Prefer Not To Say">Prefer Not to Say</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Subscription Tier</label>
                  <select
                    value={quickPlan}
                    onChange={e => setQuickPlan(e.target.value as MembershipPlanName)}
                    className="w-full text-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-sans"
                  >
                    {plans.map(p => (
                      <option key={p.name} value={p.name}>
                        {p.name} ({currency}{p.price})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Alt Phone <span className="text-slate-400 font-normal">(Opt)</span></label>
                  <input
                    type="text"
                    value={quickAltPhone}
                    onChange={e => setQuickAltPhone(e.target.value)}
                    placeholder="e.g. +91 98765-00000"
                    className="w-full text-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-sans"
                  />
                </div>
              </div>

              <div className="border border-slate-200/60 bg-slate-50/50 rounded-xl p-3 flex items-center gap-4">
                <div className="relative w-14 h-14 rounded-full border-2 border-white shadow-sm bg-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                  {quickCapturedPhoto ? (
                    <img src={quickCapturedPhoto} alt="Snapshot Preview" className="w-full h-full object-cover" />
                  ) : quickIsCameraActive ? (
                    <video
                      ref={quickVideoRef}
                      className="w-full h-full object-cover scale-x-[-1]"
                      playsInline
                      muted
                    />
                  ) : (
                    <Camera className="w-5 h-5 text-slate-400 opacity-60" />
                  )}
                  
                  {quickIsCameraActive && (
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </div>

                <div className="flex-1 space-y-1 min-w-0">
                  <div className="text-[11px] font-semibold text-slate-700 font-sans flex items-center gap-1.5">
                    <span>Member ID Photo Snapshot</span>
                    {quickCapturedPhoto && (
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">READY</span>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {!quickCapturedPhoto ? (
                      <>
                        {!quickIsCameraActive ? (
                          <>
                            <button
                              type="button"
                              onClick={startQuickCamera}
                              className="bg-sky-50 text-sky-700 hover:bg-sky-100 font-bold text-[10px] px-2.5 py-1.5 rounded-lg border border-sky-200/55 flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Camera className="w-3 h-3" />
                              Start Camera
                            </button>
                            <label className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] px-2.5 py-1.5 rounded-lg border border-slate-300 flex items-center gap-1 cursor-pointer transition-colors">
                              <Upload className="w-3 h-3" />
                              Upload File
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleQuickFileUpload}
                                className="hidden"
                              />
                            </label>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={takeQuickSnapshot}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg shadow-sm flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              Snapshot
                            </button>
                            <button
                              type="button"
                              onClick={stopQuickCamera}
                              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setQuickCapturedPhoto('')}
                        className="text-rose-600 hover:bg-rose-50 hover:text-rose-800 font-bold text-[10px] px-2.5 py-1 rounded-lg border border-rose-200/55 flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Retake Snapshot
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex-1 mr-4">
                  {enrollFeedback && (
                    <p className={`text-[11px] font-semibold px-2 py-1 rounded text-left ${
                      enrollFeedback.success ? 'text-emerald-700 bg-emerald-50 border border-emerald-100' : 'text-rose-700 bg-rose-50 border border-rose-100'
                    }`}>
                      {enrollFeedback.message}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-750 active:bg-emerald-800 text-white font-sans font-bold text-xs p-2.5 rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Enroll Member
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-4 text-left">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <UserX className="w-4 h-4 text-rose-600" />
              <span>Revoke Gym Membership</span>
            </div>
            
            <form onSubmit={handleQuickRevokeSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">Select Member Profile to Delete</label>
                <select
                  value={revokeMemberId}
                  onChange={e => {
                    setRevokeMemberId(e.target.value);
                    setRevokeFeedback(null);
                  }}
                  className="w-full text-gradient text-slate-950 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-sans"
                >
                  <option value="">-- Choose registered gym attendee --</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} [ID/Code: {m.id}] — {m.plan} ({m.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-h-[48px]">
                {revokeMemberId ? (() => {
                  const target = members.find(m => m.id === revokeMemberId);
                  if (!target) return null;
                  return (
                    <div className="p-2 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between text-xs animate-fade-in text-left">
                      <div>
                        <p className="font-extrabold text-slate-900">{target.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Email Link: {target.email} | Expiry: {target.expiryDate}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono tracking-wider ${
                        target.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' : 'bg-rose-50 text-rose-700 border border-rose-150'
                      }`}>
                        {target.status}
                      </span>
                    </div>
                  );
                })() : (
                  <p className="text-[10.5px] text-slate-400 font-sans leading-relaxed text-left py-1">
                    Choose a member above. Revocation will safely remove the member profile and clean up associated historical scanning databases instantly.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex-1 mr-4">
                  {revokeFeedback && (
                    <p className={`text-[11px] font-semibold px-2 py-1 rounded text-left ${
                      revokeFeedback.success ? 'text-emerald-700 bg-emerald-50 border border-emerald-100' : 'text-rose-700 bg-rose-50 border border-rose-100'
                    }`}>
                      {revokeFeedback.message}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={!revokeMemberId}
                  className="bg-rose-600 hover:bg-rose-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-sans font-bold text-xs p-2.5 rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Revoke Card
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm text-left" id="subscriptions-control-panel">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-650" />
            <h2 className="text-lg font-sans font-bold text-slate-900">Gym Pricing & Currency Controls</h2>
            <span className="text-[10px] font-mono bg-indigo-50 text-indigo-705 px-2 py-0.5 rounded border border-indigo-150 font-bold ml-1">MASTER CONFIGS</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">Instant Cross-Terminal Sync</span>
        </div>

        <form onSubmit={handleSaveConfigs} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            <div className="lg:col-span-3 space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
              <div className="space-y-1 text-left">
                <label className="text-xs font-bold text-slate-700 block text-left">Currency Symbol</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={editedCurrency}
                    onChange={e => {
                      setEditedCurrency(e.target.value);
                      setConfigFeedback(null);
                    }}
                    placeholder="e.g. $, €, £, ₹"
                    maxLength={3}
                    className="w-full text-slate-950 font-extrabold text-sm pl-4 pr-12 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-sans"
                  />
                  <div className="absolute right-3 top-2.5 text-[10px] font-mono font-bold text-slate-500 border-l border-slate-150 pl-2">
                    Active: <span className="text-indigo-650 font-extrabold">{currency}</span>
                  </div>
                </div>
                <p className="text-[10.5px] text-slate-450 leading-relaxed mt-1.5 text-left">
                  Changing this symbol instantly updates all dashboard metrics, registration screens, and billing details for all users.
                </p>
              </div>

              <div className="border-t border-slate-200/60 pt-3">
                <p className="text-[10.5px] text-slate-500 font-mono leading-relaxed text-left">
                  Active Subscription count: <strong className="text-slate-800 font-sans font-extrabold">{members.filter(m => m.status === 'Active').length}</strong>
                </p>
                <p className="text-[10.5px] text-slate-500 font-mono leading-relaxed text-left mt-1">
                  Average plan duration: <strong className="text-slate-800 font-sans font-extrabold">{plans.length > 0 ? (plans.reduce((acc, p) => acc + p.durationDays, 0) / plans.length).toFixed(0) : 0} days</strong>
                </p>
              </div>
            </div>

            <div className="lg:col-span-9 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {editedPlans.map((plan, index) => (
                  <div key={index} className="border border-slate-150 rounded-xl p-4 bg-white hover:shadow-xs transition-shadow relative text-left">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-dashed border-slate-100 text-left">
                      <div className="flex-1 mr-2 text-left">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Plan Name</label>
                        <input
                          type="text"
                          required
                          value={plan.name}
                          onChange={e => {
                            handleUpdateLocalPlan(index, 'name', e.target.value);
                            setConfigFeedback(null);
                          }}
                          className="w-full text-slate-900 font-extrabold text-xs uppercase tracking-tight px-2 py-0.5 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 font-sans"
                        />
                      </div>
                      <div className="flex items-center gap-1 shrink-0 self-end">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = editedPlans.filter((_, i) => i !== index);
                            setEditedPlans(updated);
                            setConfigFeedback({ success: true, message: 'Plan option removed from setup list. Click "Update Pricing Configurations" below to confirm changes globally.' });
                          }}
                          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                          title="Remove this membership level definition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="space-y-1 text-left">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase block">Price ({editedCurrency})</label>
                        <input
                          type="number"
                          required
                          min={0}
                          value={plan.price}
                          onChange={e => {
                            handleUpdateLocalPlan(index, 'price', parseFloat(e.target.value) || 0);
                            setConfigFeedback(null);
                          }}
                          className="w-full text-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-sans font-bold"
                        />
                      </div>

                      <div className="space-y-1 text-left">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase block">Duration (days)</label>
                        <input
                          type="number"
                          required
                          min={1}
                          value={plan.durationDays}
                          onChange={e => {
                            handleUpdateLocalPlan(index, 'durationDays', parseInt(e.target.value, 10) || 0);
                            setConfigFeedback(null);
                          }}
                          className="w-full text-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-sans font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-1 text-left">
                      <label className="text-[10px] font-semibold text-slate-500 uppercase block">Features list (comma-separated)</label>
                      <textarea
                        rows={2}
                        value={plan.features.join(', ')}
                        onChange={e => {
                          handleUpdateLocalPlanFeatures(index, e.target.value);
                          setConfigFeedback(null);
                        }}
                        placeholder="e.g. Unlimited monthly access, spinning classes"
                        className="w-full text-slate-950 px-2.5 py-1 text-xs rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-sans leading-relaxed resize-none"
                      />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    const uniqueIndex = editedPlans.length + 1;
                    setEditedPlans([
                      ...editedPlans,
                      {
                        name: `Level Option ${uniqueIndex}`,
                        price: 79,
                        durationDays: 30,
                        features: ['Full Gym Access', 'Strength Zone']
                      }
                    ]);
                    setConfigFeedback({ success: true, message: 'Added a new membership level template. Customize the name, fee, and options, then submit.' });
                  }}
                  className="sm:col-span-2 border-2 border-dashed border-slate-200 hover:border-slate-350 hover:bg-slate-50/50 p-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all duration-150 text-slate-500 hover:text-slate-800 text-xs font-sans font-extrabold"
                >
                  <Plus className="w-4 h-4 text-slate-600" />
                  Add Custom Membership Level Option
                </button>
              </div>
            </div>

          </div>

          <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex-1 w-full sm:w-auto text-left">
              {configFeedback && (
                <p className={`text-xs font-semibold px-3.5 py-2 rounded-xl text-left border inline-block ${
                  configFeedback.success ? 'text-emerald-700 bg-emerald-50 border-emerald-150' : 'text-rose-700 bg-rose-50 border-rose-150'
                }`}>
                  {configFeedback.message}
                </p>
              )}
            </div>
            
            <button
              type="submit"
              className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-sans font-extrabold text-xs py-2.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <TrendingUp className="w-4 h-4 text-sky-400 font-extrabold" />
              Update Pricing Configurations
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" id="dashboard-visuals">
        
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between" id="chart-panel">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-sans font-bold text-slate-900">7-Day Daily Check-In Volume</h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Daily member attendance trend across the last 7 operating days</p>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/70 select-none shrink-0 self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => setVolumeChartType('bar')}
                  className={`px-3 py-1.5 text-xs font-sans font-bold rounded-lg transition-all cursor-pointer ${
                    volumeChartType === 'bar' 
                      ? 'bg-white text-slate-900 shadow-xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  id="btn-volume-chart-bar"
                >
                  Bar Chart
                </button>
                <button
                  type="button"
                  onClick={() => setVolumeChartType('area')}
                  className={`px-3 py-1.5 text-xs font-sans font-bold rounded-lg transition-all cursor-pointer ${
                    volumeChartType === 'area' 
                      ? 'bg-white text-slate-900 shadow-xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  id="btn-volume-chart-area"
                >
                  Area Trend
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
              <div className="text-left">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">7-Day Total</span>
                <span className="text-lg font-black text-slate-900 font-mono">{total7DayVolume}</span>
                <span className="text-[10px] text-slate-500 block">check-ins recorded</span>
              </div>
              <div className="text-left border-x border-slate-200/80 px-3">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">Daily Average</span>
                <span className="text-lg font-black text-indigo-600 font-mono">{avg7DayVolume}</span>
                <span className="text-[10px] text-slate-500 block">visits / day</span>
              </div>
              <div className="text-left">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">Peak Day</span>
                <span className="text-lg font-black text-emerald-600 font-mono">{peakDay.count}</span>
                <span className="text-[10px] text-slate-500 block truncate">{peakDay.labelShort}</span>
              </div>
            </div>

            <div className="h-64 w-full relative min-w-0" id="recharts-7day-volume-container">
              <ResponsiveContainer width="100%" height="100%">
                {volumeChartType === 'bar' ? (
                  <BarChart
                    data={chartData}
                    margin={{ top: 15, right: 10, left: -20, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="barGradientRegular" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" stopOpacity={1} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id="barGradientToday" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                        <stop offset="100%" stopColor="#d97706" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="labelShort"
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      fontFamily="sans-serif"
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      fontFamily="sans-serif"
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-slate-800 text-white rounded-xl p-3 shadow-xl text-xs space-y-1 font-sans">
                              <p className="font-extrabold text-indigo-300 border-b border-slate-800 pb-1">
                                {data.labelShort}
                              </p>
                              <div className="flex items-center justify-between gap-4 pt-1">
                                <span className="text-slate-400">Total Check-ins:</span>
                                <strong className="text-white font-mono text-sm">{data.count}</strong>
                              </div>
                              <div className="flex items-center justify-between gap-4 text-[11px] text-slate-300">
                                <span>• Self QR Scans:</span>
                                <span className="font-mono text-emerald-400 font-bold">{data.qrCount}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4 text-[11px] text-slate-300">
                                <span>• Front Desk Entries:</span>
                                <span className="font-mono text-sky-400 font-bold">{data.deskCount}</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="count"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={42}
                    >
                      {chartData.map((_, index) => (
                        <Cell
                          key={`cell-vol-${index}`}
                          fill={index === 6 ? 'url(#barGradientToday)' : 'url(#barGradientRegular)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  <AreaChart
                    data={chartData}
                    margin={{ top: 15, right: 10, left: -20, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="labelShort"
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      fontFamily="sans-serif"
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      fontFamily="sans-serif"
                    />
                    <Tooltip
                      cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-slate-800 text-white rounded-xl p-3 shadow-xl text-xs space-y-1 font-sans">
                              <p className="font-extrabold text-indigo-300 border-b border-slate-800 pb-1">
                                {data.labelShort}
                              </p>
                              <div className="flex items-center justify-between gap-4 pt-1">
                                <span className="text-slate-400">Total Check-ins:</span>
                                <strong className="text-white font-mono text-sm">{data.count}</strong>
                              </div>
                              <div className="flex items-center justify-between gap-4 text-[11px] text-slate-300">
                                <span>• Self QR Scans:</span>
                                <span className="font-mono text-emerald-400 font-bold">{data.qrCount}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4 text-[11px] text-slate-300">
                                <span>• Front Desk Entries:</span>
                                <span className="font-mono text-sky-400 font-bold">{data.deskCount}</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#4f46e5"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#areaGradient)"
                      activeDot={{ r: 6, fill: '#4f46e5', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex flex-wrap justify-between items-center mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400 font-sans">
            <span className="font-medium">Operating Period: {chartData[0].full} – {chartData[6].full}</span>
            <span className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600 inline-block"></span> Standard Day
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block"></span> Active Today
              </span>
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between" id="activity-feed">
          <div>
            <div className="flex justify-between items-center mb-1">
              <h2 className="text-lg font-sans font-bold text-slate-900">Recent Entry Stream</h2>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Feed Active"></span>
            </div>
            <p className="text-xs text-slate-500 mb-5">Live logs from QR codes & front-desk gates</p>

            <div className="space-y-4" id="log-list">
              {checkIns.slice(0, 5).map((log) => {
                const logDate = new Date(log.timestamp);
                const dateStr = logDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                const timeStr = logDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                return (
                  <div 
                    key={log.id} 
                    className="flex text-slate-700 items-start justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg text-slate-600 mt-0.5">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-900">{log.memberName}</p>
                        <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                          <span>{log.memberId}</span>
                          <span>•</span>
                          <span>{log.planType}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right space-y-1 shrink-0">
                      <p className="text-[11px] font-bold text-slate-800 font-mono">{dateStr}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{timeStr}</p>
                      <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded font-bold font-mono tracking-wide ${
                        log.status === 'Granted' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {log.status === 'Granted' ? 'GRANTED' : 'DENIED'}
                      </span>
                    </div>
                  </div>
                );
              })}

              {checkIns.length === 0 && (
                <div className="text-center py-8 text-sm text-slate-400 space-y-2">
                  <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto" />
                  <p>No check-ins recorded today.</p>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6" id="dashboard-analytics-bento">
        
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between w-full min-w-0 overflow-hidden" id="demographics-panel">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart2 className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-sans font-bold text-slate-900">Member Demographics</h2>
            </div>
            <p className="text-xs text-slate-500 mb-6">Age brackets distribution calculated from enrolled member birthdates</p>
            
            <div className="h-64 w-full relative min-w-0 overflow-hidden" id="demographics-chart-host">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={ageDistributionData}
                  margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="range" 
                    stroke="#94a3b8" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    fontFamily="sans-serif"
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    fontFamily="sans-serif"
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }} 
                    contentStyle={{ 
                      background: '#1e293b', 
                      border: 'none', 
                      borderRadius: '8px', 
                      color: '#ffffff',
                      fontSize: '11px',
                      fontFamily: 'sans-serif',
                      padding: '8px 12px'
                    }}
                    labelStyle={{ fontWeight: 'bold', color: '#38bdf8' }}
                  />
                  <Bar 
                    dataKey="count" 
                    radius={[6, 6, 0, 0]}
                    maxBarSize={38}
                  >
                    {ageDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Calculated from {members.length} registered profiles</span>
            <span className="font-mono bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-bold">
              Avg Age: {(() => {
                const ages = members.map(getMemberAge).filter((a): a is number => a !== null);
                return ages.length ? Math.round(ages.reduce((acc, a) => acc + a, 0) / ages.length) : 0;
              })()} Yrs
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between w-full min-w-0 overflow-hidden" id="gender-panel">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-5 h-5 text-sky-600" />
              <h2 className="text-lg font-sans font-bold text-slate-900">Gender Dynamics</h2>
            </div>
            <p className="text-xs text-slate-500 mb-6 font-sans">Gender-wise distribution of members enrolled in the database</p>
            
            <div className="h-64 w-full relative min-w-0" id="gender-chart-host">
              {genderDistributionData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 gap-2">
                  <AlertTriangle className="w-8 h-8 text-slate-350" />
                  <p className="text-xs font-sans">No gender data registered yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                    <Pie
                      data={genderDistributionData}
                      cx="50%"
                      cy="43%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                      nameKey="name"
                    >
                      {genderDistributionData.map((entry, index) => (
                        <Cell key={`cell-gender-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: '#0f172a',
                        border: '1px solid #1e293b',
                        borderRadius: '12px',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontFamily: 'sans-serif',
                        padding: '8px 12px'
                      }}
                      formatter={(val: any, name: any) => [
                        `${val} members`,
                        `${name}`
                      ]}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={40} 
                      iconType="circle"
                      iconSize={8}
                      content={({ payload }) => {
                        const total = genderDistributionData.reduce((sum, item) => sum + item.value, 0);
                        return (
                          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2 text-[10.5px]">
                            {payload?.map((entry: any, index: number) => {
                              const genderData = genderDistributionData.find(d => d.name === entry.value);
                              const pct = total > 0 && genderData ? Math.round((genderData.value / total) * 100) : 0;
                              return (
                                <div key={`gender-legend-${index}`} className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
                                  <span className="text-slate-500 font-sans">{entry.value}</span>
                                  <span className="text-slate-900 font-bold font-mono">{pct}%</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-sans">
            <span>Primary Balance:</span>
            <span className="font-mono bg-sky-50 text-sky-700 px-2 py-0.5 rounded-md font-bold text-[10px] border border-sky-100/50 flex items-center gap-1.5">
              <span>M: {genderSummaryStats.male}</span> • <span>F: {genderSummaryStats.female}</span>
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between w-full min-w-0" id="peak-hours-panel">
          <div>
            <div className="flex justify-between items-center mb-1 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-sky-600 animate-pulse" />
                <h2 className="text-lg font-sans font-bold text-slate-900">Peak Entrance Traffic</h2>
              </div>
              
              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 select-none shrink-0">
                <button
                  type="button"
                  onClick={() => setHeatmapTab('heatmap')}
                  className={`px-2.5 py-1 text-[10px] font-sans font-bold rounded-md transition-all cursor-pointer ${
                    heatmapTab === 'heatmap' 
                      ? 'bg-white text-slate-900 shadow-xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Heatmap
                </button>
                <button
                  type="button"
                  onClick={() => setHeatmapTab('chart')}
                  className={`px-2.5 py-1 text-[10px] font-sans font-bold rounded-md transition-all cursor-pointer ${
                    heatmapTab === 'chart' 
                      ? 'bg-white text-slate-900 shadow-xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Hourly
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-6 font-sans">Aggregate member check-in frequencies distributed by operating hours</p>
            
            {heatmapTab === 'heatmap' ? (
              <div className="flex flex-col gap-1.5 w-full select-none" id="traffic-hours-heatmap">
                <div className="flex items-center w-full animate-fade-in">
                  <div className="w-7 shrink-0" />
                  <div className="flex gap-1 w-full text-center">
                    {[6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].map((h, i) => (
                      <span key={i} className="text-[8px] text-slate-400 font-mono font-bold block truncate flex-1 leading-none">
                        {h % 3 === 0 ? hourFormat(h).replace(' ', '') : ''}
                      </span>
                    ))}
                  </div>
                </div>

                {heatmapGrid.map((row) => {
                  const rowDayName = row[0].dayName;
                  return (
                    <div key={rowDayName} className="flex items-center w-full group/row animate-fade-in">
                      <span className="text-[10px] font-mono text-slate-500 font-semibold w-7 shrink-0 text-left leading-none">
                        {rowDayName}
                      </span>

                      <div className="flex gap-1 w-full">
                        {row.map((cell, cIdx) => {
                          let cellBg = 'bg-slate-50 border-slate-150 hover:border-slate-350';
                          if (cell.count > 7) {
                            cellBg = 'bg-sky-700 border-sky-750 text-white';
                          } else if (cell.count > 4) {
                            cellBg = 'bg-sky-500 border-sky-550 text-white';
                          } else if (cell.count > 2) {
                            cellBg = 'bg-sky-200 border-sky-250 text-sky-950';
                          } else if (cell.count > 0) {
                            cellBg = 'bg-sky-50 border-sky-100 text-sky-800';
                          }

                          return (
                            <div
                              key={cIdx}
                              onMouseEnter={() => setHoveredCell({
                                dayName: cell.dayName,
                                hourLabel: cell.hourLabel,
                                count: cell.count
                              })}
                              onMouseLeave={() => setHoveredCell(null)}
                              className={`flex-1 aspect-square rounded-[3px] border transition-all cursor-pointer ${cellBg}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-64 w-full relative min-w-0 overflow-hidden animate-fade-in" id="traffic-hours-chart-host">
                 <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={peakHoursData}
                    margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="label" 
                      stroke="#94a3b8" 
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      interval={1}
                      fontFamily="sans-serif"
                    />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      fontFamily="sans-serif"
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(241, 245, 249, 0.4)' }}
                      contentStyle={{ 
                        background: '#0f172a', 
                        border: '1px solid #1e293b', 
                        borderRadius: '12px', 
                        color: '#ffffff',
                        fontSize: '11px',
                        fontFamily: 'sans-serif',
                        padding: '8px 12px'
                      }}
                      labelStyle={{ fontWeight: 'bold', color: '#0ea5e9' }}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="#38bdf8"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={18}
                    >
                      {peakHoursData.map((entry, index) => {
                        const isZero = entry.count === 0;
                        return (
                          <Cell 
                            key={`cell-hr-${index}`} 
                            fill={isZero ? '#f1f5f9' : entry.count === Math.max(...peakHoursData.map(d=>d.count)) ? '#0284c7' : '#0ea5e9'} 
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2 min-h-[50px] justify-center text-left">
            {hoveredCell ? (
              <div className="flex items-center gap-2 text-slate-800 text-[11px] font-sans antialiased text-left">
                <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping shrink-0" />
                <span className="leading-none text-left">
                  <strong>{hoveredCell.dayName} at {hoveredCell.hourLabel}</strong>: <strong className="text-indigo-650">{hoveredCell.count} recorded check-ins</strong>
                  {hoveredCell.count > 6 ? (
                    <span className="text-rose-500 font-bold"> (High Crowd / Peak hours)</span>
                  ) : hoveredCell.count > 3 ? (
                    <span className="text-amber-600 font-bold"> (Moderate / Average)</span>
                  ) : hoveredCell.count > 0 ? (
                    <span className="text-emerald-500 font-bold"> (Light Traffic / Optimal workout)</span>
                  ) : (
                    <span className="text-slate-400"> (No check-ins logged)</span>
                  )}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-700 text-[11px] font-sans font-bold text-left">
                <span className="text-sky-500 animate-pulse font-extrabold text-sm font-sans shrink-0">🔥 Peak Analysis:</span>
                <span className="text-slate-650 tracking-tight leading-none text-left">{peakHourSummaryText}</span>
              </div>
            )}
            
            {heatmapTab === 'heatmap' && (
              <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono select-none mt-1 leading-none">
                <span>Hover blocks to inspect density</span>
                <div className="flex items-center gap-1 shrink-0">
                  <span>Less</span>
                  <span className="w-2.5 h-2.5 rounded bg-slate-50 border border-slate-150 inline-block" />
                  <span className="w-2.5 h-2.5 rounded bg-sky-50 border border-sky-100 inline-block" />
                  <span className="w-2.5 h-2.5 rounded bg-sky-200 border border-sky-250 inline-block" />
                  <span className="w-2.5 h-2.5 rounded bg-sky-500 border border-sky-550 inline-block" />
                  <span className="w-2.5 h-2.5 rounded bg-sky-700 border border-sky-750 inline-block" />
                  <span>More</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between w-full min-w-0 overflow-hidden" id="revenue-share-panel">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-5 h-5 text-indigo-600 font-bold" />
              <h2 className="text-lg font-sans font-bold text-slate-900">Plan Revenue Share</h2>
            </div>
            <p className="text-xs text-slate-500 mb-6 font-sans">Monthly Revenue Run-rate (MRR) distribution by active memberships</p>
            
            <div className="h-64 w-full relative min-w-0" id="revenue-chart-host">
              {estimatedRevenue === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 gap-2">
                  <AlertTriangle className="w-8 h-8 text-slate-350" />
                  <p className="text-xs font-sans">No active subscribers to generate revenue stats</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                    <Pie
                      data={planRevenueData}
                      cx="50%"
                      cy="43%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                      nameKey="name"
                    >
                      {planRevenueData.map((_, index) => (
                        <Cell key={`cell-rev-${index}`} fill={PLAN_COLORS_PALETTE[index % PLAN_COLORS_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: '#0f172a',
                        border: '1px solid #1e293b',
                        borderRadius: '12px',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontFamily: 'sans-serif',
                        padding: '8px 12px'
                      }}
                      formatter={(val: any, name: any, props: any) => [
                        `${currency}${val.toLocaleString()} (${props.payload.memberCount} active)`,
                        `${name}`
                      ]}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={40} 
                      iconType="circle"
                      iconSize={8}
                      content={({ payload }) => {
                        return (
                          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2 text-[10.5px]">
                            {payload?.map((entry: any, index: number) => {
                              const planData = planRevenueData.find(d => d.name === entry.value);
                              const revenuePct = estimatedRevenue > 0 && planData ? Math.round((planData.value / estimatedRevenue) * 100) : 0;
                              return (
                                <div key={`legend-item-${index}`} className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
                                  <span className="text-slate-500 font-sans">{entry.value}</span>
                                  <span className="text-slate-900 font-bold font-mono">{revenuePct}%</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-sans">
            <span>Projected Monthly Income:</span>
            <span className="font-mono bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md font-bold text-xs border border-indigo-100 flex items-center gap-1 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              {currency}{estimatedRevenue.toLocaleString()} / mo
            </span>
          </div>
        </div>

      </div>
      </div>
      )}

      {activeDashboardTab === 'birthdays' && (
        <div className="space-y-6 animate-fade-in" id="upcoming-birthdays-view">
          
          <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-indigo-500/10 border border-amber-200 dark:border-amber-900/40 rounded-3xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-gradient-to-tr from-amber-500 to-rose-500 text-white rounded-2xl shadow-md">
                    <Cake className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-xl font-sans font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      Upcoming Member Birthdays
                      <span className="text-xs font-mono font-extrabold bg-rose-500 text-white px-2.5 py-0.5 rounded-full shadow-xs">
                        Next 7 Days
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Send personalized birthday greetings, offer complimentary gym perks, and foster long-term member loyalty!
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-white/80 dark:bg-slate-900/80 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs text-center shrink-0">
                <div className="px-3 py-1">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">7-Day Total</span>
                  <span className="text-xl font-black text-slate-900 dark:text-slate-100 font-mono">{birthdayMembersList.length}</span>
                  <span className="text-[10px] text-slate-500 block">celebrants</span>
                </div>
                <div className="px-3 py-1 border-x border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">Today</span>
                  <span className="text-xl font-black text-rose-600 font-mono">
                    {birthdayMembersList.filter(b => b.isToday).length}
                  </span>
                  <span className="text-[10px] text-slate-500 block">today!</span>
                </div>
                <div className="px-3 py-1">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">Wished</span>
                  <span className="text-xl font-black text-emerald-600 font-mono">
                    {birthdayMembersList.filter(b => b.member.birthdayGreetingSentDate === TODAY_STR).length}
                  </span>
                  <span className="text-[10px] text-slate-500 block">sent today</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-amber-200/60 dark:border-amber-900/30 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search birthday celebrant by name, phone, or plan..."
                  value={birthdaySearchQuery}
                  onChange={(e) => setBirthdaySearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs font-sans rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  id="input-search-birthdays"
                />
                {birthdaySearchQuery && (
                  <button
                    onClick={() => setBirthdaySearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="flex bg-white/80 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800 shrink-0">
                <button
                  onClick={() => setBirthdayFilter('all')}
                  className={`px-3 py-1.5 text-xs font-sans font-bold rounded-lg transition-all cursor-pointer ${
                    birthdayFilter === 'all'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                  id="filter-birthday-all"
                >
                  All ({birthdayMembersList.length})
                </button>
                <button
                  onClick={() => setBirthdayFilter('today')}
                  className={`px-3 py-1.5 text-xs font-sans font-bold rounded-lg transition-all cursor-pointer ${
                    birthdayFilter === 'today'
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-[#111]'
                  }`}
                  id="filter-birthday-today"
                >
                  Today ({birthdayMembersList.filter(b => b.isToday).length})
                </button>
                <button
                  onClick={() => setBirthdayFilter('upcoming')}
                  className={`px-3 py-1.5 text-xs font-sans font-bold rounded-lg transition-all cursor-pointer ${
                    birthdayFilter === 'upcoming'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                  id="filter-birthday-upcoming"
                >
                  Upcoming ({birthdayMembersList.filter(b => !b.isToday).length})
                </button>
              </div>
            </div>
          </div>

          {filteredBirthdayMembers.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
              <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/40 text-amber-500 rounded-2xl flex items-center justify-center mx-auto">
                <PartyPopper className="w-6 h-6" />
              </div>
              <h3 className="font-sans font-extrabold text-base text-slate-900 dark:text-slate-100">
                No Birthdays Found
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {birthdaySearchQuery 
                  ? `No members matching "${birthdaySearchQuery}" have birthdays in the next 7 days.` 
                  : 'No active members have recorded birthdays falling within the next 7 days.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="birthday-celebrants-grid">
              {filteredBirthdayMembers.map((item) => {
                const { member, daysLeft, turningAge, birthdayDateStr, isToday, formattedDob } = item;
                const isWished = member.birthdayGreetingSentDate === TODAY_STR;

                return (
                  <div
                    key={`bday-card-${member.id}`}
                    className={`bg-white dark:bg-slate-900 border rounded-3xl p-6 shadow-sm transition-all duration-200 flex flex-col justify-between relative overflow-hidden ${
                      isToday
                        ? 'border-amber-400 dark:border-amber-500/80 ring-2 ring-amber-400/20 shadow-amber-500/5'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                    id={`birthday-card-${member.id}`}
                  >
                    <div className={`-mx-6 -mt-6 px-6 py-3 mb-5 border-b flex items-center justify-between ${
                      isToday 
                        ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-amber-600 text-white border-amber-500'
                        : 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-slate-100 dark:border-slate-800'
                    }`}>
                      <div className="flex items-center gap-2">
                        {isToday ? (
                          <span className="flex items-center gap-1.5 font-sans font-black text-xs uppercase tracking-wider animate-pulse">
                            <Sparkles className="w-4 h-4" /> 🎉 TODAY IS THEIR BIRTHDAY!
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 font-sans font-bold text-xs">
                            <Calendar className="w-4 h-4 text-indigo-500" />
                            In {daysLeft} {daysLeft === 1 ? 'day' : 'days'} • {birthdayDateStr}
                          </span>
                        )}
                      </div>

                      <span className={`text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full ${
                        isToday 
                          ? 'bg-white/20 text-white backdrop-blur-xs' 
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}>
                        Turning {turningAge}
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg text-white shadow-sm shrink-0 ${
                            isToday 
                              ? 'bg-gradient-to-br from-amber-500 to-rose-500' 
                              : 'bg-gradient-to-br from-indigo-600 to-sky-600'
                          }`}>
                            {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <h3 className="font-sans font-black text-base text-slate-900 dark:text-slate-100 leading-tight">
                              {member.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
                                ID: {member.id}
                              </span>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              <span className="text-[10px] font-sans font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900">
                                {member.plan}
                              </span>
                            </div>
                          </div>
                        </div>

                        {isWished ? (
                          <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0">
                            <Check className="w-3 h-3" /> Wished Today
                          </span>
                        ) : (
                          <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 animate-pulse">
                            <Clock className="w-3 h-3" /> Pending Wish
                          </span>
                        )}
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3 border border-slate-150 dark:border-slate-800 text-xs space-y-1.5 font-sans">
                        <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <Phone className="w-3.5 h-3.5" /> Phone:
                          </span>
                          <strong className="font-mono text-slate-900 dark:text-slate-100">{member.phone}</strong>
                        </div>
                        <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <Mail className="w-3.5 h-3.5" /> Email:
                          </span>
                          <strong className="text-slate-900 dark:text-slate-100 truncate max-w-[180px]">{member.email}</strong>
                        </div>
                        <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <Cake className="w-3.5 h-3.5 text-amber-500" /> Recorded DOB:
                          </span>
                          <div className="flex items-center gap-2">
                            <strong className="font-mono text-slate-900 dark:text-slate-100">{formattedDob}</strong>
                            <button
                              onClick={() => {
                                setEditDobMember(member);
                                setEditDobValue(formattedDob);
                              }}
                              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                              title="Edit DOB"
                            >
                              <Edit3 className="w-3 h-3" /> Edit
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <button
                        onClick={() => handleOpenGreetingModal(item)}
                        className={`flex-1 py-2.5 px-4 rounded-xl font-sans font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer ${
                          isToday
                            ? 'bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white shadow-md'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                        id={`btn-send-greeting-${member.id}`}
                      >
                        <Gift className="w-4 h-4" />
                        <span>Send Birthday Greeting</span>
                      </button>

                      <button
                        onClick={() => {
                          window.open(whatsappUrl(member.phone, `Happy Birthday ${member.name}! 🎉 Best wishes from ${brand.name}! 🏋️‍♂️`, brand.countryCode), '_blank');
                          if (onUpdateMember) {
                            onUpdateMember(member.id, { birthdayGreetingSentDate: TODAY_STR });
                          }
                        }}
                        className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl transition-colors cursor-pointer"
                        title="WhatsApp Quick Wish"
                        id={`btn-wa-quick-${member.id}`}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showReportModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 antialiased sm:p-6 select-none print:p-0 print:bg-white" id="report-modal-overlay">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col w-full max-w-4xl max-h-[90vh] overflow-hidden print:max-h-none print:border-none print:shadow-none print:rounded-none">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 print:hidden shrink-0">
              <div className="flex items-center gap-2.5 text-slate-800">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="font-sans font-extrabold text-sm tracking-tight text-slate-900 uppercase">
                  Executive Operations Report (A4 Portrait)
                </h3>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsReportEditMode(!isReportEditMode)}
                  className={`font-sans font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border ${
                    isReportEditMode
                      ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-250'
                  }`}
                  id="btn-toggle-edit-report"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {isReportEditMode ? 'Done Editing' : 'Edit Report Fields'}
                </button>
                <button
                  type="button"
                  onClick={() => printElement(document.getElementById('gym-report-sheet')!, `${brand.name} Report`)}
                  className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-sans font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Print Report
                </button>
                <button
                  type="button"
                  onClick={() => downloadPdf(document.getElementById('gym-report-sheet')!, `${slug}_Report_${TODAY_STR}.pdf`)}
                  className="bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-sans font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-700 font-sans font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto bg-slate-100/50 print:p-0 print:bg-white flex-1 flex flex-col items-center">
              
              {isReportEditMode && (
                <div className="w-full max-w-[210mm] bg-amber-50/90 border border-amber-200 rounded-2xl p-4 mb-4 shadow-sm text-left print:hidden space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                    <div className="flex items-center gap-2 text-amber-900 font-sans font-bold text-xs uppercase tracking-wider">
                      <Edit3 className="w-4 h-4 text-amber-600" />
                      <span>Report Content Customizer</span>
                    </div>
                    <span className="text-[10px] text-amber-700 font-mono font-medium">Edits update report preview live</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-amber-900 block">Gym / Studio Name</label>
                      <input
                        type="text"
                        value={reportGymName}
                        onChange={e => setReportGymName(e.target.value)}
                        className="w-full bg-white text-slate-900 text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-amber-900 block">Address</label>
                      <input
                        type="text"
                        value={reportAddress}
                        onChange={e => setReportAddress(e.target.value)}
                        className="w-full bg-white text-slate-900 text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-amber-900 block">Phone</label>
                      <input
                        type="text"
                        value={reportPhone}
                        onChange={e => setReportPhone(e.target.value)}
                        className="w-full bg-white text-slate-900 text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-amber-900 block">Email</label>
                      <input
                        type="text"
                        value={reportEmail}
                        onChange={e => setReportEmail(e.target.value)}
                        className="w-full bg-white text-slate-900 text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-amber-900 block">GSTIN / Tax ID</label>
                      <input
                        type="text"
                        value={reportGstin}
                        onChange={e => setReportGstin(e.target.value)}
                        className="w-full bg-white text-slate-900 text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-amber-900 block">Website</label>
                      <input
                        type="text"
                        value={reportWebsite}
                        onChange={e => setReportWebsite(e.target.value)}
                        className="w-full bg-white text-slate-900 text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-amber-900 block">Report Badge Subtitle</label>
                      <input
                        type="text"
                        value={reportBadge}
                        onChange={e => setReportBadge(e.target.value)}
                        className="w-full bg-white text-slate-900 text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-amber-900 block">Scorecard Main Title</label>
                      <input
                        type="text"
                        value={reportTitle}
                        onChange={e => setReportTitle(e.target.value)}
                        className="w-full bg-white text-slate-900 text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-amber-900 block">Scorecard Description</label>
                      <input
                        type="text"
                        value={reportDescription}
                        onChange={e => setReportDescription(e.target.value)}
                        className="w-full bg-white text-slate-900 text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-3">
                      <label className="text-[10px] font-bold text-amber-900 block">Peak Traffic Operational Remarks</label>
                      <input
                        type="text"
                        value={reportPeakRemarks}
                        onChange={e => setReportPeakRemarks(e.target.value)}
                        className="w-full bg-white text-slate-900 text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-amber-900 block">Signature Label 1 (Left)</label>
                      <input
                        type="text"
                        value={reportSig1}
                        onChange={e => setReportSig1(e.target.value)}
                        className="w-full bg-white text-slate-900 text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[10px] font-bold text-amber-900 block">Signature Label 2 (Right)</label>
                      <input
                        type="text"
                        value={reportSig2}
                        onChange={e => setReportSig2(e.target.value)}
                        className="w-full bg-white text-slate-900 text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white border border-slate-200 p-6 font-sans text-left relative overflow-hidden select-none w-full max-w-[210mm] shrink-0 shadow-xs print:shadow-none print:border-none print:p-0" id="gym-report-sheet">
                

                <div className="flex flex-row justify-between items-start border-b border-slate-200 pb-4 mb-4">
                  <div className="flex items-start gap-3">
                    <BrandLogo size={52} className="shrink-0" />
                    <div>
                      {isReportEditMode ? (
                        <input
                          type="text"
                          value={reportGymName}
                          onChange={e => setReportGymName(e.target.value)}
                          className="text-xl font-black text-slate-900 leading-tight uppercase tracking-tight border-b border-dashed border-amber-400 bg-amber-50/50 px-1 py-0.5 rounded focus:outline-none w-full"
                        />
                      ) : (
                        <h1 className="text-xl font-black text-slate-900 leading-tight uppercase tracking-tight">
                          {reportGymName}
                        </h1>
                      )}
                      
                      <div className="text-slate-500 mt-1 space-y-0.5 text-[11px] leading-snug">
                        {isReportEditMode ? (
                          <div className="space-y-1 pt-1">
                            <input
                              type="text"
                              value={reportAddress}
                              onChange={e => setReportAddress(e.target.value)}
                              className="w-full text-[11px] border-b border-dashed border-amber-300 bg-amber-50/30 px-1 py-0.5 focus:outline-none"
                            />
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={reportPhone}
                                onChange={e => setReportPhone(e.target.value)}
                                className="w-1/2 text-[11px] border-b border-dashed border-amber-300 bg-amber-50/30 px-1 py-0.5 focus:outline-none"
                              />
                              <input
                                type="text"
                                value={reportEmail}
                                onChange={e => setReportEmail(e.target.value)}
                                className="w-1/2 text-[11px] border-b border-dashed border-amber-300 bg-amber-50/30 px-1 py-0.5 focus:outline-none"
                              />
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={reportGstin}
                                onChange={e => setReportGstin(e.target.value)}
                                className="w-1/2 text-[11px] border-b border-dashed border-amber-300 bg-amber-50/30 px-1 py-0.5 focus:outline-none"
                              />
                              <input
                                type="text"
                                value={reportWebsite}
                                onChange={e => setReportWebsite(e.target.value)}
                                className="w-1/2 text-[11px] border-b border-dashed border-amber-300 bg-amber-50/30 px-1 py-0.5 focus:outline-none"
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            <p>{reportAddress}</p>
                            <p>Phone: {reportPhone} | Email: {reportEmail}</p>
                            <p>GSTIN: {reportGstin} | Website: {reportWebsite}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {isReportEditMode ? (
                      <input
                        type="text"
                        value={reportBadge}
                        onChange={e => setReportBadge(e.target.value)}
                        className="bg-indigo-50 text-indigo-700 text-[10px] font-sans font-bold px-2 py-0.5 rounded border border-indigo-200 uppercase tracking-widest text-right focus:outline-none"
                      />
                    ) : (
                      <span className="bg-indigo-50 text-indigo-700 text-[10px] font-sans font-bold px-2.5 py-0.5 rounded-full border border-indigo-150 uppercase tracking-widest inline-block select-none">
                        {reportBadge}
                      </span>
                    )}
                    <div className="text-slate-500 mt-2 space-y-0.5 font-mono text-[10.5px]">
                      <p>Date: <strong className="text-slate-800">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></p>
                      <p>Time: <strong className="text-slate-800">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</strong></p>
                      <p>Engine Ver: <strong className="text-slate-800">2026.7.18</strong></p>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  {isReportEditMode ? (
                    <div className="space-y-1">
                      <input
                        type="text"
                        value={reportTitle}
                        onChange={e => setReportTitle(e.target.value)}
                        className="text-sm font-bold text-slate-800 uppercase tracking-wide w-full border-b border-dashed border-amber-400 bg-amber-50/40 px-1 py-0.5 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={reportDescription}
                        onChange={e => setReportDescription(e.target.value)}
                        className="text-[11px] text-slate-500 w-full border-b border-dashed border-amber-300 bg-amber-50/30 px-1 py-0.5 focus:outline-none"
                      />
                    </div>
                  ) : (
                    <>
                      <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                        {reportTitle}
                      </h2>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {reportDescription}
                      </p>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  
                  <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50/50">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Total Members</span>
                    <strong className="text-xl text-slate-900 font-extrabold tracking-tight">{totalMembers}</strong>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Profiles in system</span>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50/50">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Active Members</span>
                    <strong className="text-xl text-emerald-600 font-extrabold tracking-tight">{activeMembersCount}</strong>
                    <span className="text-[10px] text-slate-500 block mt-0.5">{activeRate}% Active rate</span>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50/50">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Today's Check-ins</span>
                    <strong className="text-xl text-indigo-600 font-extrabold tracking-tight">{todayCheckIns.length}</strong>
                    <span className="text-[10px] text-slate-500 block mt-0.5">{Math.round((todayCheckIns.length / dailyCheckInGoal) * 100)}% of goal</span>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50/50">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Total Logs</span>
                    <strong className="text-xl text-slate-900 font-extrabold tracking-tight">{displayCheckIns.length}</strong>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Historical logs database</span>
                  </div>

                </div>

                <div className="space-y-4">
                  
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-700 uppercase tracking-wider text-[10.5px]">
                        1. MEMBERSHIP PLAN DISTRIBUTION &amp; FINANCIAL ESTIMATES
                      </h3>
                    </div>
                    <table className="w-full text-left font-sans" style={{ fontSize: '10.5px' }}>
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/30 text-slate-500 uppercase tracking-wider font-extrabold text-[8.5px]">
                          <th className="px-3 py-2">Membership Plan Name</th>
                          <th className="px-3 py-2 text-center">Active Count</th>
                          <th className="px-3 py-2 text-right">Standard Rate</th>
                          <th className="px-3 py-2 text-right">Projected Monthly Contribution</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {planRevenueData.map((item, idx) => {
                          const planObj = plans.find(p => p.name === item.name);
                          const rateStr = planObj ? `${currency}${planObj.price} / ${planObj.durationDays}d` : 'N/A';
                          return (
                            <tr key={`report-plan-${idx}`} className="hover:bg-slate-50/30">
                              <td className="px-3 py-2 font-bold text-slate-900">{item.name}</td>
                              <td className="px-3 py-2 text-center font-mono">{item.memberCount}</td>
                              <td className="px-3 py-2 text-right font-mono">{rateStr}</td>
                              <td className="px-3 py-2 text-right font-black text-slate-900 font-mono">{currency}{item.value.toLocaleString()}</td>
                            </tr>
                          );
                        })}
                        <tr className="bg-slate-50/50 font-bold text-slate-900 border-t border-slate-200">
                          <td className="px-3 py-2 uppercase text-[9.5px]">Grand Total Revenue Estimations:</td>
                          <td className="px-3 py-2 text-center font-mono">{activeMembersCount} Active</td>
                          <td className="px-3 py-2 text-right text-slate-400">—</td>
                          <td className="px-3 py-2 text-right font-black font-mono text-indigo-700">{currency}{estimatedRevenue.toLocaleString()} / mo</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200">
                        <h3 className="font-bold text-slate-700 uppercase tracking-wider text-[10.5px]">
                          2. MEMBERSHIP STATUS OVERVIEW
                        </h3>
                      </div>
                      <div className="p-3 space-y-1.5 text-[10.5px] text-slate-600">
                        <div className="flex justify-between border-b border-slate-100 pb-1">
                          <span className="flex items-center gap-1.5 font-medium"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Active (On Plan)</span>
                          <strong className="text-slate-900 font-mono">{activeMembersCount} profiles</strong>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-1">
                          <span className="flex items-center gap-1.5 font-medium"><span className="w-2 h-2 rounded-full bg-amber-500" /> Paused (Suspended)</span>
                          <strong className="text-slate-900 font-mono">{pausedMembersCount} profiles</strong>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-1">
                          <span className="flex items-center gap-1.5 font-medium"><span className="w-2 h-2 rounded-full bg-rose-500" /> Expired (Grace period)</span>
                          <strong className="text-slate-900 font-mono">{expiredMembersCount} profiles</strong>
                        </div>
                        <div className="flex justify-between font-bold text-slate-900 pt-0.5">
                          <span className="uppercase text-[8.5px]">Total Registered System Base:</span>
                          <span className="font-mono">{totalMembers} Members</span>
                        </div>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between">
                      <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200">
                        <h3 className="font-bold text-slate-700 uppercase tracking-wider text-[10.5px]">
                          3. TRAFFIC PEAKS &amp; OPERATIONS
                        </h3>
                      </div>
                      <div className="p-3 space-y-1 text-[10.5px] text-slate-600 flex-grow flex flex-col justify-center">
                        <p className="leading-snug">
                          Entry log scans are recorded securely. Peak workload:
                        </p>
                        <div className="p-2 bg-slate-50 border border-slate-150 rounded-lg text-slate-800 font-medium font-mono text-[10px] mt-1">
                          <span className="text-indigo-700 font-bold block uppercase text-[8.5px] mb-0.5">Peak Traffic Window:</span>
                          {peakHourSummaryText}
                        </div>
                        {isReportEditMode ? (
                          <input
                            type="text"
                            value={reportPeakRemarks}
                            onChange={e => setReportPeakRemarks(e.target.value)}
                            className="text-[9.5px] text-slate-600 mt-1 italic leading-snug w-full border-b border-dashed border-amber-400 bg-amber-50/40 px-1 py-0.5 focus:outline-none"
                          />
                        ) : (
                          <p className="text-[9.5px] text-slate-400 mt-1 italic leading-snug">
                            {reportPeakRemarks}
                          </p>
                        )}
                      </div>
                    </div>

                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-700 uppercase tracking-wider text-[10.5px]">
                        4. PROFILE DEMOGRAPHICS BREAKDOWN
                      </h3>
                    </div>
                    <div className="p-3 grid grid-cols-2 gap-4 text-[10.5px] text-slate-600">
                      <div>
                        <span className="font-extrabold text-[8.5px] text-slate-400 block uppercase tracking-wide mb-1">Gender Distribution</span>
                        <div className="space-y-0.5">
                          {genderDistributionData.map((g, idx) => (
                            <div key={`rep-gender-${idx}`} className="flex justify-between items-center">
                              <span>{g.name}:</span>
                              <strong className="text-slate-900 font-mono">{g.value} ({Math.round(g.value / (totalMembers || 1) * 100)}%)</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="font-extrabold text-[8.5px] text-slate-400 block uppercase tracking-wide mb-1">Age Demographics</span>
                        <div className="space-y-0.5">
                          {ageDistributionData.map((ageGroup, idx) => (
                            <div key={`rep-age-${idx}`} className="flex justify-between items-center">
                              <span>{ageGroup.range}:</span>
                              <strong className="text-slate-900 font-mono">{ageGroup.count} members</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                <div className="border-t border-slate-200 mt-5 pt-4">
                  <div className="grid grid-cols-2 gap-8 text-center text-[10.5px]">
                    <div className="flex flex-col items-center">
                      <div className="w-full max-w-[160px] h-6 border-b border-dashed border-slate-300"></div>
                      {isReportEditMode ? (
                        <input
                          type="text"
                          value={reportSig1}
                          onChange={e => setReportSig1(e.target.value)}
                          className="text-[8.5px] font-extrabold text-slate-500 uppercase tracking-wider mt-1 text-center border-b border-dashed border-amber-400 bg-amber-50/40 px-1 focus:outline-none w-full max-w-[180px]"
                        />
                      ) : (
                        <span className="text-slate-400 uppercase font-extrabold text-[8.5px] tracking-wider mt-1 block">{reportSig1}</span>
                      )}
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-full max-w-[160px] h-6 border-b border-dashed border-slate-300"></div>
                      {isReportEditMode ? (
                        <input
                          type="text"
                          value={reportSig2}
                          onChange={e => setReportSig2(e.target.value)}
                          className="text-[8.5px] font-extrabold text-slate-500 uppercase tracking-wider mt-1 text-center border-b border-dashed border-amber-400 bg-amber-50/40 px-1 focus:outline-none w-full max-w-[180px]"
                        />
                      ) : (
                        <span className="text-slate-400 uppercase font-extrabold text-[8.5px] tracking-wider mt-1 block">{reportSig2}</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-5 text-center text-slate-400 text-[8.5px] font-mono tracking-widest uppercase">
                    GEN-ID: REPORT-S1-{new Date().toISOString().replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)} • SECURED BY {reportGymName.toUpperCase()}
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

      {greetingModalData && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in" id="modal-birthday-greeting">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative text-left space-y-5">
            
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-tr from-amber-500 to-rose-500 text-white rounded-2xl shadow-sm">
                  <Cake className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h3 className="font-sans font-black text-lg text-slate-900 dark:text-slate-100">
                    Send Birthday Greeting
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Personalized wish for <strong className="text-slate-900 dark:text-slate-100">{greetingModalData.member.name}</strong> (Turning {greetingModalData.turningAge})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setGreetingModalData(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-3 flex items-center justify-between text-xs">
              <div>
                <span className="font-extrabold text-amber-900 dark:text-amber-200 block">
                  {greetingModalData.member.name} • {greetingModalData.member.phone}
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Plan: {greetingModalData.member.plan} • Email: {greetingModalData.member.email}
                </span>
              </div>
              <span className="bg-amber-500 text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded-full shrink-0">
                {greetingModalData.isToday ? '🎉 Today!' : `In ${greetingModalData.daysLeft} days`}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Dispatch Channel:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setGreetingChannel('whatsapp')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    greetingChannel === 'whatsapp'
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" /> WhatsApp
                </button>

                <button
                  type="button"
                  onClick={() => setGreetingChannel('email')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    greetingChannel === 'email'
                      ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Mail className="w-4 h-4" /> Email
                </button>

                <button
                  type="button"
                  onClick={() => setGreetingChannel('sms')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    greetingChannel === 'sms'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Copy className="w-4 h-4" /> Copy Text
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Customize Wish Message:
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setCustomGreetingMessage(birthdayMessage(greetingModalData));
                  }}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Reset Template
                </button>
              </div>

              <textarea
                rows={4}
                value={customGreetingMessage}
                onChange={(e) => setCustomGreetingMessage(e.target.value)}
                className="w-full p-3 text-xs font-sans rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed"
                placeholder="Write your birthday wish message..."
              />
            </div>


            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setGreetingModalData(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDispatchGreeting}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-amber-600 text-white font-bold text-xs hover:opacity-95 transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{`Send via ${{ whatsapp: 'WhatsApp', email: 'Email', sms: 'SMS' }[greetingChannel]}`}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {editDobMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in" id="modal-edit-dob">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative text-left space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-sans font-black text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Cake className="w-4 h-4 text-amber-500" /> Edit Member Birthday
              </h3>
              <button
                onClick={() => setEditDobMember(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Set Date of Birth for <strong className="text-slate-900 dark:text-slate-100">{editDobMember.name}</strong>:
              </p>
              <input
                type="date"
                value={editDobValue}
                onChange={(e) => setEditDobValue(e.target.value)}
                className="w-full p-2.5 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setEditDobMember(null)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDob}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
              >
                Save DOB
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
