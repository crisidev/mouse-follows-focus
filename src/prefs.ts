// Copyright Matteo Bigoi <bigo@crisidev.org>
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

import Gio from "gi://Gio";
import Adw from "gi://Adw";

import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import AboutPage from "./lib/prefs/about_page.js";
import GeneralPage from "./lib/prefs/general_page.js";

export default class MouseFollowsFocusPreferences extends ExtensionPreferences {
  override fillPreferencesWindow(
    window: Adw.PreferencesWindow & {
      _settings: Gio.Settings;
    },
  ): Promise<void> {
    // Create a settings object and bind the row to our key.
    // Attach the settings object to the window to keep it alive while the window is alive.
    window._settings = this.getSettings();
    window.add(new GeneralPage(window._settings));
    window.add(new AboutPage(this.metadata));
    return Promise.resolve();
  }
}
