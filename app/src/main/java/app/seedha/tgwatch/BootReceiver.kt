package app.seedha.tgwatch

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import java.io.File

/**
 * Restart monitoring after device reboot — but only if the user has a TDLib
 * session (so we don't pop a persistent notification before first login).
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return
        val hasSession = File(context.filesDir, "td/td.binlog").exists()
        if (hasSession) MonitorService.start(context)
    }
}
