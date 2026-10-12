import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { Button } from '../../components/Button';
import { supabase } from '../../api/supabase';
import { Tenancy, Room } from '../../types/database';

export const TenantHomeScreen = ({ navigation }: any) => {
  const { profile, user, signOut } = useAuth();
  const [tenancy, setTenancy] = useState<(Tenancy & { room?: Room }) | null>(null);
  const [unpaidDuesCount, setUnpaidDuesCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTenantData = async () => {
    if (!user) return;
    try {
      // 1. Fetch tenancy with room
      const { data: tenancyData, error: tenancyError } = await supabase
        .from('tenancies')
        .select('*, room:rooms(*)')
        .eq('tenant_id', user.id)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tenancyData) {
        setTenancy(tenancyData as any);
      }

      // 2. Fetch unpaid dues
      if (tenancyData?.id) {
        const { count } = await supabase
          .from('rent_dues')
          .select('id', { count: 'exact', head: true })
          .eq('tenancy_id', tenancyData.id)
          .eq('status', 'unpaid');

        setUnpaidDuesCount(count ?? 0);
      }
    } catch (err) {
      console.warn('Error fetching tenant home data:', err);
    }
  };

  useEffect(() => {
    fetchTenantData();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTenantData();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome Home</Text>
            <Text style={styles.userName}>{profile?.name || 'Resident'}</Text>
          </View>
          <View style={styles.roomBadge}>
            <Text style={styles.roomBadgeText}>
              {tenancy?.room?.room_no ? `Room ${tenancy.room.room_no}` : 'Allocating'}
            </Text>
          </View>
        </View>

        {/* Room Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>My Room & Tenancy</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Room Number</Text>
            <Text style={styles.infoValue}>
              {tenancy?.room?.room_no ? `Room ${tenancy.room.room_no}` : 'Not assigned yet'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Monthly Rent</Text>
            <Text style={styles.infoValue}>
              {tenancy?.room?.monthly_rent ? `₹${tenancy.room.monthly_rent} / mo` : 'Pending'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tenancy Start</Text>
            <Text style={styles.infoValue}>
              {tenancy?.start_date ? new Date(tenancy.start_date).toLocaleDateString() : 'N/A'}
            </Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>Room Capacity</Text>
            <Text style={styles.infoValue}>
              {tenancy?.room?.capacity ? `${tenancy.room.capacity} students` : 'Standard'}
            </Text>
          </View>
        </View>

        {/* Rent Status Card */}
        <View style={[styles.card, unpaidDuesCount > 0 ? styles.duesAlertCard : null]}>
          <View style={styles.duesHeader}>
            <Text style={styles.cardHeader}>Rent Dues</Text>
            <View style={[styles.statusTag, unpaidDuesCount > 0 ? styles.unpaidTag : styles.paidTag]}>
              <Text style={styles.statusTagText}>
                {unpaidDuesCount > 0 ? `${unpaidDuesCount} UNPAID` : 'UP TO DATE'}
              </Text>
            </View>
          </View>
          <Text style={styles.cardSubtext}>
            {unpaidDuesCount > 0
              ? 'You have pending rent dues. Tap Pay Rent to pay via UPI and submit your UTR.'
              : 'All your monthly rent payments have been confirmed by the administrator.'}
          </Text>
        </View>

        {/* Quick Help Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>House Guidelines</Text>
          <Text style={styles.cardSubtext}>
            - Quiet hours are observed from 11:00 PM to 7:00 AM.{'\n'}
            - Report any electrical or plumbing complaints immediately.{'\n'}
            - Keep group announcements checked for house maintenance notices.
          </Text>
        </View>

        {/* Logout */}
        <Button
          title="Sign Out"
          variant="outline"
          onPress={signOut}
          style={styles.signOutButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  roomBadge: {
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  roomBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 16,
  },
  duesAlertCard: {
    borderColor: colors.warning,
    backgroundColor: '#1E1B18',
  },
  cardHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  cardSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  duesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  unpaidTag: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warning,
    borderWidth: 1,
  },
  paidTag: {
    backgroundColor: colors.successBg,
    borderColor: colors.success,
    borderWidth: 1,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  signOutButton: {
    marginTop: 8,
    marginBottom: 32,
  },
});
