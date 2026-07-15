import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { apiClient } from '@/src/api/client';
import { Ionicons } from '@expo/vector-icons';
import { adminStyles } from './styles';

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
}

export default function AdminChapters() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Chapter | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterBookId, setFilterBookId] = useState<string>('all');

  const [bookId, setBookId] = useState('');
  const [chapterNumber, setChapterNumber] = useState('1');
  const [title, setTitle] = useState('');

  const load = async () => {
    try {
      const [chaptersData, booksData] = await Promise.all([
        apiClient.get<Chapter[]>('/api/admin/chapters'),
        apiClient.get<Book[]>('/api/admin/books'),
      ]);
      setChapters(chaptersData);
      setBooks(booksData);
      if (booksData.length > 0 && !bookId) setBookId(booksData[0].book_id);
    } catch (error) {
      console.error('Error loading chapters:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    setBookId(filterBookId !== 'all' ? filterBookId : books[0]?.book_id || '');
    const bookChapters = chapters.filter(c => c.book_id === (filterBookId !== 'all' ? filterBookId : books[0]?.book_id));
    setChapterNumber(String(bookChapters.length + 1));
    setTitle('');
    setModalOpen(true);
  };

  const openEdit = (ch: Chapter) => {
    setEditing(ch);
    setBookId(ch.book_id);
    setChapterNumber(String(ch.chapter_number));
    setTitle(ch.title);
    setModalOpen(true);
  };

  const save = async () => {
    if (!title.trim() || !bookId) {
      Alert.alert('Missing Fields', 'Please fill in title and select a book');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        book_id: bookId,
        chapter_number: parseInt(chapterNumber) || 1,
        title: title.trim(),
      };
      if (editing) {
        await apiClient.put(`/api/admin/chapters/${editing.chapter_id}`, payload);
      } else {
        await apiClient.post('/api/admin/chapters', payload);
      }
      setModalOpen(false);
      await load();
    } catch (error) {
      Alert.alert('Error', 'Could not save chapter');
    } finally {
      setSaving(false);
    }
  };

  const remove = (ch: Chapter) => {
    Alert.alert('Delete Chapter', `Delete "${ch.title}" and all its verses?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await apiClient.delete(`/api/admin/chapters/${ch.chapter_id}`);
          await load();
        } catch (error) {
          Alert.alert('Error', 'Could not delete');
        }
      }},
    ]);
  };

  const getBookTitle = (id: string) => books.find(b => b.book_id === id)?.title || 'Unknown';

  const filtered = filterBookId === 'all' ? chapters : chapters.filter(c => c.book_id === filterBookId);

  if (loading) return <View style={adminStyles.centerContainer}><ActivityIndicator size="large" color="#8B4513" /></View>;

  return (
    <View style={adminStyles.container}>
      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 56, minHeight: 56, backgroundColor: '#FAF8F3', borderBottomWidth: 1, borderBottomColor: '#E8DCC8' }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: 'center' }}
      >
        <TouchableOpacity
          style={[adminStyles.pickerOption, filterBookId === 'all' && adminStyles.pickerOptionActive, { flexShrink: 0 }]}
          onPress={() => setFilterBookId('all')}
        >
          <Text style={[adminStyles.pickerOptionText, filterBookId === 'all' && adminStyles.pickerOptionTextActive]}>All Books</Text>
        </TouchableOpacity>
        {books.map((b) => (
          <TouchableOpacity
            key={b.book_id}
            style={[adminStyles.pickerOption, filterBookId === b.book_id && adminStyles.pickerOptionActive, { flexShrink: 0 }]}
            onPress={() => setFilterBookId(b.book_id)}
          >
            <Text style={[adminStyles.pickerOptionText, filterBookId === b.book_id && adminStyles.pickerOptionTextActive]}>{b.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.chapter_id}
        contentContainerStyle={adminStyles.list}
        renderItem={({ item }) => (
          <View style={adminStyles.card}>
            <View style={[adminStyles.accentBar, { backgroundColor: '#8B4513' }]} />
            <View style={adminStyles.cardContent}>
              <Text style={adminStyles.cardTitle}>Ch. {item.chapter_number}: {item.title}</Text>
              <Text style={adminStyles.cardSubtitle}>{getBookTitle(item.book_id)} · {item.verse_count} verses</Text>
              <View style={adminStyles.cardActions}>
                <TouchableOpacity style={adminStyles.actionButton} onPress={() => openEdit(item)} testID={`edit-chapter-${item.chapter_id}`}>
                  <Ionicons name="pencil" size={16} color="#8B4513" />
                  <Text style={adminStyles.actionText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[adminStyles.actionButton, adminStyles.deleteButton]} onPress={() => remove(item)} testID={`delete-chapter-${item.chapter_id}`}>
                  <Ionicons name="trash" size={16} color="#D2691E" />
                  <Text style={[adminStyles.actionText, adminStyles.deleteText]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={adminStyles.fab} onPress={openAdd} testID="add-chapter-fab">
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={adminStyles.modalOverlay}>
          <View style={adminStyles.modalContent}>
            <View style={adminStyles.modalHeader}>
              <Text style={adminStyles.modalTitle}>{editing ? 'Edit Chapter' : 'New Chapter'}</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}><Ionicons name="close" size={24} color="#7A6A5A" /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={adminStyles.modalScroll}>
              <Text style={adminStyles.label}>Book</Text>
              <View style={adminStyles.picker}>
                {books.map((b) => (
                  <TouchableOpacity key={b.book_id} style={[adminStyles.pickerOption, bookId === b.book_id && adminStyles.pickerOptionActive]} onPress={() => setBookId(b.book_id)}>
                    <Text style={[adminStyles.pickerOptionText, bookId === b.book_id && adminStyles.pickerOptionTextActive]}>{b.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={adminStyles.label}>Chapter Number</Text>
              <TextInput style={adminStyles.input} value={chapterNumber} onChangeText={setChapterNumber} keyboardType="numeric" />

              <Text style={adminStyles.label}>Title</Text>
              <TextInput style={adminStyles.input} value={title} onChangeText={setTitle} placeholder="e.g. Creation" placeholderTextColor="#B8A898" />

              <TouchableOpacity style={[adminStyles.saveButton, saving && adminStyles.saveButtonDisabled]} onPress={save} disabled={saving} testID="save-chapter-button">
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={adminStyles.saveButtonText}>{editing ? 'Update' : 'Create'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
