'use strict';
// Destination data for the Friday planner. Each destination lives in ./<id>.js.
// A missing file never breaks the build: ORDER is filtered to the ids that loaded.
const fs = require('fs');
const path = require('path');

const FULL_ORDER = ['goa', 'kerala', 'rajasthan', 'ladakh', 'srilanka', 'kyoto'];
const DESTINATIONS = {};
const ORDER = [];

FULL_ORDER.forEach((id) => {
  if (!fs.existsSync(path.join(__dirname, id + '.js'))) return;
  DESTINATIONS[id] = require('./' + id + '.js');
  ORDER.push(id);
});

const TRIP_TYPES = require('./trip-types.js');

module.exports = { DESTINATIONS, ORDER, TRIP_TYPES };
