const { Gio, Soup, St } = imports.gi;
const { main } = imports.ui;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = imports.misc.extensionUtils.getCurrentExtension();

const ICON_URL = `${Me.dir.get_path()}/icon.svg`;
const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.gnome4synology';
const GSETTINGS_URL_KEY = 'url';
const GSETTINGS_USER_KEY = 'user';
const GSETTINGS_PASSWORD_KEY = 'password';
const GSETTINGS_LIMIT_KEY = 'limit';
const GSETTINGS_ADDITIONAL_KEY = 'additional';
const GSETTINGS_POSTER_SIZE_KEY = 'poster-size';
const GSETTINGS_DEBUG_KEY = 'debug';

const getJSON = (() => {
  let httpSession: any;
  return (url: string, {}: Record<string, string>): Promise<unknown> =>
    new Promise((resolve, reject) => {
      try {
        if (!httpSession) {
          httpSession = new Soup.Session();
          httpSession.user_agent = "Gnome Shell Extension";
        } else {
          httpSession.abort();
        }
	const uri = new Soup.URI(url);
        const message = Soup.Message.new_from_uri("GET", uri);
        httpSession.queue_message(message, () => {
          // global.log(`${Me.metadata.name}: Got response '`+message.response_body.data+`'.`);
          try {
            // status_code===1: http session has been aborted for new query
            if (!message.response_body.data && (message.status_code!==1)) {
              let errorMsg = "ERROR - NAS not reachable. No data in response body.";
              global.logError(`${Me.metadata.name}: `+errorMsg);
              resolve({"error": errorMsg});
            } else {
              resolve(JSON.parse(message.response_body.data));
            }
          } catch (e) {
            global.logError(`${Me.metadata.name}: JSON parsing of NAS response failed: `+e);
            reject(e);
          }
        });
      } catch (e) {
        global.logError(`${Me.metadata.name}: HTTP session creation failed: `+e);
        reject(e);
      }
    });
})();

function getLoginToken(url: string, user: string, password: string): Promise<LoginAnswer> {
  return getJSON(
    `http://${url}/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=login&account=${user}&passwd=${password}&session=VideoStation&format=sid`, {},
  ) as unknown as Promise<
    LoginAnswer
  >;
}

function logout(url:string): Promise<unknown> {
  return getJSON(
          `http://${url}/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=logout&session=null`, {},
  );
}

function getSynoToken(url: string, user: string, password: string): Promise<SynoAnswer> {
  return getJSON(
    `http://${url}/webman/login.cgi?username=${user}&passwd=${password}&enable_syno_token=yes`, {},
  ) as unknown as Promise<
    SynoAnswer
  >;
}

function getTid(url: string, sid: string): Promise<TidAnswer> {
  return getJSON(
    `http://${url}/webapi/entry.cgi?allow_api=%22SYNO.VideoStation2.Streaming%22&allow_methods=%5B%22stream%22%5D&api=SYNO.API.Auth.Key&method=grant&version=7&_sid=${sid}`, {},
  ) as unknown as Promise<
    TidAnswer
  >;
}

function getStreamId(url: string, sid: string, fileId: number): Promise<StreamIdAnswer> {
  return getJSON(
    `http://${url}/webapi/entry.cgi?file=%7B%22id%22%3A${fileId}%7D&raw=%7B%7D&pin=%22%22&api=SYNO.VideoStation2.Streaming&method=open&version=2&_sid=${sid}`, {},
  ) as unknown as Promise<
    StreamIdAnswer
  >;
}

function getFileIds(url: string, sid: string, movieIds: number[]): Promise<NasMovieResults> {
  const ids = movieIds.join(',');
  return getJSON(
  `http://${url}/webapi/entry.cgi?id=%5B${ids}%5D&additional=%5B%22file%22,%22summary%22%5D&api=SYNO.VideoStation2.Movie&method=getinfo&version=1&_sid=${sid}`,{}
  ) as unknown as Promise<
    NasMovieResults
  >;
}

function getSuggestions(url: string, q: string, limit: number, token: string): Promise<NasMovieResults> {
  return getJSON(
    `http://${url}/webapi/VideoStation/movie.cgi?api=SYNO.VideoStation.Movie&version=4&method=search&library_id=0&title=${q}`+(limit>0?`&limit=${limit}`:``)+`&_sid=${token}`, {},
  ) as unknown as Promise<NasMovieResults>;;
}

function getResultMeta(id: string): SearchResultMeta {
  const { type, title, description, icon, icon_size } = (JSON.parse(id) as unknown as SearchAnswer);
  if (type === "suggestion") {
    const gicon = (icon!==undefined)?Gio.icon_new_for_string(icon):Gio.app_info_get_default_for_type('video/mpeg', null).get_icon();
    return {
      id,
      name: title,
      description: description!==undefined?description:`Found on NAS`,
      createIcon() { return new St.Icon({gicon: gicon, icon_size: icon_size,}); },
    };
  } else if (type === "error") {
    return {
      id,
      name: title,
      createIcon() { return null },
    };
  }
  return {
    id,
    name: title,
    description: `Search query`,
    createIcon() { return null },
  };
}

function makeLaunchContext() {
  return global.create_app_launch_context(
    global.display.get_current_time_roundtrip(),
    -1,
  );
}

const ddgProvider: SearchProvider = {
  settings: ExtensionUtils.getSettings(SETTINGS_SCHEMA),
  appInfo: {
    get_name: () => `Movies on NAS`,
    get_icon: () => Gio.icon_new_for_string(ICON_URL),
    get_id: () => `${Me.metadata.uuid}`,
    should_show: () => true,
  },

  getResultMetas(results: string[], cb: (results: SearchResultMeta[]) => void) {
    cb(results.map(getResultMeta));
  },

  async activateResult(result: string) {
    const selection = JSON.parse(result);
    let url = this.settings.get_value(GSETTINGS_URL_KEY).deep_unpack();
    let user = this.settings.get_value(GSETTINGS_USER_KEY).deep_unpack();
    let password = this.settings.get_value(GSETTINGS_PASSWORD_KEY).deep_unpack();    
    // global.log(`${Me.metadata.name}: Playing movie '${selection.title}' for query '${selection.query}'...`);
    const token = await getLoginToken(url, user, password);
    const tidAnswer = await getTid(url, token.data.sid);
    const fileId = (selection.fileId === undefined)?(await getFileIds(url, token.data.sid, [selection.id])).data.movie[0].id:selection.fileId;
    const streamId = await getStreamId(url, token.data.sid, fileId);
    const synoToken = await getSynoToken(url, user, password);
    url = `http://${url}/webapi/entry.cgi/1.mp4?format=raw&api=SYNO.VideoStation2.Streaming&method=stream&version=2&stream_id=%22${streamId.data.stream_id}%22&tid=${tidAnswer.data.tid}&SynoToken=${synoToken.SynoToken}`;
    let app = Gio.AppInfo.get_default_for_type("video/mpeg", true);
    app.launch_uris([url], makeLaunchContext());
    await logout(url);
    // global.log(`${Me.metadata.name}: Logged out from NAS.`);
  },

  filterResults(providerResults: string[], {}: number) {
    return providerResults;
  },

  async getInitialResultSet(terms: string[], cb: (results: string[]) => void) {
    const query = terms.join(" ");
    if(terms.length ===1 && terms[0].length < 3) {
      return [];
    }
    let url = this.settings.get_value(GSETTINGS_URL_KEY).deep_unpack();
    let user = this.settings.get_value(GSETTINGS_USER_KEY).deep_unpack();
    let password = this.settings.get_value(GSETTINGS_PASSWORD_KEY).deep_unpack();
    let limit = this.settings.get_value(GSETTINGS_LIMIT_KEY).deep_unpack();
    let icon_size = this.settings.get_boolean(GSETTINGS_ADDITIONAL_KEY)?this.settings.get_int(GSETTINGS_POSTER_SIZE_KEY):16;
    // global.log(`${Me.metadata.name}: Connecting to NAS ${url} under user '${user}' for query '`+query+`'...`);
    const token = await getLoginToken(url, user, password);
    if (token.error) {
      if (this.settings.get_boolean(GSETTINGS_DEBUG_KEY)) {
        const results = [JSON.stringify({ type: "query", title: query })];
        results.push(
          JSON.stringify({ type: "error", title: token.error, query }),
        );
        cb(results);
      }
    } else {
      let results = [JSON.stringify({ type: "query", title: query })];
      const ia = await getSuggestions(url, query, limit, token.data.sid);
      // global.log(`${Me.metadata.name}: Found #${ia.data.movies.length} movies on NAS ${url} under user '${user}' for query '`+query+`'.`);
      // Append Search Suggestions
      if (this.settings.get_boolean(GSETTINGS_ADDITIONAL_KEY)) {
        // get additional infos eg icon url for suggestions
        const fileIds = await getFileIds(url, token.data.sid, ia.data.movies.map(m=> m.id).filter(r => r!==undefined));
        for (const movie of ia.data.movies) {
          const movieAdds = fileIds.data.movie.filter(m=>m.id==movie.id)[0];
          results.push(
            JSON.stringify({ 
              type: "suggestion", 
              title: `${movieAdds.title} (${movieAdds.original_available.split('-')[0]})`, 
              description: `${movieAdds.additional.summary}`, 
              fileId: movieAdds.additional.file[0].id,
              id: movie.id,
              icon: `http://${url}/webapi/entry.cgi?type=movie&id=${movie.id}&api=SYNO.VideoStation2.Poster&method=get&version=1&_sid=${token.data.sid}`, 
              icon_size: icon_size,
              query 
            })
         );
        }
      } else {
        for (const movie of ia.data.movies) {
          results.push(
            JSON.stringify({ type: "suggestion", title: movie.title+' ('+movie.original_available.split('-')[0]+')', id: movie.id, icon_size: icon_size, query }),
          );
        }
      }
      cb(results);
      await logout(url);
      // global.log(`${Me.metadata.name}: Logged out from NAS.`);
    }
  },

  getSubsearchResultSet(previousResults: string[], terms: string[], cb: (results: string[]) => void) {
    cb(previousResults.filter(r => { let obj = JSON.parse(r); return (obj.title.toUpperCase().indexOf(terms.toString().toUpperCase())>-1) || obj.type === 'query' || obj.type === 'error'}));
  }
};

function getOverviewSearchResult() {
  if (main.overview.viewSelector !== undefined) {
    return main.overview.viewSelector._searchResults;
  } else {
    return main.overview._overview.controls._searchController._searchResults;
  }
}

export function init() {}

let instance: SearchProvider;
export function enable() {
  instance = Object.create(ddgProvider);
  global.log(`${Me.metadata.name}: Enabling. Got url "${instance.settings.get_value(GSETTINGS_URL_KEY).deep_unpack()}" and user "${instance.settings.get_value(GSETTINGS_USER_KEY).deep_unpack()}" from gsettings`);
  getOverviewSearchResult()._registerProvider(instance);
}

export function disable() {
  global.log(`${Me.metadata.name}: Disabling`);
  getOverviewSearchResult()._unregisterProvider(instance);
  instance.settings = null;
  instance = null as any;
}
