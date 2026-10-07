(function () {
  'use strict';
  const form = document.querySelector('[data-villa-submission]');
  if (!form) return;
  const status = form.querySelector('[data-villa-status]');
  const button = form.querySelector('button[type="submit"]');
  const setStatus = (message, state = '') => {
    status.textContent = message;
    status.dataset.state = state;
  };
  const numberOrNull = (value) => value.trim() === '' ? null : Number(value);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const payload = {
      contactName: String(data.get('contactName') || '').trim(),
      email: String(data.get('email') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
      villaName: String(data.get('villaName') || '').trim(),
      city: String(data.get('city') || '').trim(),
      mapsUrl: String(data.get('mapsUrl') || '').trim(),
      bedrooms: numberOrNull(String(data.get('bedrooms') || '')),
      maxGuests: numberOrNull(String(data.get('maxGuests') || '')),
      website: String(data.get('website') || '').trim(),
      photosUrl: String(data.get('photosUrl') || '').trim(),
      description: String(data.get('description') || '').trim(),
      consent: data.get('consent') === 'on',
      websiteTrap: String(data.get('websiteTrap') || ''),
    };
    button.disabled = true;
    setStatus('Sending your introduction…');
    try {
      const response = await fetch('/api/villa-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || 'We could not send that just now. Please try again.');
      form.reset();
      setStatus('Thank you. Friday has received your introduction for review. We will be in touch if the property may suit the collection.', 'success');
    } catch (error) {
      setStatus(error.message || 'We could not send that just now. Please try again.', 'error');
    } finally {
      button.disabled = false;
    }
  });
})();
