/**
 * Beta banner + feedback widget for community testing.
 *
 * Exports three functions that inject CSS, HTML, and JS into any page.
 * Remove this file and the 3 interpolations per page to exit beta mode.
 */

export function betaBannerCSS(): string {
  return `
    /* Beta banner */
    .beta-banner {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      background: #f59e0b; color: #1a1a1a;
      text-align: center; padding: 8px 40px 8px 16px;
      font-size: 14px; font-weight: 600;
      border-bottom: 2px dashed #d97706;
      font-family: -apple-system, system-ui, sans-serif;
    }
    .beta-banner a { color: #1a1a1a; text-decoration: underline; }
    .beta-banner .beta-dismiss {
      position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
      background: none; border: none; font-size: 18px; cursor: pointer;
      color: #1a1a1a; padding: 4px 8px; line-height: 1;
    }
    body.beta-active { padding-top: 40px; }

    /* Feedback widget */
    .beta-fb-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 9998;
      width: 48px; height: 48px; border-radius: 50%;
      background: #2d6a4f; color: #fff; border: 2px dashed #1b4332;
      font-size: 22px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 12px rgba(0,0,0,0.15);
      animation: beta-pulse 2s ease-in-out infinite;
    }
    @keyframes beta-pulse {
      0%, 100% { box-shadow: 0 2px 12px rgba(0,0,0,0.15); }
      50% { box-shadow: 0 2px 20px rgba(45,106,79,0.4); }
    }
    .beta-fb-card {
      position: fixed; bottom: 84px; right: 24px; z-index: 9998;
      width: 320px; background: #fff; border: 2px dashed #d1d5db;
      border-radius: 12px; padding: 20px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.12);
      font-family: -apple-system, system-ui, sans-serif;
      display: none;
    }
    .beta-fb-card.open { display: block; }
    .beta-fb-card h3 { margin: 0 0 12px; font-size: 16px; color: #1a1a1a; }
    .beta-fb-card label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 4px; }
    .beta-fb-card input, .beta-fb-card select, .beta-fb-card textarea {
      width: 100%; padding: 8px 10px; border: 1px solid #d1d5db;
      border-radius: 6px; font-size: 14px; margin-bottom: 10px;
      font-family: inherit;
    }
    .beta-fb-card textarea { min-height: 80px; resize: vertical; }
    .beta-fb-card .beta-fb-submit {
      display: block; width: 100%; padding: 10px;
      background: #2d6a4f; color: #fff; border: none;
      border-radius: 6px; font-size: 14px; font-weight: 600;
      cursor: pointer;
    }
    .beta-fb-card .beta-fb-submit:hover { background: #1b4332; }
    .beta-fb-card .beta-fb-msg {
      font-size: 13px; text-align: center; margin-top: 8px;
      padding: 8px; border-radius: 6px;
    }
  `;
}

export function betaBannerHTML(): string {
  return `
    <div class="beta-banner" id="betaBanner">
      BETA — Thank you for testing! Your feedback shapes this product.
      <button class="beta-dismiss" onclick="document.getElementById('betaBanner').remove();document.body.classList.remove('beta-active');" aria-label="Dismiss">&times;</button>
    </div>
    <button class="beta-fb-btn" id="betaFbBtn" title="Send feedback" aria-label="Send feedback">&#9993;</button>
    <div class="beta-fb-card" id="betaFbCard">
      <h3>Send Feedback</h3>
      <form id="betaFbForm">
        <label for="beta-fb-name">Name (optional)</label>
        <input type="text" id="beta-fb-name" name="name" placeholder="Your name">
        <label for="beta-fb-cat">Category</label>
        <select id="beta-fb-cat" name="category">
          <option value="comment">Comment</option>
          <option value="bug">Bug Report</option>
          <option value="suggestion">Suggestion</option>
        </select>
        <label for="beta-fb-msg">Message *</label>
        <textarea id="beta-fb-msg" name="message" required placeholder="What's on your mind?"></textarea>
        <button type="submit" class="beta-fb-submit">Submit</button>
        <div class="beta-fb-msg" id="betaFbStatus" style="display:none;"></div>
      </form>
    </div>
  `;
}

export function betaBannerJS(): string {
  return `
  <script>
  (function() {
    document.body.classList.add('beta-active');
    var btn = document.getElementById('betaFbBtn');
    var card = document.getElementById('betaFbCard');
    btn.addEventListener('click', function() { card.classList.toggle('open'); });
    document.getElementById('betaFbForm').addEventListener('submit', function(e) {
      e.preventDefault();
      var status = document.getElementById('betaFbStatus');
      var msg = document.getElementById('beta-fb-msg').value.trim();
      if (!msg) return;
      status.style.display = 'block';
      status.style.background = '#f0f7f4';
      status.style.color = '#2d6a4f';
      status.textContent = 'Sending...';
      fetch('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: document.getElementById('beta-fb-name').value.trim() || null,
          message: msg,
          category: document.getElementById('beta-fb-cat').value,
          page: window.location.pathname
        })
      }).then(function(r) {
        if (r.ok) {
          status.textContent = 'Thank you! Feedback received.';
          document.getElementById('betaFbForm').reset();
          setTimeout(function() { card.classList.remove('open'); status.style.display = 'none'; }, 2000);
        } else {
          status.style.background = '#fef2f2'; status.style.color = '#991b1b';
          status.textContent = 'Failed to send. Please try again.';
        }
      }).catch(function() {
        status.style.background = '#fef2f2'; status.style.color = '#991b1b';
        status.textContent = 'Network error. Please try again.';
      });
    });
  })();
  </script>
  `;
}
