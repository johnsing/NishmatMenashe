import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { apiClient } from '@/src/api/client';
import { Ionicons } from '@expo/vector-icons';

interface Book {
  book_id: string;
  title: string;
  author: string;
  description: string;
  chapter_count: number;
  cover_color: string;
}

export default function LibraryScreen() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    try {
      const data = await apiClient.get<Book[]>('/api/books');
      setBooks(data);
    } catch (error) {
      console.error('Error loading books:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderBook = ({ item }: { item: Book }) => (
    <TouchableOpacity
      style={[styles.bookCard, { backgroundColor: item.cover_color }]}
      onPress={() => router.push(`/book/${item.book_id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.bookContent}>
        <Ionicons name="book" size={40} color="#fff" style={styles.bookIcon} />
        <Text style={styles.bookTitle}>{item.title}</Text>
        <Text style={styles.bookAuthor}>{item.author}</Text>
        <Text style={styles.bookDescription} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.bookFooter}>
          <Ionicons name="list" size={14} color="rgba(255,255,255,0.8)" />
          <Text style={styles.chapterCount}>
            {item.chapter_count} {item.chapter_count === 1 ? 'Chapter' : 'Chapters'}
          </Text>
        </View>
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

  return (
    <View style={styles.container}>
      <FlatList
        data={books}
        renderItem={renderBook}
        keyExtractor={(item) => item.book_id}
        contentContainerStyle={styles.listContent}
        numColumns={2}
        columnWrapperStyle={styles.row}
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
  listContent: {
    padding: 16,
  },
  row: {
    justifyContent: 'space-between',
  },
  bookCard: {
    flex: 1,
    margin: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    minHeight: 220,
  },
  bookContent: {
    padding: 16,
    flex: 1,
  },
  bookIcon: {
    marginBottom: 12,
    opacity: 0.9,
  },
  bookTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    fontFamily: 'Georgia',
  },
  bookAuthor: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 8,
  },
  bookDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 18,
    flex: 1,
  },
  bookFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  chapterCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 4,
  },
});
