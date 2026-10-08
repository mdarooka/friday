/* ==========================================================================
   FRIDAY — interaction layer
   Progressive: every page reads and works with this file absent.
   ========================================================================== */

(function () {
  'use strict';

  const $  = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------- header */

  const head = $('.head');

  function initHeader() {
    if (!head) return;
    const lightPage = document.body.hasAttribute('data-light-head');
    let last = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      const solid = lightPage ? y > 8 : y > window.innerHeight * 0.72;

      head.classList.toggle('is-solid', solid);
      head.classList.toggle('is-light', lightPage && !solid);

      const menuOpen = document.body.classList.contains('menu-open') || $('.mega.is-open');
      head.classList.toggle('is-hidden', !menuOpen && y > last && y > 320);
      last = y;
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* --------------------------------------------------------- mega menus */

  function initMega() {
    const items = $$('.nav__item[data-mega]');
    if (!items.length) return;

    const closeAll = (except) => {
      items.forEach((item) => {
        if (item === except) return;
        item.classList.remove('is-open');
        const panel = $('#' + item.dataset.mega);
        if (panel) panel.classList.remove('is-open');
        const btn = $('.nav__link', item);
        if (btn) btn.setAttribute('aria-expanded', 'false');
      });
    };

    items.forEach((item) => {
      const btn = $('.nav__link', item);
      const panel = $('#' + item.dataset.mega);
      if (!btn || !panel) return;

      const open = () => {
        closeAll(item);
        item.classList.add('is-open');
        panel.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
        head.classList.remove('is-hidden');
        head.classList.add('is-solid');
        head.classList.remove('is-light');
      };
      const close = () => {
        item.classList.remove('is-open');
        panel.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
        window.dispatchEvent(new Event('scroll'));
      };

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        item.classList.contains('is-open') ? close() : open();
      });

      let leaveTimer;
      const cancel = () => clearTimeout(leaveTimer);
      const schedule = () => {
        cancel();
        leaveTimer = setTimeout(close, 260);
      };
      [item, panel].forEach((el) => {
        el.addEventListener('mouseenter', () => { cancel(); if (window.innerWidth > 1220) open(); });
        el.addEventListener('mouseleave', schedule);
      });
    });

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(null); });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.nav__item') && !e.target.closest('.mega')) closeAll(null);
    });
  }

  /* ------------------------------------------------------- overlay menu */

  function initMenu() {
    const burger = $('.burger');
    const menu = $('.menu');
    if (!burger || !menu) return;

    const set = (open) => {
      menu.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
      document.body.classList.toggle('is-locked', open);
      burger.setAttribute('aria-expanded', String(open));
      $('.burger__txt', burger).textContent = open ? 'Close' : 'Menu';
      if (open) head.classList.remove('is-hidden');
    };

    burger.addEventListener('click', () => set(!menu.classList.contains('is-open')));
    $$('.menu a').forEach((a) => a.addEventListener('click', () => set(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) set(false);
    });
  }

  /* ------------------------------------------------------------ reveals */

  function initReveal() {
    const els = $$('[data-reveal]');
    if (!els.length) return;
    if (reduced || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.06 });

    els.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------- catalogue preview swapping */

  function initCatalogue() {
    $$('[data-catalogue]').forEach((cat) => {
      const rows = $$('.cat-row', cat);
      const items = $$('.cat-preview__item', cat);
      const capT = $('[data-cap-title]', cat);
      const capN = $('[data-cap-num]', cat);
      if (!rows.length || !items.length) return;

      const show = (i) => {
        items.forEach((el, k) => el.classList.toggle('is-shown', k === i));
        rows.forEach((el, k) => el.classList.toggle('is-active', k === i));
        if (capT) capT.textContent = rows[i].dataset.title || '';
        if (capN) capN.textContent = rows[i].dataset.num || '';
      };

      show(0);
      rows.forEach((row, i) => {
        row.addEventListener('mouseenter', () => show(i));
        row.addEventListener('focus', () => show(i));
      });
    });
  }

  /* --------------------------------------------------------------- rails */

  function initRails() {
    $$('[data-rail]').forEach((rail) => {
      const scope = rail.closest('[data-rail-scope]') || document;
      const prev = $('[data-rail-prev]', scope);
      const next = $('[data-rail-next]', scope);

      const step = () => rail.firstElementChild
        ? rail.firstElementChild.getBoundingClientRect().width + 24
        : rail.clientWidth * 0.8;

      const sync = () => {
        if (!prev || !next) return;
        prev.disabled = rail.scrollLeft < 8;
        next.disabled = rail.scrollLeft > rail.scrollWidth - rail.clientWidth - 8;
      };

      if (prev) prev.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: 'smooth' }));
      if (next) next.addEventListener('click', () => rail.scrollBy({ left: step(), behavior: 'smooth' }));
      rail.addEventListener('scroll', sync, { passive: true });
      window.addEventListener('resize', sync);
      sync();

      /* drag to scroll */
      let down = false, startX = 0, startL = 0, moved = 0;
      rail.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') return;
        down = true; moved = 0;
        startX = e.clientX; startL = rail.scrollLeft;
      });
      rail.addEventListener('pointermove', (e) => {
        if (!down) return;
        const dx = e.clientX - startX;
        moved = Math.abs(dx);
        if (moved > 4) rail.classList.add('is-dragging');
        rail.scrollLeft = startL - dx;
      });
      const up = () => {
        down = false;
        setTimeout(() => rail.classList.remove('is-dragging'), 30);
      };
      rail.addEventListener('pointerup', up);
      rail.addEventListener('pointerleave', up);
    });
  }

  /* -------------------------------------------------------- view cursor */

  function initCursor() {
    if (reduced || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const targets = $$('[data-cursor]');
    if (!targets.length) return;

    const dot = document.createElement('div');
    dot.className = 'cursor';
    dot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(dot);

    let x = 0, y = 0, cx = 0, cy = 0, on = false, raf = null;

    const loop = () => {
      cx += (x - cx) * 0.18;
      cy += (y - cy) * 0.18;
      dot.style.transform = `translate3d(${cx}px, ${cy}px, 0) scale(${on ? 1 : 0.4})`;
      raf = (Math.abs(x - cx) > 0.4 || Math.abs(y - cy) > 0.4 || on)
        ? requestAnimationFrame(loop)
        : null;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

    window.addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; kick(); }, { passive: true });

    targets.forEach((t) => {
      t.addEventListener('pointerenter', () => {
        on = true;
        dot.textContent = t.dataset.cursor || 'View';
        dot.classList.add('is-on');
        kick();
      });
      t.addEventListener('pointerleave', () => {
        on = false;
        dot.classList.remove('is-on');
        kick();
      });
    });
  }

  /* ---------------------------------------------------------- the form */

  function initForm() {
    const villaParams = new URLSearchParams(location.search);
    const villaId = villaParams.get('villa') || '';
    const villaContext = villaId && /^[A-Za-z0-9_-]{1,180}$/.test(villaId) ? {
      id: villaId, name: villaParams.get('villa_name') || '', city: villaParams.get('city') || '', guests: villaParams.get('guests') || ''
    } : null;
    if (villaContext) {
      $$('[data-callback-form], [data-commission]').forEach(form => {
        const hidden = document.createElement('input'); hidden.type = 'hidden'; hidden.name = 'villaId'; hidden.value = villaContext.id; form.appendChild(hidden);
      });
      const commission = $('[data-commission]');
      if (commission) {
        const summary = document.createElement('p'); summary.className = 'card__d'; summary.textContent = 'Villa: ' + villaContext.name + (villaContext.city ? ' · ' + villaContext.city : '') + (villaContext.guests ? ' · Sleeps up to ' + villaContext.guests + ' guests' : '');
        commission.insertBefore(summary, commission.firstChild);
        const shape = $('[name="shape"]', commission);
        if (shape) shape.value = summary.textContent;
        const villaStay = Array.from(commission.querySelectorAll('[name="composition"]')).find(input => input.value === 'Villa stay');
        if (villaStay) villaStay.checked = true;
      }
    }
    /* ?topic= (for example from a When India travels "Call me back" link) is mentioned to the team with the callback request. */
    const topic = (villaParams.get('topic') || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 200);
    if (topic) {
      $$('[data-callback-form]').forEach(form => {
        const note = document.createElement('p'); note.className = 'card__d'; note.setAttribute('data-callback-topic', ''); note.textContent = 'We\u2019ll mention: ' + topic + '.';
        form.insertBefore(note, form.firstChild);
      });
    }
    async function submit(form,endpoint) {
      const entries=new FormData(form),data=Object.fromEntries(entries);
      if(entries.has('composition'))data.composition=entries.getAll('composition');
      if(entries.has('consent'))data.consent=true;
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'Your submission could not be saved. Please try again.');return result;
    }
    function errorNote(form,message) {
      let note=form.querySelector('[data-form-error]');if(!note){note=document.createElement('p');note.dataset.formError='';note.setAttribute('role','alert');form.appendChild(note);}note.textContent=message;
    }
    $$('[data-callback-form]').forEach(form=>form.addEventListener('submit',async e=>{
      e.preventDefault();if(!form.reportValidity())return;
      const button=form.querySelector('[type=submit]'),status=form.querySelector('[data-callback-status]');button.disabled=true;
      if(status)status.textContent='Sending your request…';
      try{
        const entries=new FormData(form),data={name:entries.get('name'),phone:entries.get('phone'),bestTime:entries.get('bestTime'),entryPoint:form.dataset.entryPoint||'contact',...(topic?{topic}:{}),...(villaContext?{villaId:villaContext.id}:{})};
        const response=await fetch('/api/callbacks',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
        const result=await response.json();if(!response.ok)throw new Error(result.error||'Your request could not be saved. Please try again.');
        if(window.FridayCallbackAnalytics)window.FridayCallbackAnalytics.track('contact',result.id);
        form.reset();form.querySelector('[name="bestTime"]').value='morning';
        document.dispatchEvent(new CustomEvent('friday:callback-saved',{detail:{id:result.id,checklistToken:result.checklistToken,anchor:form.parentElement}}));
        if(status)status.textContent=result.delivery?.notification==='provider_accepted'?'Thanks. Friday’s team has your number and will call at that time.':result.delivery?.notification==='delivery_unknown'?'Your request is saved. Friday could not confirm the team notification.':'Your request is saved. The team will call at that time.';
      }catch(err){if(status)status.textContent=err.message||'Your request could not be saved. Please try again.';}
      finally{button.disabled=false;}
    }));
    $$('[data-destination-form]').forEach(form=>form.addEventListener('submit',async e=>{
      e.preventDefault();if(!form.reportValidity())return;
      const button=form.querySelector('[type=submit]'),status=form.querySelector('[data-destination-status]');
      const entries=new FormData(form),data={};
      ['destination','month','groupSize','name','email','phone','notes'].forEach(key=>{const value=(entries.get(key)||'').toString().trim();if(value)data[key]=value;});
      if(!data.email&&!data.phone){if(status)status.textContent='Add an email address or a phone number so the team can reply.';return;}
      button.disabled=true;if(status)status.textContent='Sending your request…';
      try{
        const response=await fetch('/api/destination-requests',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
        const result=await response.json();if(!response.ok)throw new Error(result.error||'Your request could not be saved. Please try again.');
        location.href='request-destination-thanks.html';
      }catch(err){if(status)status.textContent=err.message||'Your request could not be saved. Please try again.';button.disabled=false;}
    }));
    const form=$('[data-commission]'),sent=$('[data-commission-sent]');
    if(form)form.addEventListener('submit',async e=>{
      e.preventDefault();if(!form.reportValidity())return;
      const btn=form.querySelector('[type=submit]');btn.disabled=true;
      try{
        const result=await submit(form,'/api/commissions');if(window.FridayQuoteAnalytics)window.FridayQuoteAnalytics.track(window.FridayQuoteAnalytics.pathForEnquiry(form),result.id);const first=($('[name="name"]',form).value||'').trim().split(/\s+/)[0],slot=$('[data-sent-name]');
        if(slot)slot.textContent=first?`, ${first}`:'';
        const deliveryNote=$('[data-commission-delivery-note]');if(deliveryNote){const team=result.delivery?.notification,receipt=result.delivery?.receipt;const teamText=team==='provider_accepted'?'A notification is on its way to the Friday team.':team==='delivery_unknown'?'Friday could not confirm the team notification, so it will not retry automatically.':'Team email notifications are not configured yet.';const receiptText=receipt==='provider_accepted'?' A confirmation email is on its way.':receipt==='delivery_unknown'?' Friday could not confirm delivery of your confirmation email.':' Confirmation email delivery is not configured yet.';deliveryNote.textContent=`Your enquiry has been saved. ${teamText}${receiptText}`;}
        form.classList.add('is-sent');if(sent){sent.classList.add('is-shown');sent.setAttribute('tabindex','-1');sent.focus({preventScroll:true});sent.scrollIntoView({behavior:reduced?'auto':'smooth',block:'center'});}
      }catch(err){errorNote(form,err.message);}finally{btn.disabled=false;}
    });
    $$('[data-subscribe]').forEach(f=>f.addEventListener('submit',async e=>{
      e.preventDefault();if(!f.reportValidity())return;const btn=f.querySelector('[type=submit]');btn.disabled=true;
      try{const result=await submit(f,'/api/subscriptions');const note=$('[data-subscribe-note]',f.parentElement);f.hidden=true;if(note){note.hidden=false;note.textContent=result.delivery==='provider_accepted'?'Thanks for subscribing. Your confirmation email is on its way.':result.delivery==='delivery_unknown'?'Your signup was saved, but Friday could not confirm email delivery. Please do not submit again.':'Your signup was saved, but email confirmation is not configured yet.';}}catch(err){errorNote(f,err.message);}finally{btn.disabled=false;}
    }));
  }

  /* ------------------------------------------------------------ sundry */

  function initSundry() {
    const y = $('[data-year]');
    if (y) y.textContent = new Date().getFullYear();
  }

  /* -------------------------------------------------------------- auth */

  function initAuth() {
    const navAuth = $('[data-nav-auth]');
    const menuAuth = $('[data-menu-auth]');
    if (!navAuth && !menuAuth) return;

    fetch('/api/auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : { user: null }))
      .catch(() => ({ user: null }))
      .then((data) => {
        const user = data && data.user;
        if (user) {
          const firstName = user.name ? user.name.trim().split(/\s+/)[0] : 'Account';
          if (navAuth) {
            navAuth.textContent = firstName;
            navAuth.href = 'trip.html#/preferences';
            navAuth.setAttribute('title', 'Signed in as ' + (user.email || user.name));
            navAuth.setAttribute('aria-label', 'Account preferences for ' + (user.name || user.email));
          }
          if (menuAuth) {
            menuAuth.textContent = 'Account (' + firstName + ')';
            menuAuth.href = 'trip.html#/preferences';
          }
        } else {
          if (navAuth) {
            navAuth.textContent = 'Sign in';
            navAuth.href = 'trip.html';
          }
          if (menuAuth) {
            menuAuth.textContent = 'Sign in';
            menuAuth.href = 'trip.html';
          }
        }
      });
  }

  /* -------------------------------------------------------------- boot */

  const boot = () => {
    initHeader();
    initMega();
    initMenu();
    initReveal();
    initCatalogue();
    initRails();
    initCursor();
    initForm();
    initSundry();
    initAuth();
    document.documentElement.classList.add('js-ready');
  };

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot)
    : boot();
})();
