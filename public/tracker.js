(function () {
  "use strict";
  var ENDPOINT = "https://remarketingnew.vercel.app/api/collect";

  var SITE_ID = "sellsynapse";
  var VISITOR_KEY = "_vid";
  var SESSION_KEY = "_sid";
  
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getId(key, store) {
    try {
      var id = store.getItem(key);
      if (!id) { id = uuid(); store.setItem(key, id); }
      return id;
    } catch (e) { return uuid(); }
  }

  var visitorId = getId(VISITOR_KEY, window.localStorage);
  var sessionId = getId(SESSION_KEY, window.sessionStorage);
  var urlParams = new URLSearchParams(window.location.search);
  var source = urlParams.get("src") || "organic";

  function send(eventName, props) {
    var payload = {
      v: visitorId,
      s: sessionId,
      site_id: SITE_ID,
      source: source,
      event: eventName,
      url: location.href,
      path: location.pathname,
      ref: document.referrer || null,
      title: document.title,
      ts: Date.now(),
      props: props || {}
    };
    var body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, body);
    } else {
      fetch(ENDPOINT, {
        method: "POST",
        body: body,
        keepalive: true,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  send("page_view");
  window.track = send;

  var lastPath = location.pathname;
  setInterval(function () {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      send("page_view");
    }
  }, 500);
})();
