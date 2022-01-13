// https://gjs.guide/extensions/upgrading/gnome-shell-40.html#new-to-using-template-files-in-prefs-js
const {GObject, Gtk} = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.gnome4synology';
const GSETTINGS_URL_KEY = 'url';
const GSETTINGS_USER_KEY = 'user';
const GSETTINGS_PASSWORD_KEY = 'password';
const GSETTINGS_LIMIT_KEY = 'limit';
const GSETTINGS_ADDITIONAL_KEY = 'additional';
const GSETTINGS_POSTER_SIZE_KEY = 'poster-size';
const GSETTINGS_DEBUG_KEY = 'debug';

const comboBoxValues = [16,32,64,128,256];

const PrefsWidget = GObject.registerClass({
    GTypeName: 'PrefsWidget',
    Template: Me.dir.get_child('prefs.ui').get_uri(),
    InternalChildren: [
        'url_entry',
        'user_entry',
        'password_entry',
        'limit_button',
        'additional_button',
        'poster_size_label',
        'poster_size_combo',
        'debug_button',
    ],
}, class PrefsWidget extends Gtk.Box {

    _init(params = {}) {
        super._init(params);
        this._settings = ExtensionUtils.getSettings(SETTINGS_SCHEMA);
        this._url_entry.set_text(this._settings.get_value(GSETTINGS_URL_KEY).deep_unpack());
        this._user_entry.set_text(this._settings.get_value(GSETTINGS_USER_KEY).deep_unpack());
        this._password_entry.set_text(this._settings.get_value(GSETTINGS_PASSWORD_KEY).deep_unpack());
        this._limit_button.set_value(this._settings.get_int(GSETTINGS_LIMIT_KEY));
        this._additional_button.set_active(this._settings.get_boolean(GSETTINGS_ADDITIONAL_KEY));
        this._poster_size_combo.set_active(comboBoxValues.indexOf(this._settings.get_int(GSETTINGS_POSTER_SIZE_KEY)));
        this._debug_button.set_active(this._settings.get_boolean(GSETTINGS_DEBUG_KEY));
        this._poster_size_label.sensitive = this._settings.get_boolean(GSETTINGS_ADDITIONAL_KEY);
        this._poster_size_combo.sensitive = this._settings.get_boolean(GSETTINGS_ADDITIONAL_KEY);
    }
    
    _onURLChanged(entry) {
        this._settings.set_string(GSETTINGS_URL_KEY, entry.get_text());
    }

    _onUserChanged(entry) {
        this._settings.set_string(GSETTINGS_USER_KEY, entry.get_text());
    }

    _onPasswordChanged(entry) {
        this._settings.set_string(GSETTINGS_PASSWORD_KEY, entry.get_text());
    }

    _onLimitChanged(button) {
        this._settings.set_int(GSETTINGS_LIMIT_KEY, button.get_value());
    }

    _onAdditionalChanged(button) {
        this._settings.set_boolean(GSETTINGS_ADDITIONAL_KEY, button.get_active());
        this._poster_size_combo.sensitive = this._settings.get_boolean(GSETTINGS_ADDITIONAL_KEY);
        this._poster_size_label.sensitive = this._settings.get_boolean(GSETTINGS_ADDITIONAL_KEY);
    }

    _onPosterSizeChanged(combo) {
        this._settings.set_int(GSETTINGS_POSTER_SIZE_KEY, Number.parseInt(combo.get_active_text()));
    }

    _onDebugChanged(button) {
        this._settings.set_boolean(GSETTINGS_DEBUG_KEY, button.get_active());
    }
});

function init() {
}

function buildPrefsWidget() {
    return new PrefsWidget();
}
