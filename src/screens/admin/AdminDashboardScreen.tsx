import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { Button } from '../../components/Button';
import { supabase } from '../../api/supabase';
import { registerForPushNotifications } from '../../api/notifications';

export const AdminDashboardScreen = ({ navigation }: any) => {
  const { profile, signOut } = useAuth();
  const [stats, setStats] = useState({
    roomCount: 0,
    tenantCount: 0,
    pendingPayments: 0,
    openComplaints: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      const [roomsRes, tenantsRes, paymentsRes, complaintsRes] = await Promise.all([
        supabase.from('rooms').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'tenant').eq('is_active', true),
        supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      ]);

      setStats({
        roomCount: roomsRes.count ?? 0,
        tenantCount: tenantsRes.count ?? 0,
        pendingPayments: paymentsRes.count ?? 0,
        openComplaints: complaintsRes.count ?? 0,
      });
    } catch (err) {
      console.warn('Error fetching admin dashboard stats:', err);
    }
  };

  useEffect(() => {
    fetchStats();
    if (profile?.id) {
      registerForPushNotifications(profile.id);
    }
  }, [profile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
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
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>House Administrator</Text>
            <Text style={styles.userName}>{profile?.name || 'Administrator'}</Text>
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>ADMIN</Text>
          </View>
        </View>

        {/* Metrics Grid */}
        <View style={styles.grid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.roomCount}</Text>
            <Text style={styles.statLabel}>Rooms</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.tenantCount}</Text>
            <Text style={styles.statLabel}>Active Tenants</Text>
          </View>
          <View style={[styles.statCard, stats.pendingPayments > 0 && styles.alertCard]}>
            <Text style={[styles.statNumber, stats.pendingPayments > 0 && styles.alertText]}>
              {stats.pendingPayments}
            </Text>
            <Text style={styles.statLabel}>Pending Dues</Text>
          </View>
          <View style={[styles.statCard, stats.openComplaints > 0 && styles.warningCard]}>
            <Text style={[styles.statNumber, stats.openComplaints > 0 && styles.warningText]}>
              {stats.openComplaints}
            </Text>
            <Text style={styles.statLabel}>Open Complaints</Text>
          </View>
        </View>

        {/* Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>2nd_Home Management</Text>
          <Text style={styles.cardText}>
            Welcome to your administrative portal. You can allocate rooms, add new tenant logins, confirm UTR payments, review maintenance complaints, and broadcast house meetings.
          </Text>
        </View>

        {/* Profile Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Details</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Role</Text>
            <Text style={styles.infoValue}>House Owner / Admin</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{profile?.phone || 'Not set'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Security Policy</Text>
            <Text style={styles.infoValue}>Row-Level Security Enabled</Text>
          </View>
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
    letterSpacing: 0.5,
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: colors.badgeBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A5B4FC',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  alertCard: {
    borderColor: colors.error,
    backgroundColor: colors.errorBg,
  },
  alertText: {
    color: colors.error,
  },
  warningCard: {
    borderColor: colors.warning,
    backgroundColor: colors.warningBg,
  },
  warningText: {
    color: colors.warning,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  cardText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
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
  signOutButton: {
    marginTop: 8,
    marginBottom: 32,
  },
});
