/* =============================================
   Johann Portfolio — script.js
   Dark glass theme interactions
   ============================================= */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouchDevice = window.matchMedia('(hover: none)').matches;

  /* =============================================
     1. LIQUID GLASS DISPLACEMENT MAPS
     ============================================= */
  (function initLiquidGlassMaps() {
    const enableSvgDisplacement = false;
    if (!enableSvgDisplacement) return;

    const supportsCanvas = typeof HTMLCanvasElement !== 'undefined';
    if (!supportsCanvas) return;

    const XLINK_NS = 'http://www.w3.org/1999/xlink';

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function smootherstep(edge0, edge1, value) {
      const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
      return x * x * x * (x * (x * 6 - 15) + 10);
    }

    function roundedRectSdf(px, py, halfW, halfH, radius) {
      const qx = Math.abs(px) - halfW + radius;
      const qy = Math.abs(py) - halfH + radius;
      const ox = Math.max(qx, 0);
      const oy = Math.max(qy, 0);
      return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - radius;
    }

    function makeLiquidMap(options) {
      const {
        width,
        height,
        radius,
        bezel,
        thickness,
        lightAngle = -60,
        specularPower = 7,
        specularOpacity = 0.5,
      } = options;

      const displacementCanvas = document.createElement('canvas');
      const specularCanvas = document.createElement('canvas');
      displacementCanvas.width = specularCanvas.width = width;
      displacementCanvas.height = specularCanvas.height = height;

      const displacementCtx = displacementCanvas.getContext('2d');
      const specularCtx = specularCanvas.getContext('2d');
      const displacement = displacementCtx.createImageData(width, height);
      const specular = specularCtx.createImageData(width, height);
      const halfW = width / 2;
      const halfH = height / 2;
      const light = {
        x: Math.cos((lightAngle * Math.PI) / 180),
        y: Math.sin((lightAngle * Math.PI) / 180),
      };

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const px = x - halfW + 0.5;
          const py = y - halfH + 0.5;
          const sdf = roundedRectSdf(px, py, halfW, halfH, radius);
          const insideDistance = Math.max(-sdf, 0);
          const bezelT = clamp(1 - insideDistance / bezel, 0, 1);
          const surface = 1 - Math.pow(1 - smootherstep(0, 1, bezelT), 4);
          const amount = surface * thickness;

          const epsilon = 0.75;
          const dx =
            roundedRectSdf(px + epsilon, py, halfW, halfH, radius) -
            roundedRectSdf(px - epsilon, py, halfW, halfH, radius);
          const dy =
            roundedRectSdf(px, py + epsilon, halfW, halfH, radius) -
            roundedRectSdf(px, py - epsilon, halfW, halfH, radius);
          const normalLength = Math.hypot(dx, dy) || 1;
          const nx = dx / normalLength;
          const ny = dy / normalLength;

          const vectorX = -nx * amount;
          const vectorY = -ny * amount;
          const dot = clamp(nx * light.x + ny * light.y, 0, 1);
          const rim = smootherstep(0.08, 1, bezelT);
          const shine = Math.pow(dot, specularPower) * rim * specularOpacity;
          const dataIndex = (y * width + x) * 4;

          displacement.data[dataIndex] = clamp(128 + vectorX * 127, 0, 255);
          displacement.data[dataIndex + 1] = clamp(128 + vectorY * 127, 0, 255);
          displacement.data[dataIndex + 2] = 128;
          displacement.data[dataIndex + 3] = 255;

          specular.data[dataIndex] = 255;
          specular.data[dataIndex + 1] = 255;
          specular.data[dataIndex + 2] = 255;
          specular.data[dataIndex + 3] = clamp(shine * 255, 0, 255);
        }
      }

      displacementCtx.putImageData(displacement, 0, 0);
      specularCtx.putImageData(specular, 0, 0);

      return {
        displacement: displacementCanvas.toDataURL('image/png'),
        specular: specularCanvas.toDataURL('image/png'),
      };
    }

    function setSvgImage(id, href) {
      const node = document.getElementById(id);
      if (!node) return;
      node.setAttribute('href', href);
      node.setAttributeNS(XLINK_NS, 'href', href);
    }

    const card = makeLiquidMap({
      width: 360,
      height: 260,
      radius: 34,
      bezel: 52,
      thickness: 0.74,
      specularOpacity: 0.36,
    });
    const pill = makeLiquidMap({
      width: 520,
      height: 120,
      radius: 60,
      bezel: 36,
      thickness: 0.68,
      specularOpacity: 0.34,
    });
    const inner = makeLiquidMap({
      width: 320,
      height: 240,
      radius: 28,
      bezel: 36,
      thickness: 0.38,
      specularOpacity: 0.18,
    });

    setSvgImage('lg-map-card', card.displacement);
    setSvgImage('lg-spec-card', card.specular);
    setSvgImage('lg-map-pill', pill.displacement);
    setSvgImage('lg-spec-pill', pill.specular);
    setSvgImage('lg-map-inner', inner.displacement);
  })();

  /* =============================================
     1. THEME TOGGLE
     ============================================= */
  (function initTheme() {
    const stored = localStorage.getItem('portfolio-theme');
    const preferred = stored || 'dark';
    document.documentElement.setAttribute('data-theme', preferred);

    const btn = document.getElementById('themeToggle');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';

      document.documentElement.classList.add('theme-switching');
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('portfolio-theme', next);

      setTimeout(() => document.documentElement.classList.remove('theme-switching'), 400);
    });
  })();

  /* =============================================
     2. MOUSE PARALLAX ON ORBS
     ============================================= */
  const enableOrbParallax = false;
  if (enableOrbParallax && !isTouchDevice && !prefersReducedMotion) {
    const orbs = document.querySelectorAll('.orb');
    const orbMultipliers = [0.02, 0.015, 0.01, 0.018];

    let targetOrbX = 0, targetOrbY = 0;
    let currentOrbX = 0, currentOrbY = 0;

    document.addEventListener('mousemove', (e) => {
      // Normalize to -0.5 → +0.5
      targetOrbX = (e.clientX / window.innerWidth)  - 0.5;
      targetOrbY = (e.clientY / window.innerHeight) - 0.5;
    });

    function animateOrbs() {
      const lerpAmt = 0.04;
      currentOrbX += (targetOrbX - currentOrbX) * lerpAmt;
      currentOrbY += (targetOrbY - currentOrbY) * lerpAmt;

      orbs.forEach((orb, i) => {
        const m = orbMultipliers[i] || 0.01;
        const dx = currentOrbX * window.innerWidth  * m * 60;
        const dy = currentOrbY * window.innerHeight * m * 60;
        // Compose with existing drift animation via CSS custom properties
        orb.style.setProperty('--px', dx + 'px');
        orb.style.setProperty('--py', dy + 'px');
        orb.style.transform = `translate(var(--px, 0px), var(--py, 0px))`;
      });

      requestAnimationFrame(animateOrbs);
    }
    animateOrbs();
  }

  /* =============================================
     3. SERVICE CARD FLIP
     ============================================= */
  document.querySelectorAll('[data-flip]').forEach((card) => {
    card.addEventListener('click', () => {
      card.classList.toggle('flipped');
    });
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.classList.toggle('flipped');
      }
    });
  });

  /* =============================================
     4. 3D CARD TILT
     ============================================= */
  const enableCardTilt = false;
  if (enableCardTilt && !isTouchDevice && !prefersReducedMotion) {
    document.querySelectorAll('[data-tilt]').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const cx   = rect.left + rect.width  / 2;
        const cy   = rect.top  + rect.height / 2;
        const dx   = (e.clientX - cx) / (rect.width  / 2);  // -1 → +1
        const dy   = (e.clientY - cy) / (rect.height / 2);  // -1 → +1
        const rotX = -dy * 8;  // max ±8deg
        const rotY =  dx * 8;
        card.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-4px)`;
        card.style.transition = 'transform 0.1s ease';
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
        card.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
      });
    });
  }

  /* =============================================
     4. SCROLL REVEAL
     ============================================= */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach((el) => {
    if (prefersReducedMotion) {
      el.classList.add('revealed');
    } else {
      revealObserver.observe(el);
    }
  });

  /* =============================================
     5. COUNTER ANIMATION
     ============================================= */
  function animateCounter(el) {
    const target = parseInt(el.dataset.target, 10);
    const suffix = el.dataset.suffix || '';
    if (isNaN(target)) return;

    const duration = 1500;
    const start = performance.now();

    function easeOut(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function frame(now) {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const value    = Math.round(easeOut(progress) * target);
      el.textContent = value + suffix;
      if (progress < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const el = entry.target;
        if (!el.dataset.counted) {
          el.dataset.counted = 'true';
          if (prefersReducedMotion) {
            el.textContent = el.dataset.target + (el.dataset.suffix || '');
          } else {
            animateCounter(el);
          }
        }
        counterObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.stat-card__num[data-target]').forEach((el) => {
    counterObserver.observe(el);
  });

  /* =============================================
     6. NAV SCROLL EFFECT
     ============================================= */
  const nav = document.getElementById('nav');
  if (nav) {
    const navLinksWrap = nav.querySelector('.nav__links');
    const navSectionLinks = Array.from(nav.querySelectorAll('.nav__links a[href^="#"]'));
    const navSections = navSectionLinks
      .map((link) => ({
        link,
        section: document.querySelector(link.getAttribute('href')),
      }))
      .filter((item) => item.section);

    let activeNavLink = null;
    let navTicking = false;

    function moveNavBubble(link) {
      if (!navLinksWrap) return;

      if (!link) {
        navLinksWrap.style.setProperty('--bubble-opacity', '0');
        return;
      }

      const linkRect = link.getBoundingClientRect();
      const wrapRect = navLinksWrap.getBoundingClientRect();
      const pad = link.classList.contains('btn') ? 2 : 22;

      navLinksWrap.style.setProperty('--bubble-x', `${linkRect.left - wrapRect.left - pad / 2}px`);
      navLinksWrap.style.setProperty('--bubble-w', `${linkRect.width + pad}px`);
      navLinksWrap.style.setProperty('--bubble-opacity', '1');
    }

    function setActiveNavLink(link) {
      if (activeNavLink === link) {
        moveNavBubble(link);
        return;
      }

      navSectionLinks.forEach((item) => {
        item.classList.toggle('is-active', item === link);
        if (item === link) {
          item.setAttribute('aria-current', 'page');
        } else {
          item.removeAttribute('aria-current');
        }
      });

      activeNavLink = link;
      moveNavBubble(link);
    }

    function updateActiveSection() {
      const marker = window.scrollY + window.innerHeight * 0.38;
      const navHeight = nav.offsetHeight || 0;
      let current = null;

      navSections.forEach(({ link, section }) => {
        const top = section.offsetTop - navHeight - 40;
        if (marker >= top) current = link;
      });

      setActiveNavLink(current);
    }

    function updateNavState() {
      nav.classList.toggle('scrolled', window.scrollY > 30);
      updateActiveSection();
      navTicking = false;
    }

    function requestNavUpdate() {
      if (navTicking) return;
      navTicking = true;
      requestAnimationFrame(updateNavState);
    }

    window.addEventListener('scroll', requestNavUpdate, { passive: true });
    window.addEventListener('resize', requestNavUpdate);
    window.addEventListener('load', requestNavUpdate);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(requestNavUpdate);
    }
    requestNavUpdate();
  }

  /* =============================================
     6b. SECTION RAIL — right-side glass dots
     ============================================= */
  (function buildSectionRail() {
    const railSections = [
      { id: 'hero',     label: 'Home' },
      { id: 'tiers',    label: 'Site Types' },
      { id: 'about',    label: 'About' },
      { id: 'services', label: 'Services' },
      { id: 'pricing',  label: 'Pricing' },
      { id: 'work',     label: 'Demos' },
      { id: 'contact',  label: 'Contact' },
    ].filter((s) => document.getElementById(s.id));

    if (railSections.length < 2) return;

    const rail = document.createElement('nav');
    rail.className = 'section-rail';
    rail.setAttribute('aria-label', 'Page sections');

    const dots = railSections.map((s) => {
      const dot = document.createElement('a');
      dot.className = 'rail-dot';
      dot.href = '#' + s.id;
      dot.setAttribute('aria-label', s.label);
      dot.innerHTML =
        '<span class="rail-dot__visual"></span>' +
        '<span class="rail-dot__label">' + s.label + '</span>';
      dot.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.getElementById(s.id);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      rail.appendChild(dot);
      return dot;
    });

    document.body.appendChild(rail);

    let activeIdx = -1;
    let railTicking = false;

    function updateRail() {
      const marker = window.scrollY + window.innerHeight * 0.4;
      let idx = 0;
      railSections.forEach((s, i) => {
        const el = document.getElementById(s.id);
        if (el && marker >= el.offsetTop) idx = i;
      });

      if (idx !== activeIdx) {
        if (dots[activeIdx]) {
          dots[activeIdx].classList.remove('is-active');
          dots[activeIdx].removeAttribute('aria-current');
        }
        dots[idx].classList.add('is-active');
        dots[idx].setAttribute('aria-current', 'true');
        activeIdx = idx;
      }
      railTicking = false;
    }

    function requestRailUpdate() {
      if (railTicking) return;
      railTicking = true;
      requestAnimationFrame(updateRail);
    }

    window.addEventListener('scroll', requestRailUpdate, { passive: true });
    window.addEventListener('resize', requestRailUpdate);
    requestRailUpdate();
  })();

  /* =============================================
     7. MOBILE HAMBURGER
     ============================================= */
  const hamburger  = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', String(isOpen));
      hamburger.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
    });

    mobileMenu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', 'Open menu');
      });
    });
  }

  /* =============================================
     8. CONTACT FORM
     ============================================= */
  // Submissions are handled by a Google Apps Script Web App running in
  // Johann's own Google account (see /docs or the README for the script).
  // Deploy the script as a Web App ("Execute as: me", "Who has access:
  // Anyone") and paste its /exec URL below.
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzz2nnxRH5BczORc8E_-MuGxWttEigxEa8StWSlGHY3R2N-LFSSs7WTXuUMK4ism4TA/exec';

  const form = document.getElementById('contactForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const originalText = btn.textContent;

      btn.textContent = 'Sending…';
      btn.disabled = true;

      try {
        // Apps Script Web Apps don't return CORS headers, so we POST with
        // mode:'no-cors'. The data still reaches the script, but the browser
        // hands back an opaque response we can't read — so a fetch that
        // resolves without throwing means the request went through.
        await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          body: new FormData(form),
          mode: 'no-cors',
        });

        btn.textContent = "Sent! I'll be in touch soon.";
        btn.classList.add('btn--success');
        btn.classList.remove('btn--primary');
        form.reset();
      } catch {
        btn.textContent = 'Network error — please try again.';
        btn.disabled = false;
        setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 5000);
      }
    });
  }

  /* =============================================
     9. MAGNETIC BUTTONS
     ============================================= */
  const enableMagneticButtons = false;
  if (enableMagneticButtons && !isTouchDevice && !prefersReducedMotion) {
    document.querySelectorAll('.magnetic').forEach((btn) => {
      const RANGE    = 60;  // px radius of magnetic field
      const STRENGTH = 0.35; // pull factor

      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const cx   = rect.left + rect.width  / 2;
        const cy   = rect.top  + rect.height / 2;
        const dx   = e.clientX - cx;
        const dy   = e.clientY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < RANGE) {
          const pull = (1 - dist / RANGE) * STRENGTH;
          btn.style.transform = `translate(${dx * pull}px, ${dy * pull}px)`;
        }
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
        btn.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
        // Reset transition after snap-back
        setTimeout(() => { btn.style.transition = ''; }, 500);
      });

      btn.addEventListener('mouseenter', () => {
        btn.style.transition = 'transform 0.15s ease';
      });
    });
  }

})();
