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
// Regen Network logo PNG (horizontal, black on transparent, 360x161 2x retina)
// Used in emails — most email clients (Gmail, Outlook) block SVG images.
// Resized from 1441x645 original for email use (displayed at 120px width).
// ---------------------------------------------------------------------------

export const regenLogoPNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAWgAAAChCAYAAADqdSUdAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAGYktHRAD/AP8A/6C9p5MAAAAJcEhZcwAALEoAACxKAXd6dE0AAAAHdElNRQfqAwkMGBTQeBJeAAAxNUlEQVR42u2debhcVZW337q3KlWZSEjICAlDmAICBhsMgxMqtiNi21+DgK04tKK02tpIi9LObattqygoiuLczSAi2grKqIDIlDDPhJCQkHnOHau+P377pM6te8Yabk3rfZ56klt1zqmzd53zO2uvtfbavXQBuXyB3mz25N5s9pu92eyevdnszt5sdnNvNjvYm83ivYrDQ80+VcMwjF1kmn0CjSaXLwDsD1wGLAKKwPPAvcD1wC3Ao8BWgMH+vmafsmEYBtDhAu3EeTJwEXBayGbrgfuA3wIXD/b3bW32eRuGYUAHC7QT5x7gQ8CXgHExu2wCXjnY33dPs8/dMAwDJGCdzMuAjxMvziBLe38n7IZhGE2nIwXaiezewBeBWQl36wUWNvvcDcMwPDpSoJHYfghYnHK/hUC22SdvGIYBnSvQJRT8K6Xcb39gt2afvGEYBnSuQBeBnwOPpdxvL2B2s0/eMAwDOlSgXS7zMuAXpLOidwf2bfb5G4ZhQIcKtKME/Ax4KsU+44CFlslhGEYr0LEC7azop4D/TbnrIXRwvxiG0T50uhAVgZ8id0dSDgAmNvvEDcMwOlqgnRX9KHB5it3mAzOafe6GYRgdLdCOIvATYEXC7fdAk1wMwzCaSscLtLOiHwKuSLjLeOAgCxQahtFsOl6gHcPIil6dYNsMChR2bCEpwzDag64QaGdF3wdcmXCXgwEzoQ3DaCpdIdCOIeDHwNoE2+4DTGv2CRuG0d10jUA7K/pe4KoEm88C5jX7nA3D6G66RqAdg8CPgA0x200CDrBAoWEYzaSrBNpZ0XcBv47ZtAcFCg3DMJpGVwm0YwD4IVriKoqDgVyzT9YwjO6l6wTaWdF/BX4Xs+kCYGqzz9cwjO6l6wTa0Qd8H9gSsc1cYM9mn6hhGN1Ltwo0wO3AdRGfTwEWWKDQMIxm0ZUC7dwcO5EVvTVksyzyQ6cily/senUT3dhmw2g0XSnQPv4M3Bjx+SFoAdpEVApUtwiWa2cv0ON/QHVL+w2jUSQWn06jODxEbzY7CGwDTkKrqVSyE7isODzUF3c8nxi9EHgvyrVe05vNUhweanZzG4Zr9zTg08A/ABOAHWhkUuzNZvFendwPhtEIulagAXqzWYDngKNRof5KeoArisND66OO47MgTwIuBP4eeBUKRj7Wm80OdJpA5fIFr/9mAV8F3gccCbzZvY5CK6T3IbEe7qT2G8ZY0NUC7azoAWQpv4nRec/jgGuLw0NPRB2nN5udAnwI+E9U8B9gOnAicBBaNGBtpwiUb7SwF/AN4FTK7rIetPjuYcAbgZOB44DtxeGhtKusG0ZX09UCDbus6JXAMcB+FR9ngbt7s9m/RIlrbzZ7FvBFNEW8cv9DkRV5XScItE+cF6DRwpsJL82aQVb0wcBQcXgoSR0UwzAc3R4k9DI6tqCMjv6ATZIsIttP+KzDEvC4+7et8YnzIcD3gNel2L3Y7PM3jHYj2+wTaCGuRbnRL694/0AU+NoWse8DwHaCF5vdDjzgHgRVEZUNUctxqzyHI4FvA4vH5IsNo4vpegsadoncJuAHqFaHn73ROoVRPE34ai3PAU/V4TRzyIUyGwU0/waYOhapbL7vOBbVMTFxNowxwAR6JL9FdTr8zKAc+AtjHfBkyGePu8+rwonj/kgYfwdcD9yEZkG+vdEd4hPnV6IH2OGN/k7DMIQJtMNZ0RuAS9HqKx4TiF9Etg+5OYJYSrBvOw2vBk4Djkf+37koU+LtwMxGWdHuuBmUjfF9lJFiGMYYYQI9ml+jmtEeSRaRLaE1DysDYcNIoGshj6zXIA4HXtuITnDi3IMmn3wXLQNWC7YIr2GkxATah7Oi16JVV4Z9Hx2MhDJqv4cZXddjA/BIjYG8+WgiTRA54B+pc1lUJ85Z4B3ABcCcGg9ZAjbW8xwNoxswgQ7mV8AS39/7Er+I7HKUT1353opqT8IJ5THIpRGG5+6oC+47xwHvB75GfIA0jseBTwBfqdc5Gka3YAJdgbN2VyMr2nNZzEKz5qLYgMTIz0PA5hpOJ4umjIdNKFoHfBJ4ph5td+I8Hvgo8B+o5Gq1rAC+BLzB/buyhmMZRlfS9gJdWT2tjpXUfkk58DcZ2D/mmIPA/RXvLWWkqyQtc5EFHcQ24FPuPGueBOLaNgk4Dzif4JzuJKxFMwzfgCznx2Ds8rUNo5No64kqPsH0coSnIVF7HicM1TDY30cuX3gOWdFfQRbswpjdSkigh932O1HgsJa2HY3ysCsZAL6M0t6KtYqf+64pwGeAs6huLcbNwDXARShVccjry3al3tkx1fTFWJZsHavza7d+SPPdadqW5LhtLdAocPc+4KUomDYbBczuBE7N5QvP1yAQJeBK4F0oi2MhEq7BoI2dqD+KgmF7AGuAJ2r4/l7k3qgUyyLKqvgaMFCnGYp7IJfGO0lfn2Unysm+COVn70opbGdxdmSRP76WDJQielgN+m/IFH2TcefQ6Ht1kNGTtEKpEJccKg42C5iJ6q9k0T20A00Cex7dE1ty+cKusgcp+6FA40f9/YxMs8V9Z4H466Avly8Mp2hTlvDkgxLQ3+4CPR34IJrI4edlwAeAz6TssF04wV0O/Bj5UPdHVmbUpJMVwLNI8J5AF2W1zEB5z5Vchmovb6+TOM9B5UJPJZ0QDaAFDy5E0+R3TYXvAGH2eAVyI9UiCgMoPvEMcpndDTyWyxf6IHFffRxVRmwkl6Jc90h8100PmtF6AiqPcCgykCagB4rXZ0NonsAWdG/cgyZb/QlYm8sXkvbBbqhy4v5JNq6SEvB5dD37WQB8nfiYzNXIcErq1vxb4NyQzzYD57a7QM8iOLuiB2Uh3IwuhmopAZcD70ZBwjlEC/RmVFp0EXJ37KzmS91NcCS6MPz8AfhXYEOdxHlv4Juo1GpSimiE8h10Qe5Kn+sgYfaYCbykjscrISvyT2hm6PW5fKEfYvtuISrZ2khuitvAd90sBN4DvAWNXKMe7Dn3mowWYV6MRqX3ooJbl+XyhW0J+iAHvAh4QYP7YWbAe5NQmYOpMfsuAG7M5Qt3JbwX5hD+u24GprR7kHAe+uGD2ANZP7Oq9V+5Tn4aWdFTGF2OtJIhJMwllKZXbQW7DJqc4j/xu1HN6arT9mDETXYgukHSiPMDwL+gEqOX4sR5sL+vE8UZ9PvVswpfBhkVbwX+B41cZifYr5ZAc1Ii2+mumwJwJnowfwQ94Ktx/+SRUF+IXGN7J9yv0f1QIvieLSX87tnoHi0k1JyoPh8CSu0u0AcQHdB6CQp69dYQZCihm2kFcGiC4zyAMhkerkG0piG/usfjwNloMkzVYug798OBS9AU8iQ8hTI73oiGmau98+hQYR4LJiP33HeBPVt5/UZ3bruhIPIFBK8+VA154HTgYmDfVu6DFLyZ5PdVLO0u0BvcK6p976OGYaoToCeRSC8kos982y5Bk1RS4y7SwyivKL4K+DAqhVoPcT4aDa+PT7Dbc8jKewPwOWCZdw4mzHXjTSimMKEVBcqXG38+Gj1NaMDXnIiypXZvxT5IySTUT9Pr0ZZ2F+ifAW9D/rOw4cJM5OqYUUOHFYGfIms9LlCwGgUZNlX5XRkUeJnkjvFxVMWuHuL8UiTOR8bssp6y++Pj+Cx3E+aG8DbgNU0+h56I989EQfdGxqzejBZbbqYmZer0/ccDp1CH+jPtHiQcQGJ4L/pxzyK4bsTLUdDwC9VkdfhS6G5Dgh9VV2ILcAUpUpYqmIwEug9FlH8BlOogzq9Fw9MFEZtvRSVXL0IW+6DXfiOQLcBvUL/5b8YSSlecibIb9iP6Zp2AKhP+Dv3uaVmLAre1+GgfrnzDXTtHAOcwMh4SxpMoAHofCnKNQ9fbS5BREOWO7EUPgd/l8oX7qrzmnqGGuQfod6tq5FtB1rXl97l84cla7p+2FmgnnKDI+BeAG1Daymsr2taDOuwWEkSrQxhC4hU3iWOQ2twbhyD3xjfRyiVDNYpzBkXb/xsFVYPoQ9kuF7k+3JV9YuIcyTrg3wj/vceh7J/3Av+MXAVhHIUyIqqZYLUUpUnW8mMFifs4dN/E1UPfgVL0vo3SSytHs3ugle4/RXThrXkogPoA1QVnf4/6uRbqtXDoQuCf0PVR9YOzrQUaygLikt9vA85A1siHGZl14bk6HszlC2urtKKfRhdto8gga/8a9MDpq1Gce9Hw+Ssoe6CSIeBWlDL3W3zV+EyY68IACrB+GqWYnR6x7R7oeq1GoEvuu6odtY3CFwuJy/LpRwsmf5WKSUq+0ds69PDfjK61ysyrQVS35ho0+qw2+6lYzz6oA28HfpnLF/5S7f3U9gLt4bsgNqOh/M1oaPYWypbLy5Eb5PNVTmApEmOl1ChsE5FIngdsqVGcsyh/+wuMzhUvoQkD30W1PNbX6fy7krg+c5NSrkF+ybB7bhzxFRNrOo+UeAs1zIjZ7mo0iaO/8vv9f7tr8gq00PBp7u016D690v27mhppset3Fkq7W5rLF3ZWc24dI9AwwpoG+aLei6YhfwxZAz1IoG+mClfHGPz4QyjwuanaA7i251Fa3qdQepSfR9Bw9BcoS2Os2ta1OONhPbIUw+65egWo6sUkNJMyik3IrRE7q9X1wQC67vZDsaNrgAdp7/IAw+jBsmfI529ELtdfVnPwjhJoD581vQNNMrkNJdafjlwd51Olq6PB9LlXLQVlJqDZhucwMiXqGdcXP8K3fmKLtb8j8f0uUXVOhtAK8LV+Tyoifv95aDJTFHe7VxquRwHoEemx9boOa5yUVg3DwM/RwhlBsxAnIu35UzV605ECDaOs6SdQJ12HgogvRcGPz1Vbq6OR51wNrp2T0cPnbMpFWFajHO5LkLVSqvW7jOT4ArXHER2/2E71NbOTFvPx4/mtw4Jx+xHvcvkLsCPpteQMp5qMkBh6iQ7EBuH5rav1e/eieQ+7oaBgEItRLOibab+nYwXaw2dNDyB/2V1oBtf/Q8V+/tjsc6wV177dkb/5veii2YhWhvkOsnKGvf4w6kYJGI6x2vJook/cCuzLUFmBaliE/LhpMh+2oxz3R0M+n0f0A6WIAnujBCepFRu1XZXX6euIL8fgJ4NGk+dQ/cIaPa4vvofiXUE++yxyrf5fLl94PE3bOl6gYZQ1vRKtQnI9mlV3D9GzEVsa16ZZqD7029GN9zsUNf8zLqptwtwQJiFRWBvwWYHygguvJn6C0x/wBWtTMg3lzqdhW8w5xS111g+ElfPtcfvnSWcxZtxx16bcz2Mv4lc+qmQ2tWVmZdB1sAQZRO8J2e5ANBfjHFKk8nWFQHv4hHoYWc53MTaFaOqOz/qYh+pjvBa5cC5EN/uOynYbdWcW6u8gekge9FuG4gP1LMwUxzDRIjg5Zv8BNFEniPEos+OoKs7rDpR9NFYXbT3u/5w7znfQAzssYHg6cGUuX7g16T3ZVQLt4XN7bGr2uVSDT5wPQPVnp6En9zX4hmomzGNCrffQNuSaerDFfq+4hRuKhD9QetDklmpqN6+iDlOkx5gJTlOWoFjPp0LaMAPFwpagkW5sO1sprWdM8epKtNhNkZQMmnH4AWQ1n4xqhWz2t81oedahdRv9CxS3CnHD8F7ifdTV0Gr9kATvYVZEAn1/xLavA17njKzYtnatQLc5k1FKz3+jSTlrwIS5jdiG4gRvQy6SwSb8bnHW25aYz/OMzrFvR+pmrbvfcDm6J8NmNI5HFTYnIys6UqS70sXRAWxHk20sZa792ILqRfwSN7W+Dr/fIygonKaORD/KjQ9jXcz+43B1rEPOP+3alvXgFuB/U+6zDt9ybXXiClRTJKxC4XHA69FvEBkMNYFuTyxlrjXYjqq3+Zc2G4fKTYZlSExEsYMdULffcDmyxOtV6Ae0fmA/4YuaZlClvgyjRWYIuJHgNTlLwL4oNbDe3E940HZMcL7oTSg2tJjg6yCPcqYvQfdy6MPMBLoNMWFuGZ5HcYBnfe9lUZnYfwnZpxcNcW+ktvUy/WSA7GB/Xz0F+mmUSx+1JNdiYEouX9hUcU32oQJRYe6D99MYge5poXvjZmRJvyvk88Wo1EJkFon5oA2jNoZQjQ3vtRNZcQ9H7DMdFcSqZRGJRrOC+Mp6R6DFVCspBfSL/5U2V7mtcA+JfuSLDitFW0CVAiNzsE2gDaNG/BlB7uZ8CvgWbsGDEF6KUiNb9R7chqzAKCaisgLT/A+ayv6oCF7PIv2kmnblflSYLCwQOIkYX725OAyj/pRQ1baTgVeFbNOLSg7cmMsXbq9xaF4CivWwxn3nUQL+D7lwompyvBrl/X46ly+MysGvOKeJwEeBF9Z8oiH9UK8RSa2uEueLLgI/QMt5xS0zF4gJtGHUGXdzbkSBoqMIDxjOQXnQp+fyhc01iMJEtApPf7UHQFbeSnzBSzfx4lq0WksY3oNmLzSkvxfYWiGU41FA8SxUC7pRGR67AwfVeIwB5N4ZrPE4Xh+uREWSvkt4wDUUE2jDaBw3AJejqcthvAaVqryA6iuqHYWEtNr9QcL8dlSa16MPuWpOIHhFHo8sSit7JVp+60GUm18CpqJJVUcSXI6znpyEFuWohaddW1bV8byucsd8Q9odTaANowE466kfWU+vBvYO2TSHpv/ekssXllRpRY8jOtsiCTsJtvDuQLVePku8XuyOBPLltfdgVUxgZA30athBHeMC7jrYgmqTHIf6KDGjTiSXL4S+DMNIjhPbB1ERnagZY/ugOuWTmnifFamwwN35D6NVU35a5+9bQ2sWKqtlFBLFn0g/iWakQLuLYx+0TMuLUbGT6ciHlIkSbxNwwwikCFwK3Bmz3UmoRnlL4UR6C3qA/JD6TIZZAvwnrbXAa8NwfTiA3Fipan7vGrL4ir5/DU1D7EPFdzaghPznkPN8BfLPrEL1azehYUG/W1k77kSNFqcyZcqoHjfEXY3uqx8SPgQvoKXKbs3lC4+2YL8/D3wYTSs/m+pzme92+3t50mlXQGlnHgYuRtULE7lRsjBiFegPouRpr1LVbqjecCUDyGe1iZECvhLNqnoOLbW0wW2zE+iLs7Jb8KLseEJ+kwwSkv5cvjDUxb9L3EKuPSQvtvMb94qykg9GluoH8NXzZmxypXvD2uIrz7sF+AqqpX4mCnrNT9gHq9GqL19HS9AtREZgZcGlqLaORX2PoN80E/Pdse13fVhClQvfQnyt7F4g43f6/y16QibphHHuNYXg4Ec/IwV8NbK4n3WvVUjU/QLebwLeWCLEeDKK0u+HIu6HAguQ3/EHuXyh1KV9fz/wGXTTVo4OM+j6jV0qyd2cO4DPoWWiegn2dWbQBJHJjBToK5GoNco/mkFG17KoNgCeyNyDsjW+CbwEuUMPQvWOx7vjDaJ7+2m0duENwAOUXSSrkZtjqq9dGbd9kBtlByoINbvB/bCe0ZX8vHOdQPB1cGuSg7vrYBVaVSVqxfSMa+/yjLtpD0DpQEc0qOGV9LsT2OQ6xHOZ+F0ongW+GQl4rL+qS0UkkBAx7kE3/2wkwIe410HIEtoDDbU9VgD/ANzWjX2bNK6SpG/SxmhCJno0nCrbkkG52JMoC/QAethso0JwfRZ54vNoZj8k+e6k90fadmRy+cIUFKU9bUx7IJo+JOAbkYCvZqQP/DlkgW+kLOCBieXdJCwVP34vEuM5SIwXIsvYE+PpJEucvxlNVFjVTX0J9RXoNMfzH7MVBbqaNqUV3E4V6LRtyeTyhc+j4EQtCyeOJSXKAr6JsgvFL+ArUJGSlYP9fdubfcJjRS5f2AP5thYBh6GR0V4o+Fvt71tCkxXOGezv6y6FNowmk0W+kHYRZ9DwaTwaik9EQYbdkD98ErIKh1Ex9HrOBmoHSu6Vc/0zwf2bq+GYGZRuOY6xW8jTMAxkQb8U5Wnu2+yTCWAAFUXfiFY+8Kzk5e7flSjhfQPydfVRMSGgm4blFUOnHCpyMx+5Nw53r/1RQDDpjKvlyA/9l27qS8NoBTK5fCEDvAMNY2udJpmWIvIfb6GcrrcSicJy939/vnVssNBERIT4ucZTztZ4AQoKH4oycaYz2tLuQ8szfR/o1kwOw2gaXhZHAeU3foD6L3k+QDngt5ZytsZyyjnTXspdoBVciQlFeiKyOnYD5gIHIsE+AgUS5wCXoToRO63PDWPsycCum3cuqmH70pTH8KzgrcjS9azgZxlpBa/DrOCWIkS0c8ia3gstKrrWfg/DaA67rGV3sx6HCnrsWbFdkC94JbqB/WlvZgW3MUGCbb+TYTSPSoHOAO8ETkGpa54bwps8Yr5gwzCMMWKEv9mJdA9KVeunjaxgmyZuGEanMSog2GqVzKqcQZRDD5nJKC94zWB/X7GaAxmGYTSLUSskNFuUYwQ5i4R3POUJKtNQkZYZKIVspvt3MirOcinKlTYMw2grWmrJKyfOE1DtiOlIdPdAgjvL/X8GEuXdkAiPR7Pc/FX47gcuBK5AQU3DMIy2o6UE2nESWgNtIrKW09SAfRotc/4jFNwEmj8qMNqTsNFctdXrml0AqBbq1eZa92lmhcFGtSlqv1YT6BxazWVGyv3WoRzu76I14BJ3imFE4FUE9IrI7yB5PRL/vl553cpawl7512oL0Q+itFZQHZpaaq549Lnz9c7dq2sTGcPxTXjzZiN7qblJajd7xljJtWcw5PgeE9C8jVmoBk+RctG01cCAt32MBnhlUuNqEZUo/4YkOLY3AayH8m8U2Q/umL1uv4x79beMQLsTnAccm2K37cD/obW+bsfVnTVhNurEXDTN3Vsx+2bg47l8IcnMyj3dvrOA3wKfZPRNOgO4hOBVi5LwFzQVP4OW1Dq6Dm3+KRqFXoLq86wF3k1EMX9HBs06PcX9vRQ4i/IDJIw88F/AMe673kPFun0+cd4LOBmt5HIIKvbvPZT63f73Ale7Pt+Yyxei9CADfAIZhVGUkBH4EPAH4CZga8SxZ6LlzeYiXTqbkHLIvvZlgfejlWqyri2faRmBdhyPivvEMQTcguqHXIt7spkwG3VmHKpV4k3cOgCtnpFkdea823cuClYHkUNCU22hsg2Ul+U6GBXDqpX5qMb6gDveMLAoly8si7m/JiOh885hNqrx8iDRzAVe6773ZiRM5Q4qi9dJSEwXEVyOIo+szwVu2xuBTwO3x4j03in67ZXoYfVH4N+Be0OOnUO//TyUoBBaPsPXvvegFXemuP7/BnB7Kwl0D6oDETfcu49yAHA9VFcwvZ3FPOHwzagPw77/j0fLFd2eyxeWx/R/ybdvlHvA22YdsojTpIMucduXkFW3IeQ8JqBZwhOQAN4R8T1LkQF0PfB36H48BvgV0cP0fVA9F4/pwAtz+cKDYf3kruMjKI9QbkKjYv/nvcB70UKrU91Ha4HbgLvQBLpeJLQvRqOIycCJqHLj+4HrIkTa64cBd8zNjBbUHneOB6KHwBvd952B9CjquKG/Z4U4/wcS5w2oPv+PgOFWEugSWvF2JlpYs9IvtAwNGy5FMxyBqpzvu6Efo53VLQOUTKjHlCfQEHsRKip2Xp0X1L0POB3N0k1KifJyUp8l3FKbh6y+fZCovw25BIIouiWpbkcG0AwkfJOQL3oU7jpchET5OXR/7QMsRrGhMJHKIPEfh4T5FkY/BN6ALMup6GF2NfBVtC5iZRsmAS9DlvaxqGrjBahc7pKYvtwCfJTg0Y7nq17kjn0Csrr/Dbkk0vxm/j7rAd5OWZy3AOfhxHmwv29MVgtOSgl4FD3xPoaml4MukgvRauOfxYnzYH9fbLTXezn2Rj6xM6hPMKWZeBfLFH9bjYZyI/AndLO+Cy2WWk9KSNjSvAYpL9IwmGA7kFhGHdMT/CdRuirIfbJPxLn3IDHuAe50fQXwN4xetdvPRCT+3vc9ULHU157Ap1BabQn5xt+N/Lr9ngb4dGAb8j2fgUYAIKv3XJKVUg7rw35k2V6PHs6Pue1PRGV7U+ET5zOALzNSnC/BiTO0UBaH74fZhp5696CAwG+Q32/Qv11M43f9iZZ++nvgzcAjwIcIsQTaiJ2ubeeiYdkfgZ1mUTeUHSjmcSyyFM8FlubyhQ317O9G/HZBi7wm+J4dyKI9Ac0/ODKXL9wfst9UJMYAf0WF096BfPb75vKFe0P22weJP8i9s77i87cgQ8T7/N+BjUHHqhD2p5Ar6irk2349cGwuX/hjXLsT6MujSKgPREvJHYYeSml+ix40WvovdC1tReL8HWDEqKyVLOjKDroVWdI3AYNJLWbHFPSj/ABleZyL8qI/AsT5DtuBYXQjXO3adCkqE5vz+sKoOwX0ILzO/X0CGp5mOrS/S2jEsB3pxLEE6IVr+wLk7x1EroT7kOhMA14UdHC335FI/IdQgNDv75+EjKoeZMV+mwQLF/s+XwL8POBY9eiX59z/M+78E+ErSPd3qP7+dPQg/BxKER7lMms5gYbRT7GoIEOFMM8H/gk9OS9DT6lZ6Mc/C4iLRLcFvjZ4aVZzXZu/jSyZHnN71J0MupkuQMPdLBqNHdbsE2sE7hp7ALkeQNfV7iGbvwgZRWvQ8H8ZMog8H3NQ4N8T/V4U6Luz4t7cj3LfPknZbZL03IvIgNnk3j4m4vzTMtH3/x1JdvCJ81uBb6JY23bgM+7vwSBtakmBhrKPOeikK8Qnh57EXwB+j/zVr6Dsc/oL8D4U5OkYfP3yACoR+1cUDf41CqIcirPuTKjrg+vzP6MgTgkN0f8VGF+HPi4Bw36jI+o1RqxD/l6QlXxgwHf3IqHNIBfic6huvJfdcCTBwjiVslvkXnyBf8eByAIHWcPPpzGu3LaPI3cHyHjbq5pOqOj3KcjfDko0eCzFod6MxHg2EufPAl/H+dODaBkfdNKO8jEF5U2fArwaWcqV3I0s6kcg+RTSdrGyXbQd9PB5L5qs8Fbk9jgZ+LF7PWn+6boxiG6yV6JI/ltQYOp/ajzuVGTl9cdstwN4mIiJD3WkiFyM70L321GUBdtjD8p+4ttRfKSEXJSnoBzvA3L5wroKP/EBSPRBvu7Kds+nbHk/zkj3R1I2o0VFjkSpd7NRGmEQux6QEUxH95Y3mW4pipUl6cfXo9xmL6VwNUoVHoi6J9tGoH0dNw8ltp+Kch7DorP3o4yQ+yCxOM9EgYpqLoam4Lvon0UR5u0oOrwPcD5KWbwEpTutNKGuDfdQXIZ8iBej6+8c4LYEudFRLEJCH8f9KPVsfYJt69HWu5BVPB89QC7CPRzctXQgutb6kUCX3H5/Re6F3ZGlXCnsRyHR34TEvJKpvv8H5XcnYZjyxJec+74wCsioOSrgs3GujS9DWSdZJP7/RXwxthLKm/46I2eM7ovu13Nz+cJgJ1jQC9BQ/mQU+Y1yzzyCxPlOSCTOPagTJyDfddvhboo16Am/Fbl1sq6vvoweaBcDVwLrTKhr5pfA61C/vhD4IPCJGnKjexnp2wxjEvVf2DmKZ5GVOB89RGai5e48jnLn9ATgz/J4Alm+RyOXwEWUU/iyjHSLPBLQZ/77e7jKPvXSD3HfFVVzYzLw+ZBjVPb3ShTY+1WCc3gBilvs6c7l1+hBNxeNTG5BvvJA2kmg34JSUeJ4GgUEb4VE4pxDwn8mSg1qG+u5EifSG1EC/Xbgw2gKbAYN876FAqcXIWttswl1elw/70APvuOQeJ2JYiA3VHnYJ5Bve5BoAV5DwsBUnehHQfaTXDsX5vKFle56ySGxAfmJV/v224RmLB6NHmAzUDAQJPKeW+RWZI1W4l9SLx8zXTsMb4IJyM2wPWb7oYD3/AHO55GBcymaxVhKWJMFpCsXIw3zzxw8H6VrBiYwtJNAj0+wzbNInG+E6OwPxwQkYp9AovVYEldIPcSsUcLoxGMbig5vRWLtXaRZ5Lc/CvkWL0LFX3aYUKfD9fNSZB19iXJu9JJcvlDNkHwZEvyBKvZtNLdRdle8GOUBl1Dc5wjfNn6/eAkFVN+PJokdnMsXPIE+xL03gMQ/aAq5f5GNObjZsynPO0/Z59uPgpdhbEGTYp6peP84pBE5JND/iW+yXEKGURrdeehh9H2UFvtGZDidA3wkly/0t0WaXQhxoetVqGrUtZBInKcBX0TJ71tRFa8kdRAi+yxFpL2HBuXQurbvRH5S76LwkwdeA/wMBRFf5d6zWYnpKKHyAze5v18B/CNlCziNKyID9Pqzl6JeY4X7rkdRYBJkMefdNXII8qtuQdZy5X5LkFU9kZG+3cXI4HoGWBLSnmWUA4eH4q7PpLjz24NyIHID5dnJQfSjPPerK15foJz7fhhKa00zE3kQifMngM2urZuQi8TLXDkDZXiMuvfaSaCjfqA1wL8g/04pgTjPQ8P9s5Ff6irgwQTW81SUn1kPJiNrpCH+RNcWL8H/owQHMyaipPnL0UV0DG5UZSIdj+vj9ciC9nKjz0KiMEx6i69V2YKsYZBIecP2FyPD6UmCR5/PUq5tsRjda3nKaWp3UnZ7VPIo5QkhhwMLqrgmX0S5OuZjEd8FIQ9IZNx8wZ1LBrmyXpXiHO5Blvnmiv65C6XDDiAf/idRZssI2kmgBwn2D29AQ4TLSCbOh6IZhqe69q8HfkKw/6mS44mfOdSDLuC4qnxDqGjNQY0SQ9cXQ8jKO5vyBV/JVGT5/QpFm4/AcqjTcDPyS4Jm1L0bXaut6K6ohpJrYx9yNxyOrEivjsadBGda7ESuD5Cwz0TBscMoV+ALu+9WUM78mIPKNSQacbptxgOnUTbsrqd63/0dKEVuCLl5PgXMTXhvbAK2+nXJ/b+ErhkvQPgC5I4ckVPfTgJ9AYp6Xk5ZaDwf609xVbiC8DX4OMpDeo/fA/cktJ7fRHxazXgU0IwrztKH3CxnA7kGi3QR1TD+JyqKoVcwE6X+XIPcPwd67TehDsb17yAakXmTM05HN1xHCLRr41LkdvCEeU/XxiIK9IW5B73c6Hkoo+gwJNJrgTsi7rtBlBq6nXKBqmMhenTn++ytKMsG5Eq4iipGNL775xLKAeDFKGsnm+C+8FZHCTruVpQ54s3WPIWKB1E7CfRKFOU+HU1M+WfXST8kIg3HN8XyjeiJdaTv463umHGTA0CiPh8FCqLYHV0Ycct2DaMHzWnUvzLaCHxP7N8g6+7hmF3moYDXb5DvbL7XlybUo3H9+zTy+e9E4nUm6dxXJaCYdCZhE2YVPo9mq4L8ycchoV1HiIHj3nsICXseCeyxyBV0P2VhCtv3BsqpbHshI+0YIKovsshA+iJy4RVRUO7Ran33PlfW51w/ZJCx84paOtQd937kIutDxt15wEJvm7YRaJ9PaAD96Bcga3gwRpxz6Gb5Hhp++rkRuDWB9TwRPcFXE5+qMw+lFSXxma1AqTb/Ckxt5M3ma+MNrj/uTbDbAcj/dg2y9Gd5fWJCHchVlIesbyDdSikTkYWZ9rVbiu+ohSHkkiii4OCp6N7yBDiMNZRn252IikyBCjHFuRx2IAvzbvf3ImRVn4cs8d2Q8OfRaHQx8ut+n/K07qtR+Yc0CyGEcTuK6RTd930SmFXjvVBybbrc/X2ga9+kXL7QPgLtURnFjqnVMQFVxPtvRk8F34ks6iR+qZe514PEr5BwMHIVRBbRcee9yh3vlWh409AJCBVFlt5J2T8Yx+GuD3+FcsV399prQi1c325HqXLLKQtHUl5EOY866et6dO2MVfv+igR3FhrFgq6lKKNlCLlASsjyXuS2/xMxLgf3nY+gMgaeP3pvJNrXuf66Ek0auhZVrvwQuj6L7rOPAOtrzXxx+w+jkqA3ubePRy7B3hpXCN+OLH5vZPt3KD6VaTuB9jcsTJwd/jS6yQGHuJ2YSQW+YMOZ6GZ7OMEqwYeRfPmu5ynXdv4Q1UWqU/ebY6lr1x8S7tqLLJSLUQ2Bt6Loc6cLtTdXIHblbZ+v9luMFJ+ofb3jj0M5u3NSvObifoMYMr7vqWXuw1PIz+7NyhtGD/lQofUJ+xa3Txa5gx5IIZr3IMH6GuVUudnI3fF65FL0qu0VUQbIvyFhfybme7zfJkuMgeSOsxaNKtej+/yDyNVRuW/a6+YRpFc7kdacBxzbThNV0rAXSig/hWA3ziDyPW9OcJEcg4Zm64kOsIFSjg51/38B5TXGwliHnp7e8PZs4GNRc/Prga/I0qNoVtM30EyxJOTQMPUYlDd6IbIo+jpwsstm9EDaneSjjSLKEiqgySvgZp0FbLsNBZ8S1xQO4KEE22xBLr7pSAiqnS27E/3enqW3ldFlQoN4DM2cm+P+XkJ8sB0Yca0uQ9laP0SjhqORNT0B9e0W5NO+Dbkun/b2j6CErO416LdIdE5oevbHkCvTqwnd4+vXrei6meb6O6l75Qp0rXm52/PGck7/mJDLF2ahG+R1EZvdgYKGa2P8z3l0A52GfLavHuzvWx+x/Tx0cSxAP/arBvv7lkZsPxdZ8Qe5tzag4kbXj4XI+azeOSjA5aUepmELmjZ+ERruJlr5ph2oHBVUszhx1P71GnWkXGUoVVuqaVe99os5Ti8a3Xr1NfooV9JraL+EtCcz2N9XqvdxO9GCzhGQ8O1jGOU9x4kzyGfmCf1TSIyi2Jeyr3t3VLdgacT3bGVkVbJp6Ml8dy5f2NRokfNZJ6uQi2UbCoamuS52Q8J+IvL5XYyWoy9639Gu1Bj1b9jxx6odY90fSY/jrtlhdL1W/V11bk/iB0Oa47atDzqC1USvEfYwyapQeUWUvGLjjxBRg9c39dXzCfZSHgKF0cfotD0vYDgm+Hz569EQ8htUl787Hfn8fo2s8UO8fulg/7TRBFphCvxY0YkCPUTw8u24934OPJfAen4hSpUC+ZDicod7GJ25cQTRkfwhRlYAAz0Y/pkxCBj6cf2xBVXX+g+qWEreMRdNu/8N8Gnc1HgTasNITycKNChqvCng/adRvmHcjKIsSieb6f7eBjwZ84Qej7MafexP9IQV/wKUfhai6HDDZhgG4dq3Awn0+cS7dKLYF2XQXINqgcxlbOsYG0bbE5sC0m4Uh4fozWa3IpFdjersLkNC+FPgd54zPwgniIejXEsvPW85cEFxeChUsHqz2XmoLOFU39sF4Pe92eyy4vDokgPuXBcQnEFxAApmBu7b4P7zVg3fgGZ+JSn1GsYMlDM7D/htcXhoLJZqMoyOoBODhFBeLbcXWW097v8DxKe89KLp5HN87z1DxBJDTtT3o2xxe0xA6XZRKxKvRlPNK10h09EMw3ty+UKSdMC64YKHQyjgtw35lGfXcMgMI9eYMwwjAZ3q4gC5D4ZQYK8fDd2HEvieD0Kpbn4eQwG9KA4h2NJcRHQ/ryHc3zsmMwyD8BWJ+Rkqobm8pgPWZ6qtYXQVHSnQNUR5e1DO87yK9x8m2m/dg9wiQRxKdL2EDYT7esehgOF8moCvyNJVaELL4804D8PoVjpSoKvB56aoTHHrI74S1iR8Fagq2Idy4ZYgthA923ATEel9jcbX7uvQ1PD7m3UuhtFtmECXyaAJF5UVyNYzep2ySmYjIQ5iGlqPLWzf7YQL9Go0Jz+s0P6Y4BPpP6Pc8DuqP5phGEkxgWaX9bw3roJUxccriK8BfQDluguVZJEfOsyPPIBm4N3LyMp6A6ieyC3N7h8YIdJ3I0v6xuqPZhhGEkygRQatZHBgwGdPEjCltIK9iJ6QEpXBUER1LF6DFo78Eqpp8RNU17bYKjOkfOfxECr8/9sUu1sGh2GkpOtvGmc974nq+Aalkl0G3ByVi9ybzXouiBcwUqiH0Yy6LwKrInKhQdbzU6jG7y9RrdutrSLOAee7Ea1TtxfKYAkbIWxF1csuB24rDg9VW0nNMLqOTs2DTsvJlMuE+hlCNTjiWIXqz96BZs8diqrZfR2VZ9wYtbNfhN0DY2Pl+62Er8jSSjTjcRtadNZ74G9CqznfgFwh9xEdCDUMI4CunnrrRGYWGqq/KGCTDajE6D0JjwXK5ngXsoSvxeX/tqrY1opvQd3zUS2Sm5AwP4TqKe+iU/vAMBqFCbTyey8keDTxEHDCYH9fXJDQfzxQv5agO0TJtXscKvQ0Yvmjbmi/YTSKrnVxOFGZjtLGwvrhaYKLLgXiG/p3jTj72j2AK1PaLe02jEbTtQLteD3Brg2PR0hZG7lbxalb220YjaQr0+x8ftN3Ul4yp5ISEui40qSGYRgNoSsF2nEiWvg0jB3A42YZGobRLLpOoJ31PBnNhouaXLKO2iu4GYZhVE3XCbTjFcBLYrZZDqxt9okahtG9dJVAO+t5IspTnhCz+eOMrI1hGIYxpnSVQDuOB05IsN3DWJF5wzCaSLcJdAFZz5Nithsgvga0YRhGQ+kagXbujWNQ9kYcm9AkFcMwjKbRNQKN8p3fCUxJsO0qVCzfMAyjaXSFQDvr+W/QzMEkPElFoR/DMIyxpisEGhXxeQdafioJj9DEdQANwzCgCwTaWc9HACcl3KWIMjgMwzCaSscLNCoI9Y/AzITbbwOesAwOwzCaTUcLtLOeD0ErpiRlDVoo1jAMo6l0tEC79p2B1hxMyjJseSbDMFqAjhVoZz0fhFbrTsPjwM5mn79hGEbHCrRr26nA3in3exirAW0YRgvQyQK9AAl0GvqwKd6GYbQInSzQRwP7pdxnA/JBG4ZhNJ1OFuhbgD+n3GcFyuIwDMNoOp0s0M8CnwBWptjnCWBrs0/cMAwDOlugAW4DPo98y0l4FBhu9kkbhmFABwu0C/SVgB8DP4nZvA+4j/QuEcMwjIaRafYJNBqXDz0f+F9gse+j7chivhm4HrgbWDPY32erqBiG0RJ0vEDDLpF+BXARsBG4EYnyUrR69y4sxc4wjFahmwS6F80sXEvFat0myoZhtCL/H13P6HU/0cFCAAAAAElFTkSuQmCC",
  "base64"
);

// ---------------------------------------------------------------------------
// Google Fonts link tags
// ---------------------------------------------------------------------------

export function brandFonts(): string {
  return `<link rel="icon" href="https://app.regen.network/favicon.ico" type="image/x-icon">
<link rel="preconnect" href="https://fonts.googleapis.com">
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
    .regen-footer__social { margin-bottom: 8px; }
    .regen-footer__social a:hover { color: var(--regen-green); }
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
      <div class="regen-footer__social">
        <a href="https://x.com/RegenCompute" target="_blank" rel="noopener" title="Follow @RegenCompute on X" style="display:inline-flex;align-items:center;gap:6px;color:var(--regen-gray-500);font-size:13px;text-decoration:none;transition:color 0.2s;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          Follow @RegenCompute
        </a>
      </div>
      ${opts?.showInstall ? `<div class="regen-footer__install">claude mcp add -s user regen-compute -- npx regen-compute</div>` : ""}
      <div class="regen-footer__note">Credits are permanently retired on a public ledger. Powered by Regen Network.</div>
    </footer>
    `;
}
