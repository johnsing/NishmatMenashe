import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, Stack } from 'expo-router';
import { apiClient } from '@/src/api/client';
import { Ionicons } from '@expo/vector-icons';

interface Verse {
  verse_id: string;
  chapter_id: string;
  verse_number: number;
  original_text: string;
  english_translation: string;
}

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

export default function ChapterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [verses, setVerses] = useState<Verse[]>([]);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookmarkedVerses, setBookmarkedVerses] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadChapterData();
    loadBookmarks();
  }, [id]);

  const loadChapterData = async () => {
    try {
      const versesData = await apiClient.get<Verse[]>(`/api/chapters/${id}/verses`);
      setVerses(versesData);

      // Get chapter info
      const allBooks = await apiClient.get<Book[]>('/api/books');
      for (const b of allBooks) {
        const chapters = await apiClient.get<Chapter[]>(`/api/books/${b.book_id}/chapters`);
        const chapterData = chapters.find((c) => c.chapter_id === id);
        if (chapterData) {
          setChapter(chapterData);
          setBook(b);
          break;
        }
      }
    } catch (error) {
      console.error('Error loading chapter:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBookmarks = async () => {
    try {
      const bookmarks = await apiClient.get<any[]>('/api/bookmarks');
      const verseIds = new Set(bookmarks.map((b) => b.verse_id));
      setBookmarkedVerses(verseIds);
    } catch (error) {
      console.error('Error loading bookmarks:', error);
    }
  };

  const toggleBookmark = async (verse: Verse) => {
    if (!book || !chapter) return;

    try {
      if (bookmarkedVerses.has(verse.verse_id)) {
        // Remove bookmark
        const bookmarks = await apiClient.get<any[]>('/api/bookmarks');
        const bookmark = bookmarks.find((b) => b.verse_id === verse.verse_id);
        if (bookmark) {
          await apiClient.delete(`/api/bookmarks/${bookmark.bookmark_id}`);
          const newSet = new Set(bookmarkedVerses);
          newSet.delete(verse.verse_id);
          setBookmarkedVerses(newSet);
        }
      } else {
        // Add bookmark
        await apiClient.post('/api/bookmarks', {
          book_id: book.book_id,
          chapter_id: chapter.chapter_id,
          verse_id: verse.verse_id,
          book_title: book.title,
          chapter_title: chapter.title,
          verse_number: verse.verse_number,
        });
        const newSet = new Set(bookmarkedVerses);
        newSet.add(verse.verse_id);
        setBookmarkedVerses(newSet);
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      Alert.alert('Error', 'Could not update bookmark');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#8B4513" />
      </View>
    );
  }

  if (!chapter || !book) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Chapter not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: `${book.title} - ${chapter.title}`,
          headerShown: true,
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: '#FAF8F3',
          },
          headerTitleStyle: {
            fontFamily: 'Georgia',
            fontSize: 16,
            fontWeight: '700',
            color: '#4A3728',
          },
          headerTintColor: '#8B4513',
        }}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Chapter Header */}
        <View style={styles.chapterHeader}>
          <Text style={styles.bookTitle}>{book.title}</Text>
          <Text style={styles.chapterTitle}>Chapter {chapter.chapter_number}: {chapter.title}</Text>
        </View>

        {/* Verses */}
        {verses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No verses available for this chapter</Text>
          </View>
        ) : (
          verses.map((verse) => (
            <View key={verse.verse_id} style={styles.verseContainer}>
              <View style={styles.verseHeader}>
                <Text style={styles.verseNumber}>{verse.verse_number}</Text>
                <TouchableOpacity
                  onPress={() => toggleBookmark(verse)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={bookmarkedVerses.has(verse.verse_id) ? 'bookmark' : 'bookmark-outline'}
                    size={24}
                    color={bookmarkedVerses.has(verse.verse_id) ? '#8B4513' : '#9A8A7A'}
                  />
                </TouchableOpacity>
              </View>

              {/* Side-by-side layout */}
              <View style={styles.textsContainer}>
                {/* Original Text */}
                <View style={styles.textColumn}>
                  <Text style={styles.columnLabel}>Original</Text>
                  <Text style={styles.originalText}>{verse.original_text}</Text>
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* English Translation */}
                <View style={styles.textColumn}>
                  <Text style={styles.columnLabel}>English</Text>
                  <Text style={styles.translationText}>{verse.english_translation}</Text>
                </View>
              </View>
            </View>
          ))
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  chapterHeader: {
    paddingVertical: 24,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#E8DCC8',
    marginBottom: 16,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B4513',
    marginBottom: 8,
  },
  chapterTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4A3728',
    textAlign: 'center',
    fontFamily: 'Georgia',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#7A6A5A',
    textAlign: 'center',
  },
  verseContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8DCC8',
  },
  verseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  verseNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8B4513',
  },
  textsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  textColumn: {
    flex: 1,
  },
  columnLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9A8A7A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  originalText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#4A3728',
    fontFamily: 'Georgia',
  },
  divider: {
    width: 1,
    backgroundColor: '#E8DCC8',
  },
  translationText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#5A4A3A',
    fontFamily: 'Georgia',
  },
  bottomPadding: {
    height: 32,
  },
});
