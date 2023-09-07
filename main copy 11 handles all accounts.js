const puppeteer = require('puppeteer');
const readline = require('readline');
const rl = readline.createInterface({ 
  input: process.stdin,
  output: process.stdout
});
const fs = require('fs/promises'); 

const date = '202206 - 2022 June';
const websiteUrl = 'https://www.pdsadm.com/PAnet/Account/Login';
const cessionUrl = 'https://www.pdsadm.com/PAnet/Common/CessionStatements';
const username = 'PORC210103rm';
const password = 'reinsassoc';

async function readStatus(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return data.trim();
  } catch {
    return '0';
  }
}

async function writeStatus(filePath, status) {
  await fs.writeFile(filePath, status); 
}

async function loginToWebsite(page) {
  await page.goto(websiteUrl);

  await page.type('#UserName', username);
  await page.type('#Password', password);
  await page.click('#LoginButton');
  
  await page.goto(cessionUrl);
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const desiredDate = "202303 - 2023 March"; // Adjust to the date you want

  await page.evaluate((desiredDate) => {
    let select = document.querySelector('select[ng-model="selectedDate"]');
    for(let i = 0; i < select.options.length; i++) {
      if(select.options[i].textContent === desiredDate) {
        select.value = select.options[i].value;
        select.dispatchEvent(new Event('change'));
        break;
      }
    }
  }, desiredDate);
  
  await new Promise(resolve => setTimeout(resolve, 1000));
}



async function getPdfNames(page) {
  await page.waitForSelector('span.ng-binding');
  const pdfNames = await page.$$eval('span.ng-binding', spans => spans.map(span => span.textContent.trim()));
  return pdfNames;
}

async function clickSummaryVescLinks(page) {
  await page.waitForSelector('span.ng-binding');
  
  // Get all the span elements and filter for those that contain "Summary VESC"
  const spanElements = await page.$$('span.ng-binding');
  
  for (let i = 0; i < spanElements.length; i++) {
    const span = spanElements[i];
    const spanText = await page.evaluate(el => el.textContent.trim(), span);

    if (spanText.includes("Summary VESC")) {
      // Use evaluate() to manually click the element if it is hidden
      await page.evaluate(el => el.click(), span);
      // You might want to add a delay after each click to allow for any page reactions
      await page.waitForTimeout(10000);
    }
  }
}

async function main() {
  const browser = await puppeteer.launch({headless: false});
  const page = await browser.newPage();
  
  await loginToWebsite(page);
  
  //this gets all the .pdf files.  not what we need unfortunately.
  //const pdfNames = await getPdfNames(page);
  //pdfNames.forEach(name => console.log(name));

  // instead of pdf names locate the Summary VESC and click it
  await clickSummaryVescLinks(page);

  //await browser.close();
}

main();
