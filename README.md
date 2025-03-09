# GNOME Shell - Mouse Follows Focus

This extension enables mouse-follows-focus on GNOME Shell 45+.

The user experience is meant to be as similar as possible to i3/sway.

* [Features](#features)
* [Installation](#installation)
    * [Manual Installation](#manual-installation)
* [Configuration](#configuration)
* [Contributing](#contributing)
* [Acknowledgments](#acknowledgments)

## Features

- **Automatic Mouse Positioning**: Automatically repositions the mouse pointer to the center of the window that gains focus.
- **Multi-Monitor Support**: Seamlessly operates across multiple monitors, ensuring consistent behavior in multi-display setups.
- **Compatibility**: Designed for GNOME Shell version 45 and above.
- **Smooth**: Certain XWayland windows do not obey to normal focus rules and the pointer warps in the middle of the window. To handle this, the top and bottom bars area can be excluded from focus handling (see top/bottom bar height config option).

## Installation

The extension is available on [Gnome Extensions](https://extensions.gnome.org/extension/7656).

### Manual Installation

Install the extension code

```bash
git clone https://github.com/crisidev/mouse-follows-focus
npm install
npm run build
cp -r dist ~/.local/share/gnome-shell/extensions/mouse-follows-focus@crisidev.org
glib-compile-schemas ~/.local/share/gnome-shell/extensions/mouse-follows-focus@crisidev.org/schemas/
```

Restart GNOME Shell and enable the extension

```bash
gnome-extensions enable mouse-follows-focus@crisidev.org     
```

## Configuration

The extension can be configured with `dconf` / `gsettings` under the namespace `org.gnome.shell.extensions.mouse-follows-focus`
and with a dynamic UI built in the extension. Settings changed with the UI will be synced with `gsettings` and vice versa.

* `enable-debugging`: Set to `true` to enable debugging. It's very verbose :D
* `minimum-size-trigger`: Minimum window size (NxN) triggering mouse-follows-focus events
* `motion-event-timeout`: How long before resetting the mouse motion event detection timeout
* `top-bar-height`: Do not handle focus over the first N pixels from the top (0 to disable).
* `bottom-bar-height`: Do not handle focus over the last N pixels at the bottom (0 to disable).

## Dbus Integration

The extensions exposes some Dbus methods I am using for my day to day productivity:

### Focus a Workspace

```bash
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell/Extensions/MouseFollowsFocus \
    --method org.gnome.Shell.Extensions.MouseFollowsFocus.FocusWorkspace $WORSPACE_NUMBER # 1,2,3,etc..
```

### Hide the Overview

```bash
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell/Extensions/MouseFollowsFocus \
    --method org.gnome.Shell.Extensions.MouseFollowsFocus.HideOverview
```

### Clear all Notifications

```bash
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell/Extensions/MouseFollowsFocus \
    --method org.gnome.Shell.Extensions.MouseFollowsFocus.ClearNotifications
```

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests to improve the extension.

## Acknowledgments

This extension is based on the amazing GNOME Shell Extensions typescript template made by [swsnr](https://github.com/swsnr/gnome-shell-extension-typescript-template).
