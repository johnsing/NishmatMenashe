import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { apiClient } from '@/src/api/client';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';

interface Analytics {
  total_users: number;
  admin_count: number;
  total_categories: number;
  total_books: number;
  total_chapters: number;
  total_verses: number;
  total_bookmarks: number;
  top_bookmarked: Array<{
    verse_id: string;
    count: number;
    book_title: string;
    chapter_title: string;
    verse_number: number;
  }>;
}

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadAnalytics = async () => {
    try {
      const data = await apiClient.get<Analytics>('/api/admin/analytics');
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadAnalytics();
    }, [])
  );

  const managementCards = [
    { title: 'Categories', icon: 'library' as const, route: '/admin/categories', color: '#2C5F5D', count: analytics?.total_categories },
    { title: 'Books', icon: 'book' as const, route: '/admin/books', color: '#8B4513', count: analytics?.total_books },
    { title: 'Chapters', icon: 'list' as const, route: '/admin/chapters', color: '#A0522D', count: analytics?.total_chapters },
    { title: 'Verses', icon: 'document-text' as const, route: '/admin/verses', color: '#CD853F', count: analytics?.total_verses },
    { title: 'Users', icon: 'people' as const, route: '/admin/users', color: '#1A237E', count: analytics?.total_users },
  ];

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#8B4513" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="people-outline" size={20} color="#8B4513" />
          <Text style={styles.statValue}>{analytics?.total_users || 0}</Text>
          <Text style={styles.statLabel}>Users</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="bookmark-outline" size={20} color="#8B4513" />
          <Text style={styles.statValue}>{analytics?.total_bookmarks || 0}</Text>
          <Text style={styles.statLabel}>Bookmarks</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="shield-outline" size={20} color="#8B4513" />
          <Text style={styles.statValue}>{analytics?.admin_count || 0}</Text>
          <Text style={styles.statLabel}>Admins</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Content Management</Text>
      <View style={styles.cardsGrid}>
        {managementCards.map((card) => (
          <TouchableOpacity
            key={card.title}
            style={styles.managementCard}
            onPress={() => router.push(card.route as any)}
            testID={`admin-nav-${card.title.toLowerCase()}`}
          >
            <View style={[styles.iconCircle, { backgroundColor: card.color + '15' }]}>
              <Ionicons name={card.icon} size={24} color={card.color} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardCount}>{card.count ?? 0} items</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9A8A7A" />
          </TouchableOpacity>
        ))}
      </View>

      {analytics && analytics.top_bookmarked.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Popular Verses</Text>
          <View style={styles.popularList}>
            {analytics.top_bookmarked.map((item, idx) => (
              <View key={item.verse_id} style={styles.popularItem}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>{idx + 1}</Text>
                </View>
                <View style={styles.popularInfo}>
                  <Text style={styles.popularTitle}>{item.book_title}</Text>
                  <Text style={styles.popularSubtitle}>
                    {item.chapter_title} · Verse {item.verse_number}
                  </Text>
                </View>
                <View style={styles.countBadge}>
                  <Ionicons name="bookmark" size={12} color="#8B4513" />
                  <Text style={styles.countText}>{item.count}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F3' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF8F3' },
  content: { padding: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7A6A5A',
    marginTop: 16,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8DCC8',
    alignItems: 'flex-start',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3A2F26',
    marginTop: 6,
    fontFamily: 'Georgia',
  },
  statLabel: {
    fontSize: 12,
    color: '#7A6A5A',
    marginTop: 2,
  },
  cardsGrid: {
    gap: 10,
  },
  managementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8DCC8',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardBody: { flex: 1 },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A2F26',
    marginBottom: 2,
  },
  cardCount: {
    fontSize: 13,
    color: '#7A6A5A',
  },
  popularList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8DCC8',
    overflow: 'hidden',
  },
  popularItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E8D8',
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF9F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E8DCC8',
  },
  rankText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B4513',
  },
  popularInfo: { flex: 1 },
  popularTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A2F26',
  },
  popularSubtitle: {
    fontSize: 12,
    color: '#7A6A5A',
    marginTop: 2,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B4513',
  },
  bottomPadding: { height: 32 },
});
