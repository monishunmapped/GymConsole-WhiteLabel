import React, { useState } from 'react';
import { Member, MembershipPlanName, MembershipPlan, AdvancePaymentRecord } from '../types';

import { generateQrSvg } from '../utils/qrGenerator';
import { calculateDaysRemaining, calculateExpiryDate, formatDateDDMMYYYY, formatDateISO, parseDate, todayISO } from '../utils/dateUtils';
import { downloadCsv, fileToDataUrl, parseDobCode, whatsappUrl } from '../utils/common';
import { membersDb } from '../lib/firebase';
import { useBrand } from '../lib/brand';
import { sendEmail, sendSms } from '../lib/messaging';
import { printElement, downloadPdf, pdfBase64 } from '../utils/print';
import { 
  Plus, 
  Search, 
  Filter, 
  Mail, 
  Phone, 
  Calendar, 
  FileText, 
  Trash2, 
  RotateCcw, 
  Pause, 
  Play, 
  QrCode,
  X,
  Clock,
  Printer,
  Camera,
  Upload,
  RefreshCw,
  Download,
  Trophy,
  Award,
  Image,
  CheckCircle2,
  PauseCircle,
  AlertCircle,
  Wallet,
  History,
  HandCoins
} from 'lucide-react';

interface MembersListProps {
  members: Member[];
  onAddMember: (member: Omit<Member, 'totalCheckIns' | 'lastCheckIn'>) => void;
  onUpdateMember: (id: string, updates: Partial<Member>) => void;
  onDeleteMember: (id: string) => void;
  plans: MembershipPlan[];
  currency: string;
  onTriggerInvoice?: (member: Member) => void;
}

export function MembersList({ members, onAddMember, onUpdateMember, onDeleteMember, plans, currency, onTriggerInvoice }: MembersListProps) {
  const brand = useBrand();
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Paused' | 'Expired'>('All');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedBadgeMember, setSelectedBadgeMember] = useState<Member | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const [showImportForm, setShowImportForm] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatusMessage, setImportStatusMessage] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAltPhone, setNewAltPhone] = useState('');
  const [newDob, setNewDob] = useState(''); // DDMMYY
  const [newPlan, setNewPlan] = useState<MembershipPlanName>('Monthly Core');
  const [newGender, setNewGender] = useState('Male');
  const [newShift, setNewShift] = useState<'Morning' | 'Evening'>('Morning');
  const [newNotes, setNewNotes] = useState('');
  const [newAutoRenew, setNewAutoRenew] = useState(false);
  const [newAvatarUrl, setNewAvatarUrl] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string>(''); // base64 representation of member photo
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceMemberId, setAdvanceMemberId] = useState<string>('');
  const [advanceAmount, setAdvanceAmount] = useState<string>('1000');
  const [advanceMode, setAdvanceMode] = useState<'Cash' | 'UPI' | 'Credit/Debit Card' | 'Net Banking' | 'Cheque' | 'Bank Transfer'>('UPI');
  const [advancePurpose, setAdvancePurpose] = useState<string>('Next Month Subscription Renewal');
  const [advanceExtendExpiry, setAdvanceExtendExpiry] = useState<boolean>(true);
  const [advanceExtensionDays, setAdvanceExtensionDays] = useState<number>(30); // 30 days default
  const [advanceRefNo, setAdvanceRefNo] = useState<string>('');
  const [advanceNotes, setAdvanceNotes] = useState<string>('');
  const [advanceFeedback, setAdvanceFeedback] = useState<{ success: boolean; message: string; receipt?: any } | null>(null);

  const [activeReceipt, setActiveReceipt] = useState<any | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [showAdvanceHistoryModal, setShowAdvanceHistoryModal] = useState<boolean>(false);
  const [advanceFilterOnly, setAdvanceFilterOnly] = useState<boolean>(false);

  const loadVideoDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(device => device.kind === 'videoinput');
      setVideoDevices(videoInputs);
    } catch (err) {
      console.warn("Failed to enumerate video devices:", err);
    }
  };

  const startCamera = async (deviceIdOverride?: string, facingModeOverride?: 'user' | 'environment') => {
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }

      const activeFacingMode = facingModeOverride || facingMode;
      const activeDeviceId = deviceIdOverride !== undefined ? deviceIdOverride : selectedDeviceId;

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 640 }
        }
      };

      if (activeDeviceId) {
        (constraints.video as any).deviceId = { exact: activeDeviceId };
      } else {
        (constraints.video as any).facingMode = activeFacingMode;
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      setIsCameraActive(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.warn('Video auto-play interrupted', e));
        }
      }, 100);

      await loadVideoDevices();
    } catch (err) {
      console.error("Camera access failed:", err);
      alert("Could not access webcam. Please check your browser's camera/device permissions or use file upload instead.");
    }
  };

  const handleDeviceChange = async (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    await startCamera(deviceId, undefined);
  };

  const handleFacingModeChange = async (mode: 'user' | 'environment') => {
    setFacingMode(mode);
    setSelectedDeviceId(''); // Clear selected device id so it defaults to facing mode
    await startCamera('', mode);
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const takeSnapshot = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const video = videoRef.current;
        const videoWidth = video.videoWidth || 640;
        const videoHeight = video.videoHeight || 640;
        const size = Math.min(videoWidth, videoHeight);
        const sx = (videoWidth - size) / 2;
        const sy = (videoHeight - size) / 2;
        ctx.drawImage(video, sx, sy, size, size, 0, 0, 400, 400);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedPhoto(dataUrl);
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) fileToDataUrl(file).then(setCapturedPhoto);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPhone.trim() || !newDob.trim()) {
      alert('Please fill in Name, Email, Phone, and Date of Birth.');
      return;
    }

    const parsedDob = newDob.trim().length >= 6 ? parseDobCode(newDob) : null;
    if (!parsedDob?.dob) {
      alert('Please enter a valid Date of Birth in DDMMYYYY format (8 digits, e.g. 20061988 for 20 June 1988) or DDMMYY (6 digits).');
      return;
    }
    const recordedDobId = parsedDob.id;
    const [year, month, day] = parsedDob.dob.split('-');
    const gatePin = `${day}${month}${year.slice(-2)}`;

    if (members.some(m => m.id === recordedDobId)) {
      alert(`A member with DOB ID "${recordedDobId}" is already registered. Membership IDs (DOB) must be unique.`);
      return;
    }

    const planObj = plans.find(p => p.name === newPlan);
    const joinDate = todayISO();
    const { expiryDateIso } = calculateExpiryDate(joinDate, planObj ? planObj.durationDays : 30);

    const finalPhoto = capturedPhoto || newAvatarUrl.trim() || undefined;
    const finalAvatar = newAvatarUrl.trim() || capturedPhoto || undefined;

    onAddMember({
      id: recordedDobId,
      name: newName,
      email: newEmail,
      phone: newPhone,
      alternatePhone: newAltPhone.trim() || undefined,
      status: 'Active',
      plan: newPlan,
      joinDate,
      expiryDate: expiryDateIso,
      dob: `${year}-${month}-${day}`,
      photoUrl: finalPhoto,
      avatarUrl: finalAvatar,
      gender: newGender,
      shiftTiming: newShift,
      notes: `${newNotes ? newNotes + ' ' : ''}DOB: ${day}/${month}/${year} (Gate PIN: ${gatePin})`.trim(),
      autoRenew: newAutoRenew,
    });

    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setNewAltPhone('');
    setNewDob('');
    setNewGender('Male');
    setNewShift('Morning');
    setNewNotes('');
    setNewAutoRenew(false);
    setNewAvatarUrl('');
    setCapturedPhoto('');
    setNewPlan('Monthly Core');
    setShowAddForm(false);
  };

  const filteredMembers = members.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) || 
                          m.id.toLowerCase().includes(search.toLowerCase()) ||
                          m.email.toLowerCase().includes(search.toLowerCase()) ||
                          m.phone.toLowerCase().includes(search.toLowerCase()) ||
                          (m.alternatePhone && m.alternatePhone.toLowerCase().includes(search.toLowerCase()));
    
    const matchesFilter = statusFilter === 'All' ? true : m.status === statusFilter;
    const matchesAdvance = advanceFilterOnly ? ((m.advanceBalance || 0) > 0 || (m.advancePayments && m.advancePayments.length > 0)) : true;
    
    return matchesSearch && matchesFilter && matchesAdvance;
  });

  const handleOpenAdvanceModal = (targetMember?: Member) => {
    if (targetMember) {
      setAdvanceMemberId(targetMember.id);
      const foundPlan = plans.find(p => p.name.toLowerCase() === targetMember.plan.toLowerCase());
      if (foundPlan) {
        setAdvanceAmount(String(foundPlan.price));
      } else {
        setAdvanceAmount('1000');
      }
    } else if (members.length > 0) {
      setAdvanceMemberId(members[0].id);
      const foundPlan = plans.find(p => p.name.toLowerCase() === members[0].plan.toLowerCase());
      setAdvanceAmount(foundPlan ? String(foundPlan.price) : '1000');
    }
    setAdvanceRefNo('');
    setAdvanceNotes('');
    setAdvanceFeedback(null);
    setShowAdvanceModal(true);
  };

  const handleProcessAdvancePayment = (e: React.FormEvent) => {
    e.preventDefault();
    const targetMember = members.find(m => m.id === advanceMemberId);
    if (!targetMember) {
      alert("Please select a valid member.");
      return;
    }

    const numAmount = parseFloat(advanceAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }

    const todayIso = new Date().toISOString();
    const receiptNo = `ADV-${Date.now().toString().slice(-6)}`;

    let newExpiryDate = targetMember.expiryDate;
    if (advanceExtendExpiry) {
      const currentExp = parseDate(targetMember.expiryDate) || new Date();
      const baseDate = currentExp > new Date() ? currentExp : new Date();
      const extended = new Date(baseDate.getTime() + advanceExtensionDays * 24 * 60 * 60 * 1000);
      newExpiryDate = formatDateISO(extended);
    }

    const newAdvanceRecord = {
      id: `ADV-TXN-${Date.now()}`,
      amount: numAmount,
      paymentMode: advanceMode,
      purpose: advancePurpose,
      date: todayIso,
      referenceNo: advanceRefNo.trim() || undefined,
      notes: advanceNotes.trim() || undefined,
      extendedExpiryDate: advanceExtendExpiry ? newExpiryDate : undefined,
      receiptNo,
    };

    const updatedAdvanceBalance = (targetMember.advanceBalance || 0) + numAmount;
    const existingPayments = targetMember.advancePayments || [];
    const updatedPayments = [newAdvanceRecord, ...existingPayments];

    const updates: Partial<Member> = {
      advanceBalance: updatedAdvanceBalance,
      advancePayments: updatedPayments,
      notes: `${targetMember.notes ? targetMember.notes + ' | ' : ''}[Advance Paid: ${currency}${numAmount} via ${advanceMode} on ${new Date().toLocaleDateString()} Ref:${advanceRefNo || 'N/A'}]`.trim(),
    };

    if (advanceExtendExpiry) {
      updates.expiryDate = newExpiryDate;
      if (targetMember.status === 'Expired' || targetMember.status === 'Paused') {
        updates.status = 'Active';
      }
    }

    onUpdateMember(targetMember.id, updates);

    const fullReceipt = {
      ...newAdvanceRecord,
      memberName: targetMember.name,
      memberPhone: targetMember.phone,
      memberEmail: targetMember.email,
      memberId: targetMember.id,
      memberPlan: targetMember.plan,
      memberCurrentExpiry: targetMember.expiryDate,
      memberNewExpiry: newExpiryDate,
      totalAdvanceBalance: updatedAdvanceBalance,
      currencySymbol: currency,
    };

    setActiveReceipt(fullReceipt);
    setAdvanceFeedback({
      success: true,
      message: `Advance payment of ${currency}${numAmount} recorded successfully for ${targetMember.name}!`,
      receipt: fullReceipt,
    });
  };

  const handleQuickRenew = (m: Member) => {
    const planObj = plans.find(p => p.name === m.plan) || plans[0];
    const today = todayISO();
    const { expiryDateIso } = calculateExpiryDate(today, planObj ? planObj.durationDays : 30);
    onUpdateMember(m.id, {
      status: 'Active',
      expiryDate: expiryDateIso,
      notes: `${m.notes || ''} Renewed on ${today}.`.trim()
    });
  };

  const handleTogglePause = (m: Member) => {
    const newStatus = m.status === 'Paused' ? 'Active' : 'Paused';
    onUpdateMember(m.id, { status: newStatus });
  };

  const handleBulkStatusChange = (newStatus: 'Active' | 'Paused' | 'Expired') => {
    if (confirm(`Are you sure you want to change the status of ${selectedMemberIds.length} selected member(s) to "${newStatus}"?`)) {
      selectedMemberIds.forEach(id => {
        onUpdateMember(id, { status: newStatus });
      });
      setSelectedMemberIds([]);
    }
  };

  const handleBulkPlanChange = (planName: MembershipPlanName) => {
    const planObj = plans.find(p => p.name === planName);
    if (!planObj) return;
    if (confirm(`Are you sure you want to change the membership plan of ${selectedMemberIds.length} selected member(s) to "${planName}"? This will also update their expiration date relative to today (${todayISO()}).`)) {
      selectedMemberIds.forEach(id => {
        const { expiryDateIso } = calculateExpiryDate(todayISO(), planObj.durationDays);
        onUpdateMember(id, { plan: planName, status: 'Active', expiryDate: expiryDateIso });
      });
      setSelectedMemberIds([]);
    }
  };

  const handleBulkDelete = () => {
    if (confirm(`WARNING: You are about to permanently delete ${selectedMemberIds.length} selected member(s). This action cannot be undone. Do you wish to proceed?`)) {
      selectedMemberIds.forEach(id => {
        onDeleteMember(id);
      });
      setSelectedMemberIds([]);
    }
  };

  const handleBulkAutoRenewChange = (enabled: boolean) => {
    if (confirm(`Are you sure you want to change the Auto-Renew status of ${selectedMemberIds.length} selected member(s) to "${enabled ? 'Enabled' : 'Disabled'}"?`)) {
      selectedMemberIds.forEach(id => {
        onUpdateMember(id, { autoRenew: enabled });
      });
      setSelectedMemberIds([]);
    }
  };

  const handleExportCSV = () => {
    downloadCsv(`gym_members_export_${todayISO()}.csv`, [
      ['ID/DOB', 'Name', 'Email', 'Primary Phone', 'Alternate Phone', 'Status', 'Plan Tier', 'Gender', 'Join Date', 'Expiry Date', 'Total Check-Ins', 'Last Check-In', 'Notes'],
      ...members.map(m => [m.id, m.name, m.email, m.phone, m.alternatePhone || 'N/A', m.status, m.plan, m.gender || 'Not Specified', m.joinDate, m.expiryDate, m.totalCheckIns, m.lastCheckIn || 'N/A', m.notes]),
    ]);
  };

  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseExcelFile(file);
  };

  const parseExcelFile = (file: File) => {
    setImportFile(file);
    setImportError(null);
    setImportStatusMessage(null);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("Could not read file data.");
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });
        
        if (json.length === 0) {
          throw new Error("The Excel file sheet appears to be empty.");
        }
        
        const headers = json[0].map((h: any) => String(h || '').trim().toLowerCase());
        const rows = json.slice(1);
        
        const idIdx = headers.findIndex((h: string) => h.includes('id') || h.includes('dob') || h.includes('birth') || h.includes('code') || h === 'dob id');
        const nameIdx = headers.findIndex((h: string) => h.includes('name') || h.includes('full name') || h.includes('member'));
        const emailIdx = headers.findIndex((h: string) => h.includes('email') || h.includes('mail'));
        const phoneIdx = headers.findIndex((h: string) => (h.includes('phone') || h.includes('mobile') || h.includes('contact') || h.includes('tel')) && !h.includes('alt') && !h.includes('second'));
        const altPhoneIdx = headers.findIndex((h: string) => h.includes('alt') || h.includes('secondary') || h.includes('emergency'));
        const planIdx = headers.findIndex((h: string) => h.includes('plan') || h.includes('tier') || h.includes('package'));
        const statusIdx = headers.findIndex((h: string) => h.includes('status') || h.includes('active') || h.includes('state'));
        const genderIdx = headers.findIndex((h: string) => h.includes('gender') || h.includes('sex'));
        const joinIdx = headers.findIndex((h: string) => h.includes('join') || h.includes('start') || h.includes('registration'));
        const expiryIdx = headers.findIndex((h: string) => h.includes('expiry') || h.includes('expire') || h.includes('end') || h.includes('valid'));
        const shiftIdx = headers.findIndex((h: string) => h.includes('shift') || h.includes('timing') || h.includes('slot'));
        const autoRenewIdx = headers.findIndex((h: string) => h.includes('renew') || h.includes('auto'));
        const notesIdx = headers.findIndex((h: string) => h.includes('notes') || h.includes('remark') || h.includes('comment') || h.includes('instruction'));

        if (nameIdx === -1) {
          throw new Error("Could not detect a 'Name' column header (e.g. 'Name', 'Full Name', 'Member Name') in the first row of your Excel sheet.");
        }

        const parsed: any[] = [];
        const usedIds = new Set<string>();
        
        rows.forEach((row: any, index: number) => {
          if (!row || row.length === 0) return;
          
          const name = row[nameIdx] ? String(row[nameIdx]).trim() : '';
          if (!name) return; // skip row with empty name
          
          let rawId = '';
          let dob: string | undefined;
          const rawVal = idIdx !== -1 ? row[idIdx] : undefined;
          if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
            let digits = '';
            if (typeof rawVal === 'number' && rawVal > 1000 && rawVal < 100000) {
              const d = XLSX.SSF.parse_date_code(rawVal);
              if (d?.d && d?.m) digits = `${String(d.d).padStart(2, '0')}${String(d.m).padStart(2, '0')}${d.y || ''}`;
            }
            if (!digits) {
              const parts = String(rawVal).trim().split(/[^0-9]+/).filter(Boolean);
              digits = parts.length >= 2 ? parts[0].padStart(2, '0') + parts[1].padStart(2, '0') + (parts[2] || '') : parts[0] || '';
            }
            const parsedDob = parseDobCode(digits) || parseDobCode(digits.slice(0, 4));
            rawId = parsedDob?.id || String(rawVal).replace(/[^a-zA-Z0-9]/g, '');
            dob = parsedDob?.dob;
          }
          if (!rawId) rawId = `99${String(index + 1).padStart(2, '0')}`;

          let id = rawId;
          for (let n = 2; usedIds.has(id); n++) id = `${rawId}-${n}`;
          usedIds.add(id);

          const email = emailIdx !== -1 && row[emailIdx] ? String(row[emailIdx]).trim() : `${name.toLowerCase().replace(/\s+/g, '')}@example.com`;
          const phone = phoneIdx !== -1 && row[phoneIdx] ? String(row[phoneIdx]).trim() : '+91 99999 99999';
          const alternatePhone = altPhoneIdx !== -1 && row[altPhoneIdx] ? String(row[altPhoneIdx]).trim() : undefined;
          
          let plan = 'Monthly Core';
          if (planIdx !== -1 && row[planIdx]) {
            const excelPlan = String(row[planIdx]).trim();
            const matched = plans.find(p => p.name.toLowerCase() === excelPlan.toLowerCase() || p.name.toLowerCase().includes(excelPlan.toLowerCase()));
            if (matched) {
              plan = matched.name;
            }
          }
          
          let status: 'Active' | 'Paused' | 'Expired' = 'Active';
          if (statusIdx !== -1 && row[statusIdx]) {
            const excelStatus = String(row[statusIdx]).trim().toLowerCase();
            if (excelStatus.includes('pause')) status = 'Paused';
            else if (excelStatus.includes('expire') || excelStatus.includes('end')) status = 'Expired';
            else if (excelStatus.includes('active')) status = 'Active';
          }
          
          const gender = genderIdx !== -1 && row[genderIdx] ? String(row[genderIdx]).trim() : 'Male';

          let shiftTiming: 'Morning' | 'Evening' = 'Morning';
          if (shiftIdx !== -1 && row[shiftIdx]) {
            const st = String(row[shiftIdx]).trim().toLowerCase();
            if (st.includes('even') || st.includes('night') || st.includes('pm')) {
              shiftTiming = 'Evening';
            } else if (st.includes('morn') || st.includes('am')) {
              shiftTiming = 'Morning';
            }
          }
          
          let joinDate = todayISO();
          if (joinIdx !== -1 && row[joinIdx]) {
            const jd = String(row[joinIdx]).trim();
            joinDate = formatDateISO(jd);
          }
          
          let expiryDate = '';
          if (expiryIdx !== -1 && row[expiryIdx]) {
            const ed = String(row[expiryIdx]).trim();
            expiryDate = formatDateISO(ed);
          }
          
          if (!expiryDate) {
            const planObj = plans.find(p => p.name === plan) || plans[0];
            const { expiryDateIso } = calculateExpiryDate(joinDate, planObj ? planObj.durationDays : 30);
            expiryDate = expiryDateIso;
          }

          const notes = notesIdx !== -1 && row[notesIdx] ? String(row[notesIdx]).trim() : '';
          
          let autoRenew = false;
          if (autoRenewIdx !== -1 && row[autoRenewIdx]) {
            const ar = String(row[autoRenewIdx]).trim().toLowerCase();
            if (ar === 'true' || ar === 'yes' || ar === '1' || ar === 'y') {
              autoRenew = true;
            }
          }

          parsed.push({
            id,
            dob,
            name,
            email,
            phone,
            alternatePhone,
            status,
            plan,
            joinDate,
            expiryDate,
            gender,
            shiftTiming,
            notes,
            autoRenew,
            totalCheckIns: 0,
            lastCheckIn: null
          });
        });
        
        if (parsed.length === 0) {
          throw new Error("No valid rows could be parsed. Check that your rows have non-empty Member Names.");
        }
        
        setImportPreview(parsed);
      } catch (err: any) {
        setImportError(err.message || "Failed to read excel file. Please make sure columns are named properly.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmImport = async () => {
    if (importPreview.length === 0) return;
    
    setIsImporting(true);
    setImportStatusMessage("Directly replicating members to database...");
    
    try {
      const existingIds = new Set(members.map(m => m.id));
      const created = importPreview.filter(m => !existingIds.has(m.id));
      const updated = importPreview.filter(m => existingIds.has(m.id));
      await membersDb.put(...created);
      await Promise.all(updated.map(({ id, totalCheckIns, lastCheckIn, ...rest }) => membersDb.patch(id, rest)));
      const createdCount = created.length;
      const updatedCount = updated.length;

      setImportStatusMessage(`Import successfully finished! Replicated ${createdCount + updatedCount} members (${createdCount} new, ${updatedCount} updated) directly to the database.`);
      setImportPreview([]);
      setImportFile(null);
      setTimeout(() => {
        setShowImportForm(false);
        setImportStatusMessage(null);
      }, 4000);
    } catch (err: any) {
      setImportError(err.message || "An error occurred during database replication.");
    } finally {
      setIsImporting(false);
    }
  };

  const receiptText = (r: any) =>
    `${brand.name} - Advance Payment Receipt\nReceipt No: ${r.receiptNo}\nMember: ${r.memberName} (${r.memberId})\nAmount Received: ${r.currencySymbol}${r.amount}\nMode: ${r.paymentMode}\nPurpose: ${r.purpose}\nNew Expiry Date: ${formatDateDDMMYYYY(r.memberNewExpiry)}\nTotal Advance Credit: ${r.currencySymbol}${r.totalAdvanceBalance}\n\n${brand.receiptNote}`;

  const handleCancelImport = () => {
    setImportPreview([]);
    setImportFile(null);
    setImportError(null);
    setShowImportForm(false);
  };

  return (
    <div className="space-y-6 animate-fade-in" id="members-management-section">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-sans font-bold tracking-tight text-slate-900">
            Members Directory
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse profile, renew tiers, and generate custom QR attendance badges
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleOpenAdvanceModal()}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-4 py-2.5 rounded-xl font-sans font-bold text-sm transition-all duration-150 shadow-sm cursor-pointer"
            id="btn-receive-advance"
            title="Receive Advance Payment from member"
          >
            <HandCoins className="w-4 h-4 text-purple-200" />
            <span>Receive Advance</span>
          </button>

          <button
            onClick={() => setShowAdvanceHistoryModal(true)}
            className="flex items-center gap-2 bg-purple-50 border border-purple-200/80 hover:bg-purple-100/70 text-purple-900 px-3.5 py-2.5 rounded-xl font-sans font-bold text-sm transition-all duration-150 shadow-xs cursor-pointer"
            id="btn-advance-history"
            title="View Advance Payment Receipts History"
          >
            <History className="w-4 h-4 text-purple-600" />
            <span className="hidden lg:inline">Advance History</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl font-sans font-semibold text-sm transition-all duration-150 shadow-xs cursor-pointer"
            id="btn-export-csv"
            title="Export all members to CSV"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => {
              setShowImportForm(!showImportForm);
              setShowAddForm(false);
            }}
            className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100/50 text-emerald-800 px-4 py-2.5 rounded-xl font-sans font-semibold text-sm transition-all duration-150 shadow-xs cursor-pointer"
            id="btn-import-excel"
            title="Import members from Excel (.xlsx)"
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>Import Excel</span>
          </button>

          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setShowImportForm(false);
            }}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-sans font-semibold text-sm transition-all duration-150 shadow-sm"
            id="btn-toggle-add-form"
          >
            {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showAddForm ? 'Close Registration Form' : 'Register New Member'}
          </button>
        </div>
      </div>

      {showImportForm && (
        <div 
          className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-md space-y-6 animate-slide-down"
          id="import-excel-panel"
        >
          <div className="pb-2 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="font-sans font-bold text-lg text-slate-900">Import Members via Excel</h3>
              <p className="text-xs text-slate-500 mt-0.5">Upload a spreadsheet (.xlsx) file to register new members or update existing records in bulk</p>
            </div>
            <button 
              onClick={handleCancelImport}
              className="text-slate-400 hover:text-slate-600 p-1 bg-slate-50 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!importFile ? (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-emerald-200 hover:border-emerald-400 bg-emerald-50/20 hover:bg-emerald-50/40 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all duration-150 relative">
                <input 
                  type="file" 
                  accept=".xlsx, .xls"
                  onChange={handleExcelFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  id="excel-file-input"
                />
                <div className="p-3.5 bg-emerald-100/80 text-emerald-700 rounded-2xl mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800">Drag & drop your Excel file here, or click to browse</p>
                <p className="text-xs text-slate-400 mt-1">Supports standard Excel Spreadsheets (.xlsx, .xls)</p>
              </div>

              <div className="bg-slate-50 rounded-xl p-4.5 border border-slate-150 space-y-2">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Sheet Mapping Format Tips:</p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your Excel sheet's <strong>first row must contain headers</strong> so we can auto-map them:
                </p>
                <ul className="text-xs text-slate-500 list-disc pl-5 space-y-1">
                  <li><strong>Name</strong> or <strong>Full Name</strong> (Required) — mapped to Name</li>
                  <li><strong>ID</strong> or <strong>DOB</strong> or <strong>Birth</strong> — mapped to Unique DOB-ID (DDMMYY). If empty or invalid, sequential numerical ID is fallback.</li>
                  <li><strong>Email</strong> or <strong>Mail</strong> — mapped to Email Address</li>
                  <li><strong>Phone</strong> or <strong>Mobile</strong> — mapped to Phone Number</li>
                  <li><strong>Plan</strong> or <strong>Tier</strong> — matches your Membership tiers (e.g. "Monthly Core")</li>
                  <li><strong>Status</strong> — Active, Paused, or Expired (defaults to Active)</li>
                  <li><strong>Gender</strong> — Male, Female, etc.</li>
                  <li><strong>Notes</strong> or <strong>Comments</strong> — staff remarks</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{importFile.name}</p>
                    <p className="text-xs text-slate-500">{(importFile.size / 1024).toFixed(1)} KB • {importPreview.length} rows detected</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setImportFile(null);
                    setImportPreview([]);
                    setImportError(null);
                  }}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                >
                  Change File
                </button>
              </div>

              {importError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-xs font-medium">
                  {importError}
                </div>
              )}

              {importStatusMessage && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-medium">
                  {importStatusMessage}
                </div>
              )}

              {importPreview.length > 0 && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Spreadsheet Preview & Database Collision Check:</h4>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono">Row 1 (Headers) Excluded</span>
                  </div>

                  <div className="border border-slate-150 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-150">
                        <tr>
                          <th className="px-4 py-2.5 font-bold">Import Status</th>
                          <th className="px-4 py-2.5 font-bold">ID / DOB</th>
                          <th className="px-4 py-2.5 font-bold">Name</th>
                          <th className="px-4 py-2.5 font-bold">Shift</th>
                          <th className="px-4 py-2.5 font-bold">Phone</th>
                          <th className="px-4 py-2.5 font-bold">Plan</th>
                          <th className="px-4 py-2.5 font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {importPreview.map((m, idx) => {
                          const exists = members.some(em => em.id === m.id);
                          return (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2">
                                {exists ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-semibold border border-amber-100">
                                    Overwrite ID
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-semibold border border-emerald-100">
                                    Create New
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2 font-mono font-medium text-slate-600">{m.id}</td>
                              <td className="px-4 py-2 font-semibold text-slate-800">{m.name}</td>
                              <td className="px-4 py-2">
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  m.shiftTiming === 'Evening' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  {m.shiftTiming === 'Evening' ? '🌙 Evening' : '☀️ Morning'}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-slate-500">{m.phone}</td>
                              <td className="px-4 py-2 text-slate-500">{m.plan}</td>
                              <td className="px-4 py-2">
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  m.status === 'Active' ? 'bg-emerald-50 text-emerald-600' :
                                  m.status === 'Paused' ? 'bg-amber-50 text-amber-600' :
                                  'bg-slate-100 text-slate-500'
                                }`}>
                                  {m.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleCancelImport}
                      className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                    >
                      Discard & Close
                    </button>
                    <button
                      type="button"
                      disabled={isImporting}
                      onClick={handleConfirmImport}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all"
                    >
                      {isImporting ? "Processing..." : `Import & Sync ${importPreview.length} Members`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showAddForm && (
        <form 
          onSubmit={handleAddSubmit} 
          className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-md grid grid-cols-1 md:grid-cols-3 gap-5 animate-slide-down"
          id="add-member-form"
        >
          <div className="md:col-span-3 pb-2 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-sans font-bold text-slate-900">New Membership Form</h3>
            <span className="text-[10px] text-sky-605 font-mono font-bold bg-sky-50 px-2.5 py-1 rounded">JOIN DATE: {todayISO()}</span>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Full Name</label>
            <input 
              type="text" 
              required
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full text-slate-950 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-sans"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Email Address</label>
            <input 
              type="email" 
              required
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="e.g. john@domain.com"
              className="w-full text-slate-950 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-sans"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Primary Phone Number</label>
            <input 
              type="tel" 
              required
              value={newPhone}
              onChange={e => setNewPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210 or 9876543210"
              className="w-full text-slate-950 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-sans"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 flex items-center justify-between">
              <span>Alternate Phone <span className="text-slate-400 font-normal">(Optional / Emergency)</span></span>
            </label>
            <input 
              type="tel" 
              value={newAltPhone}
              onChange={e => setNewAltPhone(e.target.value)}
              placeholder="e.g. +91 98765 00000 (Emergency contact)"
              className="w-full text-slate-950 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-sans"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Membership Tier</label>
            <select
              value={newPlan}
              onChange={e => setNewPlan(e.target.value as MembershipPlanName)}
              className="w-full text-slate-950 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-sans"
            >
              {plans.map(p => (
                <option key={p.name} value={p.name}>
                  {p.name} ({currency}{p.price} - {p.durationDays} days)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 block">
              Date of Birth (DDMMYYYY) <span className="text-sky-600 font-bold">*Recorded Original DOB*</span>
            </label>
            <input 
              type="text" 
              required
              maxLength={8}
              value={newDob}
              onChange={e => setNewDob(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 20061988 (20 Jun 1988)"
              className="w-full text-slate-950 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-mono font-bold"
            />
            <p className="text-[10px] text-slate-500 leading-tight">
              Recorded as 8-digit DOB (<span className="font-mono font-bold text-slate-700">DDMMYYYY</span>). Gate entry PIN will be 4-digit (<span className="font-mono font-bold text-sky-700">DDMM</span>, e.g. <span className="font-mono font-bold text-emerald-600">2006</span> for 20th June).
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Gender</label>
            <select
              value={newGender}
              onChange={e => setNewGender(e.target.value)}
              className="w-full text-slate-950 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-sans"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Non-Binary">Non-Binary</option>
              <option value="Other">Other</option>
              <option value="Prefer Not to Say">Prefer Not to Say</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Shift Timing</label>
            <select
              value={newShift}
              onChange={e => setNewShift(e.target.value as 'Morning' | 'Evening')}
              className="w-full text-slate-950 px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50/40 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans font-bold"
            >
              <option value="Morning">☀️ Morning Shift</option>
              <option value="Evening">🌙 Evening Shift</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Staff Notes / Instructions</label>
            <input 
              type="text" 
              value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
              placeholder="Locker assignment, health remarks..."
              className="w-full text-slate-950 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-sans"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-semibold text-slate-600 flex items-center justify-between">
              <span>Member Avatar URL <span className="text-slate-400 font-normal">(Optional HTTP/HTTPS Image Link)</span></span>
              {newAvatarUrl && (
                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                  ✓ Avatar URL Set
                </span>
              )}
            </label>
            <div className="relative">
              <input 
                type="url" 
                value={newAvatarUrl}
                onChange={e => setNewAvatarUrl(e.target.value)}
                placeholder="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
                className="w-full text-slate-950 pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-sans"
                id="input-member-avatar-url"
              />
              <Image className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Paste an avatar image link or use webcam capture/file upload below.
            </p>
          </div>

          <div className="space-y-1 flex items-center h-full pt-1 sm:pt-6">
            <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors w-full select-none" id="add-auto-renew-toggle">
              <input 
                type="checkbox"
                checked={newAutoRenew}
                onChange={e => setNewAutoRenew(e.target.checked)}
                className="rounded border-slate-300 text-sky-500 focus:ring-sky-500 cursor-pointer h-4 w-4"
              />
              <div className="leading-none text-left">
                <span className="text-xs font-bold text-slate-700 block">Auto-Renew Status</span>
                <span className="text-[10px] text-slate-400">Automatically renew subscription</span>
              </div>
            </label>
          </div>

          <div className="md:col-span-3 bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-sky-600" />
                Member Photo (Realtime Capture or File Upload)
              </span>
              {capturedPhoto && (
                <button
                  type="button"
                  onClick={() => {
                    setCapturedPhoto('');
                    stopCamera();
                  }}
                  className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 bg-rose-50 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Clear Photo
                </button>
              )}
            </div>

            <div className="flex flex-col lg:flex-row gap-6 items-center justify-center">
              <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-2xl border-4 border-white dark:border-slate-800 shadow-lg bg-slate-900 overflow-hidden flex items-center justify-center transition-all duration-300">
                {capturedPhoto ? (
                  <img 
                    src={capturedPhoto} 
                    alt="Captured Member" 
                    className="w-full h-full object-cover"
                  />
                ) : isCameraActive ? (
                  <>
                    <video
                      ref={videoRef}
                      className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                      playsInline
                      muted
                    />
                    <div className="absolute inset-0 pointer-events-none border border-white/10 flex flex-col justify-between">
                      <div className="h-1/3 w-full border-b border-white/20 border-dashed" />
                      <div className="h-1/3 w-full border-b border-white/20 border-dashed" />
                      <div className="absolute inset-y-0 left-1/3 w-1/3 border-x border-white/20 border-dashed" />
                    </div>
                    <div className="absolute inset-6 pointer-events-none border-2 border-dashed border-sky-400/40 rounded-xl" />
                  </>
                ) : (
                  <div className="text-center p-4 text-slate-500">
                    <Camera className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-400" />
                    <span className="text-xs text-slate-400 font-semibold leading-tight block">No Photo Captured</span>
                    <span className="text-[10px] text-slate-500 mt-1 block">Activate camera or upload file</span>
                  </div>
                )}

                {isCameraActive && (
                  <div className="absolute top-3 right-3 bg-emerald-500 text-[8px] text-black font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs z-10">
                    <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                    Live
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-4 w-full text-center lg:text-left">
                {!capturedPhoto ? (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500 leading-relaxed max-w-md">
                      For premium member cards & front-desk check-ins, capture a high-res photo directly from your device, or upload an image.
                    </p>

                    {isCameraActive && (
                      <div className="bg-white border border-slate-200 p-3 rounded-xl space-y-3 shadow-3xs text-left" id="camera-settings-panel">
                        {videoDevices.length > 0 && (
                          <div className="space-y-1">
                            <label className="text-[9px] font-extrabold text-slate-450 uppercase tracking-wider block">Webcam Input Device</label>
                            <select
                              value={selectedDeviceId}
                              onChange={(e) => handleDeviceChange(e.target.value)}
                              className="w-full text-xs text-slate-800 bg-slate-50/50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500/10 focus:bg-white font-sans font-medium"
                            >
                              {videoDevices.map((device, idx) => (
                                <option key={device.deviceId} value={device.deviceId}>
                                  {device.label || `Camera Device ${idx + 1}`}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold text-slate-450 uppercase tracking-wider block">Facing Presets</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => handleFacingModeChange('user')}
                              className={`text-[10px] py-1 px-2 rounded-lg font-bold border text-center transition-all cursor-pointer ${
                                facingMode === 'user' && !selectedDeviceId
                                  ? 'bg-sky-50 text-sky-700 border-sky-300 shadow-3xs' 
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              Front Camera
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFacingModeChange('environment')}
                              className={`text-[10px] py-1 px-2 rounded-lg font-bold border text-center transition-all cursor-pointer ${
                                facingMode === 'environment' && !selectedDeviceId
                                  ? 'bg-sky-50 text-sky-700 border-sky-300 shadow-3xs' 
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              Back Camera
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2.5 justify-center lg:justify-start">
                      {!isCameraActive ? (
                        <button
                          type="button"
                          onClick={() => startCamera()}
                          className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          Activate Camera
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={takeSnapshot}
                            className="bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-black px-4 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
                          >
                            Capture Snapshot
                          </button>
                          <button
                            type="button"
                            onClick={stopCamera}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      <label className="cursor-pointer bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload File</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-emerald-600 font-black flex items-center justify-center lg:justify-start gap-1">
                      ✓ Profile photo attached successfully!
                    </p>
                    <p className="text-[11px] text-slate-400 leading-normal max-w-sm">
                      This high-fidelity image has been cropped and will automatically sync to Firestore. It will display on the check-in dashboard, custom reports, and member physical print tags.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="md:col-span-3 pt-2 text-right">
            <button
              type="submit"
              className="bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-black font-sans font-bold text-sm px-6 py-2.5 rounded-xl shadow-md transition-all duration-150"
            >
              Add Membership Base
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col gap-4" id="member-filters">
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ID, Name or Email address..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-slate-950 pl-11 pr-10 py-2.5 bg-slate-50/50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 text-sm focus:border-sky-500 transition-all font-sans"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 transition-colors p-1 rounded-full hover:bg-slate-100"
                title="Clear filter text"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex gap-2 items-center flex-wrap" id="status-toggle-container">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 font-sans mr-2">
              <Filter className="w-3.5 h-3.5" />
              Filter status:
            </span>
            {(['All', 'Active', 'Paused', 'Expired'] as const).map(f => {
              const isActive = statusFilter === f;
              let badgeColorClass = 'bg-slate-50 text-slate-600 hover:bg-slate-100';
              if (isActive) {
                if (f === 'Active') badgeColorClass = 'bg-emerald-600 text-white shadow-xs font-black';
                else if (f === 'Paused') badgeColorClass = 'bg-amber-500 text-slate-950 shadow-xs font-black';
                else if (f === 'Expired') badgeColorClass = 'bg-rose-600 text-white shadow-xs font-black';
                else badgeColorClass = 'bg-slate-900 text-white shadow-xs font-black';
              }
              const count = f === 'All' ? members.length : members.filter(m => m.status === f).length;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  className={`text-xs px-3.5 py-2 rounded-xl font-sans transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${badgeColorClass}`}
                >
                  {f === 'Active' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {f === 'Paused' && <PauseCircle className="w-3.5 h-3.5" />}
                  {f === 'Expired' && <AlertCircle className="w-3.5 h-3.5" />}
                  <span>{f}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200/70 text-slate-700'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setAdvanceFilterOnly(!advanceFilterOnly)}
              className={`text-xs px-3.5 py-2 rounded-xl font-sans transition-all duration-150 flex items-center gap-1.5 cursor-pointer border ${
                advanceFilterOnly 
                  ? 'bg-purple-600 text-white border-purple-600 shadow-xs font-black' 
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200 font-semibold'
              }`}
              title="Filter members with Advance Payments / Credit balance"
            >
              <Wallet className="w-3.5 h-3.5 text-purple-500" />
              <span>Advance Paid</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                advanceFilterOnly ? 'bg-white/20 text-white' : 'bg-purple-200 text-purple-800'
              }`}>
                {members.filter(m => (m.advanceBalance || 0) > 0 || (m.advancePayments && m.advancePayments.length > 0)).length}
              </span>
            </button>
          </div>
        </div>

        <div className="text-left border-t border-slate-100 pt-2.5 flex justify-between items-center text-xs text-slate-450 font-sans">
          <span>
            Showing <strong className="text-slate-800">{filteredMembers.length}</strong> of <strong className="text-slate-600">{members.length}</strong> registered members matching criteria
          </span>
          {search && (
            <span className="text-[10px] bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
              Search term active
            </span>
          )}
        </div>
      </div>

      {selectedMemberIds.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 shadow-md flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 animate-scale-up" id="bulk-operations-bar">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-black font-mono">
              {selectedMemberIds.length}
            </span>
            <div className="text-left font-sans">
              <span className="text-sm font-semibold text-slate-100 block">Members Selected</span>
              <span className="text-[11px] text-slate-400">Perform bulk actions on matching database rows</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto mt-2 lg:mt-0">
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-800 rounded-xl px-2 py-1.5 border border-slate-700">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono px-1">Status:</span>
              <button
                type="button"
                onClick={() => handleBulkStatusChange('Active')}
                className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-bold cursor-pointer"
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => handleBulkStatusChange('Paused')}
                className="px-2.5 py-1 text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors font-bold cursor-pointer"
              >
                Pause
              </button>
              <button
                type="button"
                onClick={() => handleBulkStatusChange('Expired')}
                className="px-2.5 py-1 text-xs bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors font-bold cursor-pointer"
              >
                Expire
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-800 rounded-xl px-2 py-1.5 border border-slate-700">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono px-1">Plan:</span>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkPlanChange(e.target.value as MembershipPlanName);
                    e.target.value = ''; // reset dropdown
                  }
                }}
                className="bg-slate-950 text-white border border-slate-700 text-xs rounded-lg px-2 py-1 focus:outline-none"
                defaultValue=""
              >
                <option value="" disabled>Change Plan...</option>
                {plans.map(p => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-800 rounded-xl px-2 py-1.5 border border-slate-700">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono px-1 font-sans">Renew Option:</span>
              <button
                type="button"
                onClick={() => handleBulkAutoRenewChange(true)}
                className="px-2 py-1 text-xs bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg transition-colors font-bold cursor-pointer"
                title="Enable Auto-Renew for selected members"
              >
                Enable
              </button>
              <button
                type="button"
                onClick={() => handleBulkAutoRenewChange(false)}
                className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-350 rounded-lg transition-colors font-bold cursor-pointer"
                title="Disable Auto-Renew for selected members"
              >
                Disable
              </button>
            </div>

            <button
              type="button"
              onClick={handleBulkDelete}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-3xs"
              title="Delete selected profiles permanently"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Bulk Delete</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMemberIds([])}
              className="px-3.5 py-2 hover:bg-slate-850 hover:border-slate-600 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer"
            >
              Cancel Selection
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm" id="members-list-table">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-4 px-4 w-12 text-center">
                  <input 
                    type="checkbox"
                    checked={filteredMembers.length > 0 && filteredMembers.every(m => selectedMemberIds.includes(m.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const newSelected = [...selectedMemberIds];
                        filteredMembers.forEach(m => {
                          if (!newSelected.includes(m.id)) {
                            newSelected.push(m.id);
                          }
                        });
                        setSelectedMemberIds(newSelected);
                      } else {
                        const filteredIds = filteredMembers.map(m => m.id);
                        setSelectedMemberIds(selectedMemberIds.filter(id => !filteredIds.includes(id)));
                      }
                    }}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer h-4 w-4"
                    title="Select/deselect all showing members"
                  />
                </th>
                <th className="py-4 px-6">Member Identity</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Plan Tier</th>
                <th className="py-4 px-6">Valid Period</th>
                <th className="py-4 px-6">Stat Counts</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
              {filteredMembers.map(m => {
                const daysRemaining = calculateDaysRemaining(m.expiryDate);
                const isChecked = selectedMemberIds.includes(m.id);
                return (
                  <tr key={m.id} className={`hover:bg-slate-50/40 transition-colors ${isChecked ? 'bg-indigo-50/20' : ''}`}>
                    
                    <td className="py-4 px-4 text-center w-12">
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMemberIds([...selectedMemberIds, m.id]);
                          } else {
                            setSelectedMemberIds(selectedMemberIds.filter(id => id !== m.id));
                          }
                        }}
                        className="rounded border-slate-300 text-slate-950 focus:ring-slate-900 cursor-pointer h-4 w-4"
                      />
                    </td>

                    <td className="py-2 px-6">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className={`w-10 h-10 rounded-full bg-slate-100 border overflow-hidden flex items-center justify-center shrink-0 ring-2 transition-all ${
                            m.status === 'Active' 
                              ? 'border-emerald-200 ring-emerald-500/30' 
                              : m.status === 'Paused' 
                                ? 'border-amber-200 ring-amber-500/30' 
                                : 'border-rose-200 ring-rose-500/30'
                          }`}>
                            {(m.avatarUrl || m.photoUrl) ? (
                              <img src={m.avatarUrl || m.photoUrl} alt={m.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <span className="text-xs font-extrabold text-slate-600 font-sans">
                                {m.name ? m.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'M'}
                              </span>
                            )}
                          </div>
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center ${
                            m.status === 'Active' ? 'bg-emerald-500' : m.status === 'Paused' ? 'bg-amber-500' : 'bg-rose-500'
                          }`} title={`Status: ${m.status}`}>
                            <span className="w-1 h-1 rounded-full bg-white" />
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-sans font-extrabold text-slate-900">{m.name}</span>
                            <span className="text-[10px] font-mono leading-none bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded font-bold" title="Original DOB ID (DDMMYYYY)">DOB: {m.id}</span>
                            <span className="text-[10px] font-mono leading-none bg-sky-50 text-sky-800 border border-sky-200/80 px-1.5 py-0.5 rounded font-extrabold" title="Entry Gate PIN (DDMM)">PIN: {m.id.length >= 4 ? m.id.slice(0, 4) : m.id}</span>
                             {m.gender && (
                              <span className="text-[10px] font-sans leading-none bg-sky-50 text-sky-700/80 border border-sky-100 px-1.5 py-0.5 rounded font-semibold">{m.gender}</span>
                            )}
                            <span className={`text-[10px] font-sans leading-none px-1.5 py-0.5 rounded font-bold border inline-flex items-center gap-1 ${
                              m.shiftTiming === 'Evening'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {m.shiftTiming === 'Evening' ? '🌙 Evening' : '☀️ Morning'}
                            </span>
                            {(m.advanceBalance || 0) > 0 && (
                              <span className="text-[10px] inline-flex items-center gap-1 font-sans leading-none bg-purple-100 text-purple-900 border border-purple-300 px-1.5 py-0.5 rounded font-bold shadow-3xs" title={`Advance Credit Balance: ${currency}${m.advanceBalance}`}>
                                <Wallet className="w-2.5 h-2.5 text-purple-700 shrink-0" />
                                <span>Advance: {currency}{m.advanceBalance}</span>
                              </span>
                            )}
                            {m.totalCheckIns >= 20 ? (
                              <span className="text-[10px] inline-flex items-center gap-0.5 font-sans leading-none bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/15 px-1.5 py-0.5 rounded font-black shadow-3xs" title="Gold Member Badge: 20+ Check-ins">
                                <Trophy className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                <span>Gold</span>
                              </span>
                            ) : m.totalCheckIns >= 10 ? (
                              <span className="text-[10px] inline-flex items-center gap-0.5 font-sans leading-none bg-slate-400/10 text-slate-700 dark:text-slate-300 border border-slate-300/15 px-1.5 py-0.5 rounded font-black shadow-3xs" title="Silver Member Badge: 10-19 Check-ins">
                                <Award className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                                <span>Silver</span>
                              </span>
                            ) : m.totalCheckIns >= 1 ? (
                              <span className="text-[10px] inline-flex items-center gap-0.5 font-sans leading-none bg-amber-700/10 text-amber-800 dark:text-amber-400 border border-amber-600/15 px-1.5 py-0.5 rounded font-black shadow-3xs" title="Bronze Member Badge: 1-9 Check-ins">
                                <Award className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                                <span>Bronze</span>
                              </span>
                            ) : (
                              <span className="text-[10px] inline-flex items-center gap-0.5 font-sans leading-none bg-slate-50 dark:bg-slate-900 border border-slate-200/50 px-1.5 py-0.5 rounded text-slate-400 dark:text-slate-500 font-semibold" title="New Member: No logs recorded yet">
                                <span>Newbie</span>
                              </span>
                            )}
                          </div>
                          <div className="space-y-0.5 text-slate-400 text-xs">
                            <div className="flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5 text-slate-300" />
                              <span>{m.email}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5 text-slate-300" />
                              <span>{m.phone}</span>
                              {m.alternatePhone && (
                                <span className="text-[10px] text-slate-400 font-medium ml-1">
                                  (Alt: {m.alternatePhone})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-sans font-black leading-none shadow-3xs transition-all ${
                        m.status === 'Active' 
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 ring-2 ring-emerald-500/10' 
                          : m.status === 'Paused' 
                            ? 'bg-amber-50 text-amber-800 border border-amber-200/80 ring-2 ring-amber-500/10'
                            : 'bg-rose-50 text-rose-800 border border-rose-200/80 ring-2 ring-rose-500/10'
                      }`}>
                        {m.status === 'Active' && (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Active</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
                          </>
                        )}
                        {m.status === 'Paused' && (
                          <>
                            <PauseCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>Paused</span>
                          </>
                        )}
                        {m.status === 'Expired' && (
                          <>
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>Expired</span>
                          </>
                        )}
                      </span>
                    </td>

                    <td className="py-4 px-6 font-semibold font-sans text-slate-800">
                      {m.plan}
                    </td>

                    <td className="py-4 px-6">
                      <div className="space-y-0.5 font-sans">
                        <p className="font-semibold text-slate-700 text-xs flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Expires {formatDateDDMMYYYY(m.expiryDate)}</span>
                        </p>
                        {m.status === 'Active' ? (
                          <p className="text-[11px] text-slate-500 font-mono font-semibold">
                            {daysRemaining} check-in days left
                          </p>
                        ) : (
                          <p className="text-[11px] text-rose-500 font-bold uppercase font-mono">
                            {m.status === 'Paused' ? 'PAUSED' : 'EXPIRED'}
                          </p>
                        )}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => onUpdateMember(m.id, { autoRenew: !m.autoRenew })}
                            className={`inline-flex items-center gap-1.5 text-[10px] font-sans font-extrabold rounded px-2 py-0.5 transition-all cursor-pointer border ${
                              m.autoRenew 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300' 
                                : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600 hover:border-slate-300'
                            }`}
                            title={m.autoRenew ? "Auto-Renew is Enabled. Click to disable." : "Auto-Renew is Disabled. Click to enable."}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              m.autoRenew ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                            }`} />
                            {m.autoRenew ? 'Auto-Renew: On' : 'Auto-Renew: Off'}
                          </button>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <div className="font-mono text-center md:text-left space-y-0.5">
                        <p className="text-xs font-bold text-slate-850">
                          Total: <strong className="text-slate-900">{m.totalCheckIns}</strong>
                        </p>
                        <p className="text-[10px] text-slate-550 font-semibold leading-normal">
                          {m.lastCheckIn 
                            ? `Last: ${new Date(m.lastCheckIn).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} @ ${new Date(m.lastCheckIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` 
                            : 'Never checked in'}
                        </p>
                      </div>
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        
                        <button
                          onClick={() => handleOpenAdvanceModal(m)}
                          className="p-1 px-2.5 py-1.5 rounded-lg border border-purple-200 text-purple-700 hover:text-purple-900 hover:bg-purple-50 hover:border-purple-300 transition-colors flex items-center gap-1 font-bold text-xs cursor-pointer shadow-3xs"
                          title="Receive Advance Payment for this member"
                        >
                          <HandCoins className="w-3.5 h-3.5 text-purple-600" />
                          <span>Advance</span>
                        </button>

                        <button
                          onClick={() => onTriggerInvoice?.(m)}
                          className="p-1 px-2 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 hover:border-indigo-350 transition-colors flex items-center gap-1 font-semibold text-xs cursor-pointer"
                          title="Generate & Customize Invoice"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Invoice
                        </button>

                        <button
                          onClick={() => setSelectedBadgeMember(m)}
                          className="p-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-950 hover:bg-slate-50 hover:border-slate-350 transition-colors flex items-center gap-1 font-semibold text-xs"
                          title="Generate QR Badge"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          Badge
                        </button>

                        <button
                          onClick={() => handleTogglePause(m)}
                          className={`p-1.5 rounded-lg border transition-all ${
                            m.status === 'Paused'
                              ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                              : 'border-slate-200 text-slate-500 hover:text-slate-950 hover:bg-slate-50'
                          }`}
                          title={m.status === 'Paused' ? 'Resume Membership' : 'Pause Membership'}
                        >
                          {m.status === 'Paused' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={() => handleQuickRenew(m)}
                          className="p-1.5 rounded-lg border border-slate-200 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 hover:border-emerald-250 transition-all"
                          title="Quick Renew Entry Pass"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            if (confirm(`Remove custom profile of ${m.name} permanently?`)) {
                              onDeleteMember(m.id);
                            }
                          }}
                          className="p-1.5 rounded-lg border border-slate-200 text-rose-500 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-250 transition-all"
                          title="Delete Member Profile"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                      </div>
                    </td>

                  </tr>
                );
              })}

              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 font-sans space-y-2">
                    <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-semibold text-slate-500">No member profiles found matching criteria.</p>
                    <p className="text-xs text-slate-400">Try adjusting your active status filter toggles.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedBadgeMember && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <style>{`
              
              .print-card-wrapper {
                margin: 20mm auto !important;
                width: 326px !important; 
                height: 206px !important;
                border: 3px double #0f172a !important;
                border-radius: 12px !important;
                padding: 14px !important;
                font-family: "Inter", system-ui, -apple-system, sans-serif !important;
                background-color: #f8fafc !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
              }
              
              .print-badge-header {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                border-bottom: 2px solid #0f172a !important;
                padding-bottom: 4px !important;
              }
              
              .print-badge-header .title {
                font-size: 14px !important;
                font-weight: 900 !important;
                color: #0f172a !important;
                margin: 0 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.05em !important;
              }
              
              .print-badge-header .subtitle {
                font-size: 8px !important;
                font-weight: 800 !important;
                color: #ffffff !important;
                background-color: #0f172a !important;
                padding: 2px 6px !important;
                border-radius: 9999px !important;
                text-transform: uppercase !important;
                letter-spacing: 0.05em !important;
              }
              
              .print-badge-body {
                display: flex !important;
                gap: 12px !important;
                align-items: center !important;
                margin: 8px 0 !important;
              }
              
              .print-badge-qr {
                background: white !important;
                border: 1px solid #cbd5e1 !important;
                border-radius: 8px !important;
                padding: 4px !important;
                width: 80px !important;
                height: 80px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
              }
              
              .print-badge-info {
                text-align: left !important;
              }

              .print-badge-info h3 {
                font-size: 13px !important;
                font-weight: 800 !important;
                color: #0f172a !important;
                margin: 0 0 2px 0 !important;
              }
              
              .print-badge-info .member-id {
                font-family: monospace !important;
                font-size: 9px !important;
                font-weight: 700 !important;
                color: #0284c7 !important;
                margin: 0 0 4px 0 !important;
              }
              
              .print-badge-info .detail {
                font-size: 8px !important;
                margin: 1px 0 !important;
                color: #475569 !important;
                font-weight: 600 !important;
              }
              
              .print-badge-footer {
                font-size: 8px !important;
                text-align: center !important;
                color: #64748b !important;
                font-weight: 700 !important;
                border-top: 1px dashed #cbd5e1 !important;
                padding-top: 4px !important;
              }
          `}</style>

          <div className="bg-white border border-slate-100 rounded-3xl w-full max-w-sm p-6 shadow-xl relative animate-scale-up">
            
            <button
              onClick={() => setSelectedBadgeMember(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-4 pt-2">
              <div className="inline-block p-1 bg-sky-50 text-sky-650 text-xs px-3 py-1 rounded-full font-mono font-bold">
                MEMBER DIGITAL BADGE
              </div>
              
              {selectedBadgeMember.photoUrl ? (
                <div className="w-20 h-20 rounded-full border-2 border-sky-400 shadow-md overflow-hidden mx-auto bg-slate-100">
                  <img src={selectedBadgeMember.photoUrl} alt={selectedBadgeMember.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full border-2 border-slate-200 shadow-sm overflow-hidden mx-auto bg-slate-100 flex items-center justify-center text-slate-400">
                  <Camera className="w-8 h-8 opacity-40" />
                </div>
              )}
              
              <div>
                <h3 className="font-sans font-extrabold text-slate-900 text-xl">{selectedBadgeMember.name}</h3>
                <p className="font-mono text-xs text-slate-400 mt-0.5">{selectedBadgeMember.id}</p>
                <div className="mt-2 flex justify-center">
                  {selectedBadgeMember.totalCheckIns >= 20 ? (
                    <span className="text-[10px] inline-flex items-center gap-1 font-sans leading-none bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25 px-2.5 py-1 rounded-full font-black shadow-3xs" title="Gold Member Badge: 20+ Check-ins">
                      <Trophy className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>GOLD MEMBER</span>
                    </span>
                  ) : selectedBadgeMember.totalCheckIns >= 10 ? (
                    <span className="text-[10px] inline-flex items-center gap-1 font-sans leading-none bg-slate-450/15 text-slate-600 dark:text-slate-300 border border-slate-300/20 px-2.5 py-1 rounded-full font-black shadow-3xs" title="Silver Member Badge: 10-19 Check-ins">
                      <Award className="w-3 h-3 text-slate-500 shrink-0" />
                      <span>SILVER MEMBER</span>
                    </span>
                  ) : selectedBadgeMember.totalCheckIns >= 1 ? (
                    <span className="text-[10px] inline-flex items-center gap-1 font-sans leading-none bg-amber-700/15 text-amber-800 dark:text-amber-400 border border-amber-600/20 px-2.5 py-1 rounded-full font-black shadow-3xs" title="Bronze Member Badge: 1-9 Check-ins">
                      <Award className="w-3 h-3 text-amber-700 shrink-0" />
                      <span>BRONZE MEMBER</span>
                    </span>
                  ) : (
                    <span className="text-[10px] inline-flex items-center gap-1 font-sans leading-none bg-slate-100 text-slate-400 border border-slate-250 px-2.5 py-1 rounded-full font-bold">
                      <span>NEWBIE MEMBER</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl inline-block max-w-[200px] border border-slate-100 flex items-center justify-center mx-auto shadow-inner">
                <div 
                  dangerouslySetInnerHTML={{ __html: generateQrSvg(selectedBadgeMember.id, 160) }}
                  className="w-40 h-40"
                />
              </div>

              <div className="space-y-1 text-xs text-slate-500 max-w-xs mx-auto pb-2">
                <div className="flex justify-center items-center gap-3 text-slate-800 font-semibold flex-wrap">
                  <p>Plan: <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-black">{selectedBadgeMember.plan}</span></p>
                  {selectedBadgeMember.phone && (
                    <p>Phone: <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-bold font-mono">{selectedBadgeMember.phone}</span></p>
                  )}
                  {selectedBadgeMember.alternatePhone && (
                    <p>Alt: <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-bold font-mono">{selectedBadgeMember.alternatePhone}</span></p>
                  )}
                  {selectedBadgeMember.gender && (
                    <p>Gender: <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-black">{selectedBadgeMember.gender}</span></p>
                  )}
                  {selectedBadgeMember.autoRenew && (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded font-bold text-[10px] inline-flex items-center gap-1">✓ Auto-Renew</span>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed mt-2 text-slate-400">Scan verification ID at front-gate camera to log daily entrance check-in.</p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-2">
                <button
                  onClick={() => printElement(document.getElementById('printable-card-area')!, `${selectedBadgeMember.name} — Member Card`)}
                  className="flex-1 bg-sky-500 hover:bg-sky-600 text-black font-bold py-2.5 rounded-xl font-sans text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  Print Check-In Card
                </button>
                <button
                  onClick={() => setSelectedBadgeMember(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl font-sans text-xs transition-colors"
                >
                  Close
                </button>
              </div>

            </div>

            <div id="printable-card-area" className="hidden">
              <div className="print-card-wrapper">
                <div className="print-badge-header">
                  <h2 className="title">{brand.name}</h2>
                  <span className="subtitle">MEMBER CARD</span>
                </div>
                
                <div className="print-badge-body">
                  <div className="print-badge-qr">
                    <div 
                      dangerouslySetInnerHTML={{ __html: generateQrSvg(selectedBadgeMember.id, 110) }} 
                      style={{ width: '70px', height: '70px' }}
                    />
                  </div>
                  <div className="print-badge-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      {selectedBadgeMember.photoUrl && (
                        <img 
                          src={selectedBadgeMember.photoUrl} 
                          alt=""
                          style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #0f172a', display: 'inline-block' }} 
                        />
                      )}
                      <h3 style={{ margin: 0 }}>{selectedBadgeMember.name}</h3>
                    </div>
                    <p className="member-id">ID: {selectedBadgeMember.id}</p>
                    <p className="detail">Phone: {selectedBadgeMember.phone}</p>
                    {selectedBadgeMember.alternatePhone && <p className="detail">Alt Phone: {selectedBadgeMember.alternatePhone}</p>}
                    <p className="detail">Plan: {selectedBadgeMember.plan}</p>
                    <p className="detail">Shift: {selectedBadgeMember.shiftTiming || 'Morning'} Slot</p>
                    {selectedBadgeMember.gender && <p className="detail">Gender: {selectedBadgeMember.gender}</p>}
                    <p className="detail">Issued: {formatDateDDMMYYYY(selectedBadgeMember.joinDate)}</p>
                    <p className="detail">Expires: {formatDateDDMMYYYY(selectedBadgeMember.expiryDate)}</p>
                    {selectedBadgeMember.autoRenew && <p className="detail" style={{ color: '#16a34a', fontWeight: 'bold' }}>✓ Auto-Renew Enabled</p>}
                  </div>
                </div>
                
                <div className="print-badge-footer">
                  SCAN CODE AT THE ENTRANCE CHECK-IN CAMERAS
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {showAdvanceModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in" id="advance-payment-modal">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl p-6 shadow-2xl relative my-8 animate-scale-up">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
                  <HandCoins className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 font-sans">Receive Advance Payment</h2>
                  <p className="text-xs text-slate-500 font-sans">Record pre-payments, renewal fees, or security deposits</p>
                </div>
              </div>
              <button
                onClick={() => setShowAdvanceModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProcessAdvancePayment} className="space-y-4 pt-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Member <span className="text-rose-500">*</span>
                </label>
                <select
                  value={advanceMemberId}
                  onChange={(e) => {
                    setAdvanceMemberId(e.target.value);
                    const selectedM = members.find(m => m.id === e.target.value);
                    if (selectedM) {
                      const foundPlan = plans.find(p => p.name.toLowerCase() === selectedM.plan.toLowerCase());
                      if (foundPlan) setAdvanceAmount(String(foundPlan.price));
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                  required
                >
                  <option value="" disabled>-- Select a Member --</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} [ID: {m.id}] - {m.plan} (Expires: {formatDateDDMMYYYY(m.expiryDate)})
                    </option>
                  ))}
                </select>
              </div>

              {(() => {
                const sel = members.find(m => m.id === advanceMemberId);
                if (!sel) return null;
                const daysRem = calculateDaysRemaining(sel.expiryDate);
                return (
                  <div className="bg-purple-50/60 border border-purple-150 rounded-2xl p-3.5 text-xs text-purple-950 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-sm">{sel.name}</span>
                        <span className="font-mono text-[10px] bg-purple-200 text-purple-900 px-1.5 py-0.5 rounded font-bold">{sel.id}</span>
                        <span className="text-[10px] bg-white border border-purple-200 text-purple-800 px-1.5 py-0.5 rounded font-bold">
                          {sel.shiftTiming || 'Morning'} Shift
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        sel.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {sel.status} ({daysRem} days left)
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-purple-900 pt-1 border-t border-purple-200/50">
                      <span>Current Plan: <strong>{sel.plan}</strong></span>
                      <span>Expiry Date: <strong>{formatDateDDMMYYYY(sel.expiryDate)}</strong></span>
                      <span>Existing Advance Balance: <strong className="text-purple-700 font-mono">{currency}{sel.advanceBalance || 0}</strong></span>
                    </div>
                  </div>
                );
              })()}

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Advance Payment Amount ({currency}) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-purple-700 font-semibold">Quick Presets:</span>
                </div>
                
                <div className="relative mb-2">
                  <span className="absolute left-3.5 top-2.5 text-slate-500 font-bold text-sm">{currency}</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(e.target.value)}
                    placeholder="Enter amount (e.g. 1500)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3.5 py-2.5 text-slate-950 font-extrabold text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-mono"
                    required
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[500, 1000, 2000, 3000, 5000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAdvanceAmount(String(amt))}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-purple-100 hover:text-purple-900 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-700 transition-colors cursor-pointer"
                    >
                      +{currency}{amt}
                    </button>
                  ))}
                  {(() => {
                    const sel = members.find(m => m.id === advanceMemberId);
                    const foundPlan = plans.find(p => p.name.toLowerCase() === sel?.plan.toLowerCase());
                    if (foundPlan) {
                      return (
                        <button
                          type="button"
                          onClick={() => setAdvanceAmount(String(foundPlan.price))}
                          className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 border border-purple-300 rounded-lg text-xs font-sans font-extrabold text-purple-900 transition-colors cursor-pointer"
                        >
                          Plan Price ({currency}{foundPlan.price})
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Payment Mode <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={advanceMode}
                    onChange={(e: any) => setAdvanceMode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                  >
                    <option value="UPI">📱 UPI / QR Code</option>
                    <option value="Cash">💵 Cash</option>
                    <option value="Credit/Debit Card">💳 Credit / Debit Card</option>
                    <option value="Net Banking">🏦 Net Banking</option>
                    <option value="Cheque">📄 Cheque</option>
                    <option value="Bank Transfer">🏛️ Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Advance Category / Purpose
                  </label>
                  <select
                    value={advancePurpose}
                    onChange={(e) => setAdvancePurpose(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                  >
                    <option value="Next Month Subscription Renewal">Next Month Subscription Renewal</option>
                    <option value="Multi-Month Pre-payment">Multi-Month Pre-payment</option>
                    <option value="Personal Training Advance Deposit">Personal Training Advance Deposit</option>
                    <option value="Locker & Facility Deposit">Locker & Facility Deposit</option>
                    <option value="General Advance Credit">General Advance Credit</option>
                    <option value="Security Deposit">Security Deposit</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={advanceExtendExpiry}
                    onChange={(e) => setAdvanceExtendExpiry(e.target.checked)}
                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-4 w-4 cursor-pointer"
                  />
                  <span className="text-xs font-extrabold text-slate-900 font-sans">
                    Extend Membership Expiry Date Immediately
                  </span>
                </label>

                {advanceExtendExpiry && (
                  <div className="pt-2 border-t border-slate-200/70 space-y-2 text-xs">
                    <span className="text-[11px] text-slate-500 font-semibold block">Select Extension Duration:</span>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { days: 30, label: '+1 Month' },
                        { days: 90, label: '+3 Months' },
                        { days: 180, label: '+6 Months' },
                        { days: 365, label: '+1 Year' },
                      ].map(opt => (
                        <button
                          key={opt.days}
                          type="button"
                          onClick={() => setAdvanceExtensionDays(opt.days)}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            advanceExtensionDays === opt.days
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {(() => {
                      const sel = members.find(m => m.id === advanceMemberId);
                      if (!sel) return null;
                      const curExp = parseDate(sel.expiryDate) || new Date();
                      const baseDate = curExp > new Date() ? curExp : new Date();
                      const newExp = new Date(baseDate.getTime() + advanceExtensionDays * 24 * 60 * 60 * 1000);
                      return (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-emerald-900 text-xs flex items-center justify-between font-sans">
                          <div>
                            <span className="text-slate-500">Current Expiry: </span>
                            <strong className="text-slate-800">{formatDateDDMMYYYY(sel.expiryDate)}</strong>
                          </div>
                          <span className="font-extrabold text-emerald-700">➔</span>
                          <div>
                            <span className="text-emerald-700 font-bold">New Extended Expiry: </span>
                            <strong className="text-emerald-950 font-mono text-xs bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                              {formatDateDDMMYYYY(formatDateISO(newExp))}
                            </strong>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Reference / Transaction ID
                  </label>
                  <input
                    type="text"
                    value={advanceRefNo}
                    onChange={(e) => setAdvanceRefNo(e.target.value)}
                    placeholder="e.g. UPI-9842109 / Cheque #004"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Staff Remarks / Internal Notes
                  </label>
                  <input
                    type="text"
                    value={advanceNotes}
                    onChange={(e) => setAdvanceNotes(e.target.value)}
                    placeholder="e.g. Paid in advance by cash"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                  />
                </div>
              </div>

              {advanceFeedback && (
                <div className="bg-emerald-500 text-black p-4 rounded-2xl text-xs space-y-2 animate-fade-in shadow-md">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-black shrink-0" />
                    <span>{advanceFeedback.message}</span>
                  </div>
                  <p className="text-xs text-black/80">
                    The member's advance payment record and updated credit balance have been synchronized to Firestore.
                  </p>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAdvanceModal(false);
                        setShowReceiptModal(true);
                      }}
                      className="bg-black hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Print Advance Payment Receipt</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAdvanceModal(false)}
                      className="bg-black/10 hover:bg-black/20 text-black font-semibold px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Done & Close
                    </button>
                  </div>
                </div>
              )}

              {!advanceFeedback && (
                <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAdvanceModal(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Wallet className="w-4 h-4 text-purple-200" />
                    <span>Confirm Advance Payment</span>
                  </button>
                </div>
              )}

            </form>

          </div>
        </div>
      )}

      {showReceiptModal && activeReceipt && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in" id="advance-receipt-modal">
          

          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative animate-scale-up">
            
            <button
              onClick={() => setShowReceiptModal(false)}
              className="absolute right-5 top-5 text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div id="printable-advance-receipt" className="space-y-4 pt-1">
              
              <div className="text-center pb-3 border-b-2 border-slate-900">
                <h2 className="font-extrabold text-2xl tracking-tight text-slate-900 uppercase font-sans">{brand.name}</h2>
                <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Official Advance Payment Receipt</p>
                <div className="mt-1.5 inline-block bg-purple-100 text-purple-900 font-mono text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-purple-200">
                  RECEIPT NO: {activeReceipt.receiptNo}
                </div>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-500 font-mono border-b border-slate-100 pb-2">
                <span>Date: <strong>{new Date(activeReceipt.date).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}</strong></span>
                <span>Time: <strong>{new Date(activeReceipt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1 text-xs">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Member Details</p>
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-slate-900 text-sm">{activeReceipt.memberName}</span>
                  <span className="font-mono text-xs font-bold text-sky-700">ID: {activeReceipt.memberId}</span>
                </div>
                <p className="text-slate-600">Phone: <strong className="font-mono text-slate-900">{activeReceipt.memberPhone}</strong></p>
                <p className="text-slate-600">Current Subscription: <strong>{activeReceipt.memberPlan}</strong></p>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Description</th>
                      <th className="py-2 px-3 text-right">Details / Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    <tr>
                      <td className="py-2.5 px-3 font-semibold">Advance Payment Amount</td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-purple-900 text-sm">
                        {activeReceipt.currencySymbol}{activeReceipt.amount?.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-slate-600">Payment Method</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">{activeReceipt.paymentMode}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-slate-600">Purpose / Category</td>
                      <td className="py-2 px-3 text-right font-medium text-slate-800">{activeReceipt.purpose}</td>
                    </tr>
                    {activeReceipt.referenceNo && (
                      <tr>
                        <td className="py-2 px-3 text-slate-600">Ref / Txn ID</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{activeReceipt.referenceNo}</td>
                      </tr>
                    )}
                    {activeReceipt.extendedExpiryDate && (
                      <tr>
                        <td className="py-2 px-3 text-emerald-800 font-bold">New Extended Expiry</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-900">
                          {formatDateDDMMYYYY(activeReceipt.extendedExpiryDate)}
                        </td>
                      </tr>
                    )}
                    <tr className="bg-purple-50/80 font-bold">
                      <td className="py-2.5 px-3 text-purple-950 font-sans">Total Member Advance Credit</td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-purple-950 text-sm">
                        {activeReceipt.currencySymbol}{activeReceipt.totalAdvanceBalance?.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {activeReceipt.notes && (
                <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700">Remarks:</span> {activeReceipt.notes}
                </div>
              )}

              <div className="pt-6 border-t border-slate-200 flex justify-between items-end text-[10px] text-slate-400 font-sans">
                <div>
                  <p className="font-bold text-slate-700">{brand.name} Front Office</p>
                  <p>Computer Generated Digital Receipt</p>
                </div>
                <div className="text-right">
                  <div className="border-b border-slate-300 w-28 mb-1"></div>
                  <p className="font-bold text-slate-700">Authorized Signature</p>
                </div>
              </div>

            </div>

            <div className="pt-5 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => printElement(document.getElementById('printable-advance-receipt')!, activeReceipt.receiptNo)}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-extrabold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print</span>
              </button>
              <button
                disabled={!!busy}
                onClick={async () => {
                  setBusy('pdf');
                  await downloadPdf(document.getElementById('printable-advance-receipt')!, `${activeReceipt.receiptNo}.pdf`).finally(() => setBusy(null));
                }}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {busy === 'pdf' ? '…' : 'PDF'}
              </button>
              {activeReceipt.memberEmail && (
                <button
                  disabled={!!busy}
                  onClick={async () => {
                    setBusy('email');
                    const content = await pdfBase64(document.getElementById('printable-advance-receipt')!);
                    await sendEmail(activeReceipt.memberEmail, `Payment receipt ${activeReceipt.receiptNo} — ${brand.name}`, receiptText(activeReceipt), [{ filename: `${activeReceipt.receiptNo}.pdf`, content }]).finally(() => setBusy(null));
                  }}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {busy === 'email' ? '…' : 'Email'}
                </button>
              )}
              {activeReceipt.memberPhone && (
                <button
                  onClick={() => sendSms(activeReceipt.memberPhone, receiptText(activeReceipt))}
                  className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-black font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  SMS
                </button>
              )}
              {activeReceipt.memberPhone && (
                <a
                  href={whatsappUrl(activeReceipt.memberPhone, receiptText(activeReceipt), brand.countryCode)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  title="Share receipt summary via WhatsApp"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              )}
              <button
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {showAdvanceHistoryModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in" id="advance-history-modal">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl p-6 shadow-2xl relative my-8 animate-scale-up">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 font-sans">Advance Payment Receipts History</h2>
                  <p className="text-xs text-slate-500 font-sans">All advance fees, renewals, and security deposits recorded in database</p>
                </div>
              </div>
              <button
                onClick={() => setShowAdvanceHistoryModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const allAdvanceRecords: { member: Member; record: AdvancePaymentRecord }[] = [];
              members.forEach(m => {
                if (m.advancePayments && m.advancePayments.length > 0) {
                  m.advancePayments.forEach(rec => {
                    allAdvanceRecords.push({ member: m, record: rec });
                  });
                }
              });

              allAdvanceRecords.sort((a, b) => new Date(b.record.date).getTime() - new Date(a.record.date).getTime());

              const totalCollected = allAdvanceRecords.reduce((sum, item) => sum + item.record.amount, 0);

              return (
                <div className="space-y-4 pt-4">
                  
                  <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-md">
                    <div>
                      <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider block">Total Advance Collected</span>
                      <span className="text-2xl font-black font-mono text-purple-200">{currency}{totalCollected.toLocaleString()}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-purple-200 font-semibold block">{allAdvanceRecords.length} Advance Receipts Recorded</span>
                      <button
                        onClick={() => handleOpenAdvanceModal()}
                        className="mt-1 text-xs bg-white text-purple-950 font-extrabold px-3 py-1.5 rounded-xl hover:bg-purple-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New Advance Payment</span>
                      </button>
                    </div>
                  </div>

                  {allAdvanceRecords.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                      <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-2 opacity-50" />
                      <p className="font-extrabold text-slate-700 text-sm">No advance payment records found</p>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                        Use the "Receive Advance" button to record pre-payments or advance subscription renewals for any member.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-96 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4">Receipt # / Date</th>
                            <th className="py-3 px-4">Member Name</th>
                            <th className="py-3 px-4">Amount</th>
                            <th className="py-3 px-4">Mode</th>
                            <th className="py-3 px-4">Purpose</th>
                            <th className="py-3 px-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800">
                          {allAdvanceRecords.map(({ member: m, record: rec }) => (
                            <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-4 font-mono font-bold text-slate-900">
                                <div>{rec.receiptNo || 'ADV-RECEIPT'}</div>
                                <div className="text-[10px] font-normal text-slate-400">
                                  {new Date(rec.date).toLocaleDateString()}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-extrabold text-slate-900">{m.name}</div>
                                <div className="text-[10px] font-mono text-slate-400">ID: {m.id}</div>
                              </td>
                              <td className="py-3 px-4 font-mono font-black text-purple-900 text-sm">
                                {currency}{rec.amount.toLocaleString()}
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-700">
                                <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                                  {rec.paymentMode}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-medium text-slate-600 max-w-xs truncate">
                                {rec.purpose}
                                {rec.referenceNo && (
                                  <span className="block text-[10px] text-slate-400 font-mono">Ref: {rec.referenceNo}</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveReceipt({
                                      ...rec,
                                      memberName: m.name,
                                      memberPhone: m.phone,
                                      memberEmail: m.email,
                                      memberId: m.id,
                                      memberPlan: m.plan,
                                      memberCurrentExpiry: m.expiryDate,
                                      memberNewExpiry: rec.extendedExpiryDate || m.expiryDate,
                                      totalAdvanceBalance: m.advanceBalance || rec.amount,
                                      currencySymbol: currency,
                                    });
                                    setShowAdvanceHistoryModal(false);
                                    setShowReceiptModal(true);
                                  }}
                                  className="px-2.5 py-1 bg-purple-50 border border-purple-200 text-purple-800 hover:bg-purple-100 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Printer className="w-3 h-3" />
                                  <span>Receipt</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-100 text-right">
                    <button
                      onClick={() => setShowAdvanceHistoryModal(false)}
                      className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                    >
                      Close History
                    </button>
                  </div>

                </div>
              );
            })()}

          </div>
        </div>
      )}

    </div>
  );
}
