/* Small, explicit adapter from saved account preferences to trip context. */
(function () {
  'use strict';
  var FT = window.FridayTrip = window.FridayTrip || {};
  /* Display-time city capitalisation ("mumbai" -> "Mumbai"); words that already mix cases ("McAllen") are kept. Mirrors server/airports.mjs. */
  FT.titleCity = function (value) {
    return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').split(' ').map(function (w) {
      return /[a-z][A-Z]/.test(w) ? w : w.toLowerCase().replace(/(^|[\-'\u2019.(\/])(\p{L})/gu, function (m, sep, ch) { return sep + ch.toUpperCase(); });
    }).join(' ');
  };
  function list(state) {
    state = state || {};
    var prefs = state.prefs || {};
    var profile = [
      ['Home city', FT.titleCity(prefs.homeCity)], ['Departure airports', Array.isArray(prefs.airports) ? prefs.airports.join(', ') : ''],
      ['Airlines', prefs.airlines], ['Airlines to avoid', prefs.avoidAirlines], ['Hotels', prefs.hotels], ['Hotel budget', prefs.hotelBudget],
      ['Business travel', prefs.business], ['Other preferences', prefs.other],
    ].filter(function (item) { return String(item[1] || '').trim(); }).map(function (item, index) {
      return { key: 'profile-' + index, label: item[0], text: String(item[1]).trim(), source: 'profile' };
    });
    var memories = (Array.isArray(state.memory) ? state.memory : []).map(function (item) {
      return { key: 'memory-' + item.id, label: item.city || 'Travel memory', text: String(item.text || item.notes || '').trim(), source: 'memory', id: item.id };
    }).filter(function (item) { return item.text; });
    return profile.concat(memories);
  }
  function summary(preferences) {
    if (!Array.isArray(preferences) || !preferences.length) return 'Start with your own words';
    var notes = preferences.map(function (item) {
      if (item.label === 'Home city') return 'Home base set';
      if (item.label === 'Departure airports') return 'Departure airport saved';
      var text = String(item.text || '').replace(/\s+/g, ' ').trim();
      return text.length > 30 ? text.slice(0, 27).trimEnd() + '…' : text;
    }).filter(Boolean);
    return 'Planning with: ' + notes.slice(0, 2).join(' · ') + (notes.length > 2 ? ' +' + (notes.length - 2) : '');
  }
  function apply(prompt, preferences) {
    if (!Array.isArray(preferences) || !preferences.length) return String(prompt || '');
    return String(prompt || '') + '\n\nPreferences to keep in mind for this trip (you chose to apply these):\n' + preferences.map(function (item) { return '- ' + item.label + ': ' + item.text; }).join('\n');
  }
  function quoteInstructions(instructions, preferences, include) {
    var heading = 'Preferences the traveler chose to share with the travel designer:';
    var base = String(instructions || '').split('\n\n' + heading)[0].trim();
    if (!include || !Array.isArray(preferences) || !preferences.length) return base;
    var note = heading + '\n' + preferences.map(function (item) { return '- ' + (item.label || 'Travel preference') + ': ' + item.text; }).join('\n');
    return [base, note].filter(Boolean).join('\n\n');
  }
  FT.memoryContext = { list: list, summary: summary, apply: apply, quoteInstructions: quoteInstructions };
})();
