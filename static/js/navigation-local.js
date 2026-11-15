/* Browser adapter for the original OpenNavigation renderer. */
window.OSOmniNavigationAPI = async function (path, options) {
  var url = new URL(path, location.origin);
  if (url.pathname === "/shell/config") return { tileBasePath: window.OSOmniMapTileBase || "./tiles" };
  if (url.pathname === "/health") return { ok: true };
  if (url.pathname === "/api/v1/places/search") return { items: seedSearch(url.searchParams.get("query") || url.searchParams.get("q") || "") };
  if (url.pathname !== "/api/v1/routes/plan") throw new Error("Unsupported browser navigation operation");
  var request = JSON.parse(options.body), a = request.origin, b = request.destination;
  var rad = Math.PI / 180, lat = (b.lat - a.lat) * rad, lng = (b.lng - a.lng) * rad;
  var h = Math.sin(lat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(lng / 2) ** 2;
  var distance = 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  var speed = { drive: 14, walk: 1.4, bike: 4.5, transit: 8 }[request.mode];
  function encode(points) {
    var previous = [0, 0], result = "";
    points.forEach(function (p) { [p.lat, p.lng].forEach(function (value, i) {
      var rounded = Math.round(value * 1e5), delta = rounded - previous[i]; previous[i] = rounded;
      var n = delta < 0 ? ~(delta << 1) : delta << 1;
      while (n >= 32) { result += String.fromCharCode((32 | (n & 31)) + 63); n >>>= 5; }
      result += String.fromCharCode(n + 63);
    }); }); return result;
  }
  if(request.mode === "drive" && window.OSOmniDriverRequest) {
    var response=await OSOmniDriverRequest('http://localhost:4320/route/driving',{method:'POST',body:JSON.stringify({startLatitude:a.lat,startLongitude:a.lng,endLatitude:b.lat,endLongitude:b.lng})});
    var payload=await response.json();
    if(payload.success&&payload.data.points.length){var route=payload.data,estimated=String(route.graphId).includes('fallback');return {routes:[{route_id:'image-drive-route',provider:'image-route-cache',mode:'drive',label:estimated?'Demo route (estimated)':'Image cached road route',distance_meters:Math.round(route.distanceKm*1000),duration_seconds:Math.round(route.durationMinutes*60),polyline:encode(route.points.map(function(p){return {lat:p.latitude,lng:p.longitude};})),steps:[{instruction:estimated?'Demo estimate: head toward the destination':'Follow the cached image road route',distance_meters:Math.round(route.distanceKm*1000),duration_seconds:Math.round(route.durationMinutes*60)}],graph_id:route.graphId}]};}
  }
  // The upstream MockProvider also uses interpolated paths. Label these explicitly.
  return { routes: [1, 1.15].map(function (factor, i) {
    var meters = Math.round(distance * factor), seconds = Math.round(meters / speed);
    var mid = { lat: (a.lat + b.lat) / 2 + (i ? .001 : 0), lng: (a.lng + b.lng) / 2 };
    return { route_id: "browser-demo-" + i, provider: "browser-demo", mode: request.mode,
      label: i ? "Alternative demo route" : "Demo route (estimated)", distance_meters: meters,
      duration_seconds: seconds, polyline: encode([a, mid, b]), transfers: 0,
      steps: [{ instruction: "Demo: head toward the selected destination", distance_meters: meters, duration_seconds: seconds }] };
  }) };
};
