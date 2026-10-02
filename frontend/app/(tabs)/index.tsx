import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { apiClient } from '@/src/api/client';
import { Ionicons } from '@expo/vector-icons';

interface Category {
  category_id: string;
  title: string;
  description: string;
  accent_color: string;
  order: number;
}

export default function LibraryScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await apiClient.get<Category[]>('/api/categories');
      setCategories(data);
      setError(null);
    } catch (err: any) {
      console.error('Error loading categories:', err);
      setError(err?.message ?? 'Could not load the library');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCategories();
  };

  const renderCategory = ({ item }: { item: Category }) => (
    <TouchableOpacity
      style={styles.categoryCard}
      onPress={() => router.push(`/category/${item.category_id}`)}
      activeOpacity={0.7}
      testID={`category-card-${item.category_id}`}
    >
      <View style={[styles.accentBar, { backgroundColor: item.accent_color }]} />
      <Text style={styles.categoryTitle}>{item.title}</Text>
      <Text style={styles.categoryDescription} numberOfLines={4}>
        {item.description}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#8B4513" />
      </View>
    );
  }

  if (error && categories.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="cloud-offline-outline" size={64} color="#C8B8A8" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadCategories} activeOpacity={0.8}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={categories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.category_id}
        contentContainerStyle={styles.listContent}
        numColumns={2}
        columnWrapperStyle={styles.row}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8B4513"
            colors={['#8B4513']}
          />
        }
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
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#7A6A5A',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#8B4513',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  listContent: {
    padding: 12,
  },
  row: {
    justifyContent: 'space-between',
    gap: 12,
  },
  categoryCard: {
    flex: 1,
    marginBottom: 20,
    paddingTop: 16,
  },
  accentBar: {
    height: 3,
    width: '100%',
    marginBottom: 16,
    borderRadius: 1.5,
  },
  categoryTitle: {
    fontSize: 26,
    fontWeight: '400',
    color: '#3A2F26',
    marginBottom: 10,
    fontFamily: 'Georgia',
  },
  categoryDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: '#6A5A4A',
  },
});
