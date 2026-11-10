import { useState, useEffect, useMemo } from 'react';
import { Member, MembershipPlan } from '../types';
import { generateQrSvg } from '../utils/qrGenerator';
import { parseDate, formatDateDDMMYYYY, calculateExpiryDate, todayISO } from '../utils/dateUtils';
import { BrandLogo } from './BrandLogo';
import { useBrand, brandDb } from '../lib/brand';
import { sendEmail, sendSms } from '../lib/messaging';
import { printElement, downloadPdf, viewPdf, pdfBase64 } from '../utils/print';
import { whatsappUrl } from '../utils/common';
import { 
  X, 
  Trash2, 
  Printer, 
  Send, 
  Check, 
  CreditCard, 
  FileText, 
  PlusCircle, 
  Mail, 
  CheckCircle2,
  Building,
  Briefcase,
  Upload
} from 'lucide-react';

export function numberToWords(num: number, currency = '₹'): string {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertLessThanOneThousand = (n: number): string => {
    if (n < 20) return a[n];
    const digit = n % 10;
    if (n < 100) return b[Math.floor(n / 10)] + (digit ? ' ' + a[digit] : '');
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    return a[hundred] + ' Hundred' + (rest ? ' and ' + convertLessThanOneThousand(rest) : '');
  };

  const [major, minor] = currency === '₹' ? ['Rupees', 'Paise'] : ['', 'Cents'];
  const words = (n: number) => {
    let result = '';
    const lakhs = Math.floor(n / 100000);
    const thousands = Math.floor((n % 100000) / 1000);
    const rest = n % 1000;
    if (lakhs) result += convertLessThanOneThousand(lakhs) + ' Lakh ';
    if (thousands) result += convertLessThanOneThousand(thousands) + ' Thousand ';
    if (rest) result += convertLessThanOneThousand(rest);
    return result.trim() || 'Zero';
  };
  const whole = Math.floor(num);
  const cents = Math.round((num - whole) * 100);
  return [words(whole), major, cents ? `and ${words(cents)} ${minor}` : '', 'Only'].filter(Boolean).join(' ');
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
}

export interface InvoiceData {
  invoiceNo: string;
  issueDate: string;
  dueDate: string;
  gymName: string;
  gymAddress: string;
  gymPhone: string;
  gymEmail: string;
  ownerUpiId: string;
  ownerUpiName: string;
  notes: string;
  taxRate: number; // percentage
  discount: number; // absolute amount
  items: InvoiceLineItem[];
}

interface InvoiceModalProps {
  member: Member;
  plans: MembershipPlan[];
  currency: string;
  isNewRegistration?: boolean;
  onClose: () => void;
}

export function InvoiceModal({ member, plans, currency, isNewRegistration = false, onClose }: InvoiceModalProps) {
  const brand = useBrand();
  const [isPaid, setIsPaid] = useState<boolean>(false);
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [autoPrint, setAutoPrint] = useState<boolean>(() => localStorage.getItem('gym_invoice_autoprint') === 'true');
  const sheet = () => document.getElementById('invoice-sheet')!;

  useEffect(() => {
    if (!isNewRegistration || !autoPrint) return;
    const timer = setTimeout(() => printElement(sheet(), invoiceNo), 800);
    return () => clearTimeout(timer);
  }, []);

  const gymProfile = {
    gymName: brand.name,
    gymAddress: brand.address,
    gymPhone: brand.phone,
    gymEmail: brand.email,
    ownerUpiId: brand.upiId,
    taxRate: brand.taxRate,
    notes: brand.receiptNote,
    customQrUrl: brand.paymentQrUrl,
  };

  const defaultInvoiceNo = useMemo(() => {
    return `INV-${todayISO().replace(/-/g, '')}-${member.id}-${Math.floor(100 + Math.random() * 900)}`;
  }, [member]);

  const initialLineItems = useMemo<InvoiceLineItem[]>(() => {
    const planObj = plans.find(p => p.name === member.plan);
    const price = planObj ? planObj.price : 0;
    const desc = planObj 
      ? `${planObj.name} Membership Plan (${planObj.durationDays} Days Access)`
      : `${member.plan} Membership level access Fee`;
    
    const items = [{ id: 'li-item-1', description: desc, qty: 1, unitPrice: price }];
    if (isNewRegistration) items.push({ id: 'li-item-2', description: 'One-time Enrollment Fee', qty: 1, unitPrice: 0 });
    return items;
  }, [member, plans]);

  const [invoiceNo, setInvoiceNo] = useState(defaultInvoiceNo);
  const [issueDate, setIssueDate] = useState(todayISO);
  const [dueDate, setDueDate] = useState(() => calculateExpiryDate(todayISO(), 3).expiryDateIso);

  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>(initialLineItems);
  const [taxRate, setTaxRate] = useState<number>(gymProfile.taxRate);
  const [discount, setDiscount] = useState<number>(0);
  const [ownerNotes, setOwnerNotes] = useState(gymProfile.notes);

  const [profileGymName, setProfileGymName] = useState(gymProfile.gymName);
  const [profileAddress, setProfileAddress] = useState(gymProfile.gymAddress);
  const [profilePhone, setProfilePhone] = useState(gymProfile.gymPhone);
  const [profileEmail, setProfileEmail] = useState(gymProfile.gymEmail);
  const [upiId, setUpiId] = useState(gymProfile.ownerUpiId);
  const [qrMode, setQrMode] = useState<'dynamic' | 'custom'>(gymProfile.customQrUrl ? 'custom' : 'dynamic');
  const [customQrUrl, setCustomQrUrl] = useState<string>(gymProfile.customQrUrl);

  const [activeTab, setActiveTab] = useState<'preview' | 'editor' | 'settings'>('preview');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((acc, item) => acc + (item.qty * item.unitPrice), 0);
    const taxAmount = parseFloat(((subtotal * taxRate) / 100).toFixed(2));
    const total = Math.max(0, parseFloat((subtotal + taxAmount - discount).toFixed(2)));
    return { subtotal, taxAmount, total };
  }, [lineItems, taxRate, discount]);

  const planDurationDays = useMemo(() => {
    const planObj = plans.find(p => p.name === member.plan);
    return planObj ? planObj.durationDays : 30;
  }, [member.plan, plans]);

  const monthOfRange = useMemo(() => {
    try {
      const start = parseDate(issueDate);
      const end = new Date(start);
      end.setDate(end.getDate() + planDurationDays);

      const formatOpt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
      return {
        startStr: start.toLocaleDateString('en-US', formatOpt),
        endStr: end.toLocaleDateString('en-US', formatOpt)
      };
    } catch (e) {
      return { startStr: formatDateDDMMYYYY(issueDate), endStr: formatDateDDMMYYYY(dueDate) };
    }
  }, [issueDate, dueDate, planDurationDays]);

  const invoiceSerialNo = useMemo(() => {
    const parsed = parseInt(member.id.replace(/[^0-9]/g, ''));
    if (!isNaN(parsed)) {
      return (parsed % 100 || 31).toString();
    }
    return "31"; // Default fallback like in photo
  }, [member.id]);

  const totalInWords = useMemo(() => {
    return numberToWords(totals.total, currency);
  }, [totals.total]);

  const paymentLink = useMemo(() => {
    const cleanUpi = upiId.trim();
    if (!cleanUpi) return '';
    const amountStr = totals.total.toFixed(2);
    const currencyCode = currency === '₹' ? 'INR' : currency === '€' ? 'EUR' : 'USD';
    const cleanNo = encodeURIComponent(invoiceNo);

    if (cleanUpi.startsWith('upi://')) {
      let baseUri = cleanUpi;
      if (!baseUri.includes('am=')) {
        baseUri += `&am=${amountStr}`;
      }
      if (!baseUri.includes('cu=')) {
        baseUri += `&cu=${currencyCode}`;
      }
      if (!baseUri.includes('tn=')) {
        baseUri += `&tn=Invoice%20${cleanNo}`;
      }
      return baseUri;
    }

    const cleanName = encodeURIComponent(brand.name);
    return `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${cleanName}&am=${amountStr}&cu=${currencyCode}&tn=Invoice%20${cleanNo}&mode=02`;
  }, [upiId, brand.name, totals.total, currency, invoiceNo]);

  const paymentQrSvg = useMemo(
    () => (paymentLink ? generateQrSvg(paymentLink, 180) : '<p style="font-size:9px;text-align:center;padding:4px">Set your UPI ID in Settings</p>'),
    [paymentLink]
  );

  const handleSaveSettings = async () => {
    setIsSavingProfile(true);
    await brandDb.update({
      ...brand,
      name: profileGymName,
      address: profileAddress,
      phone: profilePhone,
      email: profileEmail,
      upiId,
      taxRate,
      receiptNote: ownerNotes,
      paymentQrUrl: qrMode === 'custom' ? customQrUrl : '',
    });
    setIsSavingProfile(false);
    setActiveTab('preview');
  };

  const handleAddLineItem = () => {
    const newItem: InvoiceLineItem = {
      id: `li-item-${Date.now()}`,
      description: 'Custom Membership Addon / Service',
      qty: 1,
      unitPrice: 20
    };
    setLineItems([...lineItems, newItem]);
  };

  const handleRemoveLineItem = (id: string) => {
    if (lineItems.length <= 1) {
      alert('Your invoice must contain at least one line item section.');
      return;
    }
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const handleUpdateLineItem = (id: string, field: keyof InvoiceLineItem, value: any) => {
    const updated = lineItems.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setLineItems(updated);
  };

  const summary = `${brand.name} — Invoice ${invoiceNo}\nMember: ${member.name} (${member.id})\nPlan: ${member.plan}\nTotal: ${currency}${totals.total.toFixed(2)}${isPaid ? ' (PAID)' : ''}\n${paymentLink ? `Pay via UPI: ${upiId}\n` : ''}${ownerNotes}`;
  const pdfName = `${invoiceNo}.pdf`;

  const run = async (key: string, task: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await task();
    } finally {
      setBusy(null);
    }
  };

  const handleSendInvoice = (channel: 'WhatsApp' | 'Email' | 'SMS') => {
    if (channel === 'WhatsApp') return window.open(whatsappUrl(member.phone, summary, brand.countryCode), '_blank');
    if (channel === 'SMS') return run('sms', () => sendSms(member.phone, summary));
    if (!member.email) return alert('This member has no email address on file.');
    run('email', async () =>
      sendEmail(member.email, `Invoice ${invoiceNo} — ${brand.name}`, summary, [{ filename: pdfName, content: await pdfBase64(sheet()) }])
    );
  };

  const handlePrint = () => printElement(sheet(), invoiceNo);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 antialiased sm:p-6 select-none" id="invoice-modal-overlay">
      <div className="bg-slate-50 rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden max-h-[90vh]" id="invoice-modal-card">
        
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg border border-sky-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div className="text-left">
              <span className="text-[10px] font-mono font-bold text-sky-400 tracking-wider block uppercase">MEMBERSHIP TRANSACTION INVOICE</span>
              <h3 className="text-sm font-sans font-extrabold text-white">Bill Workspace: {member.name}</h3>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-white border-b border-slate-200 px-6 py-2 flex justify-between items-center flex-wrap gap-2 shrink-0">
          <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-4 py-1.5 text-xs font-sans font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'preview' ? 'bg-white text-slate-950 shadow-xs border border-slate-250/20' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
              Preview &amp; Send
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`px-4 py-1.5 text-xs font-sans font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'editor' ? 'bg-white text-slate-950 shadow-xs border border-slate-250/20' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
              Add/Edit Sections
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-1.5 text-xs font-sans font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'settings' ? 'bg-white text-slate-950 shadow-xs border border-slate-250/20' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Building className="w-3.5 h-3.5 text-slate-600" />
              Gym Billing Profile
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPaid(!isPaid)}
              className={`px-3.5 py-1.5 text-xs font-sans font-extrabold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-all border ${
                isPaid 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100' 
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-700 shadow-sm'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 shrink-0" />
              {isPaid ? 'Mark Unpaid' : 'Mark PAID'}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              id="btn-print-invoice"
              className="px-3.5 py-1.5 text-xs font-sans font-bold rounded-xl text-slate-700 bg-white border border-slate-250 hover:bg-slate-50 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button type="button" disabled={!!busy || activeTab !== 'preview'} onClick={() => run('pdf', () => downloadPdf(sheet(), pdfName))} className="px-3.5 py-1.5 text-xs font-sans font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-slate-700 bg-white border border-slate-250 hover:bg-slate-50">
              <FileText className="w-3.5 h-3.5" />
              {busy === 'pdf' ? 'Preparing…' : 'PDF'}
            </button>
            <button type="button" disabled={!!busy || activeTab !== 'preview'} onClick={() => run('view', () => viewPdf(sheet()))} className="px-3.5 py-1.5 text-xs font-sans font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-slate-700 bg-white border border-slate-250 hover:bg-slate-50">
              View PDF
            </button>
            <button type="button" onClick={() => handleSendInvoice('WhatsApp')} className="px-3.5 py-1.5 text-xs font-sans font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-white bg-emerald-600 hover:bg-emerald-500">
              <Send className="w-3.5 h-3.5" />
              WhatsApp
            </button>
            <button type="button" disabled={!!busy} onClick={() => handleSendInvoice('SMS')} className="px-3.5 py-1.5 text-xs font-sans font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-black bg-sky-500 hover:bg-sky-400">
              {busy === 'sms' ? 'Sending…' : 'SMS'}
            </button>
            <button type="button" disabled={!!busy || activeTab !== 'preview'} onClick={() => handleSendInvoice('Email')} className="px-3.5 py-1.5 text-xs font-sans font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-white bg-indigo-600 hover:bg-indigo-500">
              <Mail className="w-3.5 h-3.5" />
              {busy === 'email' ? 'Sending…' : 'Email PDF'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
          
          {activeTab === 'preview' && (
            <div className="max-w-3xl mx-auto space-y-5">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden" id="quick-print-banner">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-xs font-bold text-slate-900">Print Offline Receipt</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Generate a physical paper invoice copy for this member immediately.</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                  <label className="flex items-center gap-2 cursor-pointer select-none" id="toggle-auto-print-container">
                    <span className="text-[10px] sm:text-xs font-sans font-semibold text-slate-500 uppercase tracking-wide">Auto-Print</span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={autoPrint}
                        onChange={(e) => {
                          setAutoPrint(e.target.checked);
                          localStorage.setItem('gym_invoice_autoprint', String(e.target.checked));
                        }}
                        className="sr-only peer"
                        id="auto-print-toggle-input"
                      />
                      <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                    </div>
                  </label>

                  <button
                    type="button"
                    onClick={handlePrint}
                    className="bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-black font-sans font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    id="btn-print-invoice-inline"
                  >
                    <Printer className="w-4 h-4" />
                    Print Now
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 font-sans text-left relative overflow-hidden select-none w-full max-w-[210mm] mx-auto shadow-xs" id="invoice-sheet">
                
                <div className="flex flex-row justify-between items-start border-b border-slate-100 pb-4 mb-4">
                  <div className="flex items-start gap-4">
                    <BrandLogo size={64} className="shrink-0" />
                    <div>
                      <h1 className="font-extrabold text-slate-900 leading-tight uppercase" style={{ fontSize: '28px' }}>
                        {gymProfile.gymName}
                      </h1>
                      <div className="text-slate-500 mt-1 space-y-0.5" style={{ fontSize: '11px' }}>
                        <p>{gymProfile.gymAddress}</p>
                        <p>Phone: {gymProfile.gymPhone} | Email: {gymProfile.gymEmail}</p>
                        <p>{[brand.gstin && `GSTIN: ${brand.gstin}`, brand.website && `Website: ${brand.website}`].filter(Boolean).join(' | ')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <h2 className="font-bold text-[#0B2545] tracking-tight uppercase" style={{ fontSize: '22px' }}>
                      MEMBERSHIP INVOICE
                    </h2>
                    <div className="text-slate-500 mt-2 space-y-1 font-mono" style={{ fontSize: '11px' }}>
                      <p>Invoice No: <strong className="text-slate-800">{invoiceNo}</strong></p>
                      <p>Invoice Date: <strong className="text-slate-800">{issueDate}</strong></p>
                      <p>Receipt Number: <strong className="text-slate-800">REC-{invoiceSerialNo}</strong></p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                    <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-700 tracking-wide uppercase" style={{ fontSize: '15px' }}>
                        MEMBER DETAILS
                      </h3>
                    </div>
                    <div className="p-3 space-y-1.5 text-slate-600 flex-grow" style={{ fontSize: '11px' }}>
                      <p className="flex justify-between border-b border-slate-50 pb-1">
                        <span className="text-slate-400">Member Name:</span>
                        <strong className="text-slate-900">{member.name}</strong>
                      </p>
                      <p className="flex justify-between border-b border-slate-50 pb-1">
                        <span className="text-slate-400">Member ID:</span>
                        <strong className="text-slate-900 font-mono">{member.id}</strong>
                      </p>
                      <p className="flex justify-between border-b border-slate-50 pb-1">
                        <span className="text-slate-400">Phone Number:</span>
                        <strong className="text-slate-900 font-mono">{member.phone || '8178587436'}</strong>
                      </p>
                      {member.alternatePhone && (
                        <p className="flex justify-between border-b border-slate-50 pb-1">
                          <span className="text-slate-400">Alt Phone Number:</span>
                          <strong className="text-slate-900 font-mono">{member.alternatePhone}</strong>
                        </p>
                      )}
                      <p className="flex justify-between border-b border-slate-50 pb-1">
                        <span className="text-slate-400">Email Address:</span>
                        <strong className="text-slate-900 select-all font-mono">{member.email || '—'}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                    <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-700 tracking-wide uppercase" style={{ fontSize: '15px' }}>
                        MEMBERSHIP DETAILS
                      </h3>
                    </div>
                    <div className="p-3 space-y-1.5 text-slate-600 flex-grow" style={{ fontSize: '11px' }}>
                      <p className="flex justify-between border-b border-slate-50 pb-1">
                        <span className="text-slate-400">Membership Package:</span>
                        <strong className="text-slate-900">{member.plan}</strong>
                      </p>
                      <p className="flex justify-between border-b border-slate-50 pb-1">
                        <span className="text-slate-400">Start Date:</span>
                        <strong className="text-slate-900 font-mono">{monthOfRange.startStr}</strong>
                      </p>
                      <p className="flex justify-between border-b border-slate-50 pb-1">
                        <span className="text-slate-400">End Date / Duration:</span>
                        <strong className="text-slate-900 font-mono">{monthOfRange.endStr} ({planDurationDays} Days)</strong>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-slate-400">Batch / Status:</span>
                        <span className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                          <strong className="text-slate-900">{member.shiftTiming || 'Morning'} / {member.status}</strong>
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden mb-4">
                  <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200">
                    <h3 className="font-bold text-slate-700 tracking-wide uppercase" style={{ fontSize: '15px' }}>
                      PAYMENT SECTIONS &amp; LINE ITEMS
                    </h3>
                  </div>
                  <table className="w-full text-left" style={{ fontSize: '10.5px' }}>
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 uppercase tracking-wider font-extrabold text-[9px]">
                        <th className="px-4 py-2">Section Line/Description</th>
                        <th className="px-4 py-2 text-center w-20">Qty</th>
                        <th className="px-4 py-2 text-right w-28">Unit Cost</th>
                        <th className="px-4 py-2 text-right w-32">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {lineItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/30">
                          <td className="px-4 py-2.5 font-medium text-slate-900">{item.description}</td>
                          <td className="px-4 py-2.5 text-center font-mono">{item.qty}</td>
                          <td className="px-4 py-2.5 text-right font-mono">{currency}{item.unitPrice.toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-right font-black text-slate-900 font-mono">{currency}{(item.qty * item.unitPrice).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start mb-4">
                  
                  <div className="md:col-span-7 border border-slate-200 rounded-xl p-3 bg-slate-50/50 flex gap-4">
                    <div className="bg-white p-2 rounded-lg border border-slate-200 flex-shrink-0 flex items-center justify-center h-20 w-20 overflow-hidden select-none">
                      {qrMode === 'custom' && customQrUrl ? (
                        <img src={customQrUrl} alt="Custom Payment QR" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        <div dangerouslySetInnerHTML={{ __html: paymentQrSvg }} className="w-full h-full text-slate-950" />
                      )}
                    </div>
                    <div className="text-left flex flex-col justify-center text-slate-600" style={{ fontSize: '11px' }}>
                      <p className="font-extrabold text-[#0B2545] uppercase tracking-wide">Direct Payment QR Code</p>
                      <p className="mt-0.5">UPI VPA: <strong className="text-indigo-600 font-mono font-bold">{upiId}</strong></p>
                      <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                        Scan with GPay, PhonePe, or Paytm to instantly settle this fee. Thank you for choosing us!
                      </p>
                    </div>
                  </div>

                  <div className="md:col-span-5 border border-slate-200 rounded-xl p-3 bg-slate-50/30 space-y-1.5 text-slate-600" style={{ fontSize: '11px' }}>
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-mono">{currency}{totals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>GST / Tax ({taxRate}%):</span>
                      <span className="font-mono">{currency}{totals.taxAmount.toFixed(2)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span>Discount Applied:</span>
                        <span className="font-mono">-{currency}{discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-b border-slate-100 pb-1 text-slate-500 text-[10px]">
                      <span>Payment Mode:</span>
                      <span className="font-bold uppercase">{isPaid ? 'UPI / CASH' : 'DUE / UNPAID'}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1">
                      <span className="uppercase text-[10px]">Grand Total:</span>
                      <span className="text-indigo-950 font-black font-mono text-sm">{currency}{totals.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 mb-4 text-slate-700" style={{ fontSize: '11px' }}>
                  <p className="leading-snug">
                    <span className="text-slate-400 uppercase font-extrabold text-[9px] block mb-0.5">Amount in Words</span>
                    <strong className="text-slate-800 font-serif italic text-xs">{totalInWords}</strong>
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border border-slate-200 rounded-xl overflow-hidden mb-4 text-center divide-y sm:divide-y-0 sm:divide-x divide-slate-200" style={{ fontSize: '11px' }}>
                  <div className="p-2 bg-slate-50/30">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Transaction ID</span>
                    <strong className="text-slate-800 font-mono font-bold">{isPaid ? `TXN${issueDate.replace(/[^0-9]/g, '')}${invoiceSerialNo}` : 'N/A'}</strong>
                  </div>
                  <div className="p-2 bg-slate-50/30">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Due Amount</span>
                    <strong className={`font-mono font-bold ${!isPaid ? 'text-rose-600 font-black' : 'text-slate-800'}`}>
                      {currency}{(!isPaid ? totals.total : 0).toFixed(2)}
                    </strong>
                  </div>
                  <div className="p-2 bg-slate-50/30">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Next Renewal Date</span>
                    <strong className="text-slate-800 font-mono font-bold">{monthOfRange.endStr}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 pt-4 pb-2 text-center" style={{ fontSize: '11px' }}>
                  <div className="flex flex-col items-center">
                    <div className="w-full max-w-[160px] h-8 border-b border-dashed border-slate-300"></div>
                    <span className="text-slate-400 uppercase font-extrabold text-[9px] tracking-wider mt-1 block">Customer Signature</span>
                  </div>
                  <div className="flex flex-col items-center relative">
                    {isPaid && (
                      <div className="absolute -top-3 select-none pointer-events-none opacity-80 rotate-3 font-serif italic font-bold text-sky-600 text-[10px] tracking-widest border border-dashed border-sky-400 rounded px-2 py-0.5 bg-white/60">
                        PAID {gymProfile.gymName.split(' ')[0]}
                      </div>
                    )}
                    <div className="w-full max-w-[160px] h-8 border-b border-dashed border-slate-300"></div>
                    <span className="text-slate-400 uppercase font-extrabold text-[9px] tracking-wider mt-1 block">Authorized Signature</span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 text-center text-slate-400" style={{ fontSize: '10px' }}>
                  <p className="italic">"{ownerNotes}"</p>
                  <p className="mt-2 text-[9px] font-mono tracking-wider uppercase text-slate-300">{brand.name} • {brand.website}</p>
                </div>

              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-center justify-between print:hidden shadow-xs" id="interactive-upi-drawer">
                <div className="flex gap-4 items-center text-left">
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex-shrink-0 h-16 w-16 flex items-center justify-center overflow-hidden">
                    {qrMode === 'custom' && customQrUrl ? (
                      <img src={customQrUrl} alt="Store QR" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <div dangerouslySetInnerHTML={{ __html: paymentQrSvg }} className="w-full h-full text-slate-900" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Direct Merchant Payment Assistant</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">VPA UPI: <strong className="text-indigo-600 font-mono font-bold">{upiId}</strong> ({brand.name})</p>
                    <p className="text-[10px] text-slate-400 mt-1">Use GPay, PhonePe, Paytm, or BHIM to pay instantly. Click copy to copy VPA.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(upiId);
                    setCopyFeedback(true);
                    setTimeout(() => setCopyFeedback(false), 2000);
                  }}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-4 py-1.5 rounded-xl font-sans font-bold text-xs cursor-pointer shadow-3xs transition-all flex items-center gap-1.5 shrink-0"
                >
                  {copyFeedback ? '✓ Copied UPI' : 'Copy Merchant UPI'}
                </button>
              </div>

            </div>
          )}

          {activeTab === 'editor' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 max-w-2xl mx-auto" id="invoice-items-editor">
              <h4 className="text-sm font-sans font-black text-slate-900 border-b pb-3 mb-4 text-left flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-sky-600" />
                Customize Bill Items &amp; Sections
              </h4>

              <p className="text-xs text-slate-500 mb-4 text-left">
                Edit items included in this enrollment cycle. You can add registration parameters, optional training packages, lockers, or credits below.
              </p>

              <div className="space-y-3 mb-6" id="line-items-editor-container">
                {lineItems.map((item, idx) => (
                  <div key={item.id} className="flex gap-2 items-center bg-slate-50 p-3 rounded-xl border border-slate-200 animate-fade-in">
                    
                    <div className="h-6 w-6 rounded-full bg-slate-200 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>

                    <div className="flex-1 text-left min-w-0">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Section Name/Detail</label>
                      <input
                        type="text"
                        required
                        value={item.description}
                        onChange={e => handleUpdateLineItem(item.id, 'description', e.target.value)}
                        className="w-full text-xs font-sans text-slate-800 font-medium px-2 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 truncate"
                      />
                    </div>

                    <div className="w-16 text-left">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Qty</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        required
                        value={item.qty}
                        onChange={e => handleUpdateLineItem(item.id, 'qty', parseInt(e.target.value) || 1)}
                        className="w-full text-xs font-mono text-slate-800 text-center font-bold px-2 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>

                    <div className="w-24 text-left">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Unit Fee ({currency})</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1.5 text-[10px] text-slate-400 font-mono">{currency}</span>
                        <input
                          type="number"
                          min="0"
                          required
                          value={item.unitPrice}
                          onChange={e => handleUpdateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-full text-xs font-mono text-slate-800 pl-5 pr-1 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 text-right"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveLineItem(item.id)}
                      className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors border border-transparent hover:border-rose-150 mt-3.5"
                      title="Remove section item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200 border-dashed mb-6">
                <button
                  type="button"
                  onClick={handleAddLineItem}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-sans font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                >
                  <PlusCircle className="w-4 h-4 text-emerald-400" />
                  Add Custom Section Line
                </button>
                <div className="flex gap-3 text-left">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Flat Discount ({currency})</label>
                    <input
                      type="number"
                      min="0"
                      value={discount}
                      onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                      className="w-24 px-2 py-1 text-xs font-mono rounded bg-white border border-slate-300 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Tax Rate (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={taxRate}
                      onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 text-xs font-mono rounded bg-white border border-slate-300 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t pt-5 text-left">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Invoice Identifier</label>
                  <input
                    type="text"
                    required
                    value={invoiceNo}
                    onChange={e => setInvoiceNo(e.target.value)}
                    className="w-full text-xs font-mono rounded px-2 py-1 border border-slate-300 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Issue Date</label>
                  <input
                    type="date"
                    required
                    value={issueDate}
                    onChange={e => setIssueDate(e.target.value)}
                    className="w-full text-xs font-mono rounded px-2 py-1 border border-slate-300 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Payment Due Date</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full text-xs font-mono rounded px-2 py-1 border border-slate-300 bg-slate-50"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-sans font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  Confirm Items &amp; Preview
                  <Check className="w-4 h-4 text-indigo-200" />
                </button>
              </div>

            </div>
          )}

          {activeTab === 'settings' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 max-w-xl mx-auto" id="invoice-owner-settings">
              <h4 className="text-sm font-sans font-black text-slate-900 border-b pb-3 mb-4 text-left flex items-center gap-2">
                <Building className="w-4 h-4 text-slate-600" />
                Configure Gym Invoice &amp; Payment profile
              </h4>

              <div className="space-y-4 text-left">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Gym/Business Brand Name</label>
                  <input
                    type="text"
                    required
                    value={profileGymName}
                    onChange={e => setProfileGymName(e.target.value)}
                    className="mt-1 w-full text-xs font-sans rounded px-3 py-1.5 border border-slate-300 focus:ring-1 focus:ring-sky-500"
                    placeholder="e.g. Iron Temple Gym"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Full business Address (Printed on invoices)</label>
                  <textarea
                    rows={2}
                    required
                    value={profileAddress}
                    onChange={e => setProfileAddress(e.target.value)}
                    className="mt-1 w-full text-xs font-sans rounded px-3 py-1.5 border border-slate-300 focus:ring-1 focus:ring-sky-500"
                    placeholder="e.g. 742 Gym Avenue, Suite 100, Metropolis"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Business Phone</label>
                    <input
                      type="text"
                      value={profilePhone}
                      onChange={e => setProfilePhone(e.target.value)}
                      className="mt-1 w-full text-xs font-mono rounded px-3 py-1.5 border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Business Email</label>
                    <input
                      type="email"
                      value={profileEmail}
                      onChange={e => setProfileEmail(e.target.value)}
                      className="mt-1 w-full text-xs font-mono rounded px-3 py-1.5 border border-slate-300"
                    />
                  </div>
                </div>

                <div className="bg-sky-50/50 p-4 rounded-xl border border-sky-100 mt-2">
                  <span className="text-[10px] font-bold text-sky-700 uppercase tracking-widest block mb-2 font-mono">
                    Owner QR payment credentials Setup
                  </span>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => setQrMode('dynamic')}
                      className={`px-3 py-1.5 text-xs font-sans font-bold rounded-lg border transition-all cursor-pointer text-center ${
                        qrMode === 'dynamic'
                          ? 'bg-white border-sky-350 text-indigo-700 shadow-3xs'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Dynamic UPI QR
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrMode('custom')}
                      className={`px-3 py-1.5 text-xs font-sans font-bold rounded-lg border transition-all cursor-pointer text-center ${
                        qrMode === 'custom'
                          ? 'bg-white border-sky-350 text-indigo-700 shadow-3xs'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Custom QR Code
                    </button>
                  </div>
                  
                  {qrMode === 'dynamic' ? (
                    <div className="space-y-3 animate-fade-in text-left">
                      <div>
                        <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">UPI VPA Address (e.g. yourname@ybl or phone@upi)</label>
                        <input
                          type="text"
                          required
                          value={upiId}
                          onChange={e => setUpiId(e.target.value)}
                          placeholder="e.g. gymowner@upi"
                          className="mt-1 w-full text-xs font-mono rounded px-3 py-1.5 bg-white border border-slate-300 shadow-3xs uppercase"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 animate-fade-in text-left">
                      <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Upload Payment QR Image (PNG, JPG, SVG)</label>
                      <div className="flex flex-col sm:flex-row gap-4 items-center bg-white p-3 rounded-xl border border-slate-150">
                        <div className="relative w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 overflow-hidden flex items-center justify-center shrink-0">
                          {customQrUrl ? (
                            <img src={customQrUrl} alt="Owner QR Code" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="text-center p-2 text-slate-400">
                              <span className="text-lg block">📷</span>
                              <span className="text-[8px] font-mono leading-tight uppercase font-medium">No QR Code</span>
                            </div>
                          )}
                        </div>

                        <div className="flex-1 space-y-2 text-center sm:text-left">
                          <label className="bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs px-3 py-1.5 rounded-lg cursor-pointer shadow-3xs inline-flex items-center gap-1.5 transition-colors">
                            <Upload className="w-3.5 h-3.5 text-sky-400" />
                            <span>Choose Image File</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setCustomQrUrl(reader.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="hidden"
                            />
                          </label>

                          {customQrUrl && (
                            <button
                              type="button"
                              onClick={() => setCustomQrUrl('')}
                              className="text-rose-600 hover:text-rose-800 font-bold text-xs px-3 py-1 bg-rose-50 border border-rose-150 hover:bg-rose-100 transition-all rounded-lg block sm:inline-block ml-0 sm:ml-2 mt-1 sm:mt-0"
                            >
                              Clear QR Image
                            </button>
                          )}
                          <p className="text-[10px] text-slate-400 font-mono leading-relaxed max-w-[280px]">
                            Upload a scan of your banking QR, Venmo, CashApp, local payment gateway, or static QR code.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Standard Invoice Bottom Message / disclaimer</label>
                  <input
                    type="text"
                    value={ownerNotes}
                    onChange={e => setOwnerNotes(e.target.value)}
                    className="mt-1 w-full text-[11px] text-slate-700 italic rounded px-3 py-1.5 border border-slate-300 focus:ring-1 focus:ring-sky-500"
                    placeholder="Thank you for investing in your health and strength!"
                  />
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className="px-4 py-2 border border-slate-250 text-slate-600 rounded-xl text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={isSavingProfile}
                  className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold font-sans hover:bg-slate-800 flex items-center gap-1.5 shrink-0"
                >
                  {isSavingProfile ? 'Saving profile...' : 'Apply settings'}
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                </button>
              </div>

            </div>
          )}

        </div>

        <div className="bg-slate-900 border-t border-slate-850 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-400 shrink-0 select-none">
          <p className="text-left font-mono">
            Owner Wallet Address: <strong className="text-white hover:underline cursor-pointer">{upiId}</strong>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1 text-slate-305 bg-slate-800 hover:text-white hover:bg-slate-750 transition-all rounded-lg font-sans font-bold cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
