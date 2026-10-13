import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { ForcePasswordChangeScreen } from '../screens/auth/ForcePasswordChangeScreen';
import { AdminNavigator } from './AdminNavigator';
import { TenantNavigator } from './TenantNavigator';

const Stack = createNativeStackNavigator();

export const RootNavigator = () => {
  const { session, role, mustChangePassword, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>2H</Text>
        </View>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
        <Text style={styles.loadingText}>2nd_Home</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      >
        {!session ? (
          // Unauthenticated Flow
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : mustChangePassword ? (
          // Mandatory First Login Password Change Flow
          <Stack.Screen
            name="ForcePasswordChange"
            component={ForcePasswordChangeScreen}
          />
        ) : role === 'admin' ? (
          // Admin Role Application
          <Stack.Screen name="AdminApp" component={AdminNavigator} />
        ) : (
          // Tenant Role Application
          <Stack.Screen name="TenantApp" component={TenantNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
});
