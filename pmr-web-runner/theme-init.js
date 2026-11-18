(function () {
  try {
    var savedTheme = window.localStorage.getItem('pmr_options_theme');
    var resolved = savedTheme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', resolved);
  } catch (err) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
