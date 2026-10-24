// Local notifications via expo-notifications. Tapping a notification opens
// the stored Telegram deep link (handled in App.js response listener).

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function initNotifications() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("matches", {
      name: "Keyword matches",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    await Notifications.requestPermissionsAsync();
  }
}

export async function notifyMatch(hit) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `[${hit.ruleName}] ${hit.chatTitle}`,
      body: (hit.text || "").slice(0, 140),
      data: { link: hit.link },
    },
    trigger: null, // immediate
  });
}
