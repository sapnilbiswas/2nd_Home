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
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { fetchTenantComplaints, submitComplaint } from '../../api/complaints';
import { compressAndUploadImage } from '../../api/cloudinary';
import { Complaint } from '../../types/database';

const CATEGORIES = [
  '⚡ Electrical',
  '🚿 Plumbing',
  '🧹 Cleanliness',
  '🌐 Wi-Fi / Internet',
  '🪑 Furniture',
  '🔊 Noise Disturbance',
  '❓ General Maintenance',
];

export const TenantComplaintsScreen = () => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New Complaint Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [details, setDetails] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Image Preview Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const loadComplaints = async () => {
    if (!user) return;
    try {
      const data = await fetchTenantComplaints(user.id);
      setComplaints(data);
    } catch (err: any) {
      console.warn('Error loading complaints:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadComplaints();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadComplaints();
  };

  const handleOpenModal = () => {
    setSelectedCategory(CATEGORIES[0]);
    setDetails('');
    setPhotoUri(null);
    setErrorText(null);
    setModalVisible(true);
  };

  const handlePickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to select image');
    }
  };

  const handleSubmit = async () => {
    if (!details.trim()) {
      setErrorText('Please describe the issue or maintenance need');
      return;
    }
    if (!user) return;

    setSubmitting(true);
    setErrorText(null);

    try {
      let photoUrl: string | null = null;
      if (photoUri) {
        try {
          photoUrl = await compressAndUploadImage(photoUri);
        } catch (uploadErr: any) {
          console.warn('Cloudinary upload warning:', uploadErr.message);
        }
      }

      await submitComplaint({
        tenantId: user.id,
        category: selectedCategory,
        details: details.trim(),
        photo_url: photoUrl,
      });

      setModalVisible(false);
      Alert.alert(
        'Complaint Submitted',
        'Your maintenance ticket has been registered. The house administrator will review and update the status.'
      );
      await loadComplaints();
    } catch (err: any) {
      setErrorText(err.message || 'Failed to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  const renderComplaintItem = ({ item }: { item: Complaint }) => {
    const isResolved = item.status === 'resolved';
    const isInProgress = item.status === 'in_progress';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.categoryTitle}>{item.category}</Text>
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

        <Text style={styles.dateText}>
          Reported on {new Date(item.created_at).toLocaleDateString()} at{' '}
          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>

        <Text style={styles.detailsText}>{item.details}</Text>

        {/* Photo Thumbnail */}
        {item.photo_url && (
          <TouchableOpacity
            style={styles.photoContainer}
            onPress={() => setPreviewImage(item.photo_url)}
          >
            <Image source={{ uri: item.photo_url }} style={styles.thumbnail} />
            <Text style={styles.photoCaption}>🔍 Tap to view photo</Text>
          </TouchableOpacity>
        )}

        {/* Admin Reply Box */}
        {item.admin_reply && (
          <View style={styles.replyBox}>
            <View style={styles.replyHeader}>
              <Text style={styles.replyBadge}>House Admin Response</Text>
            </View>
            <Text style={styles.replyText}>{item.admin_reply}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.screenTitle}>Complaints & Repairs</Text>
            <Text style={styles.screenSubtitle}>
              Raise house maintenance tickets with direct admin updates
            </Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={handleOpenModal}>
            <Text style={styles.addButtonText}>+ Raise Ticket</Text>
          </TouchableOpacity>
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
                <Text style={styles.emptyTitle}>No complaints reported</Text>
                <Text style={styles.emptySubtitle}>
                  Everything in order! If you ever face electrical, plumbing, or room issues, tap "+ Raise Ticket" above.
                </Text>
              </View>
            ) : null
          }
        />

        {/* Modal: New Complaint */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>New Maintenance Ticket</Text>
              <Text style={styles.modalSubtitle}>
                Select category, describe the problem, and attach a photo if helpful.
              </Text>

              {errorText && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorBoxText}>{errorText}</Text>
                </View>
              )}

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.fieldLabel}>Issue Category</Text>
                <View style={styles.chipsContainer}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.chip,
                        selectedCategory === cat && styles.chipSelected,
                      ]}
                      onPress={() => setSelectedCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selectedCategory === cat && styles.chipTextSelected,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Input
                  label="Description / Details"
                  placeholder="Describe what is broken, leaking, or needs attention..."
                  value={details}
                  onChangeText={setDetails}
                  multiline
                  numberOfLines={4}
                  style={styles.detailsInput}
                />

                <TouchableOpacity
                  style={styles.photoPickerBtn}
                  onPress={handlePickPhoto}
                >
                  <Text style={styles.photoPickerText}>
                    {photoUri
                      ? '📸 Photo Attached (Tap to replace)'
                      : '📎 Attach Photo of Issue (Optional)'}
                  </Text>
                </TouchableOpacity>

                {photoUri && (
                  <Image source={{ uri: photoUri }} style={styles.attachedPreview} />
                )}

                <Button
                  title="Submit Ticket"
                  onPress={handleSubmit}
                  loading={submitting}
                  style={{ marginTop: 14 }}
                />

                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setModalVisible(false)}
                  style={{ marginTop: 10, marginBottom: 16 }}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Modal: Image Preview */}
        <Modal
          visible={Boolean(previewImage)}
          animationType="fade"
          transparent
          onRequestClose={() => setPreviewImage(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.imageModalCard}>
              <Text style={styles.modalTitle}>Attached Photo</Text>
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
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
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
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
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
  dateText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 10,
  },
  detailsText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  photoContainer: {
    marginTop: 12,
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
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  replyHeader: {
    marginBottom: 4,
  },
  replyBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  replyText: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
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
    lineHeight: 18,
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
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  chipSelected: {
    backgroundColor: colors.badgeBg,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: '#A5B4FC',
    fontWeight: '700',
  },
  detailsInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  photoPickerBtn: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.cardBorder,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  photoPickerText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  attachedPreview: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 10,
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
