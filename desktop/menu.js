(function () {
  const api = window.menu;
  if (!api) return;

  const el = {
    mode: document.getElementById('t-mode'),
    locked: document.getElementById('t-locked'),
    autoStart: document.getElementById('t-autoStart')
  };

  function setToggle(key, on) {
    el[key].classList.toggle('on', on);
  }

  function renderState(s) {
    setToggle('mode', s.mode === 'top');
    setToggle('locked', !!s.locked);
    setToggle('autoStart', !!s.autoStart);
  }

  document.querySelectorAll('.row').forEach((row) => {
    row.addEventListener('click', () => {
      const key = row.dataset.key;
      const on = el[key].classList.contains('on');
      setToggle(key, !on);
      api.set(key, !on);
    });
  });

  document.getElementById('settingsBtn').addEventListener('click', () => {
    api.openSettings();
    api.close();
  });
  document.getElementById('quitBtn').addEventListener('click', () => api.quit());

  api.getState().then(renderState).catch(() => {});
})();
