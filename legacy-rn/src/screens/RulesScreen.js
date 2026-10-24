import React, { useState, useCallback } from "react";
import { View, ScrollView } from "react-native";
import { Card, Text, FAB, IconButton, Chip, useTheme } from "react-native-paper";
import { listRules, deleteRule } from "../db";
import RuleEditor from "./RuleEditor";

export default function RulesScreen() {
  const theme = useTheme();
  const [rules, setRules] = useState([]);
  const [editing, setEditing] = useState(null); // rule object or {} for new
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    setRules(await listRules());
    setLoaded(true);
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const summary = (r) =>
    r.mode === "regex"
      ? `regex: ${r.pattern || ""}`
      : `${r.logic || "OR"} · ${(r.includeTerms || []).join(", ") || "(any)"}`;

  if (editing !== null) {
    return (
      <RuleEditor
        rule={editing}
        onClose={() => {
          setEditing(null);
          refresh();
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 96 }}>
        {loaded && rules.length === 0 && (
          <Text variant="bodyMedium" style={{ textAlign: "center", marginTop: 48, opacity: 0.6 }}>
            No rules yet.{"\n"}Tap + to create your first keyword rule.
          </Text>
        )}
        {rules.map((r) => (
          <Card key={r.id} style={{ marginBottom: 10 }} onPress={() => setEditing(r)}>
            <Card.Title
              title={r.name}
              subtitle={summary(r)}
              right={(props) => (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Chip compact style={{ marginRight: 4 }}>
                    {r.enabled ? "on" : "off"}
                  </Chip>
                  <IconButton
                    {...props}
                    icon="delete-outline"
                    onPress={async () => {
                      await deleteRule(r.id);
                      refresh();
                    }}
                  />
                </View>
              )}
            />
          </Card>
        ))}
      </ScrollView>
      <FAB
        icon="plus"
        label="New rule"
        style={{ position: "absolute", right: 16, bottom: 16 }}
        onPress={() => setEditing({})}
      />
    </View>
  );
}
