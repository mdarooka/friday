/* Saved reels use Friday's existing trip conversation. */
(function(){
  'use strict';
  var FT=window.FridayTrip=window.FridayTrip||{};
  var NOTE='Reel import isn\u2019t available right now.';
  /* False only when the server has said research is not connected; unknown (offline, not loaded yet) counts as available. */
  function available(){var c=FT.backend&&FT.backend.capabilities;return !(c&&c.research===false);}
  FT.reel={available:available,unavailableNote:NOTE,open:function(opts){
    opts=opts||{};
    if(!opts.url||!available())return;
    if(FT.requireSignIn&&!FT.requireSignIn('ai'))return;
    var trip=FT.store&&FT.store.trip&&FT.store.trip();
    if(!trip&&FT.trips)trip=FT.trips.create();
    if(!trip)return;
    if(FT.trips&&FT.trips.open)FT.trips.open(trip.id);
    if(FT.chat)FT.chat.send({tripId:trip.id,text:[opts.url,opts.placeName||opts.caption].filter(Boolean).join(' ')});
  }};
})();
