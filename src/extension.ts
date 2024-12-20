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

// import GLib from "gi://GLib";
// import Gio from "gi://Gio";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { overview } from "resource:///org/gnome/shell/ui/main.js";
import Meta from "gi://Meta";
import GLib from 'gi://GLib';

export default class MouseFollowsFocus extends Extension {
  settingsDebug = false;
  connectedWindowsSignals: { [id: number]: number } = {};
  windowCreateSignal: number | null = null;
  windowHiddenSignal: number | null = null;
  mouseMotionSignal: number | null = null;
  mouseMotionTimer: number | null = null;
  isMouseMoving =false;

  override enable(): void {
    const settings = this.getSettings();
    this.settingsDebug = settings.get_boolean("enable-debugging");
    this.debug_log("Enabling extension");

    for (const actor of global.get_window_actors()) {
      if (actor.is_destroyed()) continue;

      const win = actor.get_meta_window();
      if (win) {
        this.connect_to_window(win);
      } else {
        this.debug_log("Error connecting to window, actor has not meta window");
      }
    }

    this.windowCreateSignal = global.display.connect("window-created", (_source, win) => {
      this.debug_log(`Window "${win.get_title()}" created`);
      this.connect_to_window(win);
    });

    this.windowHiddenSignal = overview.connect("hidden", () => {
      const win = global.display.focus_window;
      this.debug_log(`Window "${win}" hidden`);
      this.focus_changed(win);
    });

    this.mouseMotionSignal = global.stage.connect("motion-event", () => {
      this.debug_log("Setting mouse movement guard to true");
      this.isMouseMoving = true;

      if (this.mouseMotionTimer) {
        this.debug_log("Removing mouse movement reset timer");
        GLib.Source.remove(this.mouseMotionTimer);
      }

      this.mouseMotionTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, (): boolean => {
        this.debug_log("Setting mouse movement guard to false after timeout");
        this.isMouseMoving = false;
        return false;
      });
    });
  }

  override disable(): void {
    this.debug_log("Disabling extension");

    if (this.windowCreateSignal) {
      global.display.disconnect(this.windowCreateSignal);
      this.windowCreateSignal = null;
    }

    if (this.windowHiddenSignal) {
      overview.disconnect(this.windowHiddenSignal);
      this.windowHiddenSignal = null;
    }

    if (this.mouseMotionSignal) {
      global.stage.disconnect(this.mouseMotionSignal);
      this.mouseMotionSignal = null;
    }

    if (this.mouseMotionTimer) {
      GLib.Source.remove(this.mouseMotionTimer);
      this.mouseMotionTimer = null;
    }

    for (const actor of global.get_window_actors()) {
      if (actor.is_destroyed()) continue;
      
      const win = actor.get_meta_window();
      if (win) {
        const connectedWindow = this.connectedWindowsSignals[win.get_id()];
        if (connectedWindow) {
          win.disconnect(connectedWindow);
          delete this.connectedWindowsSignals[win.get_id()];
        }
      }
    }
  }

  debug_log(message: string): void {
    if (this.settingsDebug) {
      console.log(`[${this.metadata.name}]: ${message}`);
    }
  }

  connect_to_window(win: Meta.Window): void {
    const windowType = win.get_window_type();
    if (windowType != Meta.WindowType.NORMAL) {
      this.debug_log(`Ignoring non normal window type ${windowType}`);
      return;
    }

    this.connectedWindowsSignals[win.get_id()] = win.connect("focus", () => this.focus_changed(win));
  }

  focus_changed(_: Meta.Window): void {

  }
}
