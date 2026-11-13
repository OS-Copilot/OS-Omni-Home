(function () {
  "use strict";
  /* Start with the existing seeded demo account, without real credentials. */
  try {
    if (window.openshopSeed) {
      var seed = window.openshopSeed;
      var accounts = seed.accounts && seed.accounts.length ? seed.accounts : [seed.benchmarkAccount];
      var shop = JSON.parse(localStorage.getItem("openshop.localState.v3"));
      if (!shop) {
        shop = { session: { loggedIn: false, user: null }, users: {} };
        accounts.forEach(function (a) {
          shop.users[a.phone] = JSON.parse(JSON.stringify({ addresses: a.addresses || seed.addresses,
            paymentMethods: a.paymentMethods || seed.paymentMethods, cart: [], orders: a.orders || [] }));
        });
      }
      if (!shop.session.loggedIn) {
        var account = accounts[0];
        shop.session = { loggedIn: true, user: { phone: account.phone, name: account.name || "Demo user" } };
        localStorage.setItem("openshop.localState.v3", JSON.stringify(shop));
        if (location.pathname.endsWith("login.html")) location.replace("index.html");
      }
    }
    if (window.opentwitterSeed) {
      window.opentwitterLocalApi.request("/api/bootstrap").catch(function () {});
      var key = "opentwitter.localState.v7", social = JSON.parse(localStorage.getItem(key));
      if (social && !social.session.loggedIn) {
        var handle = window.opentwitterSeed.account.username;
        social.session = { loggedIn: true, user: { handle: handle } };
        localStorage.setItem(key, JSON.stringify(social));
        if (location.pathname.endsWith("login.html")) location.replace("index.html");
      }
    }
  } catch (error) { console.warn("Demo account setup:", error); }
  document.addEventListener("DOMContentLoaded", function () {
    parent.postMessage({ type: "osomni:app-ready", title: document.title }, location.origin);
  }, { once: true });
})();
