import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView } from "react-native";
import {
  Text, TextInput, Button, List, Switch, Icon, ActivityIndicator,
  Divider, HelperText, Appbar,
} from "react-native-paper";
import {
  isAuthorized, sendCode, signInCode, signInPassword, listDialogs, logout,
} from "../tg";
import { listChats, upsertChat, setWatched, watchedChatIds } from "../db";

export default function ChatsScreen({ onAuthChange }) {
  const [phase, setPhase] = useState("loading"); // loading|phone|code|password|chats
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [chats, setChats] = useState([]);
  const [watched, setWatchedSet] = useState(new Set());

  const loadChats = useCallback(async () => {
    setBusy(true);
    try {
      const dialogs = await listDialogs();
      for (const d of dialogs) await upsertChat(d);
      const rows = await listChats();
      setChats(rows);
      setWatchedSet(new Set(await watchedChatIds()));
      setPhase("chats");
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (await isAuthorized()) {
          onAuthChange?.(true);
          await loadChats();
        } else {
          setPhase("phone");
        }
      } catch (e) {
        setError(String(e?.message || e));
        setPhase("phone");
      }
    })();
  }, [loadChats, onAuthChange]);

  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(String(e?.errorMessage || e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const doSendCode = () =>
    run(async () => {
      await sendCode(phone.trim());
      setPhase("code");
    });

  const doCode = () =>
    run(async () => {
      const res = await signInCode(phone.trim(), code.trim());
      if (res === "password") setPhase("password");
      else {
        onAuthChange?.(true);
        await loadChats();
      }
    });

  const doPassword = () =>
    run(async () => {
      await signInPassword(password);
      onAuthChange?.(true);
      await loadChats();
    });

  const toggle = async (chatId, val) => {
    await setWatched(chatId, val);
    const ns = new Set(watched);
    val ? ns.add(chatId) : ns.delete(chatId);
    setWatchedSet(ns);
    onAuthChange?.(true); // triggers engine refresh in App
  };

  const doLogout = () =>
    run(async () => {
      await logout();
      onAuthChange?.(false);
      setPhase("phone");
      setChats([]);
    });

  if (phase === "loading") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>Connecting to Telegram…</Text>
      </View>
    );
  }

  if (phase === "chats") {
    return (
      <View style={{ flex: 1 }}>
        <Appbar.Header elevated>
          <Appbar.Content title="Watched chats" />
          <Appbar.Action icon="refresh" onPress={loadChats} />
          <Appbar.Action icon="logout" onPress={doLogout} />
        </Appbar.Header>
        {busy && <ActivityIndicator style={{ marginTop: 8 }} />}
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          <HelperText type="info" style={{ margin: 8 }}>
            Toggle the channels/groups to watch for keyword matches.
          </HelperText>
          {chats.map((c) => (
            <List.Item
              key={c.chat_id}
              title={c.title}
              description={c.username ? `@${c.username}` : "private"}
              right={() => (
                <Switch
                  value={watched.has(c.chat_id)}
                  onValueChange={(v) => toggle(c.chat_id, v)}
                />
              )}
            />
          ))}
        </ScrollView>
      </View>
    );
  }

  // login phases
  return (
    <ScrollView contentContainerStyle={{ padding: 24 }}>
      <View style={{ alignItems: "center", marginVertical: 24 }}>
        <Icon source="telegram" size={56} color="#38a0f0" />
        <Text variant="headlineSmall" style={{ marginTop: 12 }}>
          Log in to Telegram
        </Text>
      </View>

      {phase === "phone" && (
        <>
          <TextInput
            label="Phone (+country code)"
            value={phone}
            onChangeText={setPhone}
            mode="outlined"
            keyboardType="phone-pad"
          />
          <Button mode="contained" style={{ marginTop: 16 }} loading={busy} disabled={busy} onPress={doSendCode}>
            Send code
          </Button>
        </>
      )}

      {phase === "code" && (
        <>
          <TextInput
            label="Login code"
            value={code}
            onChangeText={setCode}
            mode="outlined"
            keyboardType="number-pad"
          />
          <Button mode="contained" style={{ marginTop: 16 }} loading={busy} disabled={busy} onPress={doCode}>
            Verify
          </Button>
        </>
      )}

      {phase === "password" && (
        <>
          <TextInput
            label="Two-step password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry
          />
          <Button mode="contained" style={{ marginTop: 16 }} loading={busy} disabled={busy} onPress={doPassword}>
            Unlock
          </Button>
        </>
      )}

      {!!error && (
        <HelperText type="error" visible style={{ marginTop: 16 }}>
          {error}
        </HelperText>
      )}
    </ScrollView>
  );
}
