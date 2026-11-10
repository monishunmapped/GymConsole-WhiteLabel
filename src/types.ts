export interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  alternatePhone?: string;
  status: 'Active' | 'Paused' | 'Expired';
  plan: string;
  joinDate: string;
  expiryDate: string;
  photoUrl?: string;
  avatarUrl?: string;
  gender?: string;
  notes?: string;
  totalCheckIns: number;
  lastCheckIn: string | null;
  reminderSentDate?: string;
  birthdayGreetingSentDate?: string;
  dob?: string;
  autoRenew?: boolean;
  shiftTiming?: 'Morning' | 'Evening';
  advanceBalance?: number;
  advancePayments?: AdvancePaymentRecord[];
}

export interface AdvancePaymentRecord {
  id: string;
  amount: number;
  paymentMode: 'Cash' | 'UPI' | 'Credit/Debit Card' | 'Net Banking' | 'Cheque' | 'Bank Transfer';
  purpose: string;
  date: string;
  referenceNo?: string;
  notes?: string;
  extendedExpiryDate?: string;
  receiptNo?: string;
}

export type MembershipPlanName = string;

export interface MembershipPlan {
  name: string;
  price: number;
  durationDays: number;
  features: string[];
}

export interface CheckIn {
  id: string;
  memberId: string;
  memberName: string;
  timestamp: string;
  planType: string;
  method: 'Self QR Scan' | 'Front Desk Scan' | 'Manual Select' | 'Biometric Fingerprint';
  status: 'Granted' | 'Expired Plan' | 'No Active Plan';
}

export interface DailyStat {
  date: string;
  checkIns: number;
  newMembers: number;
}

export interface WelcomeMessage {
  id: string;
  type: 'Welcome' | 'CheckIn';
  memberId: string;
  memberName: string;
  phone: string;
  messageText: string;
  timestamp: string;
  method?: string;
  plan?: string;
  status: 'Pending' | 'Sent';
}

export interface SecurityConfig {
  id: string;
  ownerEmail: string;
  ownerPassword: string;
  adminEmail: string;
  adminPassword: string;
}

export interface Feedback {
  id: string;
  memberName?: string;
  memberEmail?: string;
  rating: number;
  category: 'Facilities' | 'Equipment' | 'Trainers' | 'Cleanliness' | 'Classes' | 'Other';
  suggestion: string;
  timestamp: string;
  status: 'Pending' | 'Reviewed' | 'Addressed';
}

export type CheckInMethod = CheckIn['method'];

export interface CheckInResponse {
  success: boolean;
  message: string;
  status: CheckIn['status'];
}

export interface UserSession {
  email: string;
  role: 'Owner' | 'Admin';
}
