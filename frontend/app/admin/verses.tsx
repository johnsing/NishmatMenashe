import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { apiClient } from '@/src/api/client';
import { Ionicons } from '@expo/vector-icons';
import { adminStyles } from './styles';

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
}

interface Book {
  book_id: string;
  title: string;
}

export default function AdminVerses() {
  const [verses, setVerses] = useState<Verse[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Verse | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterChapterId, setFilterChapterId] = useState<string>('all');
  const [filterBookId, setFilterBookId] = useState<string>('all');

  const [chapterId, setChapterId] = useState('');
  const [verseNumber, setVerseNumber] = useState('1');
  const [originalText, setOriginalText] = useState('');
  const [englishTranslation, setEnglishTranslation] = useState('');

  const load = async () => {
    try {
      const [versesData, chaptersData, booksData] = await Promise.all([
        apiClient.get<Verse[]>('/api/admin/verses'),
        apiClient.get<Chapter[]>('/api/admin/chapters'),
        apiClient.get<Book[]>('/api/admin/books'),
      ]);
      setVerses(versesData);
      setChapters(chaptersData);
      setBooks(booksData);
    } catch (error) {
      console.error('Error loading verses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    const defaultChapter = filterChapterId !== 'all' ? filterChapterId : chapters[0]?.chapter_id || '';
    setChapterId(defaultChapter);
    const versesInChapter = verses.filter(v => v.chapter_id === defaultChapter);
    setVerseNumber(String(versesInChapter.length + 1));
    setOriginalText('');
    setEnglishTranslation('');
    setModalOpen(true);
  };

  const openEdit = (v: Verse) => {
    setEditing(v);
    setChapterId(v.chapter_id);
    setVerseNumber(String(v.verse_number));
    setOriginalText(v.original_text);
    setEnglishTranslation(v.english_translation);
    setModalOpen(true);
  };

  const save = async () => {
    if (!chapterId || !originalText.trim() || !englishTranslation.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all fields');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        chapter_id: chapterId,
        verse_number: parseInt(verseNumber) || 1,
        original_text: originalText.trim(),
        english_translation: englishTranslation.trim(),
      };
      if (editing) {
        await apiClient.put(`/api/admin/verses/${editing.verse_id}`, payload);
      } else {
        await apiClient.post('/api/admin/verses', payload);
      }
      setModalOpen(false);
      await load();
    } catch (error) {
      Alert.alert('Error', 'Could not save verse');
    } finally {
      setSaving(false);
    }
  };

  const remove = (v: Verse) => {
    Alert.alert('Delete Verse', `Delete verse ${v.verse_number}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await apiClient.delete(`/api/admin/verses/${v.verse_id}`);
          await load();
        } catch (error) {
          Alert.alert('Error', 'Could not delete');
        }
      }},
    ]);
  };

  const getChapterInfo = (id: string) => {
    const ch = chapters.find(c => c.chapter_id === id);
    if (!ch) return 'Unknown';
    const book = books.find(b => b.book_id === ch.book_id);
    return `${book?.title || '?'} · Ch. ${ch.chapter_number} ${ch.title}`;
  };

  const filteredChapters = filterBookId === 'all' ? chapters : chapters.filter(c => c.book_id === filterBookId);
  const filtered = verses.filter(v => {
    if (filterChapterId !== 'all') return v.chapter_id === filterChapterId;
    if (filterBookId !== 'all') return filteredChapters.some(c => c.chapter_id === v.chapter_id);
    return true;
  });

  if (loading) return <View style={adminStyles.centerContainer}><ActivityIndicator size="large" color="#8B4513" /></View>;

  return (
    <View style={adminStyles.container}>
      {/* Book filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 56, minHeight: 56, backgroundColor: '#FAF8F3', borderBottomWidth: 1, borderBottomColor: '#E8DCC8' }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: 'center' }}
      >
        <TouchableOpacity
          style={[adminStyles.pickerOption, filterBookId === 'all' && adminStyles.pickerOptionActive, { flexShrink: 0 }]}
          onPress={() => { setFilterBookId('all'); setFilterChapterId('all'); }}
        >
          <Text style={[adminStyles.pickerOptionText, filterBookId === 'all' && adminStyles.pickerOptionTextActive]}>All Books</Text>
        </TouchableOpacity>
        {books.map((b) => (
          <TouchableOpacity
            key={b.book_id}
            style={[adminStyles.pickerOption, filterBookId === b.book_id && adminStyles.pickerOptionActive, { flexShrink: 0 }]}
            onPress={() => { setFilterBookId(b.book_id); setFilterChapterId('all'); }}
          >
            <Text style={[adminStyles.pickerOptionText, filterBookId === b.book_id && adminStyles.pickerOptionTextActive]}>{b.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.verse_id}
        contentContainerStyle={adminStyles.list}
        renderItem={({ item }) => (
          <View style={adminStyles.card}>
            <View style={[adminStyles.accentBar, { backgroundColor: '#8B4513' }]} />
            <View style={adminStyles.cardContent}>
              <Text style={adminStyles.cardSubtitle}>{getChapterInfo(item.chapter_id)} · Verse {item.verse_number}</Text>
              <Text style={adminStyles.cardHebrew}>{item.original_text}</Text>
              <Text style={adminStyles.cardEnglish}>{item.english_translation}</Text>
              <View style={adminStyles.cardActions}>
                <TouchableOpacity style={adminStyles.actionButton} onPress={() => openEdit(item)} testID={`edit-verse-${item.verse_id}`}>
                  <Ionicons name="pencil" size={16} color="#8B4513" />
                  <Text style={adminStyles.actionText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[adminStyles.actionButton, adminStyles.deleteButton]} onPress={() => remove(item)} testID={`delete-verse-${item.verse_id}`}>
                  <Ionicons name="trash" size={16} color="#D2691E" />
                  <Text style={[adminStyles.actionText, adminStyles.deleteText]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={adminStyles.fab} onPress={openAdd} testID="add-verse-fab">
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={adminStyles.modalOverlay}>
          <View style={adminStyles.modalContent}>
            <View style={adminStyles.modalHeader}>
              <Text style={adminStyles.modalTitle}>{editing ? 'Edit Verse' : 'New Verse'}</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}><Ionicons name="close" size={24} color="#7A6A5A" /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={adminStyles.modalScroll}>
              <Text style={adminStyles.label}>Chapter</Text>
              <View style={adminStyles.picker}>
                {chapters.map((c) => (
                  <TouchableOpacity key={c.chapter_id} style={[adminStyles.pickerOption, chapterId === c.chapter_id && adminStyles.pickerOptionActive]} onPress={() => setChapterId(c.chapter_id)}>
                    <Text style={[adminStyles.pickerOptionText, chapterId === c.chapter_id && adminStyles.pickerOptionTextActive]}>
                      {books.find(b => b.book_id === c.book_id)?.title} - Ch.{c.chapter_number}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={adminStyles.label}>Verse Number</Text>
              <TextInput style={adminStyles.input} value={verseNumber} onChangeText={setVerseNumber} keyboardType="numeric" />

              <Text style={adminStyles.label}>Original Text (Hebrew)</Text>
              <TextInput
                style={[adminStyles.input, adminStyles.hebrewInput, adminStyles.textarea]}
                value={originalText}
                onChangeText={setOriginalText}
                placeholder="בְּרֵאשִׁית בָּרָא..."
                placeholderTextColor="#B8A898"
                multiline
                numberOfLines={3}
              />

              <Text style={adminStyles.label}>English Translation</Text>
              <TextInput
                style={[adminStyles.input, adminStyles.textarea]}
                value={englishTranslation}
                onChangeText={setEnglishTranslation}
                placeholder="In the beginning God created..."
                placeholderTextColor="#B8A898"
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity style={[adminStyles.saveButton, saving && adminStyles.saveButtonDisabled]} onPress={save} disabled={saving} testID="save-verse-button">
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={adminStyles.saveButtonText}>{editing ? 'Update' : 'Create'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
