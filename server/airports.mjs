// Curated metro airport groups. Unknown cities are never mapped to guessed airports.
export const metros = [
  ['San Francisco',['SF','Bay Area'],['SFO','OAK','SJC']],
  ['Mumbai',['Bombay'],['BOM']], ['Delhi',['New Delhi'],['DEL']],
  ['Bengaluru',['Bangalore'],['BLR']], ['Chennai',['Madras'],['MAA']],
  ['Kolkata',['Calcutta'],['CCU']], ['Hyderabad',[],['HYD']],
  ['Los Angeles',['LA'],['LAX','BUR','LGB','SNA','ONT']],
  ['New York',['NYC'],['JFK','LGA','EWR']], ['Chicago',[],['ORD','MDW']],
  ['London',[],['LHR','LGW','LCY','STN','LTN']], ['Paris',[],['CDG','ORY']],
  ['Tokyo',[],['HND','NRT']], ['Singapore',[],['SIN']], ['Dubai',[],['DXB','DWC']],
  ['Sydney',[],['SYD']], ['Melbourne',[],['MEL','AVV']], ['Bangkok',[],['BKK','DMK']],
  ['Atlanta',[],['ATL']], ['Seattle',[],['SEA']], ['Boston',[],['BOS']],
  ['Madison',[],['MSN']], ['Miami',[],['MIA','FLL']], ['Toronto',[],['YYZ','YTZ']],
  ['Hong Kong',[],['HKG']], ['Berlin',[],['BER']], ['Amsterdam',[],['AMS']],
  ['Rome',[],['FCO','CIA']], ['Madrid',[],['MAD']], ['Lisbon',[],['LIS']],
  ['Seoul',[],['ICN','GMP']], ['Mexico City',[],['MEX','NLU']], ['Zurich',[],['ZRH']],
].map(([city, aliases, airports]) => ({ city, aliases, airports }));
export function findMetro(city) {
  const normalized = city.trim().toLowerCase();
  return metros.find(m => [m.city,...m.aliases].some(s => s.toLowerCase() === normalized));
}
