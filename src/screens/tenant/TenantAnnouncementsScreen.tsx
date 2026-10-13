import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import {
  AnnouncementWithRsvps,
  fetchAnnouncements,
  submitMeetingRsvp,
  scheduleLocalMeetingReminder,
} from '../../api/announcements';
import { RsvpResponse } from '../../types/database';

export const TenantAnnouncementsScreen = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<AnnouncementWithRsvps[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingRsvpId, setSubmittingRsvpId] = useState<number | null>(null);

  const loadAnnouncements = async () => {
    try {
      const data = await fetchAnnouncements(user?.id);
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
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAnnouncements();
  };

  const handleRsvp = async (
    announcement: AnnouncementWithRsvps,
    response: RsvpResponse
  ) => {
    if (!user) return;
    setSubmittingRsvpId(announcement.id);

    try {
      await submitMeetingRsvp(announcement.id, user.id, response);

      if (response === 'yes') {
        await scheduleLocalMeetingReminder(announcement);
      }

      // Optimistically update local state
      setAnnouncements((prev) =>
        prev.map((a) => {
          if (a.id !== announcement.id) return a;
          const oldResponse = a.userRsvp;
          const counts = { ...(a.rsvpCounts || { yes: 0, maybe: 0, no: 0 }) };
          if (oldResponse) {
            counts[oldResponse] = Math.max(0, counts[oldResponse] - 1);
          }
          counts[response] = (counts[response] || 0) + 1;
          return { ...a, userRsvp: response, rsvpCounts: counts };
        })
      );

      Alert.alert(
        'RSVP Updated',
        response === 'yes'
          ? 'Marked as attending! A local reminder will alert you 1 hour before the meeting.'
          : `Marked as ${response}.`
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit RSVP');
    } finally {
      setSubmittingRsvpId(null);
    }
  };

  const renderAnnouncementItem = ({ item }: { item: AnnouncementWithRsvps }) => {
    const isMeeting = item.is_meeting;
    const meetingDate = item.meeting_at ? new Date(item.meeting_at) : null;

    return (
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.badgeRow}>
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
          </View>
          <Text style={styles.dateText}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>

        {/* Title & Body */}
        <Text style={styles.titleText}>{item.title}</Text>
        <Text style={styles.bodyText}>{item.body}</Text>

        {/* Meeting Specific Details */}
        {isMeeting && (
          <View style={styles.meetingBox}>
            <View style={styles.meetingInfoRow}>
              <Text style={styles.meetingInfoIcon}>⏰</Text>
              <View>
                <Text style={styles.meetingInfoLabel}>Date & Time</Text>
                <Text style={styles.meetingInfoValue}>
                  {meetingDate?.toLocaleDateString([], {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  at{' '}
                  {meetingDate?.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>

            {item.venue && (
              <View style={[styles.meetingInfoRow, { marginTop: 8 }]}>
                <Text style={styles.meetingInfoIcon}>📍</Text>
                <View>
                  <Text style={styles.meetingInfoLabel}>Venue</Text>
                  <Text style={styles.meetingInfoValue}>{item.venue}</Text>
                </View>
              </View>
            )}

            {/* RSVP Buttons */}
            <View style={styles.rsvpSection}>
              <Text style={styles.rsvpSectionTitle}>Will you attend?</Text>
              <View style={styles.rsvpButtonsRow}>
                <TouchableOpacity
                  style={[
                    styles.rsvpBtn,
                    item.userRsvp === 'yes' && styles.rsvpBtnSelectedYes,
                  ]}
                  disabled={submittingRsvpId === item.id}
                  onPress={() => handleRsvp(item, 'yes')}
                >
                  <Text
                    style={[
                      styles.rsvpBtnText,
                      item.userRsvp === 'yes' && styles.rsvpBtnTextSelected,
                    ]}
                  >
                    ✓ Yes ({item.rsvpCounts?.yes || 0})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.rsvpBtn,
                    item.userRsvp === 'maybe' && styles.rsvpBtnSelectedMaybe,
                  ]}
                  disabled={submittingRsvpId === item.id}
                  onPress={() => handleRsvp(item, 'maybe')}
                >
                  <Text
                    style={[
                      styles.rsvpBtnText,
                      item.userRsvp === 'maybe' && styles.rsvpBtnTextSelected,
                    ]}
                  >
                    ? Maybe ({item.rsvpCounts?.maybe || 0})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.rsvpBtn,
                    item.userRsvp === 'no' && styles.rsvpBtnSelectedNo,
                  ]}
                  disabled={submittingRsvpId === item.id}
                  onPress={() => handleRsvp(item, 'no')}
                >
                  <Text
                    style={[
                      styles.rsvpBtnText,
                      item.userRsvp === 'no' && styles.rsvpBtnTextSelected,
                    ]}
                  >
                    ✕ No ({item.rsvpCounts?.no || 0})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topHeader}>
          <Text style={styles.screenTitle}>Announcements & Meetings</Text>
          <Text style={styles.screenSubtitle}>
            House notices, scheduled meetings & resident RSVPs
          </Text>
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
                <Text style={styles.emptyTitle}>No announcements yet</Text>
                <Text style={styles.emptySubtitle}>
                  House notices and meeting invites posted by the administrator will appear here.
                </Text>
              </View>
            ) : null
          }
        />
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
    marginBottom: 16,
    paddingHorizontal: 4,
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
  badgeRow: {
    flexDirection: 'row',
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
  meetingBox: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  meetingInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  meetingInfoIcon: {
    fontSize: 18,
  },
  meetingInfoLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  meetingInfoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  rsvpSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  rsvpSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 8,
  },
  rsvpButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rsvpBtn: {
    flex: 1,
    backgroundColor: colors.card,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  rsvpBtnSelectedYes: {
    backgroundColor: colors.successBg,
    borderColor: colors.success,
  },
  rsvpBtnSelectedMaybe: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warning,
  },
  rsvpBtnSelectedNo: {
    backgroundColor: colors.errorBg,
    borderColor: colors.error,
  },
  rsvpBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  rsvpBtnTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
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
    paddingHorizontal: 20,
  },
});
