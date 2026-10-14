import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  RefreshControl,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import {
  AnnouncementWithRsvps,
  AttendeeDetail,
  fetchAnnouncements,
  createAnnouncement,
  fetchMeetingAttendees,
  deleteAnnouncement,
} from '../../api/announcements';

export const AdminAnnouncementsScreen = () => {
  const [announcements, setAnnouncements] = useState<AnnouncementWithRsvps[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Post Modal State
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isMeeting, setIsMeeting] = useState(false);
  const [meetingDateStr, setMeetingDateStr] = useState('');
  const [venue, setVenue] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  // Attendees Modal State
  const [attendeesModalVisible, setAttendeesModalVisible] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<AnnouncementWithRsvps | null>(null);
  const [attendees, setAttendees] = useState<AttendeeDetail[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);

  const loadAnnouncements = async () => {
    try {
      const data = await fetchAnnouncements();
      setAnnouncements(data);
    } catch (err: any) {
      console.warn('Error loading announcements:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadAnnouncements();
  };

  const handleOpenPostModal = () => {
    setTitle('');
    setBody('');
    setIsMeeting(false);
    // Default meeting time: tomorrow 18:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0);
    setMeetingDateStr(tomorrow.toISOString().slice(0, 16).replace('T', ' '));
    setVenue('Common Room');
    setPostError(null);
    setPostModalVisible(true);
  };

  const handleCreateAnnouncement = async () => {
    if (!title.trim()) {
      setPostError('Please enter a title');
      return;
    }
    if (!body.trim()) {
      setPostError('Please enter the notice body');
      return;
    }

    let meetingIso: string | null = null;
    if (isMeeting) {
      const parsedDate = new Date(meetingDateStr.replace(' ', 'T'));
      if (isNaN(parsedDate.getTime())) {
        setPostError('Please enter a valid meeting date & time (YYYY-MM-DD HH:MM)');
        return;
      }
      meetingIso = parsedDate.toISOString();
    }

    setPosting(true);
    setPostError(null);

    try {
      await createAnnouncement({
        title: title.trim(),
        body: body.trim(),
        is_meeting: isMeeting,
        meeting_at: meetingIso,
        venue: isMeeting ? venue.trim() : null,
      });

      setPostModalVisible(false);
      Alert.alert(
        'Announcement Published',
        'Your notice has been posted and broadcast to all active residents.'
      );
      await loadAnnouncements();
    } catch (err: any) {
      setPostError(err.message || 'Failed to post announcement');
    } finally {
      setPosting(false);
    }
  };

  const handleViewAttendees = async (item: AnnouncementWithRsvps) => {
    setSelectedMeeting(item);
    setAttendeesModalVisible(true);
    setLoadingAttendees(true);

    try {
      const data = await fetchMeetingAttendees(item.id);
      setAttendees(data);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load attendees');
    } finally {
      setLoadingAttendees(false);
    }
  };

  const handleDeleteAnnouncement = (item: AnnouncementWithRsvps) => {
    Alert.alert(
      'Delete Notice',
      `Delete "${item.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAnnouncement(item.id);
              await loadAnnouncements();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  const renderAnnouncementItem = ({ item }: { item: AnnouncementWithRsvps }) => {
    const isMeeting = item.is_meeting;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.typeBadge,
              isMeeting ? styles.meetingBadge : styles.generalBadge,
            ]}
          >
            <Text
              style={[
                styles.typeBadgeText,
                isMeeting ? styles.meetingBadgeText : styles.generalBadgeText,
              ]}
            >
              {isMeeting ? '📅 HOUSE MEETING' : '📢 NOTICE'}
            </Text>
          </View>
          <Text style={styles.dateText}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>

        <Text style={styles.titleText}>{item.title}</Text>
        <Text style={styles.bodyText}>{item.body}</Text>

        {isMeeting && (
          <View style={styles.meetingInfoBox}>
            <Text style={styles.meetingInfoText}>
              ⏰ {item.meeting_at ? new Date(item.meeting_at).toLocaleString() : 'N/A'}{' '}
              {item.venue ? `• 📍 ${item.venue}` : ''}
            </Text>

            {/* RSVP Summary Pills */}
            <View style={styles.rsvpStatsRow}>
              <View style={styles.rsvpPill}>
                <Text style={styles.rsvpPillLabel}>Yes: </Text>
                <Text style={styles.rsvpPillValue}>{item.rsvpCounts?.yes || 0}</Text>
              </View>
              <View style={styles.rsvpPill}>
                <Text style={styles.rsvpPillLabel}>Maybe: </Text>
                <Text style={styles.rsvpPillValue}>{item.rsvpCounts?.maybe || 0}</Text>
              </View>
              <View style={styles.rsvpPill}>
                <Text style={styles.rsvpPillLabel}>No: </Text>
                <Text style={styles.rsvpPillValue}>{item.rsvpCounts?.no || 0}</Text>
              </View>

              <TouchableOpacity
                style={styles.viewAttendeesBtn}
                onPress={() => handleViewAttendees(item)}
              >
                <Text style={styles.viewAttendeesText}>View Roster →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDeleteAnnouncement(item)}
          >
            <Text style={styles.deleteBtnText}>Delete Notice</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.screenTitle}>Announcements & Meetings</Text>
            <Text style={styles.screenSubtitle}>
              Broadcast house notices & schedule resident meetings
            </Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={handleOpenPostModal}>
            <Text style={styles.addButtonText}>+ Post</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={announcements}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderAnnouncementItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📢</Text>
                <Text style={styles.emptyTitle}>No notices posted</Text>
                <Text style={styles.emptySubtitle}>
                  Tap "+ Post" to broadcast a house notice or schedule a meeting.
                </Text>
              </View>
            ) : null
          }
        />

        {/* Modal: Post Announcement */}
        <Modal
          visible={postModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setPostModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Post Announcement</Text>
              <Text style={styles.modalSubtitle}>
                Sends notification to all active residents.
              </Text>

              {postError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorBoxText}>{postError}</Text>
                </View>
              )}

              <ScrollView showsVerticalScrollIndicator={false}>
                <Input
                  label="Title"
                  placeholder="e.g. Water Tank Cleaning Notice"
                  value={title}
                  onChangeText={setTitle}
                />

                <Input
                  label="Body / Description"
                  placeholder="Details, instructions, or rules for residents..."
                  value={body}
                  onChangeText={setBody}
                  multiline
                  numberOfLines={4}
                  style={styles.bodyInput}
                />

                {/* Meeting Toggle */}
                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>This is a Scheduled Meeting</Text>
                  <Switch
                    value={isMeeting}
                    onValueChange={setIsMeeting}
                    trackColor={{ false: colors.cardBorder, true: colors.primary }}
                  />
                </View>

                {isMeeting && (
                  <View style={styles.meetingFields}>
                    <Input
                      label="Meeting Date & Time (YYYY-MM-DD HH:MM)"
                      placeholder="e.g. 2026-10-18 18:30"
                      value={meetingDateStr}
                      onChangeText={setMeetingDateStr}
                      helperText="Tenants will receive an automated 1-hour pre-meeting reminder"
                    />

                    <Input
                      label="Venue"
                      placeholder="e.g. Common Terrace / Room 101"
                      value={venue}
                      onChangeText={setVenue}
                    />
                  </View>
                )}

                <Button
                  title="Publish & Broadcast"
                  onPress={handleCreateAnnouncement}
                  loading={posting}
                  style={{ marginTop: 14 }}
                />

                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setPostModalVisible(false)}
                  style={{ marginTop: 10, marginBottom: 16 }}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Modal: Attendee Roster */}
        <Modal
          visible={attendeesModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setAttendeesModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>RSVP Roster</Text>
              <Text style={styles.modalSubtitle}>
                {selectedMeeting?.title}
              </Text>

              <ScrollView style={{ maxHeight: 350 }}>
                {attendees.length === 0 ? (
                  <Text style={styles.noRsvpsText}>No responses recorded yet.</Text>
                ) : (
                  attendees.map((att) => (
                    <View key={att.tenant_id} style={styles.attendeeRow}>
                      <View>
                        <Text style={styles.attendeeName}>
                          {att.tenant?.name || 'Resident'}
                        </Text>
                        <Text style={styles.attendeePhone}>
                          {att.tenant?.phone}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.rsvpBadge,
                          att.response === 'yes'
                            ? styles.yesBadge
                            : att.response === 'maybe'
                            ? styles.maybeBadge
                            : styles.noBadge,
                        ]}
                      >
                        <Text style={styles.rsvpBadgeText}>
                          {att.response.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>

              <Button
                title="Close"
                onPress={() => setAttendeesModalVisible(false)}
                style={{ marginTop: 16 }}
              />
            </View>
          </View>
        </Modal>
      </View>
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
    padding: 16,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  screenSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  meetingBadge: {
    backgroundColor: colors.badgeBg,
    borderColor: colors.primary,
    borderWidth: 1,
  },
  meetingBadgeText: {
    color: '#A5B4FC',
    fontSize: 10,
    fontWeight: '700',
  },
  generalBadge: {
    backgroundColor: colors.cardBorder,
  },
  generalBadgeText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  bodyText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  meetingInfoBox: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  meetingInfoText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  rsvpStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  rsvpPill: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  rsvpPillLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  rsvpPillValue: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  viewAttendeesBtn: {
    marginLeft: 'auto',
  },
  viewAttendeesText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  deleteBtn: {
    paddingVertical: 4,
  },
  deleteBtnText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 14,
  },
  bodyInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    marginTop: 4,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  meetingFields: {
    marginTop: 6,
  },
  errorBox: {
    backgroundColor: colors.errorBg,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorBoxText: {
    color: '#FEE2E2',
    fontSize: 12,
  },
  noRsvpsText: {
    color: colors.textMuted,
    textAlign: 'center',
    marginVertical: 20,
  },
  attendeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  attendeeName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  attendeePhone: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  rsvpBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  yesBadge: {
    backgroundColor: colors.successBg,
    borderColor: colors.success,
    borderWidth: 1,
  },
  maybeBadge: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warning,
    borderWidth: 1,
  },
  noBadge: {
    backgroundColor: colors.errorBg,
    borderColor: colors.error,
    borderWidth: 1,
  },
  rsvpBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
