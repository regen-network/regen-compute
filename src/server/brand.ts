/**
 * Shared Regen Network brand system.
 *
 * Exports helpers that inject brand-consistent fonts, CSS custom properties,
 * component classes, header, and footer into any server-rendered HTML page.
 *
 * Dark theme design system — all pages inherit from this single file.
 */

// ---------------------------------------------------------------------------
// Regen Network logo SVG (wordmark + geometric mark)
// Source: regen-network/regen-web RegenIcon.tsx
// ---------------------------------------------------------------------------

export const regenLogoSVG = `<svg width="186" height="84" viewBox="0 0 186 84" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Regen Network">
  <g clip-path="url(#rn-clip)">
    <path d="M39.83 27.32V27.37L34.98 1.8L30.97.52 28.44 3.92 39.83 27.32Z" fill="currentColor"/>
    <path d="M42.46 16.65L44.52 26.55 46.73 16.5 44.57 15.05 42.46 16.65Z" fill="currentColor"/>
    <path d="M57.76 18.4L55.13 18.66 52.04 28.46 58.84 20.78 57.76 18.4Z" fill="currentColor"/>
    <path d="M80.22 20.47V16.29L76.15 15 57.09 32.89 80.22 20.47Z" fill="currentColor"/>
    <path d="M33.64 31.03L27.98 22.53 28.08 22.73 27.98 22.53 25.4 22.94 24.99 25.52 33.64 31.03Z" fill="currentColor"/>
    <path d="M70.12 39.7L59.97 41.71 70.12 43.92 71.67 41.81 70.12 39.7Z" fill="currentColor"/>
    <path d="M29.11 41.76L3.04 38.46.52 41.86 3.04 45.26 29.11 41.76Z" fill="currentColor"/>
    <path d="M19.48 47.43L18.7 49.85 20.82 51.4 29.83 46.35 19.48 47.43Z" fill="currentColor"/>
    <path d="M22.46 54.59L22.36 57.17 24.83 58.05 32.05 50.47 22.46 54.59Z" fill="currentColor"/>
    <path d="M35.45 53.98L27.77 60.73 28.44 63.2 31.07 63.31 35.45 53.98Z" fill="currentColor"/>
    <path d="M44.57 56.97L42.51 66.97 44.62 68.46 46.73 66.92 44.57 56.97Z" fill="currentColor"/>
    <path d="M80.27 63.05L57.09 50.73 76.25 68.51 80.27 67.22V63.05Z" fill="currentColor"/>
    <path d="M54.72 64.96L49.51 56.24 50.7 66.25 53.17 67.02 54.72 64.96Z" fill="currentColor"/>
    <path d="M39.88 56.24L28.6 79.7 31.12 83.1 35.14 81.81 39.88 56.24Z" fill="currentColor"/>
    <path d="M114.33 33.2C115 32.99 115.57 32.68 116.03 32.27 117.11 31.4 117.68 30.11 117.68 28.41 117.68 26.86 117.11 25.62 116.03 24.69 114.95 23.77 113.4 23.3 111.39 23.3H103.46V39.95H107.74V33.82H110.36L113.92 39.9H118.71L114.33 33.2ZM107.74 26.5H110.83C111.65 26.5 112.32 26.65 112.73 27.01 113.15 27.37 113.35 27.89 113.35 28.61 113.35 29.33 113.15 29.9 112.73 30.21 112.32 30.57 111.7 30.73 110.83 30.73H107.74V26.5Z" fill="currentColor"/>
    <path d="M134.12 36.55H125.15V33.15H132V30H125.15V26.6H133.76V23.25H120.77V39.9H134.12V36.55Z" fill="currentColor"/>
    <path d="M143.96 33.82H147.77V34.08C147.77 34.54 147.67 34.95 147.51 35.31 147.36 35.67 147.1 35.93 146.79 36.19 146.48 36.45 146.12 36.6 145.71 36.71 145.3 36.81 144.83 36.86 144.37 36.86 143.44 36.86 142.72 36.65 142.1 36.29 141.48 35.93 141.02 35.31 140.71 34.54 140.4 33.77 140.25 32.79 140.25 31.6 140.25 30.47 140.4 29.54 140.71 28.77 141.02 27.99 141.48 27.43 142.05 27.01 142.62 26.6 143.34 26.4 144.16 26.4 144.99 26.4 145.66 26.6 146.22 26.96 146.79 27.37 147.15 27.99 147.41 28.82L151.43 27.22C150.81 25.73 149.88 24.64 148.75 23.97 147.56 23.3 146.07 22.94 144.16 22.94 142.46 22.94 140.97 23.3 139.73 23.97 138.5 24.64 137.52 25.67 136.85 26.91 136.18 28.2 135.82 29.75 135.82 31.55 135.82 33.41 136.13 34.95 136.8 36.24 137.41 37.53 138.34 38.51 139.47 39.13 140.61 39.8 141.95 40.11 143.44 40.11 144.88 40.11 146.07 39.8 147 39.18 147.56 38.82 147.98 38.3 148.34 37.74L148.49 39.85H151.43V30.93H143.91V33.82H143.96Z" fill="currentColor"/>
    <path d="M168.02 36.55H159.05V33.15H165.96V30H159.05V26.6H167.71V23.25H154.73V39.9H168.02V36.55Z" fill="currentColor"/>
    <path d="M185.64 39.9V23.25H181.78V31.65L181.88 34.75 180.59 32.27 175.44 23.25H170.59V39.9H174.46V31.5L174.36 28.41 175.64 30.88 180.8 39.9H185.64Z" fill="currentColor"/>
    <path d="M111.34 56.66L111.45 58.51H111.39L110.16 56.19 105.37 48.51H103.61V60.06H104.95V51.91L104.85 50.06H104.9L106.14 52.33 110.93 60.06H112.68V48.51H111.34V56.66Z" fill="currentColor"/>
    <path d="M117.42 54.85H122.63V53.56H117.42V49.8H124.12V48.51H115.98V60.06H124.38V58.77H117.42V54.85Z" fill="currentColor"/>
    <path d="M125.36 49.8H129.38V60.06H130.82V49.8H134.84V48.51H125.36V49.8Z" fill="currentColor"/>
    <path d="M146.89 58.98L144.16 48.51H142.57L139.84 58.98 137.05 48.51H135.56L138.96 60.06H140.71L142.72 52.58 143.34 49.95 143.96 52.58 145.97 60.06H147.72L151.12 48.51H149.68L146.89 58.98Z" fill="currentColor"/>
    <path d="M157.71 48.31C154.42 48.31 152.36 50.63 152.36 54.29 152.36 57.95 154.42 60.27 157.71 60.27 161.01 60.27 163.07 57.95 163.07 54.29 163.07 50.63 160.96 48.31 157.71 48.31ZM157.71 58.93C155.29 58.93 153.85 57.17 153.85 54.29 153.85 51.4 155.34 49.65 157.71 49.65 160.14 49.65 161.58 51.4 161.58 54.29 161.58 57.17 160.08 58.93 157.71 58.93Z" fill="currentColor"/>
    <path d="M173.94 51.86C173.94 49.8 172.4 48.46 170.03 48.46H165.65V60.01H167.04V55.21H169.82L172.97 60.01H174.61L171.37 55.06C172.97 54.7 173.94 53.51 173.94 51.86ZM167.04 53.92V49.8H169.98C171.63 49.8 172.45 50.47 172.45 51.86 172.45 53.25 171.63 53.92 169.98 53.92H167.04Z" fill="currentColor"/>
    <path d="M181.26 53.2L185.9 48.51H184.04L178.22 54.44V48.51H176.83V60.06H178.22V56.35L180.28 54.23 184.25 60.06H185.95L181.26 53.2Z" fill="currentColor"/>
  </g>
  <defs><clipPath id="rn-clip"><rect width="185.43" height="82.59" fill="white" transform="translate(0.52 0.52)"/></clipPath></defs>
</svg>`;

// ---------------------------------------------------------------------------
// Regen Network logo PNG (horizontal, black on transparent, 360x161 2x retina)
// Used in emails — most email clients (Gmail, Outlook) block SVG images.
// Resized from 1441x645 original for email use (displayed at 120px width).
// ---------------------------------------------------------------------------

export const regenLogoPNG = Buffer.from(
  "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",
  "base64"
);

// ---------------------------------------------------------------------------
// Google Fonts link tags
// ---------------------------------------------------------------------------

export function brandFonts(): string {
  return `<link rel="icon" href="https://app.regen.network/favicon.ico" type="image/x-icon">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800&family=Source+Serif+4:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Lato:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<script>
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',wait_for_update:500});
if(localStorage.getItem('regen_consent')==='granted'){gtag('consent','update',{analytics_storage:'granted'});}
gtag('js',new Date());gtag('config','G-CGCVGY357V');
</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-CGCVGY357V"></script>`;
}

// ---------------------------------------------------------------------------
// CSS custom properties + shared component classes (dark theme)
// ---------------------------------------------------------------------------

export function brandCSS(): string {
  return `
    /* ---- Dark Design System Tokens ---- */
    :root {
      /* Backgrounds */
      --color-void: #05060A;
      --color-surface: #0A0C12;
      --color-card: #0E1018;
      --color-card-hover: #141620;
      --color-glass: rgba(10,12,18,0.85);

      /* Text */
      --color-cream: #F0ECE2;
      --color-cream-soft: #D4D0C8;
      --color-muted: #A8ADBC;
      --color-dim: #7A8194;

      /* Accent — Gaia green */
      --color-emerald: #2b994f;
      --color-emerald-bright: #33b35c;
      --color-emerald-glow: rgba(43,153,79,0.2);
      --color-emerald-dim: rgba(43,153,79,0.08);

      /* Credit types */
      --color-carbon: #22C55E;
      --color-biodiversity: #FBBF24;
      --color-species: #FB923C;
      --color-grazing: #D4A574;

      /* Borders */
      --color-border: rgba(240,236,226,0.07);
      --color-border-light: rgba(240,236,226,0.12);
      --color-border-emerald: rgba(43,153,79,0.25);

      /* Typography */
      --font-display: 'Playfair Display', serif;
      --font-body: 'Source Serif 4', serif;
      --font-ui: 'Lato', sans-serif;
      --font-mono: 'JetBrains Mono', monospace;

      /* Backward compat aliases */
      --regen-green: #2b994f;
      --regen-green-light: #33b35c;
      --regen-green-bg: rgba(43,153,79,0.08);
      --regen-navy: #F0ECE2;
      --regen-white: #05060A;
      --regen-black: #F0ECE2;
      --regen-gray-50: #0A0C12;
      --regen-gray-100: #0E1018;
      --regen-gray-200: rgba(240,236,226,0.07);
      --regen-gray-300: rgba(240,236,226,0.12);
      --regen-gray-400: #7A8194;
      --regen-gray-500: #A8ADBC;
      --regen-gray-700: #D4D0C8;
      --regen-teal: #33b35c;
      --regen-sage: #2b994f;
      --regen-radius: 12px;
      --regen-radius-lg: 16px;
      --regen-font-primary: var(--font-body);
      --regen-font-secondary: var(--font-ui);
      --regen-shadow-card: 0 4px 24px rgba(0,0,0,0.3);
      --regen-shadow-card-hover: 0 8px 32px rgba(43,153,79,0.15), 0 2px 8px rgba(0,0,0,0.3);
    }

    /* ---- Base reset ---- */
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: var(--font-body);
      margin: 0; padding: 0;
      color: var(--color-cream);
      line-height: 1.6;
      background: var(--color-void);
      -webkit-font-smoothing: antialiased;
    }
    a { color: var(--color-emerald); text-decoration: none; }
    a:hover { color: var(--color-emerald-bright); text-decoration: none; }

    /* ---- Layout ---- */
    .regen-container { max-width: 900px; margin: 0 auto; padding: 0 24px; }
    .regen-container--narrow { max-width: 640px; margin: 0 auto; padding: 0 24px; }

    /* ---- Brand header (dark, fixed) ---- */
    .regen-header {
      position: fixed; top: 0; left: 0; right: 0; z-index: 50;
      background: rgba(5,6,10,0.7);
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--color-border);
    }
    .regen-header__inner {
      margin: 0; padding: 0 24px;
      display: flex; align-items: center; justify-content: space-between;
      height: 56px;
    }
    .regen-header__logo { color: var(--color-cream); display: flex; align-items: center; text-decoration: none; }
    .regen-header__logo:hover { color: var(--color-cream); }
    .regen-header__logo svg { height: 32px; width: auto; }
    .regen-header__nav { display: flex; align-items: center; gap: 20px; }
    .regen-header__nav a {
      font-family: var(--font-ui);
      font-size: 13px; font-weight: 500; color: var(--color-muted);
      text-decoration: none; transition: color 0.2s;
    }
    .regen-header__nav a:hover { color: var(--color-cream); text-decoration: none; }
    .regen-header__badge {
      font-size: 12px; font-weight: 700; color: var(--color-emerald);
      background: var(--color-emerald-dim); padding: 4px 12px; border-radius: 20px;
      letter-spacing: 0.03em;
    }
    .regen-header__nav a.regen-header__subscribe {
      font-family: var(--font-ui);
      font-size: 13px; font-weight: 800;
      background: var(--color-emerald); color: #FFFFFF !important;
      border: none; border-radius: 6px;
      padding: 7px 18px; cursor: pointer;
      text-decoration: none; transition: all 0.2s;
      letter-spacing: 0.03em;
    }
    .regen-header__nav a.regen-header__subscribe:hover {
      background: var(--color-emerald-bright); color: #FFFFFF !important; text-decoration: none;
      box-shadow: 0 2px 16px var(--color-emerald-glow);
    }

    /* ---- Hamburger menu (mobile) ---- */
    .regen-hamburger {
      display: none; background: none; border: none; cursor: pointer; padding: 8px;
      color: var(--color-cream); flex-direction: column; justify-content: center; gap: 5px;
    }
    .regen-hamburger span {
      display: block; width: 22px; height: 2px; background: currentColor;
      border-radius: 1px; transition: transform 0.2s, opacity 0.2s;
    }
    .regen-hamburger.active span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
    .regen-hamburger.active span:nth-child(2) { opacity: 0; }
    .regen-hamburger.active span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
    .regen-mobile-nav {
      display: none; flex-direction: column; background: var(--color-surface);
      border-bottom: 1px solid var(--color-border);
      padding: 8px 24px 16px;
    }
    .regen-mobile-nav.open { display: flex; }
    .regen-mobile-nav a, .regen-mobile-nav .lang-picker {
      font-family: var(--font-ui);
      font-size: 15px; font-weight: 500; color: var(--color-muted);
      padding: 12px 0; border-bottom: 1px solid var(--color-border);
      text-decoration: none;
    }
    .regen-mobile-nav a:last-child, .regen-mobile-nav .lang-picker { border-bottom: none; }
    .regen-mobile-nav a:hover { color: var(--color-cream); }

    /* ---- Brand footer (dark) ---- */
    .regen-footer {
      padding: 40px 24px 32px; text-align: center;
      border-top: 1px solid var(--color-border);
      margin-top: 48px; background: var(--color-void);
    }
    .regen-footer__logo { color: var(--color-dim); margin-bottom: 12px; }
    .regen-footer__logo svg { height: 28px; width: auto; opacity: 0.5; }
    .regen-footer__nav {
      display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 20px;
      font-family: var(--font-ui); font-size: 13px;
      color: var(--color-muted); margin-bottom: 14px;
    }
    .regen-footer__nav a {
      color: var(--color-muted); text-decoration: none; transition: color 0.2s;
      display: inline-flex; align-items: center; gap: 5px;
    }
    .regen-footer__nav a:hover { color: var(--color-emerald); }
    .regen-footer__social { margin-bottom: 12px; }
    .regen-footer__social a:hover { color: var(--color-emerald); }
    .regen-footer__note {
      font-family: var(--font-ui);
      font-size: 12px; color: var(--color-dim);
      margin-bottom: 8px;
    }
    .regen-footer__note a { color: var(--color-emerald); text-decoration: none; }
    .regen-footer__note a:hover { text-decoration: underline; }
    .regen-footer__legal {
      font-family: var(--font-ui);
      font-size: 11px; color: var(--color-dim);
    }
    .regen-footer__legal a { color: var(--color-dim); text-decoration: none; }
    .regen-footer__legal a:hover { color: var(--color-emerald); }
    .regen-footer__install {
      font-family: var(--font-mono);
      font-size: 11px; color: var(--color-muted);
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: 6px;
      padding: 8px 14px; display: inline-block; margin-top: 8px;
    }
    /* Links row kept for backward compat but hidden if nav is present */
    .regen-footer__links { font-size: 13px; color: var(--color-muted); margin-bottom: 8px; }
    .regen-footer__links a { color: var(--color-emerald); margin: 0 8px; }

    /* ---- Partners section in footer ---- */
    .regen-footer__partners {
      display: flex; justify-content: center; align-items: center; gap: 24px;
      margin-bottom: 20px; flex-wrap: wrap;
    }
    .regen-footer__partners-label {
      font-family: var(--font-ui); font-size: 11px; font-weight: 600;
      color: var(--color-dim); text-transform: uppercase; letter-spacing: 0.1em;
    }
    .regen-footer__partner {
      display: inline-flex; align-items: center; gap: 6px;
      font-family: var(--font-ui); font-size: 13px; font-weight: 500;
      color: var(--color-muted); text-decoration: none;
      padding: 6px 14px; border-radius: 8px;
      border: 1px solid var(--color-border);
      background: var(--color-card);
      transition: border-color 0.2s, color 0.2s;
    }
    .regen-footer__partner:hover {
      border-color: var(--color-border-light); color: var(--color-cream);
      text-decoration: none;
    }

    /* ---- Buttons ---- */
    .regen-btn {
      display: inline-block; padding: 12px 28px;
      font-family: var(--font-ui);
      font-size: 15px; font-weight: 700;
      border-radius: 8px; border: 2px solid transparent;
      cursor: pointer; transition: all 0.3s ease;
      text-decoration: none; text-align: center;
    }
    .regen-btn:hover { text-decoration: none; }

    .regen-btn--primary {
      background: var(--color-emerald); color: #000;
      border: 2px solid var(--color-emerald);
    }
    .regen-btn--primary:hover {
      background: var(--color-emerald-bright);
      color: #000; border-color: var(--color-emerald-bright);
    }

    .regen-btn--solid {
      background: var(--color-emerald); color: #000; border: none;
    }
    .regen-btn--solid:hover {
      background: var(--color-emerald-bright);
    }

    .regen-btn--secondary {
      background: var(--color-emerald-dim); color: var(--color-emerald);
      border: 1px solid var(--color-border-emerald);
    }
    .regen-btn--secondary:hover {
      background: var(--color-emerald-glow);
      color: var(--color-emerald-bright);
    }

    .regen-btn--dark {
      background: var(--color-surface); color: var(--color-cream);
      border: 1px solid var(--color-border);
    }
    .regen-btn--dark:hover { background: var(--color-card); }

    .regen-btn--outline {
      background: transparent; color: var(--color-emerald);
      border: 2px solid var(--color-emerald);
    }
    .regen-btn--outline:hover {
      background: var(--color-emerald-dim);
    }

    .regen-btn--sm { padding: 8px 18px; font-size: 13px; }
    .regen-btn--block { display: block; width: 100%; }

    /* ---- Cards ---- */
    .regen-card {
      background: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: var(--regen-radius-lg);
      box-shadow: var(--regen-shadow-card);
      overflow: hidden;
      transition: box-shadow 0.3s ease, transform 0.3s ease, border-color 0.3s ease;
    }
    .regen-card:hover {
      box-shadow: var(--regen-shadow-card-hover);
      border-color: var(--color-border-light);
    }
    .regen-card--interactive:hover {
      transform: translateY(-3px);
    }
    .regen-card__body { padding: 28px 32px; }
    .regen-card__header {
      background: linear-gradient(135deg, var(--color-emerald), var(--color-emerald-bright));
      color: #000; padding: 32px; text-align: center;
    }

    /* ---- Hero section ---- */
    .regen-hero {
      padding: 72px 0 56px; text-align: center;
      background: transparent;
    }
    .regen-hero__label {
      display: inline-block;
      font-family: var(--font-ui);
      font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
      color: var(--color-emerald); background: var(--color-emerald-dim);
      padding: 5px 14px; border-radius: 20px; margin-bottom: 16px;
    }
    .regen-hero h1 {
      font-family: var(--font-display);
      font-size: 42px; font-weight: 800; color: var(--color-cream);
      margin: 0 0 16px; line-height: 1.15; letter-spacing: -0.02em;
    }
    .regen-hero h1 span {
      background: linear-gradient(180deg, var(--color-emerald-bright), var(--color-emerald));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .regen-hero p {
      font-size: 18px; color: var(--color-muted);
      max-width: 560px; margin: 0 auto 28px;
    }

    /* ---- Section titles ---- */
    .regen-section-title {
      font-family: var(--font-display);
      font-size: 28px; font-weight: 800; color: var(--color-cream);
      margin: 0 0 16px; letter-spacing: -0.01em;
    }
    .regen-section-subtitle {
      font-size: 15px; color: var(--color-muted); margin: 0 0 28px;
    }

    /* ---- Stats cards ---- */
    .regen-stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 16px; margin-bottom: 32px;
    }
    .regen-stat-card {
      background: var(--color-card); border: 1px solid var(--color-border);
      border-radius: var(--regen-radius); padding: 20px; text-align: center;
      transition: box-shadow 0.3s ease, border-color 0.3s ease;
    }
    .regen-stat-card:hover {
      box-shadow: var(--regen-shadow-card-hover);
      border-color: var(--color-border-light);
    }
    .regen-stat-card--green { border-left: 4px solid var(--color-emerald); }
    .regen-stat-card--teal { border-left: 4px solid var(--color-emerald-bright); }
    .regen-stat-card--sage { border-left: 4px solid var(--color-emerald); }
    .regen-stat-card--navy { border-left: 4px solid var(--color-cream); }
    .regen-stat-card--muted { border-left: 4px solid var(--color-muted); }
    .regen-stat-value {
      font-family: var(--font-display);
      font-size: 28px; font-weight: 800; color: var(--color-cream);
      letter-spacing: -0.02em;
    }
    .regen-stat-label {
      font-family: var(--font-ui);
      font-size: 12px; color: var(--color-muted); margin-top: 4px;
      text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;
    }

    /* ---- Pricing tiers ---- */
    .regen-tiers {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px; margin: 28px 0;
    }
    .regen-tier {
      background: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: var(--regen-radius-lg); padding: 28px;
      text-align: center; text-decoration: none; color: var(--color-cream);
      transition: all 0.3s ease; display: block;
    }
    .regen-tier:hover {
      border-color: var(--color-border-emerald);
      box-shadow: var(--regen-shadow-card-hover);
      transform: translateY(-3px); text-decoration: none;
    }
    .regen-tier__name {
      font-weight: 800; font-size: 18px; color: var(--color-emerald); margin-bottom: 4px;
    }
    .regen-tier__price {
      font-family: var(--font-display);
      font-size: 32px; font-weight: 800; color: var(--color-cream); margin: 8px 0;
    }
    .regen-tier__price span {
      font-size: 16px; font-weight: 500; color: var(--color-muted);
    }
    .regen-tier__desc {
      font-size: 14px; color: var(--color-muted); line-height: 1.5; margin-bottom: 16px;
    }

    /* ---- Forms ---- */
    .regen-input {
      width: 100%; padding: 12px 14px;
      border: 1px solid var(--color-border-light); border-radius: 8px;
      font-family: var(--font-body);
      font-size: 15px; color: var(--color-cream);
      background: var(--color-surface);
      outline: none; transition: border-color 0.2s;
    }
    .regen-input:focus { border-color: var(--color-emerald); }
    .regen-input::placeholder { color: var(--color-dim); }
    .regen-label {
      font-size: 14px; font-weight: 600; color: var(--color-cream-soft);
      display: block; margin-bottom: 6px;
    }

    /* ---- Alert boxes ---- */
    .regen-alert { border-radius: 8px; padding: 14px 16px; font-size: 14px; margin-bottom: 16px; }
    .regen-alert--error {
      background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.3);
      color: #fca5a5;
    }
    .regen-alert--success {
      background: var(--color-emerald-dim); border: 1px solid var(--color-border-emerald);
      color: var(--color-emerald-bright);
    }
    .regen-alert--info {
      background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.3);
      color: #93c5fd;
    }

    /* ---- Info box ---- */
    .regen-info-box {
      background: var(--color-emerald-dim); border-left: 4px solid var(--color-emerald);
      padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 20px 0;
      font-size: 15px; color: var(--color-cream-soft);
    }

    /* ---- Code/pre ---- */
    .regen-code {
      background: var(--color-surface); padding: 2px 8px; border-radius: 4px;
      font-family: var(--font-mono);
      font-size: 13px; color: var(--color-emerald);
      border: 1px solid var(--color-border);
    }
    .regen-pre {
      background: var(--color-surface); color: var(--color-cream-soft);
      padding: 16px 18px; border-radius: 10px;
      overflow-x: auto; font-size: 13px; margin: 8px 0 16px;
      font-family: var(--font-mono);
      border: 1px solid var(--color-border);
    }

    /* ---- API key display ---- */
    .regen-api-key {
      font-family: var(--font-mono);
      font-size: 13px; background: var(--color-surface);
      border: 1px solid var(--color-border);
      padding: 10px 14px; border-radius: 8px;
      color: var(--color-cream);
      word-break: break-all; display: block; margin: 8px 0;
      user-select: all;
    }

    /* ---- Tables ---- */
    .regen-table { width: 100%; border-collapse: collapse; }
    .regen-table th {
      font-family: var(--font-ui);
      font-size: 11px; font-weight: 700; color: var(--color-muted);
      text-transform: uppercase; letter-spacing: 0.05em;
      text-align: left; padding: 12px 16px;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface);
    }
    .regen-table td {
      font-size: 14px; padding: 12px 16px;
      border-bottom: 1px solid var(--color-border);
      color: var(--color-cream-soft);
    }
    .regen-table tr:last-child td { border-bottom: none; }
    .regen-table td a { color: var(--color-emerald); font-weight: 600; }

    /* ---- Share buttons ---- */
    .regen-share-btns {
      display: flex; gap: 10px; justify-content: center;
      flex-wrap: wrap; margin-top: 16px;
    }
    .regen-share-btn {
      display: inline-block; padding: 10px 20px;
      font-family: var(--font-ui);
      font-size: 14px; font-weight: 600;
      border-radius: 8px; text-decoration: none; color: #fff;
      transition: opacity 0.2s; cursor: pointer; border: none;
    }
    .regen-share-btn:hover { opacity: 0.88; text-decoration: none; }
    .regen-share-btn--x { background: var(--color-cream); color: var(--color-void); }
    .regen-share-btn--linkedin { background: #0a66c2; }
    .regen-share-btn--copy { background: var(--color-muted); }

    /* ---- Referral box ---- */
    .regen-referral-box {
      background: var(--color-emerald-dim); border: 2px solid var(--color-emerald);
      border-radius: var(--regen-radius-lg); padding: 28px; margin: 28px 0;
      text-align: center;
    }
    .regen-referral-box h2 { color: var(--color-emerald); margin: 0 0 8px; font-size: 20px; }
    .regen-referral-box p { color: var(--color-muted); margin: 4px 0 16px; }
    .regen-ref-link {
      font-family: var(--font-mono);
      font-size: 14px; background: var(--color-surface);
      border: 1px solid var(--color-border-emerald); padding: 10px 14px;
      border-radius: 8px; display: block; margin: 12px 0;
      color: var(--color-cream);
      word-break: break-all; cursor: pointer; user-select: all;
    }

    /* ---- Badges grid ---- */
    .regen-badges-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 12px;
    }
    .regen-badge {
      background: var(--color-card); border: 1px solid var(--color-border);
      border-radius: var(--regen-radius); padding: 16px; text-align: center;
      transition: transform 0.2s, box-shadow 0.3s, border-color 0.3s;
    }
    .regen-badge:hover {
      transform: translateY(-2px);
      box-shadow: var(--regen-shadow-card-hover);
      border-color: var(--color-border-light);
    }
    .regen-badge svg { margin-bottom: 8px; }
    .regen-badge__name { font-size: 13px; font-weight: 700; color: var(--color-cream); margin-bottom: 2px; }
    .regen-badge__desc { font-size: 11px; color: var(--color-muted); }

    /* ---- Referral banner ---- */
    .regen-ref-banner {
      background: linear-gradient(135deg, var(--color-emerald), var(--color-emerald-bright));
      color: #000; text-align: center;
      padding: 10px 16px; font-size: 14px; font-weight: 600;
    }
    .regen-ref-banner span { opacity: 0.85; }

    /* ---- Proof/data section ---- */
    .regen-proof-section {
      margin-top: 24px; padding: 16px 20px;
      background: var(--color-surface); border-radius: 10px;
      border: 1px solid var(--color-border);
    }
    .regen-proof-title {
      font-family: var(--font-ui);
      font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; color: var(--color-muted); margin-bottom: 10px;
    }
    .regen-proof-row {
      display: flex; align-items: center; justify-content: space-between;
      font-size: 13px; margin-bottom: 6px;
    }
    .regen-proof-row:last-child { margin-bottom: 0; }
    .regen-proof-label { color: var(--color-muted); font-weight: 500; }
    .regen-proof-value {
      font-family: var(--font-mono);
      font-size: 12px; color: var(--color-cream);
    }
    .regen-proof-value a { color: var(--color-emerald); }

    /* ---- Animations ---- */
    @keyframes breathe {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideInLeft {
      from { opacity: 0; transform: translateX(-40px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes slideInRight {
      from { opacity: 0; transform: translateX(40px); }
      to { opacity: 1; transform: translateX(0); }
    }
    .animate-breathe { animation: breathe 3s ease-in-out infinite; }
    .animate-fade-in-up { animation: fadeInUp 0.6s ease-out forwards; }
    .animate-slide-in-left { animation: slideInLeft 0.5s ease-out forwards; }
    .animate-slide-in-right { animation: slideInRight 0.5s ease-out forwards; }

    /* ---- Mobile ---- */
    @media (max-width: 640px) {
      .regen-header__inner { padding: 0 16px; }
      .regen-header__nav { display: none; }
      .regen-hamburger { display: flex; }
      .regen-hero h1 { font-size: 28px; }
      .regen-hero p { font-size: 16px; }
      .regen-stats-grid { grid-template-columns: repeat(2, 1fr); }
      .regen-stat-value { font-size: 22px; }
      .regen-tiers { grid-template-columns: 1fr; }
      .regen-badges-grid { grid-template-columns: repeat(2, 1fr); }
      .regen-table th, .regen-table td { padding: 10px 12px; font-size: 13px; }
      .regen-header__logo svg { height: 28px; }
    }
  `;
}

// ---------------------------------------------------------------------------
// Header HTML — logo + optional nav links + optional badge
// ---------------------------------------------------------------------------

export interface HeaderOptions {
  nav?: Array<{ label: string; href: string }>;
  badge?: string;
  /** Extra HTML appended inside both desktop nav and mobile nav (e.g. language picker) */
  navSuffix?: string;
}

export function brandHeader(opts?: HeaderOptions): string {
  const defaultNav = [
    { label: "Projects", href: "#projects" },
    { label: "How It Works", href: "#how" },
    { label: "GitHub", href: "https://github.com/regen-network/regen-compute" },
    { label: "Research", href: "/research" },
    { label: "Developers", href: "/developers" },
  ];
  const nav = opts?.nav ?? defaultNav;
  const badge = opts?.badge ? `<span class="regen-header__badge">${opts.badge}</span>` : "";
  const suffix = opts?.navSuffix ?? "";
  const navLinks = nav.map(n => {
    const external = n.href.startsWith("http") ? ' target="_blank" rel="noopener"' : "";
    return `<a href="${n.href}"${external}>${n.label}</a>`;
  }).join("");
  const mobileNavLinks = nav.map(n => {
    const external = n.href.startsWith("http") ? ' target="_blank" rel="noopener"' : "";
    return `<a href="${n.href}"${external}>${n.label}</a>`;
  }).join("");
  return `
    <header class="regen-header">
      <div class="regen-header__inner">
        <div style="display:flex;align-items:center;gap:12px;">
          <a href="/" class="regen-header__logo">${regenLogoSVG}</a>
          ${badge}
        </div>
        <nav class="regen-header__nav">${navLinks}${suffix}<a href="/subscribe" class="regen-header__subscribe">Subscribe</a></nav>
        <button class="regen-hamburger" aria-label="Menu" onclick="this.classList.toggle('active');document.getElementById('mobile-nav').classList.toggle('open')">
          <span></span><span></span><span></span>
        </button>
      </div>
      <nav class="regen-mobile-nav" id="mobile-nav">${mobileNavLinks}${suffix}<a href="/subscribe" class="regen-header__subscribe" style="margin-top:8px;text-align:center;">Subscribe</a></nav>
    </header>
    <div style="height:56px;"></div>`;
}

// ---------------------------------------------------------------------------
// Footer HTML
// ---------------------------------------------------------------------------

export interface FooterOptions {
  links?: Array<{ label: string; href: string }>;
  showInstall?: boolean;
}

export function brandFooter(opts?: FooterOptions): string {
  return `
    <footer class="regen-footer">
      <div class="regen-footer__partners">
        <span class="regen-footer__partners-label">Built on</span>
        <a href="https://regen.network" target="_blank" rel="noopener" class="regen-footer__partner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 12l3 3 5-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
          Regen Network
        </a>
        <a href="https://gaia.ai" target="_blank" rel="noopener" class="regen-footer__partner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>
          Gaia AI
        </a>
      </div>

      <div class="regen-footer__logo">${regenLogoSVG}</div>

      <nav class="regen-footer__nav">
        <a href="https://regen.network" target="_blank" rel="noopener">Learn About Regen Network</a>
        <a href="https://app.regen.network" target="_blank" rel="noopener">Buy Credits on the Marketplace</a>
        <a href="https://www.registry.regen.network/" target="_blank" rel="noopener">Resources for Land Stewards</a>
        <a href="https://t.me/regen_network_pub" target="_blank" rel="noopener" title="Join the Community on Telegram">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
          Join the Community
        </a>
        <a href="https://github.com/regen-network/regen-compute" target="_blank" rel="noopener">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          Open Source Code
        </a>
      </nav>

      <div class="regen-footer__social">
        <a href="https://x.com/RegenChristian" target="_blank" rel="noopener" title="Follow @RegenChristian on X" style="display:inline-flex;align-items:center;gap:6px;color:var(--color-muted);font-size:13px;text-decoration:none;transition:color 0.2s;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          Follow @RegenChristian
        </a>
      </div>

      ${opts?.showInstall ? `<div class="regen-footer__install">claude mcp add -s user regen-compute -- npx regen-compute</div>` : ""}

      <div class="regen-footer__note">Credits are permanently retired on <a href="https://www.mintscan.io/regen" target="_blank" rel="noopener">a public ledger</a>. Powered by <a href="https://regen.network" target="_blank" rel="noopener">Regen Network</a>.</div>

      <div class="regen-footer__legal">&copy; ${new Date().getFullYear()} Regen Network Development, PBC. Licensed under <a href="https://github.com/regen-network/regen-compute/blob/main/LICENSE" target="_blank" rel="noopener">Apache 2.0</a>.</div>
    </footer>

    <div id="consent-banner" style="display:none;position:fixed;bottom:0;left:0;right:0;z-index:10000;background:var(--color-surface);border-top:1px solid var(--color-border);padding:14px 24px;box-shadow:0 -2px 12px rgba(0,0,0,0.3);font-family:'Lato',Arial,sans-serif;font-size:13px;color:var(--color-cream-soft);">
      <div style="max-width:960px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
        <p style="margin:0;line-height:1.5;flex:1;min-width:200px;">We use cookies to understand how visitors use our site. No data is sold or used for ads. <a href="https://regen.network/privacy-policy" target="_blank" rel="noopener" style="color:var(--color-emerald);">Privacy Policy</a></p>
        <div style="display:flex;gap:8px;flex-shrink:0;">
          <button onclick="acceptConsent()" style="background:var(--color-emerald);color:#fff;border:none;border-radius:6px;padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;">Accept</button>
          <button onclick="declineConsent()" style="background:none;color:var(--color-muted);border:1px solid var(--color-border-light);border-radius:6px;padding:8px 14px;font-size:13px;cursor:pointer;">Decline</button>
        </div>
      </div>
    </div>
    <script>
    function acceptConsent(){
      localStorage.setItem('regen_consent','granted');
      gtag('consent','update',{analytics_storage:'granted'});
      document.getElementById('consent-banner').style.display='none';
    }
    function declineConsent(){
      localStorage.setItem('regen_consent','denied');
      document.getElementById('consent-banner').style.display='none';
    }
    (function(){
      var c=localStorage.getItem('regen_consent');
      if(c) return; // already chose
      // Show banner — consent mode defaults already set to denied in <head>
      document.getElementById('consent-banner').style.display='block';
    })();
    </script>
    `;
}
