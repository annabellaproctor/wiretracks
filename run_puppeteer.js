import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  await page.setCacheEnabled(false);

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

  console.log('Navigating to http://localhost:5173/ (bootstrapping projects in IndexedDB)...');
  try {
    await page.goto('http://localhost:5173/');
    await new Promise(r => setTimeout(r, 2000));

    console.log('Opening project document URL /doc/doc_led_driver...');
    await page.goto('http://localhost:5173/doc/doc_led_driver');
    await new Promise(r => setTimeout(r, 2000));

    // Recalculate routes to make sure they are active
    await page.evaluate(() => {
      window.dispatchEvent(new Event('resize'));
    });
    await new Promise(r => setTimeout(r, 1000));

    // Capture screenshot
    const screenshotPath = '/Users/aap/.gemini/antigravity-ide/brain/49372488-3749-434d-85d1-e3f66f6c98d9/simulating.png';
    await page.screenshot({ path: screenshotPath });
    console.log('Saved screenshot to:', screenshotPath);

    const diagnostics = await page.evaluate(() => {
      const traces = window.__traces || [];
      return {
        traces: traces.map(t => ({
          id: t.id,
          from: t.from,
          to: t.to,
          path: t.path
        }))
      };
    });

    console.log('ACTIVE TRACES PATHS:', JSON.stringify(diagnostics.traces, null, 2));

  } catch (e) {
    console.error('Error during screenshot:', e);
  } finally {
    await browser.close();
  }
})();
