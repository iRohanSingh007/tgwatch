// Material 3 dark theme with a Telegram-blue accent.
import { MD3DarkTheme } from "react-native-paper";

export const theme = {
  ...MD3DarkTheme,
  roundness: 3,
  colors: {
    ...MD3DarkTheme.colors,
    primary: "#38a0f0",
    primaryContainer: "#0c4a73",
    secondary: "#8ab4f8",
    background: "#0d1117",
    surface: "#151b23",
    surfaceVariant: "#1e2630",
    onSurfaceVariant: "#aeb9c4",
    outline: "#2c3540",
    elevation: {
      level0: "transparent",
      level1: "#151b23",
      level2: "#1a212b",
      level3: "#1e2630",
      level4: "#222b36",
      level5: "#26303c",
    },
  },
};
