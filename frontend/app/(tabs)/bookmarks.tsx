import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { apiClient } from '@/src/api/client';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';

interface Bookmark {
  bookmark_id: string;
  book_id: string;
  chapter_id: string;
  verse_id: string;
  book_title: string;
  chapter_title: string;
  verse_number: number;
  created_at: string;
}

export default function BookmarksScreen() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadBookmarks = async () => {
    try {
      const data = await apiClient.get<Bookmark[]>('/api/bookmarks');
      setBookmarks(data);
    } catch (error) {
      console.error('Error loading bookmarks:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadBookmarks();
    }, [])
  );

  const handleDelete = async (bookmarkId: string) => {
    Alert.alert(
      'Remove Bookmark',
      'Are you sure you want to remove this bookmark?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/api/bookmarks/${bookmarkId}`);
              setBookmarks(bookmarks.filter(b => b.bookmark_id !== bookmarkId));
            } catch (error) {
              console.error('Error deleting bookmark:', error);
            }
          },
        },
      ]
    );
  };

  const renderBookmark = ({ item }: { item: Bookmark }) => (
    <TouchableOpacity
      style={styles.bookmarkCard}
      onPress={() => router.push(`/chapter/${item.chapter_id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.bookmarkContent}>
        <Ionicons name="bookmark" size={24} color="#8B4513" style={styles.bookmarkIcon} />
        <View style={styles.bookmarkInfo}>
          <Text style={styles.bookTitle}>{item.book_title}</Text>
          <Text style={styles.chapterInfo}>
            {item.chapter_title} · Verse {item.verse_number}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => handleDelete(item.bookmark_id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={20} color="#D2691E" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#8B4513" />
      </View>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="bookmark-outline" size={64} color="#C8B8A8" />
        <Text style={styles.emptyText}>No bookmarks yet</Text>
        <Text style={styles.emptySubtext}>
          Tap the bookmark icon while reading{`\n`}to save your favorite verses
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={bookmarks}
        renderItem={renderBookmark}
        keyExtractor={(item) => item.bookmark_id}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F3',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF8F3',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#FAF8F3',
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#7A6A5A',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9A8A7A',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    padding: 16,
  },
  bookmarkCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8DCC8',
  },
  bookmarkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  bookmarkIcon: {
    marginRight: 12,
  },
  bookmarkInfo: {
    flex: 1,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A3728',
    marginBottom: 4,
  },
  chapterInfo: {
    fontSize: 14,
    color: '#7A6A5A',
  },
});
