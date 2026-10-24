import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import {
  Appbar, TextInput, Switch, Text, SegmentedButtons, Button, Card, Divider,
} from "react-native-paper";
import { saveRule } from "../db";
import { matchMessage } from "../matcher";

function Row({ label, children }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 6 }}>
      <Text variant="bodyLarge">{label}</Text>
      {children}
    </View>
  );
}

export default function RuleEditor({ rule, onClose }) {
  const [name, setName] = useState(rule.name || "");
  const [mode, setMode] = useState(rule.mode || "simple");
  const [include, setInclude] = useState((rule.includeTerms || []).join(", "));
  const [exclude, setExclude] = useState((rule.excludeTerms || []).join(", "));
  const [pattern, setPattern] = useState(rule.pattern || "");
  const [logic, setLogic] = useState(rule.logic || "OR");
  const [wholeWord, setWholeWord] = useState(!!rule.wholeWord);
  const [caseSensitive, setCaseSensitive] = useState(!!rule.caseSensitive);
  const [enabled, setEnabled] = useState(rule.enabled !== false);
  const [sample, setSample] = useState("");
  const [testResult, setTestResult] = useState(null);

  const split = (s) => s.split(",").map((t) => t.trim()).filter(Boolean);
  const build = () => ({
    id: rule.id,
    name: name.trim() || "rule",
    mode,
    includeTerms: split(include),
    excludeTerms: split(exclude),
    pattern,
    logic,
    wholeWord,
    caseSensitive,
    enabled,
  });

  const onSave = async () => {
    await saveRule(build());
    onClose();
  };

  return (
    <View style={{ flex: 1 }}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={onClose} />
        <Appbar.Content title={rule.id ? "Edit rule" : "New rule"} />
        <Appbar.Action icon="check" onPress={onSave} />
      </Appbar.Header>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <TextInput label="Rule name" value={name} onChangeText={setName} mode="outlined" style={{ marginBottom: 12 }} />

        <SegmentedButtons
          value={mode}
          onValueChange={setMode}
          buttons={[
            { value: "simple", label: "Keywords" },
            { value: "regex", label: "Regex" },
          ]}
          style={{ marginBottom: 12 }}
        />

        {mode === "simple" ? (
          <>
            <TextInput
              label="Include terms (comma separated)"
              value={include}
              onChangeText={setInclude}
              mode="outlined"
              style={{ marginBottom: 12 }}
            />
            <TextInput
              label="Exclude terms — NOT (comma separated)"
              value={exclude}
              onChangeText={setExclude}
              mode="outlined"
              style={{ marginBottom: 12 }}
            />
            <SegmentedButtons
              value={logic}
              onValueChange={setLogic}
              buttons={[
                { value: "OR", label: "Match ANY (OR)" },
                { value: "AND", label: "Match ALL (AND)" },
              ]}
              style={{ marginBottom: 8 }}
            />
            <Row label="Whole word only">
              <Switch value={wholeWord} onValueChange={setWholeWord} />
            </Row>
          </>
        ) : (
          <TextInput
            label="Regex pattern"
            value={pattern}
            onChangeText={setPattern}
            mode="outlined"
            autoCapitalize="none"
            style={{ marginBottom: 12 }}
          />
        )}

        <Row label="Case sensitive">
          <Switch value={caseSensitive} onValueChange={setCaseSensitive} />
        </Row>
        <Row label="Enabled">
          <Switch value={enabled} onValueChange={setEnabled} />
        </Row>

        <Divider style={{ marginVertical: 16 }} />

        <Card mode="contained">
          <Card.Content>
            <Text variant="titleMedium" style={{ marginBottom: 8 }}>
              Test this rule
            </Text>
            <TextInput
              label="Paste a sample message"
              value={sample}
              onChangeText={(t) => {
                setSample(t);
                setTestResult(null);
              }}
              mode="outlined"
              multiline
            />
            <Button
              mode="contained-tonal"
              style={{ marginTop: 10 }}
              onPress={() => setTestResult(matchMessage(sample, build()))}
            >
              Test
            </Button>
            {testResult !== null && (
              <Text
                variant="titleMedium"
                style={{ marginTop: 10, color: testResult ? "#4caf50" : "#ef5350" }}
              >
                {testResult ? "✓ MATCHES" : "✗ no match"}
              </Text>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}
