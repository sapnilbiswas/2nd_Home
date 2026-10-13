import { supabase } from './supabase';
import { Complaint, ComplaintStatus, Profile } from '../types/database';
import { sendPushNotification } from './notifications';

export interface ComplaintWithTenant extends Complaint {
  tenant?: Profile;
}

// 1. Tenant: Fetch own complaints
export const fetchTenantComplaints = async (tenantId: string): Promise<Complaint[]> => {
  const { data, error } = await supabase
    .from('complaints')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as Complaint[];
};

// 2. Tenant: Submit new complaint
export const submitComplaint = async (params: {
  tenantId: string;
  category: string;
  details: string;
  photo_url?: string | null;
}): Promise<Complaint> => {
  const { data, error } = await supabase
    .from('complaints')
    .insert({
      tenant_id: params.tenantId,
      category: params.category.trim(),
      details: params.details.trim(),
      photo_url: params.photo_url || null,
      status: 'open',
    })
    .select()
    .single();

  if (error) throw error;

  // Send push notification to admin if token available
  try {
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('role', 'admin')
      .not('push_token', 'is', null);

    if (adminProfiles && adminProfiles.length > 0) {
      for (const admin of adminProfiles) {
        if (admin.push_token) {
          await sendPushNotification({
            pushToken: admin.push_token,
            title: `New Complaint: ${params.category}`,
            body: params.details.slice(0, 80),
            data: { complaintId: data.id },
          });
        }
      }
    }
  } catch (pushErr) {
    console.warn('Failed to dispatch admin complaint notification:', pushErr);
  }

  return data as Complaint;
};

// 3. Admin: Fetch all complaints queue
export const fetchAdminComplaints = async (
  statusFilter: 'all' | ComplaintStatus = 'all'
): Promise<ComplaintWithTenant[]> => {
  let query = supabase
    .from('complaints')
    .select('*, tenant:profiles(*)')
    .order('created_at', { ascending: false });

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as ComplaintWithTenant[];
};

// 4. Admin: Update complaint status & reply
export const updateComplaintStatusAndReply = async (params: {
  complaintId: number;
  status: ComplaintStatus;
  adminReply?: string | null;
  tenantPushToken?: string | null;
  tenantName?: string;
  category?: string;
}): Promise<Complaint> => {
  const updates: Partial<Complaint> = {
    status: params.status,
  };

  if (params.adminReply !== undefined) {
    updates.admin_reply = params.adminReply?.trim() || null;
  }

  const { data, error } = await supabase
    .from('complaints')
    .update(updates)
    .eq('id', params.complaintId)
    .select()
    .single();

  if (error) throw error;

  // Push notification to tenant on status update or reply
  if (params.tenantPushToken) {
    try {
      const statusTitle =
        params.status === 'resolved'
          ? 'Complaint Resolved ✅'
          : params.status === 'in_progress'
          ? 'Complaint In Progress 🛠️'
          : 'Complaint Status Update ℹ️';

      const bodyMsg = params.adminReply
        ? `Admin reply: "${params.adminReply}"`
        : `Your ${params.category || 'complaint'} has been marked ${params.status.replace('_', ' ')}.`;

      await sendPushNotification({
        pushToken: params.tenantPushToken,
        title: statusTitle,
        body: bodyMsg,
        data: { complaintId: params.complaintId, status: params.status },
      });
    } catch (pushErr) {
      console.warn('Push notification dispatch error:', pushErr);
    }
  }

  return data as Complaint;
};
