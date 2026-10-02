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
  category_id: string;
  title: string;
  author: string;
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
      // Was: fetch ALL books, then ALL chapters of each book, scanning for a
      // match — O(books) requests per chapter opened. Now: 3 targeted requests.
      const versesData = await apiClient.get<Verse[]>(`/api/chapters/${id}/verses`);
      setVerses(versesData);

      const chapterData = await apiClient.get<Chapter>(`/api/chapters/${id}`);
      setChapter(chapterData);

      const bookData = await apiClient.get<Book>(`/api/books/${chapterData.book_id}`);
      setBook(bookData);
    } catch (error) {
      console.error('Error loading chapter:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBookmarks = async () => {
    try {
      const bookmarks = await apiClient.get<any[]>('/api/bookmarks');
      const verseIds = new Set<string>(bookmarks.map((b) => b.verse_id));
      setBookmarkedVerses(verseIds);
    } catch (error) {
      console.error('Error loading bookmarks:', error);
    }
  };

  const toggleBookmark = async (verse: Verse) => {
    if (!book || !chapter) return;

    try {
      if (bookmarkedVerses.has(verse.verse_id)) {
        const bookmarks = await apiClient.get<any[]>('/api/bookmarks');
        const bookmark = bookmarks.find((b) => b.verse_id === verse.verse_id);
        if (bookmark) {
          await apiClient.delete(`/api/bookmarks/${bookmark.bookmark_id}`);
          const newSet = new Set(bookmarkedVerses);
          newSet.delete(verse.verse_id);
          setBookmarkedVerses(newSet);
        }
      } else {
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
          title: `${book.title} ${chapter.chapter_number}`,
          headerShown: true,
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: '#FAF8F3',
          },
          headerTitleStyle: {
            fontFamily: 'Georgia',
            fontSize: 18,
            fontWeight: '400',
            color: '#3A2F26',
          },
          headerTintColor: '#8B4513',
        }}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Chapter Header */}
        <View style={styles.chapterHeader}>
          <Text style={styles.bookTitle}>{book.title}</Text>
          <Text style={styles.chapterTitle}>
            Chapter {chapter.chapter_number}: {chapter.title}
          </Text>
        </View>

        {/* Verses */}
        {verses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No verses available for this chapter</Text>
          </View>
        ) : (
          verses.map((verse) => {
            const isBookmarked = bookmarkedVerses.has(verse.verse_id);
            return (
              <TouchableOpacity
                key={verse.verse_id}
                style={styles.verseRow}
                onLongPress={() => toggleBookmark(verse)}
                activeOpacity={0.7}
                testID={`verse-${verse.verse_id}`}
              >
                {/* Bullet column */}
                <View style={styles.bulletCol}>
                  <TouchableOpacity
                    onPress={() => toggleBookmark(verse)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    testID={`bookmark-${verse.verse_id}`}
                  >
                    <View
                      style={[
                        styles.bullet,
                        isBookmarked && styles.bulletActive,
                      ]}
                    />
                  </TouchableOpacity>
                </View>

                {/* Content column */}
                <View style={styles.contentCol}>
                  <Text style={styles.hebrewText}>{verse.original_text}</Text>
                  <Text style={styles.englishText}>{verse.english_translation}</Text>
                </View>

                {/* Verse number column */}
                <View style={styles.numberCol}>
                  <Text style={styles.verseNumber}>{verse.verse_number}</Text>
                </View>
              </TouchableOpacity>
            );
          })
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
    paddingHorizontal: 8,
  },
  chapterHeader: {
    paddingVertical: 24,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E8DCC8',
    marginBottom: 8,
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B4513',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  chapterTitle: {
    fontSize: 22,
    fontWeight: '400',
    color: '#3A2F26',
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
  verseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 20,
    paddingHorizontal: 4,
    borderBottomWidth: 0,
  },
  bulletCol: {
    width: 24,
    alignItems: 'center',
    paddingTop: 14,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3A2F26',
  },
  bulletActive: {
    backgroundColor: '#8B4513',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  contentCol: {
    flex: 1,
    paddingHorizontal: 8,
  },
  hebrewText: {
    fontSize: 22,
    lineHeight: 40,
    color: '#2A2018',
    textAlign: 'right',
    writingDirection: 'rtl',
    fontFamily: 'Georgia',
    marginBottom: 12,
  },
  englishText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#3A2F26',
    fontFamily: 'Georgia',
  },
  numberCol: {
    width: 28,
    alignItems: 'center',
    paddingTop: 14,
  },
  verseNumber: {
    fontSize: 12,
    color: '#9A8A7A',
    fontFamily: 'Georgia',
  },
  bottomPadding: {
    height: 48,
  },
});
