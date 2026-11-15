window.OSOmniDriverModules = {};
window.OSOmniDriverModules["./domain"] = function(require,module,exports,process,__dirname){
const crypto = require("crypto");

const rideStatuses = [
  "scheduled",
  "requested",
  "searching",
  "accepted",
  "driver_arriving",
  "arrived",
  "in_progress",
  "completed",
  "cancelled"
];

const allowedTransitions = {
  scheduled: ["searching", "cancelled"],
  requested: ["searching", "cancelled"],
  searching: ["accepted", "cancelled"],
  accepted: ["driver_arriving", "cancelled"],
  driver_arriving: ["arrived"],
  arrived: ["in_progress"],
  in_progress: ["completed"],
  completed: [],
  cancelled: []
};

function now() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = btoa(unescape(encodeURIComponent(String(password) + salt)));
  return `pbkdf2$${salt}$${hash}`;
}

function verifyPassword(password, passwordHash) {
  const [scheme, salt] = String(passwordHash || "").split("$");
  if (scheme !== "pbkdf2" || !salt) return false;
  return hashPassword(password, salt) === passwordHash;
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeLocation(input) {
  const latitude = normalizeNumber(input?.latitude ?? input?.lat);
  const longitude = normalizeNumber(input?.longitude ?? input?.lng);
  if (latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function calculateHaversineDistance(a, b) {
  const start = normalizeLocation(a);
  const end = normalizeLocation(b);
  if (!start || !end) return 0;
  const earthKm = 6371;
  const dLat = toRadians(end.latitude - start.latitude);
  const dLng = toRadians(end.longitude - start.longitude);
  const lat1 = toRadians(start.latitude);
  const lat2 = toRadians(end.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Number((2 * earthKm * Math.asin(Math.sqrt(h))).toFixed(2));
}

function estimateTripDuration(distanceKm, averageSpeedKph = 24) {
  return Math.max(5, Math.ceil((Math.max(distanceKm, 0.6) / averageSpeedKph) * 60 + 4));
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function pickupTimePricing(pickupTime) {
  const parsedTime = pickupTime ? Date.parse(pickupTime) : Date.now();
  const date = new Date(Number.isFinite(parsedTime) ? parsedTime : Date.now());
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes < 60) return { multiplier: 1.1, label: "Late night" };
  if (minutes < 240) return { multiplier: 1.06, label: "Overnight" };
  if (minutes < 420) return { multiplier: 0.96, label: "Early morning" };
  if (minutes < 570) return { multiplier: 1.22, label: "Morning peak" };
  if (minutes < 930) return { multiplier: 1, label: "Daytime" };
  if (minutes < 1140) return { multiplier: 1.28, label: "Evening peak" };
  if (minutes < 1320) return { multiplier: 1.1, label: "Evening" };
  return { multiplier: 1.16, label: "Late evening" };
}

function estimateFare({ distanceKm, durationMinutes, availableDrivers = 2, pickupTime = null, waypointCount = 0 }) {
  const baseFare = 4.5;
  const distanceFare = Number((Math.max(distanceKm, 0.6) * 1.85).toFixed(2));
  const timeFare = Number((Math.max(durationMinutes, 5) * 0.32).toFixed(2));
  const serviceFee = 1.75;
  const waypointFee = Number((Math.max(0, Number(waypointCount) || 0) * 1.5).toFixed(2));
  const surgeMultiplier = availableDrivers < 2 ? 1.18 : 1;
  const timePricing = pickupTimePricing(pickupTime);
  const subtotal = baseFare + distanceFare + timeFare + serviceFee + waypointFee;
  const driverAdjustedSubtotal = roundMoney(subtotal * surgeMultiplier);
  const pickupTimeAdjustment = roundMoney(driverAdjustedSubtotal * (timePricing.multiplier - 1));
  const estimatedTotal = roundMoney(Math.max(8, driverAdjustedSubtotal + pickupTimeAdjustment));
  return {
    baseFare,
    distanceFare,
    timeFare,
    serviceFee,
    waypointFee,
    surgeMultiplier,
    pickupTimeMultiplier: timePricing.multiplier,
    pickupTimeLabel: timePricing.label,
    pickupTimeAdjustment,
    estimatedTotal
  };
}

function canTransition(from, to) {
  return Boolean(allowedTransitions[from]?.includes(to));
}

function validateTransition(from, to) {
  if (!rideStatuses.includes(to)) {
    return { ok: false, code: "INVALID_RIDE_STATUS", message: "Unsupported ride status." };
  }
  if (!canTransition(from, to)) {
    return { ok: false, code: "INVALID_RIDE_TRANSITION", message: `Cannot move ride from ${from} to ${to}.` };
  }
  return { ok: true };
}

function publicUser(user) {
  if (!user) return null;
  const safe = clone(user);
  delete safe.passwordHash;
  delete safe.sharedPassword;
  return safe;
}

function publicDriver(db, profile) {
  if (!profile) return null;
  const documents = Array.isArray(profile.documents) ? profile.documents : [];
  const requiredTypes = ["license", "insurance", "vehicle_inspection"];
  const approved = requiredTypes.filter((type) => documents.some((doc) => doc.type === type && doc.status === "approved"));
  return {
    ...clone(profile),
    documents,
    documentSummary: {
      required: requiredTypes.length,
      submitted: requiredTypes.filter((type) => documents.some((doc) => doc.type === type)).length,
      approved: approved.length,
      status: approved.length === requiredTypes.length ? "complete" : documents.length > 0 ? "in_review" : "missing"
    },
    user: publicUser(db.users.find((user) => user.id === profile.userId))
  };
}

function publicRide(db, ride) {
  if (!ride) return null;
  const driverProfile = ride.driverId ? db.driverProfiles.find((item) => item.userId === ride.driverId) : null;
  const showDriver = driverProfile && ["accepted", "driver_arriving", "arrived", "in_progress", "completed"].includes(ride.status);
  const driverDistanceToPickupKm = driverProfile
    ? calculateHaversineDistance(
        { latitude: driverProfile.currentLatitude, longitude: driverProfile.currentLongitude },
        { latitude: ride.pickupLatitude, longitude: ride.pickupLongitude }
      )
    : null;
  const driverDistanceToDestinationKm = driverProfile
    ? calculateHaversineDistance(
        { latitude: driverProfile.currentLatitude, longitude: driverProfile.currentLongitude },
        { latitude: ride.destinationLatitude, longitude: ride.destinationLongitude }
      )
    : null;
  return {
    ...clone(ride),
    driverDistanceToPickupKm,
    driverDistanceToDestinationKm,
    rider: publicUser(db.users.find((user) => user.id === ride.riderId)),
    driver: showDriver ? publicUser(db.users.find((user) => user.id === ride.driverId)) : null,
    driverProfile: showDriver ? publicDriver(db, driverProfile) : null,
    payment: db.payments.find((payment) => payment.rideId === ride.id) || null,
    ratings: db.ratings.filter((rating) => rating.rideId === ride.id)
  };
}

function nearbyDrivers(db, ride) {
  const rejected = ride.rejectedDriverIds || [];
  return db.driverProfiles
    .filter((profile) => {
      return (
        profile.verificationStatus === "approved" &&
        profile.driverStatus === "online" &&
        !rejected.includes(profile.userId)
      );
    })
    .map((profile) => ({
      profile,
      user: db.users.find((user) => user.id === profile.userId),
      distanceKm: calculateHaversineDistance(
        { latitude: profile.currentLatitude, longitude: profile.currentLongitude },
        { latitude: ride.pickupLatitude, longitude: ride.pickupLongitude }
      )
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm || b.profile.averageRating - a.profile.averageRating);
}

function createNotification(db, userId, type, title, message) {
  const notification = { id: makeId("notif"), userId, type, title, message, read: false, createdAt: now() };
  db.notifications.unshift(notification);
  return notification;
}

function createPaymentRecord(db, ride) {
  let payment = db.payments.find((item) => item.rideId === ride.id);
  if (payment) return payment;
  const currencyDecimals = ride.currencyDecimals ?? ride.fareBreakdown?.currencyDecimals ?? 2;
  const amount = Number((ride.finalFare || ride.estimatedFare || 0).toFixed(currencyDecimals));
  const platformFee = Number((amount * 0.18).toFixed(currencyDecimals));
  payment = {
    id: makeId("pay"),
    rideId: ride.id,
    riderId: ride.riderId,
    driverId: ride.driverId,
    amount,
    platformFee,
    driverEarnings: Number((amount - platformFee).toFixed(currencyDecimals)),
    currencyCode: ride.currencyCode || ride.fareBreakdown?.currencyCode || "USD",
    currencySymbol: ride.currencySymbol || ride.fareBreakdown?.currencySymbol || "$",
    currencyDecimals,
    paymentMethod: ride.paymentMethod || "card_on_file",
    providerPaymentId: `processor_${makeId("provider")}`,
    status: "paid",
    createdAt: now()
  };
  db.payments.unshift(payment);
  ride.paymentStatus = "paid";
  return payment;
}

module.exports = {
  rideStatuses,
  allowedTransitions,
  now,
  clone,
  makeId,
  hashPassword,
  verifyPassword,
  createToken,
  normalizeEmail,
  normalizeLocation,
  calculateHaversineDistance,
  estimateTripDuration,
  pickupTimePricing,
  estimateFare,
  validateTransition,
  publicUser,
  publicDriver,
  publicRide,
  nearbyDrivers,
  createNotification,
  createPaymentRecord
};

};
window.OSOmniDriverModules["../domain"] = function(require,module,exports,process,__dirname){
const crypto = require("crypto");

const rideStatuses = [
  "scheduled",
  "requested",
  "searching",
  "accepted",
  "driver_arriving",
  "arrived",
  "in_progress",
  "completed",
  "cancelled"
];

const allowedTransitions = {
  scheduled: ["searching", "cancelled"],
  requested: ["searching", "cancelled"],
  searching: ["accepted", "cancelled"],
  accepted: ["driver_arriving", "cancelled"],
  driver_arriving: ["arrived"],
  arrived: ["in_progress"],
  in_progress: ["completed"],
  completed: [],
  cancelled: []
};

function now() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = btoa(unescape(encodeURIComponent(String(password) + salt)));
  return `pbkdf2$${salt}$${hash}`;
}

function verifyPassword(password, passwordHash) {
  const [scheme, salt] = String(passwordHash || "").split("$");
  if (scheme !== "pbkdf2" || !salt) return false;
  return hashPassword(password, salt) === passwordHash;
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeLocation(input) {
  const latitude = normalizeNumber(input?.latitude ?? input?.lat);
  const longitude = normalizeNumber(input?.longitude ?? input?.lng);
  if (latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function calculateHaversineDistance(a, b) {
  const start = normalizeLocation(a);
  const end = normalizeLocation(b);
  if (!start || !end) return 0;
  const earthKm = 6371;
  const dLat = toRadians(end.latitude - start.latitude);
  const dLng = toRadians(end.longitude - start.longitude);
  const lat1 = toRadians(start.latitude);
  const lat2 = toRadians(end.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Number((2 * earthKm * Math.asin(Math.sqrt(h))).toFixed(2));
}

function estimateTripDuration(distanceKm, averageSpeedKph = 24) {
  return Math.max(5, Math.ceil((Math.max(distanceKm, 0.6) / averageSpeedKph) * 60 + 4));
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function pickupTimePricing(pickupTime) {
  const parsedTime = pickupTime ? Date.parse(pickupTime) : Date.now();
  const date = new Date(Number.isFinite(parsedTime) ? parsedTime : Date.now());
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes < 60) return { multiplier: 1.1, label: "Late night" };
  if (minutes < 240) return { multiplier: 1.06, label: "Overnight" };
  if (minutes < 420) return { multiplier: 0.96, label: "Early morning" };
  if (minutes < 570) return { multiplier: 1.22, label: "Morning peak" };
  if (minutes < 930) return { multiplier: 1, label: "Daytime" };
  if (minutes < 1140) return { multiplier: 1.28, label: "Evening peak" };
  if (minutes < 1320) return { multiplier: 1.1, label: "Evening" };
  return { multiplier: 1.16, label: "Late evening" };
}

function estimateFare({ distanceKm, durationMinutes, availableDrivers = 2, pickupTime = null, waypointCount = 0 }) {
  const baseFare = 4.5;
  const distanceFare = Number((Math.max(distanceKm, 0.6) * 1.85).toFixed(2));
  const timeFare = Number((Math.max(durationMinutes, 5) * 0.32).toFixed(2));
  const serviceFee = 1.75;
  const waypointFee = Number((Math.max(0, Number(waypointCount) || 0) * 1.5).toFixed(2));
  const surgeMultiplier = availableDrivers < 2 ? 1.18 : 1;
  const timePricing = pickupTimePricing(pickupTime);
  const subtotal = baseFare + distanceFare + timeFare + serviceFee + waypointFee;
  const driverAdjustedSubtotal = roundMoney(subtotal * surgeMultiplier);
  const pickupTimeAdjustment = roundMoney(driverAdjustedSubtotal * (timePricing.multiplier - 1));
  const estimatedTotal = roundMoney(Math.max(8, driverAdjustedSubtotal + pickupTimeAdjustment));
  return {
    baseFare,
    distanceFare,
    timeFare,
    serviceFee,
    waypointFee,
    surgeMultiplier,
    pickupTimeMultiplier: timePricing.multiplier,
    pickupTimeLabel: timePricing.label,
    pickupTimeAdjustment,
    estimatedTotal
  };
}

function canTransition(from, to) {
  return Boolean(allowedTransitions[from]?.includes(to));
}

function validateTransition(from, to) {
  if (!rideStatuses.includes(to)) {
    return { ok: false, code: "INVALID_RIDE_STATUS", message: "Unsupported ride status." };
  }
  if (!canTransition(from, to)) {
    return { ok: false, code: "INVALID_RIDE_TRANSITION", message: `Cannot move ride from ${from} to ${to}.` };
  }
  return { ok: true };
}

function publicUser(user) {
  if (!user) return null;
  const safe = clone(user);
  delete safe.passwordHash;
  delete safe.sharedPassword;
  return safe;
}

function publicDriver(db, profile) {
  if (!profile) return null;
  const documents = Array.isArray(profile.documents) ? profile.documents : [];
  const requiredTypes = ["license", "insurance", "vehicle_inspection"];
  const approved = requiredTypes.filter((type) => documents.some((doc) => doc.type === type && doc.status === "approved"));
  return {
    ...clone(profile),
    documents,
    documentSummary: {
      required: requiredTypes.length,
      submitted: requiredTypes.filter((type) => documents.some((doc) => doc.type === type)).length,
      approved: approved.length,
      status: approved.length === requiredTypes.length ? "complete" : documents.length > 0 ? "in_review" : "missing"
    },
    user: publicUser(db.users.find((user) => user.id === profile.userId))
  };
}

function publicRide(db, ride) {
  if (!ride) return null;
  const driverProfile = ride.driverId ? db.driverProfiles.find((item) => item.userId === ride.driverId) : null;
  const showDriver = driverProfile && ["accepted", "driver_arriving", "arrived", "in_progress", "completed"].includes(ride.status);
  const driverDistanceToPickupKm = driverProfile
    ? calculateHaversineDistance(
        { latitude: driverProfile.currentLatitude, longitude: driverProfile.currentLongitude },
        { latitude: ride.pickupLatitude, longitude: ride.pickupLongitude }
      )
    : null;
  const driverDistanceToDestinationKm = driverProfile
    ? calculateHaversineDistance(
        { latitude: driverProfile.currentLatitude, longitude: driverProfile.currentLongitude },
        { latitude: ride.destinationLatitude, longitude: ride.destinationLongitude }
      )
    : null;
  return {
    ...clone(ride),
    driverDistanceToPickupKm,
    driverDistanceToDestinationKm,
    rider: publicUser(db.users.find((user) => user.id === ride.riderId)),
    driver: showDriver ? publicUser(db.users.find((user) => user.id === ride.driverId)) : null,
    driverProfile: showDriver ? publicDriver(db, driverProfile) : null,
    payment: db.payments.find((payment) => payment.rideId === ride.id) || null,
    ratings: db.ratings.filter((rating) => rating.rideId === ride.id)
  };
}

function nearbyDrivers(db, ride) {
  const rejected = ride.rejectedDriverIds || [];
  return db.driverProfiles
    .filter((profile) => {
      return (
        profile.verificationStatus === "approved" &&
        profile.driverStatus === "online" &&
        !rejected.includes(profile.userId)
      );
    })
    .map((profile) => ({
      profile,
      user: db.users.find((user) => user.id === profile.userId),
      distanceKm: calculateHaversineDistance(
        { latitude: profile.currentLatitude, longitude: profile.currentLongitude },
        { latitude: ride.pickupLatitude, longitude: ride.pickupLongitude }
      )
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm || b.profile.averageRating - a.profile.averageRating);
}

function createNotification(db, userId, type, title, message) {
  const notification = { id: makeId("notif"), userId, type, title, message, read: false, createdAt: now() };
  db.notifications.unshift(notification);
  return notification;
}

function createPaymentRecord(db, ride) {
  let payment = db.payments.find((item) => item.rideId === ride.id);
  if (payment) return payment;
  const currencyDecimals = ride.currencyDecimals ?? ride.fareBreakdown?.currencyDecimals ?? 2;
  const amount = Number((ride.finalFare || ride.estimatedFare || 0).toFixed(currencyDecimals));
  const platformFee = Number((amount * 0.18).toFixed(currencyDecimals));
  payment = {
    id: makeId("pay"),
    rideId: ride.id,
    riderId: ride.riderId,
    driverId: ride.driverId,
    amount,
    platformFee,
    driverEarnings: Number((amount - platformFee).toFixed(currencyDecimals)),
    currencyCode: ride.currencyCode || ride.fareBreakdown?.currencyCode || "USD",
    currencySymbol: ride.currencySymbol || ride.fareBreakdown?.currencySymbol || "$",
    currencyDecimals,
    paymentMethod: ride.paymentMethod || "card_on_file",
    providerPaymentId: `processor_${makeId("provider")}`,
    status: "paid",
    createdAt: now()
  };
  db.payments.unshift(payment);
  ride.paymentStatus = "paid";
  return payment;
}

module.exports = {
  rideStatuses,
  allowedTransitions,
  now,
  clone,
  makeId,
  hashPassword,
  verifyPassword,
  createToken,
  normalizeEmail,
  normalizeLocation,
  calculateHaversineDistance,
  estimateTripDuration,
  pickupTimePricing,
  estimateFare,
  validateTransition,
  publicUser,
  publicDriver,
  publicRide,
  nearbyDrivers,
  createNotification,
  createPaymentRecord
};

};
window.OSOmniDriverModules["./database/seed"] = function(require,module,exports,process,__dirname){
const { calculateHaversineDistance, estimateTripDuration, hashPassword, now } = require("../domain");

const sharedPassword = "Password123!";

const rawServiceCities = [
  {
    id: "los_angeles",
    name: "Los Angeles",
    region: "CA",
    centerLatitude: 34.0522,
    centerLongitude: -118.2437,
    radiusKm: 85,
    locations: [
      ["downtown_la", "Downtown Los Angeles, CA", 34.0522, -118.2437],
      ["hollywood", "Hollywood Boulevard, Los Angeles, CA", 34.1016, -118.3267],
      ["santa_monica", "Santa Monica Pier, Santa Monica, CA", 34.0100, -118.4960],
      ["lax", "Los Angeles International Airport (LAX), CA", 33.9416, -118.4085],
      ["griffith", "Griffith Observatory, Los Angeles, CA", 34.1184, -118.3004],
      ["ucla", "UCLA, Los Angeles, CA", 34.0689, -118.4452],
      ["crypto_arena", "Crypto.com Arena, Los Angeles, CA", 34.0430, -118.2673],
      ["pasadena", "Pasadena City Hall, Pasadena, CA", 34.1478, -118.1445]
    ]
  },
  {
    id: "new_york",
    name: "New York City",
    region: "NY",
    centerLatitude: 40.7580,
    centerLongitude: -73.9855,
    radiusKm: 70,
    locations: [
      ["times_square", "Times Square, New York, NY", 40.7580, -73.9855],
      ["penn_station", "Penn Station, New York, NY", 40.7506, -73.9935],
      ["jfk", "John F. Kennedy International Airport (JFK), Queens, NY", 40.6413, -73.7781],
      ["laguardia", "LaGuardia Airport (LGA), Queens, NY", 40.7769, -73.8740],
      ["brooklyn_heights", "Brooklyn Heights, Brooklyn, NY", 40.6959, -73.9936],
      ["williamsburg", "Williamsburg, Brooklyn, NY", 40.7081, -73.9571],
      ["central_park", "Central Park South, New York, NY", 40.7644, -73.9738],
      ["nyu", "New York University, Greenwich Village, New York, NY", 40.7295, -73.9965],
      ["metlife", "MetLife Stadium, East Rutherford, NJ", 40.8135, -74.0745]
    ]
  },
  {
    id: "san_diego",
    name: "San Diego",
    region: "CA",
    centerLatitude: 32.7157,
    centerLongitude: -117.1611,
    radiusKm: 65,
    locations: [
      ["downtown_san_diego", "Downtown San Diego, CA", 32.7157, -117.1611],
      ["san_diego_airport", "San Diego International Airport (SAN), CA", 32.7338, -117.1933],
      ["gaslamp_quarter", "Gaslamp Quarter, San Diego, CA", 32.7115, -117.1600],
      ["balboa_park", "Balboa Park, San Diego, CA", 32.7341, -117.1446],
      ["uc_san_diego", "UC San Diego, La Jolla, CA", 32.8801, -117.2340],
      ["la_jolla_cove", "La Jolla Cove, San Diego, CA", 32.8509, -117.2729],
      ["mission_valley", "Mission Valley, San Diego, CA", 32.7712, -117.1570]
    ]
  },
  {
    id: "san_jose",
    name: "San Jose",
    region: "CA",
    centerLatitude: 37.3382,
    centerLongitude: -121.8863,
    radiusKm: 65,
    locations: [
      ["downtown_san_jose", "Downtown San Jose, CA", 37.3382, -121.8863],
      ["sjc_airport", "San Jose Mineta International Airport (SJC), CA", 37.3639, -121.9289],
      ["santana_row", "Santana Row, San Jose, CA", 37.3205, -121.9472],
      ["san_jose_state", "San Jose State University, San Jose, CA", 37.3352, -121.8811],
      ["sap_center", "SAP Center, San Jose, CA", 37.3328, -121.9012],
      ["willow_glen", "Willow Glen, San Jose, CA", 37.3088, -121.9001],
      ["north_san_jose", "North San Jose, CA", 37.3875, -121.9290]
    ]
  },
  {
    id: "buffalo",
    name: "Buffalo",
    region: "NY",
    centerLatitude: 42.8864,
    centerLongitude: -78.8784,
    radiusKm: 55,
    locations: [
      ["downtown_buffalo", "Downtown Buffalo, NY", 42.8864, -78.8784],
      ["buffalo_airport", "Buffalo Niagara International Airport (BUF), NY", 42.9405, -78.7322],
      ["canalside_buffalo", "Canalside, Buffalo, NY", 42.8750, -78.8770],
      ["university_at_buffalo", "University at Buffalo North Campus, Amherst, NY", 43.0008, -78.7890],
      ["elmwood_village", "Elmwood Village, Buffalo, NY", 42.9177, -78.8760],
      ["keybank_center", "KeyBank Center, Buffalo, NY", 42.8750, -78.8766],
      ["buffalo_medical_campus", "Buffalo Niagara Medical Campus, Buffalo, NY", 42.9006, -78.8661]
    ]
  },
  {
    id: "rochester_ny",
    name: "Rochester",
    region: "NY",
    centerLatitude: 43.1566,
    centerLongitude: -77.6088,
    radiusKm: 55,
    locations: [
      ["downtown_rochester_ny", "Downtown Rochester, NY", 43.1566, -77.6088],
      ["roc_airport", "Frederick Douglass Greater Rochester International Airport (ROC), NY", 43.1189, -77.6724],
      ["university_rochester", "University of Rochester, Rochester, NY", 43.1286, -77.6285],
      ["eastman_theatre", "Eastman Theatre, Rochester, NY", 43.1577, -77.6014],
      ["strong_museum", "The Strong National Museum of Play, Rochester, NY", 43.1527, -77.6008],
      ["highland_park_rochester", "Highland Park, Rochester, NY", 43.1306, -77.6088],
      ["rit", "Rochester Institute of Technology, Henrietta, NY", 43.0845, -77.6744]
    ]
  },
  {
    id: "chicago",
    name: "Chicago",
    region: "IL",
    centerLatitude: 41.8781,
    centerLongitude: -87.6298,
    radiusKm: 70,
    locations: [
      ["loop", "The Loop, Chicago, IL", 41.8819, -87.6278],
      ["ohare", "O'Hare International Airport (ORD), Chicago, IL", 41.9742, -87.9073],
      ["midway", "Midway International Airport (MDW), Chicago, IL", 41.7868, -87.7522],
      ["river_north", "River North, Chicago, IL", 41.8924, -87.6341],
      ["wrigley", "Wrigley Field, Chicago, IL", 41.9484, -87.6553],
      ["navy_pier", "Navy Pier, Chicago, IL", 41.8917, -87.6079],
      ["united_center", "United Center, Chicago, IL", 41.8807, -87.6742]
    ]
  },
  {
    id: "sf_bay",
    name: "San Francisco Bay Area",
    region: "CA",
    centerLatitude: 37.4477,
    centerLongitude: -122.1619,
    radiusKm: 85,
    locations: [
      ["university_ave_palo_alto", "University Avenue, Palo Alto, CA", 37.4477, -122.1619],
      ["palo_alto", "Downtown Palo Alto, CA", 37.4419, -122.1430],
      ["stanford", "Stanford University, Stanford, CA", 37.4275, -122.1697],
      ["mountain_view_castro", "Castro Street, Mountain View, CA", 37.3947, -122.0781],
      ["apple_park", "Apple Park, Cupertino, CA", 37.3349, -122.0090],
      ["googleplex", "Googleplex, Mountain View, CA", 37.4220, -122.0841],
      ["sjc", "San Jose Mineta International Airport (SJC), CA", 37.3639, -121.9289],
      ["downtown_sf", "Downtown San Francisco, CA", 37.7749, -122.4194],
      ["sfo", "San Francisco International Airport (SFO), CA", 37.6213, -122.3790],
      ["oakland", "Downtown Oakland, CA", 37.8044, -122.2711],
      ["ferry_building", "Ferry Building, San Francisco, CA", 37.7955, -122.3937],
      ["mission", "Mission District, San Francisco, CA", 37.7599, -122.4148]
    ]
  },
  {
    id: "washington_dc",
    name: "Washington DC",
    region: "DC",
    centerLatitude: 38.9072,
    centerLongitude: -77.0369,
    radiusKm: 65,
    locations: [
      ["national_mall", "National Mall, Washington, DC", 38.8895, -77.0353],
      ["union_station_dc", "Union Station, Washington, DC", 38.8977, -77.0060],
      ["dca", "Ronald Reagan Washington National Airport (DCA), VA", 38.8512, -77.0402],
      ["iad", "Dulles International Airport (IAD), VA", 38.9531, -77.4565],
      ["georgetown", "Georgetown, Washington, DC", 38.9097, -77.0654],
      ["arlington", "Arlington, VA", 38.8797, -77.1068],
      ["bethesda", "Bethesda, MD", 38.9847, -77.0947]
    ]
  },
  {
    id: "miami",
    name: "Miami",
    region: "FL",
    centerLatitude: 25.7617,
    centerLongitude: -80.1918,
    radiusKm: 70,
    locations: [
      ["brickell", "Brickell, Miami, FL", 25.7602, -80.1959],
      ["mia", "Miami International Airport (MIA), FL", 25.7959, -80.2870],
      ["south_beach", "South Beach, Miami Beach, FL", 25.7826, -80.1341],
      ["wynwood", "Wynwood, Miami, FL", 25.8011, -80.1996],
      ["coral_gables", "Coral Gables, FL", 25.7215, -80.2684],
      ["ft_lauderdale", "Fort Lauderdale, FL", 26.1224, -80.1373],
      ["hard_rock", "Hard Rock Stadium, Miami Gardens, FL", 25.9580, -80.2389]
    ]
  },
  {
    id: "seattle",
    name: "Seattle",
    region: "WA",
    centerLatitude: 47.6062,
    centerLongitude: -122.3321,
    radiusKm: 70,
    locations: [
      ["downtown_seattle", "Downtown Seattle, WA", 47.6062, -122.3321],
      ["sea_tac", "Seattle-Tacoma International Airport (SEA), WA", 47.4502, -122.3088],
      ["pike_place", "Pike Place Market, Seattle, WA", 47.6097, -122.3425],
      ["south_lake_union", "South Lake Union, Seattle, WA", 47.6232, -122.3384],
      ["uw", "University of Washington, Seattle, WA", 47.6553, -122.3035],
      ["bellevue", "Downtown Bellevue, WA", 47.6101, -122.2015],
      ["lumen_field", "Lumen Field, Seattle, WA", 47.5952, -122.3316]
    ]
  },
  {
    id: "spokane",
    name: "Spokane",
    region: "WA",
    centerLatitude: 47.6588,
    centerLongitude: -117.4260,
    radiusKm: 55,
    locations: [
      ["downtown_spokane", "Downtown Spokane, WA", 47.6588, -117.4260],
      ["spokane_airport", "Spokane International Airport (GEG), WA", 47.6199, -117.5338],
      ["riverfront_park_spokane", "Riverfront Park, Spokane, WA", 47.6606, -117.4217],
      ["gonzaga", "Gonzaga University, Spokane, WA", 47.6672, -117.4027],
      ["sacred_heart_spokane", "Providence Sacred Heart Medical Center, Spokane, WA", 47.6481, -117.4130],
      ["spokane_valley", "Spokane Valley, WA", 47.6732, -117.2394],
      ["north_spokane", "North Spokane, WA", 47.7205, -117.4110]
    ]
  },
  {
    id: "tacoma",
    name: "Tacoma",
    region: "WA",
    centerLatitude: 47.2529,
    centerLongitude: -122.4443,
    radiusKm: 55,
    locations: [
      ["downtown_tacoma", "Downtown Tacoma, WA", 47.2529, -122.4443],
      ["tacoma_dome", "Tacoma Dome, Tacoma, WA", 47.2365, -122.4265],
      ["university_of_puget_sound", "University of Puget Sound, Tacoma, WA", 47.2639, -122.4815],
      ["point_defiance", "Point Defiance Park, Tacoma, WA", 47.3059, -122.5200],
      ["uw_tacoma", "University of Washington Tacoma, WA", 47.2446, -122.4384],
      ["st_joseph_tacoma", "St. Joseph Medical Center, Tacoma, WA", 47.2490, -122.4574],
      ["lakewood_wa", "Lakewood, WA", 47.1718, -122.5185]
    ]
  },
  {
    id: "dallas",
    name: "Dallas-Fort Worth",
    region: "TX",
    centerLatitude: 32.7767,
    centerLongitude: -96.7970,
    radiusKm: 90,
    locations: [
      ["downtown_dallas", "Downtown Dallas, TX", 32.7767, -96.7970],
      ["dfw", "Dallas Fort Worth International Airport (DFW), TX", 32.8998, -97.0403],
      ["love_field", "Dallas Love Field (DAL), TX", 32.8471, -96.8518],
      ["uptown_dallas", "Uptown Dallas, TX", 32.8003, -96.8016],
      ["deep_ellum", "Deep Ellum, Dallas, TX", 32.7840, -96.7837],
      ["downtown_fort_worth", "Downtown Fort Worth, TX", 32.7555, -97.3308],
      ["att_stadium", "AT&T Stadium, Arlington, TX", 32.7473, -97.0945]
    ]
  },
  {
    id: "houston",
    name: "Houston",
    region: "TX",
    centerLatitude: 29.7604,
    centerLongitude: -95.3698,
    radiusKm: 85,
    locations: [
      ["downtown_houston", "Downtown Houston, TX", 29.7604, -95.3698],
      ["iah", "George Bush Intercontinental Airport (IAH), Houston, TX", 29.9902, -95.3368],
      ["hobby", "William P. Hobby Airport (HOU), Houston, TX", 29.6454, -95.2789],
      ["texas_medical_center", "Texas Medical Center, Houston, TX", 29.7079, -95.3975],
      ["galleria_houston", "The Galleria, Houston, TX", 29.7390, -95.4636],
      ["midtown_houston", "Midtown Houston, TX", 29.7418, -95.3768],
      ["nrg_stadium", "NRG Stadium, Houston, TX", 29.6847, -95.4107]
    ]
  },
  {
    id: "san_antonio",
    name: "San Antonio",
    region: "TX",
    centerLatitude: 29.4241,
    centerLongitude: -98.4936,
    radiusKm: 70,
    locations: [
      ["downtown_san_antonio", "Downtown San Antonio, TX", 29.4241, -98.4936],
      ["sat", "San Antonio International Airport (SAT), TX", 29.5337, -98.4698],
      ["river_walk", "San Antonio River Walk, TX", 29.4252, -98.4916],
      ["alamo", "The Alamo, San Antonio, TX", 29.4260, -98.4861],
      ["pearl_district", "Pearl District, San Antonio, TX", 29.4424, -98.4797],
      ["utsa", "University of Texas at San Antonio, TX", 29.5827, -98.6211],
      ["alamodome", "Alamodome, San Antonio, TX", 29.4169, -98.4789]
    ]
  },
  {
    id: "atlanta",
    name: "Atlanta",
    region: "GA",
    centerLatitude: 33.7490,
    centerLongitude: -84.3880,
    radiusKm: 75,
    locations: [
      ["midtown_atlanta", "Midtown Atlanta, GA", 33.7833, -84.3831],
      ["atl", "Hartsfield-Jackson Atlanta International Airport (ATL), GA", 33.6407, -84.4277],
      ["downtown_atlanta", "Downtown Atlanta, GA", 33.7550, -84.3900],
      ["buckhead", "Buckhead, Atlanta, GA", 33.8484, -84.3733],
      ["ponce_city_market", "Ponce City Market, Atlanta, GA", 33.7726, -84.3656],
      ["mercedes_benz", "Mercedes-Benz Stadium, Atlanta, GA", 33.7554, -84.4008],
      ["decatur", "Decatur, GA", 33.7748, -84.2963]
    ]
  },
  {
    id: "boston",
    name: "Boston",
    region: "MA",
    centerLatitude: 42.3601,
    centerLongitude: -71.0589,
    radiusKm: 60,
    locations: [
      ["downtown_boston", "Downtown Boston, MA", 42.3601, -71.0589],
      ["logan", "Boston Logan International Airport (BOS), MA", 42.3656, -71.0096],
      ["south_station", "South Station, Boston, MA", 42.3523, -71.0552],
      ["back_bay", "Back Bay, Boston, MA", 42.3503, -71.0810],
      ["cambridge", "Kendall Square, Cambridge, MA", 42.3626, -71.0843],
      ["fenway", "Fenway Park, Boston, MA", 42.3467, -71.0972],
      ["harvard", "Harvard Square, Cambridge, MA", 42.3734, -71.1189]
    ]
  },
  {
    id: "worcester",
    name: "Worcester",
    region: "MA",
    centerLatitude: 42.2626,
    centerLongitude: -71.8023,
    radiusKm: 45,
    locations: [
      ["downtown_worcester", "Downtown Worcester, MA", 42.2626, -71.8023],
      ["worcester_union_station", "Union Station, Worcester, MA", 42.2618, -71.7949],
      ["worcester_airport", "Worcester Regional Airport (ORH), MA", 42.2673, -71.8757],
      ["polar_park", "Polar Park, Worcester, MA", 42.2573, -71.8008],
      ["wpi", "Worcester Polytechnic Institute, Worcester, MA", 42.2749, -71.8081],
      ["umass_memorial", "UMass Memorial Medical Center, Worcester, MA", 42.2767, -71.7619],
      ["college_of_holy_cross", "College of the Holy Cross, Worcester, MA", 42.2385, -71.8089]
    ]
  },
  {
    id: "springfield_ma",
    name: "Springfield",
    region: "MA",
    centerLatitude: 42.1015,
    centerLongitude: -72.5898,
    radiusKm: 45,
    locations: [
      ["downtown_springfield_ma", "Downtown Springfield, MA", 42.1015, -72.5898],
      ["springfield_union_station", "Union Station, Springfield, MA", 42.1061, -72.5939],
      ["mgm_springfield", "MGM Springfield, MA", 42.0997, -72.5881],
      ["basketball_hall", "Naismith Basketball Hall of Fame, Springfield, MA", 42.0930, -72.5845],
      ["springfield_college", "Springfield College, Springfield, MA", 42.1057, -72.5562],
      ["baystate_medical", "Baystate Medical Center, Springfield, MA", 42.1209, -72.6044],
      ["forest_park_springfield", "Forest Park, Springfield, MA", 42.0808, -72.5745]
    ]
  },
  {
    id: "detroit",
    name: "Detroit",
    region: "MI",
    centerLatitude: 42.3314,
    centerLongitude: -83.0458,
    radiusKm: 65,
    locations: [
      ["downtown_detroit", "Downtown Detroit, MI", 42.3314, -83.0458],
      ["dtw", "Detroit Metropolitan Wayne County Airport (DTW), MI", 42.2162, -83.3554],
      ["midtown_detroit", "Midtown Detroit, MI", 42.3482, -83.0583],
      ["wayne_state", "Wayne State University, Detroit, MI", 42.3591, -83.0665],
      ["comerica_park", "Comerica Park, Detroit, MI", 42.3390, -83.0485],
      ["henry_ford_hospital", "Henry Ford Hospital, Detroit, MI", 42.3676, -83.0849],
      ["detroit_riverfront", "Detroit Riverfront, Detroit, MI", 42.3270, -83.0392]
    ]
  },
  {
    id: "grand_rapids",
    name: "Grand Rapids",
    region: "MI",
    centerLatitude: 42.9634,
    centerLongitude: -85.6681,
    radiusKm: 45,
    locations: [
      ["downtown_grand_rapids", "Downtown Grand Rapids, MI", 42.9634, -85.6681],
      ["grr", "Gerald R. Ford International Airport (GRR), MI", 42.8808, -85.5228],
      ["medical_mile", "Medical Mile, Grand Rapids, MI", 42.9700, -85.6644],
      ["van_andel_arena", "Van Andel Arena, Grand Rapids, MI", 42.9620, -85.6712],
      ["grand_valley_downtown", "Grand Valley State University Pew Campus, Grand Rapids, MI", 42.9631, -85.6757],
      ["east_grand_rapids", "East Grand Rapids, MI", 42.9411, -85.6100],
      ["john_ball_zoo", "John Ball Zoo, Grand Rapids, MI", 42.9636, -85.7043]
    ]
  },
  {
    id: "warren_mi",
    name: "Warren",
    region: "MI",
    centerLatitude: 42.5145,
    centerLongitude: -83.0147,
    radiusKm: 45,
    locations: [
      ["downtown_warren", "Downtown Warren, MI", 42.5145, -83.0147],
      ["gm_tech_center", "General Motors Technical Center, Warren, MI", 42.5188, -83.0390],
      ["warren_city_hall", "Warren City Hall, Warren, MI", 42.5147, -83.0280],
      ["macomb_community_college", "Macomb Community College South Campus, Warren, MI", 42.5208, -82.9643],
      ["ascension_macomb", "Ascension Macomb-Oakland Hospital, Warren, MI", 42.5752, -82.9714],
      ["sterling_heights", "Sterling Heights, MI", 42.5803, -83.0302],
      ["royal_oak", "Royal Oak, MI", 42.4895, -83.1446]
    ]
  },
  {
    id: "toronto",
    name: "Toronto",
    region: "Canada",
    centerLatitude: 43.6532,
    centerLongitude: -79.3832,
    radiusKm: 75,
    locations: [
      ["toronto_downtown", "Downtown Toronto, ON, Canada", 43.6532, -79.3832],
      ["yyz", "Toronto Pearson International Airport (YYZ), ON, Canada", 43.6777, -79.6248],
      ["union_station_toronto", "Union Station, Toronto, ON, Canada", 43.6452, -79.3806],
      ["cn_tower", "CN Tower, Toronto, ON, Canada", 43.6426, -79.3871],
      ["yorkville", "Yorkville, Toronto, ON, Canada", 43.6709, -79.3933],
      ["north_york", "North York Centre, Toronto, ON, Canada", 43.7687, -79.4127]
    ]
  },
  {
    id: "vancouver",
    name: "Vancouver",
    region: "Canada",
    centerLatitude: 49.2827,
    centerLongitude: -123.1207,
    radiusKm: 70,
    locations: [
      ["vancouver_downtown", "Downtown Vancouver, BC, Canada", 49.2827, -123.1207],
      ["yvr", "Vancouver International Airport (YVR), BC, Canada", 49.1967, -123.1815],
      ["waterfront_vancouver", "Waterfront Station, Vancouver, BC, Canada", 49.2858, -123.1119],
      ["gastown", "Gastown, Vancouver, BC, Canada", 49.2828, -123.1067],
      ["kitsilano", "Kitsilano, Vancouver, BC, Canada", 49.2684, -123.1683],
      ["burnaby", "Metrotown, Burnaby, BC, Canada", 49.2276, -123.0076]
    ]
  },
  {
    id: "mexico_city",
    name: "Mexico City",
    region: "Mexico",
    centerLatitude: 19.4326,
    centerLongitude: -99.1332,
    radiusKm: 80,
    locations: [
      ["cdmx_centro", "Centro Historico, Mexico City, Mexico", 19.4326, -99.1332],
      ["mex", "Mexico City International Airport (MEX), Mexico", 19.4361, -99.0719],
      ["polanco", "Polanco, Mexico City, Mexico", 19.4321, -99.1941],
      ["roma_norte", "Roma Norte, Mexico City, Mexico", 19.4194, -99.1641],
      ["condesa", "Condesa, Mexico City, Mexico", 19.4120, -99.1747],
      ["santa_fe_cdmx", "Santa Fe, Mexico City, Mexico", 19.3598, -99.2769]
    ]
  },
  {
    id: "sao_paulo",
    name: "Sao Paulo",
    region: "Brazil",
    centerLatitude: -23.5505,
    centerLongitude: -46.6333,
    radiusKm: 85,
    locations: [
      ["paulista", "Avenida Paulista, Sao Paulo, Brazil", -23.5614, -46.6559],
      ["gru", "Sao Paulo Guarulhos International Airport (GRU), Brazil", -23.4356, -46.4731],
      ["congonhas", "Congonhas Airport (CGH), Sao Paulo, Brazil", -23.6261, -46.6566],
      ["vila_madalena", "Vila Madalena, Sao Paulo, Brazil", -23.5489, -46.6926],
      ["itaim_bibi", "Itaim Bibi, Sao Paulo, Brazil", -23.5846, -46.6786],
      ["pinheiros", "Pinheiros, Sao Paulo, Brazil", -23.5673, -46.7019]
    ]
  },
  {
    id: "rio_de_janeiro",
    name: "Rio de Janeiro",
    region: "Brazil",
    centerLatitude: -22.9068,
    centerLongitude: -43.1729,
    radiusKm: 75,
    locations: [
      ["rio_centro", "Centro, Rio de Janeiro, Brazil", -22.9068, -43.1729],
      ["gig", "Rio de Janeiro Galeao International Airport (GIG), Brazil", -22.8099, -43.2506],
      ["sdu", "Santos Dumont Airport (SDU), Rio de Janeiro, Brazil", -22.9105, -43.1631],
      ["copacabana", "Copacabana, Rio de Janeiro, Brazil", -22.9711, -43.1822],
      ["ipanema", "Ipanema, Rio de Janeiro, Brazil", -22.9847, -43.1986],
      ["barra", "Barra da Tijuca, Rio de Janeiro, Brazil", -23.0004, -43.3659]
    ]
  },
  {
    id: "buenos_aires",
    name: "Buenos Aires",
    region: "Argentina",
    centerLatitude: -34.6037,
    centerLongitude: -58.3816,
    radiusKm: 75,
    locations: [
      ["obelisco", "Obelisco, Buenos Aires, Argentina", -34.6037, -58.3816],
      ["eze", "Ezeiza International Airport (EZE), Buenos Aires, Argentina", -34.8222, -58.5358],
      ["aep", "Aeroparque Jorge Newbery (AEP), Buenos Aires, Argentina", -34.5580, -58.4156],
      ["palermo", "Palermo, Buenos Aires, Argentina", -34.5889, -58.4306],
      ["recoleta", "Recoleta, Buenos Aires, Argentina", -34.5875, -58.3974],
      ["puerto_madero", "Puerto Madero, Buenos Aires, Argentina", -34.6118, -58.3620]
    ]
  },
  {
    id: "santiago",
    name: "Santiago",
    region: "Chile",
    centerLatitude: -33.4489,
    centerLongitude: -70.6693,
    radiusKm: 70,
    locations: [
      ["santiago_centro", "Downtown Santiago, Chile", -33.4489, -70.6693],
      ["scl", "Santiago International Airport (SCL), Chile", -33.3928, -70.7858],
      ["providencia", "Providencia, Santiago, Chile", -33.4263, -70.6170],
      ["las_condes", "Las Condes, Santiago, Chile", -33.4088, -70.5675],
      ["bellavista", "Barrio Bellavista, Santiago, Chile", -33.4326, -70.6345],
      ["vitacura", "Vitacura, Santiago, Chile", -33.3812, -70.5720]
    ]
  },
  {
    id: "bogota",
    name: "Bogota",
    region: "Colombia",
    centerLatitude: 4.7110,
    centerLongitude: -74.0721,
    radiusKm: 70,
    locations: [
      ["bogota_centro", "Downtown Bogota, Colombia", 4.7110, -74.0721],
      ["bog", "El Dorado International Airport (BOG), Bogota, Colombia", 4.7016, -74.1469],
      ["chapinero", "Chapinero, Bogota, Colombia", 4.6486, -74.0628],
      ["zona_t", "Zona T, Bogota, Colombia", 4.6673, -74.0533],
      ["usaquen", "Usaquen, Bogota, Colombia", 4.6959, -74.0308],
      ["la_candelaria", "La Candelaria, Bogota, Colombia", 4.5964, -74.0733]
    ]
  },
  {
    id: "london",
    name: "London",
    region: "United Kingdom",
    centerLatitude: 51.5074,
    centerLongitude: -0.1278,
    radiusKm: 85,
    locations: [
      ["westminster", "Westminster, London, UK", 51.4995, -0.1248],
      ["lhr", "Heathrow Airport (LHR), London, UK", 51.4700, -0.4543],
      ["lgw", "Gatwick Airport (LGW), London, UK", 51.1537, -0.1821],
      ["kings_cross", "King's Cross St Pancras, London, UK", 51.5320, -0.1233],
      ["canary_wharf", "Canary Wharf, London, UK", 51.5054, -0.0235],
      ["shoreditch", "Shoreditch, London, UK", 51.5260, -0.0780],
      ["paddington", "Paddington Station, London, UK", 51.5154, -0.1755]
    ]
  },
  {
    id: "paris",
    name: "Paris",
    region: "France",
    centerLatitude: 48.8566,
    centerLongitude: 2.3522,
    radiusKm: 75,
    locations: [
      ["paris_center", "Hotel de Ville, Paris, France", 48.8566, 2.3522],
      ["cdg", "Charles de Gaulle Airport (CDG), Paris, France", 49.0097, 2.5479],
      ["ory", "Orly Airport (ORY), Paris, France", 48.7262, 2.3652],
      ["gare_du_nord", "Gare du Nord, Paris, France", 48.8809, 2.3553],
      ["la_defense", "La Defense, Paris, France", 48.8924, 2.2369],
      ["eiffel_tower", "Eiffel Tower, Paris, France", 48.8584, 2.2945],
      ["montmartre", "Montmartre, Paris, France", 48.8867, 2.3431]
    ]
  },
  {
    id: "berlin",
    name: "Berlin",
    region: "Germany",
    centerLatitude: 52.5200,
    centerLongitude: 13.4050,
    radiusKm: 70,
    locations: [
      ["mitte", "Mitte, Berlin, Germany", 52.5200, 13.4050],
      ["ber", "Berlin Brandenburg Airport (BER), Germany", 52.3667, 13.5033],
      ["hauptbahnhof", "Berlin Hauptbahnhof, Germany", 52.5251, 13.3694],
      ["alexanderplatz", "Alexanderplatz, Berlin, Germany", 52.5219, 13.4132],
      ["kreuzberg", "Kreuzberg, Berlin, Germany", 52.4986, 13.4034],
      ["potsdamer_platz", "Potsdamer Platz, Berlin, Germany", 52.5096, 13.3760]
    ]
  },
  {
    id: "madrid",
    name: "Madrid",
    region: "Spain",
    centerLatitude: 40.4168,
    centerLongitude: -3.7038,
    radiusKm: 70,
    locations: [
      ["puerta_sol", "Puerta del Sol, Madrid, Spain", 40.4168, -3.7038],
      ["mad", "Adolfo Suarez Madrid-Barajas Airport (MAD), Spain", 40.4983, -3.5676],
      ["atocha", "Madrid Atocha Station, Spain", 40.4065, -3.6896],
      ["salamanca", "Salamanca, Madrid, Spain", 40.4300, -3.6800],
      ["chamartin", "Chamartin, Madrid, Spain", 40.4722, -3.6825],
      ["gran_via", "Gran Via, Madrid, Spain", 40.4203, -3.7058]
    ]
  },
  {
    id: "rome",
    name: "Rome",
    region: "Italy",
    centerLatitude: 41.9028,
    centerLongitude: 12.4964,
    radiusKm: 70,
    locations: [
      ["rome_center", "Centro Storico, Rome, Italy", 41.9028, 12.4964],
      ["fco", "Leonardo da Vinci Fiumicino Airport (FCO), Rome, Italy", 41.8003, 12.2389],
      ["cia", "Ciampino Airport (CIA), Rome, Italy", 41.7999, 12.5949],
      ["termini", "Roma Termini Station, Rome, Italy", 41.9010, 12.5019],
      ["trastevere", "Trastevere, Rome, Italy", 41.8898, 12.4663],
      ["colosseum", "Colosseum, Rome, Italy", 41.8902, 12.4922]
    ]
  },
  {
    id: "amsterdam",
    name: "Amsterdam",
    region: "Netherlands",
    centerLatitude: 52.3676,
    centerLongitude: 4.9041,
    radiusKm: 60,
    locations: [
      ["amsterdam_centraal", "Amsterdam Centraal, Netherlands", 52.3791, 4.8994],
      ["ams", "Amsterdam Schiphol Airport (AMS), Netherlands", 52.3105, 4.7683],
      ["dam_square", "Dam Square, Amsterdam, Netherlands", 52.3731, 4.8922],
      ["jordaan", "Jordaan, Amsterdam, Netherlands", 52.3738, 4.8810],
      ["zuidas", "Zuidas, Amsterdam, Netherlands", 52.3373, 4.8739],
      ["museumplein", "Museumplein, Amsterdam, Netherlands", 52.3579, 4.8812]
    ]
  },
  {
    id: "istanbul",
    name: "Istanbul",
    region: "Turkey",
    centerLatitude: 41.0082,
    centerLongitude: 28.9784,
    radiusKm: 90,
    locations: [
      ["sultanahmet", "Sultanahmet, Istanbul, Turkey", 41.0082, 28.9784],
      ["ist", "Istanbul Airport (IST), Turkey", 41.2753, 28.7519],
      ["saw", "Sabiha Gokcen Airport (SAW), Istanbul, Turkey", 40.8986, 29.3092],
      ["taksim", "Taksim Square, Istanbul, Turkey", 41.0369, 28.9850],
      ["besiktas", "Besiktas, Istanbul, Turkey", 41.0438, 29.0094],
      ["kadikoy", "Kadikoy, Istanbul, Turkey", 40.9903, 29.0290]
    ]
  },
  {
    id: "dubai",
    name: "Dubai",
    region: "United Arab Emirates",
    centerLatitude: 25.2048,
    centerLongitude: 55.2708,
    radiusKm: 85,
    locations: [
      ["downtown_dubai", "Downtown Dubai, UAE", 25.1972, 55.2744],
      ["dxb", "Dubai International Airport (DXB), UAE", 25.2532, 55.3657],
      ["dubai_marina", "Dubai Marina, UAE", 25.0805, 55.1403],
      ["business_bay", "Business Bay, Dubai, UAE", 25.1850, 55.2772],
      ["jbr", "Jumeirah Beach Residence, Dubai, UAE", 25.0750, 55.1313],
      ["palm_jumeirah", "Palm Jumeirah, Dubai, UAE", 25.1124, 55.1390]
    ]
  },
  {
    id: "riyadh",
    name: "Riyadh",
    region: "Saudi Arabia",
    centerLatitude: 24.7136,
    centerLongitude: 46.6753,
    radiusKm: 80,
    locations: [
      ["olaya", "Olaya, Riyadh, Saudi Arabia", 24.7136, 46.6753],
      ["ruh", "King Khalid International Airport (RUH), Riyadh, Saudi Arabia", 24.9576, 46.6988],
      ["kingdom_centre", "Kingdom Centre, Riyadh, Saudi Arabia", 24.7113, 46.6744],
      ["riyadh_front", "Riyadh Front, Saudi Arabia", 24.8415, 46.7356],
      ["diriyah", "Diriyah, Riyadh, Saudi Arabia", 24.7370, 46.5756],
      ["king_abdullah_financial", "King Abdullah Financial District, Riyadh, Saudi Arabia", 24.7628, 46.6400]
    ]
  },
  {
    id: "cairo",
    name: "Cairo",
    region: "Egypt",
    centerLatitude: 30.0444,
    centerLongitude: 31.2357,
    radiusKm: 80,
    locations: [
      ["downtown_cairo", "Downtown Cairo, Egypt", 30.0444, 31.2357],
      ["cai", "Cairo International Airport (CAI), Egypt", 30.1120, 31.4000],
      ["zamalek", "Zamalek, Cairo, Egypt", 30.0610, 31.2194],
      ["new_cairo", "New Cairo, Egypt", 30.0131, 31.4913],
      ["giza", "Giza Pyramids, Giza, Egypt", 29.9792, 31.1342],
      ["nasr_city", "Nasr City, Cairo, Egypt", 30.0561, 31.3300]
    ]
  },
  {
    id: "nairobi",
    name: "Nairobi",
    region: "Kenya",
    centerLatitude: -1.2921,
    centerLongitude: 36.8219,
    radiusKm: 65,
    locations: [
      ["nairobi_cbd", "Nairobi CBD, Kenya", -1.2921, 36.8219],
      ["nbo", "Jomo Kenyatta International Airport (NBO), Nairobi, Kenya", -1.3192, 36.9278],
      ["westlands", "Westlands, Nairobi, Kenya", -1.2676, 36.8108],
      ["kilimani", "Kilimani, Nairobi, Kenya", -1.2925, 36.7854],
      ["upper_hill", "Upper Hill, Nairobi, Kenya", -1.3006, 36.8156],
      ["karen", "Karen, Nairobi, Kenya", -1.3197, 36.7073]
    ]
  },
  {
    id: "johannesburg",
    name: "Johannesburg",
    region: "South Africa",
    centerLatitude: -26.2041,
    centerLongitude: 28.0473,
    radiusKm: 80,
    locations: [
      ["sandton", "Sandton, Johannesburg, South Africa", -26.1076, 28.0567],
      ["jnb", "O. R. Tambo International Airport (JNB), Johannesburg, South Africa", -26.1337, 28.2420],
      ["rosebank", "Rosebank, Johannesburg, South Africa", -26.1450, 28.0417],
      ["melrose_arch", "Melrose Arch, Johannesburg, South Africa", -26.1340, 28.0688],
      ["joburg_cbd", "Johannesburg CBD, South Africa", -26.2041, 28.0473],
      ["fourways", "Fourways, Johannesburg, South Africa", -26.0157, 28.0120]
    ]
  },
  {
    id: "mumbai",
    name: "Mumbai",
    region: "India",
    centerLatitude: 19.0760,
    centerLongitude: 72.8777,
    radiusKm: 85,
    locations: [
      ["bandra_kurla", "Bandra Kurla Complex, Mumbai, India", 19.0667, 72.8675],
      ["bom", "Chhatrapati Shivaji Maharaj International Airport (BOM), Mumbai, India", 19.0896, 72.8656],
      ["colaba", "Colaba, Mumbai, India", 18.9067, 72.8147],
      ["andheri", "Andheri, Mumbai, India", 19.1197, 72.8464],
      ["lower_parel", "Lower Parel, Mumbai, India", 18.9930, 72.8308],
      ["powai", "Powai, Mumbai, India", 19.1176, 72.9060]
    ]
  },
  {
    id: "delhi",
    name: "Delhi NCR",
    region: "India",
    centerLatitude: 28.6139,
    centerLongitude: 77.2090,
    radiusKm: 90,
    locations: [
      ["connaught_place", "Connaught Place, New Delhi, India", 28.6315, 77.2167],
      ["del", "Indira Gandhi International Airport (DEL), Delhi, India", 28.5562, 77.1000],
      ["gurugram", "Cyber City, Gurugram, India", 28.4949, 77.0890],
      ["noida", "Sector 18, Noida, India", 28.5706, 77.3261],
      ["south_delhi", "South Delhi, India", 28.5245, 77.1855],
      ["new_delhi_station", "New Delhi Railway Station, India", 28.6429, 77.2195]
    ]
  },
  {
    id: "bangkok",
    name: "Bangkok",
    region: "Thailand",
    centerLatitude: 13.7563,
    centerLongitude: 100.5018,
    radiusKm: 80,
    locations: [
      ["sukhumvit", "Sukhumvit, Bangkok, Thailand", 13.7373, 100.5600],
      ["bkk", "Suvarnabhumi Airport (BKK), Bangkok, Thailand", 13.6900, 100.7501],
      ["dmk", "Don Mueang International Airport (DMK), Bangkok, Thailand", 13.9126, 100.6068],
      ["siam", "Siam, Bangkok, Thailand", 13.7466, 100.5347],
      ["silom", "Silom, Bangkok, Thailand", 13.7246, 100.5294],
      ["ari", "Ari, Bangkok, Thailand", 13.7800, 100.5447]
    ]
  },
  {
    id: "singapore",
    name: "Singapore",
    region: "Singapore",
    centerLatitude: 1.3521,
    centerLongitude: 103.8198,
    radiusKm: 45,
    locations: [
      ["marina_bay", "Marina Bay, Singapore", 1.2834, 103.8607],
      ["sin", "Changi Airport (SIN), Singapore", 1.3644, 103.9915],
      ["orchard", "Orchard Road, Singapore", 1.3048, 103.8318],
      ["raffles_place", "Raffles Place, Singapore", 1.2840, 103.8513],
      ["bugis", "Bugis, Singapore", 1.3008, 103.8559],
      ["sentosa", "Sentosa, Singapore", 1.2494, 103.8303]
    ]
  },
  {
    id: "tokyo",
    name: "Tokyo",
    region: "Japan",
    centerLatitude: 35.6762,
    centerLongitude: 139.6503,
    radiusKm: 90,
    locations: [
      ["tokyo_station", "Tokyo Station, Tokyo, Japan", 35.6812, 139.7671],
      ["hnd", "Haneda Airport (HND), Tokyo, Japan", 35.5494, 139.7798],
      ["nrt", "Narita International Airport (NRT), Chiba, Japan", 35.7719, 140.3929],
      ["shinjuku", "Shinjuku, Tokyo, Japan", 35.6938, 139.7034],
      ["shibuya", "Shibuya, Tokyo, Japan", 35.6595, 139.7005],
      ["roppongi", "Roppongi, Tokyo, Japan", 35.6628, 139.7314],
      ["ginza", "Ginza, Tokyo, Japan", 35.6717, 139.7650]
    ]
  },
  {
    id: "seoul",
    name: "Seoul",
    region: "South Korea",
    centerLatitude: 37.5665,
    centerLongitude: 126.9780,
    radiusKm: 85,
    locations: [
      ["gangnam", "Gangnam, Seoul, South Korea", 37.4979, 127.0276],
      ["icn", "Incheon International Airport (ICN), South Korea", 37.4602, 126.4407],
      ["gmp", "Gimpo International Airport (GMP), Seoul, South Korea", 37.5583, 126.7906],
      ["hongdae", "Hongdae, Seoul, South Korea", 37.5563, 126.9236],
      ["myeongdong", "Myeongdong, Seoul, South Korea", 37.5636, 126.9820],
      ["itaewon", "Itaewon, Seoul, South Korea", 37.5345, 126.9946]
    ]
  },
  {
    id: "hong_kong",
    name: "Hong Kong",
    region: "Hong Kong",
    centerLatitude: 22.3193,
    centerLongitude: 114.1694,
    radiusKm: 55,
    locations: [
      ["central_hk", "Central, Hong Kong", 22.2819, 114.1589],
      ["hkg", "Hong Kong International Airport (HKG)", 22.3080, 113.9185],
      ["tsim_sha_tsui", "Tsim Sha Tsui, Hong Kong", 22.2976, 114.1722],
      ["causeway_bay", "Causeway Bay, Hong Kong", 22.2803, 114.1848],
      ["mong_kok", "Mong Kok, Hong Kong", 22.3193, 114.1694],
      ["kowloon_station", "Kowloon Station, Hong Kong", 22.3048, 114.1615]
    ]
  },
  {
    id: "taipei",
    name: "Taipei",
    region: "Taiwan",
    centerLatitude: 25.0330,
    centerLongitude: 121.5654,
    radiusKm: 70,
    locations: [
      ["taipei_101", "Taipei 101, Taipei, Taiwan", 25.0339, 121.5645],
      ["tpe", "Taoyuan International Airport (TPE), Taiwan", 25.0797, 121.2342],
      ["tsa", "Taipei Songshan Airport (TSA), Taiwan", 25.0694, 121.5525],
      ["taipei_main", "Taipei Main Station, Taiwan", 25.0478, 121.5170],
      ["xinyi", "Xinyi District, Taipei, Taiwan", 25.0330, 121.5654],
      ["ximending", "Ximending, Taipei, Taiwan", 25.0420, 121.5070]
    ]
  },
  {
    id: "shanghai",
    name: "Shanghai",
    region: "China",
    centerLatitude: 31.2304,
    centerLongitude: 121.4737,
    radiusKm: 90,
    locations: [
      ["people_square", "People's Square, Shanghai, China", 31.2304, 121.4737],
      ["pvg", "Shanghai Pudong International Airport (PVG), China", 31.1443, 121.8083],
      ["sha", "Shanghai Hongqiao International Airport (SHA), China", 31.1979, 121.3363],
      ["lujiazui", "Lujiazui, Shanghai, China", 31.2397, 121.4998],
      ["xintiandi", "Xintiandi, Shanghai, China", 31.2199, 121.4751],
      ["jing_an", "Jing'an, Shanghai, China", 31.2231, 121.4454]
    ]
  },
  {
    id: "beijing",
    name: "Beijing",
    region: "China",
    centerLatitude: 39.9042,
    centerLongitude: 116.4074,
    radiusKm: 95,
    locations: [
      ["guomao", "Guomao, Beijing, China", 39.9097, 116.4619],
      ["pek", "Beijing Capital International Airport (PEK), China", 40.0799, 116.6031],
      ["pkx", "Beijing Daxing International Airport (PKX), China", 39.5098, 116.4105],
      ["sanlitun", "Sanlitun, Beijing, China", 39.9336, 116.4551],
      ["wangfujing", "Wangfujing, Beijing, China", 39.9150, 116.4110],
      ["beijing_south", "Beijing South Railway Station, China", 39.8652, 116.3785]
    ]
  },
  {
    id: "sydney",
    name: "Sydney",
    region: "Australia",
    centerLatitude: -33.8688,
    centerLongitude: 151.2093,
    radiusKm: 80,
    locations: [
      ["sydney_cbd", "Sydney CBD, NSW, Australia", -33.8688, 151.2093],
      ["syd", "Sydney Airport (SYD), NSW, Australia", -33.9399, 151.1753],
      ["circular_quay", "Circular Quay, Sydney, Australia", -33.8610, 151.2128],
      ["darling_harbour", "Darling Harbour, Sydney, Australia", -33.8749, 151.2009],
      ["bondi", "Bondi Beach, Sydney, Australia", -33.8915, 151.2767],
      ["parramatta", "Parramatta, Sydney, Australia", -33.8136, 151.0034]
    ]
  },
  {
    id: "melbourne",
    name: "Melbourne",
    region: "Australia",
    centerLatitude: -37.8136,
    centerLongitude: 144.9631,
    radiusKm: 80,
    locations: [
      ["melbourne_cbd", "Melbourne CBD, VIC, Australia", -37.8136, 144.9631],
      ["mel", "Melbourne Airport (MEL), VIC, Australia", -37.6690, 144.8410],
      ["southern_cross", "Southern Cross Station, Melbourne, Australia", -37.8183, 144.9525],
      ["southbank", "Southbank, Melbourne, Australia", -37.8210, 144.9646],
      ["st_kilda", "St Kilda, Melbourne, Australia", -37.8679, 144.9800],
      ["docklands", "Docklands, Melbourne, Australia", -37.8152, 144.9469]
    ]
  },
  {
    id: "auckland",
    name: "Auckland",
    region: "New Zealand",
    centerLatitude: -36.8485,
    centerLongitude: 174.7633,
    radiusKm: 70,
    locations: [
      ["auckland_cbd", "Auckland CBD, New Zealand", -36.8485, 174.7633],
      ["akl", "Auckland Airport (AKL), New Zealand", -37.0082, 174.7850],
      ["viaduct_harbour", "Viaduct Harbour, Auckland, New Zealand", -36.8422, 174.7619],
      ["newmarket", "Newmarket, Auckland, New Zealand", -36.8702, 174.7776],
      ["parnell", "Parnell, Auckland, New Zealand", -36.8567, 174.7810],
      ["takapuna", "Takapuna, Auckland, New Zealand", -36.7869, 174.7732]
    ]
  },
  {
    id: "kuala_lumpur",
    name: "Kuala Lumpur",
    region: "Malaysia",
    centerLatitude: 3.1390,
    centerLongitude: 101.6869,
    radiusKm: 85,
    locations: [
      ["klcc", "KLCC, Kuala Lumpur, Malaysia", 3.1579, 101.7123],
      ["kul", "Kuala Lumpur International Airport (KUL), Malaysia", 2.7456, 101.7072],
      ["bukit_bintang", "Bukit Bintang, Kuala Lumpur, Malaysia", 3.1466, 101.7110],
      ["sentral_kl", "KL Sentral, Kuala Lumpur, Malaysia", 3.1340, 101.6869],
      ["bangsar", "Bangsar, Kuala Lumpur, Malaysia", 3.1290, 101.6797],
      ["mont_kiara", "Mont Kiara, Kuala Lumpur, Malaysia", 3.1677, 101.6508]
    ]
  },
  {
    id: "jakarta",
    name: "Jakarta",
    region: "Indonesia",
    centerLatitude: -6.2088,
    centerLongitude: 106.8456,
    radiusKm: 90,
    locations: [
      ["jakarta_cbd", "Sudirman CBD, Jakarta, Indonesia", -6.2241, 106.8090],
      ["cgk", "Soekarno-Hatta International Airport (CGK), Jakarta, Indonesia", -6.1275, 106.6537],
      ["gambir", "Gambir Station, Jakarta, Indonesia", -6.1767, 106.8307],
      ["kemang", "Kemang, Jakarta, Indonesia", -6.2607, 106.8164],
      ["scbd", "SCBD, Jakarta, Indonesia", -6.2275, 106.8075],
      ["kelapa_gading", "Kelapa Gading, Jakarta, Indonesia", -6.1579, 106.9051]
    ]
  },
  {
    id: "manila",
    name: "Manila",
    region: "Philippines",
    centerLatitude: 14.5995,
    centerLongitude: 120.9842,
    radiusKm: 85,
    locations: [
      ["bgc", "Bonifacio Global City, Metro Manila, Philippines", 14.5503, 121.0505],
      ["mnl", "Ninoy Aquino International Airport (MNL), Manila, Philippines", 14.5086, 121.0194],
      ["makati", "Makati CBD, Metro Manila, Philippines", 14.5547, 121.0244],
      ["intramuros", "Intramuros, Manila, Philippines", 14.5896, 120.9747],
      ["ortigas", "Ortigas Center, Metro Manila, Philippines", 14.5869, 121.0614],
      ["quezon_city", "Quezon City, Metro Manila, Philippines", 14.6760, 121.0437]
    ]
  },
  {
    id: "lagos",
    name: "Lagos",
    region: "Nigeria",
    centerLatitude: 6.5244,
    centerLongitude: 3.3792,
    radiusKm: 80,
    locations: [
      ["victoria_island", "Victoria Island, Lagos, Nigeria", 6.4281, 3.4219],
      ["los", "Murtala Muhammed International Airport (LOS), Lagos, Nigeria", 6.5774, 3.3212],
      ["ikeja", "Ikeja, Lagos, Nigeria", 6.6018, 3.3515],
      ["lekki", "Lekki Phase 1, Lagos, Nigeria", 6.4478, 3.4723],
      ["yaba", "Yaba, Lagos, Nigeria", 6.5158, 3.3873],
      ["marina_lagos", "Lagos Marina, Nigeria", 6.4500, 3.4000]
    ]
  },
  {
    id: "casablanca",
    name: "Casablanca",
    region: "Morocco",
    centerLatitude: 33.5731,
    centerLongitude: -7.5898,
    radiusKm: 70,
    locations: [
      ["casablanca_centre", "Casablanca City Center, Morocco", 33.5731, -7.5898],
      ["cmn", "Mohammed V International Airport (CMN), Casablanca, Morocco", 33.3675, -7.5898],
      ["maarif", "Maarif, Casablanca, Morocco", 33.5833, -7.6333],
      ["ain_diab", "Ain Diab, Casablanca, Morocco", 33.5942, -7.6901],
      ["casa_port", "Casa-Port Railway Station, Casablanca, Morocco", 33.5975, -7.6139],
      ["hassan_ii", "Hassan II Mosque, Casablanca, Morocco", 33.6084, -7.6326]
    ]
  },
  {
    id: "lisbon",
    name: "Lisbon",
    region: "Portugal",
    centerLatitude: 38.7223,
    centerLongitude: -9.1393,
    radiusKm: 70,
    locations: [
      ["baixa", "Baixa, Lisbon, Portugal", 38.7110, -9.1378],
      ["lis", "Humberto Delgado Airport (LIS), Lisbon, Portugal", 38.7742, -9.1342],
      ["chiado", "Chiado, Lisbon, Portugal", 38.7103, -9.1430],
      ["belem", "Belem, Lisbon, Portugal", 38.6968, -9.2065],
      ["parque_nacoes", "Parque das Nacoes, Lisbon, Portugal", 38.7680, -9.0950],
      ["cais_sodre", "Cais do Sodre, Lisbon, Portugal", 38.7069, -9.1456]
    ]
  },
  {
    id: "stockholm",
    name: "Stockholm",
    region: "Sweden",
    centerLatitude: 59.3293,
    centerLongitude: 18.0686,
    radiusKm: 70,
    locations: [
      ["stockholm_central", "Stockholm Central Station, Sweden", 59.3306, 18.0597],
      ["arn", "Stockholm Arlanda Airport (ARN), Sweden", 59.6519, 17.9186],
      ["gamla_stan", "Gamla Stan, Stockholm, Sweden", 59.3250, 18.0710],
      ["ostermalm", "Ostermalm, Stockholm, Sweden", 59.3368, 18.0902],
      ["sodermalm", "Sodermalm, Stockholm, Sweden", 59.3158, 18.0707],
      ["kista", "Kista, Stockholm, Sweden", 59.4032, 17.9448]
    ]
  },
  {
    id: "vienna",
    name: "Vienna",
    region: "Austria",
    centerLatitude: 48.2082,
    centerLongitude: 16.3738,
    radiusKm: 65,
    locations: [
      ["stephansplatz", "Stephansplatz, Vienna, Austria", 48.2085, 16.3731],
      ["vie", "Vienna International Airport (VIE), Austria", 48.1103, 16.5697],
      ["wien_hbf", "Wien Hauptbahnhof, Vienna, Austria", 48.1859, 16.3781],
      ["museumsquartier", "MuseumsQuartier, Vienna, Austria", 48.2032, 16.3591],
      ["prater", "Prater, Vienna, Austria", 48.2167, 16.3956],
      ["schonbrunn", "Schonbrunn Palace, Vienna, Austria", 48.1845, 16.3122]
    ]
  },
  {
    id: "zurich",
    name: "Zurich",
    region: "Switzerland",
    centerLatitude: 47.3769,
    centerLongitude: 8.5417,
    radiusKm: 60,
    locations: [
      ["zurich_hb", "Zurich Hauptbahnhof, Switzerland", 47.3780, 8.5402],
      ["zrh", "Zurich Airport (ZRH), Switzerland", 47.4582, 8.5555],
      ["bahnhofstrasse", "Bahnhofstrasse, Zurich, Switzerland", 47.3697, 8.5392],
      ["zurich_west", "Zurich West, Switzerland", 47.3875, 8.5176],
      ["seefeld", "Seefeld, Zurich, Switzerland", 47.3564, 8.5545],
      ["eth_zurich", "ETH Zurich, Switzerland", 47.3763, 8.5480]
    ]
  }
];

const enabledServiceCityIds = [
  "los_angeles",
  "san_diego",
  "san_jose",
  "sf_bay",
  "new_york",
  "buffalo",
  "rochester_ny",
  "chicago",
  "aurora_il",
  "naperville_il",
  "washington_dc",
  "arlington_va",
  "seattle",
  "dallas",
  "houston",
  "san_antonio",
  "detroit",
  "grand_rapids",
  "warren_mi",
  "ann_arbor"
];

const addedServiceCities = [
  {
    id: "aurora_il",
    name: "Aurora",
    region: "IL",
    centerLatitude: 41.7606,
    centerLongitude: -88.3201,
    radiusKm: 45,
    locations: [
      ["downtown_aurora_il", "Downtown Aurora, IL", 41.7606, -88.3201],
      ["aurora_transportation_center", "Aurora Transportation Center, Aurora, IL", 41.7545, -88.3157],
      ["paramount_theatre_aurora", "Paramount Theatre, Aurora, IL", 41.7583, -88.3148],
      ["fox_valley_mall", "Fox Valley Mall, Aurora, IL", 41.7585, -88.2122],
      ["aurora_university", "Aurora University, Aurora, IL", 41.7530, -88.3490],
      ["waubonsee_aurora", "Waubonsee Community College Aurora Downtown, IL", 41.7565, -88.3159],
      ["rivers_edge_park_aurora", "RiverEdge Park, Aurora, IL", 41.7588, -88.3116]
    ]
  },
  {
    id: "naperville_il",
    name: "Naperville",
    region: "IL",
    centerLatitude: 41.7508,
    centerLongitude: -88.1535,
    radiusKm: 45,
    locations: [
      ["downtown_naperville", "Downtown Naperville, IL", 41.7750, -88.1486],
      ["naperville_station", "Naperville Metra Station, Naperville, IL", 41.7791, -88.1459],
      ["north_central_college", "North Central College, Naperville, IL", 41.7754, -88.1420],
      ["riverwalk_naperville", "Naperville Riverwalk, Naperville, IL", 41.7726, -88.1506],
      ["edward_hospital", "Edward Hospital, Naperville, IL", 41.7618, -88.1535],
      ["naper_settlement", "Naper Settlement, Naperville, IL", 41.7718, -88.1535],
      ["95th_street_library", "95th Street Library, Naperville, IL", 41.7086, -88.1972]
    ]
  },
  {
    id: "arlington_va",
    name: "Arlington",
    region: "DC",
    centerLatitude: 38.8797,
    centerLongitude: -77.1068,
    radiusKm: 40,
    locations: [
      ["downtown_arlington_va", "Downtown Arlington, VA", 38.8797, -77.1068],
      ["rosslyn", "Rosslyn, Arlington, VA", 38.8967, -77.0728],
      ["crystal_city", "Crystal City, Arlington, VA", 38.8576, -77.0502],
      ["pentagon_city", "Pentagon City, Arlington, VA", 38.8629, -77.0595],
      ["ballston", "Ballston, Arlington, VA", 38.8829, -77.1116],
      ["national_airport", "Ronald Reagan Washington National Airport (DCA), VA", 38.8512, -77.0402],
      ["arlington_courthouse", "Arlington Courthouse, Arlington, VA", 38.8904, -77.0830]
    ]
  },
  {
    id: "alexandria_va",
    name: "Alexandria",
    region: "DC",
    centerLatitude: 38.8048,
    centerLongitude: -77.0469,
    radiusKm: 40,
    locations: [
      ["old_town_alexandria", "Old Town Alexandria, VA", 38.8048, -77.0469],
      ["king_street_station", "King Street-Old Town Station, Alexandria, VA", 38.8065, -77.0611],
      ["alexandria_waterfront", "Alexandria Waterfront, Alexandria, VA", 38.8033, -77.0392],
      ["carlyle_alexandria", "Carlyle, Alexandria, VA", 38.8059, -77.0631],
      ["del_ray", "Del Ray, Alexandria, VA", 38.8296, -77.0608],
      ["inova_alexandria", "Inova Alexandria Hospital, Alexandria, VA", 38.8248, -77.1056],
      ["george_washington_masonic", "George Washington Masonic National Memorial, Alexandria, VA", 38.8075, -77.0659]
    ]
  },
  {
    id: "ann_arbor",
    name: "Ann Arbor",
    region: "MI",
    centerLatitude: 42.2808,
    centerLongitude: -83.7430,
    radiusKm: 45,
    locations: [
      ["downtown_ann_arbor", "Downtown Ann Arbor, MI", 42.2808, -83.7430],
      ["university_michigan", "University of Michigan, Ann Arbor, MI", 42.2780, -83.7382],
      ["michigan_stadium", "Michigan Stadium, Ann Arbor, MI", 42.2658, -83.7487],
      ["briarwood_mall", "Briarwood Mall, Ann Arbor, MI", 42.2417, -83.7462],
      ["ann_arbor_station", "Ann Arbor Amtrak Station, Ann Arbor, MI", 42.2862, -83.7445],
      ["umich_hospital", "University of Michigan Hospital, Ann Arbor, MI", 42.2835, -83.7274],
      ["kerrytown", "Kerrytown, Ann Arbor, MI", 42.2834, -83.7460]
    ]
  }
];

const serviceCities = [...rawServiceCities, ...addedServiceCities]
  .filter((city) => enabledServiceCityIds.includes(city.id))
  .sort((a, b) => enabledServiceCityIds.indexOf(a.id) - enabledServiceCityIds.indexOf(b.id));

const locations = Object.fromEntries(
  serviceCities.flatMap((city) =>
    city.locations.map(([key, address, latitude, longitude]) => [
      key,
      { id: key, cityId: city.id, address, latitude, longitude }
    ])
  )
);

function user(id, name, email, phone, role) {
  const createdAt = now();
  return {
    id,
    name,
    email,
    phone,
    passwordHash: hashPassword(sharedPassword),
    role,
    profileImageUrl: "",
    isVerified: true,
    createdAt,
    updatedAt: createdAt
  };
}

function driverProfile({
  id,
  userId,
  licenseNumber,
  vehicleMake,
  vehicleModel,
  vehicleYear,
  licensePlate,
  vehicleColor,
  verificationStatus = "approved",
  driverStatus = "online",
  currentLatitude,
  currentLongitude,
  averageRating = 4.9,
  totalTrips = 0,
  createdAt
}) {
  return {
    id,
    userId,
    licenseNumber,
    vehicleMake,
    vehicleModel,
    vehicleYear,
    licensePlate,
    vehicleColor,
    verificationStatus,
    driverStatus,
    currentLatitude,
    currentLongitude,
    averageRating,
    totalTrips,
    createdAt,
    updatedAt: createdAt
  };
}

function isoDaysAgo(daysAgo, hour = 9, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function fareForRide(distanceKm, durationMinutes, tierMultiplier = 1, surgeMultiplier = 1, discountAmount = 0) {
  const baseFare = 4.5;
  const distanceFare = Number((Math.max(distanceKm, 0.6) * 1.85 * tierMultiplier).toFixed(2));
  const timeFare = Number((Math.max(durationMinutes, 5) * 0.32 * tierMultiplier).toFixed(2));
  const serviceFee = Number((1.75 * tierMultiplier).toFixed(2));
  const subtotalBeforeDiscount = Number(((baseFare + distanceFare + timeFare + serviceFee) * surgeMultiplier).toFixed(2));
  const estimatedTotal = Number(Math.max(8, subtotalBeforeDiscount - discountAmount).toFixed(2));
  return {
    baseFare,
    distanceFare,
    timeFare,
    serviceFee,
    surgeMultiplier,
    subtotalBeforeDiscount,
    discountAmount,
    estimatedTotal,
    currencyCode: "USD",
    currencySymbol: "$",
    currencyDecimals: 2
  };
}

function timelineForRide(status, createdAt, { driverCancelled = false } = {}) {
  const at = (minutes) => new Date(Date.parse(createdAt) + minutes * 60 * 1000).toISOString();
  const timeline = [
    { status: "requested", label: "Ride requested", at: at(0) },
    { status: "searching", label: "Searching for nearby approved drivers", at: at(1) }
  ];
  if (status === "cancelled") {
    timeline.push({ status: "cancelled", label: driverCancelled ? "Driver cancelled" : "Rider cancelled", at: at(4) });
    return timeline;
  }
  timeline.push(
    { status: "accepted", label: "Driver accepted", at: at(3) },
    { status: "driver_arriving", label: "Driver en route", at: at(4) },
    { status: "arrived", label: "Driver arrived", at: at(10) },
    { status: "in_progress", label: "Trip started", at: at(12) },
    { status: "completed", label: "Trip completed", at: at(26) }
  );
  return timeline;
}

function buildThreeMonthRiderExperience({ rider, drivers, driverProfiles }) {
  const driverById = new Map(drivers.map((item) => [item.id, item]));
  const sfDriverProfiles = driverProfiles.filter((profile) =>
    ["drv_profile_primary", "drv_profile_second", "drv_profile_sf"].includes(profile.id)
  );
  const favoritePlaces = [
    { id: "place_rider_home", label: "Home", address: "Downtown Palo Alto, CA", latitude: 37.4419, longitude: -122.1430, lastUsedAt: isoDaysAgo(2, 18), usageCount: 18, pinned: true },
    { id: "place_rider_work", label: "Work", address: "Meta MPK 23, 300 Constitution Drive, Menlo Park, CA", latitude: 37.4803, longitude: -122.1669, lastUsedAt: isoDaysAgo(1, 9), usageCount: 21, pinned: true },
    { id: "place_rider_school", label: "School", address: locations.stanford.address, latitude: locations.stanford.latitude, longitude: locations.stanford.longitude, lastUsedAt: isoDaysAgo(9, 14), usageCount: 6, pinned: false },
    { id: "place_rider_gym", label: "Gym", address: "Equinox Palo Alto, 440 Portage Avenue, Palo Alto, CA", latitude: 37.4266, longitude: -122.1450, lastUsedAt: isoDaysAgo(5, 20), usageCount: 8, pinned: false },
    { id: "place_rider_airport", label: "Airport", address: locations.sfo.address, latitude: locations.sfo.latitude, longitude: locations.sfo.longitude, lastUsedAt: isoDaysAgo(14, 6), usageCount: 4, pinned: true },
    { id: "place_rider_restaurant", label: "Favorite restaurant", address: "Evvia Estiatorio, 420 Emerson Street, Palo Alto, CA", latitude: 37.4441, longitude: -122.1631, lastUsedAt: isoDaysAgo(3, 22), usageCount: 7, pinned: false },
    { id: "place_rider_mall", label: "Mall", address: "Stanford Shopping Center, Palo Alto, CA", latitude: 37.4432, longitude: -122.1716, lastUsedAt: isoDaysAgo(6, 16), usageCount: 5, pinned: false },
    { id: "place_rider_friend", label: "Friend's place", address: "Castro Street, Mountain View, CA", latitude: 37.3947, longitude: -122.0781, lastUsedAt: isoDaysAgo(11, 21), usageCount: 4, pinned: false }
  ];
  const byLabel = Object.fromEntries(favoritePlaces.map((place) => [place.label, place]));
  const scenarios = [
    ["home_to_work", 3, 8, byLabel.Home, byLabel.Work, "standard", "COMMUTE15", 5, "Smooth commute."],
    ["work_to_home", 5, 18, byLabel.Work, byLabel.Home, "plus", "", 5, "Driver knew the best route."],
    ["restaurant_home_night", 8, 23, byLabel["Favorite restaurant"], byLabel.Home, "priority", "NIGHT12", 4, "Late-night pickup felt safe."],
    ["school_mall", 10, 15, byLabel.School, byLabel.Mall, "green", "", 5, "Clean EV."],
    ["airport_dropoff", 14, 6, byLabel.Home, byLabel.Airport, "xl", "AIRPORT10", 5, "Plenty of room for bags."],
    ["airport_return", 17, 20, byLabel.Airport, byLabel.Home, "plus", "", 4, "Pickup area was busy."],
    ["gym_home", 20, 21, byLabel.Gym, byLabel.Home, "standard", "", 5, "Quick short trip."],
    ["friend_home", 22, 22, byLabel["Friend's place"], byLabel.Home, "standard", "", 5, "On time."],
    ["work_mall_surge", 25, 17, byLabel.Work, byLabel.Mall, "priority", "", 4, "Price was higher during rush hour.", { surge: 1.22, support: "price issue" }],
    ["home_school", 28, 13, byLabel.Home, byLabel.School, "green", "", 5, "Good route."],
    ["cancel_wrong_stop", 30, 10, byLabel.Home, byLabel.Gym, "standard", "", null, "", { status: "cancelled", cancelledBy: "rider" }],
    ["driver_cancelled", 33, 19, byLabel.Work, byLabel.Home, "plus", "", null, "", { status: "cancelled", cancelledBy: "driver" }],
    ["payment_retry", 36, 9, byLabel.Home, byLabel.Work, "standard", "COMMUTE15", 5, "Payment retry worked.", { paymentRetry: true }],
    ["lost_item", 39, 18, byLabel.Mall, byLabel.Home, "standard", "", 3, "Left a water bottle.", { support: "lost item" }],
    ["safety_feedback", 42, 23, byLabel["Favorite restaurant"], byLabel.Home, "priority", "NIGHT12", 2, "Driver missed a turn repeatedly.", { support: "safety concern" }],
    ["home_work_2", 45, 8, byLabel.Home, byLabel.Work, "standard", "COMMUTE15", 5, "Reliable commute."],
    ["work_home_2", 47, 18, byLabel.Work, byLabel.Home, "standard", "", null, "", { unrated: true }],
    ["short_restaurant", 50, 12, byLabel.Home, byLabel["Favorite restaurant"], "standard", "", 5, "Very short ride."],
    ["long_sf", 53, 7, byLabel.Home, { address: locations.downtown_sf.address, latitude: locations.downtown_sf.latitude, longitude: locations.downtown_sf.longitude }, "xl", "", 4, "Long but comfortable."],
    ["mall_friend", 56, 16, byLabel.Mall, byLabel["Friend's place"], "plus", "", 5, "Good car."],
    ["weekend_coupon", 59, 11, byLabel.Home, byLabel.Mall, "green", "WEEKEND8", 5, "Weekend coupon applied."],
    ["gym_work", 62, 8, byLabel.Gym, byLabel.Work, "standard", "", 4, "Driver was polite."],
    ["home_airport_cancel", 65, 5, byLabel.Home, byLabel.Airport, "xl", "AIRPORT10", null, "", { status: "cancelled", cancelledBy: "rider" }],
    ["restaurant_friend", 68, 22, byLabel["Favorite restaurant"], byLabel["Friend's place"], "priority", "NIGHT12", 5, "Safe night ride."],
    ["work_school", 71, 13, byLabel.Work, byLabel.School, "plus", "", 5, "Quiet ride."],
    ["home_work_3", 74, 8, byLabel.Home, byLabel.Work, "standard", "COMMUTE15", 5, "On time."],
    ["work_home_3", 76, 18, byLabel.Work, byLabel.Home, "standard", "", 4, "Traffic was heavy."],
    ["airport_long", 79, 6, byLabel.Home, byLabel.Airport, "xl", "AIRPORT10", 5, "Airport pickup instructions were clear."],
    ["mall_home", 82, 17, byLabel.Mall, byLabel.Home, "standard", "", null, "", { unrated: true }],
    ["school_home", 85, 15, byLabel.School, byLabel.Home, "green", "", 5, "Good electric car."],
    ["friend_gym", 88, 10, byLabel["Friend's place"], byLabel.Gym, "standard", "", 4, "Simple trip."],
    ["home_restaurant", 90, 19, byLabel.Home, byLabel["Favorite restaurant"], "plus", "", 5, "Dinner pickup."],
    ["privacy_policy_trip", 12, 8, byLabel.Home, byLabel.Work, "standard", "", 5, "Routine ride."],
    ["invoice_trip", 18, 8, byLabel.Home, byLabel.Work, "standard", "COMMUTE15", 5, "Invoice needed.", { invoice: true }],
    ["refund_trip", 31, 18, byLabel.Work, byLabel.Home, "standard", "", 3, "Fare adjustment requested.", { refund: true, support: "payment issue" }],
    ["late_driver", 7, 18, byLabel.Work, byLabel.Home, "priority", "", 3, "Driver arrived late.", { support: "driver issue" }]
  ];

  const tierMultipliers = { standard: 1, plus: 1.28, priority: 1.45, green: 1.12, xl: 1.65 };
  const promoDiscounts = { COMMUTE15: 2.25, AIRPORT10: 5.5, NIGHT12: 3.25, WEEKEND8: 2.0 };
  const tierTitles = { standard: "Standard", plus: "Plus", priority: "Priority pickup", green: "Green", xl: "XL" };
  const commentsByScore = {
    2: "Reported issue to support.",
    3: "Trip completed but needs improvement.",
    4: "Good ride overall.",
    5: "Great ride."
  };

  const rides = [];
  const payments = [];
  const ratings = [];
  const supportTickets = [];
  const notifications = [];
  const invoices = [];
  const refunds = [];

  scenarios.forEach((scenario, index) => {
    const [key, daysAgo, hour, pickup, destination, tier, promoCode, score, comment, options = {}] = scenario;
    const createdAt = isoDaysAgo(daysAgo, hour, (index * 7) % 55);
    const profile = sfDriverProfiles[index % sfDriverProfiles.length];
    const driver = driverById.get(profile.userId);
    const distance = calculateHaversineDistance(pickup, destination);
    const duration = estimateTripDuration(distance, hour >= 17 && hour <= 19 ? 18 : 24);
    const discount = promoCode ? promoDiscounts[promoCode] || 1.5 : 0;
    const fareBreakdown = {
      ...fareForRide(distance, duration, tierMultipliers[tier] || 1, options.surge || 1, discount),
      promoCode,
      promoTitle: promoCode ? `${promoCode} ride credit` : "",
      rideTier: tier,
      rideTierTitle: tierTitles[tier] || "Standard"
    };
    const status = options.status || "completed";
    const ride = {
      id: `ride_three_month_${key}`,
      riderId: rider.id,
      driverId: status === "cancelled" && options.cancelledBy === "driver" ? profile.userId : profile.userId,
      pickupAddress: pickup.address,
      pickupLatitude: pickup.latitude,
      pickupLongitude: pickup.longitude,
      destinationAddress: destination.address,
      destinationLatitude: destination.latitude,
      destinationLongitude: destination.longitude,
      status,
      rideTier: tier,
      rideTierTitle: tierTitles[tier] || "Standard",
      estimatedDistance: distance,
      estimatedDuration: duration,
      estimatedFare: fareBreakdown.estimatedTotal,
      currencyCode: "USD",
      currencySymbol: "$",
      currencyDecimals: 2,
      finalDistance: status === "completed" ? distance : null,
      finalDuration: status === "completed" ? duration : null,
      finalFare: status === "completed" ? fareBreakdown.estimatedTotal : null,
      fareBreakdown,
      promoCode,
      discountAmount: discount,
      paymentMethod: index % 5 === 0 ? "pm_rider_paypal" : index % 4 === 0 ? "pm_rider_wallet" : "pm_rider_visa",
      paymentStatus: status === "completed" ? "paid" : "cancelled",
      cancellationReason: status === "cancelled" ? (options.cancelledBy === "driver" ? "Driver cancelled before pickup" : "Rider cancelled before pickup") : "",
      rejectedDriverIds: [],
      scheduledFor: "",
      timeline: timelineForRide(status, createdAt, { driverCancelled: options.cancelledBy === "driver" }),
      createdAt,
      acceptedAt: status === "completed" ? new Date(Date.parse(createdAt) + 3 * 60 * 1000).toISOString() : null,
      startedAt: status === "completed" ? new Date(Date.parse(createdAt) + 12 * 60 * 1000).toISOString() : null,
      completedAt: status === "completed" ? new Date(Date.parse(createdAt) + duration * 60 * 1000).toISOString() : null,
      cancelledAt: status === "cancelled" ? new Date(Date.parse(createdAt) + 4 * 60 * 1000).toISOString() : null,
      invoiceStatus: options.invoice ? "issued" : index % 7 === 0 ? "eligible" : "",
      contactedSupport: Boolean(options.support),
      abnormalFlag: Boolean(options.support || options.paymentRetry || options.surge)
    };
    rides.push(ride);

    if (status === "completed") {
      if (options.paymentRetry) {
        payments.push({
          id: `pay_three_month_${key}_failed`,
          rideId: ride.id,
          riderId: rider.id,
          driverId: profile.userId,
          amount: fareBreakdown.estimatedTotal,
          platformFee: 0,
          driverEarnings: 0,
          currencyCode: "USD",
          currencySymbol: "$",
          currencyDecimals: 2,
          paymentMethod: ride.paymentMethod,
          providerPaymentId: `processor_failed_${key}`,
          status: "failed",
          failureReason: "Issuer declined first attempt",
          createdAt: new Date(Date.parse(createdAt) + 27 * 60 * 1000).toISOString()
        });
      }
      const platformFee = Number((fareBreakdown.estimatedTotal * 0.18).toFixed(2));
      payments.push({
        id: `pay_three_month_${key}`,
        rideId: ride.id,
        riderId: rider.id,
        driverId: profile.userId,
        amount: fareBreakdown.estimatedTotal,
        platformFee,
        driverEarnings: Number((fareBreakdown.estimatedTotal - platformFee).toFixed(2)),
        currencyCode: "USD",
        currencySymbol: "$",
        currencyDecimals: 2,
        paymentMethod: ride.paymentMethod,
        providerPaymentId: `processor_${key}`,
        status: "paid",
        createdAt: new Date(Date.parse(createdAt) + 28 * 60 * 1000).toISOString()
      });
      if (score && !options.unrated) {
        ratings.push({
          id: `rating_three_month_${key}`,
          rideId: ride.id,
          fromUserId: rider.id,
          toUserId: profile.userId,
          score,
          comment: comment || commentsByScore[score],
          createdAt: new Date(Date.parse(createdAt) + 45 * 60 * 1000).toISOString()
        });
      }
      if (options.invoice) {
        invoices.push({
          id: `invoice_three_month_${key}`,
          rideId: ride.id,
          userId: rider.id,
          title: "Riley Rider",
          email: rider.email,
          status: "issued",
          amount: fareBreakdown.estimatedTotal,
          createdAt: new Date(Date.parse(createdAt) + 60 * 60 * 1000).toISOString()
        });
      }
      if (options.refund) {
        refunds.push({
          id: `refund_three_month_${key}`,
          rideId: ride.id,
          userId: rider.id,
          amount: 4.25,
          reason: "Fare adjustment after support review",
          status: "approved",
          createdAt: new Date(Date.parse(createdAt) + 2 * 60 * 60 * 1000).toISOString()
        });
      }
    }

    if (options.support) {
      supportTickets.push({
        id: `ticket_three_month_${key}`,
        userId: rider.id,
        rideId: ride.id,
        category: options.support,
        message: `${options.support}: ${comment || "Please review this ride."}`,
        status: options.support === "safety concern" ? "resolved" : "closed",
        createdAt: new Date(Date.parse(createdAt) + 50 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.parse(createdAt) + 4 * 60 * 60 * 1000).toISOString()
      });
    }

  });
  const userCoupons = [];

  return {
    rides,
    payments,
    ratings,
    supportTickets,
    notifications,
    invoices,
    refunds,
    userCoupons,
    savedPlaces: favoritePlaces.map((place) => ({
      id: place.id,
      userId: rider.id,
      label: place.label,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      lastUsedAt: place.lastUsedAt,
      usageCount: place.usageCount,
      pinned: place.pinned,
      createdAt: isoDaysAgo(89, 9),
      updatedAt: place.lastUsedAt
    }))
  };
}

function createSeedData() {
  const createdAt = now();
  const rider = user("usr_rider_primary", "Riley Rider", "rider@example.com", "+1555010101", "rider");
  const rider2 = user("usr_rider_second", "Jordan Lee", "rider2@example.com", "+1555010102", "rider");
  const rider3 = user("usr_rider_third", "Ava Chen", "rider3@example.com", "+1555010301", "rider");
  const driver = user("usr_driver_primary", "Maya Rodriguez", "driver@example.com", "+13235550147", "driver");
  const driver2 = user("usr_driver_second", "Owen Patel", "driver2@example.com", "+12135550182", "driver");
  const driver3 = user("usr_driver_third", "Elena Park", "driver3@example.com", "+1555031001", "driver");
  const pending = user("usr_driver_pending", "Nora Pending", "pending-driver@example.com", "+1555020203", "driver");
  const admin = user("usr_admin_primary", "Ops Admin", "admin@example.com", "+1555090909", "admin");
  const networkDrivers = [
    user("usr_driver_nyc", "Avery NYC", "nyc-driver@example.com", "+1555030001", "driver"),
    user("usr_driver_chicago", "Sam Chicago", "chicago-driver@example.com", "+1555030002", "driver"),
    user("usr_driver_sf", "Casey Bay", "sf-driver@example.com", "+1555030003", "driver"),
    user("usr_driver_dc", "Morgan DC", "dc-driver@example.com", "+1555030004", "driver"),
    user("usr_driver_dallas", "Quinn Dallas", "dallas-driver@example.com", "+1555030007", "driver")
  ];
  const manualNetworkDriverCityIds = new Set([
    "los_angeles",
    "new_york",
    "chicago",
    "sf_bay",
    "washington_dc",
    "dallas"
  ]);
  const globalDriverCities = serviceCities.filter((city) => !manualNetworkDriverCityIds.has(city.id));
  const globalNetworkDrivers = globalDriverCities.map((city, index) =>
    user(
      `usr_driver_${city.id}`,
      `${city.name} Driver`,
      `${city.id.replaceAll("_", "-")}-driver@example.com`,
      `+155504${String(index + 1).padStart(4, "0")}`,
      "driver"
    )
  );

  const completedRide = {
    id: "ride_seed_completed",
    riderId: rider2.id,
    driverId: driver2.id,
    pickupAddress: locations.times_square.address,
    pickupLatitude: locations.times_square.latitude,
    pickupLongitude: locations.times_square.longitude,
    destinationAddress: locations.nyu.address,
    destinationLatitude: locations.nyu.latitude,
    destinationLongitude: locations.nyu.longitude,
    status: "completed",
    estimatedDistance: 3.3,
    estimatedDuration: 15,
    estimatedFare: 17.36,
    currencyCode: "USD",
    currencySymbol: "$",
    currencyDecimals: 2,
    finalDistance: 3.3,
    finalDuration: 15,
    finalFare: 17.36,
    fareBreakdown: { baseFare: 4.5, distanceFare: 6.11, timeFare: 4.8, serviceFee: 1.75, surgeMultiplier: 1, estimatedTotal: 17.36 },
    paymentMethod: "card_on_file",
    paymentStatus: "paid",
    cancellationReason: "",
    rejectedDriverIds: [],
    timeline: [
      { status: "requested", label: "Ride requested", at: createdAt },
      { status: "searching", label: "Searching for a driver", at: createdAt },
      { status: "accepted", label: "Driver accepted", at: createdAt },
      { status: "driver_arriving", label: "Driver en route", at: createdAt },
      { status: "arrived", label: "Driver arrived", at: createdAt },
      { status: "in_progress", label: "Trip started", at: createdAt },
      { status: "completed", label: "Trip completed", at: createdAt }
    ],
    createdAt,
    acceptedAt: createdAt,
    startedAt: createdAt,
    completedAt: createdAt,
    cancelledAt: null
  };

  const driverProfiles = [
      driverProfile({
        id: "drv_profile_primary",
        userId: driver.id,
        licenseNumber: "NY-DL-100492",
        vehicleMake: "Tesla",
        vehicleModel: "Model Y",
        vehicleYear: 2023,
        licensePlate: "8XJR214",
        vehicleColor: "Pearl White",
        verificationStatus: "approved",
        driverStatus: "online",
        currentLatitude: 34.0646,
        currentLongitude: -118.2379,
        averageRating: 4.92,
        totalTrips: 128,
        createdAt
      }),
      driverProfile({
        id: "drv_profile_second",
        userId: driver2.id,
        licenseNumber: "NY-DL-204882",
        vehicleMake: "Hyundai",
        vehicleModel: "Ioniq 5",
        vehicleYear: 2023,
        licensePlate: "NYC-2048",
        vehicleColor: "Midnight Black",
        verificationStatus: "approved",
        driverStatus: "online",
        currentLatitude: 40.7549,
        currentLongitude: -73.9840,
        averageRating: 4.87,
        totalTrips: 94,
        createdAt
      }),
      driverProfile({
        id: "drv_profile_pending",
        userId: pending.id,
        licenseNumber: "",
        vehicleMake: "Tesla",
        vehicleModel: "Model 3",
        vehicleYear: 2023,
        licensePlate: "EV-2094",
        vehicleColor: "Blue",
        verificationStatus: "pending",
        driverStatus: "offline",
        currentLatitude: 34.0207,
        currentLongitude: -118.2854,
        averageRating: 5,
        totalTrips: 0,
        createdAt
      }),
      driverProfile({
        id: "drv_profile_third",
        userId: driver3.id,
        licenseNumber: "WA-DL-778210",
        vehicleMake: "Rivian",
        vehicleModel: "R1S",
        vehicleYear: 2024,
        licensePlate: "SEA-7782",
        vehicleColor: "Forest Green",
        verificationStatus: "approved",
        driverStatus: "online",
        currentLatitude: 47.6110,
        currentLongitude: -122.3370,
        averageRating: 4.98,
        totalTrips: 243,
        createdAt
      }),
      driverProfile({ id: "drv_profile_nyc", userId: "usr_driver_nyc", licenseNumber: "NY-DL-304812", vehicleMake: "Hyundai", vehicleModel: "Ioniq 5", vehicleYear: 2023, licensePlate: "NYC-8104", vehicleColor: "White", currentLatitude: 40.7549, currentLongitude: -73.9840, averageRating: 4.96, totalTrips: 212, createdAt }),
      driverProfile({ id: "drv_profile_chicago", userId: "usr_driver_chicago", licenseNumber: "IL-DL-540122", vehicleMake: "Toyota", vehicleModel: "RAV4", vehicleYear: 2022, licensePlate: "CHI-5127", vehicleColor: "Blue", currentLatitude: 41.8836, currentLongitude: -87.6320, averageRating: 4.89, totalTrips: 166, createdAt }),
      driverProfile({ id: "drv_profile_sf", userId: "usr_driver_sf", licenseNumber: "CA-DL-782014", vehicleMake: "Tesla", vehicleModel: "Model Y", vehicleYear: 2023, licensePlate: "BAY-6049", vehicleColor: "Red", currentLatitude: 37.7890, currentLongitude: -122.4010, averageRating: 4.94, totalTrips: 198, createdAt }),
      driverProfile({ id: "drv_profile_dc", userId: "usr_driver_dc", licenseNumber: "DC-DL-140822", vehicleMake: "Honda", vehicleModel: "CR-V", vehicleYear: 2021, licensePlate: "DC-2481", vehicleColor: "Gray", currentLatitude: 38.8974, currentLongitude: -77.0320, averageRating: 4.91, totalTrips: 142, createdAt }),
      driverProfile({ id: "drv_profile_dallas", userId: "usr_driver_dallas", licenseNumber: "TX-DL-391804", vehicleMake: "Ford", vehicleModel: "Escape", vehicleYear: 2022, licensePlate: "DFW-6620", vehicleColor: "Silver", currentLatitude: 32.7810, currentLongitude: -96.7990, averageRating: 4.86, totalTrips: 119, createdAt }),
      ...globalDriverCities.map((city, index) =>
        driverProfile({
          id: `drv_profile_${city.id}`,
          userId: `usr_driver_${city.id}`,
          licenseNumber: `GL-${String(index + 1).padStart(5, "0")}`,
          vehicleMake: ["Toyota", "Hyundai", "Tesla", "Honda", "Kia", "Nissan"][index % 6],
          vehicleModel: ["Camry", "Ioniq 5", "Model Y", "CR-V", "Telluride", "Altima"][index % 6],
          vehicleYear: 2021 + (index % 3),
          licensePlate: city.id.slice(0, 3).toUpperCase().padEnd(3, "X") + `-${String(4100 + index)}`,
          vehicleColor: ["White", "Black", "Silver", "Blue", "Gray"][index % 5],
          currentLatitude: Number((city.centerLatitude + 0.012).toFixed(6)),
          currentLongitude: Number((city.centerLongitude - 0.012).toFixed(6)),
          averageRating: Number((4.85 + (index % 10) * 0.01).toFixed(2)),
          totalTrips: 80 + index * 7,
          createdAt
        })
      )
    ];
  const riderExperience = buildThreeMonthRiderExperience({
    rider,
    drivers: [driver, driver2, driver3, ...networkDrivers, ...globalNetworkDrivers],
    driverProfiles
  });
  const extraSavedPlaces = [
    { id: "place_rider_second_home", userId: rider2.id, label: "Home", address: "Upper West Side, New York, NY", latitude: 40.7870, longitude: -73.9754, usageCount: 12, pinned: true, createdAt: isoDaysAgo(28, 8), updatedAt: isoDaysAgo(1, 18) },
    { id: "place_rider_second_work", userId: rider2.id, label: "Work", address: locations.times_square.address, latitude: locations.times_square.latitude, longitude: locations.times_square.longitude, usageCount: 16, pinned: true, createdAt: isoDaysAgo(28, 8), updatedAt: isoDaysAgo(2, 8) },
    { id: "place_rider_second_grocery", userId: rider2.id, label: "Grocery", address: "Chelsea Market, New York, NY", latitude: 40.7424, longitude: -74.0060, usageCount: 5, pinned: false, createdAt: isoDaysAgo(18, 12), updatedAt: isoDaysAgo(3, 17) },
    { id: "place_rider_third_home", userId: rider3.id, label: "Home", address: "Capitol Hill, Seattle, WA", latitude: 47.6253, longitude: -122.3222, usageCount: 10, pinned: true, createdAt: isoDaysAgo(21, 8), updatedAt: isoDaysAgo(1, 19) },
    { id: "place_rider_third_work", userId: rider3.id, label: "Work", address: locations.downtown_seattle.address, latitude: locations.downtown_seattle.latitude, longitude: locations.downtown_seattle.longitude, usageCount: 14, pinned: true, createdAt: isoDaysAgo(21, 8), updatedAt: isoDaysAgo(2, 9) },
    { id: "place_rider_third_pharmacy", userId: rider3.id, label: "Pharmacy", address: "CVS Pharmacy, Seattle, WA", latitude: 47.6097, longitude: -122.3331, usageCount: 3, pinned: false, createdAt: isoDaysAgo(14, 12), updatedAt: isoDaysAgo(4, 16) }
  ];
  const extraUserCoupons = [
    { id: "coupon_rider_second_commute", userId: rider2.id, code: "COMMUTE15", title: "15% off commute rides", percentOff: 15, amountOff: 0, status: "available", createdAt, expiresAt: new Date(Date.parse(createdAt) + 21 * 24 * 60 * 60 * 1000).toISOString() },
    { id: "coupon_rider_third_airport", userId: rider3.id, code: "AIRPORT10", title: "10% off airport rides", percentOff: 10, amountOff: 0, status: "available", createdAt, expiresAt: new Date(Date.parse(createdAt) + 30 * 24 * 60 * 60 * 1000).toISOString() }
  ];

  return {
    meta: {
      appName: "opendriver",
      schemaVersion: 16,
      city: { name: "Global Service Network", centerLatitude: 20.0, centerLongitude: 0.0 },
      serviceCityIds: serviceCities.map((city) => city.id),
      seededAt: createdAt
    },
    users: [rider, rider2, rider3, driver, driver2, driver3, pending, admin, ...networkDrivers, ...globalNetworkDrivers],
    driverProfiles,
    rides: [...riderExperience.rides, completedRide],
    paymentMethods: [
      { id: "pm_rider_visa", userId: rider.id, type: "card", brand: "Visa", label: "Visa ending 4242", last4: "4242", isDefault: true, status: "active", createdAt },
      { id: "pm_rider_wallet", userId: rider.id, type: "wallet", brand: "Ride Cash", label: "Ride Cash balance", last4: "", isDefault: false, status: "active", createdAt },
      { id: "pm_rider_paypal", userId: rider.id, type: "paypal", brand: "PayPal", label: "PayPal rider@example.com", last4: "", isDefault: false, status: "active", createdAt },
      { id: "pm_rider_backup", userId: rider.id, type: "card", brand: "Mastercard", label: "Mastercard ending 9001", last4: "9001", isDefault: false, status: "active", createdAt },
      { id: "pm_rider_second_paypal", userId: rider2.id, type: "paypal", brand: "PayPal", label: "PayPal rider2@example.com", last4: "", isDefault: true, status: "active", createdAt },
      { id: "pm_rider_second_visa", userId: rider2.id, type: "card", brand: "Visa", label: "Visa ending 3188", last4: "3188", isDefault: false, status: "active", createdAt },
      { id: "pm_rider_third_amex", userId: rider3.id, type: "card", brand: "Amex", label: "Amex ending 1005", last4: "1005", isDefault: true, status: "active", createdAt },
      { id: "pm_rider_third_wallet", userId: rider3.id, type: "wallet", brand: "Ride Cash", label: "Ride Cash balance", last4: "", isDefault: false, status: "active", createdAt },
      { id: "pm_driver_primary", userId: driver.id, type: "card", brand: "Visa", label: "Visa ending 1881", last4: "1881", isDefault: true, status: "active", createdAt }
    ],
    savedPlaces: [...riderExperience.savedPlaces, ...extraSavedPlaces],
    promotions: [
      { code: "WELCOME20", title: "20% off your next ride", percentOff: 20, active: true, createdAt },
      { code: "AIRPORT10", title: "10% off airport rides", percentOff: 10, active: true, createdAt },
      { code: "COMMUTE15", title: "15% off commute rides", percentOff: 15, active: true, createdAt },
      { code: "NIGHT12", title: "12% off late-night rides", percentOff: 12, active: true, createdAt },
      { code: "WEEKEND8", title: "Weekend ride credit", percentOff: 8, active: true, createdAt },
      { code: "SAVE3", title: "$3 ride credit", amountOff: 3, active: true, createdAt },
      { code: "RIDE6", title: "$6 off your next ride", amountOff: 6, active: true, createdAt },
      { code: "BIG10", title: "$10 premium ride credit", amountOff: 10, active: true, createdAt }
    ],
    userCoupons: [...riderExperience.userCoupons, ...extraUserCoupons],
    payments: [
      ...riderExperience.payments,
      {
        id: "pay_seed_completed",
        rideId: completedRide.id,
        riderId: completedRide.riderId,
        driverId: completedRide.driverId,
        amount: 13.52,
        platformFee: 2.43,
        driverEarnings: 11.09,
        currencyCode: "USD",
        currencySymbol: "$",
        currencyDecimals: 2,
        paymentMethod: "card_on_file",
        providerPaymentId: "processor_seed",
        status: "paid",
        createdAt
      }
    ],
    ratings: [
      ...riderExperience.ratings,
      { id: "rating_seed", rideId: completedRide.id, fromUserId: rider2.id, toUserId: driver.id, score: 5, comment: "Great pickup.", createdAt }
    ],
    supportTickets: [
      ...riderExperience.supportTickets,
      { id: "ticket_seed", userId: rider2.id, rideId: completedRide.id, category: "payment issue", message: "Please send receipt copy.", status: "open", createdAt, updatedAt: createdAt }
    ],
    notifications: riderExperience.notifications,
    invoices: riderExperience.invoices,
    refunds: riderExperience.refunds,
    sessions: []
  };
}

module.exports = { sharedPassword, serviceCities, locations, createSeedData };

};
window.OSOmniDriverModules["./seed"] = function(require,module,exports,process,__dirname){
const { calculateHaversineDistance, estimateTripDuration, hashPassword, now } = require("../domain");

const sharedPassword = "Password123!";

const rawServiceCities = [
  {
    id: "los_angeles",
    name: "Los Angeles",
    region: "CA",
    centerLatitude: 34.0522,
    centerLongitude: -118.2437,
    radiusKm: 85,
    locations: [
      ["downtown_la", "Downtown Los Angeles, CA", 34.0522, -118.2437],
      ["hollywood", "Hollywood Boulevard, Los Angeles, CA", 34.1016, -118.3267],
      ["santa_monica", "Santa Monica Pier, Santa Monica, CA", 34.0100, -118.4960],
      ["lax", "Los Angeles International Airport (LAX), CA", 33.9416, -118.4085],
      ["griffith", "Griffith Observatory, Los Angeles, CA", 34.1184, -118.3004],
      ["ucla", "UCLA, Los Angeles, CA", 34.0689, -118.4452],
      ["crypto_arena", "Crypto.com Arena, Los Angeles, CA", 34.0430, -118.2673],
      ["pasadena", "Pasadena City Hall, Pasadena, CA", 34.1478, -118.1445]
    ]
  },
  {
    id: "new_york",
    name: "New York City",
    region: "NY",
    centerLatitude: 40.7580,
    centerLongitude: -73.9855,
    radiusKm: 70,
    locations: [
      ["times_square", "Times Square, New York, NY", 40.7580, -73.9855],
      ["penn_station", "Penn Station, New York, NY", 40.7506, -73.9935],
      ["jfk", "John F. Kennedy International Airport (JFK), Queens, NY", 40.6413, -73.7781],
      ["laguardia", "LaGuardia Airport (LGA), Queens, NY", 40.7769, -73.8740],
      ["brooklyn_heights", "Brooklyn Heights, Brooklyn, NY", 40.6959, -73.9936],
      ["williamsburg", "Williamsburg, Brooklyn, NY", 40.7081, -73.9571],
      ["central_park", "Central Park South, New York, NY", 40.7644, -73.9738],
      ["nyu", "New York University, Greenwich Village, New York, NY", 40.7295, -73.9965],
      ["metlife", "MetLife Stadium, East Rutherford, NJ", 40.8135, -74.0745]
    ]
  },
  {
    id: "san_diego",
    name: "San Diego",
    region: "CA",
    centerLatitude: 32.7157,
    centerLongitude: -117.1611,
    radiusKm: 65,
    locations: [
      ["downtown_san_diego", "Downtown San Diego, CA", 32.7157, -117.1611],
      ["san_diego_airport", "San Diego International Airport (SAN), CA", 32.7338, -117.1933],
      ["gaslamp_quarter", "Gaslamp Quarter, San Diego, CA", 32.7115, -117.1600],
      ["balboa_park", "Balboa Park, San Diego, CA", 32.7341, -117.1446],
      ["uc_san_diego", "UC San Diego, La Jolla, CA", 32.8801, -117.2340],
      ["la_jolla_cove", "La Jolla Cove, San Diego, CA", 32.8509, -117.2729],
      ["mission_valley", "Mission Valley, San Diego, CA", 32.7712, -117.1570]
    ]
  },
  {
    id: "san_jose",
    name: "San Jose",
    region: "CA",
    centerLatitude: 37.3382,
    centerLongitude: -121.8863,
    radiusKm: 65,
    locations: [
      ["downtown_san_jose", "Downtown San Jose, CA", 37.3382, -121.8863],
      ["sjc_airport", "San Jose Mineta International Airport (SJC), CA", 37.3639, -121.9289],
      ["santana_row", "Santana Row, San Jose, CA", 37.3205, -121.9472],
      ["san_jose_state", "San Jose State University, San Jose, CA", 37.3352, -121.8811],
      ["sap_center", "SAP Center, San Jose, CA", 37.3328, -121.9012],
      ["willow_glen", "Willow Glen, San Jose, CA", 37.3088, -121.9001],
      ["north_san_jose", "North San Jose, CA", 37.3875, -121.9290]
    ]
  },
  {
    id: "buffalo",
    name: "Buffalo",
    region: "NY",
    centerLatitude: 42.8864,
    centerLongitude: -78.8784,
    radiusKm: 55,
    locations: [
      ["downtown_buffalo", "Downtown Buffalo, NY", 42.8864, -78.8784],
      ["buffalo_airport", "Buffalo Niagara International Airport (BUF), NY", 42.9405, -78.7322],
      ["canalside_buffalo", "Canalside, Buffalo, NY", 42.8750, -78.8770],
      ["university_at_buffalo", "University at Buffalo North Campus, Amherst, NY", 43.0008, -78.7890],
      ["elmwood_village", "Elmwood Village, Buffalo, NY", 42.9177, -78.8760],
      ["keybank_center", "KeyBank Center, Buffalo, NY", 42.8750, -78.8766],
      ["buffalo_medical_campus", "Buffalo Niagara Medical Campus, Buffalo, NY", 42.9006, -78.8661]
    ]
  },
  {
    id: "rochester_ny",
    name: "Rochester",
    region: "NY",
    centerLatitude: 43.1566,
    centerLongitude: -77.6088,
    radiusKm: 55,
    locations: [
      ["downtown_rochester_ny", "Downtown Rochester, NY", 43.1566, -77.6088],
      ["roc_airport", "Frederick Douglass Greater Rochester International Airport (ROC), NY", 43.1189, -77.6724],
      ["university_rochester", "University of Rochester, Rochester, NY", 43.1286, -77.6285],
      ["eastman_theatre", "Eastman Theatre, Rochester, NY", 43.1577, -77.6014],
      ["strong_museum", "The Strong National Museum of Play, Rochester, NY", 43.1527, -77.6008],
      ["highland_park_rochester", "Highland Park, Rochester, NY", 43.1306, -77.6088],
      ["rit", "Rochester Institute of Technology, Henrietta, NY", 43.0845, -77.6744]
    ]
  },
  {
    id: "chicago",
    name: "Chicago",
    region: "IL",
    centerLatitude: 41.8781,
    centerLongitude: -87.6298,
    radiusKm: 70,
    locations: [
      ["loop", "The Loop, Chicago, IL", 41.8819, -87.6278],
      ["ohare", "O'Hare International Airport (ORD), Chicago, IL", 41.9742, -87.9073],
      ["midway", "Midway International Airport (MDW), Chicago, IL", 41.7868, -87.7522],
      ["river_north", "River North, Chicago, IL", 41.8924, -87.6341],
      ["wrigley", "Wrigley Field, Chicago, IL", 41.9484, -87.6553],
      ["navy_pier", "Navy Pier, Chicago, IL", 41.8917, -87.6079],
      ["united_center", "United Center, Chicago, IL", 41.8807, -87.6742]
    ]
  },
  {
    id: "sf_bay",
    name: "San Francisco Bay Area",
    region: "CA",
    centerLatitude: 37.4477,
    centerLongitude: -122.1619,
    radiusKm: 85,
    locations: [
      ["university_ave_palo_alto", "University Avenue, Palo Alto, CA", 37.4477, -122.1619],
      ["palo_alto", "Downtown Palo Alto, CA", 37.4419, -122.1430],
      ["stanford", "Stanford University, Stanford, CA", 37.4275, -122.1697],
      ["mountain_view_castro", "Castro Street, Mountain View, CA", 37.3947, -122.0781],
      ["apple_park", "Apple Park, Cupertino, CA", 37.3349, -122.0090],
      ["googleplex", "Googleplex, Mountain View, CA", 37.4220, -122.0841],
      ["sjc", "San Jose Mineta International Airport (SJC), CA", 37.3639, -121.9289],
      ["downtown_sf", "Downtown San Francisco, CA", 37.7749, -122.4194],
      ["sfo", "San Francisco International Airport (SFO), CA", 37.6213, -122.3790],
      ["oakland", "Downtown Oakland, CA", 37.8044, -122.2711],
      ["ferry_building", "Ferry Building, San Francisco, CA", 37.7955, -122.3937],
      ["mission", "Mission District, San Francisco, CA", 37.7599, -122.4148]
    ]
  },
  {
    id: "washington_dc",
    name: "Washington DC",
    region: "DC",
    centerLatitude: 38.9072,
    centerLongitude: -77.0369,
    radiusKm: 65,
    locations: [
      ["national_mall", "National Mall, Washington, DC", 38.8895, -77.0353],
      ["union_station_dc", "Union Station, Washington, DC", 38.8977, -77.0060],
      ["dca", "Ronald Reagan Washington National Airport (DCA), VA", 38.8512, -77.0402],
      ["iad", "Dulles International Airport (IAD), VA", 38.9531, -77.4565],
      ["georgetown", "Georgetown, Washington, DC", 38.9097, -77.0654],
      ["arlington", "Arlington, VA", 38.8797, -77.1068],
      ["bethesda", "Bethesda, MD", 38.9847, -77.0947]
    ]
  },
  {
    id: "miami",
    name: "Miami",
    region: "FL",
    centerLatitude: 25.7617,
    centerLongitude: -80.1918,
    radiusKm: 70,
    locations: [
      ["brickell", "Brickell, Miami, FL", 25.7602, -80.1959],
      ["mia", "Miami International Airport (MIA), FL", 25.7959, -80.2870],
      ["south_beach", "South Beach, Miami Beach, FL", 25.7826, -80.1341],
      ["wynwood", "Wynwood, Miami, FL", 25.8011, -80.1996],
      ["coral_gables", "Coral Gables, FL", 25.7215, -80.2684],
      ["ft_lauderdale", "Fort Lauderdale, FL", 26.1224, -80.1373],
      ["hard_rock", "Hard Rock Stadium, Miami Gardens, FL", 25.9580, -80.2389]
    ]
  },
  {
    id: "seattle",
    name: "Seattle",
    region: "WA",
    centerLatitude: 47.6062,
    centerLongitude: -122.3321,
    radiusKm: 70,
    locations: [
      ["downtown_seattle", "Downtown Seattle, WA", 47.6062, -122.3321],
      ["sea_tac", "Seattle-Tacoma International Airport (SEA), WA", 47.4502, -122.3088],
      ["pike_place", "Pike Place Market, Seattle, WA", 47.6097, -122.3425],
      ["south_lake_union", "South Lake Union, Seattle, WA", 47.6232, -122.3384],
      ["uw", "University of Washington, Seattle, WA", 47.6553, -122.3035],
      ["bellevue", "Downtown Bellevue, WA", 47.6101, -122.2015],
      ["lumen_field", "Lumen Field, Seattle, WA", 47.5952, -122.3316]
    ]
  },
  {
    id: "spokane",
    name: "Spokane",
    region: "WA",
    centerLatitude: 47.6588,
    centerLongitude: -117.4260,
    radiusKm: 55,
    locations: [
      ["downtown_spokane", "Downtown Spokane, WA", 47.6588, -117.4260],
      ["spokane_airport", "Spokane International Airport (GEG), WA", 47.6199, -117.5338],
      ["riverfront_park_spokane", "Riverfront Park, Spokane, WA", 47.6606, -117.4217],
      ["gonzaga", "Gonzaga University, Spokane, WA", 47.6672, -117.4027],
      ["sacred_heart_spokane", "Providence Sacred Heart Medical Center, Spokane, WA", 47.6481, -117.4130],
      ["spokane_valley", "Spokane Valley, WA", 47.6732, -117.2394],
      ["north_spokane", "North Spokane, WA", 47.7205, -117.4110]
    ]
  },
  {
    id: "tacoma",
    name: "Tacoma",
    region: "WA",
    centerLatitude: 47.2529,
    centerLongitude: -122.4443,
    radiusKm: 55,
    locations: [
      ["downtown_tacoma", "Downtown Tacoma, WA", 47.2529, -122.4443],
      ["tacoma_dome", "Tacoma Dome, Tacoma, WA", 47.2365, -122.4265],
      ["university_of_puget_sound", "University of Puget Sound, Tacoma, WA", 47.2639, -122.4815],
      ["point_defiance", "Point Defiance Park, Tacoma, WA", 47.3059, -122.5200],
      ["uw_tacoma", "University of Washington Tacoma, WA", 47.2446, -122.4384],
      ["st_joseph_tacoma", "St. Joseph Medical Center, Tacoma, WA", 47.2490, -122.4574],
      ["lakewood_wa", "Lakewood, WA", 47.1718, -122.5185]
    ]
  },
  {
    id: "dallas",
    name: "Dallas-Fort Worth",
    region: "TX",
    centerLatitude: 32.7767,
    centerLongitude: -96.7970,
    radiusKm: 90,
    locations: [
      ["downtown_dallas", "Downtown Dallas, TX", 32.7767, -96.7970],
      ["dfw", "Dallas Fort Worth International Airport (DFW), TX", 32.8998, -97.0403],
      ["love_field", "Dallas Love Field (DAL), TX", 32.8471, -96.8518],
      ["uptown_dallas", "Uptown Dallas, TX", 32.8003, -96.8016],
      ["deep_ellum", "Deep Ellum, Dallas, TX", 32.7840, -96.7837],
      ["downtown_fort_worth", "Downtown Fort Worth, TX", 32.7555, -97.3308],
      ["att_stadium", "AT&T Stadium, Arlington, TX", 32.7473, -97.0945]
    ]
  },
  {
    id: "houston",
    name: "Houston",
    region: "TX",
    centerLatitude: 29.7604,
    centerLongitude: -95.3698,
    radiusKm: 85,
    locations: [
      ["downtown_houston", "Downtown Houston, TX", 29.7604, -95.3698],
      ["iah", "George Bush Intercontinental Airport (IAH), Houston, TX", 29.9902, -95.3368],
      ["hobby", "William P. Hobby Airport (HOU), Houston, TX", 29.6454, -95.2789],
      ["texas_medical_center", "Texas Medical Center, Houston, TX", 29.7079, -95.3975],
      ["galleria_houston", "The Galleria, Houston, TX", 29.7390, -95.4636],
      ["midtown_houston", "Midtown Houston, TX", 29.7418, -95.3768],
      ["nrg_stadium", "NRG Stadium, Houston, TX", 29.6847, -95.4107]
    ]
  },
  {
    id: "san_antonio",
    name: "San Antonio",
    region: "TX",
    centerLatitude: 29.4241,
    centerLongitude: -98.4936,
    radiusKm: 70,
    locations: [
      ["downtown_san_antonio", "Downtown San Antonio, TX", 29.4241, -98.4936],
      ["sat", "San Antonio International Airport (SAT), TX", 29.5337, -98.4698],
      ["river_walk", "San Antonio River Walk, TX", 29.4252, -98.4916],
      ["alamo", "The Alamo, San Antonio, TX", 29.4260, -98.4861],
      ["pearl_district", "Pearl District, San Antonio, TX", 29.4424, -98.4797],
      ["utsa", "University of Texas at San Antonio, TX", 29.5827, -98.6211],
      ["alamodome", "Alamodome, San Antonio, TX", 29.4169, -98.4789]
    ]
  },
  {
    id: "atlanta",
    name: "Atlanta",
    region: "GA",
    centerLatitude: 33.7490,
    centerLongitude: -84.3880,
    radiusKm: 75,
    locations: [
      ["midtown_atlanta", "Midtown Atlanta, GA", 33.7833, -84.3831],
      ["atl", "Hartsfield-Jackson Atlanta International Airport (ATL), GA", 33.6407, -84.4277],
      ["downtown_atlanta", "Downtown Atlanta, GA", 33.7550, -84.3900],
      ["buckhead", "Buckhead, Atlanta, GA", 33.8484, -84.3733],
      ["ponce_city_market", "Ponce City Market, Atlanta, GA", 33.7726, -84.3656],
      ["mercedes_benz", "Mercedes-Benz Stadium, Atlanta, GA", 33.7554, -84.4008],
      ["decatur", "Decatur, GA", 33.7748, -84.2963]
    ]
  },
  {
    id: "boston",
    name: "Boston",
    region: "MA",
    centerLatitude: 42.3601,
    centerLongitude: -71.0589,
    radiusKm: 60,
    locations: [
      ["downtown_boston", "Downtown Boston, MA", 42.3601, -71.0589],
      ["logan", "Boston Logan International Airport (BOS), MA", 42.3656, -71.0096],
      ["south_station", "South Station, Boston, MA", 42.3523, -71.0552],
      ["back_bay", "Back Bay, Boston, MA", 42.3503, -71.0810],
      ["cambridge", "Kendall Square, Cambridge, MA", 42.3626, -71.0843],
      ["fenway", "Fenway Park, Boston, MA", 42.3467, -71.0972],
      ["harvard", "Harvard Square, Cambridge, MA", 42.3734, -71.1189]
    ]
  },
  {
    id: "worcester",
    name: "Worcester",
    region: "MA",
    centerLatitude: 42.2626,
    centerLongitude: -71.8023,
    radiusKm: 45,
    locations: [
      ["downtown_worcester", "Downtown Worcester, MA", 42.2626, -71.8023],
      ["worcester_union_station", "Union Station, Worcester, MA", 42.2618, -71.7949],
      ["worcester_airport", "Worcester Regional Airport (ORH), MA", 42.2673, -71.8757],
      ["polar_park", "Polar Park, Worcester, MA", 42.2573, -71.8008],
      ["wpi", "Worcester Polytechnic Institute, Worcester, MA", 42.2749, -71.8081],
      ["umass_memorial", "UMass Memorial Medical Center, Worcester, MA", 42.2767, -71.7619],
      ["college_of_holy_cross", "College of the Holy Cross, Worcester, MA", 42.2385, -71.8089]
    ]
  },
  {
    id: "springfield_ma",
    name: "Springfield",
    region: "MA",
    centerLatitude: 42.1015,
    centerLongitude: -72.5898,
    radiusKm: 45,
    locations: [
      ["downtown_springfield_ma", "Downtown Springfield, MA", 42.1015, -72.5898],
      ["springfield_union_station", "Union Station, Springfield, MA", 42.1061, -72.5939],
      ["mgm_springfield", "MGM Springfield, MA", 42.0997, -72.5881],
      ["basketball_hall", "Naismith Basketball Hall of Fame, Springfield, MA", 42.0930, -72.5845],
      ["springfield_college", "Springfield College, Springfield, MA", 42.1057, -72.5562],
      ["baystate_medical", "Baystate Medical Center, Springfield, MA", 42.1209, -72.6044],
      ["forest_park_springfield", "Forest Park, Springfield, MA", 42.0808, -72.5745]
    ]
  },
  {
    id: "detroit",
    name: "Detroit",
    region: "MI",
    centerLatitude: 42.3314,
    centerLongitude: -83.0458,
    radiusKm: 65,
    locations: [
      ["downtown_detroit", "Downtown Detroit, MI", 42.3314, -83.0458],
      ["dtw", "Detroit Metropolitan Wayne County Airport (DTW), MI", 42.2162, -83.3554],
      ["midtown_detroit", "Midtown Detroit, MI", 42.3482, -83.0583],
      ["wayne_state", "Wayne State University, Detroit, MI", 42.3591, -83.0665],
      ["comerica_park", "Comerica Park, Detroit, MI", 42.3390, -83.0485],
      ["henry_ford_hospital", "Henry Ford Hospital, Detroit, MI", 42.3676, -83.0849],
      ["detroit_riverfront", "Detroit Riverfront, Detroit, MI", 42.3270, -83.0392]
    ]
  },
  {
    id: "grand_rapids",
    name: "Grand Rapids",
    region: "MI",
    centerLatitude: 42.9634,
    centerLongitude: -85.6681,
    radiusKm: 45,
    locations: [
      ["downtown_grand_rapids", "Downtown Grand Rapids, MI", 42.9634, -85.6681],
      ["grr", "Gerald R. Ford International Airport (GRR), MI", 42.8808, -85.5228],
      ["medical_mile", "Medical Mile, Grand Rapids, MI", 42.9700, -85.6644],
      ["van_andel_arena", "Van Andel Arena, Grand Rapids, MI", 42.9620, -85.6712],
      ["grand_valley_downtown", "Grand Valley State University Pew Campus, Grand Rapids, MI", 42.9631, -85.6757],
      ["east_grand_rapids", "East Grand Rapids, MI", 42.9411, -85.6100],
      ["john_ball_zoo", "John Ball Zoo, Grand Rapids, MI", 42.9636, -85.7043]
    ]
  },
  {
    id: "warren_mi",
    name: "Warren",
    region: "MI",
    centerLatitude: 42.5145,
    centerLongitude: -83.0147,
    radiusKm: 45,
    locations: [
      ["downtown_warren", "Downtown Warren, MI", 42.5145, -83.0147],
      ["gm_tech_center", "General Motors Technical Center, Warren, MI", 42.5188, -83.0390],
      ["warren_city_hall", "Warren City Hall, Warren, MI", 42.5147, -83.0280],
      ["macomb_community_college", "Macomb Community College South Campus, Warren, MI", 42.5208, -82.9643],
      ["ascension_macomb", "Ascension Macomb-Oakland Hospital, Warren, MI", 42.5752, -82.9714],
      ["sterling_heights", "Sterling Heights, MI", 42.5803, -83.0302],
      ["royal_oak", "Royal Oak, MI", 42.4895, -83.1446]
    ]
  },
  {
    id: "toronto",
    name: "Toronto",
    region: "Canada",
    centerLatitude: 43.6532,
    centerLongitude: -79.3832,
    radiusKm: 75,
    locations: [
      ["toronto_downtown", "Downtown Toronto, ON, Canada", 43.6532, -79.3832],
      ["yyz", "Toronto Pearson International Airport (YYZ), ON, Canada", 43.6777, -79.6248],
      ["union_station_toronto", "Union Station, Toronto, ON, Canada", 43.6452, -79.3806],
      ["cn_tower", "CN Tower, Toronto, ON, Canada", 43.6426, -79.3871],
      ["yorkville", "Yorkville, Toronto, ON, Canada", 43.6709, -79.3933],
      ["north_york", "North York Centre, Toronto, ON, Canada", 43.7687, -79.4127]
    ]
  },
  {
    id: "vancouver",
    name: "Vancouver",
    region: "Canada",
    centerLatitude: 49.2827,
    centerLongitude: -123.1207,
    radiusKm: 70,
    locations: [
      ["vancouver_downtown", "Downtown Vancouver, BC, Canada", 49.2827, -123.1207],
      ["yvr", "Vancouver International Airport (YVR), BC, Canada", 49.1967, -123.1815],
      ["waterfront_vancouver", "Waterfront Station, Vancouver, BC, Canada", 49.2858, -123.1119],
      ["gastown", "Gastown, Vancouver, BC, Canada", 49.2828, -123.1067],
      ["kitsilano", "Kitsilano, Vancouver, BC, Canada", 49.2684, -123.1683],
      ["burnaby", "Metrotown, Burnaby, BC, Canada", 49.2276, -123.0076]
    ]
  },
  {
    id: "mexico_city",
    name: "Mexico City",
    region: "Mexico",
    centerLatitude: 19.4326,
    centerLongitude: -99.1332,
    radiusKm: 80,
    locations: [
      ["cdmx_centro", "Centro Historico, Mexico City, Mexico", 19.4326, -99.1332],
      ["mex", "Mexico City International Airport (MEX), Mexico", 19.4361, -99.0719],
      ["polanco", "Polanco, Mexico City, Mexico", 19.4321, -99.1941],
      ["roma_norte", "Roma Norte, Mexico City, Mexico", 19.4194, -99.1641],
      ["condesa", "Condesa, Mexico City, Mexico", 19.4120, -99.1747],
      ["santa_fe_cdmx", "Santa Fe, Mexico City, Mexico", 19.3598, -99.2769]
    ]
  },
  {
    id: "sao_paulo",
    name: "Sao Paulo",
    region: "Brazil",
    centerLatitude: -23.5505,
    centerLongitude: -46.6333,
    radiusKm: 85,
    locations: [
      ["paulista", "Avenida Paulista, Sao Paulo, Brazil", -23.5614, -46.6559],
      ["gru", "Sao Paulo Guarulhos International Airport (GRU), Brazil", -23.4356, -46.4731],
      ["congonhas", "Congonhas Airport (CGH), Sao Paulo, Brazil", -23.6261, -46.6566],
      ["vila_madalena", "Vila Madalena, Sao Paulo, Brazil", -23.5489, -46.6926],
      ["itaim_bibi", "Itaim Bibi, Sao Paulo, Brazil", -23.5846, -46.6786],
      ["pinheiros", "Pinheiros, Sao Paulo, Brazil", -23.5673, -46.7019]
    ]
  },
  {
    id: "rio_de_janeiro",
    name: "Rio de Janeiro",
    region: "Brazil",
    centerLatitude: -22.9068,
    centerLongitude: -43.1729,
    radiusKm: 75,
    locations: [
      ["rio_centro", "Centro, Rio de Janeiro, Brazil", -22.9068, -43.1729],
      ["gig", "Rio de Janeiro Galeao International Airport (GIG), Brazil", -22.8099, -43.2506],
      ["sdu", "Santos Dumont Airport (SDU), Rio de Janeiro, Brazil", -22.9105, -43.1631],
      ["copacabana", "Copacabana, Rio de Janeiro, Brazil", -22.9711, -43.1822],
      ["ipanema", "Ipanema, Rio de Janeiro, Brazil", -22.9847, -43.1986],
      ["barra", "Barra da Tijuca, Rio de Janeiro, Brazil", -23.0004, -43.3659]
    ]
  },
  {
    id: "buenos_aires",
    name: "Buenos Aires",
    region: "Argentina",
    centerLatitude: -34.6037,
    centerLongitude: -58.3816,
    radiusKm: 75,
    locations: [
      ["obelisco", "Obelisco, Buenos Aires, Argentina", -34.6037, -58.3816],
      ["eze", "Ezeiza International Airport (EZE), Buenos Aires, Argentina", -34.8222, -58.5358],
      ["aep", "Aeroparque Jorge Newbery (AEP), Buenos Aires, Argentina", -34.5580, -58.4156],
      ["palermo", "Palermo, Buenos Aires, Argentina", -34.5889, -58.4306],
      ["recoleta", "Recoleta, Buenos Aires, Argentina", -34.5875, -58.3974],
      ["puerto_madero", "Puerto Madero, Buenos Aires, Argentina", -34.6118, -58.3620]
    ]
  },
  {
    id: "santiago",
    name: "Santiago",
    region: "Chile",
    centerLatitude: -33.4489,
    centerLongitude: -70.6693,
    radiusKm: 70,
    locations: [
      ["santiago_centro", "Downtown Santiago, Chile", -33.4489, -70.6693],
      ["scl", "Santiago International Airport (SCL), Chile", -33.3928, -70.7858],
      ["providencia", "Providencia, Santiago, Chile", -33.4263, -70.6170],
      ["las_condes", "Las Condes, Santiago, Chile", -33.4088, -70.5675],
      ["bellavista", "Barrio Bellavista, Santiago, Chile", -33.4326, -70.6345],
      ["vitacura", "Vitacura, Santiago, Chile", -33.3812, -70.5720]
    ]
  },
  {
    id: "bogota",
    name: "Bogota",
    region: "Colombia",
    centerLatitude: 4.7110,
    centerLongitude: -74.0721,
    radiusKm: 70,
    locations: [
      ["bogota_centro", "Downtown Bogota, Colombia", 4.7110, -74.0721],
      ["bog", "El Dorado International Airport (BOG), Bogota, Colombia", 4.7016, -74.1469],
      ["chapinero", "Chapinero, Bogota, Colombia", 4.6486, -74.0628],
      ["zona_t", "Zona T, Bogota, Colombia", 4.6673, -74.0533],
      ["usaquen", "Usaquen, Bogota, Colombia", 4.6959, -74.0308],
      ["la_candelaria", "La Candelaria, Bogota, Colombia", 4.5964, -74.0733]
    ]
  },
  {
    id: "london",
    name: "London",
    region: "United Kingdom",
    centerLatitude: 51.5074,
    centerLongitude: -0.1278,
    radiusKm: 85,
    locations: [
      ["westminster", "Westminster, London, UK", 51.4995, -0.1248],
      ["lhr", "Heathrow Airport (LHR), London, UK", 51.4700, -0.4543],
      ["lgw", "Gatwick Airport (LGW), London, UK", 51.1537, -0.1821],
      ["kings_cross", "King's Cross St Pancras, London, UK", 51.5320, -0.1233],
      ["canary_wharf", "Canary Wharf, London, UK", 51.5054, -0.0235],
      ["shoreditch", "Shoreditch, London, UK", 51.5260, -0.0780],
      ["paddington", "Paddington Station, London, UK", 51.5154, -0.1755]
    ]
  },
  {
    id: "paris",
    name: "Paris",
    region: "France",
    centerLatitude: 48.8566,
    centerLongitude: 2.3522,
    radiusKm: 75,
    locations: [
      ["paris_center", "Hotel de Ville, Paris, France", 48.8566, 2.3522],
      ["cdg", "Charles de Gaulle Airport (CDG), Paris, France", 49.0097, 2.5479],
      ["ory", "Orly Airport (ORY), Paris, France", 48.7262, 2.3652],
      ["gare_du_nord", "Gare du Nord, Paris, France", 48.8809, 2.3553],
      ["la_defense", "La Defense, Paris, France", 48.8924, 2.2369],
      ["eiffel_tower", "Eiffel Tower, Paris, France", 48.8584, 2.2945],
      ["montmartre", "Montmartre, Paris, France", 48.8867, 2.3431]
    ]
  },
  {
    id: "berlin",
    name: "Berlin",
    region: "Germany",
    centerLatitude: 52.5200,
    centerLongitude: 13.4050,
    radiusKm: 70,
    locations: [
      ["mitte", "Mitte, Berlin, Germany", 52.5200, 13.4050],
      ["ber", "Berlin Brandenburg Airport (BER), Germany", 52.3667, 13.5033],
      ["hauptbahnhof", "Berlin Hauptbahnhof, Germany", 52.5251, 13.3694],
      ["alexanderplatz", "Alexanderplatz, Berlin, Germany", 52.5219, 13.4132],
      ["kreuzberg", "Kreuzberg, Berlin, Germany", 52.4986, 13.4034],
      ["potsdamer_platz", "Potsdamer Platz, Berlin, Germany", 52.5096, 13.3760]
    ]
  },
  {
    id: "madrid",
    name: "Madrid",
    region: "Spain",
    centerLatitude: 40.4168,
    centerLongitude: -3.7038,
    radiusKm: 70,
    locations: [
      ["puerta_sol", "Puerta del Sol, Madrid, Spain", 40.4168, -3.7038],
      ["mad", "Adolfo Suarez Madrid-Barajas Airport (MAD), Spain", 40.4983, -3.5676],
      ["atocha", "Madrid Atocha Station, Spain", 40.4065, -3.6896],
      ["salamanca", "Salamanca, Madrid, Spain", 40.4300, -3.6800],
      ["chamartin", "Chamartin, Madrid, Spain", 40.4722, -3.6825],
      ["gran_via", "Gran Via, Madrid, Spain", 40.4203, -3.7058]
    ]
  },
  {
    id: "rome",
    name: "Rome",
    region: "Italy",
    centerLatitude: 41.9028,
    centerLongitude: 12.4964,
    radiusKm: 70,
    locations: [
      ["rome_center", "Centro Storico, Rome, Italy", 41.9028, 12.4964],
      ["fco", "Leonardo da Vinci Fiumicino Airport (FCO), Rome, Italy", 41.8003, 12.2389],
      ["cia", "Ciampino Airport (CIA), Rome, Italy", 41.7999, 12.5949],
      ["termini", "Roma Termini Station, Rome, Italy", 41.9010, 12.5019],
      ["trastevere", "Trastevere, Rome, Italy", 41.8898, 12.4663],
      ["colosseum", "Colosseum, Rome, Italy", 41.8902, 12.4922]
    ]
  },
  {
    id: "amsterdam",
    name: "Amsterdam",
    region: "Netherlands",
    centerLatitude: 52.3676,
    centerLongitude: 4.9041,
    radiusKm: 60,
    locations: [
      ["amsterdam_centraal", "Amsterdam Centraal, Netherlands", 52.3791, 4.8994],
      ["ams", "Amsterdam Schiphol Airport (AMS), Netherlands", 52.3105, 4.7683],
      ["dam_square", "Dam Square, Amsterdam, Netherlands", 52.3731, 4.8922],
      ["jordaan", "Jordaan, Amsterdam, Netherlands", 52.3738, 4.8810],
      ["zuidas", "Zuidas, Amsterdam, Netherlands", 52.3373, 4.8739],
      ["museumplein", "Museumplein, Amsterdam, Netherlands", 52.3579, 4.8812]
    ]
  },
  {
    id: "istanbul",
    name: "Istanbul",
    region: "Turkey",
    centerLatitude: 41.0082,
    centerLongitude: 28.9784,
    radiusKm: 90,
    locations: [
      ["sultanahmet", "Sultanahmet, Istanbul, Turkey", 41.0082, 28.9784],
      ["ist", "Istanbul Airport (IST), Turkey", 41.2753, 28.7519],
      ["saw", "Sabiha Gokcen Airport (SAW), Istanbul, Turkey", 40.8986, 29.3092],
      ["taksim", "Taksim Square, Istanbul, Turkey", 41.0369, 28.9850],
      ["besiktas", "Besiktas, Istanbul, Turkey", 41.0438, 29.0094],
      ["kadikoy", "Kadikoy, Istanbul, Turkey", 40.9903, 29.0290]
    ]
  },
  {
    id: "dubai",
    name: "Dubai",
    region: "United Arab Emirates",
    centerLatitude: 25.2048,
    centerLongitude: 55.2708,
    radiusKm: 85,
    locations: [
      ["downtown_dubai", "Downtown Dubai, UAE", 25.1972, 55.2744],
      ["dxb", "Dubai International Airport (DXB), UAE", 25.2532, 55.3657],
      ["dubai_marina", "Dubai Marina, UAE", 25.0805, 55.1403],
      ["business_bay", "Business Bay, Dubai, UAE", 25.1850, 55.2772],
      ["jbr", "Jumeirah Beach Residence, Dubai, UAE", 25.0750, 55.1313],
      ["palm_jumeirah", "Palm Jumeirah, Dubai, UAE", 25.1124, 55.1390]
    ]
  },
  {
    id: "riyadh",
    name: "Riyadh",
    region: "Saudi Arabia",
    centerLatitude: 24.7136,
    centerLongitude: 46.6753,
    radiusKm: 80,
    locations: [
      ["olaya", "Olaya, Riyadh, Saudi Arabia", 24.7136, 46.6753],
      ["ruh", "King Khalid International Airport (RUH), Riyadh, Saudi Arabia", 24.9576, 46.6988],
      ["kingdom_centre", "Kingdom Centre, Riyadh, Saudi Arabia", 24.7113, 46.6744],
      ["riyadh_front", "Riyadh Front, Saudi Arabia", 24.8415, 46.7356],
      ["diriyah", "Diriyah, Riyadh, Saudi Arabia", 24.7370, 46.5756],
      ["king_abdullah_financial", "King Abdullah Financial District, Riyadh, Saudi Arabia", 24.7628, 46.6400]
    ]
  },
  {
    id: "cairo",
    name: "Cairo",
    region: "Egypt",
    centerLatitude: 30.0444,
    centerLongitude: 31.2357,
    radiusKm: 80,
    locations: [
      ["downtown_cairo", "Downtown Cairo, Egypt", 30.0444, 31.2357],
      ["cai", "Cairo International Airport (CAI), Egypt", 30.1120, 31.4000],
      ["zamalek", "Zamalek, Cairo, Egypt", 30.0610, 31.2194],
      ["new_cairo", "New Cairo, Egypt", 30.0131, 31.4913],
      ["giza", "Giza Pyramids, Giza, Egypt", 29.9792, 31.1342],
      ["nasr_city", "Nasr City, Cairo, Egypt", 30.0561, 31.3300]
    ]
  },
  {
    id: "nairobi",
    name: "Nairobi",
    region: "Kenya",
    centerLatitude: -1.2921,
    centerLongitude: 36.8219,
    radiusKm: 65,
    locations: [
      ["nairobi_cbd", "Nairobi CBD, Kenya", -1.2921, 36.8219],
      ["nbo", "Jomo Kenyatta International Airport (NBO), Nairobi, Kenya", -1.3192, 36.9278],
      ["westlands", "Westlands, Nairobi, Kenya", -1.2676, 36.8108],
      ["kilimani", "Kilimani, Nairobi, Kenya", -1.2925, 36.7854],
      ["upper_hill", "Upper Hill, Nairobi, Kenya", -1.3006, 36.8156],
      ["karen", "Karen, Nairobi, Kenya", -1.3197, 36.7073]
    ]
  },
  {
    id: "johannesburg",
    name: "Johannesburg",
    region: "South Africa",
    centerLatitude: -26.2041,
    centerLongitude: 28.0473,
    radiusKm: 80,
    locations: [
      ["sandton", "Sandton, Johannesburg, South Africa", -26.1076, 28.0567],
      ["jnb", "O. R. Tambo International Airport (JNB), Johannesburg, South Africa", -26.1337, 28.2420],
      ["rosebank", "Rosebank, Johannesburg, South Africa", -26.1450, 28.0417],
      ["melrose_arch", "Melrose Arch, Johannesburg, South Africa", -26.1340, 28.0688],
      ["joburg_cbd", "Johannesburg CBD, South Africa", -26.2041, 28.0473],
      ["fourways", "Fourways, Johannesburg, South Africa", -26.0157, 28.0120]
    ]
  },
  {
    id: "mumbai",
    name: "Mumbai",
    region: "India",
    centerLatitude: 19.0760,
    centerLongitude: 72.8777,
    radiusKm: 85,
    locations: [
      ["bandra_kurla", "Bandra Kurla Complex, Mumbai, India", 19.0667, 72.8675],
      ["bom", "Chhatrapati Shivaji Maharaj International Airport (BOM), Mumbai, India", 19.0896, 72.8656],
      ["colaba", "Colaba, Mumbai, India", 18.9067, 72.8147],
      ["andheri", "Andheri, Mumbai, India", 19.1197, 72.8464],
      ["lower_parel", "Lower Parel, Mumbai, India", 18.9930, 72.8308],
      ["powai", "Powai, Mumbai, India", 19.1176, 72.9060]
    ]
  },
  {
    id: "delhi",
    name: "Delhi NCR",
    region: "India",
    centerLatitude: 28.6139,
    centerLongitude: 77.2090,
    radiusKm: 90,
    locations: [
      ["connaught_place", "Connaught Place, New Delhi, India", 28.6315, 77.2167],
      ["del", "Indira Gandhi International Airport (DEL), Delhi, India", 28.5562, 77.1000],
      ["gurugram", "Cyber City, Gurugram, India", 28.4949, 77.0890],
      ["noida", "Sector 18, Noida, India", 28.5706, 77.3261],
      ["south_delhi", "South Delhi, India", 28.5245, 77.1855],
      ["new_delhi_station", "New Delhi Railway Station, India", 28.6429, 77.2195]
    ]
  },
  {
    id: "bangkok",
    name: "Bangkok",
    region: "Thailand",
    centerLatitude: 13.7563,
    centerLongitude: 100.5018,
    radiusKm: 80,
    locations: [
      ["sukhumvit", "Sukhumvit, Bangkok, Thailand", 13.7373, 100.5600],
      ["bkk", "Suvarnabhumi Airport (BKK), Bangkok, Thailand", 13.6900, 100.7501],
      ["dmk", "Don Mueang International Airport (DMK), Bangkok, Thailand", 13.9126, 100.6068],
      ["siam", "Siam, Bangkok, Thailand", 13.7466, 100.5347],
      ["silom", "Silom, Bangkok, Thailand", 13.7246, 100.5294],
      ["ari", "Ari, Bangkok, Thailand", 13.7800, 100.5447]
    ]
  },
  {
    id: "singapore",
    name: "Singapore",
    region: "Singapore",
    centerLatitude: 1.3521,
    centerLongitude: 103.8198,
    radiusKm: 45,
    locations: [
      ["marina_bay", "Marina Bay, Singapore", 1.2834, 103.8607],
      ["sin", "Changi Airport (SIN), Singapore", 1.3644, 103.9915],
      ["orchard", "Orchard Road, Singapore", 1.3048, 103.8318],
      ["raffles_place", "Raffles Place, Singapore", 1.2840, 103.8513],
      ["bugis", "Bugis, Singapore", 1.3008, 103.8559],
      ["sentosa", "Sentosa, Singapore", 1.2494, 103.8303]
    ]
  },
  {
    id: "tokyo",
    name: "Tokyo",
    region: "Japan",
    centerLatitude: 35.6762,
    centerLongitude: 139.6503,
    radiusKm: 90,
    locations: [
      ["tokyo_station", "Tokyo Station, Tokyo, Japan", 35.6812, 139.7671],
      ["hnd", "Haneda Airport (HND), Tokyo, Japan", 35.5494, 139.7798],
      ["nrt", "Narita International Airport (NRT), Chiba, Japan", 35.7719, 140.3929],
      ["shinjuku", "Shinjuku, Tokyo, Japan", 35.6938, 139.7034],
      ["shibuya", "Shibuya, Tokyo, Japan", 35.6595, 139.7005],
      ["roppongi", "Roppongi, Tokyo, Japan", 35.6628, 139.7314],
      ["ginza", "Ginza, Tokyo, Japan", 35.6717, 139.7650]
    ]
  },
  {
    id: "seoul",
    name: "Seoul",
    region: "South Korea",
    centerLatitude: 37.5665,
    centerLongitude: 126.9780,
    radiusKm: 85,
    locations: [
      ["gangnam", "Gangnam, Seoul, South Korea", 37.4979, 127.0276],
      ["icn", "Incheon International Airport (ICN), South Korea", 37.4602, 126.4407],
      ["gmp", "Gimpo International Airport (GMP), Seoul, South Korea", 37.5583, 126.7906],
      ["hongdae", "Hongdae, Seoul, South Korea", 37.5563, 126.9236],
      ["myeongdong", "Myeongdong, Seoul, South Korea", 37.5636, 126.9820],
      ["itaewon", "Itaewon, Seoul, South Korea", 37.5345, 126.9946]
    ]
  },
  {
    id: "hong_kong",
    name: "Hong Kong",
    region: "Hong Kong",
    centerLatitude: 22.3193,
    centerLongitude: 114.1694,
    radiusKm: 55,
    locations: [
      ["central_hk", "Central, Hong Kong", 22.2819, 114.1589],
      ["hkg", "Hong Kong International Airport (HKG)", 22.3080, 113.9185],
      ["tsim_sha_tsui", "Tsim Sha Tsui, Hong Kong", 22.2976, 114.1722],
      ["causeway_bay", "Causeway Bay, Hong Kong", 22.2803, 114.1848],
      ["mong_kok", "Mong Kok, Hong Kong", 22.3193, 114.1694],
      ["kowloon_station", "Kowloon Station, Hong Kong", 22.3048, 114.1615]
    ]
  },
  {
    id: "taipei",
    name: "Taipei",
    region: "Taiwan",
    centerLatitude: 25.0330,
    centerLongitude: 121.5654,
    radiusKm: 70,
    locations: [
      ["taipei_101", "Taipei 101, Taipei, Taiwan", 25.0339, 121.5645],
      ["tpe", "Taoyuan International Airport (TPE), Taiwan", 25.0797, 121.2342],
      ["tsa", "Taipei Songshan Airport (TSA), Taiwan", 25.0694, 121.5525],
      ["taipei_main", "Taipei Main Station, Taiwan", 25.0478, 121.5170],
      ["xinyi", "Xinyi District, Taipei, Taiwan", 25.0330, 121.5654],
      ["ximending", "Ximending, Taipei, Taiwan", 25.0420, 121.5070]
    ]
  },
  {
    id: "shanghai",
    name: "Shanghai",
    region: "China",
    centerLatitude: 31.2304,
    centerLongitude: 121.4737,
    radiusKm: 90,
    locations: [
      ["people_square", "People's Square, Shanghai, China", 31.2304, 121.4737],
      ["pvg", "Shanghai Pudong International Airport (PVG), China", 31.1443, 121.8083],
      ["sha", "Shanghai Hongqiao International Airport (SHA), China", 31.1979, 121.3363],
      ["lujiazui", "Lujiazui, Shanghai, China", 31.2397, 121.4998],
      ["xintiandi", "Xintiandi, Shanghai, China", 31.2199, 121.4751],
      ["jing_an", "Jing'an, Shanghai, China", 31.2231, 121.4454]
    ]
  },
  {
    id: "beijing",
    name: "Beijing",
    region: "China",
    centerLatitude: 39.9042,
    centerLongitude: 116.4074,
    radiusKm: 95,
    locations: [
      ["guomao", "Guomao, Beijing, China", 39.9097, 116.4619],
      ["pek", "Beijing Capital International Airport (PEK), China", 40.0799, 116.6031],
      ["pkx", "Beijing Daxing International Airport (PKX), China", 39.5098, 116.4105],
      ["sanlitun", "Sanlitun, Beijing, China", 39.9336, 116.4551],
      ["wangfujing", "Wangfujing, Beijing, China", 39.9150, 116.4110],
      ["beijing_south", "Beijing South Railway Station, China", 39.8652, 116.3785]
    ]
  },
  {
    id: "sydney",
    name: "Sydney",
    region: "Australia",
    centerLatitude: -33.8688,
    centerLongitude: 151.2093,
    radiusKm: 80,
    locations: [
      ["sydney_cbd", "Sydney CBD, NSW, Australia", -33.8688, 151.2093],
      ["syd", "Sydney Airport (SYD), NSW, Australia", -33.9399, 151.1753],
      ["circular_quay", "Circular Quay, Sydney, Australia", -33.8610, 151.2128],
      ["darling_harbour", "Darling Harbour, Sydney, Australia", -33.8749, 151.2009],
      ["bondi", "Bondi Beach, Sydney, Australia", -33.8915, 151.2767],
      ["parramatta", "Parramatta, Sydney, Australia", -33.8136, 151.0034]
    ]
  },
  {
    id: "melbourne",
    name: "Melbourne",
    region: "Australia",
    centerLatitude: -37.8136,
    centerLongitude: 144.9631,
    radiusKm: 80,
    locations: [
      ["melbourne_cbd", "Melbourne CBD, VIC, Australia", -37.8136, 144.9631],
      ["mel", "Melbourne Airport (MEL), VIC, Australia", -37.6690, 144.8410],
      ["southern_cross", "Southern Cross Station, Melbourne, Australia", -37.8183, 144.9525],
      ["southbank", "Southbank, Melbourne, Australia", -37.8210, 144.9646],
      ["st_kilda", "St Kilda, Melbourne, Australia", -37.8679, 144.9800],
      ["docklands", "Docklands, Melbourne, Australia", -37.8152, 144.9469]
    ]
  },
  {
    id: "auckland",
    name: "Auckland",
    region: "New Zealand",
    centerLatitude: -36.8485,
    centerLongitude: 174.7633,
    radiusKm: 70,
    locations: [
      ["auckland_cbd", "Auckland CBD, New Zealand", -36.8485, 174.7633],
      ["akl", "Auckland Airport (AKL), New Zealand", -37.0082, 174.7850],
      ["viaduct_harbour", "Viaduct Harbour, Auckland, New Zealand", -36.8422, 174.7619],
      ["newmarket", "Newmarket, Auckland, New Zealand", -36.8702, 174.7776],
      ["parnell", "Parnell, Auckland, New Zealand", -36.8567, 174.7810],
      ["takapuna", "Takapuna, Auckland, New Zealand", -36.7869, 174.7732]
    ]
  },
  {
    id: "kuala_lumpur",
    name: "Kuala Lumpur",
    region: "Malaysia",
    centerLatitude: 3.1390,
    centerLongitude: 101.6869,
    radiusKm: 85,
    locations: [
      ["klcc", "KLCC, Kuala Lumpur, Malaysia", 3.1579, 101.7123],
      ["kul", "Kuala Lumpur International Airport (KUL), Malaysia", 2.7456, 101.7072],
      ["bukit_bintang", "Bukit Bintang, Kuala Lumpur, Malaysia", 3.1466, 101.7110],
      ["sentral_kl", "KL Sentral, Kuala Lumpur, Malaysia", 3.1340, 101.6869],
      ["bangsar", "Bangsar, Kuala Lumpur, Malaysia", 3.1290, 101.6797],
      ["mont_kiara", "Mont Kiara, Kuala Lumpur, Malaysia", 3.1677, 101.6508]
    ]
  },
  {
    id: "jakarta",
    name: "Jakarta",
    region: "Indonesia",
    centerLatitude: -6.2088,
    centerLongitude: 106.8456,
    radiusKm: 90,
    locations: [
      ["jakarta_cbd", "Sudirman CBD, Jakarta, Indonesia", -6.2241, 106.8090],
      ["cgk", "Soekarno-Hatta International Airport (CGK), Jakarta, Indonesia", -6.1275, 106.6537],
      ["gambir", "Gambir Station, Jakarta, Indonesia", -6.1767, 106.8307],
      ["kemang", "Kemang, Jakarta, Indonesia", -6.2607, 106.8164],
      ["scbd", "SCBD, Jakarta, Indonesia", -6.2275, 106.8075],
      ["kelapa_gading", "Kelapa Gading, Jakarta, Indonesia", -6.1579, 106.9051]
    ]
  },
  {
    id: "manila",
    name: "Manila",
    region: "Philippines",
    centerLatitude: 14.5995,
    centerLongitude: 120.9842,
    radiusKm: 85,
    locations: [
      ["bgc", "Bonifacio Global City, Metro Manila, Philippines", 14.5503, 121.0505],
      ["mnl", "Ninoy Aquino International Airport (MNL), Manila, Philippines", 14.5086, 121.0194],
      ["makati", "Makati CBD, Metro Manila, Philippines", 14.5547, 121.0244],
      ["intramuros", "Intramuros, Manila, Philippines", 14.5896, 120.9747],
      ["ortigas", "Ortigas Center, Metro Manila, Philippines", 14.5869, 121.0614],
      ["quezon_city", "Quezon City, Metro Manila, Philippines", 14.6760, 121.0437]
    ]
  },
  {
    id: "lagos",
    name: "Lagos",
    region: "Nigeria",
    centerLatitude: 6.5244,
    centerLongitude: 3.3792,
    radiusKm: 80,
    locations: [
      ["victoria_island", "Victoria Island, Lagos, Nigeria", 6.4281, 3.4219],
      ["los", "Murtala Muhammed International Airport (LOS), Lagos, Nigeria", 6.5774, 3.3212],
      ["ikeja", "Ikeja, Lagos, Nigeria", 6.6018, 3.3515],
      ["lekki", "Lekki Phase 1, Lagos, Nigeria", 6.4478, 3.4723],
      ["yaba", "Yaba, Lagos, Nigeria", 6.5158, 3.3873],
      ["marina_lagos", "Lagos Marina, Nigeria", 6.4500, 3.4000]
    ]
  },
  {
    id: "casablanca",
    name: "Casablanca",
    region: "Morocco",
    centerLatitude: 33.5731,
    centerLongitude: -7.5898,
    radiusKm: 70,
    locations: [
      ["casablanca_centre", "Casablanca City Center, Morocco", 33.5731, -7.5898],
      ["cmn", "Mohammed V International Airport (CMN), Casablanca, Morocco", 33.3675, -7.5898],
      ["maarif", "Maarif, Casablanca, Morocco", 33.5833, -7.6333],
      ["ain_diab", "Ain Diab, Casablanca, Morocco", 33.5942, -7.6901],
      ["casa_port", "Casa-Port Railway Station, Casablanca, Morocco", 33.5975, -7.6139],
      ["hassan_ii", "Hassan II Mosque, Casablanca, Morocco", 33.6084, -7.6326]
    ]
  },
  {
    id: "lisbon",
    name: "Lisbon",
    region: "Portugal",
    centerLatitude: 38.7223,
    centerLongitude: -9.1393,
    radiusKm: 70,
    locations: [
      ["baixa", "Baixa, Lisbon, Portugal", 38.7110, -9.1378],
      ["lis", "Humberto Delgado Airport (LIS), Lisbon, Portugal", 38.7742, -9.1342],
      ["chiado", "Chiado, Lisbon, Portugal", 38.7103, -9.1430],
      ["belem", "Belem, Lisbon, Portugal", 38.6968, -9.2065],
      ["parque_nacoes", "Parque das Nacoes, Lisbon, Portugal", 38.7680, -9.0950],
      ["cais_sodre", "Cais do Sodre, Lisbon, Portugal", 38.7069, -9.1456]
    ]
  },
  {
    id: "stockholm",
    name: "Stockholm",
    region: "Sweden",
    centerLatitude: 59.3293,
    centerLongitude: 18.0686,
    radiusKm: 70,
    locations: [
      ["stockholm_central", "Stockholm Central Station, Sweden", 59.3306, 18.0597],
      ["arn", "Stockholm Arlanda Airport (ARN), Sweden", 59.6519, 17.9186],
      ["gamla_stan", "Gamla Stan, Stockholm, Sweden", 59.3250, 18.0710],
      ["ostermalm", "Ostermalm, Stockholm, Sweden", 59.3368, 18.0902],
      ["sodermalm", "Sodermalm, Stockholm, Sweden", 59.3158, 18.0707],
      ["kista", "Kista, Stockholm, Sweden", 59.4032, 17.9448]
    ]
  },
  {
    id: "vienna",
    name: "Vienna",
    region: "Austria",
    centerLatitude: 48.2082,
    centerLongitude: 16.3738,
    radiusKm: 65,
    locations: [
      ["stephansplatz", "Stephansplatz, Vienna, Austria", 48.2085, 16.3731],
      ["vie", "Vienna International Airport (VIE), Austria", 48.1103, 16.5697],
      ["wien_hbf", "Wien Hauptbahnhof, Vienna, Austria", 48.1859, 16.3781],
      ["museumsquartier", "MuseumsQuartier, Vienna, Austria", 48.2032, 16.3591],
      ["prater", "Prater, Vienna, Austria", 48.2167, 16.3956],
      ["schonbrunn", "Schonbrunn Palace, Vienna, Austria", 48.1845, 16.3122]
    ]
  },
  {
    id: "zurich",
    name: "Zurich",
    region: "Switzerland",
    centerLatitude: 47.3769,
    centerLongitude: 8.5417,
    radiusKm: 60,
    locations: [
      ["zurich_hb", "Zurich Hauptbahnhof, Switzerland", 47.3780, 8.5402],
      ["zrh", "Zurich Airport (ZRH), Switzerland", 47.4582, 8.5555],
      ["bahnhofstrasse", "Bahnhofstrasse, Zurich, Switzerland", 47.3697, 8.5392],
      ["zurich_west", "Zurich West, Switzerland", 47.3875, 8.5176],
      ["seefeld", "Seefeld, Zurich, Switzerland", 47.3564, 8.5545],
      ["eth_zurich", "ETH Zurich, Switzerland", 47.3763, 8.5480]
    ]
  }
];

const enabledServiceCityIds = [
  "los_angeles",
  "san_diego",
  "san_jose",
  "sf_bay",
  "new_york",
  "buffalo",
  "rochester_ny",
  "chicago",
  "aurora_il",
  "naperville_il",
  "washington_dc",
  "arlington_va",
  "seattle",
  "dallas",
  "houston",
  "san_antonio",
  "detroit",
  "grand_rapids",
  "warren_mi",
  "ann_arbor"
];

const addedServiceCities = [
  {
    id: "aurora_il",
    name: "Aurora",
    region: "IL",
    centerLatitude: 41.7606,
    centerLongitude: -88.3201,
    radiusKm: 45,
    locations: [
      ["downtown_aurora_il", "Downtown Aurora, IL", 41.7606, -88.3201],
      ["aurora_transportation_center", "Aurora Transportation Center, Aurora, IL", 41.7545, -88.3157],
      ["paramount_theatre_aurora", "Paramount Theatre, Aurora, IL", 41.7583, -88.3148],
      ["fox_valley_mall", "Fox Valley Mall, Aurora, IL", 41.7585, -88.2122],
      ["aurora_university", "Aurora University, Aurora, IL", 41.7530, -88.3490],
      ["waubonsee_aurora", "Waubonsee Community College Aurora Downtown, IL", 41.7565, -88.3159],
      ["rivers_edge_park_aurora", "RiverEdge Park, Aurora, IL", 41.7588, -88.3116]
    ]
  },
  {
    id: "naperville_il",
    name: "Naperville",
    region: "IL",
    centerLatitude: 41.7508,
    centerLongitude: -88.1535,
    radiusKm: 45,
    locations: [
      ["downtown_naperville", "Downtown Naperville, IL", 41.7750, -88.1486],
      ["naperville_station", "Naperville Metra Station, Naperville, IL", 41.7791, -88.1459],
      ["north_central_college", "North Central College, Naperville, IL", 41.7754, -88.1420],
      ["riverwalk_naperville", "Naperville Riverwalk, Naperville, IL", 41.7726, -88.1506],
      ["edward_hospital", "Edward Hospital, Naperville, IL", 41.7618, -88.1535],
      ["naper_settlement", "Naper Settlement, Naperville, IL", 41.7718, -88.1535],
      ["95th_street_library", "95th Street Library, Naperville, IL", 41.7086, -88.1972]
    ]
  },
  {
    id: "arlington_va",
    name: "Arlington",
    region: "DC",
    centerLatitude: 38.8797,
    centerLongitude: -77.1068,
    radiusKm: 40,
    locations: [
      ["downtown_arlington_va", "Downtown Arlington, VA", 38.8797, -77.1068],
      ["rosslyn", "Rosslyn, Arlington, VA", 38.8967, -77.0728],
      ["crystal_city", "Crystal City, Arlington, VA", 38.8576, -77.0502],
      ["pentagon_city", "Pentagon City, Arlington, VA", 38.8629, -77.0595],
      ["ballston", "Ballston, Arlington, VA", 38.8829, -77.1116],
      ["national_airport", "Ronald Reagan Washington National Airport (DCA), VA", 38.8512, -77.0402],
      ["arlington_courthouse", "Arlington Courthouse, Arlington, VA", 38.8904, -77.0830]
    ]
  },
  {
    id: "alexandria_va",
    name: "Alexandria",
    region: "DC",
    centerLatitude: 38.8048,
    centerLongitude: -77.0469,
    radiusKm: 40,
    locations: [
      ["old_town_alexandria", "Old Town Alexandria, VA", 38.8048, -77.0469],
      ["king_street_station", "King Street-Old Town Station, Alexandria, VA", 38.8065, -77.0611],
      ["alexandria_waterfront", "Alexandria Waterfront, Alexandria, VA", 38.8033, -77.0392],
      ["carlyle_alexandria", "Carlyle, Alexandria, VA", 38.8059, -77.0631],
      ["del_ray", "Del Ray, Alexandria, VA", 38.8296, -77.0608],
      ["inova_alexandria", "Inova Alexandria Hospital, Alexandria, VA", 38.8248, -77.1056],
      ["george_washington_masonic", "George Washington Masonic National Memorial, Alexandria, VA", 38.8075, -77.0659]
    ]
  },
  {
    id: "ann_arbor",
    name: "Ann Arbor",
    region: "MI",
    centerLatitude: 42.2808,
    centerLongitude: -83.7430,
    radiusKm: 45,
    locations: [
      ["downtown_ann_arbor", "Downtown Ann Arbor, MI", 42.2808, -83.7430],
      ["university_michigan", "University of Michigan, Ann Arbor, MI", 42.2780, -83.7382],
      ["michigan_stadium", "Michigan Stadium, Ann Arbor, MI", 42.2658, -83.7487],
      ["briarwood_mall", "Briarwood Mall, Ann Arbor, MI", 42.2417, -83.7462],
      ["ann_arbor_station", "Ann Arbor Amtrak Station, Ann Arbor, MI", 42.2862, -83.7445],
      ["umich_hospital", "University of Michigan Hospital, Ann Arbor, MI", 42.2835, -83.7274],
      ["kerrytown", "Kerrytown, Ann Arbor, MI", 42.2834, -83.7460]
    ]
  }
];

const serviceCities = [...rawServiceCities, ...addedServiceCities]
  .filter((city) => enabledServiceCityIds.includes(city.id))
  .sort((a, b) => enabledServiceCityIds.indexOf(a.id) - enabledServiceCityIds.indexOf(b.id));

const locations = Object.fromEntries(
  serviceCities.flatMap((city) =>
    city.locations.map(([key, address, latitude, longitude]) => [
      key,
      { id: key, cityId: city.id, address, latitude, longitude }
    ])
  )
);

function user(id, name, email, phone, role) {
  const createdAt = now();
  return {
    id,
    name,
    email,
    phone,
    passwordHash: hashPassword(sharedPassword),
    role,
    profileImageUrl: "",
    isVerified: true,
    createdAt,
    updatedAt: createdAt
  };
}

function driverProfile({
  id,
  userId,
  licenseNumber,
  vehicleMake,
  vehicleModel,
  vehicleYear,
  licensePlate,
  vehicleColor,
  verificationStatus = "approved",
  driverStatus = "online",
  currentLatitude,
  currentLongitude,
  averageRating = 4.9,
  totalTrips = 0,
  createdAt
}) {
  return {
    id,
    userId,
    licenseNumber,
    vehicleMake,
    vehicleModel,
    vehicleYear,
    licensePlate,
    vehicleColor,
    verificationStatus,
    driverStatus,
    currentLatitude,
    currentLongitude,
    averageRating,
    totalTrips,
    createdAt,
    updatedAt: createdAt
  };
}

function isoDaysAgo(daysAgo, hour = 9, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function fareForRide(distanceKm, durationMinutes, tierMultiplier = 1, surgeMultiplier = 1, discountAmount = 0) {
  const baseFare = 4.5;
  const distanceFare = Number((Math.max(distanceKm, 0.6) * 1.85 * tierMultiplier).toFixed(2));
  const timeFare = Number((Math.max(durationMinutes, 5) * 0.32 * tierMultiplier).toFixed(2));
  const serviceFee = Number((1.75 * tierMultiplier).toFixed(2));
  const subtotalBeforeDiscount = Number(((baseFare + distanceFare + timeFare + serviceFee) * surgeMultiplier).toFixed(2));
  const estimatedTotal = Number(Math.max(8, subtotalBeforeDiscount - discountAmount).toFixed(2));
  return {
    baseFare,
    distanceFare,
    timeFare,
    serviceFee,
    surgeMultiplier,
    subtotalBeforeDiscount,
    discountAmount,
    estimatedTotal,
    currencyCode: "USD",
    currencySymbol: "$",
    currencyDecimals: 2
  };
}

function timelineForRide(status, createdAt, { driverCancelled = false } = {}) {
  const at = (minutes) => new Date(Date.parse(createdAt) + minutes * 60 * 1000).toISOString();
  const timeline = [
    { status: "requested", label: "Ride requested", at: at(0) },
    { status: "searching", label: "Searching for nearby approved drivers", at: at(1) }
  ];
  if (status === "cancelled") {
    timeline.push({ status: "cancelled", label: driverCancelled ? "Driver cancelled" : "Rider cancelled", at: at(4) });
    return timeline;
  }
  timeline.push(
    { status: "accepted", label: "Driver accepted", at: at(3) },
    { status: "driver_arriving", label: "Driver en route", at: at(4) },
    { status: "arrived", label: "Driver arrived", at: at(10) },
    { status: "in_progress", label: "Trip started", at: at(12) },
    { status: "completed", label: "Trip completed", at: at(26) }
  );
  return timeline;
}

function buildThreeMonthRiderExperience({ rider, drivers, driverProfiles }) {
  const driverById = new Map(drivers.map((item) => [item.id, item]));
  const sfDriverProfiles = driverProfiles.filter((profile) =>
    ["drv_profile_primary", "drv_profile_second", "drv_profile_sf"].includes(profile.id)
  );
  const favoritePlaces = [
    { id: "place_rider_home", label: "Home", address: "Downtown Palo Alto, CA", latitude: 37.4419, longitude: -122.1430, lastUsedAt: isoDaysAgo(2, 18), usageCount: 18, pinned: true },
    { id: "place_rider_work", label: "Work", address: "Meta MPK 23, 300 Constitution Drive, Menlo Park, CA", latitude: 37.4803, longitude: -122.1669, lastUsedAt: isoDaysAgo(1, 9), usageCount: 21, pinned: true },
    { id: "place_rider_school", label: "School", address: locations.stanford.address, latitude: locations.stanford.latitude, longitude: locations.stanford.longitude, lastUsedAt: isoDaysAgo(9, 14), usageCount: 6, pinned: false },
    { id: "place_rider_gym", label: "Gym", address: "Equinox Palo Alto, 440 Portage Avenue, Palo Alto, CA", latitude: 37.4266, longitude: -122.1450, lastUsedAt: isoDaysAgo(5, 20), usageCount: 8, pinned: false },
    { id: "place_rider_airport", label: "Airport", address: locations.sfo.address, latitude: locations.sfo.latitude, longitude: locations.sfo.longitude, lastUsedAt: isoDaysAgo(14, 6), usageCount: 4, pinned: true },
    { id: "place_rider_restaurant", label: "Favorite restaurant", address: "Evvia Estiatorio, 420 Emerson Street, Palo Alto, CA", latitude: 37.4441, longitude: -122.1631, lastUsedAt: isoDaysAgo(3, 22), usageCount: 7, pinned: false },
    { id: "place_rider_mall", label: "Mall", address: "Stanford Shopping Center, Palo Alto, CA", latitude: 37.4432, longitude: -122.1716, lastUsedAt: isoDaysAgo(6, 16), usageCount: 5, pinned: false },
    { id: "place_rider_friend", label: "Friend's place", address: "Castro Street, Mountain View, CA", latitude: 37.3947, longitude: -122.0781, lastUsedAt: isoDaysAgo(11, 21), usageCount: 4, pinned: false }
  ];
  const byLabel = Object.fromEntries(favoritePlaces.map((place) => [place.label, place]));
  const scenarios = [
    ["home_to_work", 3, 8, byLabel.Home, byLabel.Work, "standard", "COMMUTE15", 5, "Smooth commute."],
    ["work_to_home", 5, 18, byLabel.Work, byLabel.Home, "plus", "", 5, "Driver knew the best route."],
    ["restaurant_home_night", 8, 23, byLabel["Favorite restaurant"], byLabel.Home, "priority", "NIGHT12", 4, "Late-night pickup felt safe."],
    ["school_mall", 10, 15, byLabel.School, byLabel.Mall, "green", "", 5, "Clean EV."],
    ["airport_dropoff", 14, 6, byLabel.Home, byLabel.Airport, "xl", "AIRPORT10", 5, "Plenty of room for bags."],
    ["airport_return", 17, 20, byLabel.Airport, byLabel.Home, "plus", "", 4, "Pickup area was busy."],
    ["gym_home", 20, 21, byLabel.Gym, byLabel.Home, "standard", "", 5, "Quick short trip."],
    ["friend_home", 22, 22, byLabel["Friend's place"], byLabel.Home, "standard", "", 5, "On time."],
    ["work_mall_surge", 25, 17, byLabel.Work, byLabel.Mall, "priority", "", 4, "Price was higher during rush hour.", { surge: 1.22, support: "price issue" }],
    ["home_school", 28, 13, byLabel.Home, byLabel.School, "green", "", 5, "Good route."],
    ["cancel_wrong_stop", 30, 10, byLabel.Home, byLabel.Gym, "standard", "", null, "", { status: "cancelled", cancelledBy: "rider" }],
    ["driver_cancelled", 33, 19, byLabel.Work, byLabel.Home, "plus", "", null, "", { status: "cancelled", cancelledBy: "driver" }],
    ["payment_retry", 36, 9, byLabel.Home, byLabel.Work, "standard", "COMMUTE15", 5, "Payment retry worked.", { paymentRetry: true }],
    ["lost_item", 39, 18, byLabel.Mall, byLabel.Home, "standard", "", 3, "Left a water bottle.", { support: "lost item" }],
    ["safety_feedback", 42, 23, byLabel["Favorite restaurant"], byLabel.Home, "priority", "NIGHT12", 2, "Driver missed a turn repeatedly.", { support: "safety concern" }],
    ["home_work_2", 45, 8, byLabel.Home, byLabel.Work, "standard", "COMMUTE15", 5, "Reliable commute."],
    ["work_home_2", 47, 18, byLabel.Work, byLabel.Home, "standard", "", null, "", { unrated: true }],
    ["short_restaurant", 50, 12, byLabel.Home, byLabel["Favorite restaurant"], "standard", "", 5, "Very short ride."],
    ["long_sf", 53, 7, byLabel.Home, { address: locations.downtown_sf.address, latitude: locations.downtown_sf.latitude, longitude: locations.downtown_sf.longitude }, "xl", "", 4, "Long but comfortable."],
    ["mall_friend", 56, 16, byLabel.Mall, byLabel["Friend's place"], "plus", "", 5, "Good car."],
    ["weekend_coupon", 59, 11, byLabel.Home, byLabel.Mall, "green", "WEEKEND8", 5, "Weekend coupon applied."],
    ["gym_work", 62, 8, byLabel.Gym, byLabel.Work, "standard", "", 4, "Driver was polite."],
    ["home_airport_cancel", 65, 5, byLabel.Home, byLabel.Airport, "xl", "AIRPORT10", null, "", { status: "cancelled", cancelledBy: "rider" }],
    ["restaurant_friend", 68, 22, byLabel["Favorite restaurant"], byLabel["Friend's place"], "priority", "NIGHT12", 5, "Safe night ride."],
    ["work_school", 71, 13, byLabel.Work, byLabel.School, "plus", "", 5, "Quiet ride."],
    ["home_work_3", 74, 8, byLabel.Home, byLabel.Work, "standard", "COMMUTE15", 5, "On time."],
    ["work_home_3", 76, 18, byLabel.Work, byLabel.Home, "standard", "", 4, "Traffic was heavy."],
    ["airport_long", 79, 6, byLabel.Home, byLabel.Airport, "xl", "AIRPORT10", 5, "Airport pickup instructions were clear."],
    ["mall_home", 82, 17, byLabel.Mall, byLabel.Home, "standard", "", null, "", { unrated: true }],
    ["school_home", 85, 15, byLabel.School, byLabel.Home, "green", "", 5, "Good electric car."],
    ["friend_gym", 88, 10, byLabel["Friend's place"], byLabel.Gym, "standard", "", 4, "Simple trip."],
    ["home_restaurant", 90, 19, byLabel.Home, byLabel["Favorite restaurant"], "plus", "", 5, "Dinner pickup."],
    ["privacy_policy_trip", 12, 8, byLabel.Home, byLabel.Work, "standard", "", 5, "Routine ride."],
    ["invoice_trip", 18, 8, byLabel.Home, byLabel.Work, "standard", "COMMUTE15", 5, "Invoice needed.", { invoice: true }],
    ["refund_trip", 31, 18, byLabel.Work, byLabel.Home, "standard", "", 3, "Fare adjustment requested.", { refund: true, support: "payment issue" }],
    ["late_driver", 7, 18, byLabel.Work, byLabel.Home, "priority", "", 3, "Driver arrived late.", { support: "driver issue" }]
  ];

  const tierMultipliers = { standard: 1, plus: 1.28, priority: 1.45, green: 1.12, xl: 1.65 };
  const promoDiscounts = { COMMUTE15: 2.25, AIRPORT10: 5.5, NIGHT12: 3.25, WEEKEND8: 2.0 };
  const tierTitles = { standard: "Standard", plus: "Plus", priority: "Priority pickup", green: "Green", xl: "XL" };
  const commentsByScore = {
    2: "Reported issue to support.",
    3: "Trip completed but needs improvement.",
    4: "Good ride overall.",
    5: "Great ride."
  };

  const rides = [];
  const payments = [];
  const ratings = [];
  const supportTickets = [];
  const notifications = [];
  const invoices = [];
  const refunds = [];

  scenarios.forEach((scenario, index) => {
    const [key, daysAgo, hour, pickup, destination, tier, promoCode, score, comment, options = {}] = scenario;
    const createdAt = isoDaysAgo(daysAgo, hour, (index * 7) % 55);
    const profile = sfDriverProfiles[index % sfDriverProfiles.length];
    const driver = driverById.get(profile.userId);
    const distance = calculateHaversineDistance(pickup, destination);
    const duration = estimateTripDuration(distance, hour >= 17 && hour <= 19 ? 18 : 24);
    const discount = promoCode ? promoDiscounts[promoCode] || 1.5 : 0;
    const fareBreakdown = {
      ...fareForRide(distance, duration, tierMultipliers[tier] || 1, options.surge || 1, discount),
      promoCode,
      promoTitle: promoCode ? `${promoCode} ride credit` : "",
      rideTier: tier,
      rideTierTitle: tierTitles[tier] || "Standard"
    };
    const status = options.status || "completed";
    const ride = {
      id: `ride_three_month_${key}`,
      riderId: rider.id,
      driverId: status === "cancelled" && options.cancelledBy === "driver" ? profile.userId : profile.userId,
      pickupAddress: pickup.address,
      pickupLatitude: pickup.latitude,
      pickupLongitude: pickup.longitude,
      destinationAddress: destination.address,
      destinationLatitude: destination.latitude,
      destinationLongitude: destination.longitude,
      status,
      rideTier: tier,
      rideTierTitle: tierTitles[tier] || "Standard",
      estimatedDistance: distance,
      estimatedDuration: duration,
      estimatedFare: fareBreakdown.estimatedTotal,
      currencyCode: "USD",
      currencySymbol: "$",
      currencyDecimals: 2,
      finalDistance: status === "completed" ? distance : null,
      finalDuration: status === "completed" ? duration : null,
      finalFare: status === "completed" ? fareBreakdown.estimatedTotal : null,
      fareBreakdown,
      promoCode,
      discountAmount: discount,
      paymentMethod: index % 5 === 0 ? "pm_rider_paypal" : index % 4 === 0 ? "pm_rider_wallet" : "pm_rider_visa",
      paymentStatus: status === "completed" ? "paid" : "cancelled",
      cancellationReason: status === "cancelled" ? (options.cancelledBy === "driver" ? "Driver cancelled before pickup" : "Rider cancelled before pickup") : "",
      rejectedDriverIds: [],
      scheduledFor: "",
      timeline: timelineForRide(status, createdAt, { driverCancelled: options.cancelledBy === "driver" }),
      createdAt,
      acceptedAt: status === "completed" ? new Date(Date.parse(createdAt) + 3 * 60 * 1000).toISOString() : null,
      startedAt: status === "completed" ? new Date(Date.parse(createdAt) + 12 * 60 * 1000).toISOString() : null,
      completedAt: status === "completed" ? new Date(Date.parse(createdAt) + duration * 60 * 1000).toISOString() : null,
      cancelledAt: status === "cancelled" ? new Date(Date.parse(createdAt) + 4 * 60 * 1000).toISOString() : null,
      invoiceStatus: options.invoice ? "issued" : index % 7 === 0 ? "eligible" : "",
      contactedSupport: Boolean(options.support),
      abnormalFlag: Boolean(options.support || options.paymentRetry || options.surge)
    };
    rides.push(ride);

    if (status === "completed") {
      if (options.paymentRetry) {
        payments.push({
          id: `pay_three_month_${key}_failed`,
          rideId: ride.id,
          riderId: rider.id,
          driverId: profile.userId,
          amount: fareBreakdown.estimatedTotal,
          platformFee: 0,
          driverEarnings: 0,
          currencyCode: "USD",
          currencySymbol: "$",
          currencyDecimals: 2,
          paymentMethod: ride.paymentMethod,
          providerPaymentId: `processor_failed_${key}`,
          status: "failed",
          failureReason: "Issuer declined first attempt",
          createdAt: new Date(Date.parse(createdAt) + 27 * 60 * 1000).toISOString()
        });
      }
      const platformFee = Number((fareBreakdown.estimatedTotal * 0.18).toFixed(2));
      payments.push({
        id: `pay_three_month_${key}`,
        rideId: ride.id,
        riderId: rider.id,
        driverId: profile.userId,
        amount: fareBreakdown.estimatedTotal,
        platformFee,
        driverEarnings: Number((fareBreakdown.estimatedTotal - platformFee).toFixed(2)),
        currencyCode: "USD",
        currencySymbol: "$",
        currencyDecimals: 2,
        paymentMethod: ride.paymentMethod,
        providerPaymentId: `processor_${key}`,
        status: "paid",
        createdAt: new Date(Date.parse(createdAt) + 28 * 60 * 1000).toISOString()
      });
      if (score && !options.unrated) {
        ratings.push({
          id: `rating_three_month_${key}`,
          rideId: ride.id,
          fromUserId: rider.id,
          toUserId: profile.userId,
          score,
          comment: comment || commentsByScore[score],
          createdAt: new Date(Date.parse(createdAt) + 45 * 60 * 1000).toISOString()
        });
      }
      if (options.invoice) {
        invoices.push({
          id: `invoice_three_month_${key}`,
          rideId: ride.id,
          userId: rider.id,
          title: "Riley Rider",
          email: rider.email,
          status: "issued",
          amount: fareBreakdown.estimatedTotal,
          createdAt: new Date(Date.parse(createdAt) + 60 * 60 * 1000).toISOString()
        });
      }
      if (options.refund) {
        refunds.push({
          id: `refund_three_month_${key}`,
          rideId: ride.id,
          userId: rider.id,
          amount: 4.25,
          reason: "Fare adjustment after support review",
          status: "approved",
          createdAt: new Date(Date.parse(createdAt) + 2 * 60 * 60 * 1000).toISOString()
        });
      }
    }

    if (options.support) {
      supportTickets.push({
        id: `ticket_three_month_${key}`,
        userId: rider.id,
        rideId: ride.id,
        category: options.support,
        message: `${options.support}: ${comment || "Please review this ride."}`,
        status: options.support === "safety concern" ? "resolved" : "closed",
        createdAt: new Date(Date.parse(createdAt) + 50 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.parse(createdAt) + 4 * 60 * 60 * 1000).toISOString()
      });
    }

  });
  const userCoupons = [];

  return {
    rides,
    payments,
    ratings,
    supportTickets,
    notifications,
    invoices,
    refunds,
    userCoupons,
    savedPlaces: favoritePlaces.map((place) => ({
      id: place.id,
      userId: rider.id,
      label: place.label,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      lastUsedAt: place.lastUsedAt,
      usageCount: place.usageCount,
      pinned: place.pinned,
      createdAt: isoDaysAgo(89, 9),
      updatedAt: place.lastUsedAt
    }))
  };
}

function createSeedData() {
  const createdAt = now();
  const rider = user("usr_rider_primary", "Riley Rider", "rider@example.com", "+1555010101", "rider");
  const rider2 = user("usr_rider_second", "Jordan Lee", "rider2@example.com", "+1555010102", "rider");
  const rider3 = user("usr_rider_third", "Ava Chen", "rider3@example.com", "+1555010301", "rider");
  const driver = user("usr_driver_primary", "Maya Rodriguez", "driver@example.com", "+13235550147", "driver");
  const driver2 = user("usr_driver_second", "Owen Patel", "driver2@example.com", "+12135550182", "driver");
  const driver3 = user("usr_driver_third", "Elena Park", "driver3@example.com", "+1555031001", "driver");
  const pending = user("usr_driver_pending", "Nora Pending", "pending-driver@example.com", "+1555020203", "driver");
  const admin = user("usr_admin_primary", "Ops Admin", "admin@example.com", "+1555090909", "admin");
  const networkDrivers = [
    user("usr_driver_nyc", "Avery NYC", "nyc-driver@example.com", "+1555030001", "driver"),
    user("usr_driver_chicago", "Sam Chicago", "chicago-driver@example.com", "+1555030002", "driver"),
    user("usr_driver_sf", "Casey Bay", "sf-driver@example.com", "+1555030003", "driver"),
    user("usr_driver_dc", "Morgan DC", "dc-driver@example.com", "+1555030004", "driver"),
    user("usr_driver_dallas", "Quinn Dallas", "dallas-driver@example.com", "+1555030007", "driver")
  ];
  const manualNetworkDriverCityIds = new Set([
    "los_angeles",
    "new_york",
    "chicago",
    "sf_bay",
    "washington_dc",
    "dallas"
  ]);
  const globalDriverCities = serviceCities.filter((city) => !manualNetworkDriverCityIds.has(city.id));
  const globalNetworkDrivers = globalDriverCities.map((city, index) =>
    user(
      `usr_driver_${city.id}`,
      `${city.name} Driver`,
      `${city.id.replaceAll("_", "-")}-driver@example.com`,
      `+155504${String(index + 1).padStart(4, "0")}`,
      "driver"
    )
  );

  const completedRide = {
    id: "ride_seed_completed",
    riderId: rider2.id,
    driverId: driver2.id,
    pickupAddress: locations.times_square.address,
    pickupLatitude: locations.times_square.latitude,
    pickupLongitude: locations.times_square.longitude,
    destinationAddress: locations.nyu.address,
    destinationLatitude: locations.nyu.latitude,
    destinationLongitude: locations.nyu.longitude,
    status: "completed",
    estimatedDistance: 3.3,
    estimatedDuration: 15,
    estimatedFare: 17.36,
    currencyCode: "USD",
    currencySymbol: "$",
    currencyDecimals: 2,
    finalDistance: 3.3,
    finalDuration: 15,
    finalFare: 17.36,
    fareBreakdown: { baseFare: 4.5, distanceFare: 6.11, timeFare: 4.8, serviceFee: 1.75, surgeMultiplier: 1, estimatedTotal: 17.36 },
    paymentMethod: "card_on_file",
    paymentStatus: "paid",
    cancellationReason: "",
    rejectedDriverIds: [],
    timeline: [
      { status: "requested", label: "Ride requested", at: createdAt },
      { status: "searching", label: "Searching for a driver", at: createdAt },
      { status: "accepted", label: "Driver accepted", at: createdAt },
      { status: "driver_arriving", label: "Driver en route", at: createdAt },
      { status: "arrived", label: "Driver arrived", at: createdAt },
      { status: "in_progress", label: "Trip started", at: createdAt },
      { status: "completed", label: "Trip completed", at: createdAt }
    ],
    createdAt,
    acceptedAt: createdAt,
    startedAt: createdAt,
    completedAt: createdAt,
    cancelledAt: null
  };

  const driverProfiles = [
      driverProfile({
        id: "drv_profile_primary",
        userId: driver.id,
        licenseNumber: "NY-DL-100492",
        vehicleMake: "Tesla",
        vehicleModel: "Model Y",
        vehicleYear: 2023,
        licensePlate: "8XJR214",
        vehicleColor: "Pearl White",
        verificationStatus: "approved",
        driverStatus: "online",
        currentLatitude: 34.0646,
        currentLongitude: -118.2379,
        averageRating: 4.92,
        totalTrips: 128,
        createdAt
      }),
      driverProfile({
        id: "drv_profile_second",
        userId: driver2.id,
        licenseNumber: "NY-DL-204882",
        vehicleMake: "Hyundai",
        vehicleModel: "Ioniq 5",
        vehicleYear: 2023,
        licensePlate: "NYC-2048",
        vehicleColor: "Midnight Black",
        verificationStatus: "approved",
        driverStatus: "online",
        currentLatitude: 40.7549,
        currentLongitude: -73.9840,
        averageRating: 4.87,
        totalTrips: 94,
        createdAt
      }),
      driverProfile({
        id: "drv_profile_pending",
        userId: pending.id,
        licenseNumber: "",
        vehicleMake: "Tesla",
        vehicleModel: "Model 3",
        vehicleYear: 2023,
        licensePlate: "EV-2094",
        vehicleColor: "Blue",
        verificationStatus: "pending",
        driverStatus: "offline",
        currentLatitude: 34.0207,
        currentLongitude: -118.2854,
        averageRating: 5,
        totalTrips: 0,
        createdAt
      }),
      driverProfile({
        id: "drv_profile_third",
        userId: driver3.id,
        licenseNumber: "WA-DL-778210",
        vehicleMake: "Rivian",
        vehicleModel: "R1S",
        vehicleYear: 2024,
        licensePlate: "SEA-7782",
        vehicleColor: "Forest Green",
        verificationStatus: "approved",
        driverStatus: "online",
        currentLatitude: 47.6110,
        currentLongitude: -122.3370,
        averageRating: 4.98,
        totalTrips: 243,
        createdAt
      }),
      driverProfile({ id: "drv_profile_nyc", userId: "usr_driver_nyc", licenseNumber: "NY-DL-304812", vehicleMake: "Hyundai", vehicleModel: "Ioniq 5", vehicleYear: 2023, licensePlate: "NYC-8104", vehicleColor: "White", currentLatitude: 40.7549, currentLongitude: -73.9840, averageRating: 4.96, totalTrips: 212, createdAt }),
      driverProfile({ id: "drv_profile_chicago", userId: "usr_driver_chicago", licenseNumber: "IL-DL-540122", vehicleMake: "Toyota", vehicleModel: "RAV4", vehicleYear: 2022, licensePlate: "CHI-5127", vehicleColor: "Blue", currentLatitude: 41.8836, currentLongitude: -87.6320, averageRating: 4.89, totalTrips: 166, createdAt }),
      driverProfile({ id: "drv_profile_sf", userId: "usr_driver_sf", licenseNumber: "CA-DL-782014", vehicleMake: "Tesla", vehicleModel: "Model Y", vehicleYear: 2023, licensePlate: "BAY-6049", vehicleColor: "Red", currentLatitude: 37.7890, currentLongitude: -122.4010, averageRating: 4.94, totalTrips: 198, createdAt }),
      driverProfile({ id: "drv_profile_dc", userId: "usr_driver_dc", licenseNumber: "DC-DL-140822", vehicleMake: "Honda", vehicleModel: "CR-V", vehicleYear: 2021, licensePlate: "DC-2481", vehicleColor: "Gray", currentLatitude: 38.8974, currentLongitude: -77.0320, averageRating: 4.91, totalTrips: 142, createdAt }),
      driverProfile({ id: "drv_profile_dallas", userId: "usr_driver_dallas", licenseNumber: "TX-DL-391804", vehicleMake: "Ford", vehicleModel: "Escape", vehicleYear: 2022, licensePlate: "DFW-6620", vehicleColor: "Silver", currentLatitude: 32.7810, currentLongitude: -96.7990, averageRating: 4.86, totalTrips: 119, createdAt }),
      ...globalDriverCities.map((city, index) =>
        driverProfile({
          id: `drv_profile_${city.id}`,
          userId: `usr_driver_${city.id}`,
          licenseNumber: `GL-${String(index + 1).padStart(5, "0")}`,
          vehicleMake: ["Toyota", "Hyundai", "Tesla", "Honda", "Kia", "Nissan"][index % 6],
          vehicleModel: ["Camry", "Ioniq 5", "Model Y", "CR-V", "Telluride", "Altima"][index % 6],
          vehicleYear: 2021 + (index % 3),
          licensePlate: city.id.slice(0, 3).toUpperCase().padEnd(3, "X") + `-${String(4100 + index)}`,
          vehicleColor: ["White", "Black", "Silver", "Blue", "Gray"][index % 5],
          currentLatitude: Number((city.centerLatitude + 0.012).toFixed(6)),
          currentLongitude: Number((city.centerLongitude - 0.012).toFixed(6)),
          averageRating: Number((4.85 + (index % 10) * 0.01).toFixed(2)),
          totalTrips: 80 + index * 7,
          createdAt
        })
      )
    ];
  const riderExperience = buildThreeMonthRiderExperience({
    rider,
    drivers: [driver, driver2, driver3, ...networkDrivers, ...globalNetworkDrivers],
    driverProfiles
  });
  const extraSavedPlaces = [
    { id: "place_rider_second_home", userId: rider2.id, label: "Home", address: "Upper West Side, New York, NY", latitude: 40.7870, longitude: -73.9754, usageCount: 12, pinned: true, createdAt: isoDaysAgo(28, 8), updatedAt: isoDaysAgo(1, 18) },
    { id: "place_rider_second_work", userId: rider2.id, label: "Work", address: locations.times_square.address, latitude: locations.times_square.latitude, longitude: locations.times_square.longitude, usageCount: 16, pinned: true, createdAt: isoDaysAgo(28, 8), updatedAt: isoDaysAgo(2, 8) },
    { id: "place_rider_second_grocery", userId: rider2.id, label: "Grocery", address: "Chelsea Market, New York, NY", latitude: 40.7424, longitude: -74.0060, usageCount: 5, pinned: false, createdAt: isoDaysAgo(18, 12), updatedAt: isoDaysAgo(3, 17) },
    { id: "place_rider_third_home", userId: rider3.id, label: "Home", address: "Capitol Hill, Seattle, WA", latitude: 47.6253, longitude: -122.3222, usageCount: 10, pinned: true, createdAt: isoDaysAgo(21, 8), updatedAt: isoDaysAgo(1, 19) },
    { id: "place_rider_third_work", userId: rider3.id, label: "Work", address: locations.downtown_seattle.address, latitude: locations.downtown_seattle.latitude, longitude: locations.downtown_seattle.longitude, usageCount: 14, pinned: true, createdAt: isoDaysAgo(21, 8), updatedAt: isoDaysAgo(2, 9) },
    { id: "place_rider_third_pharmacy", userId: rider3.id, label: "Pharmacy", address: "CVS Pharmacy, Seattle, WA", latitude: 47.6097, longitude: -122.3331, usageCount: 3, pinned: false, createdAt: isoDaysAgo(14, 12), updatedAt: isoDaysAgo(4, 16) }
  ];
  const extraUserCoupons = [
    { id: "coupon_rider_second_commute", userId: rider2.id, code: "COMMUTE15", title: "15% off commute rides", percentOff: 15, amountOff: 0, status: "available", createdAt, expiresAt: new Date(Date.parse(createdAt) + 21 * 24 * 60 * 60 * 1000).toISOString() },
    { id: "coupon_rider_third_airport", userId: rider3.id, code: "AIRPORT10", title: "10% off airport rides", percentOff: 10, amountOff: 0, status: "available", createdAt, expiresAt: new Date(Date.parse(createdAt) + 30 * 24 * 60 * 60 * 1000).toISOString() }
  ];

  return {
    meta: {
      appName: "opendriver",
      schemaVersion: 16,
      city: { name: "Global Service Network", centerLatitude: 20.0, centerLongitude: 0.0 },
      serviceCityIds: serviceCities.map((city) => city.id),
      seededAt: createdAt
    },
    users: [rider, rider2, rider3, driver, driver2, driver3, pending, admin, ...networkDrivers, ...globalNetworkDrivers],
    driverProfiles,
    rides: [...riderExperience.rides, completedRide],
    paymentMethods: [
      { id: "pm_rider_visa", userId: rider.id, type: "card", brand: "Visa", label: "Visa ending 4242", last4: "4242", isDefault: true, status: "active", createdAt },
      { id: "pm_rider_wallet", userId: rider.id, type: "wallet", brand: "Ride Cash", label: "Ride Cash balance", last4: "", isDefault: false, status: "active", createdAt },
      { id: "pm_rider_paypal", userId: rider.id, type: "paypal", brand: "PayPal", label: "PayPal rider@example.com", last4: "", isDefault: false, status: "active", createdAt },
      { id: "pm_rider_backup", userId: rider.id, type: "card", brand: "Mastercard", label: "Mastercard ending 9001", last4: "9001", isDefault: false, status: "active", createdAt },
      { id: "pm_rider_second_paypal", userId: rider2.id, type: "paypal", brand: "PayPal", label: "PayPal rider2@example.com", last4: "", isDefault: true, status: "active", createdAt },
      { id: "pm_rider_second_visa", userId: rider2.id, type: "card", brand: "Visa", label: "Visa ending 3188", last4: "3188", isDefault: false, status: "active", createdAt },
      { id: "pm_rider_third_amex", userId: rider3.id, type: "card", brand: "Amex", label: "Amex ending 1005", last4: "1005", isDefault: true, status: "active", createdAt },
      { id: "pm_rider_third_wallet", userId: rider3.id, type: "wallet", brand: "Ride Cash", label: "Ride Cash balance", last4: "", isDefault: false, status: "active", createdAt },
      { id: "pm_driver_primary", userId: driver.id, type: "card", brand: "Visa", label: "Visa ending 1881", last4: "1881", isDefault: true, status: "active", createdAt }
    ],
    savedPlaces: [...riderExperience.savedPlaces, ...extraSavedPlaces],
    promotions: [
      { code: "WELCOME20", title: "20% off your next ride", percentOff: 20, active: true, createdAt },
      { code: "AIRPORT10", title: "10% off airport rides", percentOff: 10, active: true, createdAt },
      { code: "COMMUTE15", title: "15% off commute rides", percentOff: 15, active: true, createdAt },
      { code: "NIGHT12", title: "12% off late-night rides", percentOff: 12, active: true, createdAt },
      { code: "WEEKEND8", title: "Weekend ride credit", percentOff: 8, active: true, createdAt },
      { code: "SAVE3", title: "$3 ride credit", amountOff: 3, active: true, createdAt },
      { code: "RIDE6", title: "$6 off your next ride", amountOff: 6, active: true, createdAt },
      { code: "BIG10", title: "$10 premium ride credit", amountOff: 10, active: true, createdAt }
    ],
    userCoupons: [...riderExperience.userCoupons, ...extraUserCoupons],
    payments: [
      ...riderExperience.payments,
      {
        id: "pay_seed_completed",
        rideId: completedRide.id,
        riderId: completedRide.riderId,
        driverId: completedRide.driverId,
        amount: 13.52,
        platformFee: 2.43,
        driverEarnings: 11.09,
        currencyCode: "USD",
        currencySymbol: "$",
        currencyDecimals: 2,
        paymentMethod: "card_on_file",
        providerPaymentId: "processor_seed",
        status: "paid",
        createdAt
      }
    ],
    ratings: [
      ...riderExperience.ratings,
      { id: "rating_seed", rideId: completedRide.id, fromUserId: rider2.id, toUserId: driver.id, score: 5, comment: "Great pickup.", createdAt }
    ],
    supportTickets: [
      ...riderExperience.supportTickets,
      { id: "ticket_seed", userId: rider2.id, rideId: completedRide.id, category: "payment issue", message: "Please send receipt copy.", status: "open", createdAt, updatedAt: createdAt }
    ],
    notifications: riderExperience.notifications,
    invoices: riderExperience.invoices,
    refunds: riderExperience.refunds,
    sessions: []
  };
}

module.exports = { sharedPassword, serviceCities, locations, createSeedData };

};
window.OSOmniDriverModules["./database/store"] = function(require,module,exports,process,__dirname){
const fs = require("fs");
const path = require("path");
const { createSeedData } = require("./seed");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const DB_PATH = path.join(DATA_DIR, "opendriver-db.json");

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadDb() {
  ensureDir();
  if (!fs.existsSync(DB_PATH)) {
    return resetDb();
  }
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  if (!db.meta || Number(db.meta.schemaVersion || 0) < 16) {
    return resetDb();
  }
  return db;
}

function saveDb(db) {
  ensureDir();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

function resetDb() {
  const db = createSeedData();
  saveDb(db);
  return db;
}

module.exports = { DATA_DIR, DB_PATH, loadDb, saveDb, resetDb };

};
window.OSOmniDriverModules["server"] = function(require,module,exports,process,__dirname){
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const jpeg = require("jpeg-js");
const { URL } = require("url");
const store = require("./database/store");
const seed = require("./database/seed");
const domain = require("./domain");

const PORT = Number(process.env.PORT || 4320);
const HOST = process.env.HOST || "127.0.0.1";
const AUTO_DISPATCH = process.env.AUTO_DISPATCH !== "false";
const AUTO_ACCEPT_MIN_SECONDS = Number(process.env.AUTO_ACCEPT_MIN_SECONDS || 15);
const AUTO_ACCEPT_MAX_SECONDS = Number(process.env.AUTO_ACCEPT_MAX_SECONDS || 30);
const AUTO_DRIVER_REQUEST_MIN_SECONDS = Number(process.env.AUTO_DRIVER_REQUEST_MIN_SECONDS || 15);
const AUTO_DRIVER_REQUEST_MAX_SECONDS = Number(process.env.AUTO_DRIVER_REQUEST_MAX_SECONDS || 30);
const AUTO_ARRIVE_MIN_SECONDS = Number(process.env.AUTO_ARRIVE_MIN_SECONDS || 15);
const AUTO_ARRIVE_MAX_SECONDS = Number(process.env.AUTO_ARRIVE_MAX_SECONDS || 60);
const AUTO_BOARDING_MIN_SECONDS = Number(process.env.AUTO_BOARDING_MIN_SECONDS || 5);
const AUTO_BOARDING_MAX_SECONDS = Number(process.env.AUTO_BOARDING_MAX_SECONDS || 10);
const AUTO_TRIP_MIN_SECONDS = Number(process.env.AUTO_TRIP_MIN_SECONDS || 15);
const AUTO_TRIP_MAX_SECONDS = Number(process.env.AUTO_TRIP_MAX_SECONDS || 60);
const AUTO_NEARBY_DRIVER_MAX_KM = Number(process.env.AUTO_NEARBY_DRIVER_MAX_KM || 12);
const DRIVER_ARRIVAL_MAX_KM = Number(process.env.DRIVER_ARRIVAL_MAX_KM || 0.05);
const DRIVER_COMPLETION_MAX_KM = Number(process.env.DRIVER_COMPLETION_MAX_KM || 0.05);
const MAP_TILE_STYLE = process.env.OPENDRIVER_MAP_STYLE || "osmde-retina";
const TILE_CACHE_DIR = path.join(store.DATA_DIR, "tile-cache", MAP_TILE_STYLE);
const ROAD_GRAPH_DIR = path.join(store.DATA_DIR, "road-graphs");
const ROUTE_CACHE_DIR = path.join(store.DATA_DIR, "route-cache");
const SEARCH_INDEX_PATH = path.join(store.DATA_DIR, "search-index", "places.json");
const TILE_DEBUG = process.env.OPENDRIVER_TILE_DEBUG === "true";
const TILE_ONLINE_FETCH = process.env.OPENDRIVER_ONLINE_MAPS === "true";
const TILE_FETCH_TIMEOUT_MS = Number(process.env.OPENDRIVER_TILE_FETCH_TIMEOUT_MS || 2500);
const TILE_MAX_ONLINE_FETCHES = Math.max(1, Number(process.env.OPENDRIVER_TILE_MAX_ONLINE_FETCHES || 2));
const TILE_CIRCUIT_FAILURE_THRESHOLD = Math.max(1, Number(process.env.OPENDRIVER_TILE_CIRCUIT_FAILURE_THRESHOLD || 2));
const TILE_CIRCUIT_OPEN_MS = Math.max(1000, Number(process.env.OPENDRIVER_TILE_CIRCUIT_OPEN_MS || 60000));
const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const ROUTE_ONLINE_FETCH = process.env.OPENDRIVER_ONLINE_ROUTES === "true";
const ROUTE_FETCH_TIMEOUT_MS = Number(process.env.OPENDRIVER_ROUTE_FETCH_TIMEOUT_MS || 2500);
const TARGET_SERVICE_CITY_IDS = new Set([
  "los_angeles",
  "san_diego",
  "san_jose",
  "sf_bay",
  "new_york",
  "buffalo",
  "rochester_ny",
  "chicago",
  "aurora_il",
  "naperville_il",
  "washington_dc",
  "arlington_va",
  "seattle",
  "dallas",
  "houston",
  "san_antonio",
  "detroit",
  "grand_rapids",
  "warren_mi",
  "ann_arbor"
]);
const pendingTiles = new Map();
const recentTileRequests = [];
const TILE_DEBUG_LIMIT = 600;
let activeOnlineTileFetches = 0;
let consecutiveOnlineTileFailures = 0;
let onlineTileCircuitOpenUntil = 0;
let roadGraphs = null;
let roadGraphsSignature = "";
let routeCaches = null;
let routeCachesSignature = "";
let searchPlaces = null;
let searchPlacesByCity = new Map();
let searchPlacesSignature = "";
const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  return value >>> 0;
});

const STATIC_MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".otf": "font/otf",
  ".bin": "application/octet-stream",
  ".frag": "text/plain; charset=utf-8"
};
const CLIENT_ROUTE_PATHS = new Set(["/auth", "/rider", "/driver", "/admin"]);

function staticContentType(filePath) {
  return STATIC_MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function staticCacheControl(filePath) {
  const fileName = path.basename(filePath);
  if (
    fileName === "index.html" ||
    fileName === "flutter_bootstrap.js" ||
    fileName === "flutter_service_worker.js" ||
    fileName === "main.dart.js" ||
    fileName === "version.json"
  ) {
    return "no-cache, no-store, must-revalidate";
  }
  return "public, max-age=31536000, immutable";
}

function serveStaticFile(req, res, requestPath) {
  if (!["GET", "HEAD"].includes(req.method)) return false;
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(requestPath.split("?")[0]);
  } catch (_error) {
    return false;
  }
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const filePath = path.normalize(path.join(PUBLIC_DIR, relativePath));
  if (!filePath.startsWith(PUBLIC_DIR)) return false;
  const targetPath = fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()
    ? path.join(filePath, "index.html")
    : filePath;
  if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) return false;

  res.writeHead(200, {
    "Content-Type": staticContentType(targetPath),
    "Cache-Control": staticCacheControl(targetPath)
  });
  if (req.method === "HEAD") {
    res.end();
    return true;
  }
  fs.createReadStream(targetPath).pipe(res);
  return true;
}

function serveClientRoute(req, res, requestPath) {
  if (!["GET", "HEAD"].includes(req.method)) return false;
  if (!CLIENT_ROUTE_PATHS.has(requestPath)) return false;
  return serveStaticFile(req, res, "/");
}
const rideTiers = [
  { id: "standard", title: "Standard", subtitle: "Everyday ride", multiplier: 1.0 },
  { id: "plus", title: "Plus", subtitle: "Roomier car", multiplier: 1.28 },
  { id: "priority", title: "Priority pickup", subtitle: "Faster pickup", multiplier: 1.45 },
  { id: "green", title: "Green", subtitle: "Hybrid or electric", multiplier: 1.12 },
  { id: "xl", title: "XL", subtitle: "Up to 6 riders", multiplier: 1.65 }
];

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function ok(res, data = {}, message = "OK", status = 200) {
  json(res, status, { success: true, data, message });
}

function fail(res, status, code, message) {
  json(res, status, { success: false, error: { code, message } });
}

function tileHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=86400",
    ...extra
  };
}

function sendTile(res, buffer, source = "cache") {
  res.writeHead(200, tileHeaders({
    "Content-Type": imageContentType(buffer),
    "Content-Length": buffer.length,
    "X-opendriver-Tile-Source": source
  }));
  res.end(buffer);
}

function imageContentType(buffer) {
  if (buffer?.[0] === 0xff && buffer?.[1] === 0xd8) return "image/jpeg";
  if (buffer?.[0] === 0x89 && buffer?.[1] === 0x50 && buffer?.[2] === 0x4e && buffer?.[3] === 0x47) return "image/png";
  return "application/octet-stream";
}

function recordTileRequest(z, x, y, source, detail = {}) {
  const entry = {
    at: new Date().toISOString(),
    z,
    x,
    y,
    source,
    ...detail
  };
  recentTileRequests.push(entry);
  if (recentTileRequests.length > TILE_DEBUG_LIMIT) {
    recentTileRequests.splice(0, recentTileRequests.length - TILE_DEBUG_LIMIT);
  }
  if (TILE_DEBUG || source !== "cache") {
    console.log(`[tile] ${z}/${x}/${y} source=${source}`);
  }
}

function tileDebugSummary() {
  const bySource = {};
  const byZoom = {};
  for (const tile of recentTileRequests) {
    bySource[tile.source] = (bySource[tile.source] || 0) + 1;
    byZoom[tile.z] = (byZoom[tile.z] || 0) + 1;
  }
  return {
    cacheDir: TILE_CACHE_DIR,
    onlineFetch: TILE_ONLINE_FETCH,
    style: MAP_TILE_STYLE,
    total: recentTileRequests.length,
    bySource,
    byZoom,
    tiles: recentTileRequests
  };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function renderOfflineTile(z, x, y) {
  const size = 256;
  const channels = 3;
  const raw = Buffer.alloc((size * channels + 1) * size);
  const palette = {
    land: [238, 242, 236],
    water: [200, 229, 232],
    park: [211, 232, 203],
    local: [210, 205, 197],
    major: [229, 190, 154],
    grid: [222, 224, 219]
  };
  const hash = ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0;
  const waterBand = (hash % 7) + 4;
  for (let py = 0; py < size; py += 1) {
    const row = py * (size * channels + 1);
    raw[row] = 0;
    for (let px = 0; px < size; px += 1) {
      const offset = row + 1 + px * channels;
      const diagonal = Math.abs(((px + py + hash) % 260) - 130);
      const parkPatch = ((Math.floor((px + hash) / 42) + Math.floor((py + hash / 3) / 42)) % 9) === 0;
      const color = diagonal < waterBand
        ? palette.water
        : parkPatch
          ? palette.park
          : palette.land;
      raw[offset] = color[0];
      raw[offset + 1] = color[1];
      raw[offset + 2] = color[2];
    }
  }

  function strokeLine(test, color, width = 1) {
    for (let py = 0; py < size; py += 1) {
      const row = py * (size * channels + 1);
      for (let px = 0; px < size; px += 1) {
        if (!test(px, py)) continue;
        for (let wy = -width; wy <= width; wy += 1) {
          for (let wx = -width; wx <= width; wx += 1) {
            const tx = px + wx;
            const ty = py + wy;
            if (tx < 0 || ty < 0 || tx >= size || ty >= size) continue;
            const offset = ty * (size * channels + 1) + 1 + tx * channels;
            raw[offset] = color[0];
            raw[offset + 1] = color[1];
            raw[offset + 2] = color[2];
          }
        }
      }
    }
  }

  strokeLine((px, py) => px % 64 === 0 || py % 64 === 0, palette.grid, 0);
  strokeLine((px, py) => Math.abs(((px * 2 + py + hash) % 180) - 90) <= 1, palette.local, 1);
  strokeLine((px, py) => Math.abs(((px - py + hash) % 220) - 110) <= 1, palette.major, 2);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 6 })),
    pngChunk("IEND")
  ]);
}

function renderTransparentTile() {
  const size = 256;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let row = 0; row < size; row += 1) {
    raw[row * (size * 4 + 1)] = 0;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND")
  ]);
}

function parsePng(buffer) {
  const signature = buffer.subarray(0, 8);
  if (!signature.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    throw new Error("Invalid PNG signature");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  let palette = null;
  let transparency = null;
  const idat = [];

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "PLTE") {
      palette = data;
    } else if (type === "tRNS") {
      transparency = data;
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  const isIndexedPng = colorType === 3;
  const supportsIndexedBitDepth = isIndexedPng && [1, 2, 4, 8].includes(bitDepth);
  if ((bitDepth !== 8 && !supportsIndexedBitDepth) || interlace !== 0) {
    throw new Error("Unsupported PNG encoding");
  }

  const channelsByType = { 2: 3, 3: 1, 6: 4 };
  const channels = channelsByType[colorType];
  if (!channels) throw new Error(`Unsupported PNG color type ${colorType}`);
  if (isIndexedPng && !palette) throw new Error("Indexed PNG is missing a palette");

  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const stride = isIndexedPng ? Math.ceil((width * bitDepth) / 8) : width * channels;
  const bytesPerPixel = isIndexedPng ? 1 : channels;
  const rgba = Buffer.alloc(width * height * 4);
  let inputOffset = 0;
  let previous = Buffer.alloc(stride);

  for (let row = 0; row < height; row += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;
    const scanline = Buffer.from(inflated.subarray(inputOffset, inputOffset + stride));
    inputOffset += stride;

    for (let index = 0; index < stride; index += 1) {
      const left = index >= bytesPerPixel ? scanline[index - bytesPerPixel] : 0;
      const up = previous[index] || 0;
      const upLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] || 0 : 0;
      let value = scanline[index];
      if (filter === 1) value = (value + left) & 0xff;
      else if (filter === 2) value = (value + up) & 0xff;
      else if (filter === 3) value = (value + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value = (value + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)) & 0xff;
      } else if (filter !== 0) {
        throw new Error(`Unsupported PNG filter ${filter}`);
      }
      scanline[index] = value;
    }

    for (let col = 0; col < width; col += 1) {
      const target = (row * width + col) * 4;
      if (colorType === 3) {
        const paletteIndex = readIndexedPngPixel(scanline, col, bitDepth);
        const paletteOffset = paletteIndex * 3;
        rgba[target] = palette?.[paletteOffset] ?? 0;
        rgba[target + 1] = palette?.[paletteOffset + 1] ?? 0;
        rgba[target + 2] = palette?.[paletteOffset + 2] ?? 0;
        rgba[target + 3] = transparency?.[paletteIndex] ?? 255;
      } else {
        const source = col * channels;
        rgba[target] = scanline[source];
        rgba[target + 1] = scanline[source + 1];
        rgba[target + 2] = scanline[source + 2];
        rgba[target + 3] = colorType === 6 ? scanline[source + 3] : 255;
      }
    }

    previous = scanline;
  }

  return { width, height, rgba };
}

function readIndexedPngPixel(scanline, col, bitDepth) {
  if (bitDepth === 8) return scanline[col];
  const pixelsPerByte = 8 / bitDepth;
  const byte = scanline[Math.floor(col / pixelsPerByte)];
  const shift = 8 - bitDepth - (col % pixelsPerByte) * bitDepth;
  return (byte >> shift) & ((1 << bitDepth) - 1);
}

function decodeTileImage(buffer) {
  if (imageContentType(buffer) === "image/png") return parsePng(buffer);
  if (imageContentType(buffer) === "image/jpeg") {
    const decoded = jpeg.decode(buffer, { useTArray: true, maxMemoryUsageInMB: 64 });
    return { width: decoded.width, height: decoded.height, rgba: Buffer.from(decoded.data) };
  }
  throw new Error("Unsupported tile image format");
}

function encodeRgbaPng(width, height, rgba) {
  const channels = 4;
  const raw = Buffer.alloc((width * channels + 1) * height);
  for (let row = 0; row < height; row += 1) {
    const rawOffset = row * (width * channels + 1);
    raw[rawOffset] = 0;
    rgba.copy(raw, rawOffset + 1, row * width * channels, (row + 1) * width * channels);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 4 })),
    pngChunk("IEND")
  ]);
}

function renderTileFromAncestor(z, x, y) {
  const minAncestorZ = Math.max(0, z - 1);
  for (let ancestorZ = z - 1; ancestorZ >= minAncestorZ; ancestorZ -= 1) {
    const scale = 2 ** (z - ancestorZ);
    const ancestorX = Math.floor(x / scale);
    const ancestorY = Math.floor(y / scale);
    const ancestorPath = cachePathForTile(ancestorZ, ancestorX, ancestorY);
    if (!fs.existsSync(ancestorPath)) continue;

    const parent = decodeTileImage(fs.readFileSync(ancestorPath));
    const outputSize = 256;
    const output = Buffer.alloc(outputSize * outputSize * 4);
    const sourceSize = parent.width / scale;
    const offsetX = (x - ancestorX * scale) * sourceSize;
    const offsetY = (y - ancestorY * scale) * sourceSize;

    for (let row = 0; row < outputSize; row += 1) {
      const sourceY = Math.min(parent.height - 1, Math.max(0, Math.floor(offsetY + (row / outputSize) * sourceSize)));
      for (let col = 0; col < outputSize; col += 1) {
        const sourceX = Math.min(parent.width - 1, Math.max(0, Math.floor(offsetX + (col / outputSize) * sourceSize)));
        const source = (sourceY * parent.width + sourceX) * 4;
        const target = (row * outputSize + col) * 4;
        output[target] = parent.rgba[source];
        output[target + 1] = parent.rgba[source + 1];
        output[target + 2] = parent.rgba[source + 2];
        output[target + 3] = parent.rgba[source + 3];
      }
    }

    return {
      buffer: encodeRgbaPng(outputSize, outputSize, output),
      source: `cache-parent-z${ancestorZ}`
    };
  }
  return null;
}

function cachePathForTile(z, x, y) {
  return path.join(TILE_CACHE_DIR, String(z), String(x), `${y}.png`);
}

async function handleMapTile(req, res, url) {
  const match = url.pathname.match(/^\/map\/tiles\/(\d+)\/(\d+)\/(\d+)(@2x)?\.png$/);
  if (!match || req.method !== "GET") return false;

  const z = Number(match[1]);
  const x = Number(match[2]);
  const y = Number(match[3]);
  const maxTile = 2 ** z;
  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) || z < 0 || z > 19 || x < 0 || y < 0 || x >= maxTile || y >= maxTile) {
    res.writeHead(400, tileHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
    res.end("Invalid tile coordinates.");
    return true;
  }

  const cachePath = cachePathForTile(z, x, y);
  if (fs.existsSync(cachePath)) {
    recordTileRequest(z, x, y, "cache");
    sendTile(res, fs.readFileSync(cachePath));
    return true;
  }

  if (!TILE_ONLINE_FETCH && process.env.OPENDRIVER_ALLOW_TILE_OVERZOOM === "true") {
    try {
      const ancestorTile = renderTileFromAncestor(z, x, y);
      if (ancestorTile) {
        recordTileRequest(z, x, y, ancestorTile.source);
        sendTile(res, ancestorTile.buffer, ancestorTile.source);
        return true;
      }
    } catch (error) {
      recordTileRequest(z, x, y, "cache-parent-error", { error: String(error?.message || error) });
    }
  }

  const pendingKey = `${z}/${x}/${y}`;
  if (pendingTiles.has(pendingKey)) {
    try {
      const result = await pendingTiles.get(pendingKey);
      recordTileRequest(z, x, y, result.source, { pending: true });
      sendTile(res, result.buffer, result.source);
    } catch (error) {
      recordTileRequest(z, x, y, "offline-error", { pending: true, error: String(error?.message || error) });
      sendTile(res, renderOfflineTile(z, x, y), "offline-error");
    }
    return true;
  }

  const loadPromise = loadTileFromProviders(z, x, y, cachePath);
  pendingTiles.set(pendingKey, loadPromise);
  try {
    const result = await loadPromise;
    recordTileRequest(z, x, y, result.source);
    sendTile(res, result.buffer, result.source);
  } catch (error) {
    recordTileRequest(z, x, y, "offline-error", { error: String(error?.message || error) });
    sendTile(res, renderOfflineTile(z, x, y), "offline-error");
  } finally {
    pendingTiles.delete(pendingKey);
  }

  return true;
}

async function loadTileFromProviders(z, x, y, cachePath) {
  if (!TILE_ONLINE_FETCH) {
    return { buffer: renderOfflineTile(z, x, y), source: "offline-generated" };
  }

  const now = Date.now();
  if (now < onlineTileCircuitOpenUntil) {
    return { buffer: renderOfflineTile(z, x, y), source: "offline-circuit-open" };
  }
  if (activeOnlineTileFetches >= TILE_MAX_ONLINE_FETCHES) {
    return { buffer: renderOfflineTile(z, x, y), source: "offline-concurrency-limit" };
  }

  activeOnlineTileFetches += 1;
  try {
    const providers = tileProviders(z, x, y);
    let result;
    if (MAP_TILE_STYLE === "osmde-retina" || MAP_TILE_STYLE === "osm-standard-retina") {
      result = await loadUpscaledRetinaTile(providers, cachePath, `online-${MAP_TILE_STYLE}`);
    } else if (MAP_TILE_STYLE === "esri-street-retina") {
      result = await loadEsriRetinaTile(z, x, y, cachePath);
    } else if (MAP_TILE_STYLE === "carto-light-retina" || MAP_TILE_STYLE === "carto-voyager-retina") {
      result = await fetchFirstAvailableTile(providers, cachePath);
    } else {
      let lastError = null;
      for (const provider of providers) {
        try {
          const buffer = await fetchTileBuffer(provider.url);
          const type = imageContentType(buffer);
          if (type !== "image/png" && type !== "image/jpeg") {
            throw new Error(`Unsupported content type from ${provider.source}: ${type}`);
          }
          if (provider.minWidth || provider.minHeight) {
            const image = decodeTileImage(buffer);
            if (provider.minWidth && image.width < provider.minWidth) {
              throw new Error(`Tile from ${provider.source} is ${image.width}px wide; expected at least ${provider.minWidth}px.`);
            }
            if (provider.minHeight && image.height < provider.minHeight) {
              throw new Error(`Tile from ${provider.source} is ${image.height}px tall; expected at least ${provider.minHeight}px.`);
            }
          }
          fs.mkdirSync(path.dirname(cachePath), { recursive: true });
          fs.writeFileSync(cachePath, buffer);
          result = { buffer, source: provider.source };
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (!result) throw lastError || new Error("No tile providers configured.");
    }

    consecutiveOnlineTileFailures = 0;
    onlineTileCircuitOpenUntil = 0;
    return result;
  } catch (error) {
    consecutiveOnlineTileFailures += 1;
    if (consecutiveOnlineTileFailures >= TILE_CIRCUIT_FAILURE_THRESHOLD) {
      onlineTileCircuitOpenUntil = Date.now() + TILE_CIRCUIT_OPEN_MS;
    }
    return {
      buffer: renderOfflineTile(z, x, y),
      source: "offline-online-error",
      error: String(error?.message || error)
    };
  } finally {
    activeOnlineTileFetches -= 1;
  }
}

async function loadEsriRetinaTile(z, x, y, cachePath) {
  const childZ = z + 1;
  const maxTile = 2 ** childZ;
  if (childZ > 23 || x * 2 + 1 >= maxTile || y * 2 + 1 >= maxTile) {
    const fallback = await loadTileFromProvider({
      source: "online-esri-street",
      url: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`
    });
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, fallback.buffer);
    return { buffer: fallback.buffer, source: "online-esri-street" };
  }

  const children = [
    { dx: 0, dy: 0, x: x * 2, y: y * 2 },
    { dx: 1, dy: 0, x: x * 2 + 1, y: y * 2 },
    { dx: 0, dy: 1, x: x * 2, y: y * 2 + 1 },
    { dx: 1, dy: 1, x: x * 2 + 1, y: y * 2 + 1 }
  ];

  const buffers = await Promise.all(children.map((child) =>
    fetchTileBuffer(
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${childZ}/${child.y}/${child.x}`
    )
  ));
  const decoded = buffers.map(decodeTileImage);
  const outputSize = 512;
  const childSize = 256;
  const output = Buffer.alloc(outputSize * outputSize * 4);

  for (let index = 0; index < decoded.length; index += 1) {
    const child = children[index];
    const image = decoded[index];
    for (let row = 0; row < childSize; row += 1) {
      const sourceRow = Math.floor((row / childSize) * image.height);
      const targetRow = child.dy * childSize + row;
      for (let col = 0; col < childSize; col += 1) {
        const sourceCol = Math.floor((col / childSize) * image.width);
        const source = (sourceRow * image.width + sourceCol) * 4;
        const target = (targetRow * outputSize + child.dx * childSize + col) * 4;
        output[target] = image.rgba[source];
        output[target + 1] = image.rgba[source + 1];
        output[target + 2] = image.rgba[source + 2];
        output[target + 3] = image.rgba[source + 3];
      }
    }
  }

  const buffer = encodeRgbaPng(outputSize, outputSize, output);
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, buffer);
  return { buffer, source: "online-esri-street-retina" };
}

async function loadUpscaledRetinaTile(providers, cachePath, source) {
  let base = null;
  let lastError = null;
  for (const provider of providers) {
    try {
      base = await loadTileFromProvider(provider);
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!base) {
    throw lastError || new Error("No tile providers configured.");
  }

  const buffer = upscaleAndEnhanceTile(base.buffer);
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, buffer);
  return { buffer, source };
}

function upscaleAndEnhanceTile(buffer) {
  const image = decodeTileImage(buffer);
  const outputSize = 512;
  const output = Buffer.alloc(outputSize * outputSize * 4);

  for (let row = 0; row < outputSize; row += 1) {
    const sourceY = Math.min(image.height - 1, Math.floor((row / outputSize) * image.height));
    for (let col = 0; col < outputSize; col += 1) {
      const sourceX = Math.min(image.width - 1, Math.floor((col / outputSize) * image.width));
      const source = (sourceY * image.width + sourceX) * 4;
      const target = (row * outputSize + col) * 4;
      output[target] = enhanceMapChannel(image.rgba[source]);
      output[target + 1] = enhanceMapChannel(image.rgba[source + 1]);
      output[target + 2] = enhanceMapChannel(image.rgba[source + 2]);
      output[target + 3] = image.rgba[source + 3];
    }
  }

  return encodeRgbaPng(outputSize, outputSize, output);
}

function enhanceMapChannel(value) {
  return Math.max(0, Math.min(255, Math.round((value - 128) * 1.08 + 128)));
}

async function fetchFirstAvailableTile(providers, cachePath) {
  const attempts = providers.map((provider) =>
    loadTileFromProvider(provider).then((result) => ({ provider, ...result }))
  );

  try {
    const result = await Promise.any(attempts);
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, result.buffer);
    return { buffer: result.buffer, source: result.provider.source };
  } catch (error) {
    const errors = error?.errors || [];
    throw errors[0] || error;
  }
}

async function loadTileFromProvider(provider) {
  const buffer = await fetchTileBuffer(provider.url);
  const type = imageContentType(buffer);
  if (type !== "image/png" && type !== "image/jpeg") {
    throw new Error(`Unsupported content type from ${provider.source}: ${type}`);
  }
  if (provider.minWidth || provider.minHeight) {
    const image = decodeTileImage(buffer);
    if (provider.minWidth && image.width < provider.minWidth) {
      throw new Error(`Tile from ${provider.source} is ${image.width}px wide; expected at least ${provider.minWidth}px.`);
    }
    if (provider.minHeight && image.height < provider.minHeight) {
      throw new Error(`Tile from ${provider.source} is ${image.height}px tall; expected at least ${provider.minHeight}px.`);
    }
  }
  return { buffer };
}

function tileProviders(z, x, y) {
  if (MAP_TILE_STYLE === "osmde-retina") {
    return [
      {
        source: "online-osmde",
        url: `https://a.tile.openstreetmap.de/${z}/${x}/${y}.png`
      }
    ];
  }

  if (MAP_TILE_STYLE === "osm-standard-retina") {
    return [
      {
        source: "online-osm-standard",
        url: `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
      }
    ];
  }

  if (MAP_TILE_STYLE === "carto-light-retina") {
    return ["a", "b", "c", "d"].map((subdomain) => ({
      source: `online-carto-light-retina-${subdomain}`,
      url: `https://${subdomain}.basemaps.cartocdn.com/light_all/${z}/${x}/${y}@2x.png`,
      minWidth: 512,
      minHeight: 512
    }));
  }

  if (MAP_TILE_STYLE === "carto-voyager-retina") {
    return ["a", "b", "c", "d"].map((subdomain) => ({
      source: `online-carto-voyager-retina-${subdomain}`,
      url: `https://${subdomain}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}@2x.png`,
      minWidth: 512,
      minHeight: 512
    }));
  }

  return [
    {
      source: "online-esri-street",
      url: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`
    },
    {
      source: "online-osm",
      url: `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
    }
  ];
}

function fetchJson(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const request = client.get(
      url,
      {
        headers: {
          "User-Agent": "opendriver/0.3 Electron route planner"
        }
      },
      (response) => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
          response.resume();
          fetchJson(new URL(response.headers.location, url).toString(), timeoutMs).then(resolve, reject);
          return;
        }
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`JSON request failed: ${response.statusCode} ${url}`));
          return;
        }
        const chunks = [];
        let length = 0;
        response.on("data", (chunk) => {
          chunks.push(chunk);
          length += chunk.length;
          if (length > 2_000_000) request.destroy(new Error(`JSON response too large: ${url}`));
        });
        response.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.on("error", reject);
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`JSON request timed out: ${url}`));
    });
  });
}

function saveOnlineRouteCache(start, end, route) {
  const cachePath = path.join(ROUTE_CACHE_DIR, "online-osrm.json");
  fs.mkdirSync(ROUTE_CACHE_DIR, { recursive: true });
  let cache = { cityId: "online-osrm", routes: [] };
  try {
    if (fs.existsSync(cachePath)) {
      const parsed = JSON.parse(fs.readFileSync(cachePath, "utf8"));
      if (Array.isArray(parsed.routes)) cache = parsed;
    }
  } catch (_error) {
    cache = { cityId: "online-osrm", routes: [] };
  }

  const duplicate = cache.routes.some((item) => {
    const startDistance = distanceBetweenCoordinates(
      Number(start.latitude),
      Number(start.longitude),
      Number(item.startLatitude),
      Number(item.startLongitude)
    );
    const endDistance = distanceBetweenCoordinates(
      Number(end.latitude),
      Number(end.longitude),
      Number(item.endLatitude),
      Number(item.endLongitude)
    );
    return startDistance < 0.02 && endDistance < 0.02;
  });
  if (duplicate) return;

  cache.routes.push({
    cityId: "online-osrm",
    startLatitude: Number(start.latitude),
    startLongitude: Number(start.longitude),
    endLatitude: Number(end.latitude),
    endLongitude: Number(end.longitude),
    distanceKm: route.distanceKm,
    durationMinutes: route.durationMinutes,
    points: route.points
  });
  if (cache.routes.length > 2000) cache.routes = cache.routes.slice(-2000);
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  routeCaches = null;
  routeCachesSignature = "";
}

function fetchTileBuffer(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const request = client.get(
      url,
      {
        headers: {
          "User-Agent": "opendriver/0.3 Electron map tile cache"
        }
      },
      (response) => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location && redirectCount < 3) {
          response.resume();
          const nextUrl = new URL(response.headers.location, url).toString();
          fetchTileBuffer(nextUrl, redirectCount + 1).then(resolve, reject);
          return;
        }

        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`Tile request failed: ${response.statusCode} ${url}`));
          return;
        }

        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
      }
    );
    request.on("error", reject);
    request.setTimeout(TILE_FETCH_TIMEOUT_MS, () => {
      request.destroy(new Error(`Tile request timed out: ${url}`));
    });
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(new Error("REQUEST_TOO_LARGE"));
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (_error) {
        reject(new Error("INVALID_JSON"));
      }
    });
  });
}

function getAuth(req, db) {
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const session = db.sessions.find((item) => item.token === token);
  const user = session ? db.users.find((item) => item.id === session.userId) : null;
  return user ? { token, session, user } : null;
}

function requireAuth(req, res, db) {
  const auth = getAuth(req, db);
  if (!auth) fail(res, 401, "AUTH_REQUIRED", "Please log in first.");
  return auth;
}

function requireRole(req, res, db, roles) {
  const auth = requireAuth(req, res, db);
  if (!auth) return null;
  if (!roles.includes(auth.user.role)) {
    fail(res, 403, "ROLE_FORBIDDEN", "This role cannot access the requested resource.");
    return null;
  }
  return auth;
}

function canAccessRide(user, ride) {
  return Boolean(user && ride && (user.role === "admin" || ride.riderId === user.id || ride.driverId === user.id));
}

function profileFor(db, userId) {
  return db.driverProfiles.find((profile) => profile.userId === userId) || null;
}

function hasActiveSession(db, userId) {
  return Boolean(userId && db.sessions.some((session) => session.userId === userId));
}

function isActiveRide(ride) {
  return ride && !["completed", "cancelled"].includes(ride.status);
}

function isSeededAccount(user) {
  return String(user?.email || "").endsWith("@example.com");
}

function cancelSeededAccountActiveRides(db, user, reason) {
  if (!isSeededAccount(user)) return;
  db.rides
    .filter((ride) => isActiveRide(ride) && (ride.riderId === user.id || ride.driverId === user.id))
    .forEach((ride) => {
      ride.status = "cancelled";
      ride.cancelledAt = domain.now();
      ride.cancellationReason = reason;
      addTimeline(ride, "cancelled", reason);
      const profile = profileFor(db, ride.driverId);
      if (profile && profile.driverStatus === "busy") profile.driverStatus = "online";
    });
}

function driverHasAssignedActiveRide(db, driverUserId) {
  return db.rides.some((ride) => {
    return ride.driverId === driverUserId && isActiveRide(ride);
  });
}

function waypointInput(item, index) {
  const point = domain.normalizeLocation({
    latitude: item?.latitude,
    longitude: item?.longitude
  });
  const address = String(item?.address || item?.waypointAddress || "").trim();
  if (!point || !address) return null;
  return {
    id: String(item?.id || `waypoint_${index + 1}`).trim(),
    cityId: String(item?.cityId || "").trim(),
    address,
    latitude: point.latitude,
    longitude: point.longitude
  };
}

function rideInput(body) {
  const pickup = domain.normalizeLocation({ latitude: body.pickupLatitude, longitude: body.pickupLongitude });
  const destination = domain.normalizeLocation({ latitude: body.destinationLatitude, longitude: body.destinationLongitude });
  if (!pickup || !destination || !body.pickupAddress || !body.destinationAddress) return null;
  const rawWaypoints = Array.isArray(body.waypoints) ? body.waypoints : [];
  const waypoints = [];
  for (let index = 0; index < rawWaypoints.length; index += 1) {
    const waypoint = waypointInput(rawWaypoints[index], index);
    if (!waypoint) return null;
    waypoints.push(waypoint);
  }
  return {
    pickupAddress: String(body.pickupAddress).trim(),
    pickupLatitude: pickup.latitude,
    pickupLongitude: pickup.longitude,
    destinationAddress: String(body.destinationAddress).trim(),
    destinationLatitude: destination.latitude,
    destinationLongitude: destination.longitude,
    waypoints,
    paymentMethod: String(body.paymentMethod || "card_on_file"),
    rideTier: String(body.rideTier || "standard"),
    promoCode: String(body.promoCode || "").trim().toUpperCase(),
    scheduledFor: String(body.scheduledFor || "").trim()
  };
}

function normalizeRideTier(value) {
  return rideTiers.find((tier) => tier.id === value) || rideTiers[0];
}

function validateScheduledFor(value) {
  if (!value) return { ok: true, scheduledFor: null };
  const scheduledAt = Date.parse(value);
  if (!Number.isFinite(scheduledAt)) {
    return { ok: false, code: "INVALID_SCHEDULE_TIME", message: "Choose a valid pickup time." };
  }
  const earliest = Date.now() + 10 * 60 * 1000;
  const latest = Date.now() + 30 * 24 * 60 * 60 * 1000;
  if (scheduledAt < earliest) {
    return { ok: false, code: "SCHEDULE_TOO_SOON", message: "Scheduled rides need at least 10 minutes of lead time." };
  }
  if (scheduledAt > latest) {
    return { ok: false, code: "SCHEDULE_TOO_FAR", message: "Scheduled rides can be booked up to 30 days ahead." };
  }
  return { ok: true, scheduledFor: new Date(scheduledAt).toISOString() };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

function validateRegistration(body) {
  const role = String(body.role || "rider");
  const name = String(body.name || "").trim();
  const email = domain.normalizeEmail(body.email);
  const password = String(body.password || "");
  if (!["rider", "driver"].includes(role)) {
    return { ok: false, code: "INVALID_ROLE", message: "Only rider and driver accounts can be created from the app." };
  }
  if (name.length < 2) {
    return { ok: false, code: "NAME_REQUIRED", message: "Please enter your name." };
  }
  if (!isValidEmail(email)) {
    return { ok: false, code: "INVALID_EMAIL", message: "Please enter a valid email address." };
  }
  if (password.length < 8) {
    return { ok: false, code: "WEAK_PASSWORD", message: "Password must be at least 8 characters." };
  }
  return { ok: true, role, name, email, password };
}

function requireNonEmptyString(value) {
  const text = String(value || "").trim();
  return text.length > 0 ? text : null;
}

function createDefaultRiderPaymentMethod(db, userId) {
  db.paymentMethods = db.paymentMethods || [];
  if (db.paymentMethods.some((method) => method.userId === userId && method.status === "active")) return;
  db.paymentMethods.push({
    id: domain.makeId("pm"),
    userId,
    type: "card",
    brand: "Visa",
    label: "Visa ending 4242",
    last4: "4242",
    isDefault: true,
    status: "active",
    createdAt: domain.now()
  });
}

function publicPaymentMethods(db, userId) {
  return (db.paymentMethods || []).filter((method) => method.userId === userId && method.status === "active");
}

function driverDocuments(profile) {
  profile.documents = Array.isArray(profile.documents) ? profile.documents : [];
  return profile.documents;
}

function driverDocumentSummary(profile) {
  const documents = driverDocuments(profile);
  const requiredTypes = ["license", "insurance", "vehicle_inspection"];
  const approved = requiredTypes.filter((type) => documents.some((doc) => doc.type === type && doc.status === "approved"));
  return {
    required: requiredTypes.length,
    submitted: requiredTypes.filter((type) => documents.some((doc) => doc.type === type)).length,
    approved: approved.length,
    status: approved.length === requiredTypes.length ? "complete" : documents.length > 0 ? "in_review" : "missing"
  };
}

function publicPayouts(db, userId) {
  return (db.payouts || []).filter((payout) => payout.driverId === userId);
}

function paymentMethodForUser(db, userId, value) {
  const methods = publicPaymentMethods(db, userId);
  if (methods.length === 0) return null;
  const requested = String(value || "").trim();
  if (!requested || requested === "card_on_file") {
    return methods.find((method) => method.isDefault) || methods[0];
  }
  return methods.find((method) => method.id === requested) || null;
}

function validatePaymentMethod(db, userId, input) {
  const method = paymentMethodForUser(db, userId, input.paymentMethod);
  if (!method) {
    return {
      ok: false,
      code: "PAYMENT_METHOD_INVALID",
      message: "Choose an active payment method before requesting a ride."
    };
  }
  input.paymentMethod = method.id;
  return { ok: true, method };
}

function normalizedPromoCode(code) {
  return String(code || "").trim().toUpperCase();
}

function promoUsedByUser(db, userId, code) {
  const normalized = normalizedPromoCode(code);
  if (!normalized) return false;
  return (db.userCoupons || []).some((coupon) => coupon.userId === userId && coupon.code === normalized && coupon.status !== "available");
}

function consumePromoForUser(db, userId, promo, rideId) {
  if (!promo?.code) return;
  db.userCoupons ||= [];
  const now = domain.now();
  const existing = db.userCoupons.find((coupon) => coupon.userId === userId && coupon.code === promo.code && coupon.status === "available");
  if (existing) {
    existing.status = "used";
    existing.rideId = rideId;
    existing.usedAt = now;
    existing.updatedAt = now;
    return;
  }
  db.userCoupons.push({
    id: domain.makeId("coupon"),
    userId,
    code: promo.code,
    title: promo.title,
    discountType: promo.amountOff ? "amount" : "percent",
    percentOff: promo.percentOff,
    amountOff: promo.amountOff,
    minSpend: 0,
    status: "used",
    expiresAt: "",
    appliesToRideTier: "all",
    autoApply: false,
    rideId,
    usedAt: now,
    createdAt: now,
    updatedAt: now
  });
}

function validatePromoInput(db, input, userId = "") {
  if (!input.promoCode) return { ok: true };
  const promo = promoForCode(db, input.promoCode);
  if (!promo) {
    return {
      ok: false,
      code: "PROMO_NOT_FOUND",
      message: "Promo code is not available."
    };
  }
  if (userId && promoUsedByUser(db, userId, promo.code)) {
    return {
      ok: false,
      code: "PROMO_ALREADY_USED",
      message: "Promo code has already been used."
    };
  }
  return { ok: true, promo };
}

function moneyForCity(city) {
  const region = city?.region || "";
  const usd = { code: "USD", symbol: "$", rate: 1, factor: 1, decimals: 2 };
  const byRegion = {
    Canada: { code: "CAD", symbol: "CA$", rate: 1.36, factor: 1.02, decimals: 2 },
    Mexico: { code: "MXN", symbol: "MX$", rate: 17.1, factor: 0.72, decimals: 2 },
    Brazil: { code: "BRL", symbol: "R$", rate: 5.1, factor: 0.68, decimals: 2 },
    Argentina: { code: "ARS", symbol: "AR$", rate: 900, factor: 0.38, decimals: 0 },
    Chile: { code: "CLP", symbol: "CLP$", rate: 920, factor: 0.54, decimals: 0 },
    Colombia: { code: "COP", symbol: "COL$", rate: 3900, factor: 0.48, decimals: 0 },
    "United Kingdom": { code: "GBP", symbol: "GBP ", rate: 0.79, factor: 1.15, decimals: 2 },
    France: { code: "EUR", symbol: "EUR ", rate: 0.92, factor: 1.05, decimals: 2 },
    Germany: { code: "EUR", symbol: "EUR ", rate: 0.92, factor: 1.0, decimals: 2 },
    Spain: { code: "EUR", symbol: "EUR ", rate: 0.92, factor: 0.9, decimals: 2 },
    Italy: { code: "EUR", symbol: "EUR ", rate: 0.92, factor: 0.92, decimals: 2 },
    Netherlands: { code: "EUR", symbol: "EUR ", rate: 0.92, factor: 1.05, decimals: 2 },
    Turkey: { code: "TRY", symbol: "TRY ", rate: 32.2, factor: 0.58, decimals: 2 },
    "United Arab Emirates": { code: "AED", symbol: "AED ", rate: 3.67, factor: 1.18, decimals: 2 },
    "Saudi Arabia": { code: "SAR", symbol: "SAR ", rate: 3.75, factor: 0.9, decimals: 2 },
    Egypt: { code: "EGP", symbol: "EGP ", rate: 48.0, factor: 0.42, decimals: 2 },
    Kenya: { code: "KES", symbol: "KSh ", rate: 130, factor: 0.45, decimals: 0 },
    "South Africa": { code: "ZAR", symbol: "R", rate: 18.4, factor: 0.55, decimals: 2 },
    India: { code: "INR", symbol: "INR ", rate: 83.2, factor: 0.36, decimals: 0 },
    Thailand: { code: "THB", symbol: "THB ", rate: 36.2, factor: 0.45, decimals: 0 },
    Singapore: { code: "SGD", symbol: "S$", rate: 1.35, factor: 1.1, decimals: 2 },
    Japan: { code: "JPY", symbol: "JPY ", rate: 155, factor: 0.95, decimals: 0 },
    "South Korea": { code: "KRW", symbol: "KRW ", rate: 1370, factor: 0.78, decimals: 0 },
    "Hong Kong": { code: "HKD", symbol: "HK$", rate: 7.8, factor: 1.0, decimals: 2 },
    Taiwan: { code: "TWD", symbol: "NT$", rate: 32.3, factor: 0.72, decimals: 0 },
    China: { code: "CNY", symbol: "CNY ", rate: 7.24, factor: 0.65, decimals: 2 },
    Australia: { code: "AUD", symbol: "A$", rate: 1.51, factor: 1.08, decimals: 2 },
    "New Zealand": { code: "NZD", symbol: "NZ$", rate: 1.64, factor: 1.02, decimals: 2 },
    Malaysia: { code: "MYR", symbol: "RM", rate: 4.7, factor: 0.55, decimals: 2 },
    Indonesia: { code: "IDR", symbol: "Rp ", rate: 16200, factor: 0.38, decimals: 0 },
    Philippines: { code: "PHP", symbol: "PHP ", rate: 58.5, factor: 0.42, decimals: 0 },
    Nigeria: { code: "NGN", symbol: "NGN ", rate: 1500, factor: 0.32, decimals: 0 },
    Morocco: { code: "MAD", symbol: "MAD ", rate: 10.0, factor: 0.45, decimals: 2 },
    Portugal: { code: "EUR", symbol: "EUR ", rate: 0.92, factor: 0.86, decimals: 2 },
    Sweden: { code: "SEK", symbol: "SEK ", rate: 10.6, factor: 1.05, decimals: 2 },
    Austria: { code: "EUR", symbol: "EUR ", rate: 0.92, factor: 1.02, decimals: 2 },
    Switzerland: { code: "CHF", symbol: "CHF ", rate: 0.9, factor: 1.35, decimals: 2 }
  };
  return byRegion[region] || usd;
}

function roundMoney(value, decimals) {
  const factor = 10 ** decimals;
  return Number((Math.round(value * factor) / factor).toFixed(decimals));
}

function promoForCode(db, code) {
  if (!code) return null;
  return db.promotions?.find((promo) => promo.active && promo.code === normalizedPromoCode(code)) || null;
}

function applyRideTierAndPromo(fareBreakdown, { tier, promo }) {
  const decimals = fareBreakdown.currencyDecimals ?? 2;
  const multiply = (value) => roundMoney(value * tier.multiplier, decimals);
  const subtotal = multiply(fareBreakdown.estimatedTotal);
  const discountAmount = promo
    ? Math.min(
        subtotal,
        roundMoney(
          promo.amountOff
            ? Number(promo.amountOff || 0)
            : subtotal * (Number(promo.percentOff || 0) / 100),
          decimals
        )
      )
    : 0;
  const estimatedTotal = Math.max(0, roundMoney(subtotal - discountAmount, decimals));
  return {
    ...fareBreakdown,
    baseFare: multiply(fareBreakdown.baseFare),
    distanceFare: multiply(fareBreakdown.distanceFare),
    timeFare: multiply(fareBreakdown.timeFare),
    serviceFee: multiply(fareBreakdown.serviceFee),
    waypointFee: multiply(fareBreakdown.waypointFee || 0),
    pickupTimeAdjustment: multiply(fareBreakdown.pickupTimeAdjustment || 0),
    subtotalBeforeDiscount: subtotal,
    discountAmount,
    promoCode: promo?.code || "",
    promoTitle: promo?.title || "",
    rideTier: tier.id,
    rideTierTitle: tier.title,
    estimatedTotal
  };
}

function localizeFareBreakdown(fareBreakdown, city) {
  const money = moneyForCity(city);
  const convert = (value) => roundMoney(value * money.rate * money.factor, money.decimals);
  const minimum = convert(8);
  return {
    ...fareBreakdown,
    baseFare: convert(fareBreakdown.baseFare),
    distanceFare: convert(fareBreakdown.distanceFare),
    timeFare: convert(fareBreakdown.timeFare),
    serviceFee: convert(fareBreakdown.serviceFee),
    waypointFee: convert(fareBreakdown.waypointFee || 0),
    pickupTimeAdjustment: convert(fareBreakdown.pickupTimeAdjustment || 0),
    estimatedTotal: Math.max(minimum, convert(fareBreakdown.estimatedTotal)),
    currencyCode: money.code,
    currencySymbol: money.symbol,
    currencyDecimals: money.decimals
  };
}

function rideStops(input) {
  return [
    {
      address: input.pickupAddress,
      latitude: input.pickupLatitude,
      longitude: input.pickupLongitude
    },
    ...(Array.isArray(input.waypoints) ? input.waypoints : []),
    {
      address: input.destinationAddress,
      latitude: input.destinationLatitude,
      longitude: input.destinationLongitude
    }
  ];
}

function rideStopsForRide(ride) {
  return rideStops(ride);
}

function routeDistanceForStops(stops) {
  let distance = 0;
  for (let index = 1; index < stops.length; index += 1) {
    distance += domain.calculateHaversineDistance(stops[index - 1], stops[index]);
  }
  return Number(distance.toFixed(2));
}

function estimateRide(db, input, serviceCity = null, scheduledFor = null) {
  const waypoints = Array.isArray(input.waypoints) ? input.waypoints : [];
  const estimatedDistance = routeDistanceForStops(rideStops(input));
  const estimatedDuration = domain.estimateTripDuration(estimatedDistance);
  const nearbyAvailableDrivers = domain.nearbyDrivers(db, input)
    .filter((item) => item.distanceKm <= AUTO_NEARBY_DRIVER_MAX_KM)
    .length;
  const tier = normalizeRideTier(input.rideTier);
  const promo = promoForCode(db, input.promoCode);
  const fareBreakdown = applyRideTierAndPromo(localizeFareBreakdown(domain.estimateFare({
    distanceKm: estimatedDistance,
    durationMinutes: estimatedDuration,
    availableDrivers: nearbyAvailableDrivers,
    waypointCount: waypoints.length,
    pickupTime: scheduledFor
  }), serviceCity), { tier, promo });
  const rideOptions = rideTiers.map((option) => ({
    ...option,
    estimatedTotal: applyRideTierAndPromo(localizeFareBreakdown(domain.estimateFare({
      distanceKm: estimatedDistance,
      durationMinutes: estimatedDuration,
      availableDrivers: nearbyAvailableDrivers,
      waypointCount: waypoints.length,
      pickupTime: scheduledFor
    }), serviceCity), { tier: option, promo }).estimatedTotal,
    currencyCode: fareBreakdown.currencyCode,
    currencySymbol: fareBreakdown.currencySymbol,
    currencyDecimals: fareBreakdown.currencyDecimals
  }));
  return { estimatedDistance, estimatedDuration, fareBreakdown, rideOptions };
}

function createRideRecord({ riderId, driverId = null, input, estimate, tier, schedule }) {
  return {
    id: domain.makeId("ride"),
    riderId,
    driverId,
    ...input,
    status: schedule.scheduledFor ? "scheduled" : driverId ? "searching" : "requested",
    rideTier: tier.id,
    rideTierTitle: tier.title,
    estimatedDistance: estimate.estimatedDistance,
    estimatedDuration: estimate.estimatedDuration,
    estimatedFare: estimate.fareBreakdown.estimatedTotal,
    currencyCode: estimate.fareBreakdown.currencyCode,
    currencySymbol: estimate.fareBreakdown.currencySymbol,
    currencyDecimals: estimate.fareBreakdown.currencyDecimals,
    finalDistance: null,
    finalDuration: null,
    finalFare: null,
    fareBreakdown: estimate.fareBreakdown,
    promoCode: estimate.fareBreakdown.promoCode,
    discountAmount: estimate.fareBreakdown.discountAmount,
    paymentStatus: "authorized",
    cancellationReason: "",
    rejectedDriverIds: [],
    messages: [],
    scheduledFor: schedule.scheduledFor,
    timeline: [{
      status: schedule.scheduledFor ? "scheduled" : driverId ? "searching" : "requested",
      label: schedule.scheduledFor ? "Ride scheduled" : driverId ? "Request assigned to driver" : "Ride requested",
      at: domain.now()
    }],
    createdAt: domain.now(),
    acceptedAt: null,
    driverArrivingAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null
  };
}

function applyEstimateToRide(ride, estimate) {
  ride.estimatedDistance = estimate.estimatedDistance;
  ride.estimatedDuration = estimate.estimatedDuration;
  ride.estimatedFare = estimate.fareBreakdown.estimatedTotal;
  ride.currencyCode = estimate.fareBreakdown.currencyCode;
  ride.currencySymbol = estimate.fareBreakdown.currencySymbol;
  ride.currencyDecimals = estimate.fareBreakdown.currencyDecimals;
  ride.fareBreakdown = estimate.fareBreakdown;
  ride.promoCode = estimate.fareBreakdown.promoCode;
  ride.discountAmount = estimate.fareBreakdown.discountAmount;
}

async function updateRideWaypoints(db, ride, input, serviceCity) {
  ride.waypoints = input.waypoints;
  const estimate = estimateRide(db, input, serviceCity, ride.scheduledFor || null);
  applyEstimateToRide(ride, estimate);
  ride.updatedAt = domain.now();
  ride.automationFlow = ride.automationFlow || {};
  ride.automationFlow.pickupToDestinationRoute = await roadRoutePointsThrough(rideStopsForRide(ride));
  delete ride.automationFlow.completeAt;
  delete ride.automationFlow.tripDurationSeconds;
  if (ride.status === "in_progress") scheduleAutoCompletion(ride);
  addTimeline(ride, "route_updated", `Route updated with ${ride.waypoints.length} stop${ride.waypoints.length === 1 ? "" : "s"}`);
  if (ride.driverId) {
    domain.createNotification(db, ride.driverId, "ride_route_updated", "Route updated", "The rider updated the trip stops.");
  }
  domain.createNotification(db, ride.riderId, "ride_route_updated", "Stops updated", "Your route and fare estimate were updated.");
  return estimate;
}

function publicServiceCities() {
  return enabledServiceCities().map((city) => ({
    id: city.id,
    name: city.name,
    region: city.region,
    centerLatitude: city.centerLatitude,
    centerLongitude: city.centerLongitude,
      radiusKm: city.radiusKm,
      currencyCode: moneyForCity(city).code,
      currencySymbol: moneyForCity(city).symbol,
      currencyDecimals: moneyForCity(city).decimals,
      locations: city.locations.map(([id, address, latitude, longitude]) => ({
      id,
      cityId: city.id,
      address,
      latitude,
      longitude
    }))
  }));
}

function enabledServiceCities() {
  return seed.serviceCities.filter((city) => TARGET_SERVICE_CITY_IDS.has(city.id));
}

function publicLocations() {
  return Object.fromEntries(
    enabledServiceCities().flatMap((city) =>
      city.locations.map(([id, address, latitude, longitude]) => [
        id,
        { id, cityId: city.id, address, latitude, longitude }
      ])
    )
  );
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|suite|ste|floor|fl)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function searchIndexSignature() {
  try {
    const stat = fs.statSync(SEARCH_INDEX_PATH);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch (_error) {
    return "missing";
  }
}

function seedSearchPlaces() {
  return enabledServiceCities().flatMap((city) => [
    {
      id: `${city.id}_center`,
      cityId: city.id,
      address: `${city.name}, ${city.region} service area`,
      latitude: city.centerLatitude,
      longitude: city.centerLongitude,
      category: "service_area",
      source: "seed"
    },
    ...city.locations.map(([id, address, latitude, longitude]) => ({
      id,
      cityId: city.id,
      address,
      latitude,
      longitude,
      category: "featured_place",
      source: "seed"
    }))
  ]);
}

function loadSearchPlaces() {
  const signature = searchIndexSignature();
  if (searchPlaces && signature === searchPlacesSignature) return searchPlaces;
  const places = seedSearchPlaces();
  if (fs.existsSync(SEARCH_INDEX_PATH)) {
    try {
      const payload = JSON.parse(fs.readFileSync(SEARCH_INDEX_PATH, "utf8"));
      const items = Array.isArray(payload?.places) ? payload.places : Array.isArray(payload) ? payload : [];
      const enabledIds = new Set(enabledServiceCities().map((city) => city.id));
      for (const item of items) {
        const latitude = Number(item.latitude);
        const longitude = Number(item.longitude);
        const cityId = String(item.cityId || "");
        const address = String(item.address || item.name || "").trim();
        if (!enabledIds.has(cityId) || !address || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
        places.push({
          id: String(item.id || `poi_${places.length}`),
          cityId,
          address,
          latitude,
          longitude,
          category: String(item.category || item.kind || "place"),
          source: String(item.source || "offline-osm"),
          searchText: String(item.searchText || "")
        });
      }
    } catch (error) {
      console.warn(`[search] failed to load search index: ${error.message}`);
    }
  }
  searchPlaces = places.map((place) => ({
    ...place,
    normalizedSearchText: normalizeSearchText([
      place.address,
      place.id,
      place.category,
      place.searchText
    ].join(" "))
  }));
  searchPlacesByCity = new Map();
  for (const place of searchPlaces) {
    const bucket = searchPlacesByCity.get(place.cityId);
    if (bucket) {
      bucket.push(place);
    } else {
      searchPlacesByCity.set(place.cityId, [place]);
    }
  }
  searchPlacesSignature = signature;
  console.log(`[search] loaded ${searchPlaces.length} offline place(s)`);
  return searchPlaces;
}

function searchPlacesLocal(params) {
  const query = String(params.q || "").trim();
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length < 2) return [];
  const limit = Math.max(1, Math.min(30, Number(params.limit) || 8));
  const cityId = String(params.cityId || "").trim();
  const biasLat = Number(params.lat);
  const biasLon = Number(params.lon);
  const hasBias = params.lat != null && params.lon != null && Number.isFinite(biasLat) && Number.isFinite(biasLon);
  const tokens = normalizedQuery.split(" ").filter((token) => token.length > 1);
  const enabledIds = new Set(enabledServiceCities().map((city) => city.id));
  const candidates = [];
  const places = loadSearchPlaces();
  const searchablePlaces = cityId ? (searchPlacesByCity.get(cityId) || []) : places;

  for (const place of searchablePlaces) {
    if (!enabledIds.has(place.cityId)) continue;
    const text = place.normalizedSearchText;
    const direct = text.includes(normalizedQuery);
    const tokenMatch = tokens.length > 0 && tokens.every((token) => text.includes(token));
    if (!direct && !tokenMatch) continue;
    const distanceKm = hasBias
      ? domain.calculateHaversineDistance({ latitude: biasLat, longitude: biasLon }, place)
      : null;
    let score = 0;
    if (text.startsWith(normalizedQuery)) score += 80;
    if (direct) score += 40;
    if (tokenMatch) score += 20 + tokens.length * 3;
    if (place.source === "seed") score += 8;
    if (distanceKm != null) score -= Math.min(40, distanceKm);
    candidates.push({ place, score, distanceKm });
  }

  candidates.sort((a, b) => {
    const scoreCompare = b.score - a.score;
    if (scoreCompare !== 0) return scoreCompare;
    if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
    return a.place.address.localeCompare(b.place.address);
  });

  const seen = new Set();
  const results = [];
  for (const candidate of candidates) {
    const key = `${candidate.place.cityId}:${candidate.place.id}:${candidate.place.latitude.toFixed(5)}:${candidate.place.longitude.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      id: candidate.place.id,
      cityId: candidate.place.cityId,
      address: candidate.place.address,
      latitude: candidate.place.latitude,
      longitude: candidate.place.longitude,
      category: candidate.place.category,
      source: candidate.place.source,
      distanceKm: candidate.distanceKm == null ? null : Number(candidate.distanceKm.toFixed(3))
    });
    if (results.length >= limit) break;
  }
  return results;
}

function serviceCityForPoint(point) {
  return enabledServiceCities()
    .map((city) => ({
      city,
      distanceKm: domain.calculateHaversineDistance(
        { latitude: city.centerLatitude, longitude: city.centerLongitude },
        point
      )
    }))
    .filter((item) => item.distanceKm <= item.city.radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)[0]?.city || null;
}

function validateRideServiceArea(input) {
  const pickupCity = serviceCityForPoint({ latitude: input.pickupLatitude, longitude: input.pickupLongitude });
  const destinationCity = serviceCityForPoint({ latitude: input.destinationLatitude, longitude: input.destinationLongitude });
  const waypointCities = (Array.isArray(input.waypoints) ? input.waypoints : [])
    .map((waypoint) => serviceCityForPoint({ latitude: waypoint.latitude, longitude: waypoint.longitude }));
  if (!pickupCity || !destinationCity || waypointCities.some((city) => !city)) {
    return {
      ok: false,
      code: "SERVICE_AREA_UNSUPPORTED",
      message: "opendriver currently serves supported global metro areas. Choose pickup, stops, and destination inside one service city."
    };
  }
  if (pickupCity.id !== destinationCity.id || waypointCities.some((city) => city.id !== pickupCity.id)) {
    return {
      ok: false,
      code: "CROSS_CITY_UNSUPPORTED",
      message: "Pickup, stops, and destination must be in the same service city."
    };
  }
  return { ok: true, city: pickupCity };
}

function validateDriverServiceArea(point) {
  const city = serviceCityForPoint(point);
  if (!city) {
    return {
      ok: false,
      code: "DRIVER_LOCATION_OUTSIDE_SERVICE_AREA",
      message: "Driver location must be inside an active opendriver service city."
    };
  }
  return { ok: true, city };
}

function addTimeline(ride, status, label) {
  ride.timeline = ride.timeline || [];
  ride.timeline.push({ status, label, at: domain.now() });
}

function addRideMessage(db, ride, senderId, body) {
  const sender = db.users.find((user) => user.id === senderId);
  if (!sender) return null;
  const message = {
    id: domain.makeId("msg"),
    rideId: ride.id,
    senderId,
    senderRole: sender.role,
    senderName: sender.name,
    body: String(body || "").trim(),
    createdAt: domain.now()
  };
  ride.messages = ride.messages || [];
  ride.messages.push(message);
  return message;
}

function addSupportReply(db, ticket, sender, messageBody) {
  ticket.replies = ticket.replies || [];
  const reply = {
    id: domain.makeId("reply"),
    ticketId: ticket.id,
    userId: sender.id,
    userName: sender.name,
    role: sender.role,
    message: messageBody,
    createdAt: domain.now()
  };
  ticket.replies.push(reply);
  ticket.updatedAt = domain.now();
  return reply;
}

function addArrivalMessage(db, ride) {
  if (!ride?.driverId) return;
  ride.messages = ride.messages || [];
  const alreadySent = ride.messages.some((item) => item.type === "driver_arrived");
  if (alreadySent) return;
  const message = addRideMessage(
    db,
    ride,
    ride.driverId,
    "Hi, I have arrived at the pickup spot. Please check the plate before getting in."
  );
  if (message) message.type = "driver_arrived";
}

function randomSeconds(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function secondsFromNow(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function parseTime(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? time : 0;
}

function interpolate(start, end, ratio) {
  return Number((start + (end - start) * Math.max(0, Math.min(1, ratio))).toFixed(6));
}

function secondsByDistance(distanceKm, minSeconds, maxSeconds, maxDistanceKm = AUTO_NEARBY_DRIVER_MAX_KM) {
  const safeDistance = Math.max(0, Number(distanceKm) || 0);
  const safeMaxDistance = Math.max(0.1, Number(maxDistanceKm) || 1);
  const ratio = Math.max(0, Math.min(1, safeDistance / safeMaxDistance));
  return Math.round(minSeconds + (maxSeconds - minSeconds) * ratio);
}

function offsetLocation(latitude, longitude, distanceKm, bearingRadians) {
  const latDelta = (distanceKm / 111) * Math.cos(bearingRadians);
  const lonScale = Math.max(0.2, Math.cos((latitude * Math.PI) / 180));
  const lonDelta = (distanceKm / (111 * lonScale)) * Math.sin(bearingRadians);
  return {
    latitude: Number((latitude + latDelta).toFixed(6)),
    longitude: Number((longitude + lonDelta).toFixed(6))
  };
}

function loadRoadGraphs() {
  const signature = fs.existsSync(ROAD_GRAPH_DIR)
    ? fs.readdirSync(ROAD_GRAPH_DIR)
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map((file) => {
        const stat = fs.statSync(path.join(ROAD_GRAPH_DIR, file));
        return `${file}:${stat.size}:${stat.mtimeMs}`;
      })
      .join("|")
    : "";
  if (roadGraphs && signature === roadGraphsSignature) return roadGraphs;
  roadGraphs = [];
  roadGraphsSignature = signature;
  if (!fs.existsSync(ROAD_GRAPH_DIR)) return roadGraphs;
  for (const file of fs.readdirSync(ROAD_GRAPH_DIR)) {
    if (!file.endsWith(".json")) continue;
    try {
      const graph = JSON.parse(fs.readFileSync(path.join(ROAD_GRAPH_DIR, file), "utf8"));
      if (Array.isArray(graph.nodes) && Array.isArray(graph.adjacency)) {
        roadGraphs.push(graph);
      }
    } catch (error) {
      console.warn(`[route] failed to load road graph ${file}: ${error.message}`);
    }
  }
  console.log(`[route] loaded ${roadGraphs.length} offline road graph(s)`);
  return roadGraphs;
}

function dataDirSignature(dir) {
  return fs.existsSync(dir)
    ? fs.readdirSync(dir)
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map((file) => {
        const stat = fs.statSync(path.join(dir, file));
        return `${file}:${stat.size}:${stat.mtimeMs}`;
      })
      .join("|")
    : "";
}

function loadRouteCaches() {
  const signature = dataDirSignature(ROUTE_CACHE_DIR);
  if (routeCaches && signature === routeCachesSignature) return routeCaches;
  routeCaches = [];
  routeCachesSignature = signature;
  if (!fs.existsSync(ROUTE_CACHE_DIR)) return routeCaches;
  for (const file of fs.readdirSync(ROUTE_CACHE_DIR)) {
    if (!file.endsWith(".json")) continue;
    try {
      const cache = JSON.parse(fs.readFileSync(path.join(ROUTE_CACHE_DIR, file), "utf8"));
      if (Array.isArray(cache.routes)) routeCaches.push(cache);
    } catch (error) {
      console.warn(`[route] failed to load route cache ${file}: ${error.message}`);
    }
  }
  console.log(`[route] loaded ${routeCaches.length} offline route cache file(s)`);
  return routeCaches;
}

function pointInGraphBounds(point, graph) {
  const bbox = graph.bbox;
  if (!bbox) return false;
  const margin = 0.03;
  return point.latitude >= bbox.minLat - margin &&
    point.latitude <= bbox.maxLat + margin &&
    point.longitude >= bbox.minLon - margin &&
    point.longitude <= bbox.maxLon + margin;
}

function distanceBetweenCoordinates(aLat, aLon, bLat, bLon) {
  const radius = 6371;
  const lat1 = aLat * Math.PI / 180;
  const lat2 = bLat * Math.PI / 180;
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLon = (bLon - aLon) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

function nearestRoadNode(graph, point) {
  let bestIndex = -1;
  let bestDistance = Infinity;
  const targetLat = Number(point.latitude);
  const targetLon = Number(point.longitude);
  for (let index = 0; index < graph.nodes.length; index += 1) {
    if (!Array.isArray(graph.adjacency[index]) || graph.adjacency[index].length === 0) continue;
    const node = graph.nodes[index];
    const latDelta = node[0] - targetLat;
    const lonDelta = (node[1] - targetLon) * Math.cos(targetLat * Math.PI / 180);
    const score = latDelta * latDelta + lonDelta * lonDelta;
    if (score < bestDistance) {
      bestDistance = score;
      bestIndex = index;
    }
  }
  if (bestIndex < 0) return null;
  const node = graph.nodes[bestIndex];
  return {
    index: bestIndex,
    distanceKm: distanceBetweenCoordinates(targetLat, targetLon, node[0], node[1])
  };
}

class MinHeap {
  constructor() {
    this.items = [];
  }

  push(item) {
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }

  pop() {
    if (this.items.length === 0) return null;
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent].priority <= this.items[index].priority) break;
      [this.items[parent], this.items[index]] = [this.items[index], this.items[parent]];
      index = parent;
    }
  }

  bubbleDown(index) {
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < this.items.length && this.items[left].priority < this.items[smallest].priority) smallest = left;
      if (right < this.items.length && this.items[right].priority < this.items[smallest].priority) smallest = right;
      if (smallest === index) break;
      [this.items[smallest], this.items[index]] = [this.items[index], this.items[smallest]];
      index = smallest;
    }
  }

  get length() {
    return this.items.length;
  }
}

function reconstructRoute(graph, previous, startIndex, endIndex) {
  const indexes = [];
  for (let cursor = endIndex; cursor !== -1; cursor = previous[cursor]) {
    indexes.push(cursor);
    if (cursor === startIndex) break;
  }
  if (indexes[indexes.length - 1] !== startIndex) return null;
  indexes.reverse();
  return indexes.map((index) => ({
    latitude: graph.nodes[index][0],
    longitude: graph.nodes[index][1]
  }));
}

function routeOnGraph(graph, start, end) {
  if (!pointInGraphBounds(start, graph) || !pointInGraphBounds(end, graph)) return null;
  const snappedStart = nearestRoadNode(graph, start);
  const snappedEnd = nearestRoadNode(graph, end);
  if (!snappedStart || !snappedEnd) return null;
  const maxSnapDistanceKm = graph.coverage === "route-cache" ? 0.12 : 0.25;
  if (snappedStart.distanceKm > maxSnapDistanceKm || snappedEnd.distanceKm > maxSnapDistanceKm) return null;

  const nodeCount = graph.nodes.length;
  const startIndex = snappedStart.index;
  const endIndex = snappedEnd.index;
  const costs = new Float64Array(nodeCount);
  costs.fill(Infinity);
  const previous = new Int32Array(nodeCount);
  previous.fill(-1);
  const visited = new Uint8Array(nodeCount);
  const heap = new MinHeap();
  costs[startIndex] = 0;
  heap.push({ index: startIndex, priority: 0 });
  const endNode = graph.nodes[endIndex];
  const maxVisited = nodeCount;
  let visitedCount = 0;

  while (heap.length > 0) {
    const current = heap.pop();
    const index = current.index;
    if (visited[index]) continue;
    visited[index] = 1;
    visitedCount += 1;
    if (index === endIndex) break;
    if (visitedCount > maxVisited) return null;

    for (const edge of graph.adjacency[index] || []) {
      const next = edge[0];
      if (visited[next]) continue;
      const distance = edge[1];
      const nextCost = costs[index] + distance;
      if (nextCost >= costs[next]) continue;
      costs[next] = nextCost;
      previous[next] = index;
      const nextNode = graph.nodes[next];
      const heuristic = distanceBetweenCoordinates(nextNode[0], nextNode[1], endNode[0], endNode[1]);
      heap.push({ index: next, priority: nextCost + heuristic });
    }
  }

  if (!Number.isFinite(costs[endIndex])) return null;
  const points = reconstructRoute(graph, previous, startIndex, endIndex);
  if (!points || points.length < 2) return null;
  const connectedPoints = dedupeRoutePoints([start, ...points, end]);
  const distanceKm = routeDistanceKm(connectedPoints);
  const directDistanceKm = distanceBetweenCoordinates(
    Number(start.latitude),
    Number(start.longitude),
    Number(end.latitude),
    Number(end.longitude)
  );
  if (directDistanceKm < 2 && distanceKm > Math.max(1.2, directDistanceKm * 3.2)) return null;
  const durationSeconds = routeDurationSeconds(graph, points);
  return {
    points: connectedPoints,
    distanceKm,
    durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
    graphId: graph.cityId,
    snapDistanceKm: Number((snappedStart.distanceKm + snappedEnd.distanceKm).toFixed(3))
  };
}

function routeDurationSeconds(graph, points) {
  let seconds = 0;
  for (let index = 1; index < points.length; index += 1) {
    const distance = distanceBetweenCoordinates(
      points[index - 1].latitude,
      points[index - 1].longitude,
      points[index].latitude,
      points[index].longitude
    );
    seconds += (distance / 30) * 3600;
  }
  return seconds;
}

function cachedRoadRoute(start, end) {
  const maxEndpointDistanceKm = 0.08;
  let best = null;
  for (const cache of loadRouteCaches()) {
    for (const route of cache.routes || []) {
      const startDistance = distanceBetweenCoordinates(
        Number(start.latitude),
        Number(start.longitude),
        Number(route.startLatitude),
        Number(route.startLongitude)
      );
      if (startDistance > maxEndpointDistanceKm) continue;
      const endDistance = distanceBetweenCoordinates(
        Number(end.latitude),
        Number(end.longitude),
        Number(route.endLatitude),
        Number(route.endLongitude)
      );
      if (endDistance > maxEndpointDistanceKm) continue;
      const score = startDistance + endDistance;
      if (!best || score < best.score) best = { route, score, cache };
    }
  }
  if (!best || !Array.isArray(best.route.points) || best.route.points.length < 2) return null;
  const points = dedupeRoutePoints([start, ...best.route.points, end]);
  const distanceKm = routeDistanceKm(points);
  const directDistanceKm = distanceBetweenCoordinates(
    Number(start.latitude),
    Number(start.longitude),
    Number(end.latitude),
    Number(end.longitude)
  );
  if (directDistanceKm < 2 && distanceKm > Math.max(1.2, directDistanceKm * 3.2)) return null;
  return {
    points,
    distanceKm,
    durationMinutes: Math.max(1, Number(best.route.durationMinutes) || Math.round(distanceKm / 30 * 60)),
    graphId: `route-cache:${best.cache.cityId || best.route.cityId || "unknown"}`,
    snapDistanceKm: Number(best.score.toFixed(3))
  };
}

function routeGeometryLooksReasonable(route, start, end) {
  const points = route?.points || [];
  if (!Array.isArray(points) || points.length < 2) return false;
  const directDistanceKm = distanceBetweenCoordinates(
    Number(start.latitude),
    Number(start.longitude),
    Number(end.latitude),
    Number(end.longitude)
  );
  if (directDistanceKm < 0.05) return true;

  const routeDistance = Number(route.distanceKm) || routeDistanceKm(points);
  const first = points[0];
  const last = points[points.length - 1];
  const startGap = distanceBetweenCoordinates(Number(start.latitude), Number(start.longitude), Number(first.latitude), Number(first.longitude));
  const endGap = distanceBetweenCoordinates(Number(end.latitude), Number(end.longitude), Number(last.latitude), Number(last.longitude));
  if (startGap > 0.12 || endGap > 0.12) return false;
  if (directDistanceKm < 1 && routeDistance > Math.max(0.85, directDistanceKm * 2.1)) return false;
  if (directDistanceKm < 2 && routeDistance > Math.max(1.35, directDistanceKm * 2.6)) return false;

  const origin = projectRoutePoint(start, start);
  const target = projectRoutePoint(end, start);
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0) return true;
  const len = Math.sqrt(lenSq);
  let minAlong = Infinity;
  let maxAlong = -Infinity;
  let maxPerp = 0;
  for (const point of points) {
    const projected = projectRoutePoint(point, start);
    const px = projected.x - origin.x;
    const py = projected.y - origin.y;
    const along = (px * dx + py * dy) / len;
    const perp = Math.abs(px * dy - py * dx) / len;
    minAlong = Math.min(minAlong, along);
    maxAlong = Math.max(maxAlong, along);
    maxPerp = Math.max(maxPerp, perp);
  }

  if (directDistanceKm < 2) {
    const slack = Math.max(0.28, directDistanceKm * 0.42);
    if (minAlong < -slack || maxAlong > directDistanceKm + slack) return false;
    if (maxPerp > Math.max(0.35, directDistanceKm * 0.9)) return false;
  }
  return true;
}

function projectRoutePoint(point, origin) {
  const lat = Number(point.latitude);
  const lon = Number(point.longitude);
  const originLat = Number(origin.latitude);
  const originLon = Number(origin.longitude);
  const meanLat = ((lat + originLat) / 2) * Math.PI / 180;
  return {
    x: (lon - originLon) * Math.cos(meanLat) * 111.32,
    y: (lat - originLat) * 110.57
  };
}

function fallbackOfflineRoute(start, end) {
  const points = offlineRoutePoints(start, end);
  const distanceKm = routeDistanceKm(points);
  return {
    points,
    distanceKm,
    durationMinutes: Math.max(1, Math.round(distanceKm / 24 * 60)),
    graphId: "offline-fallback",
    snapDistanceKm: 0
  };
}

function localRoadRoute(start, end) {
  const cachedRoute = cachedRoadRoute(start, end);
  if (cachedRoute && routeGeometryLooksReasonable(cachedRoute, start, end)) return cachedRoute;
  for (const graph of loadRoadGraphs()) {
    const route = routeOnGraph(graph, start, end);
    if (route && routeGeometryLooksReasonable(route, start, end)) return route;
  }
  return null;
}

async function onlineRoadRoute(start, end) {
  if (!ROUTE_ONLINE_FETCH) return null;
  const startLat = Number(start.latitude);
  const startLon = Number(start.longitude);
  const endLat = Number(end.latitude);
  const endLon = Number(end.longitude);
  const url = "https://router.project-osrm.org/route/v1/driving/" +
    `${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson&steps=false`;

  try {
    const payload = await fetchJson(url, ROUTE_FETCH_TIMEOUT_MS);
    const first = Array.isArray(payload.routes) ? payload.routes[0] : null;
    const coordinates = first?.geometry?.coordinates;
    if (payload.code !== "Ok" || !Array.isArray(coordinates) || coordinates.length < 2) return null;
    const points = dedupeRoutePoints([
      start,
      ...coordinates.map((coordinate) => ({
        latitude: Number(Number(coordinate[1]).toFixed(6)),
        longitude: Number(Number(coordinate[0]).toFixed(6))
      })),
      end
    ]);
    const route = {
      points,
      distanceKm: Number(((Number(first.distance) || routeDistanceKm(points) * 1000) / 1000).toFixed(2)),
      durationMinutes: Math.max(1, Math.round((Number(first.duration) || routeDistanceKm(points) / 30 * 3600) / 60)),
      graphId: "online-osrm",
      snapDistanceKm: 0
    };
    if (!routeGeometryLooksReasonable(route, start, end)) return null;
    saveOnlineRouteCache(start, end, route);
    return route;
  } catch (error) {
    console.warn(`[route] online OSRM route failed: ${error.message}`);
    return null;
  }
}

async function drivingRoute(start, end) {
  const localRoute = localRoadRoute(start, end);
  if (localRoute) return localRoute;
  const onlineRoute = await onlineRoadRoute(start, end);
  if (onlineRoute) return onlineRoute;
  return fallbackOfflineRoute(start, end);
}

async function drivingRouteThrough(stops) {
  const validStops = (Array.isArray(stops) ? stops : []).filter(Boolean);
  if (validStops.length < 2) {
    return {
      points: validStops,
      distanceKm: 0,
      durationMinutes: 0,
      graphId: "empty-route",
      snapDistanceKm: 0
    };
  }
  const points = [];
  let distanceKm = 0;
  let durationMinutes = 0;
  const graphIds = [];
  let snapDistanceKm = 0;
  for (let index = 1; index < validStops.length; index += 1) {
    const route = await drivingRoute(validStops[index - 1], validStops[index]);
    const segmentPoints = Array.isArray(route.points) && route.points.length >= 2
      ? route.points
      : [validStops[index - 1], validStops[index]];
    if (points.length === 0) {
      points.push(...segmentPoints);
    } else {
      points.push(...segmentPoints.slice(1));
    }
    distanceKm += Number(route.distanceKm) || routeDistanceKm(segmentPoints);
    durationMinutes += Number(route.durationMinutes) || domain.estimateTripDuration(routeDistanceKm(segmentPoints));
    graphIds.push(route.graphId || "route");
    snapDistanceKm += Number(route.snapDistanceKm) || 0;
  }
  return {
    points: dedupeRoutePoints(points),
    distanceKm: Number(distanceKm.toFixed(2)),
    durationMinutes: Math.max(1, Math.round(durationMinutes)),
    graphId: graphIds.join("+"),
    snapDistanceKm: Number(snapDistanceKm.toFixed(2))
  };
}

async function roadRoutePoints(start, end) {
  return (await drivingRoute(start, end)).points;
}

async function roadRoutePointsThrough(stops) {
  return (await drivingRouteThrough(stops)).points;
}

function offlineRoutePoints(start, end) {
  const latDelta = Number(end.latitude) - Number(start.latitude);
  const lngDelta = Number(end.longitude) - Number(start.longitude);
  if (Math.abs(latDelta) < 0.0001 && Math.abs(lngDelta) < 0.0001) {
    return [start, end];
  }
  const hash = Math.trunc(start.latitude * 10000) ^
    Math.trunc(start.longitude * 10000) ^
    Math.trunc(end.latitude * 10000) ^
    Math.trunc(end.longitude * 10000);
  const latSign = latDelta === 0 ? (hash % 2 === 0 ? 1 : -1) : Math.sign(latDelta);
  const lngSign = lngDelta === 0 ? (hash % 2 === 0 ? 1 : -1) : Math.sign(lngDelta);
  const points = [start];
  const point = (latRatio, lngRatio) => ({
    latitude: Number((start.latitude + latDelta * latRatio).toFixed(6)),
    longitude: Number((start.longitude + lngDelta * lngRatio).toFixed(6))
  });

  const span = Math.max(Math.abs(latDelta), Math.abs(lngDelta));
  const lateralOffset = Math.min(0.004, Math.max(0.00045, span * 0.18));
  if (Math.abs(latDelta) >= Math.abs(lngDelta)) {
    const lateral = lngSign * lateralOffset;
    points.push(
      point(0.16, 0.04),
      {
        latitude: Number((start.latitude + latDelta * 0.28).toFixed(6)),
        longitude: Number((start.longitude + lngDelta * 0.18 + lateral).toFixed(6))
      },
      {
        latitude: Number((start.latitude + latDelta * 0.56).toFixed(6)),
        longitude: Number((start.longitude + lngDelta * 0.42 + lateral).toFixed(6))
      },
      {
        latitude: Number((start.latitude + latDelta * 0.72).toFixed(6)),
        longitude: Number((start.longitude + lngDelta * 0.72 + lateral * 0.45).toFixed(6))
      },
      point(0.9, 0.92)
    );
  } else {
    const lateral = latSign * lateralOffset;
    points.push(
      point(0.04, 0.16),
      {
        latitude: Number((start.latitude + latDelta * 0.18 + lateral).toFixed(6)),
        longitude: Number((start.longitude + lngDelta * 0.32).toFixed(6))
      },
      {
        latitude: Number((start.latitude + latDelta * 0.44 + lateral).toFixed(6)),
        longitude: Number((start.longitude + lngDelta * 0.58).toFixed(6))
      },
      {
        latitude: Number((start.latitude + latDelta * 0.72 + lateral * 0.45).toFixed(6)),
        longitude: Number((start.longitude + lngDelta * 0.78).toFixed(6))
      },
      point(0.92, 0.9)
    );
  }
  points.push(end);
  return dedupeRoutePoints(points);
}

function dedupeRoutePoints(points) {
  const deduped = [];
  for (const point of points) {
    const previous = deduped[deduped.length - 1];
    if (!previous || domain.calculateHaversineDistance(previous, point) > 0.02) {
      deduped.push(point);
    }
  }
  return deduped.length < 2 ? points : deduped;
}

function routeDistanceKm(points) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let distance = 0;
  for (let index = 1; index < points.length; index += 1) {
    distance += domain.calculateHaversineDistance(points[index - 1], points[index]);
  }
  return distance;
}

function autoPickupDistanceKm(ride) {
  const routeDistance = routeDistanceKm(ride.automationFlow?.driverToPickupRoute);
  if (routeDistance > 0) return routeDistance;
  const start = {
    latitude: ride.automationFlow?.driverStartLatitude ?? ride.pickupLatitude,
    longitude: ride.automationFlow?.driverStartLongitude ?? ride.pickupLongitude
  };
  return domain.calculateHaversineDistance(start, { latitude: ride.pickupLatitude, longitude: ride.pickupLongitude });
}

function autoTripDistanceKm(ride) {
  const routeDistance = routeDistanceKm(ride.automationFlow?.pickupToDestinationRoute);
  if (routeDistance > 0) return routeDistance;
  return Number(ride.estimatedDistance) || routeDistanceForStops(rideStopsForRide(ride));
}

function pointAlongRoute(points, ratio) {
  if (!Array.isArray(points) || points.length === 0) return null;
  if (points.length === 1) return points[0];
  const targetRatio = Math.max(0, Math.min(1, ratio));
  const total = routeDistanceKm(points);
  if (total <= 0) return points[points.length - 1];
  let traveled = 0;
  const targetDistance = total * targetRatio;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segment = domain.calculateHaversineDistance(start, end);
    if (traveled + segment >= targetDistance) {
      const segmentRatio = segment <= 0 ? 1 : (targetDistance - traveled) / segment;
      return {
        latitude: interpolate(start.latitude, end.latitude, segmentRatio),
        longitude: interpolate(start.longitude, end.longitude, segmentRatio)
      };
    }
    traveled += segment;
  }
  return points[points.length - 1];
}

function chooseAutoDriverStart(ride) {
  const options = [
    { latitude: ride.pickupLatitude + 0.018, longitude: ride.pickupLongitude - 0.018 },
    { latitude: ride.pickupLatitude - 0.015, longitude: ride.pickupLongitude + 0.020 },
    { latitude: ride.pickupLatitude + 0.010, longitude: ride.pickupLongitude + 0.026 },
    { latitude: ride.pickupLatitude - 0.020, longitude: ride.pickupLongitude - 0.012 }
  ];
  const seed = Math.abs(Math.round((ride.pickupLatitude * 1000) + (ride.pickupLongitude * 1000)));
  return options[seed % options.length];
}

function scheduleAutoAccept(ride) {
  ride.automationFlow = ride.automationFlow || {};
  if (!ride.automationFlow.acceptAt) {
    ride.automationFlow.acceptAt = secondsFromNow(randomSeconds(AUTO_ACCEPT_MIN_SECONDS, AUTO_ACCEPT_MAX_SECONDS));
  }
}

function scheduleAutoArrival(ride) {
  ride.automationFlow = ride.automationFlow || {};
  if (!ride.automationFlow.arriveAt) {
    const seconds = secondsByDistance(autoPickupDistanceKm(ride), AUTO_ARRIVE_MIN_SECONDS, AUTO_ARRIVE_MAX_SECONDS);
    ride.automationFlow.arriveDurationSeconds = seconds;
    ride.automationFlow.arriveAt = secondsFromNow(seconds);
  }
}

function scheduleAutoCompletion(ride) {
  ride.automationFlow = ride.automationFlow || {};
  const seconds = secondsByDistance(autoTripDistanceKm(ride), AUTO_TRIP_MIN_SECONDS, AUTO_TRIP_MAX_SECONDS);
  ride.automationFlow.tripDurationSeconds = seconds;
  ride.automationFlow.completeAt = secondsFromNow(seconds);
}

function scheduleAutoBoarding(ride) {
  ride.automationFlow = ride.automationFlow || {};
  if (!ride.automationFlow.riderBoardAt) {
    const seconds = randomSeconds(AUTO_BOARDING_MIN_SECONDS, AUTO_BOARDING_MAX_SECONDS);
    ride.automationFlow.riderBoardDurationSeconds = seconds;
    ride.automationFlow.riderBoardAt = secondsFromNow(seconds);
  }
}

function moveDriverAlongRoute(profile, points, startedAt, endsAt) {
  if (!profile || !startedAt || !endsAt) return;
  const total = Math.max(1, parseTime(endsAt) - parseTime(startedAt));
  const elapsed = Date.now() - parseTime(startedAt);
  const ratio = Math.max(0, Math.min(1, elapsed / total));
  const point = pointAlongRoute(points, ratio);
  if (!point) return;
  profile.currentLatitude = point.latitude;
  profile.currentLongitude = point.longitude;
  profile.updatedAt = domain.now();
}

async function ensureAutoRoutes(ride) {
  ride.automationFlow = ride.automationFlow || {};
  const driverStart = {
    latitude: ride.automationFlow.driverStartLatitude ?? ride.pickupLatitude + 0.008,
    longitude: ride.automationFlow.driverStartLongitude ?? ride.pickupLongitude - 0.008
  };
  const pickup = { latitude: ride.pickupLatitude, longitude: ride.pickupLongitude };
  if (!Array.isArray(ride.automationFlow.driverToPickupRoute) || ride.automationFlow.driverToPickupRoute.length < 2) {
    ride.automationFlow.driverToPickupRoute = await roadRoutePoints(driverStart, pickup);
  }
  if (!Array.isArray(ride.automationFlow.pickupToDestinationRoute) || ride.automationFlow.pickupToDestinationRoute.length < 2) {
    ride.automationFlow.pickupToDestinationRoute = await roadRoutePointsThrough(rideStopsForRide(ride));
  }
}

async function matchDriver(db, ride) {
  const candidate = findDispatchCandidate(db, ride);
  if (ride.status === "requested" || ride.status === "scheduled") {
    ride.status = "searching";
    addTimeline(ride, "searching", "Searching for nearby approved drivers");
  }
  if (candidate) {
    ride.driverId = candidate.profile.userId;
    ride.automationFlow = ride.automationFlow || {};
    ride.automationFlow.driverStartLatitude = candidate.profile.currentLatitude;
    ride.automationFlow.driverStartLongitude = candidate.profile.currentLongitude;
    await ensureAutoRoutes(ride);
    domain.createNotification(db, candidate.profile.userId, "ride_created", "Incoming ride", `${ride.pickupAddress} to ${ride.destinationAddress}`);
    if (AUTO_DISPATCH) {
      scheduleAutoAccept(ride);
      domain.createNotification(db, ride.riderId, "ride_searching", "Finding your driver", "A nearby driver is reviewing the trip.");
    }
  } else {
    domain.createNotification(db, ride.riderId, "ride_no_driver", "Still searching", "No approved driver is available yet.");
  }
  return candidate;
}

function findDispatchCandidate(db, ride) {
  const available = domain.nearbyDrivers(db, ride)
    .filter((item) => !driverHasAssignedActiveRide(db, item.profile.userId));
  const nearbyAvailable = available.find((item) => item.distanceKm <= AUTO_NEARBY_DRIVER_MAX_KM);
  if (nearbyAvailable) return nearbyAvailable;
  if (!AUTO_DISPATCH) return available[0] || null;

  const rejected = ride.rejectedDriverIds || [];
  const profile = db.driverProfiles.find((item) => {
    return item.verificationStatus === "approved" &&
      item.driverStatus !== "suspended" &&
      !rejected.includes(item.userId) &&
      !driverHasAssignedActiveRide(db, item.userId);
  });
  if (!profile) return null;

  const start = chooseAutoDriverStart(ride);
  profile.driverStatus = "online";
  profile.currentLatitude = Number(start.latitude.toFixed(6));
  profile.currentLongitude = Number(start.longitude.toFixed(6));
  profile.updatedAt = domain.now();
  return {
    profile,
    user: db.users.find((user) => user.id === profile.userId),
    distanceKm: domain.calculateHaversineDistance(
      { latitude: profile.currentLatitude, longitude: profile.currentLongitude },
      { latitude: ride.pickupLatitude, longitude: ride.pickupLongitude }
    )
  };
}

function buildDriverIncomingRideInput(profile, body = {}, { randomize = true } = {}) {
  const hasPickup = body.pickupLatitude != null && body.pickupLongitude != null;
  const pickupDistanceKm = Number(body.pickupDistanceKm) > 0
    ? Number(body.pickupDistanceKm)
    : Number((0.6 + Math.random() * 8.4).toFixed(2));
  const pickup = hasPickup
    ? { latitude: Number(body.pickupLatitude), longitude: Number(body.pickupLongitude) }
    : randomize
      ? offsetLocation(profile.currentLatitude, profile.currentLongitude, pickupDistanceKm, Math.random() * Math.PI * 2)
      : { latitude: profile.currentLatitude, longitude: profile.currentLongitude };

  const hasDestination = body.destinationLatitude != null && body.destinationLongitude != null;
  const destinationDistanceKm = Number(body.destinationDistanceKm) > 0
    ? Number(body.destinationDistanceKm)
    : Number((0.8 + Math.random() * 11.2).toFixed(2));
  const destination = hasDestination
    ? { latitude: Number(body.destinationLatitude), longitude: Number(body.destinationLongitude) }
    : offsetLocation(pickup.latitude, pickup.longitude, destinationDistanceKm, Math.random() * Math.PI * 2);

  return {
    pickupAddress: body.pickupAddress || `Pickup ${pickupDistanceKm.toFixed(1)} km away`,
    pickupLatitude: pickup.latitude,
    pickupLongitude: pickup.longitude,
    destinationAddress: body.destinationAddress || `Destination ${destinationDistanceKm.toFixed(1)} km away`,
    destinationLatitude: destination.latitude,
    destinationLongitude: destination.longitude,
    rideTier: body.rideTier || "standard",
    paymentMethod: "card_on_file"
  };
}

async function createDriverIncomingRide(db, driverUser, profile, body = {}, options = {}) {
  const rider = db.users.find((user) => user.role === "rider") || db.users[0];
  if (!rider) return { ok: false, status: 409, code: "RIDER_ACCOUNT_MISSING", message: "No rider account is available." };
  createDefaultRiderPaymentMethod(db, rider.id);
  const input = rideInput(buildDriverIncomingRideInput(profile, body, options));
  if (!input) return { ok: false, status: 400, code: "INVALID_LOCATION", message: "Request could not be created for this driver location." };
  const payment = validatePaymentMethod(db, rider.id, input);
  if (!payment.ok) return { ok: false, status: 400, code: payment.code, message: payment.message };
  const serviceArea = validateRideServiceArea(input);
  if (!serviceArea.ok) return { ok: false, status: 400, code: serviceArea.code, message: serviceArea.message };
  const estimate = estimateRide(db, input, serviceArea.city);
  const tier = normalizeRideTier(input.rideTier);
  const ride = createRideRecord({
    riderId: rider.id,
    driverId: driverUser.id,
    input,
    estimate,
    tier,
    schedule: { scheduledFor: null }
  });
  ride.automationFlow = ride.automationFlow || {};
  ride.automationFlow.driverStartLatitude = profile.currentLatitude;
  ride.automationFlow.driverStartLongitude = profile.currentLongitude;
  await ensureAutoRoutes(ride);
  scheduleAutoArrival(ride);
  scheduleAutoCompletion(ride);
  delete ride.automationFlow.arriveAt;
  delete ride.automationFlow.completeAt;
  profile.driverStatus = "online";
  profile.updatedAt = domain.now();
  db.rides.unshift(ride);
  domain.createNotification(db, driverUser.id, "ride_created", "Incoming ride", `${ride.pickupAddress} to ${ride.destinationAddress}`);
  return { ok: true, ride };
}

function scheduleNextDriverRequest(profile) {
  profile.automationFlow = profile.automationFlow || {};
  profile.automationFlow.nextRequestAt = secondsFromNow(randomSeconds(AUTO_DRIVER_REQUEST_MIN_SECONDS, AUTO_DRIVER_REQUEST_MAX_SECONDS));
  profile.updatedAt = domain.now();
}

async function ensureDriverIncomingRide(db, driverUser) {
  if (!AUTO_DISPATCH) return false;
  const profile = profileFor(db, driverUser.id);
  if (!profile || profile.verificationStatus !== "approved" || profile.driverStatus !== "online") return false;
  if (driverHasAssignedActiveRide(db, driverUser.id)) return false;
  profile.automationFlow = profile.automationFlow || {};
  if (!profile.automationFlow.nextRequestAt) {
    scheduleNextDriverRequest(profile);
    return true;
  }
  if (Date.now() < parseTime(profile.automationFlow.nextRequestAt)) return false;
  const created = await createDriverIncomingRide(db, driverUser, profile, {}, { randomize: true });
  if (!created.ok) {
    profile.automationFlow.lastRequestError = created.code;
    scheduleNextDriverRequest(profile);
    return true;
  }
  profile.automationFlow.lastRequestAt = domain.now();
  delete profile.automationFlow.nextRequestAt;
  delete profile.automationFlow.lastRequestError;
  return true;
}

async function progressAutoRide(db, ride) {
  if (!AUTO_DISPATCH || !ride || !isActiveRide(ride)) return false;
  const before = JSON.stringify({
    status: ride.status,
    driverId: ride.driverId,
    driver: ride.driverId ? profileFor(db, ride.driverId) : null,
    automationFlow: ride.automationFlow || null
  });

  if (ride.status === "scheduled" && Date.now() < parseTime(ride.scheduledFor)) return false;

  if ((ride.status === "requested" || ride.status === "scheduled" || !ride.driverId) && ["scheduled", "requested", "searching"].includes(ride.status)) {
    await matchDriver(db, ride);
  }

  if (ride.status === "searching" && ride.driverId) {
    if (hasActiveSession(db, ride.driverId)) {
      return before !== JSON.stringify({
        status: ride.status,
        driverId: ride.driverId,
        driver: ride.driverId ? profileFor(db, ride.driverId) : null,
        automationFlow: ride.automationFlow || null
      });
    }
    scheduleAutoAccept(ride);
    if (Date.now() >= parseTime(ride.automationFlow.acceptAt)) {
      const accepted = updateRideStatus(db, ride, "accepted");
      if (accepted.ok) {
        domain.createNotification(db, ride.riderId, "ride_matched", "Driver matched", `${domain.publicUser(db.users.find((user) => user.id === ride.driverId))?.name || "Your driver"} has accepted.`);
        await ensureAutoRoutes(ride);
        const arriving = updateRideStatus(db, ride, "driver_arriving");
        if (arriving.ok) scheduleAutoArrival(ride);
      }
    }
  }

  if (ride.status === "accepted") {
    const arriving = updateRideStatus(db, ride, "driver_arriving");
    if (arriving.ok) scheduleAutoArrival(ride);
  }

  if (ride.status === "driver_arriving") {
    scheduleAutoArrival(ride);
    await ensureAutoRoutes(ride);
    const profile = profileFor(db, ride.driverId);
    moveDriverAlongRoute(
      profile,
      ride.automationFlow.driverToPickupRoute,
      ride.driverArrivingAt || ride.acceptedAt,
      ride.automationFlow.arriveAt
    );
    if (Date.now() >= parseTime(ride.automationFlow.arriveAt)) {
      if (hasActiveSession(db, ride.driverId)) {
        return before !== JSON.stringify({
          status: ride.status,
          driverId: ride.driverId,
          driver: ride.driverId ? profileFor(db, ride.driverId) : null,
          automationFlow: ride.automationFlow || null
        });
      }
      if (profile) {
        profile.currentLatitude = ride.pickupLatitude;
        profile.currentLongitude = ride.pickupLongitude;
        profile.updatedAt = domain.now();
      }
      updateRideStatus(db, ride, "arrived");
      addArrivalMessage(db, ride);
      domain.createNotification(db, ride.riderId, "driver_arrived", "Driver arrived", "Confirm pickup when you are in the car.");
    }
  }

  if (ride.status === "arrived") {
    scheduleAutoBoarding(ride);
    if (Date.now() >= parseTime(ride.automationFlow.riderBoardAt)) {
      const started = updateRideStatus(db, ride, "in_progress");
      if (started.ok) {
        domain.createNotification(db, ride.driverId, "rider_confirmed_pickup", "Pickup confirmed", "The rider confirmed pickup. Start driving to destination.");
      }
    }
  }

  if (ride.status === "in_progress") {
    if (!ride.automationFlow?.completeAt) scheduleAutoCompletion(ride);
    await ensureAutoRoutes(ride);
    const profile = profileFor(db, ride.driverId);
    moveDriverAlongRoute(
      profile,
      ride.automationFlow.pickupToDestinationRoute,
      ride.startedAt,
      ride.automationFlow.completeAt
    );
    if (Date.now() >= parseTime(ride.automationFlow.completeAt)) {
      updateRideStatus(db, ride, "completed");
    }
  }

  return before !== JSON.stringify({
    status: ride.status,
    driverId: ride.driverId,
    driver: ride.driverId ? profileFor(db, ride.driverId) : null,
    automationFlow: ride.automationFlow || null
  });
}

function updateRideStatus(db, ride, nextStatus) {
  const transition = domain.validateTransition(ride.status, nextStatus);
  if (!transition.ok) return transition;
  if (nextStatus === "arrived") {
    const expectedArrivalAt = parseTime(ride.automationFlow?.arriveAt);
    if (expectedArrivalAt > 0 && Date.now() < expectedArrivalAt) {
      const secondsRemaining = Math.max(1, Math.ceil((expectedArrivalAt - Date.now()) / 1000));
      return {
        ok: false,
        code: "DRIVER_STILL_EN_ROUTE",
        message: `Driver is still en route. Mark arrived in about ${secondsRemaining} seconds.`
      };
    }
    const profile = profileFor(db, ride.driverId);
    if (!profile) {
      return { ok: false, code: "DRIVER_PROFILE_MISSING", message: "Driver profile is missing." };
    }
    const distanceKm = domain.calculateHaversineDistance(
      { latitude: profile.currentLatitude, longitude: profile.currentLongitude },
      { latitude: ride.pickupLatitude, longitude: ride.pickupLongitude }
    );
    if (distanceKm > DRIVER_ARRIVAL_MAX_KM) {
      return {
        ok: false,
        code: "DRIVER_NOT_AT_PICKUP",
        message: `Move within ${Math.round(DRIVER_ARRIVAL_MAX_KM * 1000)} m of the pickup before marking arrived.`
      };
    }
  }
  if (nextStatus === "completed") {
    const expectedCompleteAt = parseTime(ride.automationFlow?.completeAt);
    if (expectedCompleteAt > 0 && Date.now() < expectedCompleteAt) {
      const secondsRemaining = Math.max(1, Math.ceil((expectedCompleteAt - Date.now()) / 1000));
      return {
        ok: false,
        code: "DRIVER_STILL_ON_TRIP",
        message: `Trip is still in progress. Complete it in about ${secondsRemaining} seconds.`
      };
    }
    const profile = profileFor(db, ride.driverId);
    if (!profile) {
      return { ok: false, code: "DRIVER_PROFILE_MISSING", message: "Driver profile is missing." };
    }
    const distanceKm = domain.calculateHaversineDistance(
      { latitude: profile.currentLatitude, longitude: profile.currentLongitude },
      { latitude: ride.destinationLatitude, longitude: ride.destinationLongitude }
    );
    if (distanceKm > DRIVER_COMPLETION_MAX_KM) {
      return {
        ok: false,
        code: "DRIVER_NOT_AT_DESTINATION",
        message: `Move within ${Math.round(DRIVER_COMPLETION_MAX_KM * 1000)} m of the destination before completing the trip.`
      };
    }
  }
  ride.status = nextStatus;
  addTimeline(ride, nextStatus, nextStatus.replaceAll("_", " "));
  if (nextStatus === "accepted") {
    ride.acceptedAt = domain.now();
    const profile = profileFor(db, ride.driverId);
    if (profile) profile.driverStatus = "busy";
    domain.createNotification(db, ride.riderId, "ride_accepted", "Driver accepted", "Your driver accepted the ride.");
  }
  if (nextStatus === "driver_arriving") {
    ride.driverArrivingAt = domain.now();
    ride.automationFlow = ride.automationFlow || {};
    scheduleAutoArrival(ride);
    domain.createNotification(db, ride.riderId, "ride_status_updated", "Driver is on the way", "Your driver is heading to pickup.");
  }
  if (nextStatus === "arrived") {
    addArrivalMessage(db, ride);
    domain.createNotification(db, ride.riderId, "ride_status_updated", "Driver arrived", "Your driver is waiting at pickup.");
  }
  if (nextStatus === "in_progress") {
    ride.startedAt = domain.now();
    scheduleAutoCompletion(ride);
    domain.createNotification(db, ride.riderId, "ride_status_updated", "Trip started", "Your trip is now in progress.");
  }
  if (nextStatus === "completed") {
    ride.completedAt = domain.now();
    ride.finalDistance = ride.estimatedDistance;
    ride.finalDuration = ride.estimatedDuration;
    ride.finalFare = ride.estimatedFare;
    const profile = profileFor(db, ride.driverId);
    if (profile) {
      profile.driverStatus = "online";
      profile.currentLatitude = ride.destinationLatitude;
      profile.currentLongitude = ride.destinationLongitude;
      profile.totalTrips += 1;
      profile.updatedAt = domain.now();
    }
    const payment = domain.createPaymentRecord(db, ride);
    const decimals = payment.currencyDecimals ?? 2;
    domain.createNotification(db, ride.riderId, "ride_completed", "Trip completed", `Payment of ${payment.currencySymbol || "$"}${payment.amount.toFixed(decimals)} was captured.`);
    domain.createNotification(db, ride.driverId, "payment_updated", "Earnings updated", `You earned ${payment.currencySymbol || "$"}${payment.driverEarnings.toFixed(decimals)} on this trip.`);
  }
  return { ok: true };
}

function currentActiveRide(rides) {
  return rides.find((ride) => {
    if (!isActiveRide(ride)) return false;
    if (ride.status !== "scheduled") return true;
    return parseTime(ride.scheduledFor) <= Date.now();
  }) || null;
}

async function handle(req, res) {
  if (req.method === "OPTIONS") return json(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (await handleMapTile(req, res, url)) return;
  const db = store.loadDb();

  if (url.pathname === "/health") return ok(res, { status: "ok" });
  if (url.pathname === "/route/driving" && req.method === "POST") {
    const body = await readBody(req);
    const start = domain.normalizeLocation({
      latitude: body.startLatitude,
      longitude: body.startLongitude
    });
    const end = domain.normalizeLocation({
      latitude: body.endLatitude,
      longitude: body.endLongitude
    });
    if (!start || !end) return fail(res, 400, "INVALID_ROUTE_POINTS", "Choose valid route endpoints.");
    const waypoints = [];
    for (const item of Array.isArray(body.waypoints) ? body.waypoints : []) {
      const waypoint = domain.normalizeLocation({
        latitude: item?.latitude,
        longitude: item?.longitude
      });
      if (!waypoint) return fail(res, 400, "INVALID_ROUTE_POINTS", "Choose valid route endpoints.");
      waypoints.push(waypoint);
    }
    const route = await drivingRouteThrough([start, ...waypoints, end]);
    return ok(res, {
      points: route.points,
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
      graphId: route.graphId,
      snapDistanceKm: route.snapDistanceKm
    });
  }
  if (url.pathname === "/dev/tile-debug") {
    if (url.searchParams.get("reset") === "1") recentTileRequests.length = 0;
    return ok(res, tileDebugSummary());
  }
  if (url.pathname === "/dev/reset" && req.method === "POST") {
    const reset = store.loadDb();
    return ok(res, { reset: true, meta: reset.meta }, "Seed data reset.");
  }
  if (url.pathname === "/config/bootstrap") {
    return ok(res, {
      locations: publicLocations(),
      serviceCities: publicServiceCities(),
      rideTiers,
      city: db.meta.city
    });
  }
  if (url.pathname === "/search/places" && req.method === "GET") {
    return ok(res, {
      places: searchPlacesLocal({
        q: url.searchParams.get("q"),
        cityId: url.searchParams.get("cityId"),
        lat: url.searchParams.get("lat"),
        lon: url.searchParams.get("lon"),
        limit: url.searchParams.get("limit")
      })
    });
  }

  if (url.pathname === "/auth/register" && req.method === "POST") {
    const body = await readBody(req);
    const registration = validateRegistration(body);
    if (!registration.ok) return fail(res, 400, registration.code, registration.message);
    const email = registration.email;
    if (db.users.some((user) => domain.normalizeEmail(user.email) === email)) return fail(res, 409, "EMAIL_EXISTS", "Email already exists.");
    const user = {
      id: domain.makeId("usr"),
      name: registration.name,
      email,
      phone: String(body.phone || "").trim(),
      passwordHash: domain.hashPassword(registration.password),
      role: registration.role,
      profileImageUrl: "",
      isVerified: registration.role !== "driver",
      createdAt: domain.now(),
      updatedAt: domain.now()
    };
    db.users.push(user);
    if (user.role === "driver") {
      db.driverProfiles.push({
        id: domain.makeId("drv_profile"),
        userId: user.id,
        licenseNumber: "",
        vehicleMake: "",
        vehicleModel: "",
        vehicleYear: "",
        licensePlate: "",
        vehicleColor: "",
        verificationStatus: "pending",
        driverStatus: "offline",
        currentLatitude: 34.0522,
        currentLongitude: -118.2437,
        averageRating: 5,
        totalTrips: 0,
        createdAt: domain.now(),
        updatedAt: domain.now()
      });
    }
    if (user.role === "rider") {
      createDefaultRiderPaymentMethod(db, user.id);
    }
    const token = domain.createToken();
    db.sessions.push({ id: domain.makeId("session"), token, userId: user.id, createdAt: domain.now() });
    store.saveDb(db);
    return ok(res, { token, user: domain.publicUser(user), driverProfile: domain.publicDriver(db, profileFor(db, user.id)) }, "Registered.", 201);
  }

  if (url.pathname === "/auth/login" && req.method === "POST") {
    const body = await readBody(req);
    const user = db.users.find((item) => domain.normalizeEmail(item.email) === domain.normalizeEmail(body.email));
    if (!user || !domain.verifyPassword(body.password || "", user.passwordHash)) return fail(res, 401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    if (body.role && body.role !== user.role) return fail(res, 403, "ROLE_MISMATCH", "This account belongs to a different role.");
    const token = domain.createToken();
    db.sessions.push({ id: domain.makeId("session"), token, userId: user.id, createdAt: domain.now() });
    store.saveDb(db);
    return ok(res, { token, user: domain.publicUser(user), driverProfile: domain.publicDriver(db, profileFor(db, user.id)) }, "Logged in.");
  }

  if (url.pathname === "/auth/logout" && req.method === "POST") {
    const auth = getAuth(req, db);
    if (auth) {
      cancelSeededAccountActiveRides(db, auth.user, "Session ended on logout");
      db.sessions = db.sessions.filter((session) => session.token !== auth.token);
    }
    store.saveDb(db);
    return ok(res, {}, "Logged out.");
  }

  if (url.pathname === "/auth/me" || url.pathname === "/users/me") {
    const auth = requireAuth(req, res, db);
    if (!auth) return;
    if (req.method === "PATCH") {
      const body = await readBody(req);
      auth.user.name = body.name || auth.user.name;
      auth.user.phone = body.phone || auth.user.phone;
      auth.user.updatedAt = domain.now();
      store.saveDb(db);
    }
    return ok(res, { user: domain.publicUser(auth.user), driverProfile: domain.publicDriver(db, profileFor(db, auth.user.id)) });
  }

  const userDetail = url.pathname.match(/^\/users\/([^/]+)$/);
  if (userDetail && req.method === "GET") {
    const auth = requireAuth(req, res, db);
    if (!auth) return;
    const user = db.users.find((item) => item.id === userDetail[1]);
    if (!user) return fail(res, 404, "USER_NOT_FOUND", "User not found.");
    if (auth.user.role !== "admin" && auth.user.id !== user.id) {
      return fail(res, 403, "USER_FORBIDDEN", "You cannot view this user profile.");
    }
    return ok(res, { user: domain.publicUser(user) });
  }

  if (url.pathname === "/rides/estimate" && req.method === "POST") {
    const auth = requireRole(req, res, db, ["rider"]);
    if (!auth) return;
    const input = rideInput(await readBody(req));
    if (!input) return fail(res, 400, "INVALID_LOCATION", "Pickup and destination are required.");
    const payment = validatePaymentMethod(db, auth.user.id, input);
    if (!payment.ok) return fail(res, 400, payment.code, payment.message);
    const promo = validatePromoInput(db, input, auth.user.id);
    if (!promo.ok) return fail(res, 404, promo.code, promo.message);
    const serviceArea = validateRideServiceArea(input);
    if (!serviceArea.ok) return fail(res, 400, serviceArea.code, serviceArea.message);
    const schedule = validateScheduledFor(input.scheduledFor);
    if (!schedule.ok) return fail(res, 400, schedule.code, schedule.message);
    return ok(res, estimateRide(db, input, serviceArea.city, schedule.scheduledFor), "Fare estimated.");
  }

  if (url.pathname === "/rides/request" && req.method === "POST") {
    const auth = requireRole(req, res, db, ["rider"]);
    if (!auth) return;
    const existingActive = currentActiveRide(db.rides.filter((ride) => ride.riderId === auth.user.id));
    if (existingActive) {
      if (await progressAutoRide(db, existingActive)) store.saveDb(db);
      return ok(res, { ride: domain.publicRide(db, existingActive) }, "An active ride is already in progress.");
    }
    const input = rideInput(await readBody(req));
    if (!input) return fail(res, 400, "INVALID_LOCATION", "Pickup and destination are required.");
    const payment = validatePaymentMethod(db, auth.user.id, input);
    if (!payment.ok) return fail(res, 400, payment.code, payment.message);
    const promo = validatePromoInput(db, input, auth.user.id);
    if (!promo.ok) return fail(res, 404, promo.code, promo.message);
    const serviceArea = validateRideServiceArea(input);
    if (!serviceArea.ok) return fail(res, 400, serviceArea.code, serviceArea.message);
    const schedule = validateScheduledFor(input.scheduledFor);
    if (!schedule.ok) return fail(res, 400, schedule.code, schedule.message);
    const estimate = estimateRide(db, input, serviceArea.city, schedule.scheduledFor);
    const tier = normalizeRideTier(input.rideTier);
    const ride = {
      id: domain.makeId("ride"),
      riderId: auth.user.id,
      driverId: null,
      ...input,
      status: schedule.scheduledFor ? "scheduled" : "requested",
      rideTier: tier.id,
      rideTierTitle: tier.title,
      estimatedDistance: estimate.estimatedDistance,
      estimatedDuration: estimate.estimatedDuration,
      estimatedFare: estimate.fareBreakdown.estimatedTotal,
      currencyCode: estimate.fareBreakdown.currencyCode,
      currencySymbol: estimate.fareBreakdown.currencySymbol,
      currencyDecimals: estimate.fareBreakdown.currencyDecimals,
      finalDistance: null,
      finalDuration: null,
      finalFare: null,
      fareBreakdown: estimate.fareBreakdown,
      promoCode: estimate.fareBreakdown.promoCode,
      discountAmount: estimate.fareBreakdown.discountAmount,
      paymentStatus: "authorized",
      cancellationReason: "",
      rejectedDriverIds: [],
      messages: [],
      scheduledFor: schedule.scheduledFor,
      timeline: [{
        status: schedule.scheduledFor ? "scheduled" : "requested",
        label: schedule.scheduledFor ? "Ride scheduled" : "Ride requested",
        at: domain.now()
      }],
      createdAt: domain.now(),
      acceptedAt: null,
      driverArrivingAt: null,
      startedAt: null,
      completedAt: null,
      cancelledAt: null
    };
    db.rides.unshift(ride);
    if (promo.promo) consumePromoForUser(db, auth.user.id, promo.promo, ride.id);
    if (!schedule.scheduledFor) await matchDriver(db, ride);
    store.saveDb(db);
    return ok(res, { ride: domain.publicRide(db, ride) }, "Ride requested.", 201);
  }

  if (url.pathname === "/rides/active") {
    const auth = requireAuth(req, res, db);
    if (!auth) return;
    const rides = auth.user.role === "driver"
      ? db.rides.filter((ride) => ride.driverId === auth.user.id)
      : db.rides.filter((ride) => ride.riderId === auth.user.id);
    let ride = currentActiveRide(rides);
    if (await progressAutoRide(db, ride)) {
      store.saveDb(db);
      ride = currentActiveRide(rides);
    }
    return ok(res, { ride: domain.publicRide(db, ride) });
  }

  const rideWaypoints = url.pathname.match(/^\/rides\/([^/]+)\/waypoints$/);
  if (rideWaypoints && req.method === "PATCH") {
    const auth = requireRole(req, res, db, ["rider"]);
    if (!auth) return;
    const ride = db.rides.find((item) => item.id === rideWaypoints[1] && item.riderId === auth.user.id);
    if (!ride) return fail(res, 404, "RIDE_NOT_FOUND", "Ride not found.");
    if (!isActiveRide(ride)) {
      return fail(res, 409, "RIDE_NOT_EDITABLE", "Completed or cancelled rides cannot be updated.");
    }
    if (await progressAutoRide(db, ride)) store.saveDb(db);
    if (!isActiveRide(ride)) {
      return fail(res, 409, "RIDE_NOT_EDITABLE", "Completed or cancelled rides cannot be updated.");
    }
    const body = await readBody(req);
    const input = rideInput({
      pickupAddress: ride.pickupAddress,
      pickupLatitude: ride.pickupLatitude,
      pickupLongitude: ride.pickupLongitude,
      destinationAddress: ride.destinationAddress,
      destinationLatitude: ride.destinationLatitude,
      destinationLongitude: ride.destinationLongitude,
      waypoints: Array.isArray(body.waypoints) ? body.waypoints : [],
      paymentMethod: ride.paymentMethod,
      rideTier: ride.rideTier,
      promoCode: ride.promoCode,
      scheduledFor: ride.scheduledFor
    });
    if (!input) return fail(res, 400, "INVALID_WAYPOINTS", "Choose valid stop addresses and coordinates.");
    const serviceArea = validateRideServiceArea(input);
    if (!serviceArea.ok) return fail(res, 400, serviceArea.code, serviceArea.message);
    const estimate = await updateRideWaypoints(db, ride, input, serviceArea.city);
    store.saveDb(db);
    return ok(res, { ride: domain.publicRide(db, ride), estimate }, "Stops updated.");
  }

  if (url.pathname === "/rides/history") {
    const auth = requireAuth(req, res, db);
    if (!auth) return;
    const rides = db.rides.filter((ride) => ride.riderId === auth.user.id || ride.driverId === auth.user.id).map((ride) => domain.publicRide(db, ride));
    return ok(res, { rides });
  }

  if (url.pathname === "/rides/scheduled" && req.method === "GET") {
    const auth = requireRole(req, res, db, ["rider"]);
    if (!auth) return;
    return ok(res, {
      rides: db.rides
        .filter((ride) => ride.riderId === auth.user.id && ride.status === "scheduled")
        .map((ride) => domain.publicRide(db, ride))
    });
  }

  const rideDetail = url.pathname.match(/^\/rides\/([^/]+)$/);
  if (rideDetail && req.method === "GET") {
    const auth = requireAuth(req, res, db);
    if (!auth) return;
    const ride = db.rides.find((item) => item.id === rideDetail[1]);
    if (!ride) return fail(res, 404, "RIDE_NOT_FOUND", "Ride not found.");
    if (!canAccessRide(auth.user, ride)) return fail(res, 403, "RIDE_FORBIDDEN", "You cannot view this ride.");
    return ok(res, { ride: domain.publicRide(db, ride) });
  }

  const rideMessages = url.pathname.match(/^\/rides\/([^/]+)\/messages$/);
  if (rideMessages && ["GET", "POST"].includes(req.method)) {
    const auth = requireAuth(req, res, db);
    if (!auth) return;
    const ride = db.rides.find((item) => item.id === rideMessages[1]);
    if (!ride) return fail(res, 404, "RIDE_NOT_FOUND", "Ride not found.");
    if (!canAccessRide(auth.user, ride)) return fail(res, 403, "RIDE_FORBIDDEN", "You cannot message this ride.");
    ride.messages = ride.messages || [];
    if (req.method === "GET") {
      return ok(res, { messages: ride.messages });
    }
    if (!ride.hasOwnProperty("messages")) ride.messages = [];
    if (!["accepted", "driver_arriving", "arrived", "in_progress"].includes(ride.status)) {
      return fail(res, 409, "MESSAGING_UNAVAILABLE", "Messaging is available after the driver accepts and before the trip ends.");
    }
    const body = await readBody(req);
    const messageBody = requireNonEmptyString(body.message || body.body);
    if (!messageBody) return fail(res, 400, "MESSAGE_REQUIRED", "Message cannot be empty.");
    const message = addRideMessage(db, ride, auth.user.id, messageBody);
    const recipientId = auth.user.id === ride.riderId ? ride.driverId : ride.riderId;
    if (recipientId) {
      domain.createNotification(db, recipientId, "ride_message", `Message from ${auth.user.name}`, message.body);
    }
    store.saveDb(db);
    return ok(res, { message, ride: domain.publicRide(db, ride) }, "Message sent.", 201);
  }

  const rideCancel = url.pathname.match(/^\/rides\/([^/]+)\/cancel$/);
  if (rideCancel && req.method === "POST") {
    const auth = requireAuth(req, res, db);
    if (!auth) return;
    const ride = db.rides.find((item) => item.id === rideCancel[1]);
    if (!ride || (ride.riderId !== auth.user.id && auth.user.role !== "admin")) return fail(res, 404, "RIDE_NOT_FOUND", "Ride not found.");
    if (!["scheduled", "requested", "searching", "accepted", "driver_arriving", "arrived"].includes(ride.status)) return fail(res, 409, "CANCEL_NOT_ALLOWED", "Ride can no longer be cancelled.");
    ride.status = "cancelled";
    ride.cancelledAt = domain.now();
    ride.cancellationReason = (await readBody(req)).reason || "Cancelled";
    addTimeline(ride, "cancelled", ride.cancellationReason);
    const profile = profileFor(db, ride.driverId);
    if (profile && profile.driverStatus === "busy") profile.driverStatus = "online";
    store.saveDb(db);
    return ok(res, { ride: domain.publicRide(db, ride) }, "Ride cancelled.");
  }

  const rideConfirmBoarding = url.pathname.match(/^\/rides\/([^/]+)\/confirm-boarding$/);
  if (rideConfirmBoarding && req.method === "POST") {
    const auth = requireRole(req, res, db, ["rider"]);
    if (!auth) return;
    const ride = db.rides.find((item) => item.id === rideConfirmBoarding[1]);
    if (!ride || ride.riderId !== auth.user.id) return fail(res, 404, "RIDE_NOT_FOUND", "Ride not found.");
    if (ride.status !== "arrived") return fail(res, 409, "DRIVER_NOT_ARRIVED", "Confirm pickup after the driver arrives.");
    const transition = updateRideStatus(db, ride, "in_progress");
    if (!transition.ok) return fail(res, 409, transition.code, transition.message);
    scheduleAutoCompletion(ride);
    store.saveDb(db);
    return ok(res, { ride: domain.publicRide(db, ride) }, "Pickup confirmed.");
  }

  const rideRating = url.pathname.match(/^\/rides\/([^/]+)\/rating$/);
  if (rideRating && req.method === "POST") {
    const auth = requireAuth(req, res, db);
    if (!auth) return;
    const body = await readBody(req);
    const ride = db.rides.find((item) => item.id === rideRating[1]);
    if (!ride || ride.status !== "completed") return fail(res, 409, "COMPLETED_RIDE_REQUIRED", "Ride must be completed before rating.");
    if (auth.user.id !== ride.riderId && auth.user.id !== ride.driverId) return fail(res, 403, "RATING_FORBIDDEN", "Only ride participants can rate this trip.");
    if (db.ratings.some((item) => item.rideId === ride.id && item.fromUserId === auth.user.id)) {
      return fail(res, 409, "RATING_ALREADY_SUBMITTED", "You already rated this trip.");
    }
    const toUserId = auth.user.id === ride.riderId ? ride.driverId : ride.riderId;
    if (!toUserId) return fail(res, 409, "RATING_TARGET_MISSING", "Rating target is missing.");
    const rating = { id: domain.makeId("rating"), rideId: ride.id, fromUserId: auth.user.id, toUserId, score: Math.max(1, Math.min(5, Number(body.score || 5))), comment: body.comment || "", createdAt: domain.now() };
    db.ratings.unshift(rating);
    const driverProfile = profileFor(db, ride.driverId);
    if (driverProfile && toUserId === ride.driverId) {
      const driverRatings = db.ratings.filter((item) => item.toUserId === ride.driverId);
      const average = driverRatings.reduce((sum, item) => sum + Number(item.score || 0), 0) / Math.max(driverRatings.length, 1);
      driverProfile.averageRating = Number(average.toFixed(2));
      driverProfile.updatedAt = domain.now();
    }
    store.saveDb(db);
    return ok(res, { rating, ride: domain.publicRide(db, ride) }, "Rating submitted.", 201);
  }

  if ((url.pathname === "/driver/profile" || url.pathname === "/driver/profile/") && ["GET", "POST", "PATCH"].includes(req.method)) {
    const auth = requireRole(req, res, db, ["driver"]);
    if (!auth) return;
    let profile = profileFor(db, auth.user.id);
    if (req.method !== "GET") {
      const body = await readBody(req);
      if (!profile) return fail(res, 404, "PROFILE_NOT_FOUND", "Driver profile not found.");
      ["licenseNumber", "vehicleMake", "vehicleModel", "vehicleYear", "licensePlate", "vehicleColor"].forEach((field) => {
        if (body[field] !== undefined) profile[field] = String(body[field]).trim();
      });
      const coords = domain.normalizeLocation(body);
      if (coords) {
        const serviceArea = validateDriverServiceArea(coords);
        if (!serviceArea.ok) return fail(res, 400, serviceArea.code, serviceArea.message);
        profile.currentLatitude = coords.latitude;
        profile.currentLongitude = coords.longitude;
      }
      profile.updatedAt = domain.now();
      store.saveDb(db);
    }
    return ok(res, { driverProfile: domain.publicDriver(db, profile) });
  }

  if (url.pathname === "/driver/documents" && ["GET", "POST"].includes(req.method)) {
    const auth = requireRole(req, res, db, ["driver"]);
    if (!auth) return;
    const profile = profileFor(db, auth.user.id);
    if (!profile) return fail(res, 404, "PROFILE_NOT_FOUND", "Driver profile not found.");
    if (req.method === "GET") {
      return ok(res, { documents: driverDocuments(profile), documentSummary: driverDocumentSummary(profile) });
    }
    const body = await readBody(req);
    const type = requireNonEmptyString(body.type || body.documentType);
    const allowedTypes = ["license", "insurance", "vehicle_inspection", "background_check", "vehicle_registration"];
    if (!allowedTypes.includes(type)) return fail(res, 400, "INVALID_DOCUMENT_TYPE", "Unsupported driver document type.");
    const identifier = requireNonEmptyString(body.identifier || body.documentId || body.reference);
    if (!identifier) return fail(res, 400, "DOCUMENT_IDENTIFIER_REQUIRED", "A document identifier is required.");
    const documents = driverDocuments(profile);
    const existing = documents.find((doc) => doc.type === type);
    const document = existing || {
      id: domain.makeId("doc"),
      type,
      createdAt: domain.now()
    };
    document.label = requireNonEmptyString(body.label) || type.replaceAll("_", " ");
    document.identifier = identifier;
    document.expiresAt = requireNonEmptyString(body.expiresAt) || "";
    document.status = "submitted";
    document.reviewNote = "";
    document.updatedAt = domain.now();
    if (!existing) documents.unshift(document);
    if (profile.verificationStatus === "rejected") profile.verificationStatus = "pending";
    profile.updatedAt = domain.now();
    db.users.filter((user) => user.role === "admin").forEach((admin) => {
      domain.createNotification(db, admin.id, "driver_document_submitted", "Driver document submitted", `${auth.user.name} submitted ${document.label}.`);
    });
    store.saveDb(db);
    return ok(res, { document, documents, documentSummary: driverDocumentSummary(profile), driverProfile: domain.publicDriver(db, profile) }, "Driver document submitted.", existing ? 200 : 201);
  }

  if (url.pathname === "/driver/status" && req.method === "PATCH") {
    const auth = requireRole(req, res, db, ["driver"]);
    if (!auth) return;
    const profile = profileFor(db, auth.user.id);
    const body = await readBody(req);
    const nextStatus = body.driverStatus || body.status;
    if (!profile) return fail(res, 404, "PROFILE_NOT_FOUND", "Driver profile not found.");
    if (profile.verificationStatus !== "approved") return fail(res, 403, "DRIVER_NOT_APPROVED", "Admin approval is required.");
    if (profile.driverStatus === "suspended") return fail(res, 403, "DRIVER_SUSPENDED", "This driver account is suspended.");
    if (!["online", "offline"].includes(nextStatus)) return fail(res, 400, "INVALID_DRIVER_STATUS", "Driver status must be online or offline.");
    if (profile.driverStatus === "busy" && nextStatus === "offline") return fail(res, 409, "DRIVER_BUSY", "Driver is on a trip.");
    if (nextStatus === "online" && driverHasAssignedActiveRide(db, auth.user.id)) {
      return fail(res, 409, "ACTIVE_TRIP_EXISTS", "Complete your active trip before going online.");
    }
    profile.driverStatus = nextStatus;
    if (nextStatus === "online") {
      scheduleNextDriverRequest(profile);
    } else {
      profile.automationFlow = profile.automationFlow || {};
      delete profile.automationFlow.nextRequestAt;
    }
    profile.updatedAt = domain.now();
    store.saveDb(db);
    return ok(res, { driverProfile: domain.publicDriver(db, profile) });
  }

  if (url.pathname === "/driver/location" && req.method === "PATCH") {
    const auth = requireRole(req, res, db, ["driver"]);
    if (!auth) return;
    const profile = profileFor(db, auth.user.id);
    const coords = domain.normalizeLocation(await readBody(req));
    if (coords) {
      const serviceArea = validateDriverServiceArea(coords);
      if (!serviceArea.ok) return fail(res, 400, serviceArea.code, serviceArea.message);
      profile.currentLatitude = coords.latitude;
      profile.currentLongitude = coords.longitude;
      profile.updatedAt = domain.now();
      store.saveDb(db);
    }
    return ok(res, { driverProfile: domain.publicDriver(db, profile) });
  }

  if (url.pathname === "/driver/incoming-ride" && req.method === "POST") {
    const auth = requireRole(req, res, db, ["driver"]);
    if (!auth) return;
    const profile = profileFor(db, auth.user.id);
    if (!profile) return fail(res, 404, "PROFILE_NOT_FOUND", "Driver profile not found.");
    if (profile.verificationStatus !== "approved") return fail(res, 403, "DRIVER_NOT_APPROVED", "Admin approval is required.");
    if (profile.driverStatus === "busy" || driverHasAssignedActiveRide(db, auth.user.id)) {
      return fail(res, 409, "ACTIVE_TRIP_EXISTS", "Complete the active trip before generating another request.");
    }
    const body = await readBody(req);
    const created = await createDriverIncomingRide(db, auth.user, profile, body, { randomize: true });
    if (!created.ok) return fail(res, created.status, created.code, created.message);
    const ride = created.ride;
    store.saveDb(db);
    return ok(res, { ride: domain.publicRide(db, ride), rides: db.rides.filter((item) => item.status === "searching" && item.driverId === auth.user.id).map((item) => domain.publicRide(db, item)) }, "Ride request generated.", 201);
  }

  if (url.pathname === "/driver/incoming-rides") {
    const auth = requireRole(req, res, db, ["driver"]);
    if (!auth) return;
    if (await ensureDriverIncomingRide(db, auth.user)) store.saveDb(db);
    return ok(res, { rides: db.rides.filter((ride) => ride.status === "searching" && ride.driverId === auth.user.id).map((ride) => domain.publicRide(db, ride)) });
  }

  if (url.pathname === "/driver/active-ride") {
    const auth = requireRole(req, res, db, ["driver"]);
    if (!auth) return;
    let ride = currentActiveRide(db.rides.filter((item) => item.driverId === auth.user.id));
    if (await progressAutoRide(db, ride)) {
      store.saveDb(db);
      ride = currentActiveRide(db.rides.filter((item) => item.driverId === auth.user.id));
    }
    return ok(res, { ride: domain.publicRide(db, ride) });
  }

  const accept = url.pathname.match(/^\/driver\/rides\/([^/]+)\/accept$/);
  if (accept && req.method === "POST") {
    const auth = requireRole(req, res, db, ["driver"]);
    if (!auth) return;
    const ride = db.rides.find((item) => item.id === accept[1]);
    if (!ride || ride.driverId !== auth.user.id || ride.status !== "searching") return fail(res, 409, "ACCEPT_NOT_ALLOWED", "Ride cannot be accepted.");
    const transition = updateRideStatus(db, ride, "accepted");
    if (!transition.ok) return fail(res, 409, transition.code, transition.message);
    store.saveDb(db);
    return ok(res, { ride: domain.publicRide(db, ride) }, "Ride accepted.");
  }

  const reject = url.pathname.match(/^\/driver\/rides\/([^/]+)\/reject$/);
  if (reject && req.method === "POST") {
    const auth = requireRole(req, res, db, ["driver"]);
    if (!auth) return;
    const ride = db.rides.find((item) => item.id === reject[1]);
    if (!ride || ride.driverId !== auth.user.id || ride.status !== "searching") return fail(res, 409, "REJECT_NOT_ALLOWED", "Ride cannot be rejected.");
    ride.rejectedDriverIds.push(auth.user.id);
    ride.driverId = null;
    await matchDriver(db, ride);
    store.saveDb(db);
    return ok(res, { ride: domain.publicRide(db, ride) }, "Ride rejected.");
  }

  const driverRideStatus = url.pathname.match(/^\/driver\/rides\/([^/]+)\/status$/);
  if (driverRideStatus && req.method === "PATCH") {
    const auth = requireRole(req, res, db, ["driver"]);
    if (!auth) return;
    const ride = db.rides.find((item) => item.id === driverRideStatus[1]);
    if (!ride || ride.driverId !== auth.user.id) return fail(res, 403, "DRIVER_NOT_ASSIGNED", "Only assigned driver can update ride.");
    const nextStatus = (await readBody(req)).status;
    if (nextStatus === "in_progress") {
      return fail(res, 409, "RIDER_CONFIRMATION_REQUIRED", "Wait for the rider to confirm pickup before starting the trip.");
    }
    const transition = updateRideStatus(db, ride, nextStatus);
    if (!transition.ok) return fail(res, 409, transition.code, transition.message);
    store.saveDb(db);
    return ok(res, { ride: domain.publicRide(db, ride) });
  }

  if (url.pathname === "/driver/earnings" || url.pathname === "/driver/history") {
    const auth = requireRole(req, res, db, ["driver"]);
    if (!auth) return;
    const rides = db.rides.filter((ride) => ride.driverId === auth.user.id).map((ride) => domain.publicRide(db, ride));
    const payments = db.payments.filter((payment) => payment.driverId === auth.user.id);
    const paidPayouts = publicPayouts(db, auth.user.id).filter((payout) => ["approved", "paid"].includes(payout.status));
    const pendingPayouts = publicPayouts(db, auth.user.id).filter((payout) => ["requested", "in_review"].includes(payout.status));
    const totalEarnings = payments.reduce((sum, payment) => sum + payment.driverEarnings, 0);
    const withdrawn = paidPayouts.reduce((sum, payout) => sum + payout.amount, 0);
    const pending = pendingPayouts.reduce((sum, payout) => sum + payout.amount, 0);
    const currency = payments[0] || {};
    return ok(res, {
      rides,
      earnings: {
        today: Number(totalEarnings.toFixed(2)),
        total: Number(totalEarnings.toFixed(2)),
        available: Number(Math.max(0, totalEarnings - withdrawn - pending).toFixed(2)),
        withdrawn: Number(withdrawn.toFixed(2)),
        pendingPayout: Number(pending.toFixed(2)),
        completedTrips: rides.filter((ride) => ride.status === "completed").length,
        currencyCode: currency.currencyCode || "USD",
        currencySymbol: currency.currencySymbol || "$",
        currencyDecimals: currency.currencyDecimals ?? 2
      }
    });
  }

  if (url.pathname === "/driver/payouts" && ["GET", "POST"].includes(req.method)) {
    const auth = requireRole(req, res, db, ["driver"]);
    if (!auth) return;
    db.payouts = db.payouts || [];
    if (req.method === "GET") return ok(res, { payouts: publicPayouts(db, auth.user.id) });
    const body = await readBody(req);
    const payments = db.payments.filter((payment) => payment.driverId === auth.user.id);
    const paidPayouts = publicPayouts(db, auth.user.id).filter((payout) => ["approved", "paid"].includes(payout.status));
    const pendingPayouts = publicPayouts(db, auth.user.id).filter((payout) => ["requested", "in_review"].includes(payout.status));
    const totalEarnings = payments.reduce((sum, payment) => sum + payment.driverEarnings, 0);
    const reserved = [...paidPayouts, ...pendingPayouts].reduce((sum, payout) => sum + payout.amount, 0);
    const available = Number(Math.max(0, totalEarnings - reserved).toFixed(2));
    const requestedAmount = Number(body.amount);
    const amount = Number.isFinite(requestedAmount) && requestedAmount > 0 ? Number(requestedAmount.toFixed(2)) : available;
    if (amount <= 0 || amount > available) return fail(res, 409, "PAYOUT_AMOUNT_INVALID", "Payout amount must be positive and no more than available earnings.");
    const currency = payments[0] || {};
    const payout = {
      id: domain.makeId("payout"),
      driverId: auth.user.id,
      amount,
      currencyCode: currency.currencyCode || "USD",
      currencySymbol: currency.currencySymbol || "$",
      currencyDecimals: currency.currencyDecimals ?? 2,
      status: "requested",
      note: requireNonEmptyString(body.note) || "Driver requested payout",
      adminNote: "",
      createdAt: domain.now(),
      updatedAt: domain.now()
    };
    db.payouts.unshift(payout);
    db.users.filter((user) => user.role === "admin").forEach((admin) => {
      domain.createNotification(db, admin.id, "payout_requested", "Payout requested", `${auth.user.name} requested a payout.`);
    });
    store.saveDb(db);
    return ok(res, { payout, payouts: publicPayouts(db, auth.user.id) }, "Payout requested.", 201);
  }

  if (url.pathname === "/rider/saved-places" && req.method === "GET") {
    const auth = requireRole(req, res, db, ["rider"]);
    if (!auth) return;
    return ok(res, { savedPlaces: (db.savedPlaces || []).filter((place) => place.userId === auth.user.id) });
  }

  if (url.pathname === "/rider/saved-places" && req.method === "POST") {
    const auth = requireRole(req, res, db, ["rider"]);
    if (!auth) return;
    const body = await readBody(req);
    const coords = domain.normalizeLocation({ latitude: body.latitude, longitude: body.longitude });
    const label = requireNonEmptyString(body.label);
    const address = requireNonEmptyString(body.address);
    if (!label || !address || !coords) return fail(res, 400, "INVALID_SAVED_PLACE", "Label, address, latitude, and longitude are required.");
    db.savedPlaces = db.savedPlaces || [];
    const existing = db.savedPlaces.find((place) => place.userId === auth.user.id && place.label.toLowerCase() === label.toLowerCase());
    if (existing) {
      existing.address = address;
      existing.latitude = coords.latitude;
      existing.longitude = coords.longitude;
      existing.updatedAt = domain.now();
      store.saveDb(db);
      return ok(res, { savedPlace: existing }, "Saved place updated.");
    }
    const savedPlace = {
      id: domain.makeId("place"),
      userId: auth.user.id,
      label,
      address,
      latitude: coords.latitude,
      longitude: coords.longitude,
      createdAt: domain.now(),
      updatedAt: domain.now()
    };
    db.savedPlaces.unshift(savedPlace);
    store.saveDb(db);
    return ok(res, { savedPlace }, "Saved place created.", 201);
  }

  const savedPlaceDetail = url.pathname.match(/^\/rider\/saved-places\/([^/]+)$/);
  if (savedPlaceDetail && req.method === "DELETE") {
    const auth = requireRole(req, res, db, ["rider"]);
    if (!auth) return;
    db.savedPlaces = db.savedPlaces || [];
    const place = db.savedPlaces.find((item) => item.id === savedPlaceDetail[1] && item.userId === auth.user.id);
    if (!place) return fail(res, 404, "SAVED_PLACE_NOT_FOUND", "Saved place not found.");
    db.savedPlaces = db.savedPlaces.filter((item) => item.id !== place.id);
    store.saveDb(db);
    return ok(res, { savedPlace: place }, "Saved place deleted.");
  }

  if (url.pathname === "/rider/coupons" && req.method === "GET") {
    const auth = requireRole(req, res, db, ["rider"]);
    if (!auth) return;
    const usedCodes = new Set((db.userCoupons || []).filter((coupon) => coupon.userId === auth.user.id && coupon.status !== "available").map((coupon) => coupon.code));
    const userCoupons = (db.userCoupons || []).filter((coupon) => coupon.userId === auth.user.id && coupon.status === "available");
    const visibleCodes = new Set(userCoupons.map((coupon) => coupon.code));
    const promoCoupons = (db.promotions || [])
      .filter((promo) => promo.active && !visibleCodes.has(promo.code) && !usedCodes.has(promo.code))
      .map((promo) => ({
        id: `promo_${promo.code.toLowerCase()}`,
        userId: auth.user.id,
        code: promo.code,
        title: promo.title,
        discountType: promo.amountOff ? "amount" : "percent",
        percentOff: promo.percentOff,
        amountOff: promo.amountOff,
        minSpend: 0,
        status: "available",
        expiresAt: "",
        appliesToRideTier: "all",
        autoApply: false,
        rideId: ""
      }));
    return ok(res, { coupons: [...userCoupons, ...promoCoupons] });
  }

  if (url.pathname === "/payments/methods" && req.method === "GET") {
    const auth = requireAuth(req, res, db);
    if (!auth) return;
    return ok(res, { paymentMethods: publicPaymentMethods(db, auth.user.id) });
  }

  if (url.pathname === "/payments/methods" && req.method === "POST") {
    const auth = requireRole(req, res, db, ["rider"]);
    if (!auth) return;
    const body = await readBody(req);
    const brand = requireNonEmptyString(body.brand) || "Visa";
    const rawLast4 = String(body.last4 || "").replace(/\D/g, "").slice(-4);
    const last4 = rawLast4.length === 4 ? rawLast4 : String(Math.floor(1000 + Math.random() * 9000));
    const label = requireNonEmptyString(body.label) || `${brand} ending ${last4}`;
    db.paymentMethods = db.paymentMethods || [];
    const activeMethods = publicPaymentMethods(db, auth.user.id);
    const paymentMethod = {
      id: domain.makeId("pm"),
      userId: auth.user.id,
      type: "card",
      brand,
      label,
      last4,
      isDefault: activeMethods.length === 0 || Boolean(body.isDefault),
      status: "active",
      createdAt: domain.now(),
      updatedAt: domain.now()
    };
    if (paymentMethod.isDefault) {
      db.paymentMethods.forEach((method) => {
        if (method.userId === auth.user.id) method.isDefault = false;
      });
    }
    db.paymentMethods.unshift(paymentMethod);
    store.saveDb(db);
    return ok(res, { paymentMethod, paymentMethods: publicPaymentMethods(db, auth.user.id) }, "Payment method added.", 201);
  }

  const paymentMethodDefault = url.pathname.match(/^\/payments\/methods\/([^/]+)\/default$/);
  if (paymentMethodDefault && req.method === "PATCH") {
    const auth = requireRole(req, res, db, ["rider"]);
    if (!auth) return;
    const method = publicPaymentMethods(db, auth.user.id).find((item) => item.id === paymentMethodDefault[1]);
    if (!method) return fail(res, 404, "PAYMENT_METHOD_NOT_FOUND", "Payment method not found.");
    db.paymentMethods.forEach((item) => {
      if (item.userId === auth.user.id) item.isDefault = item.id === method.id;
    });
    method.updatedAt = domain.now();
    store.saveDb(db);
    return ok(res, { paymentMethod: method, paymentMethods: publicPaymentMethods(db, auth.user.id) }, "Default payment method updated.");
  }

  const paymentMethodDetail = url.pathname.match(/^\/payments\/methods\/([^/]+)$/);
  if (paymentMethodDetail && req.method === "DELETE") {
    const auth = requireRole(req, res, db, ["rider"]);
    if (!auth) return;
    const method = publicPaymentMethods(db, auth.user.id).find((item) => item.id === paymentMethodDetail[1]);
    if (!method) return fail(res, 404, "PAYMENT_METHOD_NOT_FOUND", "Payment method not found.");
    const activeMethods = publicPaymentMethods(db, auth.user.id);
    if (activeMethods.length <= 1) return fail(res, 409, "LAST_PAYMENT_METHOD", "At least one active payment method is required.");
    method.status = "inactive";
    method.isDefault = false;
    method.updatedAt = domain.now();
    if (activeMethods.some((item) => item.id === method.id && item.isDefault)) {
      const nextDefault = publicPaymentMethods(db, auth.user.id).find((item) => item.id !== method.id);
      if (nextDefault) nextDefault.isDefault = true;
    }
    store.saveDb(db);
    return ok(res, { paymentMethod: method, paymentMethods: publicPaymentMethods(db, auth.user.id) }, "Payment method deleted.");
  }

  if (url.pathname === "/promos/validate" && req.method === "POST") {
    const auth = requireRole(req, res, db, ["rider"]);
    if (!auth) return;
    const body = await readBody(req);
    const promo = promoForCode(db, body.code);
    if (!promo) return fail(res, 404, "PROMO_NOT_FOUND", "Promo code is not available.");
    if (promoUsedByUser(db, auth.user.id, promo.code)) {
      return fail(res, 409, "PROMO_ALREADY_USED", "Promo code has already been used.");
    }
    return ok(res, { promo }, "Promo code applied.");
  }

  if (url.pathname === "/payments/history") {
    const auth = requireAuth(req, res, db);
    if (!auth) return;
    return ok(res, { payments: db.payments.filter((payment) => payment.riderId === auth.user.id || payment.driverId === auth.user.id) });
  }

  if (url.pathname === "/payments/refunds" && req.method === "POST") {
    const auth = requireRole(req, res, db, ["rider"]);
    if (!auth) return;
    const body = await readBody(req);
    const ride = db.rides.find((item) => item.id === body.rideId && item.riderId === auth.user.id);
    if (!ride || ride.status !== "completed") return fail(res, 409, "COMPLETED_RIDE_REQUIRED", "Choose a completed ride before requesting a refund.");
    const payment = db.payments.find((item) => item.rideId === ride.id && item.status === "paid");
    if (!payment) return fail(res, 409, "PAID_RIDE_REQUIRED", "A paid ride is required before requesting a refund.");
    db.refunds = db.refunds || [];
    const existing = db.refunds.find((item) => item.rideId === ride.id);
    if (existing) return fail(res, 409, "REFUND_ALREADY_EXISTS", "A refund request already exists for this ride.");
    const requestedAmount = Number(body.amount);
    const maxAmount = Number(Math.max(1, payment.amount * 0.35).toFixed(payment.currencyDecimals ?? 2));
    const amount = Number.isFinite(requestedAmount) && requestedAmount > 0 ? Math.min(requestedAmount, payment.amount) : maxAmount;
    const refund = {
      id: domain.makeId("refund"),
      rideId: ride.id,
      paymentId: payment.id,
      userId: auth.user.id,
      amount: Number(amount.toFixed(payment.currencyDecimals ?? 2)),
      currencyCode: payment.currencyCode || "USD",
      currencySymbol: payment.currencySymbol || "$",
      currencyDecimals: payment.currencyDecimals ?? 2,
      reason: requireNonEmptyString(body.reason) || "Rider requested fare review",
      status: "requested",
      progressMessage: "Awaiting approval. Approved refunds return within 30 days.",
      returnWindowDays: 30,
      createdAt: domain.now(),
      updatedAt: domain.now()
    };
    db.refunds.unshift(refund);
    domain.createNotification(db, auth.user.id, "refund_submitted", "Refund request submitted", "Your refund request is awaiting approval. Approved refunds return within 30 days.");
    db.users.filter((user) => user.role === "admin").forEach((admin) => {
      domain.createNotification(db, admin.id, "refund_requested", "Refund requested", `${auth.user.name} requested a refund for ride ${ride.id}.`);
    });
    store.saveDb(db);
    return ok(res, { refund, refunds: db.refunds.filter((item) => item.userId === auth.user.id) }, "Refund requested.", 201);
  }

  if (url.pathname === "/payments/refunds") {
    const auth = requireAuth(req, res, db);
    if (!auth) return;
    return ok(res, { refunds: (db.refunds || []).filter((refund) => refund.userId === auth.user.id || auth.user.role === "admin") });
  }

  if (url.pathname === "/invoices" && req.method === "POST") {
    const auth = requireRole(req, res, db, ["rider"]);
    if (!auth) return;
    const body = await readBody(req);
    const ride = db.rides.find((item) => item.id === body.rideId && item.riderId === auth.user.id);
    if (!ride || ride.status !== "completed") return fail(res, 409, "COMPLETED_RIDE_REQUIRED", "Choose a completed ride before generating an invoice.");
    const payment = db.payments.find((item) => item.rideId === ride.id);
    if (!payment) return fail(res, 409, "PAYMENT_REQUIRED", "Payment must exist before generating an invoice.");
    db.invoices = db.invoices || [];
    let invoice = db.invoices.find((item) => item.rideId === ride.id && item.userId === auth.user.id);
    if (!invoice) {
      invoice = {
        id: domain.makeId("invoice"),
        rideId: ride.id,
        userId: auth.user.id,
        title: requireNonEmptyString(body.title) || auth.user.name,
        email: requireNonEmptyString(body.email) || auth.user.email,
        status: "issued",
        amount: payment.amount,
        currencyCode: payment.currencyCode || "USD",
        currencySymbol: payment.currencySymbol || "$",
        currencyDecimals: payment.currencyDecimals ?? 2,
        createdAt: domain.now(),
        updatedAt: domain.now()
      };
      db.invoices.unshift(invoice);
      domain.createNotification(db, auth.user.id, "invoice_ready", "Invoice issued", `Invoice ${invoice.id} is ready.`);
      store.saveDb(db);
    }
    return ok(res, { invoice, invoices: db.invoices.filter((item) => item.userId === auth.user.id) }, "Invoice issued.", invoice.createdAt === invoice.updatedAt ? 201 : 200);
  }

  if (url.pathname === "/invoices") {
    const auth = requireAuth(req, res, db);
    if (!auth) return;
    return ok(res, { invoices: (db.invoices || []).filter((invoice) => invoice.userId === auth.user.id || auth.user.role === "admin") });
  }

  if (url.pathname === "/payments/authorize" && req.method === "POST") {
    const auth = requireRole(req, res, db, ["rider"]);
    if (!auth) return;
    const body = await readBody(req);
    const method = paymentMethodForUser(db, auth.user.id, body.paymentMethod || "card_on_file");
    if (!method) return fail(res, 400, "PAYMENT_METHOD_INVALID", "Choose an active payment method before authorizing payment.");
    return ok(res, {
      authorization: {
        id: domain.makeId("auth"),
        riderId: auth.user.id,
        amount: Number(body.amount || 0),
        paymentMethod: method.id,
        status: "authorized",
        createdAt: domain.now()
      }
    }, "Payment authorized.");
  }

  if (url.pathname === "/payments/capture" && req.method === "POST") {
    const auth = requireAuth(req, res, db);
    if (!auth) return;
    const body = await readBody(req);
    const ride = db.rides.find((item) => item.id === body.rideId);
    if (!ride) return fail(res, 404, "RIDE_NOT_FOUND", "Ride not found.");
    if (auth.user.role !== "admin" && auth.user.id !== ride.riderId) {
      return fail(res, 403, "PAYMENT_FORBIDDEN", "You cannot capture payment for this ride.");
    }
    const payment = domain.createPaymentRecord(db, ride);
    store.saveDb(db);
    return ok(res, { payment }, "Payment captured.");
  }

  const receipt = url.pathname.match(/^\/payments\/receipt\/([^/]+)$/);
  if (receipt && req.method === "GET") {
    const auth = requireAuth(req, res, db);
    if (!auth) return;
    const ride = db.rides.find((item) => item.id === receipt[1]);
    if (!ride) return fail(res, 404, "RIDE_NOT_FOUND", "Ride not found.");
    if (!canAccessRide(auth.user, ride)) return fail(res, 403, "RECEIPT_FORBIDDEN", "You cannot view this receipt.");
    return ok(res, { ride: domain.publicRide(db, ride), payment: db.payments.find((payment) => payment.rideId === receipt[1]) || null });
  }

  if (url.pathname === "/support/tickets" && req.method === "POST") {
    const auth = requireAuth(req, res, db);
    if (!auth) return;
    const body = await readBody(req);
    const message = requireNonEmptyString(body.message);
    if (!message) return fail(res, 400, "MESSAGE_REQUIRED", "Please describe what happened.");
    const category = requireNonEmptyString(body.category) || "other";
    const allowedCategories = ["payment issue", "driver issue", "rider issue", "lost item", "safety concern", "cancellation", "technical issue", "other"];
    if (!allowedCategories.includes(category)) return fail(res, 400, "INVALID_TICKET_CATEGORY", "Unsupported support category.");
    const ticket = { id: domain.makeId("ticket"), userId: auth.user.id, rideId: body.rideId || "", category, message, status: "open", createdAt: domain.now(), updatedAt: domain.now() };
    db.supportTickets.unshift(ticket);
    domain.createNotification(db, auth.user.id, "support_submitted", "Support ticket submitted", `Ticket ${ticket.id} is open. Support will review your message.`);
    db.users.filter((user) => user.role === "admin").forEach((admin) => {
      domain.createNotification(db, admin.id, "support_ticket", "New support ticket", `${auth.user.name} opened ${ticket.id}: ${category}.`);
    });
    store.saveDb(db);
    return ok(res, { ticket }, "Ticket created.", 201);
  }

  if (url.pathname === "/support/tickets") {
    const auth = requireAuth(req, res, db);
    if (!auth) return;
    const tickets = auth.user.role === "admin" ? db.supportTickets : db.supportTickets.filter((ticket) => ticket.userId === auth.user.id);
    return ok(res, { tickets });
  }

  const supportReply = url.pathname.match(/^\/support\/tickets\/([^/]+)\/replies$/);
  if (supportReply && req.method === "POST") {
    const auth = requireAuth(req, res, db);
    if (!auth) return;
    const ticket = db.supportTickets.find((item) => item.id === supportReply[1]);
    if (!ticket || (auth.user.role !== "admin" && ticket.userId !== auth.user.id)) {
      return fail(res, 404, "TICKET_NOT_FOUND", "Ticket not found.");
    }
    const message = requireNonEmptyString((await readBody(req)).message);
    if (!message) return fail(res, 400, "MESSAGE_REQUIRED", "Reply cannot be empty.");
    const reply = addSupportReply(db, ticket, auth.user, message);
    if (auth.user.role === "admin") {
      if (ticket.status === "open") ticket.status = "in_review";
      domain.createNotification(db, ticket.userId, "support_updated", "Support replied", message);
    } else {
      db.users.filter((user) => user.role === "admin").forEach((admin) => {
        domain.createNotification(db, admin.id, "support_reply", "Ticket reply received", `${auth.user.name} replied to ${ticket.id}.`);
      });
    }
    store.saveDb(db);
    return ok(res, { reply, ticket }, "Reply sent.", 201);
  }

  const supportDetail = url.pathname.match(/^\/support\/tickets\/([^/]+)$/);
  if (supportDetail && req.method === "GET") {
    const auth = requireAuth(req, res, db);
    if (!auth) return;
    const ticket = db.supportTickets.find((item) => item.id === supportDetail[1]);
    if (!ticket || (auth.user.role !== "admin" && ticket.userId !== auth.user.id)) {
      return fail(res, 404, "TICKET_NOT_FOUND", "Ticket not found.");
    }
    return ok(res, { ticket });
  }

  if (url.pathname === "/notifications") {
    const auth = requireAuth(req, res, db);
    if (!auth) return;
    return ok(res, { notifications: db.notifications.filter((item) => item.userId === auth.user.id) });
  }

  const readNotification = url.pathname.match(/^\/notifications\/([^/]+)\/read$/);
  if (readNotification && req.method === "PATCH") {
    const auth = requireAuth(req, res, db);
    if (!auth) return;
    const notification = db.notifications.find((item) => item.id === readNotification[1] && item.userId === auth.user.id);
    if (notification) notification.read = true;
    store.saveDb(db);
    return ok(res, { notification });
  }

  if (url.pathname.startsWith("/admin/")) {
    const auth = requireRole(req, res, db, ["admin"]);
    if (!auth) return;
    if (url.pathname === "/admin/overview") {
      return ok(res, {
        metrics: {
          totalUsers: db.users.length,
          activeDrivers: db.driverProfiles.filter((driver) => ["online", "busy"].includes(driver.driverStatus)).length,
          pendingDrivers: db.driverProfiles.filter((driver) => driver.verificationStatus === "pending").length,
          totalRides: db.rides.length,
          completedRides: db.rides.filter((ride) => ride.status === "completed").length,
          cancelledRides: db.rides.filter((ride) => ride.status === "cancelled").length,
          revenue: Number(db.payments.reduce((sum, payment) => sum + payment.platformFee, 0).toFixed(2)),
          openSupportTickets: db.supportTickets.filter((ticket) => ticket.status === "open").length
        }
      });
    }
    if (url.pathname === "/admin/users") return ok(res, { users: db.users.map(domain.publicUser) });
    if (url.pathname === "/admin/drivers") return ok(res, { drivers: db.driverProfiles.map((profile) => domain.publicDriver(db, profile)) });
    if (url.pathname === "/admin/rides") return ok(res, { rides: db.rides.map((ride) => domain.publicRide(db, ride)) });
    if (url.pathname === "/admin/payments") return ok(res, { payments: db.payments });
    if (url.pathname === "/admin/refunds") return ok(res, { refunds: db.refunds || [] });
    if (url.pathname === "/admin/payouts") return ok(res, { payouts: db.payouts || [] });
    if (url.pathname === "/admin/support-tickets") return ok(res, { tickets: db.supportTickets });
    const driverAction = url.pathname.match(/^\/admin\/drivers\/([^/]+)\/(approve|reject|suspend|unsuspend)$/);
    if (driverAction && req.method === "PATCH") {
      const profile = db.driverProfiles.find((item) => item.id === driverAction[1] || item.userId === driverAction[1]);
      if (!profile) return fail(res, 404, "DRIVER_NOT_FOUND", "Driver not found.");
      if (driverAction[2] === "approve") profile.verificationStatus = "approved";
      if (driverAction[2] === "reject") profile.verificationStatus = "rejected";
      if (driverAction[2] === "suspend") profile.driverStatus = "suspended";
      if (driverAction[2] === "unsuspend") profile.driverStatus = "offline";
      profile.updatedAt = domain.now();
      store.saveDb(db);
      return ok(res, { driverProfile: domain.publicDriver(db, profile) });
    }
    const driverDocumentPatch = url.pathname.match(/^\/admin\/drivers\/([^/]+)\/documents\/([^/]+)$/);
    if (driverDocumentPatch && req.method === "PATCH") {
      const profile = db.driverProfiles.find((item) => item.id === driverDocumentPatch[1] || item.userId === driverDocumentPatch[1]);
      if (!profile) return fail(res, 404, "DRIVER_NOT_FOUND", "Driver not found.");
      const document = driverDocuments(profile).find((item) => item.id === driverDocumentPatch[2] || item.type === driverDocumentPatch[2]);
      if (!document) return fail(res, 404, "DOCUMENT_NOT_FOUND", "Driver document not found.");
      const body = await readBody(req);
      const status = requireNonEmptyString(body.status) || document.status;
      if (!["submitted", "approved", "rejected", "expired"].includes(status)) {
        return fail(res, 400, "INVALID_DOCUMENT_STATUS", "Unsupported document status.");
      }
      document.status = status;
      document.reviewNote = requireNonEmptyString(body.reviewNote || body.note) || document.reviewNote || "";
      document.updatedAt = domain.now();
      profile.updatedAt = domain.now();
      domain.createNotification(db, profile.userId, "driver_document_reviewed", "Document reviewed", `${document.label || document.type} is ${document.status}.`);
      store.saveDb(db);
      return ok(res, { document, documents: driverDocuments(profile), documentSummary: driverDocumentSummary(profile), driverProfile: domain.publicDriver(db, profile) });
    }
    const rideStatusPatch = url.pathname.match(/^\/admin\/rides\/([^/]+)\/status$/);
    if (rideStatusPatch && req.method === "PATCH") {
      const ride = db.rides.find((item) => item.id === rideStatusPatch[1]);
      if (!ride) return fail(res, 404, "RIDE_NOT_FOUND", "Ride not found.");
      const body = await readBody(req);
      const status = requireNonEmptyString(body.status);
      if (!status) return fail(res, 400, "RIDE_STATUS_REQUIRED", "Ride status is required.");
      if (status === ride.status) return ok(res, { ride: domain.publicRide(db, ride) });
      let transition = domain.validateTransition(ride.status, status);
      if (transition.ok) {
        transition = updateRideStatus(db, ride, status);
      } else if (status === "cancelled" && !["completed", "cancelled"].includes(ride.status)) {
        ride.status = "cancelled";
        ride.cancelledAt = domain.now();
        ride.cancelReason = requireNonEmptyString(body.reason) || "Cancelled by operations";
        addTimeline(ride, "cancelled", `operations cancelled: ${ride.cancelReason}`);
        const profile = profileFor(db, ride.driverId);
        if (profile && profile.driverStatus === "busy") {
          profile.driverStatus = "online";
          profile.updatedAt = domain.now();
        }
        transition = { ok: true };
      }
      if (!transition.ok) return fail(res, 409, transition.code, transition.message);
      if (body.note || body.reason) {
        ride.adminNotes = Array.isArray(ride.adminNotes) ? ride.adminNotes : [];
        ride.adminNotes.unshift({
          id: domain.makeId("note"),
          adminId: auth.user.id,
          note: requireNonEmptyString(body.note || body.reason) || "",
          createdAt: domain.now()
        });
      }
      domain.createNotification(db, ride.riderId, "ride_admin_updated", "Ride updated", `Operations set ride ${ride.id} to ${ride.status}.`);
      if (ride.driverId) domain.createNotification(db, ride.driverId, "ride_admin_updated", "Ride updated", `Operations set ride ${ride.id} to ${ride.status}.`);
      store.saveDb(db);
      return ok(res, { ride: domain.publicRide(db, ride) });
    }
    const ticketPatch = url.pathname.match(/^\/admin\/support-tickets\/([^/]+)$/);
    if (ticketPatch && req.method === "PATCH") {
      const ticket = db.supportTickets.find((item) => item.id === ticketPatch[1]);
      if (!ticket) return fail(res, 404, "TICKET_NOT_FOUND", "Ticket not found.");
      const status = (await readBody(req)).status || ticket.status;
      if (!["open", "in_review", "resolved", "closed"].includes(status)) {
        return fail(res, 400, "INVALID_TICKET_STATUS", "Unsupported support ticket status.");
      }
      ticket.status = status;
      ticket.updatedAt = domain.now();
      domain.createNotification(db, ticket.userId, "support_updated", "Support ticket updated", `Your ticket is now ${ticket.status}.`);
      store.saveDb(db);
      return ok(res, { ticket });
    }
    const refundPatch = url.pathname.match(/^\/admin\/refunds\/([^/]+)$/);
    if (refundPatch && req.method === "PATCH") {
      const refund = (db.refunds || []).find((item) => item.id === refundPatch[1]);
      if (!refund) return fail(res, 404, "REFUND_NOT_FOUND", "Refund request not found.");
      const body = await readBody(req);
      const status = body.status || refund.status;
      if (!["requested", "in_review", "approved", "rejected", "paid"].includes(status)) {
        return fail(res, 400, "INVALID_REFUND_STATUS", "Unsupported refund status.");
      }
      const amount = Number(body.amount);
      if (Number.isFinite(amount) && amount > 0) {
        const payment = db.payments.find((item) => item.id === refund.paymentId || item.rideId === refund.rideId);
        const maxAmount = payment ? payment.amount : refund.amount;
        refund.amount = Number(Math.min(amount, maxAmount).toFixed(refund.currencyDecimals ?? 2));
      }
      refund.status = status;
      refund.adminNote = requireNonEmptyString(body.adminNote || body.note) || refund.adminNote || "";
      refund.updatedAt = domain.now();
      if (status === "approved") {
        refund.approvedAt = refund.updatedAt;
        refund.expectedReturnBy = new Date(Date.parse(refund.updatedAt) + 30 * 24 * 60 * 60 * 1000).toISOString();
        refund.progressMessage = "Approved. Funds return within 30 days.";
      }
      if (status === "paid") {
        refund.paidAt = refund.updatedAt;
        refund.progressMessage = "Refund has been returned.";
      }
      if (status === "rejected") refund.progressMessage = "Rejected after review.";
      domain.createNotification(
        db,
        refund.userId,
        "refund_updated",
        status === "approved" ? "Refund approved" : "Refund updated",
        status === "approved"
          ? "Your refund was approved. Funds return within 30 days."
          : `Your refund request is now ${refund.status}.`
      );
      store.saveDb(db);
      return ok(res, { refund });
    }
    const payoutPatch = url.pathname.match(/^\/admin\/payouts\/([^/]+)$/);
    if (payoutPatch && req.method === "PATCH") {
      const payout = (db.payouts || []).find((item) => item.id === payoutPatch[1]);
      if (!payout) return fail(res, 404, "PAYOUT_NOT_FOUND", "Payout request not found.");
      const body = await readBody(req);
      const status = body.status || payout.status;
      if (!["requested", "in_review", "approved", "rejected", "paid"].includes(status)) {
        return fail(res, 400, "INVALID_PAYOUT_STATUS", "Unsupported payout status.");
      }
      payout.status = status;
      payout.adminNote = requireNonEmptyString(body.adminNote || body.note) || payout.adminNote || "";
      payout.updatedAt = domain.now();
      domain.createNotification(db, payout.driverId, "payout_updated", "Payout updated", `Your payout request is now ${payout.status}.`);
      store.saveDb(db);
      return ok(res, { payout });
    }
  }

  if (serveStaticFile(req, res, url.pathname)) return;
  if (serveClientRoute(req, res, url.pathname)) return;

  return fail(res, 404, "NOT_FOUND", "Route not found.");
}

module.exports = { handle };
};