import React, { useState, useEffect, useRef, useCallback } from "react";
import { Linking } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider, Appbar, BottomNavigation } from "react-native-paper";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";

import { theme } from "./src/theme";
import RulesScreen from "./src/screens/RulesScreen";
import HistoryScreen from "./src/screens/HistoryScreen";
import ChatsScreen from "./src/screens/ChatsScreen";
import { initNotifications, notifyMatch } from "./src/notify";
import { startMonitoring, isMonitoring } from "./src/tg";
import { listRules, watchedChatIds, addHistory } from "./src/db";

export default function App() {
  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: "rules", title: "Rules", focusedIcon: "filter-variant" },
    { key: "history", title: "History", focusedIcon: "history" },
    { key: "chats", title: "Chats", focusedIcon: "forum-outline" },
  ]);
  const engineStarted = useRef(false);

  // Start/refresh the live monitor once authed. The event handler is added
  // once; watched ids + rules are read fresh via mutable refs.
  const watchRef = useRef(new Set());
  const rulesRef = useRef([]);

  const refreshEngine = useCallback(async () => {
    // Mutate the Set/array in place so the live event handler (which captured
    // these references at start) always sees the latest ids and rules.
    const ids = await watchedChatIds();
    watchRef.current.clear();
    ids.forEach((i) => watchRef.current.add(i));
    const rules = await listRules();
    rulesRef.current.length = 0;
    rulesRef.current.push(...rules);
    if (!engineStarted.current) {
      engineStarted.current = true;
      await startMonitoring({
        watchedIds: watchRef.current,
        rules: rulesRef.current,
        onMatch: async (hit) => {
          await addHistory(hit);
          await notifyMatch(hit);
        },
      });
    }
  }, []);

  const onAuthChange = useCallback(
    (authed) => {
      if (authed) refreshEngine();
    },
    [refreshEngine]
  );

  useEffect(() => {
    initNotifications();
    // Tap a notification -> open the Telegram message.
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const link = resp?.notification?.request?.content?.data?.link;
      if (link) Linking.openURL(link).catch(() => {});
    });
    return () => sub.remove();
  }, []);

  // Keep the live monitor's view of ids/rules current when the handler
  // closure reads the Sets/arrays (they are mutated in place by refreshEngine).
  useEffect(() => {
    if (engineStarted.current) refreshEngine();
  });

  const renderScene = BottomNavigation.SceneMap({
    rules: RulesScreen,
    history: HistoryScreen,
    chats: () => <ChatsScreen onAuthChange={onAuthChange} />,
  });

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar style="light" />
        <Appbar.Header elevated>
          <Appbar.Content title="TgWatch" />
        </Appbar.Header>
        <BottomNavigation
          navigationState={{ index, routes }}
          onIndexChange={setIndex}
          renderScene={renderScene}
        />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
