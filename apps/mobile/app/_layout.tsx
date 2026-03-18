import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import type { Subscription } from 'expo-notifications';
import { supabase } from '../src/lib/supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerPushToken() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;
  const session = await supabase.auth.getSession();
  const userId = session.data.session?.user.id;
  const accessToken = session.data.session?.access_token;
  if (!userId || !accessToken) return;

  await fetch(`${API_BASE}/api/v1/push-tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ userId, token, platform: 'ios' }),
  }).catch((error: unknown) => {
    console.error(
      '[PushToken] Registration failed:',
      error instanceof Error ? error.message : String(error),
    );
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
    },
  },
});

export default function RootLayout() {
  const router = useRouter();
  const notifListener = useRef<Subscription | null>(null);
  const responseListener = useRef<Subscription | null>(null);

  useEffect(() => {
    registerPushToken();

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const entityType = data.entityType as string | undefined;
      const entityId = data.entityId as string | undefined;
      const actionPrimary = data.actionPrimary as string | undefined;

      if (entityType === 'property_alert' || data.alertType !== undefined) {
        router.push('/alerts');
      } else if (actionPrimary === 'view_daily_actions' || data.type === 'digest') {
        router.push('/(tabs)/daily');
      } else if (entityType === 'contact' && entityId) {
        router.push(`/contact/${entityId}`);
      } else if (entityType === 'property' && entityId) {
        router.push(`/property/${entityId}`);
      }
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#1e3a8a',
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="contact/[id]" options={{ title: 'Contact' }} />
        <Stack.Screen name="property/[id]" options={{ title: 'Property' }} />
        <Stack.Screen name="inspection/new" options={{ title: 'Log Inspection' }} />
        <Stack.Screen name="inspection/[id]" options={{ title: 'Inspection' }} />
        <Stack.Screen name="matches/index" options={{ title: 'Property Matches' }} />
        <Stack.Screen name="matches/[id]" options={{ title: 'Match Detail' }} />
        <Stack.Screen
          name="auction/[offerId]"
          options={{
            title: 'Auction Day',
            headerStyle: { backgroundColor: '#1e3a8a' },
            headerTintColor: '#ffffff',
          }}
        />
        <Stack.Screen name="brief/[clientId]" options={{ title: 'Client Brief' }} />
        <Stack.Screen name="notifications/index" options={{ title: 'Notifications' }} />
        <Stack.Screen name="alerts/index" options={{ title: 'Property Alerts' }} />
      </Stack>
    </QueryClientProvider>
  );
}
