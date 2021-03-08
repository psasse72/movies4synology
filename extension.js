// Movie Search Provider for GNOME Shell on Synology® NAS
// Copyright (C) 2021 Peter Sasse
// Copyright (C) 2017 Valeri Karpov
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Util = imports.misc.util;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const ExtensionUtils = imports.misc.extensionUtils;
const Soup = imports.gi.Soup;

const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.gnome4synology';
const GSETTINGS_URL_KEY = 'url';
const GSETTINGS_USER_KEY = 'user';
const GSETTINGS_PWD_KEY = 'password';

var _httpSession, _settings, _url, _user, _password, _results, _error;

// see https://thecodebarbarian.com/mutual-exclusion-patterns-with-node-promises
class Lock {
  constructor() {
    this._locked = false;
  }

  acquire() {
    return new Promise(resolve => {
      if (!this._locked) {
        this._locked = true;
        return resolve();
      }

      const tryAcquire = () => {
        if (!this._locked) {
          this._locked = true;
          return resolve();
        }
      };
    });
  }

  release() {
    this._locked = false;
  }
}

const lock = new Lock();
const MovieSynologySearchProvider = new Lang.Class({
  
  Name: 'MovieSynologySearchProvider',

  _init : function(title, categoryType) {
    this._categoryType = categoryType;
    this._title = title;
    this.id = 'synology-movie-search-' + title;
    this.appInfo = {get_name : function() {return 'Movies@Synology®'},
                    get_icon : function() {return Gio.icon_new_for_string("/usr/share/icons/gnome/256x256/mimetypes/video.png");},
                    get_id : function() {return this.id;}
    };
  },
 
  getInitialResultSet: async function (terms, callback) {
    lock.release();
    _results = [];
    _error = null;
    if(terms.length ===1 && terms[0].length < 3) {
      return [];
    }
    let url = `http://${_url}/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=login&account=${_user}&passwd=${_password}&session=VideoStation&format=sid`;
    await lock.acquire();
    log(`${Me.metadata.name}: Connecting to NAS ${_url}...`);
    let request = Soup.Message.new('GET', url);
    _httpSession.queue_message(request, function(_httpSession, message) {
      let response = request.response_body.data;
      let json;
      try {	
        json=JSON.parse(response);
      } catch (e) {
        _error = `Error: "Unparsable answer from NAS ${this._url}. Wrong NAS OS version?"`;
        _results.push(_error);
        callback(_results);
        lock.release();
        return;
      }
      if ((message.status_code!=200) || (!json.data)) {
        _error = 'Error: \"'+(message.status_code!=200?message.reason_phrase:'Problem with authentication (wrong password?) with NAS.')+'\"';
        log(`${Me.metadata.name}: `+_error);
        _results.push(_error);
        callback(_results);
        lock.release();
        return;
      }
      url=`http://${_url}/webapi/VideoStation/movie.cgi?api=SYNO.VideoStation.Movie&version=4&method=search&library_id=0&title=${terms}&_sid=${json.data.sid}`;
      let request2 = Soup.Message.new('GET', url);
      _httpSession.queue_message(request2, function(_httpSession, message) {
        let movies = JSON.parse(request2.response_body.data).data.movies;
        log(`${Me.metadata.name}: Found #${movies.length} movies on NAS.`);
        Object.values(movies).forEach(movie => { _results.push(movie.title+' ('+movie.original_available.split('-')[0]+')'); });
        callback(_results);
        lock.release();
        url = `http://${_url}/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=logout&session=null`;
        let request3 = Soup.Message.new('GET', url);
        _httpSession.queue_message(request3, function(_httpSession, message) {
           log(`${Me.metadata.name}: Logged out from NAS.`);
        });
      });
    });
  },

  getSubsearchResultSet: async function (previousResults, terms, callback, cancellable) {
    await lock.acquire();
    callback((_results!==null) && (_error===null)?_results.filter(name => name.toUpperCase().indexOf(terms.toString().toUpperCase())>-1):(_error!==null?previousResults:[]));
    lock.release();
  },

  getSubsetResultSearch: function (previousResults, terms) {},

  getResultMetas: function (identifiers, callback) {
    let metas = identifiers.map((identifier) => ({
      id: identifier,
      name: identifier,
      createIcon: (size) => {
      	/*
      	TODO
        let relativeIconPath = this._searchEngines[identifier].iconPath;
        let extDir = Gio.file_new_for_path(Me.path);
        let iconFile = extDir.resolve_relative_path(relativeIconPath);
        let icon = new Gio.FileIcon({file: iconFile});
        return new St.Icon({gicon: icon, icon_size: size});
        */
      }
    }));
    callback(metas);
  },

  activateResult: function (identifier, terms) {
    let query = terms.join(' ');
  },

  filterResults: function (results, max) {
    return results.slice(0, results.length);
  }
});

let movieSynologySearchProvider = null;

function init () {}

function onSettingsUpdate() {
  _url = `${_settings.get_value(GSETTINGS_URL_KEY).deep_unpack()}`;
  _user = `${_settings.get_value(GSETTINGS_USER_KEY).deep_unpack()}`;
  _password = `${_settings.get_value(GSETTINGS_PWD_KEY).deep_unpack()}`;
  log(`${Me.metadata.name}: Got url "${_url}" and user "${_user}" from gsettings`);
}

function getSettings(schema) {
  if (Gio.Settings.list_schemas().indexOf(schema) == -1)
    throw Error(_("Schema \"%s\" not found.").format(schema));
  return new Gio.Settings({ schema: schema });
}

function enable () {
  _settings = ExtensionUtils.getSettings(SETTINGS_SCHEMA);
  _settings.connect('changed::' + GSETTINGS_URL_KEY, onSettingsUpdate);
  _settings.connect('changed::' + GSETTINGS_USER_KEY, onSettingsUpdate);
  _settings.connect('changed::' + GSETTINGS_PWD_KEY, onSettingsUpdate);
  onSettingsUpdate();

  let resultSignalGroup = Gio.DBusActionGroup.get(
    Gio.DBus.session, 'io.github.andyholmes.Test','/io/github/andyholmes/Test'
  );
  resultSignalGroup.activate_action('basicAction', null);
  
  _httpSession = new Soup.SessionAsync();
  Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());
  if (!movieSynologySearchProvider) {
    movieSynologySearchProvider = new MovieSynologySearchProvider();
    Main.overview.viewSelector._searchResults._registerProvider(
            movieSynologySearchProvider
        );
  }
}

function disable () {
  if (movieSynologySearchProvider) {
    Main.overview.viewSelector._searchResults._unregisterProvider(
            movieSynologySearchProvider
        );
    movieSynologySearchProvider = null;
  }
  _httpSession = null;
  _url = null;
  _user = null;
  _password = null;
  _settings = null;
  _results = null;
  _error = null;
}
