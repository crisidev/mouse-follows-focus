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
import {
  overview,
  panel,
  messageTray,
} from "resource:///org/gnome/shell/ui/main.js";
import Meta from "gi://Meta";
import GLib from "gi://GLib";
import Mtk from "gi://Mtk";
import Gio from "gi://Gio";
import Clutter from "gi://Clutter";
import { NotificationDestroyedReason, Source } from "resource:///org/gnome/shell/ui/messageTray.js";

interface Child {
  clear(): null;
}

export default class MouseFollowsFocus extends Extension {
  private connectedWindowsSignals = new Map<number, number[]>();
  private windowCreatedSignal: number | null = null;
  private windowHiddenSignal: number | null = null;
  private motionEventSignal: number | null = null;
  private motionEventTimer: number | null = null;
  private topBarHeight = 0;
  private bottomBarHeight = 0;
  private minimumSizeTrigger = 0;
  private isMouseMoving = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private lastMouseTime = 0;
  private currentFocusedWindow: Meta.Window | null = null;
  private lastActiveMonitorIndex = 0;
  private windowLastPositions = new Map<number, {relativeX: number, relativeY: number}>();
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

    // Initialize to primary monitor
    this.lastActiveMonitorIndex = global.display.get_primary_monitor();

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

        // If a new window is created and we previously stayed on primary monitor,
        // warp the mouse back to help with window placement
        const primaryMonitor = global.display.get_primary_monitor();
        const [mouseX, mouseY] = global.get_pointer();
        const currentMonitorIndex = global.display.get_monitor_index_for_rect(
          new Mtk.Rectangle({ x: mouseX, y: mouseY, width: 1, height: 1 }),
        );

        if (this.lastActiveMonitorIndex === primaryMonitor && currentMonitorIndex !== primaryMonitor) {
          this.debug_log("New window created, warping mouse back to primary monitor");
          // Get the center of the primary monitor
          const primaryMonitorGeom = global.display.get_monitor_geometry(primaryMonitor);
          Clutter.get_default_backend()
            .get_default_seat()
            .warp_pointer(
              primaryMonitorGeom.x + primaryMonitorGeom.width / 2,
              primaryMonitorGeom.y + primaryMonitorGeom.height / 2,
            );
        }
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
      const [mouseX, mouseY] = global.get_pointer();
      this.lastMouseX = mouseX;
      this.lastMouseY = mouseY;
      this.lastMouseTime = GLib.get_monotonic_time();

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
            // Guard against callback executing after disable()
            if (this.motionEventTimer === null) {
              return false;
            }
            this.debug_log(
              `Setting mouse movement guard to false after timeout`,
            );
            this.isMouseMoving = false;
            this.motionEventTimer = null;
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

    // Disconnect all window signals
    for (const actor of global.get_window_actors()) {
      if (actor.is_destroyed()) continue;

      const win = actor.get_meta_window();
      if (win) {
        const windowId = win.get_id();
        const signals = this.connectedWindowsSignals.get(windowId);
        if (signals) {
          for (const signalId of signals) {
            win.disconnect(signalId);
          }
          this.connectedWindowsSignals.delete(windowId);
        }
      }
    }

    // Clean up any remaining signal connections for windows that no longer exist
    this.connectedWindowsSignals.clear();

    // Reset all state
    this.isMouseMoving = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.lastMouseTime = 0;
    this.currentFocusedWindow = null;
    this.lastActiveMonitorIndex = 0;
    this.windowLastPositions.clear();

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

    const windowId = win.get_id();
    const signals: number[] = [];

    // Connect to focus signal
    signals.push(
      win.connect("focus", () => {
        this.focus_changed(win);
      })
    );

    // Connect to unmanaged signal to clean up stored positions
    signals.push(
      win.connect("unmanaged", () => {
        this.debug_log(`Window unmanaged, cleaning up`);
        this.windowLastPositions.delete(windowId);
        this.connectedWindowsSignals.delete(windowId);

        // Clear currentFocusedWindow if this was it
        if (this.currentFocusedWindow?.get_id() === windowId) {
          this.currentFocusedWindow = null;
        }
      })
    );

    this.connectedWindowsSignals.set(windowId, signals);
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
    tolerance = 5,
  ): boolean {
    return (
      mouseX >= windowRectangle.x - tolerance &&
      mouseX <= windowRectangle.x + windowRectangle.width + tolerance &&
      mouseY >= windowRectangle.y - tolerance &&
      mouseY <= windowRectangle.y + windowRectangle.height + tolerance
    );
  }

  private has_mouse_moved_recently(
    currentX: number,
    currentY: number,
    thresholdMs = 150,
    minDistance = 3,
  ): boolean {
    const currentTime = GLib.get_monotonic_time();
    const timeDiffMs = (currentTime - this.lastMouseTime) / 1000;
    const distance = Math.sqrt(
      Math.pow(currentX - this.lastMouseX, 2) +
      Math.pow(currentY - this.lastMouseY, 2),
    );

    const hasMoved = timeDiffMs < thresholdMs && distance > minDistance;
    if (hasMoved) {
      this.debug_log(`Recent movement detected: ${distance.toFixed(1)}px in ${timeDiffMs.toFixed(0)}ms`);
    }
    return hasMoved;
  }

  private window_has_decorations(win: Meta.Window): boolean {
    const frameRect = win.get_frame_rect();
    const bufferRect = win.get_buffer_rect();

    return frameRect.x !== bufferRect.x ||
           frameRect.y !== bufferRect.y ||
           frameRect.width !== bufferRect.width ||
           frameRect.height !== bufferRect.height;
  }

  private has_windows_on_workspace_monitor(workspace: Meta.Workspace, monitorIndex: number): boolean {
    const windows = workspace.list_windows();
    return windows.some(win => {
      if (win.get_window_type() !== Meta.WindowType.NORMAL) {
        return false;
      }
      const winMonitor = win.get_monitor();
      return winMonitor === monitorIndex;
    });
  }

  private warp_pointer(win: Meta.Window, previousWindow: Meta.Window | null = null): void {
    const windowRectangle = win.get_buffer_rect();
    const warpToLastPosition = this.getSettings().get_boolean("warp-to-last-position");
    const windowId = win.get_id();

    // Save current position before warping away (as relative offset)
    const windowToSave = previousWindow ?? this.currentFocusedWindow;
    if (warpToLastPosition && windowToSave && windowToSave !== win) {
      try {
        const currentWindowId = windowToSave.get_id();
        const [mouseX, mouseY] = global.get_pointer();
        const currentWindowRect = windowToSave.get_buffer_rect();

        // Calculate relative position within the window
        const relativeX = mouseX - currentWindowRect.x;
        const relativeY = mouseY - currentWindowRect.y;

        // Save position if within current window bounds
        if (relativeX >= 0 && relativeX <= currentWindowRect.width &&
            relativeY >= 0 && relativeY <= currentWindowRect.height) {
          this.windowLastPositions.set(currentWindowId, { relativeX, relativeY });
          this.debug_log(`Saved relative position (${relativeX.toString()}, ${relativeY.toString()}) for window ${currentWindowId.toString()} before warping`);
        }
      } catch (e) {
        this.debug_log(`Error saving current position before warp: ${String(e)}`);
      }
    }

    let targetX: number;
    let targetY: number;

    if (warpToLastPosition && this.windowLastPositions.has(windowId)) {
      const lastPos = this.windowLastPositions.get(windowId);
      if (!lastPos) {
        // Shouldn't happen, but handle it
        targetX = windowRectangle.x + windowRectangle.width / 2;
        targetY = windowRectangle.y + windowRectangle.height / 2;
        this.debug_log(`Warping to window ${win.wm_class} center (no position found)`);
      } else {
        // Convert relative position back to absolute coordinates
        targetX = windowRectangle.x + lastPos.relativeX;
        targetY = windowRectangle.y + lastPos.relativeY;

        // Validate the position is still within window bounds (in case window was resized)
        if (lastPos.relativeX >= 0 && lastPos.relativeX <= windowRectangle.width &&
            lastPos.relativeY >= 0 && lastPos.relativeY <= windowRectangle.height) {
          this.debug_log(`Warping to window ${win.wm_class} last position (${targetX.toString()}, ${targetY.toString()}) [relative: ${lastPos.relativeX.toString()}, ${lastPos.relativeY.toString()}]`);
        } else {
          // Last position is outside window bounds (window was resized), use center
          targetX = windowRectangle.x + windowRectangle.width / 2;
          targetY = windowRectangle.y + windowRectangle.height / 2;
          this.debug_log(`Warping to window ${win.wm_class} center (last position out of bounds due to resize)`);
        }
      }
    } else {
      // No last position or setting disabled, use center
      targetX = windowRectangle.x + windowRectangle.width / 2;
      targetY = windowRectangle.y + windowRectangle.height / 2;
      this.debug_log(`Warping to window ${win.wm_class} center`);
    }

    Clutter.get_default_backend()
      .get_default_seat()
      .warp_pointer(targetX, targetY);
  }

  private focus_changed(win: Meta.Window | null): void {
    if (!win) {
      this.debug_log("Focus change skipped due to empty window object");
      return;
    }

    this.debug_log(`Focus changed to "${win.get_title()}"`);

    // Check if this window is actually gaining focus or just being notified
    if (this.currentFocusedWindow === win) {
      this.debug_log("Window already focused, ignoring redundant focus event");
      return;
    }

    // Check if the globally focused window is this window
    const actualFocusedWindow = global.display.focus_window;
    if (actualFocusedWindow !== win) {
      this.debug_log("Window is not actually focused (losing focus event), ignoring");
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

    // Store previous window before updating
    const previousWindow = this.currentFocusedWindow;

    // Update current focused window AFTER validation
    this.currentFocusedWindow = win;

    const [mouseX, mouseY] = global.get_pointer();
    const windowRectangle = win.get_buffer_rect();
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

      const primaryMonitor = global.display.get_primary_monitor();
      const activeWorkspace = global.workspace_manager.get_active_workspace();

      // Check if we're moving from primary to secondary monitor
      if (sourceMonitorIndex === primaryMonitor && destinationMonitorIndex !== primaryMonitor) {
        // Check if there are still windows on the primary monitor's active workspace
        const hasWindowsOnPrimary = this.has_windows_on_workspace_monitor(activeWorkspace, primaryMonitor);

        if (!hasWindowsOnPrimary) {
          this.debug_log("No windows left on primary monitor workspace, not warping to secondary");
          // Store that we want to stay on primary monitor
          this.lastActiveMonitorIndex = primaryMonitor;
          return;
        }
      }

      // Update last active monitor when we actually warp
      this.lastActiveMonitorIndex = destinationMonitorIndex;
      this.warp_pointer(win, previousWindow);
      return;
    }

    const monitor = global.display.get_monitor_geometry(destinationMonitorIndex);
    const monitorHeight = monitor.y + monitor.height;
    const monitorTop = monitor.y;

    if (mouseY < monitorTop + this.topBarHeight) {
      this.debug_log("Over the top bar, ignoring event.");
      return;
    } else if (mouseY > monitorHeight - this.bottomBarHeight) {
      this.debug_log("Over the bottom bar, ignoring event.");
      return;
    }

    // Use larger tolerance for borderless windows
    const hasDecorations = this.window_has_decorations(win);
    const tolerance = hasDecorations ? 5 : 20;
    this.debug_log(`Window ${hasDecorations ? "has" : "has no"} decorations, using tolerance: ${tolerance.toString()}px`);

    const isWithinWindow = this.cursor_within_window(mouseX, mouseY, windowRectangle, tolerance);

    if (isWithinWindow) {
      this.debug_log("Pointer within window (with tolerance), ignoring event.");
      return;
      /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    } else if (overview.visible) {
      /* eslint-enable @typescript-eslint/no-unsafe-member-access */
      this.debug_log("Overview visible, ignoring event.");
      return;
    } else if (
      windowRectangle.width < this.minimumSizeTrigger &&
      windowRectangle.height < this.minimumSizeTrigger
    ) {
      this.debug_log("Window too small, ignoring event.");
      return;
    }

    // Now check if user is actively moving the mouse
    // Only skip warp if mouse is moving AND close to the window (within extended tolerance)
    const isMoving = this.isMouseMoving || this.has_mouse_moved_recently(mouseX, mouseY);
    if (isMoving) {
      const extendedTolerance = hasDecorations ? 10 : 40;
      const isCloseToWindow = this.cursor_within_window(mouseX, mouseY, windowRectangle, extendedTolerance);

      if (isCloseToWindow) {
        this.debug_log("Mouse is moving and close to window, skipping warp to avoid interrupting transition");
        return;
      } else {
        this.debug_log("Mouse is moving but far from window, will warp");
      }
    }

    this.warp_pointer(win, previousWindow);
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
    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
    /* @ts-expect-error We access to private interfaces that are not available to typescript */
    const sectionList = panel.statusArea.dateMenu._messageList?._sectionList;

    if (sectionList) {
      // GNOME 46 and earlier
      sectionList.get_children().forEach((s: Child) => s.clear());
    } else {
      // GNOME 47+
      messageTray.getSources().forEach((source: Source) => {
        source.destroy(NotificationDestroyedReason.DISMISSED);
      });
    }
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
  }
}
