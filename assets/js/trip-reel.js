/* Saved reels use Friday's existing trip conversation. */
(function(){
  'use strict';
  var FT=window.FridayTrip=window.FridayTrip||{};
  FT.reel={open:function(opts){
    opts=opts||{};
    if(!opts.url)return;
    var trip=FT.store&&FT.store.trip&&FT.store.trip();
    if(!trip&&FT.trips)trip=FT.trips.create();
    if(!trip)return;
    if(FT.trips&&FT.trips.open)FT.trips.open(trip.id);
    if(FT.chat)FT.chat.send({tripId:trip.id,text:[opts.url,opts.placeName||opts.caption].filter(Boolean).join(' ')});
  }};
})();
