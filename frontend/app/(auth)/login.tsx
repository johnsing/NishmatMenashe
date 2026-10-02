import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '@/src/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const { login, error, clearError } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo/Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="book" size={80} color="#8B4513" />
        </View>

        <Text style={styles.title}>NishmatMenashe Library</Text>
        <Text style={styles.subtitle}>
          Access timeless wisdom and sacred texts{`\n`}anytime, anywhere
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color="#8B1A1A" style={styles.errorIcon} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={clearError} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={18} color="#8B1A1A" />
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.loginButton}
          onPress={login}
          activeOpacity={0.8}
        >
          <Ionicons name="logo-google" size={24} color="#fff" style={styles.googleIcon} />
          <Text style={styles.loginButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Sign in to sync your bookmarks and{`\n`}reading progress across all devices
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F3',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 32,
    padding: 24,
    backgroundColor: '#FFF9F0',
    borderRadius: 100,
    shadowColor: '#8B4513',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#4A3728',
    marginBottom: 12,
    fontFamily: 'Georgia',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#7A6A5A',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDECEA',
    borderColor: '#8B1A1A',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 24,
    width: '100%',
    maxWidth: 320,
  },
  errorIcon: {
    marginRight: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#8B1A1A',
    lineHeight: 18,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B4513',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  googleIcon: {
    marginRight: 12,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 13,
    color: '#9A8A7A',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 20,
  },
});
