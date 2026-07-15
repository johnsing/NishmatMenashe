import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { apiClient } from '@/src/api/client';
import { Ionicons } from '@expo/vector-icons';
import { adminStyles } from './styles';

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
}

const COLOR_OPTIONS = ['#8B7355', '#A0522D', '#CD853F', '#D2691E', '#B8860B', '#8B4513', '#6B4423', '#4A3728'];

export default function AdminBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [saving, setSaving] = useState(false);

  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [coverColor, setCoverColor] = useState(COLOR_OPTIONS[0]);
  const [order, setOrder] = useState('0');

  const load = async () => {
    try {
      const [booksData, catsData] = await Promise.all([
        apiClient.get<Book[]>('/api/admin/books'),
        apiClient.get<Category[]>('/api/categories'),
      ]);
      setBooks(booksData);
      setCategories(catsData);
      if (catsData.length > 0 && !categoryId) setCategoryId(catsData[0].category_id);
    } catch (error) {
      console.error('Error loading books:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setTitle('');
    setAuthor('');
    setDescription('');
    setCoverColor(COLOR_OPTIONS[0]);
    setOrder(String(books.length + 1));
    setCategoryId(categories[0]?.category_id || '');
    setModalOpen(true);
  };

  const openEdit = (book: Book) => {
    setEditing(book);
    setTitle(book.title);
    setAuthor(book.author);
    setDescription(book.description);
    setCoverColor(book.cover_color);
    setOrder(String(book.order));
    setCategoryId(book.category_id);
    setModalOpen(true);
  };

  const save = async () => {
    if (!title.trim() || !categoryId) {
      Alert.alert('Missing Fields', 'Please fill in title and select a category');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        category_id: categoryId,
        title: title.trim(),
        author: author.trim(),
        description: description.trim(),
        cover_color: coverColor,
        order: parseInt(order) || 0,
      };
      if (editing) {
        await apiClient.put(`/api/admin/books/${editing.book_id}`, payload);
      } else {
        await apiClient.post('/api/admin/books', payload);
      }
      setModalOpen(false);
      await load();
    } catch (error) {
      Alert.alert('Error', 'Could not save book');
    } finally {
      setSaving(false);
    }
  };

  const remove = (book: Book) => {
    Alert.alert(
      'Delete Book',
      `Delete "${book.title}" and ALL its chapters/verses? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/api/admin/books/${book.book_id}`);
              await load();
            } catch (error) {
              Alert.alert('Error', 'Could not delete');
            }
          },
        },
      ]
    );
  };

  const getCategoryTitle = (id: string) => categories.find(c => c.category_id === id)?.title || 'Unknown';

  if (loading) {
    return (
      <View style={adminStyles.centerContainer}>
        <ActivityIndicator size="large" color="#8B4513" />
      </View>
    );
  }

  return (
    <View style={adminStyles.container}>
      <FlatList
        data={books}
        keyExtractor={(item) => item.book_id}
        contentContainerStyle={adminStyles.list}
        renderItem={({ item }) => (
          <View style={adminStyles.card}>
            <View style={[adminStyles.accentBar, { backgroundColor: item.cover_color }]} />
            <View style={adminStyles.cardContent}>
              <Text style={adminStyles.cardTitle}>{item.title}</Text>
              <Text style={adminStyles.cardSubtitle}>{item.author} · {getCategoryTitle(item.category_id)}</Text>
              <Text style={adminStyles.cardDescription} numberOfLines={2}>{item.description}</Text>
              <View style={adminStyles.cardActions}>
                <TouchableOpacity style={adminStyles.actionButton} onPress={() => openEdit(item)} testID={`edit-book-${item.book_id}`}>
                  <Ionicons name="pencil" size={16} color="#8B4513" />
                  <Text style={adminStyles.actionText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[adminStyles.actionButton, adminStyles.deleteButton]} onPress={() => remove(item)} testID={`delete-book-${item.book_id}`}>
                  <Ionicons name="trash" size={16} color="#D2691E" />
                  <Text style={[adminStyles.actionText, adminStyles.deleteText]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={adminStyles.fab} onPress={openAdd} testID="add-book-fab">
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={adminStyles.modalOverlay}>
          <View style={adminStyles.modalContent}>
            <View style={adminStyles.modalHeader}>
              <Text style={adminStyles.modalTitle}>{editing ? 'Edit Book' : 'New Book'}</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={24} color="#7A6A5A" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={adminStyles.modalScroll}>
              <Text style={adminStyles.label}>Category</Text>
              <View style={adminStyles.picker}>
                {categories.map((c) => (
                  <TouchableOpacity
                    key={c.category_id}
                    style={[adminStyles.pickerOption, categoryId === c.category_id && adminStyles.pickerOptionActive]}
                    onPress={() => setCategoryId(c.category_id)}
                  >
                    <Text style={[adminStyles.pickerOptionText, categoryId === c.category_id && adminStyles.pickerOptionTextActive]}>{c.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={adminStyles.label}>Title (Hebrew name)</Text>
              <TextInput style={adminStyles.input} value={title} onChangeText={setTitle} placeholder="e.g. Bereishit" placeholderTextColor="#B8A898" />

              <Text style={adminStyles.label}>Author / English name</Text>
              <TextInput style={adminStyles.input} value={author} onChangeText={setAuthor} placeholder="e.g. Genesis" placeholderTextColor="#B8A898" />

              <Text style={adminStyles.label}>Description</Text>
              <TextInput style={[adminStyles.input, adminStyles.textarea]} value={description} onChangeText={setDescription} placeholder="Brief description" placeholderTextColor="#B8A898" multiline numberOfLines={3} />

              <Text style={adminStyles.label}>Cover Color</Text>
              <View style={adminStyles.colorGrid}>
                {COLOR_OPTIONS.map((c) => (
                  <TouchableOpacity key={c} style={[adminStyles.colorSwatch, { backgroundColor: c }, coverColor === c && adminStyles.colorSwatchActive]} onPress={() => setCoverColor(c)} />
                ))}
              </View>

              <Text style={adminStyles.label}>Order</Text>
              <TextInput style={adminStyles.input} value={order} onChangeText={setOrder} keyboardType="numeric" />

              <TouchableOpacity style={[adminStyles.saveButton, saving && adminStyles.saveButtonDisabled]} onPress={save} disabled={saving} testID="save-book-button">
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={adminStyles.saveButtonText}>{editing ? 'Update' : 'Create'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
