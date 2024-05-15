'use strict';
const fs = require('fs');
const path = require('path');
const send_team = require('./send_team');


function showsHelp(){
  console.error('===================== Usage =====================');
  console.error('Example: node bok.js 202401');
  console.error('Example: node bok.js current 1');
  process.exit(1);
}

// Check if the user has provided a parameter
if (process.argv.length != 3 && process.argv.length != 4) {
  showsHelp();
}

let year, month;

if (process.argv.length == 3) {
	// Extract the parameter
	const dateParam = process.argv[2];

	// Validate the date parameter format
	const datePattern = /^(?<year>\d{4})(?<month>\d{2})$/;
	const match = dateParam.match(datePattern);

	if (!match) {
		console.log("The date parameter is not in the correct format. Please use YYYYMM.");
		process.exit(1); // Exit with an error code
	}
	// Separate the year and month
	year = match.groups.year;
	month = match.groups.month;
}

if (process.argv.length == 4) {
	if (process.argv[2] == 'current') {
		let months = process.argv[3];
    const monthsAgo = new Date();
    monthsAgo.setMonth(monthsAgo.getMonth() - months);
		year = monthsAgo.getFullYear();
		month = String(monthsAgo.getMonth() + 1).padStart(2, '0');
	}
	else {
		showsHelp();
	}
}

console.log(`Year: ${year}, Month: ${month}`);

const puppeteer = require('puppeteer');
const loginUrl = "https://clientpoint.fisglobal.com/tdcb/main/UserLogon?bankNumber=RK&subProduct";
const downloadsFolderPath = "./downloads";
const renamed_downloadsFolderPath = "./uploader/to_be_uploaded";

const accounts = [
  {
    username: 'GA02922',
    password: 'BOKverify*1',
    groupdropdown: ['CBAG00001', 'CBAG00002']
  },
  {
    username: 'BA02DM7',
    password: 'BOKverify*2',
    groupdropdown: ['DLST00000']
  },
  {
    username: 'BA02D1R',
    password: 'BOKverify*3',
    groupdropdown: ['DLST00000']
  },
  // ... more accounts
];


async function customWait(page, waitTime = 1000) {
  await page.waitForTimeout(waitTime);
}


async function click(page, selector, waitTime = 500) {
  await page.click(selector);
  await page.waitForTimeout(waitTime);
}


async function hover(page, selector, waitTime = 500) {
  await page.hover(selector);
  await page.waitForTimeout(waitTime);
}


// Function to check and return an available filename
function getAvailableFilename(dir, base, ext, callback) {
  let i = 0;
  let filename;
  do {
    const suffix = i === 0 ? '' : `(${i})`;
    filename = path.join(dir, `${base}${suffix}${ext}`);
    i++;
  } while (fs.existsSync(filename));
  callback(filename);
}


// Function to watch the downloads directory for a new file to appear
function waitForDownloadComplete(folder, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const watcher = fs.watch(folder, (eventType, filename) => {
      // Check if the event is for a file ending with .pdf and it's not a temporary .crdownload file
      if (eventType === 'rename' && filename.endsWith('.pdf') && !filename.endsWith('.pdf.crdownload')) {
        watcher.close();
        resolve(path.join(folder, filename));
      }
    });

    // Set a timeout to avoid waiting indefinitely
    setTimeout(() => {
      watcher.close();
      reject(new Error('File did not download within the expected time.'));
    }, timeout);
  });
}


// Function to watch the downloads directory for a new file to appear
function watchForDownload(directory, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const watcher = fs.watch(directory, (eventType, filename) => {
      if (eventType === 'rename') {
        watcher.close();
        resolve(path.join(directory, filename));
      }
    });

    // Set a timeout in case the file doesn't download
    setTimeout(() => {
      watcher.close();
      reject(new Error('Download did not start within the timeout period'));
    }, timeout);
  });
}


async function bok() {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
    devtools: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--safebrowsing-disable-download-protection' // Disable multiple download warning and download protection
    ],
    slowMo: 50,
  });

  try {
    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on('request', async (request) => {
      if (request.isInterceptResolutionHandled()) {
        return;
      }

      if (request.url().includes('online-metrix.net')) {
        return request.abort();
      }

      return request.continue();
    });

    // Change the way we set the download behavior
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: path.resolve(downloadsFolderPath),
    });

    for (const account of accounts) {
      // LOGIN
      console.log("Account: " + account.username);

      const currentDate = new Date();
      const scrshot_path = currentDate.toISOString().split('.')[0].replace('T', '--').replace(/:/g, '-') + `-bok-${account.username}-${year}-${month}`;
      fs.mkdirSync(`../azure-screenshots/${scrshot_path}`, { recursive: true }, (err) => {
        if (err) {
          return console.error(err);
        }
      });
      console.log(`All screenshots for ${account.username} are saved into '${scrshot_path}' folder`);
      
      let total_count = 0;

      await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
      await new Promise(resolve => setTimeout(resolve, 10000));

      await page.screenshot({path: `../azure-screenshots/${scrshot_path}/0.jpg`});
      console.log(`0.jpg generated`);

      await page.waitForSelector('#idfield');
      await page.type('#idfield', account.username, { delay: 3 });
      await page.screenshot({path: `../azure-screenshots/${scrshot_path}/1.jpg`});
      console.log(`1.jpg generated`);

      await page.waitForSelector('#txtPassword');
      await page.type('#txtPassword', account.password, { delay: 50 });
      await customWait(page, 2000);
      await page.screenshot({path: `../azure-screenshots/${scrshot_path}/2.jpg`});
      console.log(`2.jpg generated`);

      await click(page, '#signin');
      await customWait(page, 8000);

      await page.screenshot({path: `../azure-screenshots/${scrshot_path}/3.jpg`});
      console.log(`3.jpg generated`);

      const cookiesButton = await page.$('#onetrust-accept-btn-handler');
      await new Promise(resolve => setTimeout(resolve, 5000));

      if (cookiesButton) {
        await Promise.all([
          cookiesButton.click(),
        ]);
        console.log('Clicked cookies button. Waiting for calm...');
      }
      else {
        console.log('Cookies button does not exist, skipping...');
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
      await page.screenshot({path: `../azure-screenshots/${scrshot_path}/4.jpg`});
      console.log(`4.jpg generated`);

      try {
        // clicking the Statements drop down which doesn't appear in code until you hover on Documents

        // XPath expression to select the 'Documents' menu item based on its text content
        const documentsMenuItemXPath = "//td[contains(@class, 'gwt-MenuItem') and text()='Documents']";

        // XPath expression to select the 'Statements' menu item based on its text content
        const statementsMenuItemXPath = "//td[contains(@class, 'gwt-MenuItem') and text()='Statements']";

        let statementsMenuItemFound = false;
        const maxRetries = 5; // Maximum number of retries
        let retryCount = 0;

        while (!statementsMenuItemFound && retryCount < maxRetries) {
          try {
            // Wait for the 'Documents' menu item to be rendered and hover over it
            await page.waitForXPath(documentsMenuItemXPath, { visible: true });
            const [documentsMenuItem] = await page.$x(documentsMenuItemXPath);
            await documentsMenuItem.hover();

            // Wait for a bit to give the UI time to react to the hover
            await customWait(page, 2000);

            // Wait for the 'Statements' menu item to be rendered
            await page.waitForXPath(statementsMenuItemXPath, { visible: true });
            const [statementsMenuItem] = await page.$x(statementsMenuItemXPath);

            // If the 'Statements' menu item is found, click it
            if (statementsMenuItem) {
              await statementsMenuItem.click();
              statementsMenuItemFound = true;
              console.log('Successfully clicked on the Statements menu item.');
            }
          } catch (error) {
            console.log(`Attempt ${retryCount + 1}: Unable to find or click on the Statements menu item. Retrying...`);
            retryCount ++;
            // Add some delay before retrying (optional)
            await customWait(page, 2000);
          }
        }
        await page.screenshot({path: `../azure-screenshots/${scrshot_path}/5.jpg`});
        console.log(`5.jpg generated`);

        if (!statementsMenuItemFound) {
          console.error('Failed to click on the Statements menu item after multiple retries.');
          // Handle the failure (e.g., throw an error, exit the script, etc.)
        }

        // done clicking Statements
        await customWait(page, 2000);

        let group_num = 0;

        // this is the GROUP selection
        for (const group of account.groupdropdown) {
          console.log("Group: " + group);
          const groupselector='.GGCLPSCPD'; 
          const companyselector=  '.GGCLPSCOD';

          // click GROUP radio button to view by group which shows all companies at once
          // turns out its different on dif pages.  await page.click('#gwt-uid-70');//click the group button so we can get all company from a group in one page
          await page.$$eval('span.gwt-RadioButton label', (labels) => {
            // Find the label that contains exactly "&nbsp;Group:"
            const groupLabel = labels.find(label => label.textContent.includes('\xa0Group:'));
            if (groupLabel) {
              // Click the associated radio button
              document.querySelector('#' + groupLabel.getAttribute('for')).click();
            }
          });

          // select the Group drop down.
          await page.waitForSelector(groupselector, { visible: true });
          await page.select(groupselector, group);
          await new Promise(resolve => setTimeout(resolve, 1000));
          await page.screenshot({path: `../azure-screenshots/${scrshot_path}/6_${group_num}.jpg`});
          console.log(`6_${group_num}.jpg generated`);

          // click the go button, on the right
          await page.click('button.wmsButtonFlash');
          await new Promise(resolve => setTimeout(resolve, 3000));
          await page.screenshot({path: `../azure-screenshots/${scrshot_path}/7_${group_num}.jpg`});
          console.log(`7_${group_num}.jpg generated`);

          group_num ++;

          // wait for the Please wait... popup to disappear (could be long)
          await page.waitForFunction(() => {
            // Get all elements with class 'gwt-HTML' and check if any contain the 'Please wait...' text
            const pleaseWaitDivs = Array.from(document.querySelectorAll('div.gwt-HTML'));
            return !pleaseWaitDivs.some(div => div.textContent.includes('Please wait...'));
          }, { timeout: 90000 });

          // Get all the links on the page and the associated data for file naming
          const linksWithDates = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('tr[__gwt_row]')); // Selects all tr elements with a __gwt_row attribute
            return rows.map(row => {
              const dateStartAnchor = row.querySelector('td:nth-of-type(2) a');
              const dateEndAnchor = row.querySelector('td:nth-of-type(3) a');
              const accountInfoDiv = row.querySelector('td:nth-of-type(5)');

              const startDate = dateStartAnchor ? dateStartAnchor.innerText.trim() : '';
              const endDate = dateEndAnchor ? dateEndAnchor.innerText.trim() : '';
              const accountInfo = accountInfoDiv ? accountInfoDiv.textContent.trim() : '';

              const href = dateEndAnchor ? dateEndAnchor.href : '';

              // Assuming the dates are in MM/DD/YYYY format and you need them in YYYYMMDD format
              const formatDate = (dateString) => {
                const [month, day, year] = dateString.split('/');
                return `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`;
              };

              const formattedStartDate = startDate ? formatDate(startDate) : '';
              const formattedEndDate = endDate ? formatDate(endDate) : '';

              return {
                href,
                startDate: formattedStartDate,
                endDate: formattedEndDate,
                accountInfo: accountInfo.replace(/\//g, '-'), // Replace slashes if any
                filename: `${formattedStartDate}-${formattedEndDate}_${accountInfo.replace(/\//g, '-')}.pdf`
              };
            });
          });

          // Filter by date desired. The start date must match the year and month entered,
          // and the end date must be the end of the same month.
          const filteredLinks = linksWithDates.filter(link => {
            // Check if the start date starts with the correct year and month
            const startDateMatches = link.startDate.startsWith(`${year}${month}`);
            
            // Check if the end date starts with the correct year and month
            const endDateMatches = link.endDate.startsWith(`${year}${month}`);

            return startDateMatches && endDateMatches;
          });

          // Download the links and rename the files
          for (const link of filteredLinks) {
            console.log("-Downloading: " + link.href); // Log to Node.js console before the download

            // Trigger the download by clicking on the link
            await page.evaluate(href => {
              const anchor = document.querySelector(`a[href='${href}']`);
              if (anchor) {
                anchor.click(); // Trigger download
              }
            }, link.href);
            console.log("Trigger the download");

            // filenames are all identical.  change them.
            try {
              const downloadedFilePath = await waitForDownloadComplete(downloadsFolderPath);
              console.log(`New file downloaded at: ${downloadedFilePath}`);
              await page.screenshot({path: `../azure-screenshots/${scrshot_path}/8_${total_count}.jpg`});
              console.log(`8_${total_count}.jpg generated`);

              // Now that you have the path, you can rename the file as needed
              const filename = `bok_${link.startDate}-${link.endDate}_${link.accountInfo}.pdf`;
              const newFilePath = path.join(renamed_downloadsFolderPath, filename);
              fs.renameSync(downloadedFilePath, newFilePath);
              console.log(`Renamed: ${newFilePath}`);
              total_count ++;
            } catch (error) {
              console.error('Error watching for download:', error);
              exit();
            }
          }
        }
        await new Promise(resolve => setTimeout(resolve, 4000));

        console.log(`\nDone downloading all reports for ${account.username}.`);
        console.log(`Total count for ${account.username}:`, total_count);

        let logtxt = `${currentDate.toISOString().split('T')[0]}, bok, ${year}-${month}, download, ${account.username}, ${total_count}\n`;
        console.log(logtxt);
        fs.appendFile('log.txt', logtxt, function (err) {
          if (err) throw err;
        });

        await send_team.sendMessageToTeamChannel(logtxt, 'crawler');

      } catch (error) {
        console.error('An error occurred:', error);
      } finally {
        // LOGOUT
        try {
          const signOutButton = await page.$x("//a[contains(text(), 'Sign Out')]");
          if (signOutButton.length > 0) {
            await signOutButton[0].click();
          } else {
            console.error('Sign Out button not found');
          }
        } catch (logoutError) {
          console.error('Failed to log out:', logoutError);
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
          
        await page.screenshot({path: `../azure-screenshots/${scrshot_path}/9.jpg`});
        console.log(`9.jpg generated`);
      }
    }
  } catch (error) {
		console.error('An error occurred:', error);
  } finally {
    await browser.close();
  }
}


bok();
