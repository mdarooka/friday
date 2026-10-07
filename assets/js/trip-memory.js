/* Small, explicit adapter from saved account preferences to trip context. */
(function () {
  'use strict';
  var FT = window.FridayTrip = window.FridayTrip || {};
  function list(state) {
    state = state || {};
    var prefs = state.prefs || {};
    var profile = [
      ['Home city', prefs.homeCity], ['Departure airports', Array.isArray(prefs.airports) ? prefs.airports.join(', ') : ''],
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
  FT.memoryContext = { list: list, apply: apply, quoteInstructions: quoteInstructions };
})();
