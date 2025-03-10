// Copyright Matteo Bigoi <bigo#crisidev.org>
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0.If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// Alternatively, the contents of this file may be used under the terms
// of the GNU General Public License Version 2 or later, as described below:
//
// This program is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation; either version 2 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { overview, panel } from "resource:///org/gnome/shell/ui/main.js";
import Meta from "gi://Meta";
import GLib from "gi://GLib";
import Mtk from "gi://Mtk";
import Gio from "gi://Gio";
import Clutter from "gi://Clutter";

interface Child {
  clear(): null;
}

export default class MouseFollowsFocus extends Extension {
  private connectedWindowsSignals = new Map<number, number>();
  private windowCreatedSignal: number | null = null;
  private windowHiddenSignal: number | null = null;
  private motionEventSignal: number | null = null;
  private motionEventTimer: number | null = null;
  private topBarHeight = 0;
  private bottomBarHeight = 0;
  private minimumSizeTrigger = 0;
  private isMouseMoving = false;
  private dbus?: Gio.DBusExportedObject | null = null;
  private dbus_interface = `<node>
   <interface name="org.gnome.Shell.Extensions.MouseFollowsFocus">
      <method name="FocusWorkspace">
         <arg type="u" direction="in" name="workspaceId" />
      </method>
      <method name="HideOverview">
      </method>
      <method name="ClearNotifications">
      </method>
   </interface>
</node>`;

  override enable(): void {
    this.info_log("Enabling extension");

    this.info_log("Registering dbus interface");
    this.dbus = Gio.DBusExportedObject.wrapJSObject(this.dbus_interface, this);
    this.dbus.export(
      Gio.DBus.session,
      "/org/gnome/Shell/Extensions/MouseFollowsFocus",
    );

    this.info_log("Attatching to available windows");
    for (const actor of global.get_window_actors()) {
      if (actor.is_destroyed()) continue;

      const win = actor.get_meta_window();
      if (win) {
        this.connect_to_window(win);
      } else {
        this.debug_log("Error connecting to window, actor has not meta window");
      }
    }

    this.windowCreatedSignal = global.display.connect(
      "window-created",
      (_source, win) => {
        this.debug_log(`Window "${win.get_title()}" created`);
        this.connect_to_window(win);
      },
    );
    this.info_log(
      `Signal window-created started with id ${this.windowCreatedSignal.toString()}`,
    );

    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
    this.windowHiddenSignal = overview.connect("hidden", () => {
      const win = global.display.focus_window;
      /* eslint-disable @typescript-eslint/no-unnecessary-condition */
      if (win) {
        /* eslint-enable @typescript-eslint/no-unnecessary-condition */
        this.debug_log(`Window "${win.get_title()}" hidden`);
        this.focus_changed(win);
      }
    });
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
    this.info_log("Signal window-hidden started");

    this.motionEventSignal = global.stage.connect("motion-event", () => {
      if (!this.isMouseMoving) {
        this.debug_log("Setting mouse movement guard to true");
        this.isMouseMoving = true;

        if (this.motionEventTimer) {
          this.debug_log("Removing mouse movement reset timer");
          GLib.Source.remove(this.motionEventTimer);
        }

        this.motionEventTimer = GLib.timeout_add(
          GLib.PRIORITY_DEFAULT,
          this.getSettings().get_int("motion-event-timeout"),
          (): boolean => {
            this.debug_log(
              `Setting mouse movement guard to false after timeout`,
            );
            this.isMouseMoving = false;
            return false;
          },
        );
      } else {
        this.debug_log("Mouse movement guard already set");
      }
    });
    this.info_log(
      `Signal motion-event started with id ${this.motionEventSignal.toString()}`,
    );
    this.minimumSizeTrigger = this.getSettings().get_int(
      "minimum-size-trigger",
    );
    this.topBarHeight = this.getSettings().get_int("top-bar-height");
    this.bottomBarHeight = this.getSettings().get_int("bottom-bar-height");
    this.debug_log("Extension enabled");
  }

  override disable(): void {
    this.debug_log("Disabling extension");

    if (this.windowCreatedSignal) {
      global.display.disconnect(this.windowCreatedSignal);
      this.windowCreatedSignal = null;
      this.info_log("Signal window-created disconnected");
    }

    if (this.windowHiddenSignal) {
      /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
      overview.disconnect(this.windowHiddenSignal);
      /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
      this.windowHiddenSignal = null;
      this.info_log("Signal window-hidden disconnected");
    }

    if (this.motionEventSignal) {
      global.stage.disconnect(this.motionEventSignal);
      this.motionEventSignal = null;
      this.info_log("Signal motion-event disconnected");
    }

    if (this.motionEventTimer) {
      GLib.Source.remove(this.motionEventTimer);
      this.motionEventTimer = null;
    }

    for (const actor of global.get_window_actors()) {
      if (actor.is_destroyed()) continue;

      const win = actor.get_meta_window();
      if (win) {
        const connectedWindowSignal = this.connectedWindowsSignals.get(
          win.get_id(),
        );
        if (connectedWindowSignal) {
          win.disconnect(connectedWindowSignal);
          this.connectedWindowsSignals.delete(win.get_id());
        }
      }
    }

    this.info_log("Deatching dbus interface");
    if (this.dbus) {
      this.dbus.flush();
      this.dbus.unexport();
      delete this.dbus;
    }
    this.info_log("Detatched to available windows");
    this.debug_log("Extension disabled");
  }

  private debug_log(message: string): void {
    if (this.getSettings().get_boolean("enable-debugging")) {
      console.log(`[${this.metadata.name}] DEBUG ${message}`);
    }
  }

  private info_log(message: string): void {
    console.log(`[${this.metadata.name}] INFO  ${message}`);
  }

  private connect_to_window(win: Meta.Window): void {
    const windowType = win.get_window_type();
    if (windowType !== Meta.WindowType.NORMAL) {
      this.debug_log(
        `Ignoring non normal window type ${windowType.toString()}`,
      );
      return;
    }

    this.connectedWindowsSignals.set(
      win.get_id(),
      win.connect("focus", () => {
        this.focus_changed(win);
      }),
    );
  }

  private get_window_actor(win: Meta.Window): Meta.WindowActor | undefined {
    return global
      .get_window_actors()
      .find(
        (actor) => !actor.is_destroyed() && actor.get_meta_window() === win,
      );
  }

  private cursor_within_window(
    mouseX: number,
    mouseY: number,
    windowRectangle: Mtk.Rectangle,
  ): boolean {
    return (
      mouseX >= windowRectangle.x &&
      mouseX <= windowRectangle.x + windowRectangle.width &&
      mouseY >= windowRectangle.y &&
      mouseY <= windowRectangle.y + windowRectangle.height
    );
  }

  private warp_pointer(win: Meta.Window): void {
    this.debug_log(`Warping to window ${win.wm_class} center`);
    const windowRectangle = win.get_buffer_rect();
    Clutter.get_default_backend()
      .get_default_seat()
      .warp_pointer(
        windowRectangle.x + windowRectangle.width / 2,
        windowRectangle.y + windowRectangle.height / 2,
      );
  }

  private focus_changed(win: Meta.Window | null): void {
    if (!win) {
      this.debug_log("Focus change skipped due to empty window object");
      return;
    }

    this.debug_log(`Focus changed to "${win.get_title()}"`);

    if (this.isMouseMoving) {
      this.debug_log("Focus change skipped due to mouse movement");
      return;
    }

    const actor = this.get_window_actor(win);
    if (!actor) {
      this.debug_log("Focus change skipped due to invalid window actor");
      return;
    }

    if (win.is_floating()) {
      this.debug_log(
        `Focus change skipped due to floating windown "${win.get_title()}" already focused`,
      );
      return;
    }

    const windowRectangle = win.get_buffer_rect();
    const [mouseX, mouseY] = global.get_pointer();
    const sourceMonitorIndex = global.display.get_monitor_index_for_rect(
      new Mtk.Rectangle({ x: mouseX, y: mouseY, width: 1, height: 1 }),
    );
    const destinationMonitorIndex = global.display.get_monitor_index_for_rect(
      new Mtk.Rectangle({
        x: windowRectangle.x,
        y: windowRectangle.y,
        width: windowRectangle.width,
        height: windowRectangle.height,
      }),
    );

    if (sourceMonitorIndex !== destinationMonitorIndex) {
      this.debug_log("Focus switched to a different monitor");
      this.warp_pointer(win);
      return;
    }

    const monitorHeight = global.display.get_size()[1];
    if (mouseY < this.topBarHeight) {
      this.debug_log("Over the top bar, ignoring event.");
    } else if (mouseY > monitorHeight - this.bottomBarHeight) {
      this.debug_log("Over the bottom bar, ignoring event.");
    } else if (this.cursor_within_window(mouseX, mouseY, windowRectangle)) {
      this.debug_log("Pointer within window, ignoring event.");
      /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    } else if (overview.visible) {
      /* eslint-enable @typescript-eslint/no-unsafe-member-access */
      this.debug_log("Overview visible, ignoring event.");
    } else if (
      windowRectangle.width < this.minimumSizeTrigger &&
      windowRectangle.height < this.minimumSizeTrigger
    ) {
      this.debug_log("Window too small, ignoring event.");
    } else {
      this.warp_pointer(win);
    }
  }

  FocusWorkspace(workspaceId: number): void {
    const workspace =
      global.workspace_manager.get_workspace_by_index(workspaceId);
    if (workspace) {
      workspace.activate(global.get_current_time());
    } else {
      this.debug_log(`Unable to focus workspace ${workspaceId.toString()}`);
    }
  }

  HideOverview(): void {
    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    overview.hide();
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
  }

  ClearNotifications(): void {
    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    /* @ts-expect-error We access to private interfaces that are not available to typescript */
    panel.statusArea.dateMenu._messageList._sectionList
      .get_children()
      .forEach((s: Child) => s.clear());
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
  }
}
