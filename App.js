import React, { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider, Appbar, BottomNavigation } from "react-native-paper";
import { StatusBar } from "expo-status-bar";
import { theme } from "./src/theme";
import RulesScreen from "./src/screens/RulesScreen";
import HistoryScreen from "./src/screens/HistoryScreen";
import ChatsScreen from "./src/screens/ChatsScreen";

export default function App() {
  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: "rules", title: "Rules", focusedIcon: "filter-variant" },
    { key: "history", title: "History", focusedIcon: "history" },
    { key: "chats", title: "Chats", focusedIcon: "forum-outline" },
  ]);

  const renderScene = BottomNavigation.SceneMap({
    rules: RulesScreen,
    history: HistoryScreen,
    chats: ChatsScreen,
  });

  const titles = { rules: "Keyword rules", history: "Match history", chats: "Telegram" };

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
