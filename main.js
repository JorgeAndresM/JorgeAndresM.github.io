(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasObserver = 'IntersectionObserver' in window;

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const header = document.getElementById('nav');
  if (header) {
    let ticking = false;
    const update = () => {
      header.classList.toggle('scrolled', window.scrollY > 8);
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  const toggle = document.getElementById('nav-toggle');
  const menu = document.getElementById('nav-menu');
  if (toggle && menu) {
    const setOpen = (open) => {
      menu.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', (event) => {
      if (event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menu.classList.contains('open')) {
        setOpen(false);
        toggle.focus();
      }
    });
    window.matchMedia('(min-width: 861px)').addEventListener('change', (event) => {
      if (event.matches) setOpen(false);
    });
  }

  document.querySelectorAll('[data-stagger]').forEach((parent) => {
    Array.from(parent.children).forEach((child, index) => child.style.setProperty('--i', String(index)));
  });

  const reveals = document.querySelectorAll('.reveal');
  if (hasObserver && !reduceMotion) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    reveals.forEach((el) => revealObserver.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }

  const links = Array.from(document.querySelectorAll('.nav-menu ul a[href^="#"]'));
  if (hasObserver && links.length) {
    const map = new Map();
    links.forEach((link) => {
      const target = document.getElementById(link.getAttribute('href').slice(1));
      if (target) map.set(target, link);
    });
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((link) => link.removeAttribute('aria-current'));
        map.get(entry.target).setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, section) => spy.observe(section));
  }

  const tablist = document.querySelector('[role="tablist"]');
  if (tablist) {
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
    const panels = tabs.map((tab) => document.getElementById(tab.getAttribute('aria-controls')));
    const select = (index, mode) => {
      tabs.forEach((tab, i) => {
        const active = i === index;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        panels[i].hidden = !active;
      });
      if (mode === 'key') tabs[index].focus();
      if (mode) {
        tabs[index].scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(i, 'click'));
      tab.addEventListener('keydown', (event) => {
        const last = tabs.length - 1;
        const targets = {
          ArrowDown: i === last ? 0 : i + 1,
          ArrowRight: i === last ? 0 : i + 1,
          ArrowUp: i === 0 ? last : i - 1,
          ArrowLeft: i === 0 ? last : i - 1,
          Home: 0,
          End: last
        };
        if (event.key in targets) {
          event.preventDefault();
          select(targets[event.key], 'key');
        }
      });
    });
    select(0, null);
  }

  const form = document.getElementById('contact-form');
  if (form) {
    const status = form.querySelector('.form-status');
    const button = form.querySelector('button[type="submit"]');
    const endpoint = form.getAttribute('action') || '';
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const nameField = form.elements.namedItem('nombre');
    const emailField = form.elements.namedItem('email');
    const trapField = form.elements.namedItem('_gotcha');

    const setStatus = (message, state) => {
      status.textContent = message;
      status.dataset.state = state || '';
    };
    const mark = (field, invalid) => field.setAttribute('aria-invalid', invalid ? 'true' : 'false');

    [nameField, emailField].forEach((field) => {
      field.addEventListener('input', () => {
        if (field.getAttribute('aria-invalid') === 'true') mark(field, false);
      });
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const invalidName = nameField.value.trim().length < 2;
      const invalidEmail = !emailPattern.test(emailField.value.trim());
      mark(nameField, invalidName);
      mark(emailField, invalidEmail);

      if (invalidName || invalidEmail) {
        setStatus('Revisa los campos marcados.', 'error');
        (invalidName ? nameField : emailField).focus();
        return;
      }

      if (trapField && trapField.value) return;

      if (!endpoint) {
        setStatus('El formulario no está conectado a un servicio de envío.', 'error');
        return;
      }

      button.disabled = true;
      setStatus('Enviando...', '');

      const payload = new FormData(form);
      const needs = payload.getAll('necesidad');
      payload.delete('necesidad');
      if (needs.length) payload.set('necesidad', needs.join(', '));

      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          body: payload,
          headers: { Accept: 'application/json' },
          signal: controller.signal
        });

        if (response.status === 422) {
          const detail = await response.json().catch(() => null);
          const emailRejected = Boolean(detail && Array.isArray(detail.errors) && detail.errors.some((item) => item.field === 'email'));
          if (emailRejected) {
            mark(emailField, true);
            emailField.focus();
          }
          setStatus(emailRejected ? 'El email ingresado no es válido.' : 'Revisa los datos ingresados.', 'error');
          return;
        }

        if (!response.ok) throw new Error(String(response.status));

        form.reset();
        setStatus('Mensaje enviado. Te contactaremos dentro de 1 a 2 días hábiles.', 'ok');
      } catch {
        setStatus('No pudimos enviar el mensaje. Inténtalo nuevamente en unos minutos.', 'error');
      } finally {
        window.clearTimeout(timer);
        button.disabled = false;
      }
    });
  }
})();
