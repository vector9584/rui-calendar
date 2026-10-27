(function () {
  const api = window.ycal;
  if (!api) return;

  const modeTop = document.getElementById('modeTop');
  const locked = document.getElementById('locked');
  const opacityInput = document.getElementById('opacity');
  const opacityValue = document.getElementById('opacityValue');
  const autoStart = document.getElementById('autoStart');
  const closeBtn = document.getElementById('closeBtn');
  const doneBtn = document.getElementById('doneBtn');

  function render(s) {
    modeTop.checked = (s.mode === 'top');
    locked.checked = !!s.locked;
    const pct = Math.round(s.opacity * 100);
    opacityInput.value = pct;
    opacityValue.textContent = pct + '%';
    autoStart.checked = !!s.autoStart;
  }

  modeTop.addEventListener('change', () => {
    api.updateSettings({ mode: modeTop.checked ? 'top' : 'desktop' });
  });

  locked.addEventListener('change', () => {
    api.updateSettings({ locked: locked.checked });
  });

  opacityInput.addEventListener('input', () => {
    const pct = parseInt(opacityInput.value, 10);
    opacityValue.textContent = pct + '%';
  });
  opacityInput.addEventListener('change', () => {
    const pct = parseInt(opacityInput.value, 10);
    api.updateSettings({ opacity: pct / 100 });
  });

  autoStart.addEventListener('change', () => {
    api.updateSettings({ autoStart: autoStart.checked });
  });

  closeBtn.addEventListener('click', () => api.closeSettings());
  doneBtn.addEventListener('click', () => api.closeSettings());

  api.getSettings().then(render).catch(() => {});
})();
