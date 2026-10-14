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
  PaymentWithDetails,
  fetchAdminPaymentsQueue,
  confirmPayment,
  rejectPayment,
  generateMonthlyRentDues,
  fetchHouseSettings,
  updateHouseSettings,
} from '../../api/payments';
import { Setting } from '../../types/database';

export const AdminPaymentsScreen = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'generate' | 'settings' | 'history'>('pending');
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [settings, setSettings] = useState<Setting | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Generate Dues Form State
  const [targetMonth, setTargetMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<string | null>(null);

  // Settings State
  const [upiId, setUpiId] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Screenshot Preview Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [paymentsData, settingsData] = await Promise.all([
        fetchAdminPaymentsQueue(activeTab === 'history' ? 'confirmed' : 'pending'),
        fetchHouseSettings(),
      ]);
      setPayments(paymentsData);
      setSettings(settingsData);
      if (settingsData) {
        setUpiId(settingsData.owner_upi_id || '');
        setOwnerName(settingsData.owner_name || '');
      }
    } catch (err: any) {
      console.warn('Error loading payments:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleConfirmPayment = (item: PaymentWithDetails) => {
    Alert.alert(
      'Confirm Payment',
      `Confirm UTR: ${item.utr} for ₹${item.due?.amount} from ${item.due?.tenancy?.tenant?.name || 'Tenant'}?\n\nThis will mark the rent due as PAID.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Mark Paid',
          style: 'default',
          onPress: async () => {
            try {
              await confirmPayment(item.id, item.due_id);
              await loadData();
              Alert.alert('Success', 'Payment confirmed and rent marked as paid!');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to confirm payment');
            }
          },
        },
      ]
    );
  };

  const handleRejectPayment = (item: PaymentWithDetails) => {
    Alert.alert(
      'Reject Payment',
      `Are you sure you want to reject UTR: ${item.utr}? The tenant will be required to re-submit with correct details.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject Payment',
          style: 'destructive',
          onPress: async () => {
            try {
              await rejectPayment(item.id);
              await loadData();
              Alert.alert('Payment Rejected', 'Status updated to rejected.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to reject payment');
            }
          },
        },
      ]
    );
  };

  const handleGenerateDues = async () => {
    setGenerating(true);
    setGenerateResult(null);
    try {
      const res = await generateMonthlyRentDues(targetMonth);
      setGenerateResult(
        `Generated ${res.generated} new rent dues! (${res.skipped} already existed)`
      );
      Alert.alert(
        'Dues Created',
        `Successfully generated rent dues for ${res.generated} tenant(s) for month ${targetMonth}.`
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to generate rent dues');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!upiId.trim()) {
      Alert.alert('Validation Error', 'Please enter a valid UPI ID (e.g. 9876543210@upi)');
      return;
    }
    setSavingSettings(true);
    setSettingsSuccess(false);
    try {
      await updateHouseSettings({
        owner_upi_id: upiId.trim(),
        owner_name: ownerName.trim() || 'House Owner',
      });
      setSettingsSuccess(true);
      Alert.alert('Saved', 'Owner UPI details updated successfully!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const renderPaymentItem = ({ item }: { item: PaymentWithDetails }) => {
    const isPending = item.status === 'pending';

    return (
      <View style={styles.card}>
        <View style={styles.paymentHeader}>
          <View>
            <Text style={styles.tenantName}>
              {item.due?.tenancy?.tenant?.name || 'Tenant'}
            </Text>
            <Text style={styles.roomSubtext}>
              Room {item.due?.tenancy?.room?.room_no || 'N/A'} • {item.due?.tenancy?.tenant?.phone}
            </Text>
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.amountText}>₹{item.due?.amount || 0}</Text>
            <View
              style={[
                styles.statusBadge,
                isPending
                  ? styles.pendingBadge
                  : item.status === 'confirmed'
                  ? styles.confirmedBadge
                  : styles.rejectedBadge,
              ]}
            >
              <Text style={styles.statusBadgeText}>{item.status.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* UTR Details */}
        <View style={styles.utrSection}>
          <Text style={styles.utrLabel}>UTR / Transaction Reference:</Text>
          <Text style={styles.utrValue}>{item.utr}</Text>
          <Text style={styles.dateLabel}>
            Submitted on: {new Date(item.created_at).toLocaleString()}
          </Text>
        </View>

        {/* Screenshot preview button if attached */}
        {item.screenshot_url && (
          <TouchableOpacity
            style={styles.screenshotBtn}
            onPress={() => setPreviewImage(item.screenshot_url)}
          >
            <Text style={styles.screenshotBtnText}>📸 View Payment Screenshot</Text>
          </TouchableOpacity>
        )}

        {/* Action Buttons for Pending items */}
        {isPending && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.btn, styles.rejectBtn]}
              onPress={() => handleRejectPayment(item)}
            >
              <Text style={styles.rejectBtnText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.confirmBtn]}
              onPress={() => handleConfirmPayment(item)}
            >
              <Text style={styles.confirmBtnText}>Confirm Paid</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.topHeader}>
          <Text style={styles.screenTitle}>Payments & Rent</Text>
          <Text style={styles.screenSubtitle}>
            Manual UTR verification & monthly dues management
          </Text>
        </View>

        {/* Navigation Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'pending' && styles.tabItemActive]}
            onPress={() => setActiveTab('pending')}
          >
            <Text
              style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}
            >
              Pending ({payments.filter((p) => p.status === 'pending').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'generate' && styles.tabItemActive]}
            onPress={() => setActiveTab('generate')}
          >
            <Text
              style={[styles.tabText, activeTab === 'generate' && styles.tabTextActive]}
            >
              Create Dues
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'settings' && styles.tabItemActive]}
            onPress={() => setActiveTab('settings')}
          >
            <Text
              style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}
            >
              UPI Settings
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'history' && styles.tabItemActive]}
            onPress={() => setActiveTab('history')}
          >
            <Text
              style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}
            >
              History
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab 1 & 4: Pending / History Payments */}
        {(activeTab === 'pending' || activeTab === 'history') && (
          <FlatList
            data={payments}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderPaymentItem}
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
                  <Text style={styles.emptyIcon}>💳</Text>
                  <Text style={styles.emptyTitle}>
                    {activeTab === 'pending'
                      ? 'No pending payments'
                      : 'No confirmed payments found'}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {activeTab === 'pending'
                      ? 'All submitted tenant UTRs have been reviewed.'
                      : 'Confirmed payments will appear here as audit records.'}
                  </Text>
                </View>
              ) : null
            }
          />
        )}

        {/* Tab 2: Generate Monthly Dues */}
        {activeTab === 'generate' && (
          <ScrollView contentContainerStyle={styles.scrollSection}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Batch Generate Rent Dues</Text>
              <Text style={styles.cardDescription}>
                Creates rent due records for all active tenancies based on their assigned room rent.
              </Text>

              <Input
                label="Month (YYYY-MM-01)"
                placeholder="2026-10-01"
                value={targetMonth}
                onChangeText={setTargetMonth}
                helperText="Enter 1st of the month (e.g. 2026-11-01 for November)"
              />

              {generateResult && (
                <View style={styles.successBox}>
                  <Text style={styles.successBoxText}>{generateResult}</Text>
                </View>
              )}

              <Button
                title="Generate Monthly Dues"
                onPress={handleGenerateDues}
                loading={generating}
                style={{ marginTop: 8 }}
              />
            </View>
          </ScrollView>
        )}

        {/* Tab 3: UPI Settings */}
        {activeTab === 'settings' && (
          <ScrollView contentContainerStyle={styles.scrollSection}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>House Owner UPI ID</Text>
              <Text style={styles.cardDescription}>
                Tenants use this UPI ID to make deep link payments and scan QR codes.
              </Text>

              <Input
                label="Owner UPI ID / VPA"
                placeholder="e.g. 9876543210@upi or landlord@okicici"
                value={upiId}
                onChangeText={setUpiId}
                autoCapitalize="none"
              />

              <Input
                label="Payee Display Name"
                placeholder="e.g. 2nd_Home Landlord"
                value={ownerName}
                onChangeText={setOwnerName}
              />

              {settingsSuccess && (
                <View style={styles.successBox}>
                  <Text style={styles.successBoxText}>Settings saved successfully!</Text>
                </View>
              )}

              <Button
                title="Save UPI Configuration"
                onPress={handleSaveSettings}
                loading={savingSettings}
                style={{ marginTop: 8 }}
              />
            </View>
          </ScrollView>
        )}

        {/* Screenshot Modal */}
        <Modal
          visible={Boolean(previewImage)}
          animationType="fade"
          transparent
          onRequestClose={() => setPreviewImage(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.imageModalContent}>
              <Text style={styles.imageModalTitle}>Payment Receipt</Text>
              {previewImage && (
                <Image
                  source={{ uri: previewImage }}
                  style={styles.previewImage}
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 24,
  },
  scrollSection: {
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
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tenantName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  roomSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  amountCol: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.success,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  pendingBadge: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warning,
    borderWidth: 1,
  },
  confirmedBadge: {
    backgroundColor: colors.successBg,
    borderColor: colors.success,
    borderWidth: 1,
  },
  rejectedBadge: {
    backgroundColor: colors.errorBg,
    borderColor: colors.error,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  utrSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  utrLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  utrValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  dateLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  screenshotBtn: {
    backgroundColor: colors.background,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  screenshotBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmBtn: {
    backgroundColor: colors.success,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  rejectBtn: {
    backgroundColor: colors.error,
  },
  rejectBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
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
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  cardDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  successBox: {
    backgroundColor: colors.successBg,
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginVertical: 10,
  },
  successBoxText: {
    color: '#D1FAE5',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 20,
  },
  imageModalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    maxHeight: '90%',
  },
  imageModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  previewImage: {
    width: '100%',
    height: 350,
    borderRadius: 8,
  },
});
