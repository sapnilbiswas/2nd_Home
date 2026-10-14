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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import {
  RoomWithOccupancy,
  fetchRoomsWithOccupancy,
  createRoom,
  updateRoom,
  deleteRoom,
} from '../../api/admin';

export const AdminRoomsScreen = () => {
  const [rooms, setRooms] = useState<RoomWithOccupancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomWithOccupancy | null>(null);
  const [roomNo, setRoomNo] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [capacity, setCapacity] = useState('1');
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const loadRooms = async () => {
    try {
      setErrorText(null);
      const data = await fetchRoomsWithOccupancy();
      setRooms(data);
    } catch (err: any) {
      console.warn('Error loading rooms:', err);
      setErrorText(err.message || 'Failed to fetch rooms');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadRooms();
  };

  const openAddModal = () => {
    setEditingRoom(null);
    setRoomNo('');
    setMonthlyRent('');
    setCapacity('1');
    setErrorText(null);
    setModalVisible(true);
  };

  const openEditModal = (room: RoomWithOccupancy) => {
    setEditingRoom(room);
    setRoomNo(room.room_no);
    setMonthlyRent(String(room.monthly_rent));
    setCapacity(String(room.capacity));
    setErrorText(null);
    setModalVisible(true);
  };

  const handleSaveRoom = async () => {
    if (!roomNo.trim()) {
      setErrorText('Please enter a room number (e.g. 101)');
      return;
    }
    const rentNum = parseInt(monthlyRent.trim(), 10);
    if (isNaN(rentNum) || rentNum <= 0) {
      setErrorText('Please enter a valid monthly rent amount');
      return;
    }
    const capNum = parseInt(capacity.trim(), 10);
    if (isNaN(capNum) || capNum <= 0) {
      setErrorText('Capacity must be at least 1');
      return;
    }

    if (editingRoom && capNum < editingRoom.occupied_beds) {
      setErrorText(
        `Capacity cannot be less than currently occupied beds (${editingRoom.occupied_beds})`
      );
      return;
    }

    setSaving(true);
    setErrorText(null);

    try {
      if (editingRoom) {
        await updateRoom(editingRoom.id, {
          room_no: roomNo.trim(),
          monthly_rent: rentNum,
          capacity: capNum,
        });
      } else {
        await createRoom({
          room_no: roomNo.trim(),
          monthly_rent: rentNum,
          capacity: capNum,
        });
      }

      setModalVisible(false);
      await loadRooms();
    } catch (err: any) {
      setErrorText(err.message || 'Failed to save room');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoom = (room: RoomWithOccupancy) => {
    if (room.occupied_beds > 0) {
      Alert.alert(
        'Cannot Delete Room',
        `Room ${room.room_no} currently has ${room.occupied_beds} active tenant(s). Reassign or end their tenancy before deleting.`
      );
      return;
    }

    Alert.alert(
      'Delete Room',
      `Are you sure you want to delete Room ${room.room_no}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRoom(room.id);
              await loadRooms();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete room');
            }
          },
        },
      ]
    );
  };

  const renderRoomItem = ({ item }: { item: RoomWithOccupancy }) => {
    const isFull = item.available_beds === 0;

    return (
      <View style={styles.roomCard}>
        <View style={styles.roomHeader}>
          <View>
            <Text style={styles.roomNumber}>Room {item.room_no}</Text>
            <Text style={styles.rentText}>₹{item.monthly_rent.toLocaleString('en-IN')} / month</Text>
          </View>
          <View style={[styles.badge, isFull ? styles.fullBadge : styles.vacantBadge]}>
            <Text style={[styles.badgeText, isFull ? styles.fullBadgeText : styles.vacantBadgeText]}>
              {isFull ? 'FULL' : `${item.available_beds} VACANT`}
            </Text>
          </View>
        </View>

        {/* Occupancy Indicator */}
        <View style={styles.occupancySection}>
          <View style={styles.occupancyLabels}>
            <Text style={styles.occupancyText}>
              Occupancy: {item.occupied_beds} / {item.capacity} Beds
            </Text>
            <Text style={styles.occupancyPercent}>
              {Math.round((item.occupied_beds / item.capacity) * 100)}%
            </Text>
          </View>
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min(100, (item.occupied_beds / item.capacity) * 100)}%`,
                  backgroundColor: isFull ? colors.error : colors.accent,
                },
              ]}
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => openEditModal(item)}
          >
            <Text style={styles.actionText}>Edit Details</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteAction]}
            onPress={() => handleDeleteRoom(item)}
          >
            <Text style={styles.deleteText}>Delete</Text>
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
            <Text style={styles.screenTitle}>Rooms & Beds</Text>
            <Text style={styles.screenSubtitle}>
              {rooms.reduce((acc, r) => acc + r.occupied_beds, 0)} occupied /{' '}
              {rooms.reduce((acc, r) => acc + r.capacity, 0)} total capacity
            </Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
            <Text style={styles.addButtonText}>+ Add Room</Text>
          </TouchableOpacity>
        </View>

        {errorText && !modalVisible && (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxText}>{errorText}</Text>
          </View>
        )}

        {/* Room List */}
        <FlatList
          data={rooms}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderRoomItem}
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
                <Text style={styles.emptyIcon}>🏠</Text>
                <Text style={styles.emptyTitle}>No rooms created yet</Text>
                <Text style={styles.emptySubtitle}>
                  Add your first room (e.g. Room 101) to begin allocating student beds.
                </Text>
                <Button
                  title="Add First Room"
                  onPress={openAddModal}
                  style={{ marginTop: 16 }}
                />
              </View>
            ) : null
          }
        />

        {/* Add/Edit Modal */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingRoom ? `Edit Room ${editingRoom.room_no}` : 'Add New Room'}
              </Text>
              <Text style={styles.modalSubtitle}>
                Set the room number, monthly rent per tenant, and bed capacity.
              </Text>

              {errorText && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorBoxText}>{errorText}</Text>
                </View>
              )}

              <ScrollView>
                <Input
                  label="Room Number"
                  placeholder="e.g. 101, 202, A-1"
                  value={roomNo}
                  onChangeText={setRoomNo}
                />

                <Input
                  label="Monthly Rent (₹)"
                  placeholder="e.g. 6000"
                  keyboardType="numeric"
                  value={monthlyRent}
                  onChangeText={setMonthlyRent}
                />

                <Input
                  label="Bed Capacity (Students)"
                  placeholder="e.g. 2"
                  keyboardType="numeric"
                  value={capacity}
                  onChangeText={setCapacity}
                  helperText="Maximum number of tenants allowed in this room"
                />

                <Button
                  title={editingRoom ? 'Update Room' : 'Create Room'}
                  onPress={handleSaveRoom}
                  loading={saving}
                  style={{ marginTop: 8 }}
                />

                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setModalVisible(false)}
                  style={{ marginTop: 10 }}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  listContent: {
    paddingBottom: 24,
  },
  roomCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  roomNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rentText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  fullBadge: {
    backgroundColor: colors.errorBg,
    borderColor: colors.error,
    borderWidth: 1,
  },
  fullBadgeText: {
    color: colors.error,
    fontSize: 11,
    fontWeight: '700',
  },
  vacantBadge: {
    backgroundColor: colors.successBg,
    borderColor: colors.success,
    borderWidth: 1,
  },
  vacantBadgeText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '700',
  },
  occupancySection: {
    marginTop: 14,
  },
  occupancyLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  occupancyText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  occupancyPercent: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: colors.cardBorder,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  actionText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  deleteAction: {},
  deleteText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
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
    lineHeight: 18,
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
