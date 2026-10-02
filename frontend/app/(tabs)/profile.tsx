import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { useState } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const { user,  } = useAuth();
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState('medium');

  const fontSizes = [
    { label: 'Small', value: 'small' },
    { label: 'Medium', value: 'medium' },
    { label: 'Large', value: 'large' },
  ];

  return (
    <ScrollView style={styles.container}>
      {/* User Info Section */}
      <View style={styles.section}>
        <View style={styles.userCard}>
          <View style={styles.avatarContainer}>
            {user?.picture ? (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{user.name[0]}</Text>
              </View>
            ) : (
              <View style={styles.avatar}>
                <Ionicons name="person" size={32} color="#8B4513" />
              </View>
            )}
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>
      </View>

      {/* Reading Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reading Preferences</Text>
        
        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="moon" size={24} color="#7A6A5A" style={styles.settingIcon} />
              <Text style={styles.settingLabel}>Dark Mode</Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: '#C8B8A8', true: '#8B4513' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={styles.settingCard}>
          <View style={styles.settingHeader}>
            <Ionicons name="text" size={24} color="#7A6A5A" style={styles.settingIcon} />
            <Text style={styles.settingLabel}>Font Size</Text>
          </View>
          <View style={styles.fontSizeOptions}>
            {fontSizes.map((size) => (
              <TouchableOpacity
                key={size.value}
                style={[
                  styles.fontSizeButton,
                  fontSize === size.value && styles.fontSizeButtonActive,
                ]}
                onPress={() => setFontSize(size.value)}
              >
                <Text
                  style={[
                    styles.fontSizeText,
                    fontSize === size.value && styles.fontSizeTextActive,
                  ]}
                >
                  {size.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Admin Section (visible only to admins) */}
      {user?.role === 'admin' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admin</Text>
          <TouchableOpacity
            style={styles.settingCard}
            onPress={() => router.push('/admin')}
            testID="admin-dashboard-button"
          >
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="shield-checkmark" size={24} color="#8B4513" style={styles.settingIcon} />
                <Text style={styles.settingLabel}>Admin Dashboard</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9A8A7A" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        
        <TouchableOpacity style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="information-circle" size={24} color="#7A6A5A" style={styles.settingIcon} />
              <Text style={styles.settingLabel}>About the Library</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9A8A7A" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="help-circle" size={24} color="#7A6A5A" style={styles.settingIcon} />
              <Text style={styles.settingLabel}>Help & Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9A8A7A" />
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F3',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7A6A5A',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8DCC8',
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF9F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E8DCC8',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#8B4513',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4A3728',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#7A6A5A',
  },
  settingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8DCC8',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: '#4A3728',
    fontWeight: '500',
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  fontSizeOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  fontSizeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#FAF8F3',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8DCC8',
  },
  fontSizeButtonActive: {
    backgroundColor: '#8B4513',
    borderColor: '#8B4513',
  },
  fontSizeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7A6A5A',
  },
  fontSizeTextActive: {
    color: '#fff',
  },
  bottomPadding: {
    height: 32,
  },
});
