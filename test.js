const puppeteer = require('puppeteer');

async function run() {
  const browser = await puppeteer.launch({
    headless: false, 
    defaultViewport: null
  });

  const page = await browser.newPage();
  await page.goto('https://www.bing.com');

  // Don't close the browser
  // await browser.close();
}

run().catch(console.error);
