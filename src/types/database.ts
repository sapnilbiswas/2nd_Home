export type UserRole = 'admin' | 'tenant';

export interface Profile {
  id: string;
  name: string | null;
  phone: string | null;
  role: UserRole;
  push_token: string | null;
  is_active: boolean;
}

export interface Setting {
  id: number;
  owner_upi_id: string | null;
  owner_name: string | null;
}

export interface Room {
  id: number;
  room_no: string;
  monthly_rent: number;
  capacity: number;
}

export interface Tenancy {
  id: number;
  tenant_id: string;
  room_id: number;
  start_date: string;
  end_date: string | null;
  room?: Room;
  tenant?: Profile;
}

export type RentDueStatus = 'unpaid' | 'paid';

export interface RentDue {
  id: number;
  tenancy_id: number;
  month: string;
  amount: number;
  status: RentDueStatus;
  tenancy?: Tenancy;
}

export type PaymentStatus = 'pending' | 'confirmed' | 'rejected';

export interface Payment {
  id: number;
  due_id: number;
  utr: string;
  screenshot_url: string | null;
  status: PaymentStatus;
  created_at: string;
  due?: RentDue;
}

export type ComplaintStatus = 'open' | 'in_progress' | 'resolved';

export interface Complaint {
  id: number;
  tenant_id: string;
  category: string;
  details: string;
  photo_url: string | null;
  admin_reply: string | null;
  status: ComplaintStatus;
  created_at: string;
  tenant?: Profile;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  is_meeting: boolean;
  meeting_at: string | null;
  venue: string | null;
  created_at: string;
}

export type RsvpResponse = 'yes' | 'no' | 'maybe';

export interface MeetingRsvp {
  announcement_id: number;
  tenant_id: string;
  response: RsvpResponse;
}

export interface Message {
  id: number | string;
  room: string; // 'general' or tenant_id
  sender_id: string;
  body: string | null;
  media_url: string | null;
  created_at: string;
  sender?: Profile;
}
