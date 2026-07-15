import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { apiClient } from '@/src/api/client';
import { Ionicons } from '@expo/vector-icons';

interface Book {
  book_id: string;
  category_id: string;
  title: string;
  author: string;
  description: string;
  chapter_count: number;
  cover_color: string;
  order: number;
}

interface Category {
  category_id: string;
  title: string;
  description: string;
  accent_color: string;
}

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [books, setBooks] = useState<Book[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [categoryData, booksData] = await Promise.all([
        apiClient.get<Category>(`/api/categories/${id}`),
        apiClient.get<Book[]>(`/api/categories/${id}/books`),
      ]);
      setCategory(categoryData);
      setBooks(booksData);
    } catch (error) {
      console.error('Error loading category:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderBook = ({ item }: { item: Book }) => (
    <TouchableOpacity
      style={[styles.bookCard, { backgroundColor: item.cover_color }]}
      onPress={() => router.push(`/book/${item.book_id}`)}
      activeOpacity={0.85}
      testID={`book-card-${item.book_id}`}
    >
      <Ionicons name="book" size={48} color="#fff" style={styles.bookIcon} />
      <View>
        <Text style={styles.bookTitle}>{item.title}</Text>
        <Text style={styles.bookAuthor}>{item.author}</Text>
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
      <Stack.Screen
        options={{
          title: category?.title || 'Library',
          headerShown: true,
          headerBackTitle: 'Library',
          headerStyle: { backgroundColor: '#FAF8F3' },
          headerTitleStyle: {
            fontFamily: 'Georgia',
            fontSize: 20,
            fontWeight: '700',
            color: '#3A2F26',
          },
          headerTintColor: '#8B4513',
        }}
      />

      {category && (
        <View style={styles.header}>
          <View style={[styles.accentBar, { backgroundColor: category.accent_color }]} />
          <Text style={styles.categoryTitle}>{category.title}</Text>
          <Text style={styles.categoryDescription}>{category.description}</Text>
        </View>
      )}

      {books.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="book-outline" size={64} color="#C8B8A8" />
          <Text style={styles.emptyText}>Coming Soon</Text>
          <Text style={styles.emptySubtext}>
            Books for this category will be added soon
          </Text>
        </View>
      ) : (
        <FlatList
          data={books}
          renderItem={renderBook}
          keyExtractor={(item) => item.book_id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={<Text style={styles.sectionTitle}>Books</Text>}
        />
      )}
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8DCC8',
  },
  accentBar: {
    height: 3,
    width: 60,
    marginBottom: 16,
    borderRadius: 1.5,
  },
  categoryTitle: {
    fontSize: 32,
    fontWeight: '400',
    color: '#3A2F26',
    marginBottom: 12,
    fontFamily: 'Georgia',
  },
  categoryDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6A5A4A',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7A6A5A',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  listContent: {
    padding: 20,
  },
  bookCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    minHeight: 130,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  bookIcon: {
    opacity: 0.95,
  },
  bookTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Georgia',
  },
  bookAuthor: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
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
  },
});
