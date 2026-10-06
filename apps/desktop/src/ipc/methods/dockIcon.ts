// Fork-local: the running Dock tile follows the in-app stage artwork; the bundle icon stays fixed.
import * as Electron from "electron";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Schema from "effect/Schema";

import * as DesktopEnvironment from "../../app/DesktopEnvironment.ts";
import * as DesktopIpc from "../DesktopIpc.ts";
import { SET_DOCK_ICON_CHANNEL } from "../channels.ts";

const DockIconImage = Schema.NullOr(
  Schema.String.check(
    Schema.isMaxLength(4_194_304),
    Schema.isPattern(/^data:image\/png;base64,[a-z0-9+/]+={0,2}$/i),
  ),
);

export const setDockIcon = DesktopIpc.makeIpcMethod({
  channel: SET_DOCK_ICON_CHANNEL,
  payload: DockIconImage,
  result: Schema.Void,
  handler: Effect.fn("desktop.ipc.setDockIcon")(function* (image) {
    const environment = yield* DesktopEnvironment.DesktopEnvironment;
    if (environment.platform !== "darwin") return;
    if (image !== null) {
      Electron.app.dock?.setIcon(Electron.nativeImage.createFromDataURL(image));
      return;
    }
    // null restores the packaged icon, which the build stages as icon.png beside the .icns.
    const fileSystem = yield* FileSystem.FileSystem;
    for (const candidate of environment.resolveResourcePathCandidates("icon.png")) {
      if (yield* fileSystem.exists(candidate).pipe(Effect.orElseSucceed(() => false))) {
        Electron.app.dock?.setIcon(candidate);
        return;
      }
    }
  }),
});
