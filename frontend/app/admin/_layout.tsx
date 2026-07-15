import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#FAF8F3' },
        headerTitleStyle: {
          fontFamily: 'Georgia',
          fontSize: 18,
          fontWeight: '700',
          color: '#3A2F26',
        },
        headerTintColor: '#8B4513',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Admin Dashboard' }} />
      <Stack.Screen name="categories" options={{ title: 'Manage Categories' }} />
      <Stack.Screen name="books" options={{ title: 'Manage Books' }} />
      <Stack.Screen name="chapters" options={{ title: 'Manage Chapters' }} />
      <Stack.Screen name="verses" options={{ title: 'Manage Verses' }} />
      <Stack.Screen name="users" options={{ title: 'Users' }} />
    </Stack>
  );
}
