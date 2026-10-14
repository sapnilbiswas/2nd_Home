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
import QRCode from 'react-native-qrcode-svg';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import {
  fetchTenantDuesWithPayments,
  fetchHouseSettings,
  submitRentPayment,
} from '../../api/payments';
import { buildUpiUri, openUpiApp } from '../../utils/upi';
import { compressAndUploadImage } from '../../api/cloudinary';
import { Setting } from '../../types/database';

export const TenantPaymentScreen = () => {
  const { user } = useAuth();
  const [dues, setDues] = useState<any[]>([]);
  const [settings, setSettings] = useState<Setting | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pay Modal State
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [selectedDue, setSelectedDue] = useState<any | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  // UTR Submission Form
  const [utr, setUtr] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) return;
    try {
      const [duesData, settingsData] = await Promise.all([
        fetchTenantDuesWithPayments(user.id),
        fetchHouseSettings(),
      ]);
      setDues(duesData || []);
      setSettings(settingsData);
    } catch (err: any) {
      console.warn('Error loading tenant payments:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleOpenPayModal = (due: any) => {
    setSelectedDue(due);
    setShowQr(false);
    setCopied(false);
    setUtr('');
    setScreenshotUri(null);
    setSubmitError(null);
    setPayModalVisible(true);
  };

  const handleCopyUpi = async () => {
    if (!settings?.owner_upi_id) return;
    await Clipboard.setStringAsync(settings.owner_upi_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDeepLink = async (appType: 'generic' | 'phonepe' | 'gpay') => {
    if (!settings?.owner_upi_id || !selectedDue) return;

    const roomNo = selectedDue.tenancy?.room?.room_no || 'Room';
    const monthName = new Date(selectedDue.month).toLocaleString('default', {
      month: 'short',
    });

    const success = await openUpiApp(
      {
        upiId: settings.owner_upi_id,
        payeeName: settings.owner_name || '2nd_Home',
        amount: selectedDue.amount,
        note: `Rent Room ${roomNo} ${monthName}`,
      },
      appType
    );

    if (!success) {
      setShowQr(true);
      Alert.alert(
        'UPI App Not Detected',
        'Could not automatically launch the selected UPI app. Please use the QR code below or copy the UPI ID directly into your payment app.'
      );
    }
  };

  const handlePickScreenshot = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setScreenshotUri(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Image Picker Error', err.message);
    }
  };

  const handleSubmitPayment = async () => {
    if (!utr.trim()) {
      setSubmitError('Please enter your 12-digit UTR transaction reference');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      let uploadedUrl: string | null = null;
      if (screenshotUri) {
        setUploadingImage(true);
        try {
          uploadedUrl = await compressAndUploadImage(screenshotUri);
        } catch (uploadErr: any) {
          console.warn('Screenshot upload skipped/failed:', uploadErr.message);
        } finally {
          setUploadingImage(false);
        }
      }

      await submitRentPayment({
        due_id: selectedDue.id,
        utr: utr.trim(),
        screenshot_url: uploadedUrl,
      });

      setPayModalVisible(false);
      Alert.alert(
        'Payment Submitted!',
        'Your UTR has been submitted for admin verification. Once the house manager checks their bank statement, your rent will be confirmed.'
      );
      await loadData();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit payment');
    } finally {
      setSubmitting(false);
    }
  };

  const renderDueItem = ({ item }: { item: any }) => {
    const isPaid = item.status === 'paid';
    const latestPayment = item.payments?.[item.payments.length - 1];
    const isPending = !isPaid && latestPayment?.status === 'pending';
    const isRejected = !isPaid && latestPayment?.status === 'rejected';

    const monthFormatted = new Date(item.month).toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    });

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.dueMonth}>{monthFormatted}</Text>
            <Text style={styles.roomText}>
              Room {item.tenancy?.room?.room_no || 'N/A'}
            </Text>
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.amountText}>₹{item.amount.toLocaleString('en-IN')}</Text>
            <View
              style={[
                styles.badge,
                isPaid
                  ? styles.paidBadge
                  : isPending
                  ? styles.pendingBadge
                  : isRejected
                  ? styles.rejectedBadge
                  : styles.unpaidBadge,
              ]}
            >
              <Text style={styles.badgeText}>
                {isPaid
                  ? 'PAID'
                  : isPending
                  ? 'PENDING'
                  : isRejected
                  ? 'REJECTED'
                  : 'DUE'}
              </Text>
            </View>
          </View>
        </View>

        {/* Status message */}
        <View style={styles.statusSection}>
          {isPaid ? (
            <Text style={styles.paidMessage}>
              ✅ Payment confirmed by administrator.
            </Text>
          ) : isPending ? (
            <View>
              <Text style={styles.pendingMessage}>
                ⏳ Verification pending. UTR: {latestPayment.utr}
              </Text>
              <Text style={styles.subMessage}>
                Submitted on {new Date(latestPayment.created_at).toLocaleDateString()}
              </Text>
            </View>
          ) : isRejected ? (
            <View>
              <Text style={styles.rejectedMessage}>
                ❌ Payment was rejected. Please re-check UTR and submit again.
              </Text>
              <Button
                title="Re-submit Payment"
                onPress={() => handleOpenPayModal(item)}
                style={{ marginTop: 10 }}
              />
            </View>
          ) : (
            <Button
              title="Pay Rent via UPI"
              onPress={() => handleOpenPayModal(item)}
              style={styles.payButton}
            />
          )}
        </View>
      </View>
    );
  };

  const upiQrUri =
    settings?.owner_upi_id && selectedDue
      ? buildUpiUri({
          upiId: settings.owner_upi_id,
          payeeName: settings.owner_name || '2nd_Home',
          amount: selectedDue.amount,
          note: `Rent Room ${selectedDue.tenancy?.room?.room_no || ''} ${new Date(
            selectedDue.month
          ).toLocaleString('default', { month: 'short' })}`,
        })
      : '';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topHeader}>
          <Text style={styles.screenTitle}>My Rent & Payments</Text>
          <Text style={styles.screenSubtitle}>
            Direct UPI transfer, instant UTR submission & payment receipts
          </Text>
        </View>

        <FlatList
          data={dues}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderDueItem}
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
                <Text style={styles.emptyIcon}>🎉</Text>
                <Text style={styles.emptyTitle}>No rent dues found</Text>
                <Text style={styles.emptySubtitle}>
                  You do not have any pending monthly dues at this time.
                </Text>
              </View>
            ) : null
          }
        />

        {/* Modal: Pay Rent & Submit UTR */}
        <Modal
          visible={payModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setPayModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>
                  Pay Rent • ₹{selectedDue?.amount}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Step 1: Pay via your preferred UPI application or QR code.
                </Text>

                {/* Owner UPI Card */}
                <View style={styles.upiInfoCard}>
                  <Text style={styles.upiLabel}>Pay to House UPI ID:</Text>
                  <View style={styles.upiRow}>
                    <Text style={styles.upiIdText}>
                      {settings?.owner_upi_id || '9876543210@upi'}
                    </Text>
                    <TouchableOpacity
                      style={styles.copyBtn}
                      onPress={handleCopyUpi}
                    >
                      <Text style={styles.copyBtnText}>
                        {copied ? 'Copied! ✓' : 'Copy'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Deep Link Buttons */}
                <View style={styles.buttonStack}>
                  <TouchableOpacity
                    style={[styles.appBtn, styles.phonepeBtn]}
                    onPress={() => handleDeepLink('phonepe')}
                  >
                    <Text style={styles.appBtnText}>🟣 Pay with PhonePe</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.appBtn, styles.gpayBtn]}
                    onPress={() => handleDeepLink('gpay')}
                  >
                    <Text style={styles.appBtnText}>🔵 Pay with Google Pay</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.appBtn, styles.genericBtn]}
                    onPress={() => handleDeepLink('generic')}
                  >
                    <Text style={styles.appBtnText}>🟢 Pay with Any UPI App</Text>
                  </TouchableOpacity>
                </View>

                {/* QR Code Fallback Toggle */}
                <TouchableOpacity
                  style={styles.qrToggle}
                  onPress={() => setShowQr(!showQr)}
                >
                  <Text style={styles.qrToggleText}>
                    {showQr ? '▲ Hide QR Code' : '▼ Show QR Code to Scan'}
                  </Text>
                </TouchableOpacity>

                {showQr && upiQrUri && (
                  <View style={styles.qrContainer}>
                    <QRCode value={upiQrUri} size={180} />
                    <Text style={styles.qrCaption}>
                      Scan with any UPI app on another device
                    </Text>
                  </View>
                )}

                {/* Step 2: Enter UTR */}
                <View style={styles.step2Divider}>
                  <Text style={styles.step2Title}>
                    Step 2: Submit UTR Reference
                  </Text>
                  <Text style={styles.step2Subtitle}>
                    Enter the 12-digit transaction ID / UTR number from your payment app.
                  </Text>
                </View>

                {submitError && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorBoxText}>{submitError}</Text>
                  </View>
                )}

                <Input
                  label="12-Digit UTR Number"
                  placeholder="e.g. 428190348219"
                  value={utr}
                  onChangeText={setUtr}
                  autoCapitalize="characters"
                />

                <TouchableOpacity
                  style={styles.screenshotPicker}
                  onPress={handlePickScreenshot}
                >
                  <Text style={styles.screenshotPickerText}>
                    {screenshotUri
                      ? '📸 Screenshot Attached (Tap to change)'
                      : '📎 Attach Payment Screenshot (Optional)'}
                  </Text>
                </TouchableOpacity>

                {screenshotUri && (
                  <Image
                    source={{ uri: screenshotUri }}
                    style={styles.thumbImage}
                  />
                )}

                <Button
                  title="Submit Payment for Verification"
                  onPress={handleSubmitPayment}
                  loading={submitting || uploadingImage}
                  style={{ marginTop: 14 }}
                />

                <Button
                  title="Close"
                  variant="outline"
                  onPress={() => setPayModalVisible(false)}
                  style={{ marginTop: 10, marginBottom: 20 }}
                />
              </ScrollView>
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
    alignItems: 'flex-start',
  },
  dueMonth: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  roomText: {
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
    color: colors.textPrimary,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  paidBadge: {
    backgroundColor: colors.successBg,
    borderColor: colors.success,
    borderWidth: 1,
  },
  pendingBadge: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warning,
    borderWidth: 1,
  },
  rejectedBadge: {
    backgroundColor: colors.errorBg,
    borderColor: colors.error,
    borderWidth: 1,
  },
  unpaidBadge: {
    backgroundColor: colors.cardBorder,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  paidMessage: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '600',
  },
  pendingMessage: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '600',
  },
  rejectedMessage: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '600',
  },
  subMessage: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  payButton: {
    marginTop: 4,
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
  upiInfoCard: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 14,
  },
  upiLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  upiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  upiIdText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accent,
  },
  copyBtn: {
    backgroundColor: colors.badgeBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  copyBtnText: {
    color: '#A5B4FC',
    fontSize: 12,
    fontWeight: '700',
  },
  buttonStack: {
    gap: 8,
    marginBottom: 12,
  },
  appBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  phonepeBtn: {
    backgroundColor: '#5F259F',
  },
  gpayBtn: {
    backgroundColor: '#1A73E8',
  },
  genericBtn: {
    backgroundColor: colors.primary,
  },
  appBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  qrToggle: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  qrToggleText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  qrContainer: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginVertical: 10,
  },
  qrCaption: {
    color: '#334155',
    fontSize: 11,
    marginTop: 8,
    fontWeight: '500',
  },
  step2Divider: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    marginBottom: 12,
  },
  step2Title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  step2Subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  screenshotPicker: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.cardBorder,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  screenshotPickerText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  thumbImage: {
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
});
