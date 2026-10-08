'use strict';
// Destination data for the Friday planner. Each destination lives in ./<id>.js.
// A missing file never breaks the build: ORDER is filtered to the ids that loaded.
// RETIRED destinations still load so trips already saved against them keep their places, but they are left out of
// ORDER, so nobody can start a new trip there (picker, chat, ?destination= links and free-text matching all use ORDER).
const fs = require('fs');
const path = require('path');

const FULL_ORDER = ['goa', 'kerala', 'rajasthan', 'ladakh', 'srilanka'];
const RETIRED = ['kyoto'];
const DESTINATIONS = {};
const ORDER = [];

FULL_ORDER.forEach((id) => {
  if (!fs.existsSync(path.join(__dirname, id + '.js'))) return;
  DESTINATIONS[id] = require('./' + id + '.js');
  ORDER.push(id);
});
RETIRED.forEach((id) => {
  if (fs.existsSync(path.join(__dirname, id + '.js'))) DESTINATIONS[id] = require('./' + id + '.js');
});

const TRIP_TYPES = require('./trip-types.js');

module.exports = { DESTINATIONS, ORDER, TRIP_TYPES };
