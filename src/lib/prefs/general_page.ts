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

import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";
import Adw from "gi://Adw";

import { getTemplate } from "./template.js";

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
interface TypescriptTemplateGeneralPage {
  _enableDebugging: Adw.SwitchRow;
  _minimumSizeTrigger: Gtk.SpinButton;
  _motionEventTimeout: Gtk.SpinButton;
  _topBarHeight: Gtk.SpinButton;
  _bottomBarHeight: Gtk.SpinButton;
  _warpToLastPosition: Adw.SwitchRow;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
class TypescriptTemplateGeneralPage extends Adw.PreferencesPage {
  constructor(settings: Gio.Settings) {
    super();

    settings.bind(
      "enable-debugging",
      this._enableDebugging,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      "minimum-size-trigger",
      this._minimumSizeTrigger,
      "value",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      "motion-event-timeout",
      this._motionEventTimeout,
      "value",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      "top-bar-height",
      this._topBarHeight,
      "value",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      "bottom-bar-height",
      this._bottomBarHeight,
      "value",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      "warp-to-last-position",
      this._warpToLastPosition,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );
  }
}

export default GObject.registerClass(
  {
    GTypeName: "TypescriptTemplateGeneralPage",
    Template: getTemplate("GeneralPage"),
    InternalChildren: [
      "enableDebugging",
      "minimumSizeTrigger",
      "motionEventTimeout",
      "topBarHeight",
      "bottomBarHeight",
      "warpToLastPosition",
    ],
  },
  TypescriptTemplateGeneralPage,
);
