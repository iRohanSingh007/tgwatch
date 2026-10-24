import React from "react";
import { View } from "react-native";
import { Text, Icon, Button } from "react-native-paper";

// v0.1 placeholder. Telegram login + live chat selection land in v0.2
// (GramJS), once the cloud build pipeline is proven green.
export default function ChatsScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
      <Icon source="telegram" size={64} color="#38a0f0" />
      <Text variant="titleLarge" style={{ marginTop: 16, textAlign: "center" }}>
        Connect Telegram
      </Text>
      <Text variant="bodyMedium" style={{ marginTop: 8, textAlign: "center", opacity: 0.7 }}>
        Logging in with your phone number and picking channels to watch is
        coming in the next build. For now you can create and test keyword
        rules on the Rules tab.
      </Text>
      <Button mode="contained-tonal" style={{ marginTop: 20 }} disabled>
        Log in (next build)
      </Button>
    </View>
  );
}
