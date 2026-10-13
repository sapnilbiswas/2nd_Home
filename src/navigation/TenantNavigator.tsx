import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { TenantHomeScreen } from '../screens/tenant/TenantHomeScreen';
import { TenantPaymentScreen } from '../screens/tenant/TenantPaymentScreen';
import { TenantComplaintsScreen } from '../screens/tenant/TenantComplaintsScreen';
import { TenantAnnouncementsScreen } from '../screens/tenant/TenantAnnouncementsScreen';
import { TenantChatScreen } from '../screens/tenant/TenantChatScreen';

const Tab = createBottomTabNavigator();

export const TenantNavigator = () => {
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
        name="Home"
        component={TenantHomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Payments"
        component={TenantPaymentScreen}
        options={{
          tabBarLabel: 'Pay Rent',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Complaints"
        component={TenantComplaintsScreen}
        options={{
          tabBarLabel: 'Complaints',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="construct-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Announcements"
        component={TenantAnnouncementsScreen}
        options={{
          tabBarLabel: 'Notices',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="megaphone-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Chat"
        component={TenantChatScreen}
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
