import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { apiClient } from '@/src/api/client';
import { Ionicons } from '@expo/vector-icons';
import { adminStyles } from './_styles';

interface Category {
  category_id: string;
  title: string;
  description: string;
  accent_color: string;
  order: number;
}

const COLOR_OPTIONS = ['#2C5F5D', '#D4A017', '#6B9AC4', '#2E7D32', '#8B1A1A', '#1A237E', '#AD1457', '#8B4513'];

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [accentColor, setAccentColor] = useState(COLOR_OPTIONS[0]);
  const [order, setOrder] = useState('0');

  const load = async () => {
    try {
      const data = await apiClient.get<Category[]>('/api/categories');
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
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
    setDescription('');
    setAccentColor(COLOR_OPTIONS[0]);
    setOrder(String(categories.length + 1));
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setTitle(cat.title);
    setDescription(cat.description);
    setAccentColor(cat.accent_color);
    setOrder(String(cat.order));
    setModalOpen(true);
  };

  const save = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Missing Fields', 'Please fill in title and description');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        accent_color: accentColor,
        order: parseInt(order) || 0,
      };
      if (editing) {
        await apiClient.put(`/api/admin/categories/${editing.category_id}`, payload);
      } else {
        await apiClient.post('/api/admin/categories', payload);
      }
      setModalOpen(false);
      await load();
    } catch (error) {
      Alert.alert('Error', 'Could not save category');
    } finally {
      setSaving(false);
    }
  };

  const remove = (cat: Category) => {
    Alert.alert(
      'Delete Category',
      `Delete "${cat.title}" and ALL its books, chapters, and verses? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/api/admin/categories/${cat.category_id}`);
              await load();
            } catch (error) {
              Alert.alert('Error', 'Could not delete');
            }
          },
        },
      ]
    );
  };

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
        data={categories}
        keyExtractor={(item) => item.category_id}
        contentContainerStyle={adminStyles.list}
        renderItem={({ item }) => (
          <View style={adminStyles.card}>
            <View style={[adminStyles.accentBar, { backgroundColor: item.accent_color }]} />
            <View style={adminStyles.cardContent}>
              <Text style={adminStyles.cardTitle}>{item.title}</Text>
              <Text style={adminStyles.cardDescription} numberOfLines={2}>{item.description}</Text>
              <View style={adminStyles.cardActions}>
                <TouchableOpacity style={adminStyles.actionButton} onPress={() => openEdit(item)} testID={`edit-category-${item.category_id}`}>
                  <Ionicons name="pencil" size={16} color="#8B4513" />
                  <Text style={adminStyles.actionText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[adminStyles.actionButton, adminStyles.deleteButton]} onPress={() => remove(item)} testID={`delete-category-${item.category_id}`}>
                  <Ionicons name="trash" size={16} color="#D2691E" />
                  <Text style={[adminStyles.actionText, adminStyles.deleteText]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={adminStyles.fab} onPress={openAdd} testID="add-category-fab">
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={adminStyles.modalOverlay}>
          <View style={adminStyles.modalContent}>
            <View style={adminStyles.modalHeader}>
              <Text style={adminStyles.modalTitle}>{editing ? 'Edit Category' : 'New Category'}</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={24} color="#7A6A5A" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={adminStyles.modalScroll}>
              <Text style={adminStyles.label}>Title</Text>
              <TextInput style={adminStyles.input} value={title} onChangeText={setTitle} placeholder="e.g. Tanakh" placeholderTextColor="#B8A898" />

              <Text style={adminStyles.label}>Description</Text>
              <TextInput style={[adminStyles.input, adminStyles.textarea]} value={description} onChangeText={setDescription} placeholder="Brief description" placeholderTextColor="#B8A898" multiline numberOfLines={3} />

              <Text style={adminStyles.label}>Accent Color</Text>
              <View style={adminStyles.colorGrid}>
                {COLOR_OPTIONS.map((c) => (
                  <TouchableOpacity key={c} style={[adminStyles.colorSwatch, { backgroundColor: c }, accentColor === c && adminStyles.colorSwatchActive]} onPress={() => setAccentColor(c)} />
                ))}
              </View>

              <Text style={adminStyles.label}>Order</Text>
              <TextInput style={adminStyles.input} value={order} onChangeText={setOrder} keyboardType="numeric" />

              <TouchableOpacity style={[adminStyles.saveButton, saving && adminStyles.saveButtonDisabled]} onPress={save} disabled={saving} testID="save-category-button">
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={adminStyles.saveButtonText}>{editing ? 'Update' : 'Create'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
