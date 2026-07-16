import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function capture() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Wiretracks
  await page.setViewport({ width: 1200, height: 800 });
  await page.goto('http://localhost:5173');
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: join(__dirname, 'wiretracks_sc.png') });
  
  // Partcount Base
  await page.goto('http://localhost:8437');
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: join(__dirname, 'partcount_home.png') });
  
  // Partcount Components
  await page.goto('http://localhost:8437/components');
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: join(__dirname, 'partcount_components.png') });

  // Partcount Registry
  await page.goto('http://localhost:8437/registry');
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: join(__dirname, 'partcount_registry.png') });

  // Partcount Boxes
  await page.goto('http://localhost:8437/boxes');
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: join(__dirname, 'partcount_boxes.png') });

  // Partcount Orders
  await page.goto('http://localhost:8437/orders');
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: join(__dirname, 'partcount_orders.png') });

  await browser.close();
}

capture().catch(console.error);
