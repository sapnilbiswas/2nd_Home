import { supabase } from './supabase';
import { RentDue, Payment, Setting } from '../types/database';

export interface PaymentWithDetails extends Payment {
  due?: RentDue & {
    tenancy?: {
      tenant?: {
        name: string | null;
        phone: string | null;
      };
      room?: {
        room_no: string;
      };
    };
  };
}

// 1. Settings (Owner UPI Details)
export const fetchHouseSettings = async (): Promise<Setting> => {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) throw error;
  return data as Setting;
};

export const updateHouseSettings = async (settings: {
  owner_upi_id: string;
  owner_name: string;
}) => {
  const { data, error } = await supabase
    .from('settings')
    .upsert({ id: 1, ...settings })
    .select()
    .single();

  if (error) throw error;
  return data as Setting;
};

// 2. Generate Monthly Dues (Admin)
export const generateMonthlyRentDues = async (
  monthDateStr: string // Format: 'YYYY-MM-01'
): Promise<{ generated: number; skipped: number }> => {
  const today = new Date().toISOString().split('T')[0];

  // Fetch all currently active tenancies with room rent
  const { data: activeTenancies, error: tenanciesError } = await supabase
    .from('tenancies')
    .select('id, monthly_rent:rooms(monthly_rent), room_id')
    .or(`end_date.is.null,end_date.gte.${today}`);

  if (tenanciesError) throw tenanciesError;
  if (!activeTenancies || activeTenancies.length === 0) {
    return { generated: 0, skipped: 0 };
  }

  // Fetch existing rent dues for this target month
  const { data: existingDues, error: duesError } = await supabase
    .from('rent_dues')
    .select('tenancy_id')
    .eq('month', monthDateStr);

  if (duesError) throw duesError;

  const existingTenancyIds = new Set((existingDues || []).map((d) => d.tenancy_id));

  let generated = 0;
  let skipped = 0;

  for (const tenancy of activeTenancies) {
    if (existingTenancyIds.has(tenancy.id)) {
      skipped++;
      continue;
    }

    const roomRent = (tenancy as any).monthly_rent?.monthly_rent || 0;
    const { error: insertError } = await supabase.from('rent_dues').insert({
      tenancy_id: tenancy.id,
      month: monthDateStr,
      amount: roomRent,
      status: 'unpaid',
    });

    if (insertError) {
      console.warn('Error creating due for tenancy', tenancy.id, insertError);
    } else {
      generated++;
    }
  }

  return { generated, skipped };
};

// 3. Tenant: Fetch Dues and Payment History
export const fetchTenantDuesWithPayments = async (tenantId: string) => {
  // Fetch tenancies of tenant
  const { data: tenancies, error: tenError } = await supabase
    .from('tenancies')
    .select('id')
    .eq('tenant_id', tenantId);

  if (tenError) throw tenError;
  const tenancyIds = (tenancies || []).map((t) => t.id);
  if (tenancyIds.length === 0) return [];

  const { data, error } = await supabase
    .from('rent_dues')
    .select('*, payments(*), tenancy:tenancies(*, room:rooms(*))')
    .in('tenancy_id', tenancyIds)
    .order('month', { ascending: false });

  if (error) throw error;
  return data;
};

// 4. Tenant: Submit Payment (UTR + optional screenshot)
export const submitRentPayment = async (params: {
  due_id: number;
  utr: string;
  screenshot_url?: string | null;
}) => {
  const cleanedUtr = params.utr.trim().toUpperCase();

  // Check if UTR is already submitted
  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('utr', cleanedUtr)
    .maybeSingle();

  if (existing) {
    throw new Error('This UTR transaction reference has already been submitted.');
  }

  const { data, error } = await supabase
    .from('payments')
    .insert({
      due_id: params.due_id,
      utr: cleanedUtr,
      screenshot_url: params.screenshot_url || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data as Payment;
};

// 5. Admin: Fetch Payments Queue
export const fetchAdminPaymentsQueue = async (
  statusFilter: 'all' | 'pending' | 'confirmed' | 'rejected' = 'pending'
): Promise<PaymentWithDetails[]> => {
  let query = supabase
    .from('payments')
    .select(`
      *,
      due:rent_dues (
        *,
        tenancy:tenancies (
          *,
          tenant:profiles (name, phone),
          room:rooms (room_no)
        )
      )
    `)
    .order('created_at', { ascending: false });

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as PaymentWithDetails[];
};

// 6. Admin: Confirm Payment
export const confirmPayment = async (paymentId: number, dueId: number) => {
  // Update payment status
  const { error: payError } = await supabase
    .from('payments')
    .update({ status: 'confirmed' })
    .eq('id', paymentId);

  if (payError) throw payError;

  // Mark rent due as paid
  const { error: dueError } = await supabase
    .from('rent_dues')
    .update({ status: 'paid' })
    .eq('id', dueId);

  if (dueError) throw dueError;
};

// 7. Admin: Reject Payment
export const rejectPayment = async (paymentId: number) => {
  const { error } = await supabase
    .from('payments')
    .update({ status: 'rejected' })
    .eq('id', paymentId);

  if (error) throw error;
};
