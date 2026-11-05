import { settlePromise } from "@t3tools/client-runtime/state/runtime";
import { useGT, useMessages } from "gt-react";
import { useState } from "react";

import {
  hasDesktopNotifications,
  hasNotificationSound,
  NOTIFICATION_MODE_LABELS,
  unlockNotificationAudio,
} from "../../threadNotifications";
import { Button } from "../ui/button";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { SettingsRow } from "./settingsLayout";
import { useSearchableSetting } from "./settingsSearch";
import { useScopedSettings, useUpdateScopedSettings } from "./useScopedSettings";

export function NotificationSettings() {
  const searchableSetting = useSearchableSetting();
  const gt = useGT();
  const m = useMessages();
  const mode = useScopedSettings((settings) => settings.notificationMode);
  const updateSettings = useUpdateScopedSettings();
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [testing, setTesting] = useState(false);

  // Delayed so there is time to switch to another app, where thread alerts are meant to appear.
  const sendTestNotification = () => {
    setPermissionMessage(null);
    if (typeof Notification === "undefined") {
      setPermissionMessage(gt("This client has no Notification API."));
      return;
    }
    setTesting(true);
    window.setTimeout(() => {
      setTesting(false);
      const focused = document.hasFocus();
      const visibility = document.visibilityState;
      const permission = Notification.permission;
      const report = (outcome: string) =>
        setPermissionMessage(
          visibility === "visible" && focused
            ? gt(
                "{outcome} Permission: {permission}. Window: {visibility}, focused, so a thread alert would stay in the app instead.",
                { outcome, permission, visibility },
              )
            : gt(
                "{outcome} Permission: {permission}. Window: {visibility}, {focus}, so a thread alert would show as a notification.",
                {
                  outcome,
                  permission,
                  visibility,
                  focus: focused ? gt("focused") : gt("not focused"),
                },
              ),
        );
      try {
        const notification = new Notification(gt("Test notification"), {
          body: gt("Sent from Settings > General."),
          silent: true,
        });
        report(gt("Sent; waiting for the system to show it."));
        notification.addEventListener("show", () => report(gt("Shown.")));
        notification.addEventListener("error", () => report(gt("The system refused it.")));
      } catch (error) {
        report(gt("Could not create it: {error}.", { error: String(error) }));
      }
    }, 5000);
  };

  return (
    <SettingsRow
      {...searchableSetting("thread-notifications")}
      description={
        permissionMessage ??
        gt(
          "System alerts when a thread finishes, fails, or needs input or approval. Applies to this device while T3 Code is open.",
        )
      }
      control={
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button size="sm" variant="outline" disabled={testing} onClick={sendTestNotification}>
            {testing ? gt("Sending in 5s…") : gt("Test")}
          </Button>
          <Select
            value={mode}
            disabled={requesting}
            onValueChange={async (value) => {
              if (
                value !== "off" &&
                value !== "notifications" &&
                value !== "sound" &&
                value !== "notifications-and-sound"
              )
                return;
              setPermissionMessage(null);
              if (hasNotificationSound(value)) unlockNotificationAudio();
              if (hasDesktopNotifications(value)) {
                if (typeof Notification === "undefined" || !window.isSecureContext) {
                  setPermissionMessage(
                    gt(
                      "Notifications need a supported browser over HTTPS, or the desktop app. Sound only is still available.",
                    ),
                  );
                  return;
                }
                setRequesting(true);
                const permission = await settlePromise(() => Notification.requestPermission());
                setRequesting(false);
                if (permission._tag === "Failure") {
                  setPermissionMessage(
                    gt(
                      "Notifications are unavailable in this browser. Sound only is still available.",
                    ),
                  );
                  return;
                }
                if (permission.value !== "granted") {
                  setPermissionMessage(
                    gt(
                      "Allow notifications in your browser or system settings, then choose this option again. Sound only is still available.",
                    ),
                  );
                  return;
                }
              }
              updateSettings({ notificationMode: value });
            }}
          >
            <SelectTrigger
              size="sm"
              className="w-full sm:w-56"
              aria-label={gt("Thread notifications")}
            >
              <SelectValue>{m(NOTIFICATION_MODE_LABELS[mode])}</SelectValue>
            </SelectTrigger>
            <SelectPopup align="end" alignItemWithTrigger={false}>
              {Object.entries(NOTIFICATION_MODE_LABELS).map(([value, label]) => (
                <SelectItem key={value} hideIndicator value={value}>
                  {m(label)}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>
      }
    />
  );
}
