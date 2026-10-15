/* A concrete reply promise: 30 hours from now, shown in India time.
   "Thu 3 PM" when the minute is :00, otherwise "Thu 3:30 PM". */

const HOURS = 30;

export function replyBy(now = new Date()) {
  const due = new Date(now.getTime() + HOURS * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h12',
  }).formatToParts(due);
  const part = (type) => parts.find((item) => item.type === type)?.value || '';
  const minute = part('minute');
  const period = part('dayPeriod').toUpperCase();
  const clock = minute === '00' ? `${part('hour')} ${period}` : `${part('hour')}:${minute} ${period}`;
  const label = `${part('weekday')} ${clock}`.replace(/\s+/g, ' ').trim();
  return { at: due.toISOString(), label, text: `Your designer replies by ${label}` };
}
