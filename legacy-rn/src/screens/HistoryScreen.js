import React, { useState, useCallback } from "react";
import { View, ScrollView, Linking } from "react-native";
import { Searchbar, Card, Text, Chip } from "react-native-paper";
import { searchHistory } from "../db";

export default function HistoryScreen() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);

  const refresh = useCallback(async (q) => {
    setRows(await searchHistory(q || null));
  }, []);

  React.useEffect(() => {
    refresh("");
  }, [refresh]);

  const when = (ts) => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return "";
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Searchbar
        placeholder="Search matches…"
        value={query}
        onChangeText={(t) => {
          setQuery(t);
          refresh(t);
        }}
        style={{ margin: 10 }}
      />
      <ScrollView contentContainerStyle={{ padding: 10, paddingTop: 0 }}>
        {rows.length === 0 && (
          <Text style={{ textAlign: "center", marginTop: 48, opacity: 0.6 }}>
            No matches yet. When a watched chat gets a keyword hit, it shows here.
          </Text>
        )}
        {rows.map((h) => (
          <Card key={h.id} style={{ marginBottom: 10 }} onPress={() => Linking.openURL(h.link)}>
            <Card.Content>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Chip compact>{h.rule_name}</Chip>
                <Text variant="labelSmall" style={{ opacity: 0.6 }}>
                  {when(h.ts)}
                </Text>
              </View>
              <Text variant="titleSmall">{h.chat_title}</Text>
              <Text variant="bodyMedium" numberOfLines={3} style={{ opacity: 0.85 }}>
                {h.text}
              </Text>
              <Text variant="labelSmall" style={{ marginTop: 6, color: "#38a0f0" }}>
                Tap to open in Telegram →
              </Text>
            </Card.Content>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
