/*
 * Copyright (C) 2021 Peter Sasse <osasse@gmx.de>
 * Copyright (C) 2017 Carlos Soriano <csoriano@redhat.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GioSSS = Gio.SettingsSchemaSource;
const ExtensionUtils = imports.misc.extensionUtils;
const Extension = ExtensionUtils.getCurrentExtension();
const Gettext = imports.gettext.domain("gnome4synology@psasse.gmx.de");
const _ = Gettext.gettext;

const SCHEMA_SYNO = 'org.gnome.shell.extensions.gnome4synology';
const SCHEMA = 'org.gnome.shell.extensions.gnome4synology';
var synoSettings;
var settings;
var prefSettings;
const settingKeys = ['url','user','password'];

function init() {
    let schemaSource = GioSSS.get_default();
    let schemaObj = schemaSource.lookup(SCHEMA_SYNO, true);
    if (!schemaObj) {
       synoSettings = null;
    } else {
       synoSettings = new Gio.Settings({ settings_schema: schemaObj });;
    }
    settings = get_schema(SCHEMA);
    prefSettings = new Map();
    settingKeys.forEach(key => { prefSettings[key] = settings.get_value(key).unpack(); });
}

function buildPrefsWidget() {
    let frame = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, border_width: 10, spacing: 10 });
    frame.add(buildEntry(settingKeys[0], _("URL of Synology® NAS eg 'discstation:5000'")));
    frame.add(buildEntry(settingKeys[1], _("User on Synology® NAS eg 'admin'")));
    frame.add(buildEntry(settingKeys[2], _("Password on Synology® NAS eg 'password'")));
    frame.connect('destroy', () => { settingKeys.forEach(key => { settings.set_string(key, prefSettings[key]); }); });
    frame.show_all();
    return frame;
}

function buildEntry(key, labelText) {
    let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
    let label = new Gtk.Label({ label: labelText, xalign: 0 });
    let entry = new Gtk.Entry({ hexpand: true, text: prefSettings[key] });
    entry.connect('notify', () => { prefSettings[key] = entry.get_text(); });
    hbox.pack_start(label, true, true, 0);
    hbox.add(entry);
    return hbox;
}

function get_schema(schema) {
    let extension = ExtensionUtils.getCurrentExtension();

    // check if this extension was built with "make zip-file", and thus
    // has the schema files in a subfolder
    // otherwise assume that extension has been installed in the
    // same prefix as gnome-shell (and therefore schemas are available
    // in the standard folders)
    let schemaDir = extension.dir.get_child('schemas');
    let schemaSource;
    if (schemaDir.query_exists(null))
        schemaSource = GioSSS.new_from_directory(schemaDir.get_path(), GioSSS.get_default(), false);
    else
        schemaSource = GioSSS.get_default();

    let schemaObj = schemaSource.lookup(schema, true);
    if (!schemaObj)
        throw new Error('Schema ' + schema + ' could not be found for extension ' + extension.metadata.uuid + '. Please check your installation.');

    return new Gio.Settings({ settings_schema: schemaObj });
}

