import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useContacts } from '../../src/hooks/use-contacts';
import type { Contact } from '@realflow/shared';

function getScoreColor(score: number) {
  if (score >= 75) return '#ef4444';
  if (score >= 50) return '#eab308';
  if (score >= 25) return '#3b82f6';
  return '#9ca3af';
}

export default function ContactsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: contacts, isLoading, refetch } = useContacts(
    searchQuery ? { query: searchQuery } : undefined,
  );

  const renderItem = useCallback(
    ({ item }: { item: Contact }) => {
      const name = `${item.firstName} ${item.lastName}`;
      const initials = name
        .split(' ')
        .map((n: string) => n[0])
        .join('');
      const typeLabel = item.types.join(' / ');

      return (
        <TouchableOpacity
          style={styles.contactRow}
          onPress={() => router.push(`/contact/${item.id}`)}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.meta}>
              {typeLabel} &middot; {item.phone}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [router],
  );

  if (isLoading && !contacts) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
      </View>
      <FlatList
        data={contacts ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No contacts found</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  searchContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  list: { padding: 16, paddingTop: 8 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 14, fontWeight: '600', color: '#1d4ed8' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: '#111827' },
  meta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  emptyText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', padding: 40 },
  scoreBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  scoreText: { fontSize: 12, fontWeight: '600' },
});
