'use strict';
/*
 * break-photos.js - the photo themes for the homepage "When India travels" cards (build/when-india-travels.js).
 * A break names its theme with `photo: '<key>'` in ./india-breaks.js; one photo serves every break of that theme.
 * Themes are chosen so that cards next to each other never repeat a photo (also after a visitor filters by state).
 * Files: assets/images/<base>-<width>.jpg, every one cropped to 16:10 (1200 x 750 is the largest). Credits: assets/images/CREDITS.md.
 * tests/home-break-photos.test.mjs checks that every shown break has a valid theme and that every theme's files exist.
 */
const WIDTHS = [480, 800, 1200];
const WIDTH = 1200;
const HEIGHT = 750;

/* The card photo sits at the top of a card about 18vw wide (capped at 292px) with three cards showing, 28vw with two (up to 1279px),
   46vw with two in a single column (up to 800px), and 77vw with one and a bit (up to 600px). */
const SIZES = '(max-width: 600px) 77vw, (max-width: 800px) 46vw, (max-width: 1279px) 28vw, min(18.5vw, 292px)';

/* On the full page the photo fills the left column of a row: 5/12 of the .wrap content width less the grid gap (above 800px), and the whole
   content width (below). Content width is 100vw less two gutters, --gut = clamp(1.15rem, 4.2vw, 4.5rem), up to the 1580px wrap; the gap is
   clamp(1.5rem, 4vw, 4rem). The column tops out at 577px (a wrap of 1580px or more). Keep in step with .lw-break in assets/css/friday.css. */
const ROW_SIZES = '(max-width: 800px) calc(100vw - 2 * clamp(1.15rem, 4.2vw, 4.5rem)), min(577px, calc((100vw - 2 * clamp(1.15rem, 4.2vw, 4.5rem) - clamp(1.5rem, 4vw, 4rem)) * 5 / 12))';

const theme = (key, position = '50% 50%') => [key, { base: `break-${key}`, widths: WIDTHS, width: WIDTH, height: HEIGHT, position }];

const THEMES = Object.fromEntries([
  theme('diwali-lamps'),
  theme('durga-puja'),
  theme('mysuru-palace'),
  theme('south-hills'),
  theme('navratri'),
  theme('rajasthan-fort'),
  theme('himalayan-foothills'),
  theme('eastern-himalaya'),
  theme('kerala-backwaters'),
  theme('udaipur-lake'),
  theme('konkan-coast'),
  theme('golden-temple'),
  theme('goa-church'),
  theme('jaisalmer-dunes'),
  theme('kites'),
  theme('rann-of-kutch'),
  theme('sahyadri-fort'),
  theme('holi'),
  theme('ladakh'),
  theme('spiti-monastery'),
]);

module.exports = { THEMES, WIDTHS, WIDTH, HEIGHT, SIZES, ROW_SIZES };
