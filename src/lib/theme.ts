// Light/dark theme: the storage key and the script that applies the theme before the page paints.
export const THEME_KEY = "insightflow:theme";

// Runs in the page head before anything is painted, so a dark-mode user never sees a white flash.
// A saved choice wins; otherwise the computer's own light or dark setting is followed.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;
