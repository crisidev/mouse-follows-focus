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
* `minimum-size-trigger`: minimum window size (NxN) triggering mouse-follows-focus events
* `motion-event-timeout`: How long before resetting the mouse motion event detection timeout

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests to improve the extension.

## Acknowledgments

This extension is based on the amazing GNOME Shell Extensions typescript template made by [swsnr](https://github.com/swsnr/gnome-shell-extension-typescript-template).
