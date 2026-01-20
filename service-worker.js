const version = "v0.2"
if (!self.define) {
    let e, s = {};
    const i = (i, n) => (i = new URL(i + ".js",n).href,
    s[i] || new Promise(s => {
        if ("document"in self) {
            const e = document.createElement("script");
            e.src = i,
            e.onload = s,
            document.head.appendChild(e)
        } else
            e = i,
            importScripts(i),
            s()
    }
    ).then( () => {
        let e = s[i];
        if (!e)
            throw new Error(`Module ${i} didn’t register its module`);
        return e
    }
    ));
    self.define = (n, t) => {
        const r = e || ("document"in self ? document.currentScript.src : "") || location.href;
        if (s[r])
            return;
        let o = {};
        const l = e => i(e, r)
          , c = {
            module: {
                uri: r
            },
            exports: o,
            require: l
        };
        s[r] = Promise.all(n.map(e => c[e] || l(e))).then(e => (t(...e),
        o))
    }
}
define(["./workbox"], function(e) {
    "use strict";
    self.addEventListener("message", e => {
        e.data && "SKIP_WAITING" === e.data.type && self.skipWaiting()
    }
    ),
    e.precacheAndRoute([{
        url: "/index.html",
        revision: version
    }, {
        url: "/Loader.js",
        revision: version
    }, {
        url: "/781a.png",
        revision: version
    }, {
        url: "/781H-images-0.jpg",
        revision: version
    }, {
        url: "/781H-images-1.jpg",
        revision: version
    }, {
        url: "/f16.glb",
        revision: version
    }, {
        url: "/script.js",
        revision: version
    }, {
        url: "/style.css",
        revision: version
    }, {
        url: "/three.js",
        revision: version
    }, {
        url: "/db.json",
        revision: version
    }, {
        url: "/icon.jpg",
        revision: version
    }, {
        url: "/Orbit.js",
        revision: version
    }, {
        url: "/manifest.json",
        revision: version
    }], {}),
    e.cleanupOutdatedCaches(),
    e.registerRoute(new e.NavigationRoute(e.createHandlerBoundToURL("index.html")))
});

