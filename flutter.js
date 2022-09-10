

if (!_flutter) {
  var _flutter = {};
}
_flutter.loader = null;

(function() {
  "use strict";
  class FlutterLoader {
    
    constructor() {
   
      this._scriptLoaded = null;


      this._didCreateEngineInitializerResolve = null;


      this.didCreateEngineInitializer = this._didCreateEngineInitializer.bind(this);
    }

    /**
     * Initializes the main.dart.js with/without serviceWorker.
     * @param {*} options
     * @returns a Promise that will eventually resolve with an EngineInitializer,
     * or will be rejected with the error caused by the loader.
     */
    loadEntrypoint(options) {
      const {
        entrypointUrl = "main.dart.js",
        serviceWorker,
      } = (options || {});
      return this._loadWithServiceWorker(entrypointUrl, serviceWorker);
    }

    /**
     * Resolves the promise created by loadEntrypoint.
     * Called by Flutter through the public `didCreateEngineInitializer` method,
     * which is bound to the correct instance of the FlutterLoader on the page.
     * @param {*} engineInitializer
     */
    _didCreateEngineInitializer(engineInitializer) {
      if (typeof this._didCreateEngineInitializerResolve != "function") {
        console.warn("Do not call didCreateEngineInitializer by hand. Start with loadEntrypoint instead.");
      }
      this._didCreateEngineInitializerResolve(engineInitializer);
      
      delete this.didCreateEngineInitializer;
    }

    _loadEntrypoint(entrypointUrl) {
      if (!this._scriptLoaded) {
        console.debug("Injecting <script> tag.");
        this._scriptLoaded = new Promise((resolve, reject) => {
          let scriptTag = document.createElement("script");
          scriptTag.src = entrypointUrl;
          scriptTag.type = "application/javascript";
          
          
          
          
          this._didCreateEngineInitializerResolve = resolve;
          scriptTag.addEventListener("error", reject);
          document.body.append(scriptTag);
        });
      }

      return this._scriptLoaded;
    }

    _waitForServiceWorkerActivation(serviceWorker, entrypointUrl) {
      if (!serviceWorker || serviceWorker.state == "activated") {
        if (!serviceWorker) {
          console.warn("Cannot activate a null service worker.");
        } else {
          console.debug("Service worker already active.");
        }
        return this._loadEntrypoint(entrypointUrl);
      }
      return new Promise((resolve, _) => {
        serviceWorker.addEventListener("statechange", () => {
          if (serviceWorker.state == "activated") {
            console.debug("Installed new service worker.");
            resolve(this._loadEntrypoint(entrypointUrl));
          }
        });
      });
    }

    _loadWithServiceWorker(entrypointUrl, serviceWorkerOptions) {
      if (!("serviceWorker" in navigator) || serviceWorkerOptions == null) {
        console.warn("Service worker not supported (or configured).", serviceWorkerOptions);
        return this._loadEntrypoint(entrypointUrl);
      }

      const {
        serviceWorkerVersion,
        timeoutMillis = 4000,
      } = serviceWorkerOptions;

      let serviceWorkerUrl = "flutter_service_worker.js?v=" + serviceWorkerVersion;
      let loader = navigator.serviceWorker.register(serviceWorkerUrl)
          .then((reg) => {
            if (!reg.active && (reg.installing || reg.waiting)) {
              
              
              let sw = reg.installing || reg.waiting;
              return this._waitForServiceWorkerActivation(sw, entrypointUrl);
            } else if (!reg.active.scriptURL.endsWith(serviceWorkerVersion)) {
              
              
              console.debug("New service worker available.");
              return reg.update().then((reg) => {
                console.debug("Service worker updated.");
                let sw = reg.installing || reg.waiting || reg.active;
                return this._waitForServiceWorkerActivation(sw, entrypointUrl);
              });
            } else {
              
              console.debug("Loading app from service worker.");
              return this._loadEntrypoint(entrypointUrl);
            }
          })
          .catch((error) => {
            
            console.warn("Failed to register or activate service worker:", error);
            return this._loadEntrypoint(entrypointUrl);
          });

      
      let timeout;
      if (timeoutMillis > 0) {
        timeout = new Promise((resolve, _) => {
          setTimeout(() => {
            if (!this._scriptLoaded) {
              console.warn("Loading from service worker timed out after", timeoutMillis, "milliseconds.");
              resolve(this._loadEntrypoint(entrypointUrl));
            }
          }, timeoutMillis);
        });
      }

      return Promise.race([loader, timeout]);
    }
  }

  _flutter.loader = new FlutterLoader();
}());
