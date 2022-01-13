declare const global: {
  log(message: string): void,
  logError(message: string): void,
  create_app_launch_context(
    timestamp: number,
    workspace: number,
  ): ApplicationLaunchContext;
  display: {
    get_current_time_roundtrip(): number;
  };
};
declare const imports: {
  gi: {
    Gio: {
      icon_new_for_string(name: string): GioIcon;
      AppInfo: {
        get_default_for_type(content_type: string, must_support_uris: boolean): any;
      };
      app_info_get_default_for_type(
        type: string,
        link: any
      ): { get_icon(): any; }
    };
    Soup: {
      URI: typeof SoupURI;
      Session: typeof SoupSession;
      Message: SoupMessage;
    };
    St: {
      Icon: any;
    };
    GLib: {
      timeout_add(
        priority: number,
        interval: number,
        callback: any
      ): any;
      PRIORITY_LOW: number;
    };
  };
  ui: {
    main: {
      overview: {
        viewSelector: {
          _searchResults: {
            _registerProvider(provider: SearchProvider): void
            _unregisterProvider(provider: SearchProvider): void
          }
        },
        _overview: {
          controls: {
            _searchController: {
              _searchResults: {
                _registerProvider(provider: SearchProvider): void
                _unregisterProvider(provider: SearchProvider): void
              }
            }
          }
        }
      }
    };
  };
  misc: {
    extensionUtils: {
      getCurrentExtension(): Extension;
      getSettings(path: string): any; 
    };
  };
};

declare class Extension {
  dir: {
    get_path(): string;
    get_child(name: string): Extension["dir"];
  };
  metadata: {
    name: string;
    uuid: string;
  };
}

declare class SoupURI {
  get_host(): string;
  constructor(uri: string);
}

declare class SoupSession {
  user_agent: string;
  queue_message(
    message: SoupMessage,
    cb: (session: SoupSession, message: SoupMessage) => void,
  ): void;
}

declare interface SoupMessage {
  response_body: {
    data: string;
  };
  status_code: number;
  new_from_uri(method: string, uri: SoupURI): SoupMessage;
}

declare interface ApplicationLaunchContext {}

declare interface GioIcon {}

declare interface SearchResultMeta {
  id: string;
  name: string;
  description?: string;
  createIcon: (size: number) => GioIcon|null;
}

declare class SearchProvider {
  constructor(uri: string);
  settings: any;
  appInfo?: {get_name(): string; get_icon(): GioIcon; get_id(): string, should_show(): boolean};
  getResultMetas(
    resultIds: string[],
    callback: (results: SearchResultMeta[]) => void,
  ): void;
  getInitialResultSet(
    terms: string[],
    callback: (results: string[]) => void,
  ): void;
  getSubsearchResultSet(
    previousResults: string[],
    terms: string[],
    callback: (results: string[]) => void,
  ): void;
  filterResults(results: string[], maxNumber: number): string[];
  activateResult(id: string): void;
}

declare interface SearchAnswer {
  type: string;
  title: string;
  description: string;
  icon: string;
  icon_size: number;
}

declare interface LoginAnswer {
  data: { sid: string; }
  error: string;
}

declare interface SynoAnswer {
  SynoToken: string;
}

declare interface NasMovieResults {
  data: {
    movie: NasMovie[];
    movies: NasMovie[];
  }
  login?: LoginAnswer;
}

declare interface NasMovie {
  file: { id: number; }
  additional: { 
    file: { id: number; }[]; 
    summary: string;
  };
  original_available: string;
  title: string; 
  id: number;
  fileId: number;
}

declare interface TidAnswer {
  data: { tid: string; }
}

declare interface StreamIdAnswer {
  data: { stream_id: string; }
}
