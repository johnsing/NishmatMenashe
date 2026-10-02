import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { apiClient } from '@/src/api/client';
import { Ionicons } from '@expo/vector-icons';

interface SearchResult {
  verse_id: string;
  book_id: string;
  book_title: string;
  chapter_id: string;
  chapter_number: number;
  verse_number: number;
  original_text: string;
  english_translation: string;
}

const SEARCH_DEBOUNCE_MS = 300;

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  // Guards against out-of-order responses when the user types quickly:
  // only the result of the latest request is applied.
  const requestSeq = useRef(0);
  const router = useRouter();

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const seq = ++requestSeq.current;

    const timer = setTimeout(async () => {
      try {
        const data = await apiClient.get<SearchResult[]>(`/api/search?q=${encodeURIComponent(query)}`);
        if (seq === requestSeq.current) {
          setResults(data);
        }
      } catch (error) {
        if (seq === requestSeq.current) {
          console.error('Search error:', error);
          setResults([]);
        }
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const renderResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.resultCard}
      onPress={() => router.push(`/chapter/${item.chapter_id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.resultHeader}>
        <Text style={styles.bookTitle}>{item.book_title}</Text>
        <Text style={styles.reference}>
          {item.chapter_number}:{item.verse_number}
        </Text>
      </View>
      <Text style={styles.originalText} numberOfLines={2}>
        {item.original_text}
      </Text>
      <Text style={styles.translationText} numberOfLines={2}>
        {item.english_translation}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#7A6A5A" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search texts..."
          placeholderTextColor="#9A8A7A"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={20} color="#9A8A7A" />
          </TouchableOpacity>
        )}
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B4513" />
        </View>
      )}

      {!loading && results.length === 0 && query.length >= 2 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={64} color="#C8B8A8" />
          <Text style={styles.emptyText}>No results found</Text>
          <Text style={styles.emptySubtext}>Try a different search term</Text>
        </View>
      )}

      {!loading && query.length === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="book-outline" size={64} color="#C8B8A8" />
          <Text style={styles.emptyText}>Search the Library</Text>
          <Text style={styles.emptySubtext}>Enter keywords to find verses</Text>
        </View>
      )}

      {!loading && results.length > 0 && (
        <FlatList
          data={results}
          renderItem={renderResult}
          keyExtractor={(item) => item.verse_id}
          contentContainerStyle={styles.resultsList}
          keyboardShouldPersistTaps="handled"
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8DCC8',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#4A3728',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  resultsList: {
    padding: 16,
  },
  resultCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8DCC8',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B4513',
  },
  reference: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7A6A5A',
  },
  originalText: {
    fontSize: 15,
    color: '#4A3728',
    marginBottom: 4,
    fontFamily: 'Georgia',
  },
  translationText: {
    fontSize: 14,
    color: '#7A6A5A',
    fontStyle: 'italic',
  },
});
