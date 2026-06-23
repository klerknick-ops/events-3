// Inline script (runs before paint) to set the initial theme from localStorage
// or the OS preference, avoiding a flash of the wrong theme. Kept in a plain
// module (not the client component) so the server layout can import it without
// tripping Fast Refresh's "non-component export" full reload.
export const themeInitScript = `
(function(){try{
  var t = localStorage.getItem('theme');
  if(!t){ t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  if(t === 'dark'){ document.documentElement.classList.add('dark'); }
}catch(e){}})();
`;
