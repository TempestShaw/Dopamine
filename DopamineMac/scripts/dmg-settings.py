# dmgbuild settings for the drag-to-Applications installer window.
# Invoked by scripts/dmg.sh as: dmgbuild -s dmg-settings.py -D app=<path> -D background=<jpg> -D icon=<icns>
# Icon positions must match the landing pads drawn in Resources/dmg/background.html.
import os.path

app = defines["app"]  # noqa: F821 - provided by dmgbuild
app_name = os.path.basename(app)

format = "ULMO"  # LZMA: the smallest image, readable on macOS 10.15 and later (Dopamine needs 12)
filesystem = "HFS+"
files = [app]
symlinks = {"Applications": "/Applications"}
icon = defines["icon"]  # noqa: F821

background = defines["background"]  # noqa: F821
# Height adds the 28 pt title bar so the whole 660×400 background shows.
window_rect = ((200, 160), (660, 428))
default_view = "icon-view"
show_status_bar = False
show_tab_view = False
show_toolbar = False
show_pathbar = False
show_sidebar = False

icon_size = 128
text_size = 13
icon_locations = {
    app_name: (170, 210),
    "Applications": (490, 210),
}
hide_extensions = [app_name]
