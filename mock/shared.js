(function () {
  'use strict';

  /* Hamburger nav toggle */
  var hamburger = document.getElementById('hamburger');
  var mobileMenu = document.getElementById('mobileMenu');

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', function () {
      var isOpen = mobileMenu.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', String(isOpen));
      hamburger.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
    });

    mobileMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mobileMenu.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', 'Open menu');
      });
    });
  }

  /* Booking form submit handler (Velour Studio) */
  var bookingForm = document.getElementById('bookingForm');
  if (bookingForm) {
    bookingForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = bookingForm.querySelector('button[type="submit"]');
      btn.textContent = 'Sending…';
      btn.disabled = true;
      setTimeout(function () {
        btn.textContent = "Request received! We'll confirm your slot soon.";
        btn.classList.add('btn--booking-success');
        bookingForm.reset();
      }, 900);
    });
  }

})();
