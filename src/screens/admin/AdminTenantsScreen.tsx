import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  RefreshControl,
  ScrollView,
  Share,
} from 'react-native';
import { colors } from '../../theme/colors';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import {
  TenantWithTenancy,
  RoomWithOccupancy,
  fetchTenantsWithTenancy,
  fetchRoomsWithOccupancy,
  createTenant,
  assignTenantRoom,
  endTenancy,
  toggleTenantActiveStatus,
  resetTenantPassword,
} from '../../api/admin';

export const AdminTenantsScreen = () => {
  const [tenants, setTenants] = useState<TenantWithTenancy[]>([]);
  const [rooms, setRooms] = useState<RoomWithOccupancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Add Tenant Modal
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Success Credentials Modal
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [newCredentials, setNewCredentials] = useState<{
    name: string;
    phone: string;
    email: string;
    tempPassword: string;
    roomNo?: string;
  } | null>(null);

  // Reassign Room Modal
  const [reassignModalVisible, setReassignModalVisible] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<TenantWithTenancy | null>(null);
  const [reassignRoomId, setReassignRoomId] = useState<number | null>(null);
  const [reassigning, setReassigning] = useState(false);

  const loadData = async () => {
    try {
      const [tenantsData, roomsData] = await Promise.all([
        fetchTenantsWithTenancy(),
        fetchRoomsWithOccupancy(),
      ]);
      setTenants(tenantsData);
      setRooms(roomsData);
    } catch (err: any) {
      console.warn('Error loading tenants:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleOpenAddModal = () => {
    setName('');
    setPhone('');
    setSelectedRoomId(null);
    setTempPassword('');
    setAddError(null);
    setAddModalVisible(true);
  };

  const handleCreateTenant = async () => {
    if (!name.trim()) {
      setAddError('Please enter the tenant name');
      return;
    }
    const cleanedPhone = phone.replace(/\D/g, '');
    if (cleanedPhone.length < 10) {
      setAddError('Please enter a valid 10-digit phone number');
      return;
    }

    setCreating(true);
    setAddError(null);

    try {
      const res = await createTenant({
        name: name.trim(),
        phone: cleanedPhone,
        roomId: selectedRoomId,
        tempPassword: tempPassword.trim() || undefined,
      });

      const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

      setNewCredentials({
        name: res.tenant.name,
        phone: res.tenant.phone,
        email: res.tenant.email,
        tempPassword: res.tenant.tempPassword,
        roomNo: selectedRoom?.room_no,
      });

      setAddModalVisible(false);
      setSuccessModalVisible(true);
      await loadData();
    } catch (err: any) {
      setAddError(err.message || 'Failed to create tenant');
    } finally {
      setCreating(false);
    }
  };

  const handleShareCredentials = async () => {
    if (!newCredentials) return;
    const msg = `Welcome to 2nd_Home, ${newCredentials.name}!\n\nYour Login Credentials:\nPhone: ${newCredentials.phone}\nTemporary Password: ${newCredentials.tempPassword}\nRoom: ${newCredentials.roomNo ? `Room ${newCredentials.roomNo}` : 'To be assigned'}\n\nPlease install the 2nd_Home app and log in. You will be prompted to set your private password on first login.`;
    await Share.share({ message: msg });
  };

  // Reassign Room
  const handleOpenReassignModal = (tenant: TenantWithTenancy) => {
    setSelectedTenant(tenant);
    setReassignRoomId(tenant.active_tenancy?.room_id || null);
    setReassignModalVisible(true);
  };

  const handleSaveReassignment = async () => {
    if (!selectedTenant) return;
    setReassigning(true);

    try {
      if (reassignRoomId) {
        await assignTenantRoom(selectedTenant.id, reassignRoomId);
      } else if (selectedTenant.active_tenancy) {
        await endTenancy(selectedTenant.active_tenancy.id);
      }
      setReassignModalVisible(false);
      await loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to assign room');
    } finally {
      setReassigning(false);
    }
  };

  // Free Bed / End Tenancy
  const handleEndTenancy = (tenant: TenantWithTenancy) => {
    if (!tenant.active_tenancy) return;
    Alert.alert(
      'Free Bed / End Tenancy',
      `End current tenancy for ${tenant.name} in Room ${tenant.active_tenancy.room?.room_no}? This frees the bed for other tenants.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Free Bed',
          style: 'destructive',
          onPress: async () => {
            try {
              await endTenancy(tenant.active_tenancy!.id);
              await loadData();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to end tenancy');
            }
          },
        },
      ]
    );
  };

  // Toggle Active Status (Disable Account)
  const handleToggleActive = (tenant: TenantWithTenancy) => {
    const action = tenant.is_active ? 'Disable Account' : 'Re-activate Account';
    const message = tenant.is_active
      ? `Disabling ${tenant.name}'s account prevents them from signing in, but preserves their payment and tenancy history.`
      : `Re-activate ${tenant.name}'s account so they can sign in again?`;

    Alert.alert(action, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action,
        style: tenant.is_active ? 'destructive' : 'default',
        onPress: async () => {
          try {
            await toggleTenantActiveStatus(tenant.id, !tenant.is_active);
            await loadData();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to update account status');
          }
        },
      },
    ]);
  };

  // Reset Password
  const handleResetPassword = (tenant: TenantWithTenancy) => {
    Alert.alert(
      'Reset Temporary Password',
      `Generate a new temporary password for ${tenant.name}? They will be required to change it on their next login.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate New Password',
          onPress: async () => {
            try {
              const res = await resetTenantPassword({ tenantId: tenant.id });
              Alert.alert(
                'Password Reset Successful',
                `New Temporary Password: ${res.newTempPassword}\n\nPlease share this with ${tenant.name}.`,
                [
                  {
                    text: 'Share',
                    onPress: () =>
                      Share.share({
                        message: `Hello ${tenant.name}, your temporary 2nd_Home password has been reset to: ${res.newTempPassword}. Please log in and set your new password.`,
                      }),
                  },
                  { text: 'OK' },
                ]
              );
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to reset password');
            }
          },
        },
      ]
    );
  };

  const filteredTenants = tenants.filter((t) => {
    const q = searchQuery.toLowerCase();
    return (
      (t.name?.toLowerCase().includes(q) ?? false) ||
      (t.phone?.includes(q) ?? false) ||
      (t.active_tenancy?.room?.room_no.toLowerCase().includes(q) ?? false)
    );
  });

  const renderTenantItem = ({ item }: { item: TenantWithTenancy }) => {
    const hasRoom = Boolean(item.active_tenancy?.room);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.tenantName}>{item.name || 'Unnamed Resident'}</Text>
            <Text style={styles.phoneText}>📞 {item.phone || 'No phone'}</Text>
          </View>
          <View style={styles.badgesCol}>
            <View
              style={[
                styles.badge,
                item.is_active ? styles.activeBadge : styles.inactiveBadge,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  item.is_active ? styles.activeBadgeText : styles.inactiveBadgeText,
                ]}
              >
                {item.is_active ? 'ACTIVE' : 'DISABLED'}
              </Text>
            </View>
          </View>
        </View>

        {/* Room Allocation Info */}
        <View style={styles.roomAllocSection}>
          <Text style={styles.roomAllocLabel}>Bed / Room Allocation:</Text>
          <View style={styles.roomAllocRow}>
            <Text style={[styles.roomAllocValue, !hasRoom && styles.unallocatedText]}>
              {hasRoom ? `🏠 Room ${item.active_tenancy?.room?.room_no} (₹${item.active_tenancy?.room?.monthly_rent}/mo)` : '⚠️ No room assigned'}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleOpenReassignModal(item)}
          >
            <Text style={styles.actionBtnText}>{hasRoom ? 'Change Room' : 'Assign Room'}</Text>
          </TouchableOpacity>

          {hasRoom && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleEndTenancy(item)}
            >
              <Text style={[styles.actionBtnText, { color: colors.warning }]}>Free Bed</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleResetPassword(item)}
          >
            <Text style={styles.actionBtnText}>Reset Pwd</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleToggleActive(item)}
          >
            <Text
              style={[
                styles.actionBtnText,
                { color: item.is_active ? colors.error : colors.success },
              ]}
            >
              {item.is_active ? 'Disable' : 'Enable'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.screenTitle}>Tenants</Text>
            <Text style={styles.screenSubtitle}>
              {tenants.filter((t) => t.is_active).length} active residents
            </Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={handleOpenAddModal}>
            <Text style={styles.addButtonText}>+ Add Tenant</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <Input
          placeholder="Search by name, phone, or room..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
        />

        {/* Tenants List */}
        <FlatList
          data={filteredTenants}
          keyExtractor={(item) => item.id}
          renderItem={renderTenantItem}
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
                <Text style={styles.emptyIcon}>👥</Text>
                <Text style={styles.emptyTitle}>No tenants found</Text>
                <Text style={styles.emptySubtitle}>
                  Tap "+ Add Tenant" to create their login and allocate their room bed.
                </Text>
              </View>
            ) : null
          }
        />

        {/* Modal: Add Tenant */}
        <Modal
          visible={addModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setAddModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add New Tenant</Text>
              <Text style={styles.modalSubtitle}>
                Creates account and generates temporary login credentials.
              </Text>

              {addError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorBoxText}>{addError}</Text>
                </View>
              )}

              <ScrollView>
                <Input
                  label="Full Name"
                  placeholder="e.g. Rahul Verma"
                  value={name}
                  onChangeText={setName}
                />

                <Input
                  label="10-Digit Phone Number"
                  placeholder="e.g. 9876543210"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  helperText="Used as their mobile login ID"
                />

                <Text style={styles.fieldLabel}>Assign Room Bed (Optional)</Text>
                <View style={styles.roomsPickerContainer}>
                  <TouchableOpacity
                    style={[
                      styles.roomOption,
                      selectedRoomId === null && styles.roomOptionSelected,
                    ]}
                    onPress={() => setSelectedRoomId(null)}
                  >
                    <Text
                      style={[
                        styles.roomOptionText,
                        selectedRoomId === null && styles.roomOptionTextSelected,
                      ]}
                    >
                      Allocate Later
                    </Text>
                  </TouchableOpacity>
                  {rooms.map((room) => {
                    const isFull = room.available_beds === 0;
                    return (
                      <TouchableOpacity
                        key={room.id}
                        style={[
                          styles.roomOption,
                          selectedRoomId === room.id && styles.roomOptionSelected,
                          isFull && styles.roomOptionDisabled,
                        ]}
                        disabled={isFull}
                        onPress={() => setSelectedRoomId(room.id)}
                      >
                        <Text
                          style={[
                            styles.roomOptionText,
                            selectedRoomId === room.id && styles.roomOptionTextSelected,
                            isFull && styles.roomOptionTextDisabled,
                          ]}
                        >
                          Room {room.room_no} ({room.available_beds} vacant)
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Input
                  label="Custom Temporary Password (Optional)"
                  placeholder="Leave empty for auto-generated"
                  value={tempPassword}
                  onChangeText={setTempPassword}
                  helperText="User is required to change password on first login"
                />

                <Button
                  title="Create Tenant Account"
                  onPress={handleCreateTenant}
                  loading={creating}
                  style={{ marginTop: 12 }}
                />

                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setAddModalVisible(false)}
                  style={{ marginTop: 10 }}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Modal: Created Credentials Card */}
        <Modal
          visible={successModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setSuccessModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.successIconBadge}>
                <Text style={{ fontSize: 32 }}>🎉</Text>
              </View>
              <Text style={styles.modalTitle}>Tenant Account Created!</Text>
              <Text style={styles.modalSubtitle}>
                Share these temporary credentials with the tenant.
              </Text>

              {newCredentials && (
                <View style={styles.credentialsCard}>
                  <View style={styles.credRow}>
                    <Text style={styles.credLabel}>Name</Text>
                    <Text style={styles.credVal}>{newCredentials.name}</Text>
                  </View>
                  <View style={styles.credRow}>
                    <Text style={styles.credLabel}>Login Phone</Text>
                    <Text style={styles.credVal}>{newCredentials.phone}</Text>
                  </View>
                  <View style={styles.credRow}>
                    <Text style={styles.credLabel}>Temp Password</Text>
                    <Text style={[styles.credVal, styles.credPassword]}>
                      {newCredentials.tempPassword}
                    </Text>
                  </View>
                  <View style={[styles.credRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.credLabel}>Assigned Room</Text>
                    <Text style={styles.credVal}>
                      {newCredentials.roomNo ? `Room ${newCredentials.roomNo}` : 'Not assigned'}
                    </Text>
                  </View>
                </View>
              )}

              <Button
                title="Share via WhatsApp / SMS"
                onPress={handleShareCredentials}
                style={{ marginTop: 16 }}
              />

              <Button
                title="Done"
                variant="outline"
                onPress={() => setSuccessModalVisible(false)}
                style={{ marginTop: 10 }}
              />
            </View>
          </View>
        </Modal>

        {/* Modal: Reassign Room */}
        <Modal
          visible={reassignModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setReassignModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Room Allocation</Text>
              <Text style={styles.modalSubtitle}>
                Select a room for {selectedTenant?.name}
              </Text>

              <ScrollView style={{ maxHeight: 300 }}>
                <TouchableOpacity
                  style={[
                    styles.roomOption,
                    reassignRoomId === null && styles.roomOptionSelected,
                  ]}
                  onPress={() => setReassignRoomId(null)}
                >
                  <Text
                    style={[
                      styles.roomOptionText,
                      reassignRoomId === null && styles.roomOptionTextSelected,
                    ]}
                  >
                    Unassign Room (No bed)
                  </Text>
                </TouchableOpacity>

                {rooms.map((room) => {
                  const isCurrent = selectedTenant?.active_tenancy?.room_id === room.id;
                  const isFull = !isCurrent && room.available_beds === 0;

                  return (
                    <TouchableOpacity
                      key={room.id}
                      style={[
                        styles.roomOption,
                        reassignRoomId === room.id && styles.roomOptionSelected,
                        isFull && styles.roomOptionDisabled,
                      ]}
                      disabled={isFull}
                      onPress={() => setReassignRoomId(room.id)}
                    >
                      <Text
                        style={[
                          styles.roomOptionText,
                          reassignRoomId === room.id && styles.roomOptionTextSelected,
                          isFull && styles.roomOptionTextDisabled,
                        ]}
                      >
                        Room {room.room_no} {isCurrent ? '(Current)' : `(${room.available_beds} vacant)`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Button
                title="Confirm Allocation"
                onPress={handleSaveReassignment}
                loading={reassigning}
                style={{ marginTop: 16 }}
              />

              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setReassignModalVisible(false)}
                style={{ marginTop: 10 }}
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
    marginBottom: 12,
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
    paddingVertical: 10,
    borderRadius: 10,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  searchInput: {
    marginBottom: 12,
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
  phoneText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badgesCol: {
    alignItems: 'flex-end',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  activeBadge: {
    backgroundColor: colors.successBg,
    borderColor: colors.success,
    borderWidth: 1,
  },
  activeBadgeText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '700',
  },
  inactiveBadge: {
    backgroundColor: colors.cardBorder,
  },
  inactiveBadgeText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  roomAllocSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  roomAllocLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  roomAllocRow: {
    marginTop: 2,
  },
  roomAllocValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  unallocatedText: {
    color: colors.warning,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  actionBtn: {
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  roomsPickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  roomOption: {
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  roomOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.badgeBg,
  },
  roomOptionDisabled: {
    opacity: 0.4,
  },
  roomOptionText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  roomOptionTextSelected: {
    color: '#A5B4FC',
    fontWeight: '700',
  },
  roomOptionTextDisabled: {
    color: colors.textMuted,
  },
  successIconBadge: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  credentialsCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginTop: 10,
  },
  credRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  credLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  credVal: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  credPassword: {
    color: colors.accent,
    fontFamily: 'monospace',
    fontWeight: '700',
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
