import { supabase } from './supabase';
import { Message, Profile } from '../types/database';
import { compressAndUploadImage } from './cloudinary';
import { sendPushNotification } from './notifications';

/**
 * 1. Fetch messages for a specific room (general or private tenant id)
 */
export const fetchMessages = async (room: string): Promise<Message[]> => {
  const { data, error } = await supabase
    .from('messages')
    .select('*, sender:profiles(*)')
    .eq('room', room)
    .order('created_at', { ascending: true })
    .limit(150);

  if (error) {
    console.error('Error fetching chat messages:', error);
    throw error;
  }

  return (data || []) as Message[];
};

/**
 * 2. Send a new chat message and broadcast push notification
 */
export const sendMessage = async (params: {
  room: string;
  senderId: string;
  body?: string | null;
  mediaUrl?: string | null;
}): Promise<Message> => {
  if (!params.body?.trim() && !params.mediaUrl) {
    throw new Error('Message must have text or an image');
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      room: params.room,
      sender_id: params.senderId,
      body: params.body?.trim() || null,
      media_url: params.mediaUrl || null,
    })
    .select('*, sender:profiles(*)')
    .single();

  if (error) {
    console.error('Error sending message:', error);
    throw error;
  }

  const message = data as Message;

  // Background Push Notification Broadcast
  try {
    const senderName = message.sender?.name || 'Resident';
    const messageSnippet = params.body?.trim() || '📷 Sent a photo';

    if (params.room === 'general') {
      // Broadcast to all other residents and admin
      const { data: recipients } = await supabase
        .from('profiles')
        .select('id, push_token')
        .eq('is_active', true)
        .neq('id', params.senderId)
        .not('push_token', 'is', null);

      if (recipients && recipients.length > 0) {
        for (const r of recipients) {
          if (r.push_token) {
            await sendPushNotification({
              pushToken: r.push_token,
              title: `💬 House Chat: ${senderName}`,
              body: messageSnippet.slice(0, 80),
              data: { room: 'general', messageId: message.id },
            });
          }
        }
      }
    } else {
      // 1-on-1 Direct Message
      // If sender is tenant, recipient is admin. If sender is admin, recipient is tenant (params.room)
      let recipientId = params.room;
      if (params.senderId === params.room) {
        // Tenant sent DM to admin -> find admin
        const { data: adminProfile } = await supabase
          .from('profiles')
          .select('id, push_token')
          .eq('role', 'admin')
          .limit(1)
          .maybeSingle();

        if (adminProfile?.push_token) {
          await sendPushNotification({
            pushToken: adminProfile.push_token,
            title: `🔒 DM from ${senderName}`,
            body: messageSnippet.slice(0, 80),
            data: { room: params.room, messageId: message.id },
          });
        }
      } else {
        // Admin sent DM to tenant
        const { data: tenantProfile } = await supabase
          .from('profiles')
          .select('id, push_token')
          .eq('id', recipientId)
          .maybeSingle();

        if (tenantProfile?.push_token) {
          await sendPushNotification({
            pushToken: tenantProfile.push_token,
            title: `🔒 Admin message`,
            body: messageSnippet.slice(0, 80),
            data: { room: params.room, messageId: message.id },
          });
        }
      }
    }
  } catch (pushErr) {
    console.warn('Failed to dispatch chat push notification:', pushErr);
  }

  return message;
};

/**
 * 3. Subscribe to real-time messages in a room
 */
export const subscribeToRoomMessages = (
  room: string,
  onMessageReceived: (message: Message) => void
) => {
  const channelName = `realtime_chat_${room}_${Date.now()}`;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room=eq.${room}`,
      },
      async (payload) => {
        const newMsg = payload.new as Message;
        // Fetch sender's profile for avatar and display name
        const { data: sender } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', newMsg.sender_id)
          .maybeSingle();

        onMessageReceived({
          ...newMsg,
          sender: sender || undefined,
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

/**
 * 4. Upload photo for chat attachment
 */
export const uploadChatImage = async (uri: string): Promise<string> => {
  return await compressAndUploadImage(uri);
};

/**
 * 5. Admin: Fetch active tenants for direct message conversations
 */
export const fetchChatTenants = async (): Promise<Profile[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'tenant')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching chat tenants:', error);
    throw error;
  }

  return (data || []) as Profile[];
};
