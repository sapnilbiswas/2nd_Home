import { supabase } from './supabase';
import { Room, Profile, Tenancy } from '../types/database';

export interface RoomWithOccupancy extends Room {
  occupied_beds: number;
  available_beds: number;
}

export interface TenantWithTenancy extends Profile {
  active_tenancy?: (Tenancy & { room?: Room }) | null;
}

// 1. Edge Function: Create Tenant
export const createTenant = async (params: {
  name: string;
  phone: string;
  roomId?: number | null;
  tempPassword?: string;
}) => {
  const { data, error } = await supabase.functions.invoke('create-tenant', {
    body: params,
  });

  if (error) {
    throw new Error(error.message || 'Failed to create tenant via Edge Function');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
};

// 2. Edge Function: Reset Tenant Password
export const resetTenantPassword = async (params: {
  tenantId: string;
  newPassword?: string;
}) => {
  const { data, error } = await supabase.functions.invoke('reset-tenant-password', {
    body: params,
  });

  if (error) {
    throw new Error(error.message || 'Failed to reset tenant password via Edge Function');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
};

// 3. Rooms Management
export const fetchRoomsWithOccupancy = async (): Promise<RoomWithOccupancy[]> => {
  // Fetch rooms
  const { data: rooms, error: roomsError } = await supabase
    .from('rooms')
    .select('*')
    .order('room_no', { ascending: true });

  if (roomsError) throw roomsError;

  // Fetch active tenancies (end_date is null or end_date >= today)
  const today = new Date().toISOString().split('T')[0];
  const { data: activeTenancies, error: tenanciesError } = await supabase
    .from('tenancies')
    .select('id, room_id, end_date')
    .or(`end_date.is.null,end_date.gte.${today}`);

  if (tenanciesError) throw tenanciesError;

  // Compute occupancy per room
  const occupancyMap: Record<number, number> = {};
  activeTenancies?.forEach((t) => {
    occupancyMap[t.room_id] = (occupancyMap[t.room_id] || 0) + 1;
  });

  return (rooms || []).map((r) => {
    const occupied = occupancyMap[r.id] || 0;
    return {
      ...r,
      occupied_beds: occupied,
      available_beds: Math.max(0, r.capacity - occupied),
    };
  });
};

export const createRoom = async (room: {
  room_no: string;
  monthly_rent: number;
  capacity: number;
}) => {
  const { data, error } = await supabase
    .from('rooms')
    .insert(room)
    .select()
    .single();

  if (error) throw error;
  return data as Room;
};

export const updateRoom = async (
  id: number,
  updates: { room_no: string; monthly_rent: number; capacity: number }
) => {
  const { data, error } = await supabase
    .from('rooms')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Room;
};

export const deleteRoom = async (id: number) => {
  const { error } = await supabase.from('rooms').delete().eq('id', id);
  if (error) throw error;
};

// 4. Tenant Management & Allocation
export const fetchTenantsWithTenancy = async (): Promise<TenantWithTenancy[]> => {
  // Fetch profiles where role = 'tenant'
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'tenant')
    .order('name', { ascending: true });

  if (profileError) throw profileError;

  // Fetch active tenancies with room information
  const today = new Date().toISOString().split('T')[0];
  const { data: tenancies, error: tenanciesError } = await supabase
    .from('tenancies')
    .select('*, room:rooms(*)')
    .or(`end_date.is.null,end_date.gte.${today}`);

  if (tenanciesError) throw tenanciesError;

  const tenancyByTenantId = new Map<string, any>();
  tenancies?.forEach((t) => {
    tenancyByTenantId.set(t.tenant_id, t);
  });

  return (profiles || []).map((p) => ({
    ...p,
    active_tenancy: tenancyByTenantId.get(p.id) || null,
  }));
};

export const assignTenantRoom = async (tenantId: string, roomId: number) => {
  const today = new Date().toISOString().split('T')[0];

  // 1. End any existing active tenancy for this tenant
  await supabase
    .from('tenancies')
    .update({ end_date: today })
    .eq('tenant_id', tenantId)
    .or(`end_date.is.null,end_date.gte.${today}`);

  // 2. Create new tenancy
  const { data, error } = await supabase
    .from('tenancies')
    .insert({
      tenant_id: tenantId,
      room_id: roomId,
      start_date: today,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const endTenancy = async (tenancyId: number) => {
  const today = new Date().toISOString().split('T')[0];
  const { error } = await supabase
    .from('tenancies')
    .update({ end_date: today })
    .eq('id', tenancyId);

  if (error) throw error;
};

export const toggleTenantActiveStatus = async (tenantId: string, isActive: boolean) => {
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', tenantId);

  if (error) throw error;
};
