import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
    },
  },
});

export default function RootLayout() {
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
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="contact/[id]"
          options={{ title: 'Contact' }}
        />
        <Stack.Screen
          name="property/[id]"
          options={{ title: 'Property' }}
        />
        <Stack.Screen
          name="inspection/new"
          options={{ title: 'Log Inspection' }}
        />
        <Stack.Screen
          name="inspection/[id]"
          options={{ title: 'Inspection' }}
        />
        <Stack.Screen
          name="matches/index"
          options={{ title: 'Property Matches' }}
        />
        <Stack.Screen
          name="matches/[id]"
          options={{ title: 'Match Detail' }}
        />
        <Stack.Screen
          name="auction/[offerId]"
          options={{ title: 'Auction Day', headerStyle: { backgroundColor: '#1e3a8a' }, headerTintColor: '#ffffff' }}
        />
        <Stack.Screen
          name="brief/[clientId]"
          options={{ title: 'Client Brief' }}
        />
      </Stack>
    </QueryClientProvider>
  );
}
