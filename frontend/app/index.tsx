import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#8B4513" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF8F3",
    alignItems: "center",
    justifyContent: "center",
  },
});
