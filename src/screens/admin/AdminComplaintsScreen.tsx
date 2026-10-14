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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import {
  ComplaintWithTenant,
  fetchAdminComplaints,
  updateComplaintStatusAndReply,
} from '../../api/complaints';
import { ComplaintStatus } from '../../types/database';

export const AdminComplaintsScreen = () => {
  const [complaints, setComplaints] = useState<ComplaintWithTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | ComplaintStatus>('all');

  // Response Modal State
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintWithTenant | null>(null);
  const [newStatus, setNewStatus] = useState<ComplaintStatus>('open');
  const [replyText, setReplyText] = useState('');
  const [saving, setSaving] = useState(false);

  // Image Preview
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const loadComplaints = async () => {
    try {
      const data = await fetchAdminComplaints(statusFilter);
      setComplaints(data);
    } catch (err: any) {
      console.warn('Error loading admin complaints:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadComplaints();
  }, [statusFilter]);

  const onRefresh = () => {
    setRefreshing(true);
    loadComplaints();
  };

  const handleOpenResponseModal = (item: ComplaintWithTenant) => {
    setSelectedComplaint(item);
    setNewStatus(item.status);
    setReplyText(item.admin_reply || '');
    loadComplaints();
  };

  const handleSaveResponse = async () => {
    if (!selectedComplaint) return;
    setSaving(true);

    try {
      await updateComplaintStatusAndReply({
        complaintId: selectedComplaint.id,
        status: newStatus,
        adminReply: replyText,
        tenantPushToken: selectedComplaint.tenant?.push_token,
        tenantName: selectedComplaint.tenant?.name || undefined,
        category: selectedComplaint.category,
      });

      setSelectedComplaint(null);
      Alert.alert('Updated', 'Ticket status and reply updated. Push notification sent to tenant.');
      await loadComplaints();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update complaint');
    } finally {
      setSaving(false);
    }
  };

  const renderComplaintItem = ({ item }: { item: ComplaintWithTenant }) => {
    const isResolved = item.status === 'resolved';
    const isInProgress = item.status === 'in_progress';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.tenantName}>{item.tenant?.name || 'Tenant'}</Text>
            <Text style={styles.phoneSubtext}>📞 {item.tenant?.phone || 'No phone'}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              isResolved
                ? styles.resolvedBadge
                : isInProgress
                ? styles.inProgressBadge
                : styles.openBadge,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                isResolved
                  ? styles.resolvedText
                  : isInProgress
                  ? styles.inProgressText
                  : styles.openText,
              ]}
            >
              {item.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.categoryRow}>
          <Text style={styles.categoryLabel}>{item.category}</Text>
          <Text style={styles.dateLabel}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>

        <Text style={styles.detailsText}>{item.details}</Text>

        {/* Thumbnail if photo attached */}
        {item.photo_url && (
          <TouchableOpacity
            style={styles.photoContainer}
            onPress={() => setPreviewImage(item.photo_url)}
          >
            <Image source={{ uri: item.photo_url }} style={styles.thumbnail} />
            <Text style={styles.photoCaption}>🔍 View attached photo</Text>
          </TouchableOpacity>
        )}

        {/* Current Admin Reply if exists */}
        {item.admin_reply && (
          <View style={styles.replyBox}>
            <Text style={styles.replyHeader}>Your Reply:</Text>
            <Text style={styles.replyText}>{item.admin_reply}</Text>
          </View>
        )}

        {/* Action Button */}
        <TouchableOpacity
          style={styles.respondButton}
          onPress={() => handleOpenResponseModal(item)}
        >
          <Text style={styles.respondButtonText}>
            {item.admin_reply ? 'Update Status / Edit Reply' : 'Respond & Update Status'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topHeader}>
          <Text style={styles.screenTitle}>Complaints & Repairs</Text>
          <Text style={styles.screenSubtitle}>
            Triage maintenance tickets, dispatch updates & replies
          </Text>
        </View>

        {/* Filter Bar */}
        <View style={styles.filterBar}>
          {(['all', 'open', 'in_progress', 'resolved'] as const).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterItem,
                statusFilter === filter && styles.filterItemActive,
              ]}
              onPress={() => setStatusFilter(filter)}
            >
              <Text
                style={[
                  styles.filterText,
                  statusFilter === filter && styles.filterTextActive,
                ]}
              >
                {filter === 'all'
                  ? 'All'
                  : filter === 'in_progress'
                  ? 'In Progress'
                  : filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={complaints}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderComplaintItem}
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
                <Text style={styles.emptyIcon}>🛠️</Text>
                <Text style={styles.emptyTitle}>No tickets found</Text>
                <Text style={styles.emptySubtitle}>
                  No maintenance complaints match the selected filter.
                </Text>
              </View>
            ) : null
          }
        />

        {/* Modal: Status & Reply */}
        <Modal
          visible={Boolean(selectedComplaint)}
          animationType="slide"
          transparent
          onRequestClose={() => setSelectedComplaint(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Manage Ticket #{selectedComplaint?.id}</Text>
              <Text style={styles.modalSubtitle}>
                {selectedComplaint?.tenant?.name} • {selectedComplaint?.category}
              </Text>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.fieldLabel}>Set Ticket Status</Text>
                <View style={styles.statusChipsContainer}>
                  {(['open', 'in_progress', 'resolved'] as const).map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.statusChip,
                        newStatus === s && styles.statusChipSelected,
                      ]}
                      onPress={() => setNewStatus(s)}
                    >
                      <Text
                        style={[
                          styles.statusChipText,
                          newStatus === s && styles.statusChipTextSelected,
                        ]}
                      >
                        {s === 'in_progress' ? 'In Progress' : s.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Input
                  label="Admin Reply to Resident"
                  placeholder="e.g. Electrician scheduled for tomorrow 10 AM, please be available..."
                  value={replyText}
                  onChangeText={setReplyText}
                  multiline
                  numberOfLines={4}
                  style={styles.replyInput}
                  helperText="The tenant will receive this message as an in-app reply and push alert"
                />

                <Button
                  title="Save Status & Send Reply"
                  onPress={handleSaveResponse}
                  loading={saving}
                  style={{ marginTop: 14 }}
                />

                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setSelectedComplaint(null)}
                  style={{ marginTop: 10, marginBottom: 16 }}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Image Preview Modal */}
        <Modal
          visible={Boolean(previewImage)}
          animationType="fade"
          transparent
          onRequestClose={() => setPreviewImage(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.imageModalCard}>
              <Text style={styles.modalTitle}>Complaint Photo</Text>
              {previewImage && (
                <Image
                  source={{ uri: previewImage }}
                  style={styles.fullPreview}
                  resizeMode="contain"
                />
              )}
              <Button
                title="Close"
                onPress={() => setPreviewImage(null)}
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
    marginBottom: 14,
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
  filterBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filterItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterItemActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
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
    alignItems: 'flex-start',
  },
  tenantName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  phoneSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  openBadge: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warning,
    borderWidth: 1,
  },
  openText: {
    color: colors.warning,
  },
  inProgressBadge: {
    backgroundColor: '#1E3A8A',
    borderColor: '#3B82F6',
    borderWidth: 1,
  },
  inProgressText: {
    color: '#93C5FD',
  },
  resolvedBadge: {
    backgroundColor: colors.successBg,
    borderColor: colors.success,
    borderWidth: 1,
  },
  resolvedText: {
    color: colors.success,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 6,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  dateLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  detailsText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  photoContainer: {
    marginTop: 10,
  },
  thumbnail: {
    width: '100%',
    height: 140,
    borderRadius: 8,
  },
  photoCaption: {
    fontSize: 11,
    color: colors.primary,
    marginTop: 4,
    fontWeight: '600',
  },
  replyBox: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  replyHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  replyText: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  respondButton: {
    backgroundColor: colors.background,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  respondButtonText: {
    color: colors.primary,
    fontSize: 13,
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
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  statusChipsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statusChip: {
    flex: 1,
    backgroundColor: colors.background,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  statusChipSelected: {
    backgroundColor: colors.badgeBg,
    borderColor: colors.primary,
  },
  statusChipText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  statusChipTextSelected: {
    color: '#A5B4FC',
    fontWeight: '700',
  },
  replyInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  imageModalCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    maxHeight: '90%',
  },
  fullPreview: {
    width: '100%',
    height: 350,
    borderRadius: 8,
    marginTop: 10,
  },
});
