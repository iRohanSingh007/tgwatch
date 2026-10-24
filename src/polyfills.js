// Polyfills required by GramJS in the React Native (Hermes) runtime.
// MUST be imported before any `telegram` import (see index.js).

import "react-native-get-random-values";
import { Buffer } from "buffer";
import process from "process";

if (typeof global.Buffer === "undefined") global.Buffer = Buffer;
if (typeof global.process === "undefined") global.process = process;
// GramJS references process.nextTick / process.version in places.
global.process.browser = true;
if (!global.process.version) global.process.version = "v20.0.0";
