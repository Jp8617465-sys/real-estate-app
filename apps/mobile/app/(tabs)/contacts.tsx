import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useContacts } from '../../src/hooks/use-contacts';
import { ContactCard, LoadingSpinner, EmptyState } from '../../src/components';
import type { Contact, ContactType } from '@realflow/shared';

// ─── Filter Tabs ────────────────────────────────────────────────────
type FilterTab = 'all' | 'buyer' | 'seller' | 'leads';

interface FilterTabConfig {
  key: FilterTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const FILTER_TABS: FilterTabConfig[] = [
  { key: 'all', label: 'All', icon: 'people-outline' },
  { key: 'buyer', label: 'Buyers', icon: 'cart-outline' },
  { key: 'seller', label: 'Sellers', icon: 'home-outline' },
  { key: 'leads', label: 'Leads', icon: 'flash-outline' },
];

function getFilterTypes(tab: FilterTab): ContactType[] | undefined {
  switch (tab) {
    case 'buyer':
      return ['buyer'];
    case 'seller':
      return ['seller'];
    case 'leads':
      return ['buyer', 'investor'];
    default:
      return undefined;
  }
}

// ─── Contacts Screen ────────────────────────────────────────────────
export default function ContactsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const filterTypes = getFilterTypes(activeTab);

  const { data: contacts, isLoading, refetch } = useContacts({
    query: searchQuery || undefined,
    types: filterTypes,
  });

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const filteredContacts = useMemo(() => contacts ?? [], [contacts]);

  const renderItem = useCallback(
    ({ item }: { item: Contact }) => (
      <ContactCard
        contact={item}
        onPress={() => router.push(`/contact/${item.id}`)}
      />
    ),
    [router],
  );

  const keyExtractor = useCallback((item: Contact) => item.id, []);

  if (isLoading && !contacts) {
    return <LoadingSpinner />;
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={18} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search contacts"
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsContainer}>
        {FILTER_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.activeTab]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Filter by ${tab.label}`}
            >
              <Ionicons
                name={tab.icon}
                size={14}
                color={isActive ? '#2563eb' : '#6b7280'}
              />
              <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Contact List */}
      <FlatList
        data={filteredContacts}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563eb" />
        }
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No contacts found"
            message={searchQuery ? 'Try a different search term' : 'Add your first contact to get started'}
          />
        }
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/contact/new' as never)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Add new contact"
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 15,
    color: '#111827',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 4,
  },
  activeTab: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#2563eb',
  },
  list: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 100,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
