import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { AdminRoomsScreen } from '../screens/admin/AdminRoomsScreen';
import { AdminTenantsScreen } from '../screens/admin/AdminTenantsScreen';
import { AdminPaymentsScreen } from '../screens/admin/AdminPaymentsScreen';
import { AdminComplaintsScreen } from '../screens/admin/AdminComplaintsScreen';
import { AdminAnnouncementsScreen } from '../screens/admin/AdminAnnouncementsScreen';
import { AdminChatScreen } from '../screens/admin/AdminChatScreen';

const Tab = createBottomTabNavigator();

export const AdminNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.cardBorder,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={AdminDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Rooms"
        component={AdminRoomsScreen}
        options={{
          tabBarLabel: 'Rooms',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bed-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Tenants"
        component={AdminTenantsScreen}
        options={{
          tabBarLabel: 'Tenants',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Payments"
        component={AdminPaymentsScreen}
        options={{
          tabBarLabel: 'Payments',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Complaints"
        component={AdminComplaintsScreen}
        options={{
          tabBarLabel: 'Complaints',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="construct-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Announcements"
        component={AdminAnnouncementsScreen}
        options={{
          tabBarLabel: 'Notices',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="megaphone-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Chat"
        component={AdminChatScreen}
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};
