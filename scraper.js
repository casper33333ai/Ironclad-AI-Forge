const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function ironcladScrape() {
  const url = process.env.AI_URL || "https://aistudio.google.com/u/1/apps/drive/1C95LlT34ylBJSzh30JU2J1ZlwMZSIQrx?showPreview=true&showAssistant=true";
  const rawCookies = process.env.SESSION_COOKIES || '[]';
  
  console.log('🛡️ [V14.9] Initializing Ironclad Protocol...');

  // Smart Search for Chrome/Chromium binaries to prevent Exit Code 100
  const possiblePaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    process.env.CHROME_PATH
  ].filter(p => p && fs.existsSync(p));

  const launchOptions = {
    headless: "new",
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--disable-dev-shm-usage', 
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--js-flags="--max-old-space-size=512"'
    ]
  };

  if (possiblePaths.length > 0) {
    console.log(`🔍 [LOCATOR] Using detected binary: ${possiblePaths[0]}`);
    launchOptions.executablePath = possiblePaths[0];
  } else {
    console.log('⚠️ [LOCATOR] No system chrome detected, relying on Puppeteer default.');
  }

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions);
  } catch (launchError) {
    console.error('💥 [CRASH] Ironclad Launch Failure (Exit 100 Fix):', launchError.message);
    process.exit(1);
  }
  
  try {
    const page = await browser.newPage();
    const androidUA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36';
    await page.setUserAgent(androidUA);

    if (rawCookies && rawCookies.length > 20) {
      console.log('🍪 [AUTH] Injecting Session Vault...');
      const cookies = JSON.parse(rawCookies);
      await page.setCookie(...cookies.map(c => ({
        ...c, 
        domain: c.domain || '.google.com',
        secure: true,
        httpOnly: c.httpOnly || false,
        sameSite: 'Lax'
      })));
      await delay(3000);
    }

    console.log('🌐 [NAVIGATE] Establishing Tunnel to: ' + url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
    
    console.log('⏳ [HYDRATE] Waiting for SPA stabilization...');
    await delay(15000); 

    const bundleData = await page.evaluate(() => {
      return {
        html: document.body.innerHTML,
        head: document.head.innerHTML,
        origin: window.location.origin,
        cookies: document.cookie
      };
    });

    const finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <base href="${bundleData.origin}/">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
  <title>Ironclad AI Native</title>
  ${bundleData.head}
  <script>
    (function() {
      const cookies = ${JSON.stringify(bundleData.cookies)};
      if (cookies) {
        cookies.split(';').forEach(c => {
          document.cookie = c.trim() + "; domain=.google.com; path=/; SameSite=Lax";
        });
      }
    })();
  </script>
  <style>
    body { background: #000 !important; color: #fff !important; margin: 0; padding: 0; }
    #forge-container { width: 100vw; height: 100vh; overflow: auto; -webkit-overflow-scrolling: touch; }
  </style>
</head>
<body class="ironclad-v14-9">
  <div id="forge-container">${bundleData.html}</div>
</body>
</html>`;

    if (!fs.existsSync('www')) fs.mkdirSync('www', { recursive: true });
    fs.writeFileSync(path.join('www', 'index.html'), finalHtml);
    console.log('✅ [IRONCLAD] Extraction successful.');
  } catch (err) {
    console.error('❌ [FATAL] Ironclad Extraction Error:', err.message);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}
ironcladScrape();