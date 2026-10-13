import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { Announcement, MeetingRsvp, RsvpResponse, Profile } from '../types/database';
import { sendPushNotification } from './notifications';

const getNotificationsModule = () => {
  if (isRunningInExpoGo() && Platform.OS === 'android') {
    return null;
  }
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
};

export interface AnnouncementWithRsvps extends Announcement {
  rsvpCounts?: {
    yes: number;
    maybe: number;
    no: number;
  };
  userRsvp?: RsvpResponse | null;
}

export interface AttendeeDetail {
  tenant_id: string;
  response: RsvpResponse;
  tenant?: Profile;
}

// 1. Fetch announcements with RSVP counts
export const fetchAnnouncements = async (
  currentUserId?: string
): Promise<AnnouncementWithRsvps[]> => {
  const { data: announcements, error: annError } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });

  if (annError) throw annError;
  if (!announcements || announcements.length === 0) return [];

  // Fetch all RSVPs for meetings
  const meetingIds = announcements.filter((a) => a.is_meeting).map((a) => a.id);
  let allRsvps: any[] = [];

  if (meetingIds.length > 0) {
    const { data: rsvpsData } = await supabase
      .from('meeting_rsvps')
      .select('*')
      .in('announcement_id', meetingIds);
    allRsvps = rsvpsData || [];
  }

  return announcements.map((ann) => {
    if (!ann.is_meeting) {
      return ann;
    }

    const meetingRsvps = allRsvps.filter((r) => r.announcement_id === ann.id);
    const counts = {
      yes: meetingRsvps.filter((r) => r.response === 'yes').length,
      maybe: meetingRsvps.filter((r) => r.response === 'maybe').length,
      no: meetingRsvps.filter((r) => r.response === 'no').length,
    };

    const userRsvp = currentUserId
      ? meetingRsvps.find((r) => r.tenant_id === currentUserId)?.response || null
      : null;

    return {
      ...ann,
      rsvpCounts: counts,
      userRsvp,
    };
  });
};

// 2. Admin: Create announcement / meeting & broadcast push
export const createAnnouncement = async (params: {
  title: string;
  body: string;
  is_meeting?: boolean;
  meeting_at?: string | null;
  venue?: string | null;
}): Promise<Announcement> => {
  const { data, error } = await supabase
    .from('announcements')
    .insert({
      title: params.title.trim(),
      body: params.body.trim(),
      is_meeting: Boolean(params.is_meeting),
      meeting_at: params.meeting_at || null,
      venue: params.venue?.trim() || null,
    })
    .select()
    .single();

  if (error) throw error;

  // Broadcast push to all active tenants
  try {
    const { data: tenants } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('role', 'tenant')
      .eq('is_active', true)
      .not('push_token', 'is', null);

    if (tenants && tenants.length > 0) {
      const titlePrefix = params.is_meeting ? '📅 House Meeting: ' : '📢 Announcement: ';
      for (const t of tenants) {
        if (t.push_token) {
          await sendPushNotification({
            pushToken: t.push_token,
            title: `${titlePrefix}${params.title}`,
            body: params.body.slice(0, 100),
            data: { announcementId: data.id, isMeeting: params.is_meeting },
          });
        }
      }
    }
  } catch (pushErr) {
    console.warn('Failed to broadcast announcement push:', pushErr);
  }

  return data as Announcement;
};

// 3. Tenant: Submit RSVP
export const submitMeetingRsvp = async (
  announcementId: number,
  tenantId: string,
  response: RsvpResponse
) => {
  const { error } = await supabase.from('meeting_rsvps').upsert({
    announcement_id: announcementId,
    tenant_id: tenantId,
    response,
  });

  if (error) throw error;
};

// 4. Admin: Fetch RSVP attendees breakdown
export const fetchMeetingAttendees = async (
  announcementId: number
): Promise<AttendeeDetail[]> => {
  const { data, error } = await supabase
    .from('meeting_rsvps')
    .select('*, tenant:profiles(*)')
    .eq('announcement_id', announcementId);

  if (error) throw error;
  return (data || []) as AttendeeDetail[];
};

// 5. Admin: Delete announcement
export const deleteAnnouncement = async (id: number) => {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;
};

// 6. Schedule local meeting reminder 1 hour before meeting
export const scheduleLocalMeetingReminder = async (announcement: Announcement) => {
  if (!announcement.is_meeting || !announcement.meeting_at) return;

  const meetingTime = new Date(announcement.meeting_at).getTime();
  const reminderTime = meetingTime - 60 * 60 * 1000; // 1 hour before
  const now = Date.now();

  if (reminderTime <= now) {
    // Meeting is in less than an hour or in past
    return;
  }

  const Notif = getNotificationsModule();
  if (!Notif) {
    return;
  }

  try {
    const triggerSeconds = Math.round((reminderTime - now) / 1000);
    await Notif.scheduleNotificationAsync({
      content: {
        title: `Reminder: Meeting in 1 Hour ⏰`,
        body: `"${announcement.title}" starts at ${new Date(
          announcement.meeting_at
        ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${
          announcement.venue ? ` at ${announcement.venue}` : ''
        }`,
        data: { announcementId: announcement.id },
      },
      trigger: {
        type: Notif.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: triggerSeconds,
      },
    });
    console.log(`Meeting reminder scheduled in ${triggerSeconds} seconds`);
  } catch (err) {
    console.warn('Could not schedule local reminder:', err);
  }
};
