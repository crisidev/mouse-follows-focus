// Copyright Sebastian Wiesner <sebastian@swsnr.de>
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
import Gtk from "gi://Gtk";
import Adw from "gi://Adw";

import type { ExtensionMetadata } from "@girs/gnome-shell/extensions/extension";

import { getTemplate } from "./template.js";

const LICENSE = `Copyright Sebastian Wiesner <sebastian@swsnr.de>

This programm is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.

Alternatively, this program may be used under the terms
of the GNU General Public License Version 2 or later, as described below:

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.`;

interface AboutPageChildren {
  _extensionName: Gtk.Label;
  _extensionDescription: Gtk.Label;
  _linkGithub: Gtk.LinkButton;
  _linkIssues: Gtk.LinkButton;
  _extensionLicense: Gtk.TextView;
}

class TypescriptTemplateAboutPage extends Adw.PreferencesPage {
  constructor(metadata: ExtensionMetadata) {
    super();
    const children = this as unknown as AboutPageChildren;
    children._extensionName.set_text(metadata.name);
    children._extensionDescription.set_text(metadata.description);
    if (metadata.url) {
      children._linkGithub.set_uri(metadata.url);
      children._linkIssues.set_uri(`${metadata.url}/issues`);
    } else {
      children._linkGithub.visible = false;
      children._linkIssues.visible = false;
    }
    children._extensionLicense.buffer.set_text(LICENSE, -1);
  }
}

export default GObject.registerClass(
  {
    GTypeName: "TypescriptTemplateAboutPage",
    Template: getTemplate("AboutPage"),
    InternalChildren: [
      "extensionName",
      "extensionDescription",
      "linkGithub",
      "linkIssues",
      "extensionLicense",
    ],
  },
  TypescriptTemplateAboutPage,
);
