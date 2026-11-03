const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const NM = path.join(__dirname, 'node_modules');
const SRC = path.join(__dirname, '../src/');
const svg = (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="160"><rect width="220" height="160" fill="${c}"/><circle cx="110" cy="80" r="40" fill="#fff8"/></svg>`;
const contactForm = (captcha) => `<html><body><div id="mw-content-text"><form method="post" action="/w/index.php?title=Special:Contact">
<input name="wpFromName" value=""><input name="wpFromAddress" type="email" value=""><input name="wpSubject" value="פנייה מהאתר">
<textarea name="wpText"></textarea><input type="checkbox" name="wpCCme" value="1" checked>
${captcha ? '<div class="captcha"><p><label for="wpCaptchaWord">כמה זה שלוש ועוד ארבע?</label> <input name="wpCaptchaWord"></p><input type="hidden" name="wpCaptchaId" value="12345"></div>' : ''}
<input type="hidden" name="wpEditToken" value="+\\"><input type="hidden" name="title" value="Special:Contact"><input type="hidden" name="wpFormIdentifier" value="contactpage"><button type="submit" name="x">שליחה</button></form></div></body></html>`;

function page(cfg) {
  return `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<link rel="stylesheet" href="/nm/oojs-ui/dist/oojs-ui-core-wikimediaui.rtl.css">
<link rel="stylesheet" href="/nm/oojs-ui/dist/oojs-ui-widgets-wikimediaui.rtl.css">
<link rel="stylesheet" href="/nm/oojs-ui/dist/oojs-ui-windows-wikimediaui.rtl.css">
<link rel="stylesheet" href="/nm/oojs-ui/dist/oojs-ui-images-wikimediaui.rtl.css">
<link rel="stylesheet" href="/nm/oojs-ui/dist/oojs-ui-wikimediaui-icons-alerts.rtl.css"><link rel="stylesheet" href="/nm/oojs-ui/dist/oojs-ui-wikimediaui-icons-interactions.rtl.css">
<link rel="stylesheet" href="/src/ContentReport.css">
<style>body{font-family:sans-serif;margin:0}.mw-body{padding:20px}</style>
<script>window.MWCONFIG=${JSON.stringify(cfg.config)};window.RIGHTS=${JSON.stringify(cfg.rights)};</script>
<script src="/nm/jquery/dist/jquery.js"></script><script src="/nm/oojs/dist/oojs.js"></script>
<script src="/nm/oojs-ui/dist/oojs-ui-core.js"></script><script src="/nm/oojs-ui/dist/oojs-ui-widgets.js"></script>
<script src="/nm/oojs-ui/dist/oojs-ui-windows.js"></script><script src="/nm/oojs-ui/dist/oojs-ui-wikimediaui.js"></script>
<script src="/mwstub.js"></script></head><body>
<div class="mw-body"><h1>אלברט איינשטיין</h1><div id="p-tb"><ul></ul></div><div id="mw-content-text">
<p>טקסט הערך <img src="/w/upload/michlol/1/1a/Icon.svg" width="16" height="16"></p>
<a href="/wiki/%D7%A7%D7%95%D7%91%D7%A5:Einstein_1921.jpg" class="mw-file-description"><img src="/w/upload/michlol/thumb/a/ab/Einstein_1921.jpg/220px-Einstein_1921.jpg" width="220" height="160"></a>
<a href="/wiki/%D7%A7%D7%95%D7%91%D7%A5:Einstein_family.jpg" class="mw-file-description"><img src="/w/upload/michlol/thumb/c/cd/Einstein_family.jpg/220px-Einstein_family.jpg" width="220" height="160"></a>
<a href="/wiki/Other"><img src="/w/upload/michlol/e/ef/Map.png" width="220" height="160"></a>
</div></div><script src="/src/ContentReport.js"></script></body></html>`;
}

(async () => {
  const browser = await chromium.launch();
  const results = {};
  for (const scenario of ['user', 'anon']) {
    const cfg = scenario === 'user'
      ? { config: { wgNamespaceNumber: 0, wgAction: 'view', wgArticleId: 10, wgPageName: 'אלברט_איינשטיין', wgRevisionId: 4242, wgArticlePath: '/wiki/$1', wgUserName: 'Tester' }, rights: ['edit', 'editmywatchlist'] }
      : { config: { wgNamespaceNumber: 0, wgAction: 'view', wgArticleId: 10, wgPageName: 'אלברט_איינשטיין', wgRevisionId: 4242, wgArticlePath: '/wiki/$1', wgUserName: null }, rights: ['read'] };
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const posts = [];
    await p.route('**/*', async (route) => {
      const u = new URL(route.request().url()); const pn = decodeURIComponent(u.pathname);
      if (pn === '/article') return route.fulfill({ contentType: 'text/html', body: page(cfg) });
      if (pn.startsWith('/nm/')) return route.fulfill({ path: path.join(NM, pn.slice(4)) });
      if (pn.startsWith('/src/')) return route.fulfill({ path: path.join(SRC, pn.slice(5)) });
      if (pn === '/mwstub.js') return route.fulfill({ path: path.join(__dirname, 'mwstub.js') });
      if (pn.startsWith('/w/upload/')) return route.fulfill({ contentType: 'image/svg+xml', body: svg(pn.includes('family') ? '#7a9' : pn.includes('Map') ? '#c96' : '#69c') });
      if (pn.startsWith('/wiki/Special:Contact')) return route.fulfill({ contentType: 'text/html', body: contactForm(true) });
      if (pn === '/w/index.php' && route.request().method() === 'POST') { posts.push(route.request().postData()); return route.fulfill({ contentType: 'text/html', body: '<html><body><h1 id="firstHeading">הדואר נשלח</h1><div id="mw-content-text"><p>ההודעה נשלחה.</p><p id="mw-returnto">חזרה</p></div></body></html>' }); }
      return route.fulfill({ status: 404, body: '' });
    });
    await p.goto('http://test.local/article');
    await p.waitForSelector('#buttonFeedback a');
    await p.screenshot({ path: `${__dirname}/../docs/${scenario}-0-page.png` });
    await p.click('#buttonFeedback a');
    await p.waitForSelector('.oo-ui-processDialog-content .hm-report-notice', { state: 'visible' });
    await p.waitForTimeout(700);
    // choose image type
    await p.click('text=תמונה בעייתית');
    await p.waitForTimeout(300);
    const imgLabels = await p.$$eval('.hm-report-image-name', els => els.map(e => e.textContent));
    await p.click('.hm-report-image-name >> text=Einstein family.jpg');
    await p.fill('.oo-ui-processDialog-content textarea', 'נא לבדוק את התמונה הזו');
    if (scenario === 'anon') {
      await p.waitForSelector('.hm-report-captcha p', { state: 'visible' });
      await p.fill('input[type=email]', 'me@example.com');
      await p.waitForTimeout(200);
      const disabledBeforeCaptcha = await p.$eval('.oo-ui-processDialog-actions-primary .oo-ui-widget', e => e.classList.contains('oo-ui-widget-disabled'));
      results.anonDisabledBeforeCaptcha = disabledBeforeCaptcha;
      await p.fill('.hm-report-anon .oo-ui-fieldLayout:last-child input:not([type=email])', '7');
    }
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${__dirname}/../docs/${scenario}-1-form.png` });
    await p.click('.oo-ui-processDialog-actions-primary >> text=שליחה');
    await p.waitForSelector('.hm-report-done', { state: 'visible' });
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${__dirname}/../docs/${scenario}-2-done.png` });
    results[scenario] = { errors, imgLabels, calls: await p.evaluate(() => TEST.calls.filter(c => c[0] !== 'get' || c[1].action === 'parse')), posts, done: await p.$eval('.hm-report-done', e => e.innerText), trackVisible: await p.isVisible('text=מעבר לדיווח') };
    await ctx.close();
  }
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})();
