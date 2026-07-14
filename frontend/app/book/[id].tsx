import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { apiClient } from '@/src/api/client';
import { Ionicons } from '@expo/vector-icons';

interface Chapter {
  chapter_id: string;
  book_id: string;
  chapter_number: number;
  title: string;
  verse_count: number;
}

interface Book {
  book_id: string;
  title: string;
  author: string;
  description: string;
  chapter_count: number;
  cover_color: string;
}

export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadBookData();
  }, [id]);

  const loadBookData = async () => {
    try {
      const booksData = await apiClient.get<Book[]>('/api/books');
      const bookData = booksData.find(b => b.book_id === id);
      setBook(bookData || null);
      
      const chaptersData = await apiClient.get<Chapter[]>(`/api/books/${id}/chapters`);
      setChapters(chaptersData);
    } catch (error) {
      console.error('Error loading book:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderChapter = ({ item }: { item: Chapter }) => (
    <TouchableOpacity
      style={styles.chapterCard}
      onPress={() => router.push(`/chapter/${item.chapter_id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.chapterNumber}>
        <Text style={styles.chapterNumberText}>{item.chapter_number}</Text>
      </View>
      <View style={styles.chapterInfo}>
        <Text style={styles.chapterTitle}>{item.title}</Text>
        {item.verse_count > 0 && (
          <Text style={styles.verseCount}>{item.verse_count} verses</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9A8A7A" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#8B4513" />
      </View>
    );
  }

  if (!book) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Book not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: book.title,
          headerShown: true,
          headerBackTitle: 'Library',
          headerStyle: {
            backgroundColor: '#FAF8F3',
          },
          headerTitleStyle: {
            fontFamily: 'Georgia',
            fontSize: 18,
            fontWeight: '700',
            color: '#4A3728',
          },
          headerTintColor: '#8B4513',
        }}
      />
      
      <View style={[styles.bookHeader, { backgroundColor: book.cover_color }]}>
        <Ionicons name="book" size={48} color="#fff" style={styles.bookIcon} />
        <Text style={styles.bookTitle}>{book.title}</Text>
        <Text style={styles.bookAuthor}>{book.author}</Text>
        <Text style={styles.bookDescription}>{book.description}</Text>
      </View>

      <View style={styles.chapterListContainer}>
        <Text style={styles.sectionTitle}>Chapters</Text>
        <FlatList
          data={chapters}
          renderItem={renderChapter}
          keyExtractor={(item) => item.chapter_id}
          contentContainerStyle={styles.chapterList}
        />
      </View>
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
  errorText: {
    fontSize: 16,
    color: '#7A6A5A',
  },
  bookHeader: {
    padding: 24,
    alignItems: 'center',
  },
  bookIcon: {
    marginBottom: 16,
    opacity: 0.9,
  },
  bookTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'Georgia',
  },
  bookAuthor: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 12,
  },
  bookDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 20,
  },
  chapterListContainer: {
    flex: 1,
    backgroundColor: '#FAF8F3',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7A6A5A',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chapterList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  chapterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E8DCC8',
  },
  chapterNumber: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF9F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#E8DCC8',
  },
  chapterNumberText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8B4513',
  },
  chapterInfo: {
    flex: 1,
  },
  chapterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A3728',
    marginBottom: 2,
  },
  verseCount: {
    fontSize: 13,
    color: '#9A8A7A',
  },
});
