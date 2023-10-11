export default {
    print: false,
    verbose: true,
    environments: ['gjs'],
    outdir: 'generated-gir-types',
    girDirectories: [
        // Various places where our required Gir files for Gnome shell dev
        // are found on an Arch Linux system.
        '/usr/share/gir-1.0',
        '/usr/share/gnome-shell/',
        '/usr/lib/mutter-13',
    ],
    modules: [
        // On Arch you need gobject-introspection for these girs
        "Gio-2.0",
        "GLib-2.0",
        "GnomeDesktop-4.0",
        "Shell-13",
        "Clutter-13",
        "St-13"
    ],
    ignore: [],
    noNamespace: false,
    buildType: 'types',
    moduleType: 'esm'
}
