import { Member, CheckIn, MembershipPlan } from '../types';

export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  {
    name: 'Day Pass',
    price: 15,
    durationDays: 1,
    features: ['Single-day gym access', 'Full cardio & weight zone', 'Locker & shower facilities'],
  },
  {
    name: 'Monthly Core',
    price: 59,
    durationDays: 30,
    features: ['Unlimited monthly access', 'All strength & cardio zones', '1 Free fitness assessment', 'Group fitness classes'],
  },
  {
    name: 'Annual VIP',
    price: 499,
    durationDays: 365,
    features: ['Unlimited 1-year access', 'All group fitness classes', '4 Free physical trainer sessions', 'Premium lounge access', '10% Pro-shop discount'],
  },
  {
    name: 'Premium Executive',
    price: 999,
    durationDays: 365,
    features: ['Unlimited 24/7 VIP access', 'Dedicated private trainer', 'Free laundry service', 'Protein shake at juice-bar daily', 'Guest pass availability'],
  },
];

export const INITIAL_MEMBERS: Member[] = [];

export const INITIAL_CHECKINS: CheckIn[] = [];
