package io.github.up9cloud.td;

// JNI bridge to the prebuilt libtdjson.so (TDLib JSON interface).
// .so files are placed in app/src/main/jniLibs/<abi>/ (pulled in CI from
// https://github.com/up9cloud/android-libtdjson releases).
public final class JsonClient {
    static {
        try {
            System.loadLibrary("tdjson");
        } catch (UnsatisfiedLinkError e) {
            e.printStackTrace();
        }
    }

    public static native int td_create_client_id();
    public static native void td_send(int client_id, String request);
    public static native String td_receive(double timeout);
    public static native String td_execute(String request);

    public interface LogMessageCallback {
        void call(int verbosity_level, String message);
    }
    public static native void td_set_log_message_callback(int max_verbosity_level, LogMessageCallback callback);
}
