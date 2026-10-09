/*
 * india-breaks.js - the one data file behind /when-india-travels.html and the homepage teaser.
 *
 * Researched 2026-10-07 from central and state holiday lists, panchang calendars and school calendars; every row lists its
 * sources (URLs below, never shown on the page). Row shape:
 *   { id, photo, name, kind, group, regions, startDate, endDate, nights, note, researchNote, verified, confidence, source[], suggestions[] }
 *   photo       the card photo's theme key, one of the keys of THEMES in ./break-photos.js (tests/home-break-photos.test.mjs fails for a shown row without one)
 *   kind        'long-weekend' | 'holiday' | 'festival-window' | 'school-break'
 *   types       one or more of 'festival' | 'school' | 'long-weekend' | 'short-escape' (the page's "Type of break" filter, see TYPE_FILTERS).
 *               school = a school-break row; festival = a festival, regional or national, is why the days are off; long-weekend = kind
 *               'long-weekend'; short-escape = a non-school break of 2 nights or fewer. A row can carry several. tests/ keeps these in step with kind and nights.
 *   group       derived: 'school' for school breaks, 'national' for rows tagged national, otherwise 'festival'
 *   regions     ['national'] (always shown), 'national' plus state codes (shown under All and for those states),
 *               or state codes only (MH, DL, KA, TN, TS, WB, GJ, KL, ...)
 *   startDate/endDate  the full off-span including the weekend; nights = days between them
 *   verified    true only when every date in the span is in an official notified list or school calendar
 *   confidence  'official' | 'reliable-unofficial' (panchang, reputable press, school network page) | 'estimate'
 *   note        the short public line; researchNote is the research summary and is never rendered
 *   suggestions one or two open-ended ideas for the break (any place, India or abroad): { place, reason, caveat, start?, nights? }.
 *               start/nights set a sensible trip inside a long window. No prices, no availability, no booking.
 * Rows still verified:false are still to be confirmed (mostly 2027 state lists not yet notified). Islamic dates depend on
 * the moon and can move by a day even after notification.
 * Only rows with nights >= 2 (a break you can travel on) are shown; single days off stay in the data.
 */
'use strict';

const GROUPS = ['national', 'festival', 'school'];
const GROUP_TITLES = {
  national: { eyebrow: 'Across India', title: 'National long weekends' },
  festival: { eyebrow: 'By region', title: 'Festival breaks' },
  school: { eyebrow: 'For families', title: 'School holidays' },
};
const REGION_NAMES = { MH: 'Maharashtra', DL: 'Delhi', KA: 'Karnataka', TN: 'Tamil Nadu', TS: 'Telangana', KL: 'Kerala', WB: 'West Bengal', GJ: 'Gujarat' };

/* The page's region filter, by state or union territory. A row shows for a filter when it is national or shares a state code with it.
 * Only states whose own holiday list or school calendar changes at least one break on this page are listed (audit 2026-10-08).
 * `aliases` keep older ?region= links working (the filter used to be by city).
 * Source notes per state (the same lists are cited on the rows themselves):
 *   Maharashtra  - General Administration Dept, Public Holidays 2026: https://maharashtra.gov.in/site/Upload/pdf/Public-Holiday-2026.pdf
 *   Delhi        - DoPT central list 2026 (Chhath) and Delhi DoE 2026 school calendar: see DOPT_2026_RH, DOE_DELHI
 *   Karnataka    - Karnataka govt calendar 2026 (a copy of the notified list, not the gazette itself): see KA_2026
 *   Tamil Nadu   - Tamil Nadu Gazette Extraordinary 2025, 2026 holidays: https://www.stationeryprinting.tn.gov.in/extraordinary/2025/721_Ex_II_1_2025.pdf
 *   Telangana    - Telangana government calendar 2026: https://www.telangana.gov.in/downloads/calendar-2026/
 *   West Bengal  - WB Govt calendar 2026, order 4188-FP2 (copy hosted on wbcalendar.co.in): see WB_2026
 *   Gujarat      - Gujarat state holidays 2026 notification (copy hosted on hrinformative.com, not the gazette): see GJ_2026
 * Left out (no break on the page changes for them, or no official list could be opened): Kerala, Andhra Pradesh, Bihar, Assam,
 * Jharkhand, Tripura, Odisha, Haryana, Uttar Pradesh, Punjab and the rest. Add a state only with a row sourced to its own list. */
const REGION_FILTERS = [
  { key: 'all', label: 'All', codes: [], aliases: [] },
  { key: 'maharashtra', label: 'Maharashtra', codes: ['MH'], aliases: ['mumbai-pune', 'mumbai', 'pune'] },
  { key: 'delhi', label: 'Delhi', codes: ['DL'], aliases: ['delhi-ncr', 'ncr', 'new-delhi'] },
  { key: 'karnataka', label: 'Karnataka', codes: ['KA'], aliases: ['bengaluru', 'bangalore'] },
  { key: 'tamil-nadu', label: 'Tamil Nadu', codes: ['TN'], aliases: ['chennai'] },
  { key: 'telangana', label: 'Telangana', codes: ['TS'], aliases: ['hyderabad'] },
  { key: 'west-bengal', label: 'West Bengal', codes: ['WB'], aliases: ['kolkata', 'calcutta'] },
  { key: 'gujarat', label: 'Gujarat', codes: ['GJ'], aliases: ['ahmedabad'] },
];
const DEFAULT_REGION = 'all';

/* The "Type of break" filter. A row shows for a type when its `types` include it. Every type here has at least one row on the page
 * (tests/when-india-travels.test.mjs checks this); add a type only when rows carry it. */
const TYPE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'festival', label: 'Festival breaks' },
  { key: 'school', label: 'School holidays' },
  { key: 'long-weekend', label: 'Long weekends' },
  { key: 'short-escape', label: 'Short escapes' },
];
const DEFAULT_TYPE = 'all';

/* "Closer to home": a state with its own short-escape guide on the site gets that guide, with copy naming the place. Every other
 * state, and All, gets the neutral block (CLOSE_NEUTRAL), which never assumes a home city. Add a state only when a guide exists. */
const CLOSE_BY_REGION = {
  maharashtra: {
    lead: 'In Maharashtra, starting from Mumbai? For two quiet nights nearby, read',
    label: 'the quiet weekend guide', href: 'mumbai-quiet-weekend.html',
  },
};
const CLOSE_NEUTRAL = {
  lead: 'Two quiet nights, from wherever you are starting. Tell Friday your city and the dates, and a designer will suggest somewhere within easy reach.',
  label: 'Plan a short escape', href: 'trip.html',
  moreLabel: 'talk to a designer', moreHref: 'contact.html?topic=Short%20escape#callback-title',
};

const DOPT_2026 = 'https://cdnbbsr.s3waas.gov.in/s32d2ca7eedf739ef4c3800713ec482e1a/uploads/2025/10/2025103171.pdf';
const DOPT_2026_RH = 'https://igecorner.com/restricted-holiday-list-2026-for-central-government-employees/';
const DOPT_2027 = 'https://www.cgspublicationindia.com/PDFOM/Rn_Holiday_16-07-2026.pdf'; // DoPT O.M. 12/2/2023-JCA dt 16.07.2026 (copy); also https://www.staffnews.in/wp-content/uploads/2026/07/Letter_20260723_HolidaysList2027.pdf
const MH_2026 = 'https://maharashtra.gov.in/site/Upload/pdf/Public-Holiday-2026.pdf';
const WB_2026 = 'https://wbcalendar.co.in/wp-content/uploads/2025/11/4188-FP2-wb-govt-calendar-2026.pdf';
const KA_2026 = 'https://governmentcalendar.org/karnataka-govt-calendar/2026/';
const TN_2026 = 'https://www.stationeryprinting.tn.gov.in/extraordinary/2025/721_Ex_II_1_2025.pdf';
const TS_2026 = 'https://www.telangana.gov.in/downloads/calendar-2026/';
const GJ_2026 = 'https://hrinformative.com/wp-content/uploads/2025/12/Gujarat-State-Holidays-List-2026-Notification.pdf';
const DRIK_DIWALI_2026 = 'https://www.drikpanchang.com/diwali/diwali-puja-calendar.html?year=2026&geoname-id=1275339';
const DRIK_DIWALI_2027 = 'https://www.drikpanchang.com/diwali/diwali-puja-calendar.html?year=2027&geoname-id=1275339';
const DRIK_GUDI_2027 = 'https://www.drikpanchang.com/festivals/gudi-padwa/gudi-padwa-date-time.html?year=2027&geoname-id=1275339';
const DRIK_HOLI_2027 = 'https://www.drikpanchang.com/festivals/holi/festivals-holi-rangwali.html?year=2027';
const AECS_MUMBAI = 'https://aecsrbt3.ac.in/downloads/cbse/academic_calender_2026-27.pdf';
const PODAR_MH = 'https://www.podareducation.org/school/hinjewadi/holidays-vacations-maharashtra';
const PODAR_BLR = 'https://www.podareducation.org/school/bengaluru/holidays-vacations-karnataka';
const SOUTHPOINT_KOL = 'https://southpoint.ac.in/academics/school-calendar/';
const DOE_DELHI = 'https://indianexpress.com/article/education/delhi-doe-2026-academic-calendar-released-exam-dates-cuet-registrations-clat-jee-summer-vacation-dates-10612876/';
const KA_SCHOOLS = 'https://www.thehansindia.com/karnataka/academic-calendar-announced-for-2026-27-school-year-1065925';
const TN_SCHOOLS = 'https://newstodaynet.com/2026/06/18/210-working-days-for-tn-schools-this-year/';
const DAIS = 'https://www.dais.edu.in/calender';

const BREAKS = [
  {
    id: 'dussehra-2026', photo: 'rajasthan-fort', name: 'Dussehra long weekend', kind: 'long-weekend', group: 'national', types: ['festival', 'long-weekend'],
    regions: ['national'],
    startDate: '2026-10-17', endDate: '2026-10-20', nights: 3,
    note: 'Dussehra is on Tuesday 20 October. Monday 19 October is a leave day for most, which makes a four-day weekend.',
    researchNote: 'Dussehra Tue 20 Oct (gazetted). Mon 19 Oct is a bridge day for most; it is already a holiday in WB (Maha Ashtami), TN (Ayutha Pooja). KA/TS also get Wed 21 Oct, WB runs 15–24 Oct (see regional rows).',
    verified: true, confidence: 'official',
    source: [DOPT_2026, MH_2026],
    suggestions: [
      { place: 'Rajasthan',
        reason: 'Heat is easing, and Udaipur and Jaipur are comfortable for a short break.',
        caveat: 'Days can still be warm; keep sightseeing to mornings and evenings.' },
      { place: 'Himachal Pradesh',
        reason: 'Clear post-monsoon skies in the hills, easy from Delhi and Chandigarh.',
        caveat: 'Landslides can still close roads after heavy rain; check before you go.' },
    ],
  },
  {
    id: 'diwali-2026', photo: 'diwali-lamps', name: 'Diwali 2026', kind: 'long-weekend', group: 'national', types: ['festival', 'long-weekend'],
    regions: ['national'],
    startDate: '2026-11-07', endDate: '2026-11-11', nights: 4,
    note: 'Diwali is on Sunday 8 November, so the days around it matter more than the day itself. Expect to take one or two leave days; what is off varies by state.',
    researchNote: 'Lakshmi Puja/Diwali Sun 8 Nov (gazetted, falls on Sunday). Govardhan Puja Mon 9 Nov and Bhai Duj Wed 11 Nov are restricted holidays centrally. What is actually off varies by state: see MH/GJ/KA/WB rows. Expect 1–2 leave days for a Sat–Wed trip.',
    verified: true, confidence: 'official',
    source: [DOPT_2026, DOPT_2026_RH, DRIK_DIWALI_2026],
    suggestions: [
      { place: 'Rajasthan',
        reason: 'Cool, clear days make Udaipur, Jaipur and Jodhpur a classic Diwali break, with festival lights in the old towns.',
        caveat: 'Diwali week is busy in Rajasthan, so book rooms and drivers early.' },
      { place: 'Andaman Islands',
        reason: 'Clear seas as the season begins, a flight from Chennai or Kolkata.',
        caveat: 'Flights fill at Diwali, and ferries depend on sea conditions.' },
    ],
  },
  {
    id: 'guru-nanak-2026', photo: 'golden-temple', name: 'Guru Nanak Jayanti long weekend', kind: 'long-weekend', group: 'national', types: ['festival', 'long-weekend'],
    regions: ['national', 'MH', 'DL', 'WB', 'GJ'],
    startDate: '2026-11-21', endDate: '2026-11-24', nights: 3,
    note: 'Guru Nanak Jayanti is on Tuesday 24 November. Monday 23 is a leave day for most. It is not a holiday in Tamil Nadu.',
    researchNote: 'Guru Nanak Jayanti Tue 24 Nov; bridge Mon 23 Nov. Not a holiday in TN; KA instead has Kanakadasa Jayanti Fri 27 Nov.',
    verified: true, confidence: 'official',
    source: [DOPT_2026, MH_2026, WB_2026, GJ_2026],
    suggestions: [
      { place: 'Amritsar',
        reason: 'The Golden Temple and the old city, a short flight or train from Delhi.',
        caveat: 'Gurpurab brings large crowds; book stays early and dress for temples.' },
      { place: 'Goa',
        reason: 'November Goa, with direct flights from Delhi, Mumbai and Ahmedabad.',
        caveat: 'Crowds and rates build toward December, so book ahead.' },
    ],
  },
  {
    id: 'christmas-2026', photo: 'goa-church', name: 'Christmas weekend', kind: 'long-weekend', group: 'national', types: ['festival', 'long-weekend', 'short-escape'],
    regions: ['national'],
    startDate: '2026-12-25', endDate: '2026-12-27', nights: 2,
    note: 'Christmas is on a Friday, so it is a clean three-day weekend with no leave needed. It overlaps school winter breaks, so places fill early.',
    researchNote: 'Christmas Fri 25 Dec. Overlaps school winter breaks (see school rows). Peak pricing Goa/Kerala/Rajasthan.',
    verified: true, confidence: 'official',
    source: [DOPT_2026, MH_2026],
    suggestions: [
      { place: 'Goa',
        reason: 'Beaches, midnight mass and the full winter season.',
        caveat: 'Goa is busiest over Christmas and New Year, so book early and expect traffic and the highest rates of the year.' },
      { place: 'Fort Kochi',
        reason: 'Christmas lights and old churches by the water.',
        caveat: 'It is peak season; book stays well ahead.' },
    ],
  },
  // VERIFY: date still to be confirmed (reliable-unofficial).
  {
    id: 'new-year-2027', photo: 'jaisalmer-dunes', name: 'New Year weekend', kind: 'long-weekend', group: 'national', types: ['long-weekend', 'short-escape'],
    regions: ['national'],
    startDate: '2027-01-01', endDate: '2027-01-03', nights: 2,
    note: 'New Year\u2019s Day is a Friday and a public holiday in some states, not all. Check your own state\u2019s list.',
    researchNote: 'New Year Fri 1 Jan 2027 is only a restricted holiday centrally; public holiday in some states (e.g. TN, TS in past years). 2027 state lists not yet notified.',
    verified: false, confidence: 'reliable-unofficial',
    source: [DOPT_2027],
    suggestions: [
      { place: 'Jaisalmer',
        reason: 'Desert camps and clear, cold nights.',
        caveat: 'Nights are properly cold, and camps book up for New Year.' },
      { place: 'Pondicherry',
        reason: 'French quarter streets and quiet beaches.',
        caveat: 'New Year crowds are heavy; stay outside the centre if you can.' },
    ],
  },
  {
    id: 'republic-day-2027', photo: 'rann-of-kutch', name: 'Republic Day long weekend', kind: 'long-weekend', group: 'national', types: ['long-weekend'],
    regions: ['national'],
    startDate: '2027-01-23', endDate: '2027-01-26', nights: 3,
    note: 'Republic Day is on Tuesday 26 January. Take Monday 25 as leave for a four-day weekend.',
    researchNote: 'Republic Day Tue 26 Jan (gazetted); bridge Mon 25 Jan. WB also has Netaji Jayanti Sat 23 Jan.',
    verified: true, confidence: 'official',
    source: [DOPT_2027],
    suggestions: [
      { place: 'Goa',
        reason: 'Mid-winter Goa without the New Year crowds, an easy hop from Mumbai, Pune, Bengaluru and Hyderabad.',
        caveat: 'It is still high season; book stays a few weeks ahead.' },
      { place: 'Rann of Kutch',
        reason: 'The white desert at its best, with the tent city in season.',
        caveat: 'Tents and permits book early for the long weekend.' },
    ],
  },
  {
    id: 'holi-easter-2027', photo: 'holi', name: 'Holi to Easter week', kind: 'long-weekend', group: 'national', types: ['festival', 'long-weekend'],
    regions: ['national'],
    startDate: '2027-03-20', endDate: '2027-03-28', nights: 8,
    note: 'Holi is on Tuesday 23 March and Good Friday on 26 March, with Easter on Sunday 28 March. The full nine days takes two or three leave days; shorter versions work too.',
    researchNote: 'Holi (gazetted, Delhi list) Tue 23 Mar with Holika Dahan Mon 22 Mar (RH); MH/WB/KA schools mark Holi/Doljatra on Mon 22 Mar. Good Friday Fri 26 Mar (gazetted), Easter Sun 28 Mar. Short version: Sat 20–Mon 22 (MH/WB) or Sat 20–Tue 23 (Delhi, 1 bridge); Fri 26–Sun 28 Easter. Full 9-day span needs 2–3 leave days.',
    verified: true, confidence: 'official',
    source: [DOPT_2027, AECS_MUMBAI, SOUTHPOINT_KOL, PODAR_MH],
    suggestions: [
      { place: 'Mathura and Vrindavan', start: '2027-03-20', nights: 3,
        reason: 'Holi here is a spectacle, a few hours from Delhi.',
        caveat: 'The crowds are intense and not for everyone.' },
    ],
  },
  {
    id: 'eid-ul-fitr-2027', name: 'Eid ul-Fitr', kind: 'holiday', group: 'national', types: ['festival', 'short-escape'],
    regions: ['national'],
    startDate: '2027-03-10', endDate: '2027-03-10', nights: 0,
    note: 'Eid ul-Fitr is on Wednesday 10 March and depends on the moon, so it can move by a day. A single day off.',
    researchNote: 'Wed 10 Mar (gazetted), moon-dependent ±1 day. No long weekend.',
    verified: true, confidence: 'official',
    source: [DOPT_2027],
  },
  // VERIFY: date still to be confirmed (reliable-unofficial).
  {
    id: 'mid-april-2027', photo: 'himalayan-foothills', name: 'Mid-April cluster (Ambedkar Jayanti, Ram Navami, Mahavir Jayanti)', kind: 'long-weekend', group: 'national', types: ['festival', 'long-weekend'],
    regions: ['national'],
    startDate: '2027-04-14', endDate: '2027-04-19', nights: 5,
    note: 'A cluster of holidays from Wednesday 14 to Monday 19 April. One leave day, Friday 16, joins them, and Mahavir Jayanti\u2019s date is still to be confirmed.',
    researchNote: 'Ram Navami Thu 15 Apr and Mahavir Jayanti Mon 19 Apr are gazetted (DoPT). Ambedkar Jayanti Wed 14 Apr is a public holiday in most states (not in DoPT Annexure-I). 1 bridge day (Fri 16 Apr). Also Tamil New Year/Vaisakhi Wed 14 Apr, Bengali New Year/Bohag Bihu Thu 15 Apr (RH). Discrepancy: Podar Bengaluru lists Mahavir Jayanti Sun 18 Apr. Short option: Sat 17–Mon 19 Apr.',
    verified: false, confidence: 'reliable-unofficial',
    source: [DOPT_2027, PODAR_BLR],
    suggestions: [
      { place: 'Himachal Pradesh',
        reason: 'Spring blossom and snow peaks, easy from Delhi and Chandigarh.',
        caveat: 'Mid-April roads are busy, and weather can turn quickly.' },
      { place: 'Munnar',
        reason: 'Cool tea hills as the plains heat up.',
        caveat: 'Hill roads are slow, and Easter-week stays are busy.' },
    ],
  },
  {
    id: 'bakrid-2027', photo: 'south-hills', name: 'Bakri Id long weekend', kind: 'long-weekend', group: 'national', types: ['festival', 'long-weekend', 'short-escape'],
    regions: ['national'],
    startDate: '2027-05-15', endDate: '2027-05-17', nights: 2,
    note: 'Bakri Id is on Monday 17 May, a clean three-day weekend. It depends on the moon and could move by a day, which would need a leave day.',
    researchNote: 'Id-ul-Zuha Mon 17 May (gazetted), moon-dependent ±1 day — if it moves to Tue the long weekend needs a bridge.',
    verified: true, confidence: 'official',
    source: [DOPT_2027],
    suggestions: [
      { place: 'Kodaikanal',
        reason: 'A cool lake town for three days, easy from Chennai and Bengaluru.',
        caveat: 'The date may move by a day with the moon, which would change your leave.' },
      { place: 'Mahabaleshwar',
        reason: 'A hill-station weekend ahead of the monsoon, from Mumbai and Pune.',
        caveat: 'Weekends are crowded, so go early in the day.' },
    ],
  },
  {
    id: 'buddha-purnima-2027', photo: 'spiti-monastery', name: 'Buddha Purnima long weekend', kind: 'long-weekend', group: 'national', types: ['festival', 'long-weekend'],
    regions: ['national'],
    startDate: '2027-05-20', endDate: '2027-05-23', nights: 3,
    note: 'Buddha Purnima is on Thursday 20 May. Take Friday 21 as leave for a four-day weekend.',
    researchNote: 'Buddha Purnima Thu 20 May (gazetted); bridge Fri 21 May. Falls in North/West school summer holidays.',
    verified: true, confidence: 'official',
    source: [DOPT_2027],
    suggestions: [
      { place: 'Ladakh', start: '2027-05-20', nights: 6,
        reason: 'Late May is the opening of the Ladakh season: clear, cold days and the first passes open.',
        caveat: 'Passes may still be opening and nights are very cold; allow two days to adjust to altitude.' },
      { place: 'Spiti Valley', start: '2027-05-20', nights: 6,
        reason: 'High-desert villages and monasteries.',
        caveat: 'Roads into Spiti can still be opening; check with your operator.' },
    ],
  },
  {
    id: 'independence-day-2027', photo: 'kerala-backwaters', name: 'Independence Day / Raksha Bandhan', kind: 'long-weekend', group: 'national', types: ['long-weekend'],
    regions: ['national'],
    startDate: '2027-08-14', endDate: '2027-08-17', nights: 3,
    note: 'Independence Day falls on a Sunday, so it adds no day off by itself. Monday 16 is a leave day, and Raksha Bandhan on Tuesday 17 is a holiday in some states only. A modest long weekend.',
    researchNote: 'Independence Day, Id-e-Milad and Parsi New Year (Navroz, RH) all fall on Sun 15 Aug — no extra day off on its own. Raksha Bandhan Tue 17 Aug is only RH centrally (holiday in some states), so Sat 14–Tue 17 needs Mon 16 as bridge (+Tue where RB is not a holiday). Weak long weekend.',
    verified: true, confidence: 'official',
    source: [DOPT_2027],
    suggestions: [
      { place: 'Kerala',
        reason: 'The monsoon is the green, quiet season for Ayurveda, backwaters and slow stays.',
        caveat: 'Heavy rain can slow road travel and some boat services; keep plans flexible.' },
      { place: 'Udaipur',
        reason: 'The lakes are full after the rains.',
        caveat: 'It is humid, and heavy showers can interrupt outdoor plans.' },
    ],
  },
  {
    id: 'janmashtami-2027', name: 'Janmashtami', kind: 'holiday', group: 'national', types: ['festival', 'short-escape'],
    regions: ['national'],
    startDate: '2027-08-25', endDate: '2027-08-25', nights: 0,
    note: 'A single day off, on Wednesday 25 August.',
    researchNote: 'Wed 25 Aug (gazetted, Delhi list). No long weekend.',
    verified: true, confidence: 'official',
    source: [DOPT_2027],
  },
  {
    id: 'dussehra-2027', name: 'Dussehra 2027', kind: 'holiday', group: 'national', types: ['festival', 'short-escape'],
    regions: ['national'],
    startDate: '2027-10-09', endDate: '2027-10-09', nights: 0,
    note: 'Dussehra falls on a Saturday, so there is no national long weekend.',
    researchNote: 'Gandhi Jayanti Sat 2 Oct and Dussehra Sat 9 Oct (both gazetted) fall on Saturdays — no national long weekend. Regional Navratri/Durga Puja/Ayudha Puja days make it a long weekend in WB/KA/TN (see regional).',
    verified: true, confidence: 'official',
    source: [DOPT_2027],
  },
  {
    id: 'diwali-2027', photo: 'diwali-lamps', name: 'Diwali 2027 long weekend', kind: 'long-weekend', group: 'national', types: ['festival', 'long-weekend'],
    regions: ['national'],
    startDate: '2027-10-28', endDate: '2027-10-31', nights: 3,
    note: 'Diwali is on Friday 29 October, so Friday to Sunday is off nationally. Some states also give Thursday.',
    researchNote: 'Diwali/Lakshmi Puja Fri 29 Oct (gazetted). Govardhan Puja/Bali Pratipada Sat 30 Oct, Bhai Duj/Bhau Beej Sun 31 Oct, Naraka Chaturdashi Thu 28 Oct (all RH). Fri–Sun is off nationally; Thu 28 is off in states that observe Deepavali on Naraka Chaturdashi (TN/KA usually). State 2027 lists not yet notified.',
    verified: true, confidence: 'official',
    source: [DOPT_2027, DRIK_DIWALI_2027],
    suggestions: [
      { place: 'Rajasthan',
        reason: 'Cool, clear days make Udaipur, Jaipur and Jodhpur a classic Diwali break.',
        caveat: 'Diwali week is busy in Rajasthan, so book rooms and drivers early.' },
      { place: 'Andaman Islands',
        reason: 'Seas begin to calm, with flights from the big metros.',
        caveat: 'Flights fill at Diwali, and ferries depend on sea conditions.' },
    ],
  },
  {
    id: 'durga-puja-2026', photo: 'durga-puja', name: 'Durga Puja (Kolkata)', kind: 'festival-window', group: 'festival', types: ['festival'],
    regions: ['WB'],
    startDate: '2026-10-15', endDate: '2026-10-26', nights: 11,
    note: 'Government offices in West Bengal are closed from 15 to 26 October, with public holidays on 19, 20 and 21 October. Kolkata itself is the draw this week, and outbound travel peaks after Dashami.',
    researchNote: 'WB govt offices: Chaturthi 15 Oct → additional days to Sat 24 Oct, Lakshmi Puja Sun 25 + additional Mon 26 Oct. Public (NI Act) holidays: Ashtami Mon 19, Navami Tue 20, Dashami Wed 21 Oct. Kolkata itself is the draw this week; outbound travel peaks after Dashami.',
    verified: true, confidence: 'official',
    source: [WB_2026, 'https://indianexpress.com/article/cities/kolkata/durga-puja-break-bengal-govt-employees-days-off-2026-10391031/'],
    suggestions: [
      { place: 'Rajasthan', start: '2026-10-21', nights: 5,
        reason: 'Cooler days and warm evenings in Udaipur and Jaipur make a balanced break after the pandal rounds.',
        caveat: 'Puja week is among the busiest travel weeks from Kolkata, so flights and hotels fill early.' },
      { place: 'Bhutan', start: '2026-10-21', nights: 5,
        reason: 'Autumn is the clear season in the Himalaya, a short flight from Kolkata.',
        caveat: 'Bhutan needs permits and a licensed operator, so start early.' },
    ],
  },
  {
    id: 'dasara-2026-ka-ts', photo: 'mysuru-palace', name: 'Dasara (Bengaluru/Hyderabad)', kind: 'long-weekend', group: 'festival', types: ['festival', 'long-weekend'],
    regions: ['KA', 'TS'],
    startDate: '2026-10-17', endDate: '2026-10-21', nights: 4,
    note: 'Karnataka and Telangana are off on Tuesday 20 and Wednesday 21 October. Monday 19 is a leave day for most, which makes a five-day stretch.',
    researchNote: 'KA: Mahanavami/Ayudha Pooja Tue 20, Vijayadasami Wed 21 Oct. TS: Saddula Bathukamma Sun 18, Vijaya Dasami Tue 20, following day Wed 21 Oct. Mon 19 is a bridge day (Maharnavami is an optional holiday in TS).',
    verified: true, confidence: 'official',
    source: [KA_2026, TS_2026, 'https://www.tsso.in/pdf/Telangana%20State%20-%20Holidays-2026.pdf'],
    suggestions: [
      { place: 'Goa',
        reason: 'The post-monsoon season is opening, with green hinterland and quiet beaches.',
        caveat: 'Some beach shacks have not reopened yet, and the sea can still be rough.' },
      { place: 'Coorg',
        reason: 'Misty coffee country within reach of Bengaluru.',
        caveat: 'Dasara roads are busy; leave early.' },
    ],
  },
  {
    id: 'ayutha-pooja-2026-tn', photo: 'mysuru-palace', name: 'Ayutha Pooja & Vijaya Dasami (Chennai)', kind: 'long-weekend', group: 'festival', types: ['festival', 'long-weekend'],
    regions: ['TN'],
    startDate: '2026-10-17', endDate: '2026-10-20', nights: 3,
    note: 'Ayutha Pooja on Monday 19 and Vijaya Dasami on Tuesday 20 October make a four-day weekend in Tamil Nadu with no leave needed.',
    researchNote: 'TN G.O.: Ayutha Pooja Mon 19, Vijaya Dasami Tue 20 Oct — a clean 4-day weekend with no leave. Deepavali Sun 8 Nov has no substitute in TN.',
    verified: true, confidence: 'official',
    source: [TN_2026],
    suggestions: [
      { place: 'Kerala',
        reason: 'Post-monsoon Kerala is green and quiet, a short hop from Chennai.',
        caveat: 'The north-east monsoon can bring afternoon showers in October.' },
      { place: 'Munnar',
        reason: 'Tea hills and cool air for a clean four-day weekend.',
        caveat: 'Hill roads are slow; allow for the drive from Kochi.' },
    ],
  },
  // VERIFY: date still to be confirmed (reliable-unofficial).
  {
    id: 'navratri-2026-gj', photo: 'navratri', name: 'Navratri (Ahmedabad)', kind: 'festival-window', group: 'festival', types: ['festival'],
    regions: ['GJ'],
    startDate: '2026-10-11', endDate: '2026-10-20', nights: 9,
    note: 'Navratri is nine nights of garba, and only Dussehra on Tuesday 20 October is an official holiday in Gujarat. Many stay for the evenings; the closing weekend suits those who would rather be away.',
    researchNote: 'Garba nights; only Dussehra Tue 20 Oct is a public holiday in GJ. Start (Ghatasthapana 11 Oct) inferred from Mahalaya Amavasya Sat 10 Oct in the WB/KA official lists; not separately checked against a panchang.',
    verified: false, confidence: 'reliable-unofficial',
    source: [GJ_2026],
    suggestions: [
      { place: 'Udaipur', start: '2026-10-17', nights: 3,
        reason: 'Lakes and old havelis, an easy trip from Ahmedabad for the closing weekend.',
        caveat: 'October is still warm; keep sightseeing to mornings and evenings.' },
      { place: 'Gir National Park', start: '2026-10-17', nights: 3,
        reason: 'Forest stays and a chance of lions, a day\u2019s drive from Ahmedabad.',
        caveat: 'Check when the park reopens after the monsoon, and book safaris ahead.' },
    ],
  },
  {
    id: 'diwali-2026-mh', photo: 'konkan-coast', name: 'Diwali (Maharashtra)', kind: 'long-weekend', group: 'festival', types: ['festival', 'long-weekend'],
    regions: ['MH'],
    startDate: '2026-11-07', endDate: '2026-11-10', nights: 3,
    note: 'Maharashtra is off on Sunday 8 and Tuesday 10 November. Monday 9 is a leave day for most.',
    researchNote: 'MH gazette: Laxmi Pujan Sun 8 Nov, Bali Pratipada Tue 10 Nov; Mon 9 is a bridge. Bhaubeej Wed 11 Nov is an extra holiday for state/municipal offices only. Panchang (Drik, Mumbai) shows Bali Pratipada on Mon 9 — gazette date governs.',
    verified: true, confidence: 'official',
    source: [MH_2026, DRIK_DIWALI_2026],
    suggestions: [
      { place: 'Goa',
        reason: 'The season has begun without the Christmas crowds, an easy hop from Mumbai and Pune.',
        caveat: 'Diwali week is busy, and rates rise toward the end of November.' },
      { place: 'Konkan coast',
        reason: 'Quiet beaches and fishing villages down the coast.',
        caveat: 'Konkan trains and roads are busy at Diwali.' },
    ],
  },
  {
    id: 'diwali-2026-gj', photo: 'udaipur-lake', name: 'Diwali & Gujarati New Year', kind: 'long-weekend', group: 'festival', types: ['festival', 'long-weekend'],
    regions: ['GJ'],
    startDate: '2026-11-07', endDate: '2026-11-11', nights: 4,
    note: 'Gujarat is off for Diwali on Sunday 8, New Year on Tuesday 10 and Bhai Bij on Wednesday 11 November. Monday 9 is a leave day.',
    researchNote: 'GJ gazette: Diwali Sun 8 (Sunday), Vikram Samvat New Year Tue 10, Bhai Bij Wed 11 Nov; Mon 9 is a bridge. Sardar Patel Jayanti Sat 31 Oct.',
    verified: true, confidence: 'official',
    source: [GJ_2026],
    suggestions: [
      { place: 'Udaipur',
        reason: 'Lakes and lit-up old towns, close to Ahmedabad.',
        caveat: 'Diwali week is busy, so book stays early.' },
      { place: 'Rann of Kutch',
        reason: 'The white desert\u2019s season is beginning.',
        caveat: 'The tent city usually opens a little later in the season; check dates before you commit.' },
    ],
  },
  {
    id: 'diwali-2026-ka', photo: 'konkan-coast', name: 'Deepavali (Bengaluru)', kind: 'long-weekend', group: 'festival', types: ['festival', 'long-weekend'],
    regions: ['KA'],
    startDate: '2026-11-07', endDate: '2026-11-10', nights: 3,
    note: 'Karnataka is off on Sunday 8 and Tuesday 10 November. Monday 9 is a leave day for most.',
    researchNote: 'KA: Naraka Chaturdashi Sun 8, Balipadyami/Deepavali Tue 10 Nov; Mon 9 bridge. Kannada Rajyotsava Sun 1 Nov.',
    verified: true, confidence: 'official',
    source: [KA_2026],
    suggestions: [
      { place: 'Gokarna',
        reason: 'Quiet beaches, a calm alternative to Goa, within reach of Bengaluru.',
        caveat: 'Some beach shacks reopen later in the season.' },
      { place: 'Kerala',
        reason: 'The backwaters are lush after the rains, a short hop from Bengaluru.',
        caveat: 'Showers are possible into November.' },
    ],
  },
  {
    id: 'kali-puja-2026', photo: 'eastern-himalaya', name: 'Kali Puja & Bhai Phonta (Kolkata)', kind: 'long-weekend', group: 'festival', types: ['festival', 'long-weekend'],
    regions: ['WB'],
    startDate: '2026-11-07', endDate: '2026-11-12', nights: 5,
    note: 'West Bengal state offices get most of the week around Kali Puja, 8 to 12 November. Banks and private offices usually get fewer days, so check your own.',
    researchNote: 'WB: Kali Puja Sun 8, additional days Mon 9 & Tue 10 (state offices), Bhratridwitiya Wed 11 (public), day after Thu 12 Nov (state offices). Banks/private sector get fewer days.',
    verified: true, confidence: 'official',
    source: [WB_2026],
    suggestions: [
      { place: 'Darjeeling and Kalimpong',
        reason: 'Clear mountain mornings after the rains, via a short flight from Kolkata.',
        caveat: 'Weather changes quickly, and the road from Bagdogra can be slow.' },
      { place: 'Puri and Konark',
        reason: 'The Odisha coast, a train or drive south of Kolkata.',
        caveat: 'Weekend trains fill early over the holidays.' },
    ],
  },
  {
    id: 'chhath-2026', name: 'Chhath Puja', kind: 'holiday', group: 'festival', types: ['festival', 'short-escape'],
    regions: ['DL', 'WB'],
    startDate: '2026-11-15', endDate: '2026-11-16', nights: 1,
    note: 'A one or two day break, depending on where you work.',
    researchNote: 'Chhath Sun 15 Nov (RH centrally/Delhi). WB gives an additional day Mon 16 Nov (state offices). Delhi GNCTD 2026 notification not opened directly (PDF failed); date per DoPT RH list.',
    verified: true, confidence: 'official',
    source: [DOPT_2026_RH, WB_2026],
  },
  // VERIFY: date still to be confirmed (reliable-unofficial).
  {
    id: 'sankranti-pongal-2027', photo: 'kites', name: 'Makar Sankranti / Pongal / Uttarayan', kind: 'long-weekend', group: 'festival', types: ['festival', 'long-weekend'],
    regions: ['TN', 'TS', 'KA', 'GJ'],
    startDate: '2027-01-14', endDate: '2027-01-17', nights: 3,
    note: 'Makar Sankranti and Pongal fall on Thursday 14 and Friday 15 January, which gives a four-day weekend in the south and Gujarat. The 2027 state lists are still to be confirmed.',
    researchNote: 'DoPT RH: Makar Sankranti Thu 14 Jan, Pongal Fri 15 Jan. TN usually: Pongal + Thiruvalluvar Day + Uzhavar Thirunal (would be Fri 15–Sun 17). GJ: Uttarayan Thu 14 (Vasi Uttarayan Fri 15 optional). TS: Bhogi/Sankranti/Kanuma. State 2027 lists not yet notified.',
    verified: false, confidence: 'reliable-unofficial',
    source: [DOPT_2027],
    suggestions: [
      { place: 'Wayanad',
        reason: 'Forest stays and cool mornings, easy from Bengaluru and Chennai.',
        caveat: 'The long weekend is busy for domestic travel, so book early.' },
      { place: 'Sri Lanka',
        reason: 'A pleasant, dry few days with the tea country and a train ride.',
        caveat: 'The east coast has its rainy season in January; stay west, south and in the hills.' },
    ],
  },
  // VERIFY: date still to be confirmed (reliable-unofficial).
  {
    id: 'shivaji-jayanti-2027', photo: 'sahyadri-fort', name: 'Shivaji Jayanti long weekend', kind: 'long-weekend', group: 'festival', types: ['festival', 'long-weekend', 'short-escape'],
    regions: ['MH'],
    startDate: '2027-02-19', endDate: '2027-02-21', nights: 2,
    note: 'Shivaji Jayanti is on Friday 19 February, a clean three-day weekend in Maharashtra. The 2027 state list is still to be confirmed.',
    researchNote: 'Chhatrapati Shivaji Maharaj Jayanti is fixed on 19 Feb in MH (Fri in 2027). MH 2027 list not yet notified; DoPT RH lists 19 Feb.',
    verified: false, confidence: 'reliable-unofficial',
    source: [DOPT_2027, MH_2026],
    suggestions: [
      { place: 'Near Bombay',
        reason: 'Two quiet nights in the hills or by a river, without a long journey.',
        caveat: 'Weekend roads out of Mumbai are slow; leave early.' },
      { place: 'Hampi',
        reason: 'Boulder hills and ruins in pleasant February weather.',
        caveat: 'Allow time to get there; it is an overnight train or a short flight and a drive.' },
    ],
  },
  // VERIFY: date still to be confirmed (reliable-unofficial).
  {
    id: 'maha-shivratri-2027', name: 'Maha Shivratri', kind: 'holiday', group: 'festival', types: ['festival', 'short-escape'],
    regions: ['MH', 'KA', 'TS', 'WB'],
    startDate: '2027-03-06', endDate: '2027-03-06', nights: 0,
    note: 'Falls on a Saturday, so there is no long weekend.',
    researchNote: 'Sat 6 Mar (DoPT RH; AECS/Podar school lists). Falls on Saturday — no long weekend.',
    verified: false, confidence: 'reliable-unofficial',
    source: [DOPT_2027, AECS_MUMBAI],
  },
  // VERIFY: date still to be confirmed (reliable-unofficial).
  {
    id: 'gudi-padwa-ugadi-2027', name: 'Gudi Padwa / Ugadi', kind: 'holiday', group: 'festival', types: ['festival', 'short-escape'],
    regions: ['MH', 'KA', 'TS'],
    startDate: '2027-04-07', endDate: '2027-04-07', nights: 0,
    note: 'A single day off, on Wednesday 7 April.',
    researchNote: 'Wed 7 Apr (DoPT RH; Drik Panchang Mumbai; Podar Bengaluru lists Ugadi 7 Apr). No long weekend. publicholidays.in shows 8 Apr — that estimate is wrong.',
    verified: false, confidence: 'reliable-unofficial',
    source: [DOPT_2027, DRIK_GUDI_2027, PODAR_BLR],
  },
  // VERIFY: date still to be confirmed (reliable-unofficial).
  {
    id: 'maharashtra-day-2027', name: 'Maharashtra Day / May Day', kind: 'holiday', group: 'festival', types: ['festival', 'short-escape'],
    regions: ['MH', 'GJ', 'KA', 'TN', 'WB'],
    startDate: '2027-05-01', endDate: '2027-05-01', nights: 0,
    note: 'Falls on a Saturday, so there is no long weekend.',
    researchNote: 'Sat 1 May (fixed date). No long weekend.',
    verified: false, confidence: 'reliable-unofficial',
    source: [MH_2026],
  },
  // VERIFY: date still to be confirmed (reliable-unofficial).
  {
    id: 'ganesh-2027', name: 'Ganesh Chaturthi', kind: 'festival-window', group: 'festival', types: ['festival', 'short-escape'],
    regions: ['MH', 'KA', 'TS', 'TN'],
    startDate: '2027-09-04', endDate: '2027-09-04', nights: 0,
    note: 'Ganesh Chaturthi falls on a Saturday, and the festival runs for about ten days in Mumbai.',
    researchNote: 'Sat 4 Sep (DoPT RH). Falls on Saturday — no long weekend. Mumbai festival runs ~10 days to Anant Chaturdashi (end date not verified). Good time for Mumbaikars to leave or to stay for the visarjan.',
    verified: false, confidence: 'reliable-unofficial',
    source: [DOPT_2027],
  },
  // VERIFY: date still to be confirmed (reliable-unofficial).
  {
    id: 'onam-2027', name: 'Onam', kind: 'holiday', group: 'festival', types: ['festival', 'short-escape'],
    regions: ['KL'],
    startDate: '2027-09-12', endDate: '2027-09-12', nights: 0,
    note: 'Thiruvonam is on Sunday 12 September.',
    researchNote: 'Thiruvonam Sun 12 Sep (DoPT RH). Kerala usually also gives the days either side; Kerala 2027 list not checked.',
    verified: false, confidence: 'reliable-unofficial',
    source: [DOPT_2027],
  },
  // VERIFY: date still to be confirmed (reliable-unofficial).
  {
    id: 'navratri-durga-puja-2027', photo: 'durga-puja', name: 'Navratri & Durga Puja 2027', kind: 'festival-window', group: 'festival', types: ['festival'],
    regions: ['WB', 'GJ', 'KA', 'TN', 'TS'],
    startDate: '2027-10-06', endDate: '2027-10-10', nights: 4,
    note: 'Saptami to Navami fall on Wednesday 6 to Friday 8 October, with Dussehra on Saturday 9. Several states are likely to give Friday 8 off for a long weekend; the state lists are still to be confirmed.',
    researchNote: 'Navratri starts ~Thu 30 Sep (panchang). DoPT RH: Saptami Wed 6, Ashtami Thu 7, Navami Fri 8 Oct; Dussehra Sat 9 Oct (gazetted). Ayudha Puja (KA/TN) likely Fri 8 Oct → Fri–Sun long weekend. WB/KA/TN/TS 2027 lists not yet notified; Mysore Dasara procession Sun 10 Oct (Drik).',
    verified: false, confidence: 'reliable-unofficial',
    source: [DOPT_2027, 'https://dekhopanchang.com/en/festivals/navaratri/2027', 'https://www.drikpanchang.com/dasara/mysore/mysore-dasara-date-time.html?year=2027'],
    suggestions: [
      { place: 'Mysuru',
        reason: 'Dasara in the old palace city, with the procession on Sunday 10 October.',
        caveat: 'State dates are still to be confirmed.' },
      { place: 'Udaipur',
        reason: 'Lakes and old havelis in comfortable early-October weather.',
        caveat: 'October can still be warm.' },
    ],
  },
  {
    id: 'school-autumn-2026-kol', photo: 'eastern-himalaya', name: 'Puja vacation (Kolkata schools)', kind: 'school-break', group: 'school', types: ['school'],
    regions: ['WB'],
    startDate: '2026-10-14', endDate: '2026-10-26', nights: 12,
    note: 'Kolkata\u2019s CBSE schools break for Puja from 14 to 26 October. State-board schools may run longer.',
    researchNote: 'South Point (Kolkata, CBSE): Puja vacation 14–26 Oct, then Kali Puja/Diwali break 8–11 Nov. WB state-board schools reportedly run much longer (~15 Oct–12 Nov per aggregators; WBBPE notice not opened).',
    verified: true, confidence: 'official',
    source: [SOUTHPOINT_KOL],
    suggestions: [
      { place: 'Sikkim', start: '2026-10-19', nights: 6,
        reason: 'Mountain monasteries and clear post-monsoon views, via a short flight from Kolkata.',
        caveat: 'Puja-time flights fill early, and mountain weather changes quickly.' },
      { place: 'Andaman Islands', start: '2026-10-19', nights: 6,
        reason: 'Island beaches and calm seas as the monsoon ends, a direct flight from Kolkata.',
        caveat: 'Check ferry schedules, and expect sea conditions to vary.' },
    ],
  },
  {
    id: 'school-dasara-2026-blr', photo: 'south-hills', name: 'Dasara break (Bengaluru schools)', kind: 'school-break', group: 'school', types: ['school'],
    regions: ['KA'],
    startDate: '2026-10-10', endDate: '2026-10-21', nights: 11,
    note: 'Bengaluru schools break for Dasara from 10 to 21 October, and the break is already under way.',
    researchNote: 'Podar Bengaluru (ICSE): 10–21 Oct, reopen 22 Oct. KA state-syllabus schools: 3–21 Oct. Already under way as of 7 Oct.',
    verified: true, confidence: 'official',
    source: [PODAR_BLR, KA_SCHOOLS],
    suggestions: [
      { place: 'Coorg', start: '2026-10-14', nights: 4,
        reason: 'Coffee estates and misty hills, a few hours\u2019 drive from Bengaluru.',
        caveat: 'Roads are busy over Dasara, and the north-east monsoon can bring showers.' },
      { place: 'Hampi', start: '2026-10-14', nights: 4,
        reason: 'Boulder hills and ruins, easier once the rains have cooled the days.',
        caveat: 'Days are still warm; start early and plan shade at midday.' },
    ],
  },
  {
    id: 'school-autumn-2026-del', photo: 'himalayan-foothills', name: 'Autumn break (Delhi schools)', kind: 'school-break', group: 'school', types: ['school'],
    regions: ['DL'],
    startDate: '2026-10-17', endDate: '2026-10-20', nights: 3,
    note: 'Delhi government schools have a short autumn break from 17 to 19 October, with Dussehra on the 20th. Private schools set their own.',
    researchNote: 'Delhi DoE (govt & aided schools): autumn break 17–19 Oct, + Dussehra Tue 20 Oct. Private CBSE schools set their own short breaks. Chennai (TN) quarterly break 26 Sep–4 Oct is already over.',
    verified: true, confidence: 'official',
    source: [DOE_DELHI, TN_SCHOOLS],
    suggestions: [
      { place: 'Rishikesh',
        reason: 'River, yoga and mountain air, a few hours from Delhi.',
        caveat: 'Weekend roads are busy, and river conditions vary after the rains.' },
      { place: 'Jim Corbett National Park',
        reason: 'Forest stays for a short family break.',
        caveat: 'Safari zones and permits need booking in advance.' },
    ],
  },
  {
    id: 'school-diwali-2026', photo: 'kerala-backwaters', name: 'Diwali vacation (schools)', kind: 'school-break', group: 'school', types: ['school'],
    regions: ['MH', 'KA', 'WB'],
    startDate: '2026-11-06', endDate: '2026-11-15', nights: 9,
    note: 'Most Mumbai schools break for Diwali from about 6 to 15 November, with shorter breaks in Bengaluru and Kolkata. Dates vary by school and board.',
    researchNote: 'Mumbai: Podar MH network 6–15 Nov (6–18 Nov for branches without a Ganesh break), AECS Mumbai (CBSE) 3–13 Nov reopen 16 Nov; state-board schools vary by district (Pune 2–14 Nov, unverified). DAIS (IB) ~10 days, exact dates not published. Bengaluru: Podar 6–11 Nov. Kolkata: South Point 8–11 Nov. Delhi and Chennai: no long Diwali school break (holiday days only). Common Mumbai window ≈ Fri 6–Sun 15 Nov.',
    verified: true, confidence: 'official',
    source: [PODAR_MH, AECS_MUMBAI, PODAR_BLR, SOUTHPOINT_KOL, DAIS],
    suggestions: [
      { place: 'Sri Lanka', start: '2026-11-06', nights: 7,
        reason: 'Tea hills, trains and a quieter coast, an easy short flight from Bengaluru and Chennai and a direct flight from Mumbai.',
        caveat: 'November is a shoulder month; the west and south coasts are more settled from December.' },
      { place: 'Rajasthan', start: '2026-11-06', nights: 5,
        reason: 'Cool, clear days make a classic family Diwali break, with festival lights in the old towns.',
        caveat: 'Diwali week is busy in Rajasthan, so book rooms and drivers early.' },
    ],
  },
  {
    id: 'school-winter-2026', photo: 'kerala-backwaters', name: 'Christmas–New Year school break', kind: 'school-break', group: 'school', types: ['school'],
    regions: ['MH', 'KA', 'WB', 'TN'],
    startDate: '2026-12-24', endDate: '2027-01-03', nights: 10,
    note: 'Schools in Mumbai, Bengaluru, Kolkata and Chennai break from about 24 December to 3 January; some run to 5 January.',
    researchNote: 'Mumbai: Podar 24 Dec–5 Jan, AECS 22 Dec–2 Jan (reopen 4 Jan). Bengaluru: Podar 24 Dec–5 Jan. Kolkata: South Point 24 Dec–3 Jan. Chennai (TN state): 24 Dec–3 Jan. DAIS ~2 weeks. Common window 24 Dec–3 Jan; some run to 5 Jan.',
    verified: true, confidence: 'official',
    source: [PODAR_MH, AECS_MUMBAI, PODAR_BLR, SOUTHPOINT_KOL, TN_SCHOOLS, DAIS],
    suggestions: [
      { place: 'Sri Lanka', start: '2026-12-24', nights: 7,
        reason: 'The south and west coasts are in their dry season, with tea hills and a train ride in the same trip.',
        caveat: 'Late December is the island\u2019s busiest time; reserve trains and the best stays early.' },
      { place: 'Vietnam', start: '2026-12-24', nights: 7,
        reason: 'Warm, dry weather in the south and centre, with flights from the big metros.',
        caveat: 'Check visa rules, and expect most flights to have a stop.' },
    ],
  },
  {
    id: 'school-winter-2027-del', photo: 'kerala-backwaters', name: 'Winter vacation (Delhi schools)', kind: 'school-break', group: 'school', types: ['school'],
    regions: ['DL'],
    startDate: '2027-01-01', endDate: '2027-01-15', nights: 14,
    note: 'Delhi\u2019s winter vacation runs 1 to 15 January, later than elsewhere. A cold wave can extend it.',
    researchNote: 'Delhi DoE: 1–15 Jan 2027. Delhi private schools generally follow DoE winter dates (cold-wave orders can extend it). This is the North-India winter pattern, unlike the 24 Dec–3 Jan pattern elsewhere.',
    verified: true, confidence: 'official',
    source: [DOE_DELHI],
    suggestions: [
      { place: 'Kerala', start: '2027-01-02', nights: 6,
        reason: 'Warm, dry days are the classic escape from a Delhi winter, with a direct flight to Kochi.',
        caveat: 'It is peak season in Kerala; the best houseboats and homestays go early.' },
      { place: 'Andaman Islands', start: '2027-01-02', nights: 6,
        reason: 'Warm seas, with direct flights from Delhi.',
        caveat: 'Peak winter season, so book flights and stays early.' },
    ],
  },
  {
    id: 'school-session-break-2027', photo: 'eastern-himalaya', name: 'End-of-session break (CBSE April-session schools)', kind: 'school-break', group: 'school', types: ['school'],
    regions: ['MH'],
    startDate: '2027-03-20', endDate: '2027-03-31', nights: 11,
    note: 'Some Mumbai schools break from 20 to 31 March, lining up with Holi to Easter. It varies by school.',
    researchNote: 'Podar MH: session break 20–31 Mar 2027 — lines up with the Holi-to-Easter week. Varies by school.',
    verified: true, confidence: 'official',
    source: [PODAR_MH],
    suggestions: [
      { place: 'Bhutan', start: '2027-03-22', nights: 6,
        reason: 'Spring brings blossom and festivals to Paro and Thimphu, a short flight from Mumbai via Delhi or Kolkata.',
        caveat: 'Permits and a licensed operator are needed, and festival dates fill early.' },
      { place: 'Sri Lanka', start: '2027-03-22', nights: 6,
        reason: 'The hill country is mild in March and the south coast is still dry.',
        caveat: 'Easter and school holidays make popular stays busy.' },
    ],
  },
  // VERIFY: date still to be confirmed (reliable-unofficial).
  {
    id: 'school-summer-2027-south', photo: 'eastern-himalaya', name: 'Summer vacation — South (Bengaluru, Chennai)', kind: 'school-break', group: 'school', types: ['school'],
    regions: ['KA', 'TN'],
    startDate: '2027-04-11', endDate: '2027-05-31', nights: 50,
    note: 'Southern schools usually break from mid April to the end of May. Dates are still to be confirmed and vary by board.',
    researchNote: 'Bengaluru: KA state schools 11 Apr–28 May; Podar Bengaluru (ICSE) 11 Apr–19 May. Chennai: TN state last working day 23 Apr; vacation through ~31 May (end date unofficial). South = mid/late April to end of May.',
    verified: false, confidence: 'reliable-unofficial',
    source: [KA_SCHOOLS, PODAR_BLR, TN_SCHOOLS],
    suggestions: [
      { place: 'Meghalaya', start: '2027-04-24', nights: 6,
        reason: 'Cool green hills and living-root bridges, via Guwahati or Kolkata.',
        caveat: 'Rain arrives early there, and roads and caves can close.' },
      { place: 'Andaman Islands', start: '2027-04-24', nights: 6,
        reason: 'Calm seas in April and May, with flights from Chennai and Bengaluru.',
        caveat: 'It is hot and humid, and the monsoon arrives late May.' },
    ],
  },
  // VERIFY: date still to be confirmed (reliable-unofficial).
  {
    id: 'school-summer-2027-mumbai', photo: 'ladakh', name: 'Summer vacation — Mumbai', kind: 'school-break', group: 'school', types: ['school'],
    regions: ['MH'],
    startDate: '2027-05-04', endDate: '2027-06-17', nights: 44,
    note: 'Mumbai CBSE schools break from early May to mid June; other boards differ. Dates are still to be confirmed.',
    researchNote: 'AECS Mumbai (CBSE): 4 May–17 Jun 2027, reopen 19 Jun (marked tentative). State board usually ~early May–mid June. ICSE: Cathedral 2026 was 18 May–29 Jun (2027 not published). IB/IGCSE (DAIS): mid-June to 4th week of July — different pattern. Common Mumbai window ≈ mid-May to early/mid June.',
    verified: false, confidence: 'reliable-unofficial',
    source: [AECS_MUMBAI, 'https://cathedral.noesis.dev/node/346', DAIS],
    suggestions: [
      { place: 'Ladakh', start: '2027-06-01', nights: 7,
        reason: 'Early June is when the high passes are open and the days are clear and cold, the best weeks for Ladakh.',
        caveat: 'Plan two days to adjust to altitude, and check road and pass conditions closer to the date.' },
      { place: 'Himachal Pradesh', start: '2027-05-20', nights: 7,
        reason: 'Cool hills for a family week away from the heat.',
        caveat: 'Late May and early June are busy in Manali and Shimla.' },
    ],
  },
  // VERIFY: date still to be confirmed (estimate).
  {
    id: 'school-summer-2027-kol', photo: 'eastern-himalaya', name: 'Summer vacation — Kolkata', kind: 'school-break', group: 'school', types: ['school'],
    regions: ['WB'],
    startDate: '2027-05-10', endDate: '2027-06-09', nights: 30,
    note: 'Our estimate from last year\u2019s calendar: mid May to early June. The 2027 dates are not out yet.',
    researchNote: 'Estimate from South Point 2026 (11 May–9 Jun 2026); 2027 dates not yet published. WB govt schools often get a shorter/longer heat-driven break by order.',
    verified: false, confidence: 'estimate',
    source: [SOUTHPOINT_KOL],
    suggestions: [
      { place: 'Sikkim', start: '2027-05-20', nights: 6,
        reason: 'Cool mountain air and monasteries, via a short flight from Kolkata.',
        caveat: 'Pre-monsoon showers and landslides can slow roads.' },
      { place: 'Ladakh', start: '2027-06-01', nights: 7,
        reason: 'Early June is when the high passes are open, the best weeks for Ladakh.',
        caveat: 'Plan two days to adjust to altitude, and check pass conditions closer to the date.' },
    ],
  },
  // VERIFY: date still to be confirmed (estimate).
  {
    id: 'school-summer-2027-del', photo: 'ladakh', name: 'Summer vacation — Delhi', kind: 'school-break', group: 'school', types: ['school'],
    regions: ['DL'],
    startDate: '2027-05-11', endDate: '2027-06-30', nights: 50,
    note: 'Our estimate from last year\u2019s calendar: mid May to the end of June. The 2027 dates are not out yet.',
    researchNote: 'Estimate from Delhi DoE 2026 (11 May–30 Jun 2026); 2027–28 calendar not yet published. North = mid-May to end-June.',
    verified: false, confidence: 'estimate',
    source: [DOE_DELHI],
    suggestions: [
      { place: 'Ladakh', start: '2027-06-01', nights: 7,
        reason: 'Early June is when the high passes are open and the days are clear and cold. Leh is a direct flight from Delhi.',
        caveat: 'Plan two days to adjust to altitude, and check pass conditions closer to the date.' },
      { place: 'Kashmir', start: '2027-05-20', nights: 6,
        reason: 'Gardens, lakes and cool air.',
        caveat: 'Check current travel advisories before booking.' },
    ],
  },
];

/* ---------------------------------------------------------------- helpers */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ISO date string for a Date, a 'YYYY-MM-DD' string or undefined (today, local time). */
function isoDay(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const filterByKey = (key) => REGION_FILTERS.find((f) => f.key === (resolveRegion(key) || key)) || null;

/* "MH", "mumbai-pune" (an old city link), "Delhi NCR" -> a filter key, or null. */
function resolveRegion(value) {
  const text = String(value == null ? '' : value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!text) return null;
  const byKey = REGION_FILTERS.find((f) => f.key === text);
  if (byKey) return byKey.key;
  const byCode = REGION_FILTERS.find((f) => f.codes.some((c) => c.toLowerCase() === text) || (f.aliases || []).includes(text));
  return byCode ? byCode.key : null;
}

/* Does a row show under a filter? Rows that are only 'national' always do; 'all' shows everything; otherwise a state code must match. */
const isPureNational = (brk) => brk.regions.length === 1 && brk.regions[0] === 'national';
function matchesRegion(brk, key) {
  if (isPureNational(brk)) return true;
  const filter = filterByKey(key);
  if (!filter || key === 'all') return true;
  return brk.regions.some((r) => filter.codes.includes(r));
}

/* "festival", "Long weekends" -> a type key, or null. */
function resolveType(value) {
  const slug = (v) => String(v == null ? '' : v).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const text = slug(value);
  if (!text) return null;
  const hit = TYPE_FILTERS.find((t) => t.key === text || slug(t.label) === text);
  return hit ? hit.key : null;
}
function matchesType(brk, key) {
  const type = resolveType(key);
  if (!type || type === 'all') return true;
  return (brk.types || []).includes(type);
}

function nightsBetween(startDate, endDate) {
  return Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000);
}

/* "6–11 Nov 2026", "24 Dec 2026 – 1 Jan 2027" */
function formatRange(startDate, endDate) {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  if (startDate === endDate) return `${sd} ${MONTHS[sm - 1]} ${sy}`;
  if (sy === ey && sm === em) return `${sd}–${ed} ${MONTHS[sm - 1]} ${sy}`;
  if (sy === ey) return `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]} ${ey}`;
  return `${sd} ${MONTHS[sm - 1]} ${sy} – ${ed} ${MONTHS[em - 1]} ${ey}`;
}

/* Rows still ahead, soonest first Optional filters: `group`, `region` (a filter key).
   `today` may be injected for tests. */
const MIN_NIGHTS = 2;
function upcomingBreaks(today, { group, region, type, all } = {}) {
  const day = isoDay(today);
  return BREAKS
    .filter((b) => b.endDate >= day && (all || b.nights >= MIN_NIGHTS) && (!group || b.group === group) && (!region || matchesRegion(b, region)) && (!type || matchesType(b, type)))
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id))
    .map((b) => ({
      id: b.id, photo: b.photo, name: b.name, kind: b.kind, group: b.group, types: b.types, regions: b.regions, startDate: b.startDate, endDate: b.endDate, nights: b.nights,
      note: b.note, researchNote: b.researchNote, suggestions: (b.suggestions || []).map((x) => resolveSuggestion(b, x)), verified: b.verified, confidence: b.confidence, source: b.source, dates: formatRange(b.startDate, b.endDate),
    }));
}

/* The next row that is national or in the region, for the homepage teaser. */
function nextBreak(today, region = DEFAULT_REGION) {
  const rows = region === 'all'
    ? upcomingBreaks(today, { group: 'national' }).filter(isPureNational)
    : upcomingBreaks(today, { region }).filter((b) => b.group !== 'school');
  return rows[0] || null;
}

/* A long window (a school break of up to 50 nights) would be an unreasonable trip length, so a row over 14 nights defaults
   to a 7-night trip from its start. A suggestion can set its own start and nights inside the window. */
const DEFAULT_LONG_TRIP_NIGHTS = 7;
function plannerNights(brk) { return brk.nights > 14 ? DEFAULT_LONG_TRIP_NIGHTS : Math.max(1, brk.nights); }

function resolveSuggestion(brk, sug) {
  return {
    place: sug.place, reason: sug.reason, caveat: sug.caveat || '',
    start: sug.start || brk.startDate,
    nights: Math.min(30, Math.max(1, sug.nights || plannerNights(brk))),
  };
}

module.exports = {
  BREAKS, MIN_NIGHTS, isPureNational, GROUPS, GROUP_TITLES, REGION_FILTERS, REGION_NAMES, DEFAULT_REGION,
  TYPE_FILTERS, DEFAULT_TYPE, CLOSE_BY_REGION, CLOSE_NEUTRAL, resolveType, matchesType,
  resolveRegion, matchesRegion, filterByKey, upcomingBreaks, nextBreak, resolveSuggestion, plannerNights, formatRange, nightsBetween, isoDay,
};
