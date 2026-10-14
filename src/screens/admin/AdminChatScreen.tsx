import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { Message, Profile } from '../../types/database';
import {
  fetchMessages,
  sendMessage,
  subscribeToRoomMessages,
  uploadChatImage,
  fetchChatTenants,
} from '../../api/chat';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '👏', '🔥', '🙏', '🏠', '⚡'];

export const AdminChatScreen = () => {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<Profile[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Profile | null>(null); // null means General chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Fullscreen Image Preview
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  // Current room: 'general' or selected tenant's UUID
  const currentRoom = selectedTenant ? selectedTenant.id : 'general';

  // 1. Fetch active residents for direct messages
  useEffect(() => {
    const loadTenants = async () => {
      try {
        const data = await fetchChatTenants();
        setTenants(data);
      } catch (err) {
        console.warn('Error loading tenants for chat:', err);
      } finally {
        setLoadingTenants(false);
      }
    };
    loadTenants();
  }, []);

  // 2. Load messages and subscribe to Realtime for selected room
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    setLoading(true);

    const initChat = async () => {
      try {
        const history = await fetchMessages(currentRoom);
        setMessages(history);

        unsubscribe = subscribeToRoomMessages(currentRoom, (newMsg) => {
          setMessages((prev) => {
            if (prev.some((m) => String(m.id) === String(newMsg.id))) {
              return prev;
            }
            return [...prev, newMsg];
          });
        });
      } catch (err) {
        console.warn('Error loading admin chat room:', err);
      } finally {
        setLoading(false);
      }
    };

    initChat();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentRoom]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [messages.length]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !user) return;
    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const sent = await sendMessage({
        room: currentRoom,
        senderId: user.id,
        body: textToSend,
      });

      setMessages((prev) => {
        if (prev.some((m) => String(m.id) === String(sent.id))) {
          return prev;
        }
        return [...prev, sent];
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send message');
      setInputText(textToSend);
    } finally {
      setSending(false);
    }
  };

  const handlePickAndSendImage = async () => {
    if (!user) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setUploadingImage(true);
        const uploadedUrl = await uploadChatImage(result.assets[0].uri);

        const sent = await sendMessage({
          room: currentRoom,
          senderId: user.id,
          mediaUrl: uploadedUrl,
        });

        setMessages((prev) => {
          if (prev.some((m) => String(m.id) === String(sent.id))) {
            return prev;
          }
          return [...prev, sent];
        });
      }
    } catch (err: any) {
      Alert.alert('Image Upload Failed', err.message || 'Could not upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleQuickEmojiPress = (emoji: string) => {
    setInputText((prev) => prev + emoji);
  };

  const renderMessageItem = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === user?.id;
    const senderName = item.sender?.name || (item.sender?.role === 'admin' ? 'Admin' : 'Resident');
    const messageTime = new Date(item.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.otherMessageRow]}>
        <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.otherBubble]}>
          {!isMe && (
            <View style={styles.senderHeader}>
              <Text style={styles.senderName}>{senderName}</Text>
              <Text style={styles.senderPhone}>{item.sender?.phone || ''}</Text>
            </View>
          )}

          {item.media_url && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setPreviewImageUrl(item.media_url)}
            >
              <Image source={{ uri: item.media_url }} style={styles.bubbleImage} />
            </TouchableOpacity>
          )}

          {Boolean(item.body) && (
            <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.otherMessageText]}>
              {item.body}
            </Text>
          )}

          <Text style={[styles.timestampText, isMe ? styles.myTimestamp : styles.otherTimestamp]}>
            {messageTime}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {/* Top Header */}
        <View style={styles.topHeader}>
          <View style={styles.headerInfo}>
            <Text style={styles.screenTitle}>Chat & Resident DMs</Text>
            <View style={styles.liveIndicatorRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Realtime Connected</Text>
            </View>
          </View>
        </View>

        {/* Room & Resident Horizontal Selector */}
        <View style={styles.channelSelectorContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.channelScroll}
          >
            {/* General Group Channel Pill */}
            <TouchableOpacity
              style={[
                styles.channelPill,
                selectedTenant === null && styles.channelPillActive,
              ]}
              onPress={() => setSelectedTenant(null)}
            >
              <Text style={styles.channelIcon}>💬</Text>
              <Text
                style={[
                  styles.channelPillText,
                  selectedTenant === null && styles.channelPillTextActive,
                ]}
              >
                House Group
              </Text>
            </TouchableOpacity>

            {/* Resident DMs */}
            {tenants.map((t) => {
              const isSelected = selectedTenant?.id === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.channelPill, isSelected && styles.channelPillActive]}
                  onPress={() => setSelectedTenant(t)}
                >
                  <Text style={styles.channelIcon}>👤</Text>
                  <View>
                    <Text
                      style={[
                        styles.channelPillText,
                        isSelected && styles.channelPillTextActive,
                      ]}
                    >
                      {t.name || 'Resident'}
                    </Text>
                    <Text style={styles.channelPillSubtext}>{t.phone || ''}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Active Room Title Bar */}
        <View style={styles.activeBar}>
          <Text style={styles.activeBarText}>
            {selectedTenant
              ? `Direct Message with ${selectedTenant.name} (${selectedTenant.phone})`
              : '📢 House General Chat (All Residents)'}
          </Text>
        </View>

        {/* Message Feed */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Syncing messages...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>
                  {selectedTenant ? '🔒' : '💬'}
                </Text>
                <Text style={styles.emptyTitle}>
                  {selectedTenant
                    ? `No messages with ${selectedTenant.name} yet`
                    : 'House General Chat is clean'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {selectedTenant
                    ? 'Start a private conversation or send notice to this resident.'
                    : 'Messages sent here are visible to all house residents.'}
                </Text>
              </View>
            }
          />
        )}

        {/* Quick Emoji Bar */}
        <View style={styles.quickEmojiBar}>
          {QUICK_EMOJIS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={styles.quickEmojiButton}
              onPress={() => handleQuickEmojiPress(emoji)}
            >
              <Text style={styles.quickEmojiText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={handlePickAndSendImage}
            disabled={uploadingImage}
          >
            {uploadingImage ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="camera-outline" size={24} color={colors.textSecondary} />
            )}
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder={
              selectedTenant
                ? `Message ${selectedTenant.name}...`
                : 'Broadcast message to house...'
            }
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>

        {/* Fullscreen Image Preview Modal */}
        <Modal
          visible={Boolean(previewImageUrl)}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewImageUrl(null)}
        >
          <View style={styles.previewOverlay}>
            <TouchableOpacity
              style={styles.closePreviewBtn}
              onPress={() => setPreviewImageUrl(null)}
            >
              <Ionicons name="close-circle" size={36} color="#FFFFFF" />
            </TouchableOpacity>
            {previewImageUrl && (
              <Image
                source={{ uri: previewImageUrl }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            )}
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  topHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: colors.card,
  },
  headerInfo: {
    marginBottom: 4,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
  },
  channelSelectorContainer: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    paddingVertical: 8,
  },
  channelScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  channelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 6,
  },
  channelPillActive: {
    backgroundColor: '#27293D',
    borderColor: colors.primary,
  },
  channelIcon: {
    fontSize: 14,
  },
  channelPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  channelPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  channelPillSubtext: {
    fontSize: 10,
    color: colors.textMuted,
  },
  activeBar: {
    backgroundColor: '#181922',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  activeBarText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textMuted,
    marginTop: 10,
    fontSize: 13,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  otherMessageRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  myBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  senderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38BDF8',
  },
  senderPhone: {
    fontSize: 10,
    color: colors.textMuted,
  },
  bubbleImage: {
    width: 210,
    height: 160,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#000',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: colors.textPrimary,
  },
  timestampText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherTimestamp: {
    color: colors.textMuted,
  },
  quickEmojiBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  quickEmojiButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  quickEmojiText: {
    fontSize: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    gap: 8,
  },
  attachButton: {
    padding: 6,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    color: colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  sendButton: {
    backgroundColor: colors.primary,
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 24,
    lineHeight: 18,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closePreviewBtn: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 10,
  },
  fullscreenImage: {
    width: '94%',
    height: '75%',
  },
});
