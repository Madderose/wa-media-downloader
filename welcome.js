document.addEventListener('DOMContentLoaded', () => {
  const skipBtn = document.getElementById('skipBtn');
  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      window.close();
    });
  }
});
