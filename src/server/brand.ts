/**
 * Shared Regen Network brand system.
 *
 * Exports helpers that inject brand-consistent fonts, CSS custom properties,
 * component classes, header, and footer into any server-rendered HTML page.
 *
 * Design tokens match app.regen.network / regen.network.
 * To update the brand, edit this single file — all pages inherit.
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
// Google Fonts link tags
// ---------------------------------------------------------------------------

export function brandFonts(): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">`;
}

// ---------------------------------------------------------------------------
// CSS custom properties + shared component classes
// ---------------------------------------------------------------------------

export function brandCSS(): string {
  return `
    /* ---- Regen Brand Tokens ---- */
    :root {
      --regen-green: #4FB573;
      --regen-green-light: #b9e1c7;
      --regen-green-bg: #f0f7f2;
      --regen-teal: #527984;
      --regen-sage: #79C6AA;
      --regen-sage-light: #C4DAB5;
      --regen-navy: #101570;
      --regen-white: #fff;
      --regen-black: #1a1a1a;
      --regen-gray-50: #f9fafb;
      --regen-gray-100: #f3f4f6;
      --regen-gray-200: #e5e7eb;
      --regen-gray-300: #d1d5db;
      --regen-gray-500: #6b7280;
      --regen-gray-700: #374151;
      --regen-font-primary: 'Mulish', -apple-system, system-ui, sans-serif;
      --regen-font-secondary: 'Inter', -apple-system, system-ui, sans-serif;
      --regen-shadow-card: 0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04);
      --regen-shadow-card-hover: 0 8px 32px rgba(79, 181, 115, 0.18), 0 2px 8px rgba(0,0,0,0.06);
      --regen-radius: 12px;
      --regen-radius-lg: 16px;
    }

    /* ---- Base reset ---- */
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: var(--regen-font-primary);
      margin: 0; padding: 0;
      color: var(--regen-black);
      line-height: 1.6;
      background: var(--regen-white);
      -webkit-font-smoothing: antialiased;
    }
    a { color: var(--regen-green); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* ---- Layout ---- */
    .regen-container { max-width: 900px; margin: 0 auto; padding: 0 24px; }
    .regen-container--narrow { max-width: 640px; margin: 0 auto; padding: 0 24px; }

    /* ---- Brand header ---- */
    .regen-header {
      padding: 20px 0;
      border-bottom: 1px solid var(--regen-gray-200);
    }
    .regen-header__inner {
      max-width: 900px; margin: 0 auto; padding: 0 24px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .regen-header__logo { color: var(--regen-navy); display: flex; align-items: center; }
    .regen-header__logo svg { height: 36px; width: auto; }
    .regen-header__nav { display: flex; align-items: center; gap: 20px; }
    .regen-header__nav a {
      font-family: var(--regen-font-secondary);
      font-size: 14px; font-weight: 500; color: var(--regen-gray-500);
    }
    .regen-header__nav a:hover { color: var(--regen-green); text-decoration: none; }
    .regen-header__badge {
      font-size: 12px; font-weight: 700; color: var(--regen-green);
      background: var(--regen-green-bg); padding: 4px 12px; border-radius: 20px;
      letter-spacing: 0.03em;
    }

    /* ---- Brand footer ---- */
    .regen-footer {
      padding: 32px 0; text-align: center;
      border-top: 1px solid var(--regen-gray-200);
      margin-top: 48px;
    }
    .regen-footer__logo { color: var(--regen-gray-500); margin-bottom: 8px; }
    .regen-footer__logo svg { height: 28px; width: auto; opacity: 0.5; }
    .regen-footer__links { font-size: 13px; color: var(--regen-gray-500); margin-bottom: 8px; }
    .regen-footer__links a { color: var(--regen-green); margin: 0 8px; }
    .regen-footer__note {
      font-family: var(--regen-font-secondary);
      font-size: 12px; color: var(--regen-gray-500);
    }
    .regen-footer__install {
      font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace;
      font-size: 11px; color: var(--regen-gray-500);
      background: var(--regen-gray-100); border-radius: 6px;
      padding: 8px 14px; display: inline-block; margin-top: 8px;
    }

    /* ---- Buttons ---- */
    .regen-btn {
      display: inline-block; padding: 12px 28px;
      font-family: var(--regen-font-primary);
      font-size: 15px; font-weight: 700;
      border-radius: 8px; border: 2px solid transparent;
      cursor: pointer; transition: all 0.3s ease;
      text-decoration: none; text-align: center;
    }
    .regen-btn:hover { text-decoration: none; }

    .regen-btn--primary {
      background: var(--regen-white); color: var(--regen-green);
      border-image: linear-gradient(135deg, #4fb573, #b9e1c7) 1;
      border-style: solid; border-width: 2px;
    }
    .regen-btn--primary:hover {
      background: linear-gradient(135deg, #4fb573, #79C6AA);
      color: var(--regen-white); border-color: transparent;
    }

    .regen-btn--solid {
      background: linear-gradient(135deg, #4fb573, #79C6AA);
      color: var(--regen-white); border: none;
    }
    .regen-btn--solid:hover {
      background: linear-gradient(135deg, #3a9c5c, #4FB573);
    }

    .regen-btn--secondary {
      background: linear-gradient(0deg, #527984 6%, #79C6AA 52%, #C4DAB5 98%);
      color: var(--regen-white); border: none;
    }
    .regen-btn--secondary:hover { opacity: 0.88; }

    .regen-btn--dark {
      background: var(--regen-black); color: var(--regen-white); border: none;
    }
    .regen-btn--dark:hover { background: #333; }

    .regen-btn--outline {
      background: transparent; color: var(--regen-green);
      border: 2px solid var(--regen-green);
    }
    .regen-btn--outline:hover {
      background: var(--regen-green-bg);
    }

    .regen-btn--sm { padding: 8px 18px; font-size: 13px; }
    .regen-btn--block { display: block; width: 100%; }

    /* ---- Cards ---- */
    .regen-card {
      background: var(--regen-white);
      border: 1px solid var(--regen-gray-200);
      border-radius: var(--regen-radius-lg);
      box-shadow: var(--regen-shadow-card);
      overflow: hidden;
      transition: box-shadow 0.3s ease, transform 0.3s ease;
    }
    .regen-card:hover {
      box-shadow: var(--regen-shadow-card-hover);
    }
    .regen-card--interactive:hover {
      transform: translateY(-3px);
    }
    .regen-card__body { padding: 28px 32px; }
    .regen-card__header {
      background: linear-gradient(135deg, var(--regen-green), var(--regen-sage));
      color: var(--regen-white); padding: 32px; text-align: center;
    }

    /* ---- Hero section ---- */
    .regen-hero {
      padding: 72px 0 56px; text-align: center;
    }
    .regen-hero__label {
      display: inline-block;
      font-family: var(--regen-font-secondary);
      font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
      color: var(--regen-green); background: var(--regen-green-bg);
      padding: 5px 14px; border-radius: 20px; margin-bottom: 16px;
    }
    .regen-hero h1 {
      font-size: 42px; font-weight: 800; color: var(--regen-navy);
      margin: 0 0 16px; line-height: 1.15; letter-spacing: -0.02em;
    }
    .regen-hero h1 span {
      background: linear-gradient(180deg, #4fb573, #b9e1c7);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .regen-hero p {
      font-size: 18px; color: var(--regen-gray-500);
      max-width: 560px; margin: 0 auto 28px;
    }

    /* ---- Section titles ---- */
    .regen-section-title {
      font-size: 28px; font-weight: 800; color: var(--regen-navy);
      margin: 0 0 16px; letter-spacing: -0.01em;
    }
    .regen-section-subtitle {
      font-size: 15px; color: var(--regen-gray-500); margin: 0 0 28px;
    }

    /* ---- Stats cards ---- */
    .regen-stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 16px; margin-bottom: 32px;
    }
    .regen-stat-card {
      background: var(--regen-white); border: 1px solid var(--regen-gray-200);
      border-radius: var(--regen-radius); padding: 20px; text-align: center;
      transition: box-shadow 0.3s ease;
    }
    .regen-stat-card:hover { box-shadow: var(--regen-shadow-card-hover); }
    .regen-stat-card--green { border-left: 4px solid var(--regen-green); }
    .regen-stat-card--teal { border-left: 4px solid var(--regen-teal); }
    .regen-stat-card--sage { border-left: 4px solid var(--regen-sage); }
    .regen-stat-card--navy { border-left: 4px solid var(--regen-navy); }
    .regen-stat-card--muted { border-left: 4px solid var(--regen-gray-500); }
    .regen-stat-value {
      font-size: 28px; font-weight: 800; color: var(--regen-navy);
      letter-spacing: -0.02em;
    }
    .regen-stat-label {
      font-family: var(--regen-font-secondary);
      font-size: 12px; color: var(--regen-gray-500); margin-top: 4px;
      text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;
    }

    /* ---- Pricing tiers ---- */
    .regen-tiers {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px; margin: 28px 0;
    }
    .regen-tier {
      background: var(--regen-white);
      border: 2px solid var(--regen-gray-200);
      border-radius: var(--regen-radius-lg); padding: 28px;
      text-align: center; text-decoration: none; color: var(--regen-black);
      transition: all 0.3s ease; display: block;
    }
    .regen-tier:hover {
      border-color: var(--regen-green);
      box-shadow: var(--regen-shadow-card-hover);
      transform: translateY(-3px); text-decoration: none;
    }
    .regen-tier__name {
      font-weight: 800; font-size: 18px; color: var(--regen-green); margin-bottom: 4px;
    }
    .regen-tier__price {
      font-size: 32px; font-weight: 800; color: var(--regen-navy); margin: 8px 0;
    }
    .regen-tier__price span {
      font-size: 16px; font-weight: 500; color: var(--regen-gray-500);
    }
    .regen-tier__desc {
      font-size: 14px; color: var(--regen-gray-500); line-height: 1.5; margin-bottom: 16px;
    }

    /* ---- Forms ---- */
    .regen-input {
      width: 100%; padding: 12px 14px;
      border: 1px solid var(--regen-gray-300); border-radius: 8px;
      font-family: var(--regen-font-primary);
      font-size: 15px; color: var(--regen-black);
      outline: none; transition: border-color 0.2s;
    }
    .regen-input:focus { border-color: var(--regen-green); }
    .regen-label {
      font-size: 14px; font-weight: 600; color: var(--regen-gray-700);
      display: block; margin-bottom: 6px;
    }

    /* ---- Alert boxes ---- */
    .regen-alert { border-radius: 8px; padding: 14px 16px; font-size: 14px; margin-bottom: 16px; }
    .regen-alert--error { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
    .regen-alert--success { background: var(--regen-green-bg); border: 1px solid #b9e1c7; color: #1b4332; }
    .regen-alert--info { background: #f0f4ff; border: 1px solid #c7d2fe; color: var(--regen-navy); }

    /* ---- Info box ---- */
    .regen-info-box {
      background: var(--regen-green-bg); border-left: 4px solid var(--regen-green);
      padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 20px 0;
      font-size: 15px; color: var(--regen-gray-700);
    }

    /* ---- Code/pre ---- */
    .regen-code {
      background: var(--regen-gray-100); padding: 2px 8px; border-radius: 4px;
      font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace;
      font-size: 13px;
    }
    .regen-pre {
      background: var(--regen-navy); color: #e0e0e0;
      padding: 16px 18px; border-radius: 10px;
      overflow-x: auto; font-size: 13px; margin: 8px 0 16px;
      font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace;
    }

    /* ---- API key display ---- */
    .regen-api-key {
      font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace;
      font-size: 13px; background: var(--regen-white);
      border: 1px solid var(--regen-gray-300);
      padding: 10px 14px; border-radius: 8px;
      word-break: break-all; display: block; margin: 8px 0;
      user-select: all;
    }

    /* ---- Tables ---- */
    .regen-table { width: 100%; border-collapse: collapse; }
    .regen-table th {
      font-family: var(--regen-font-secondary);
      font-size: 11px; font-weight: 700; color: var(--regen-gray-500);
      text-transform: uppercase; letter-spacing: 0.05em;
      text-align: left; padding: 12px 16px;
      border-bottom: 1px solid var(--regen-gray-200);
      background: var(--regen-gray-50);
    }
    .regen-table td {
      font-size: 14px; padding: 12px 16px;
      border-bottom: 1px solid var(--regen-gray-100);
    }
    .regen-table tr:last-child td { border-bottom: none; }
    .regen-table td a { color: var(--regen-green); font-weight: 600; }

    /* ---- Share buttons ---- */
    .regen-share-btns {
      display: flex; gap: 10px; justify-content: center;
      flex-wrap: wrap; margin-top: 16px;
    }
    .regen-share-btn {
      display: inline-block; padding: 10px 20px;
      font-family: var(--regen-font-primary);
      font-size: 14px; font-weight: 600;
      border-radius: 8px; text-decoration: none; color: #fff;
      transition: opacity 0.2s; cursor: pointer; border: none;
    }
    .regen-share-btn:hover { opacity: 0.88; text-decoration: none; }
    .regen-share-btn--x { background: var(--regen-black); }
    .regen-share-btn--linkedin { background: #0a66c2; }
    .regen-share-btn--copy { background: var(--regen-gray-500); }

    /* ---- Referral box ---- */
    .regen-referral-box {
      background: var(--regen-green-bg); border: 2px solid var(--regen-green);
      border-radius: var(--regen-radius-lg); padding: 28px; margin: 28px 0;
      text-align: center;
    }
    .regen-referral-box h2 { color: var(--regen-green); margin: 0 0 8px; font-size: 20px; }
    .regen-referral-box p { color: var(--regen-gray-500); margin: 4px 0 16px; }
    .regen-ref-link {
      font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace;
      font-size: 14px; background: var(--regen-white);
      border: 1px solid var(--regen-sage); padding: 10px 14px;
      border-radius: 8px; display: block; margin: 12px 0;
      word-break: break-all; cursor: pointer; user-select: all;
    }

    /* ---- Badges grid ---- */
    .regen-badges-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 12px;
    }
    .regen-badge {
      background: var(--regen-white); border: 1px solid var(--regen-gray-200);
      border-radius: var(--regen-radius); padding: 16px; text-align: center;
      transition: transform 0.2s, box-shadow 0.3s;
    }
    .regen-badge:hover { transform: translateY(-2px); box-shadow: var(--regen-shadow-card-hover); }
    .regen-badge svg { margin-bottom: 8px; }
    .regen-badge__name { font-size: 13px; font-weight: 700; color: var(--regen-navy); margin-bottom: 2px; }
    .regen-badge__desc { font-size: 11px; color: var(--regen-gray-500); }

    /* ---- Referral banner ---- */
    .regen-ref-banner {
      background: linear-gradient(135deg, var(--regen-green), var(--regen-sage));
      color: var(--regen-white); text-align: center;
      padding: 10px 16px; font-size: 14px; font-weight: 600;
    }
    .regen-ref-banner span { opacity: 0.85; }

    /* ---- Proof/data section ---- */
    .regen-proof-section {
      margin-top: 24px; padding: 16px 20px;
      background: var(--regen-gray-50); border-radius: 10px;
      border: 1px solid var(--regen-gray-200);
    }
    .regen-proof-title {
      font-family: var(--regen-font-secondary);
      font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; color: var(--regen-gray-500); margin-bottom: 10px;
    }
    .regen-proof-row {
      display: flex; align-items: center; justify-content: space-between;
      font-size: 13px; margin-bottom: 6px;
    }
    .regen-proof-row:last-child { margin-bottom: 0; }
    .regen-proof-label { color: var(--regen-gray-500); font-weight: 500; }
    .regen-proof-value {
      font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace;
      font-size: 12px; color: var(--regen-black);
    }
    .regen-proof-value a { color: var(--regen-green); }

    /* ---- Mobile ---- */
    @media (max-width: 640px) {
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
}

export function brandHeader(opts?: HeaderOptions): string {
  const nav = opts?.nav ?? [];
  const badge = opts?.badge ? `<span class="regen-header__badge">${opts.badge}</span>` : "";
  const navLinks = nav.map(n => `<a href="${n.href}">${n.label}</a>`).join("");
  return `
    <header class="regen-header">
      <div class="regen-header__inner">
        <div style="display:flex;align-items:center;gap:12px;">
          <a href="/" class="regen-header__logo">${regenLogoSVG}</a>
          ${badge}
        </div>
        <nav class="regen-header__nav">${navLinks}</nav>
      </div>
    </header>`;
}

// ---------------------------------------------------------------------------
// Footer HTML
// ---------------------------------------------------------------------------

export interface FooterOptions {
  links?: Array<{ label: string; href: string }>;
  showInstall?: boolean;
}

export function brandFooter(opts?: FooterOptions): string {
  const links = opts?.links ?? [
    { label: "Regen Network", href: "https://regen.network" },
    { label: "Marketplace", href: "https://app.regen.network" },
  ];
  const linkHtml = links.map(l =>
    `<a href="${l.href}" ${l.href.startsWith("http") ? 'target="_blank" rel="noopener"' : ""}>${l.label}</a>`
  ).join("");

  return `
    <footer class="regen-footer">
      <div class="regen-footer__logo">${regenLogoSVG}</div>
      <div class="regen-footer__links">${linkHtml}</div>
      ${opts?.showInstall ? `<div class="regen-footer__install">claude mcp add -s user regen-compute -- npx regen-compute</div>` : ""}
      <div class="regen-footer__note">Powered by Regen Network. Credits are permanently retired on-chain.</div>
    </footer>`;
}
