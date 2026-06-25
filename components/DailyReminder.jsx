"use client";

// Opt-in daily reminder via on-device local notifications. Shown ONLY inside the
// installed app where the native LocalNotifications plugin exists — never on the
// website, and never on an older build that predates the plugin. Each device
// schedules its own notification at the user's chosen LOCAL time, so there's no
// 00:00-UTC blast and no server/timezone logic.
import { useState, useEffect } from "react";
import { LocalNotifications } from "@capacitor/local-notifications";
import { track } from "@/lib/analytics";

const NOTIF_ID = 1;
const KEY_ON = "picxle-reminder-on";
const KEY_TIME = "picxle-reminder-time";

const C = {
  cream: "var(--cream)",
  dim: "var(--creamDim)",
  blue: "var(--blue)",
  line: "var(--line)",
  ink2: "var(--ink2)",
};

export default function DailyReminder() {
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState("09:00");
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    try {
      const cap = window.Capacitor;
      const ok = !!(cap && cap.isPluginAvailable && cap.isPluginAvailable("LocalNotifications"));
      setAvailable(ok);
      if (ok) {
        const t = localStorage.getItem(KEY_TIME);
        if (t) setTime(t);
        setEnabled(localStorage.getItem(KEY_ON) === "1");
      }
    } catch {}
  }, []);

  const parse = (t) => {
    const [h, m] = String(t).split(":").map(Number);
    return { hour: Number.isFinite(h) ? h : 9, minute: Number.isFinite(m) ? m : 0 };
  };

  async function scheduleAt(t) {
    const { hour, minute } = parse(t);
    await LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] });
    await LocalNotifications.schedule({
      notifications: [{
        id: NOTIF_ID,
        title: "Picxle",
        body: "Today's puzzle is ready 🧩", // 🧩
        schedule: { on: { hour, minute }, repeats: true },
      }],
    });
  }

  async function enableReminder(t) {
    try {
      let perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") perm = await LocalNotifications.requestPermissions();
      if (perm.display !== "granted") { setDenied(true); return false; }
      setDenied(false);
      await scheduleAt(t);
      return true;
    } catch {
      return false;
    }
  }

  const onToggle = async () => {
    if (!enabled) {
      const ok = await enableReminder(time);
      if (ok) {
        setEnabled(true);
        try { localStorage.setItem(KEY_ON, "1"); localStorage.setItem(KEY_TIME, time); } catch {}
        track("reminder_enabled", { time });
      }
    } else {
      try { await LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] }); } catch {}
      setEnabled(false);
      try { localStorage.setItem(KEY_ON, "0"); } catch {}
      track("reminder_disabled");
    }
  };

  const onTimeChange = async (e) => {
    const t = e.target.value || "09:00";
    setTime(t);
    try { localStorage.setItem(KEY_TIME, t); } catch {}
    if (enabled) {
      try { await scheduleAt(t); track("reminder_time_changed", { time: t }); } catch {}
    }
  };

  if (!available) return null;

  return (
    <div style={{
      width: "min(300px, 100%)",
      marginTop: 26,
      padding: "14px 16px",
      background: C.ink2,
      border: `1px solid ${C.line}`,
      borderRadius: 12,
      animation: "fadeUp .35s .7s ease both",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 14, color: C.cream, letterSpacing: "0.3px" }}>
          🔔 Daily reminder
        </span>
        <button
          onClick={onToggle}
          role="switch"
          aria-checked={enabled}
          aria-label="Daily reminder on or off"
          style={{
            position: "relative", width: 48, height: 28, flexShrink: 0,
            borderRadius: 999, border: "none", cursor: "pointer", padding: 0,
            background: enabled ? C.blue : C.line, transition: "background .2s ease",
          }}
        >
          <span style={{
            position: "absolute", top: 3, left: enabled ? 23 : 3,
            width: 22, height: 22, borderRadius: "50%", background: "#fff",
            transition: "left .2s ease", boxShadow: "0 1px 3px rgba(0,0,0,.3)",
          }} />
        </button>
      </div>

      {enabled && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 14 }}>
          <span style={{ fontSize: 13, color: C.dim }}>Remind me at</span>
          <input
            type="time"
            value={time}
            onChange={onTimeChange}
            style={{
              fontFamily: "inherit", fontSize: 15, color: C.cream,
              background: "transparent", border: `1px solid ${C.line}`,
              borderRadius: 8, padding: "6px 10px",
            }}
          />
        </div>
      )}

      {denied && (
        <p style={{ fontSize: 12, color: C.dim, margin: "12px 0 0", lineHeight: 1.5 }}>
          Notifications are blocked. Turn them on for Picxle in your phone&apos;s Settings to get the reminder.
        </p>
      )}
    </div>
  );
}
