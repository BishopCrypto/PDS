'use strict';
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const send_team = require('./send_team');


// Check if the user has provided a parameter
if (process.argv.length < 3) {
  console.log("You need to include a date parameter in the format YYYYMM.");
  process.exit(1); // Exit with an error code
}

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
const { year, month } = match.groups;

console.log(`Year: ${year}, Month: ${month}`);

console.log("Run this code once and it uses the one id/password to fetch everything");

const puppeteer = require('puppeteer');
const loginUrl = "https://login2.fisglobal.com/idp/TrustDesk5M/?themeName=5MTDCB&client_id=TrustDesk_TDCB_Prod&scope=openid&response_type=id_token&redirect_uri=https://clientpoint.fisglobal.com/tdcb/main/Logon?bankNumber=5M";
const downloadsFolderPath = "./downloads";
const renamed_downloadsFolderPath = "./uploader/to_be_uploaded";
const textverified_server = "https://www.textverified.com";


const accounts = [
  {
    username: 'HT9V297',
    password: 'OldNatverify*1',
    groupdropdown: ['SLST00000'] // List of options for Account (TOTAL RELATIONSHIP GROUP ERROR)
  },
  // ... more accounts
];

// get bearer token fo textverified api
async function generateBearerToken() {
	const url = `${textverified_server}/api/pub/v2/auth`;
	const response = await axios.post(url, {}, {
		headers: {
			'X-API-USERNAME': 'josie@reinsuranceassociates.com',
			'X-API-KEY': 'oUl57n0Z7gaSHY7qse3Ex5HOUmo6uUFNPGXOndnxb7gxVVQYPYb5qkcfYshGx'
		}
	});
	return response.data.token;
}

//  get 2fa code
async function getSMS(token) {
	const url = `${textverified_server}/api/pub/v2/sms`;
	const response = await axios.get(url, {
		headers: {
			'Authorization': `Bearer ${token}`,
		}
	});
	const sms_list = response.data.data;
	const pin = sms_list[0].smsContent.slice(-5);
	return pin;
}


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

// // Function to watch the downloads directory for a new file to appear
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

const util = require('util');
const readFile = util.promisify(fs.readFile); // Convert readFile into a promise-based function

async function setCookiesAndRun(page) {
  const cookiesFilePath = './cookies/oldnatl_cookies.json';

  try {
    // Now you can use await with readFile
    const cookiesString = await readFile(cookiesFilePath, 'utf-8');
    const cookies = JSON.parse(cookiesString);

    // Assuming you've defined 'page' earlier and it's available here
    await Promise.all(cookies.map(cookie => {
      if (cookie.domain && cookie.domain.startsWith('.')) {
        cookie.domain = cookie.domain.substring(1);
      }
      console.log("Setting cookie");
      return page.setCookie(cookie);
    }));

    // Continue with your puppeteer logic here
  } catch (error) {
    console.error('Error setting cookies: ', error);
  }
}


async function old_national() {
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
		// Use the default browser context
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

		await setCookiesAndRun(page).catch(console.error); // COOKIES

		for (const account of accounts) {
			// LOGIN
			console.log("Account: " + account.username);
			
			const currentDate = new Date();
			const scrshot_path = currentDate.toISOString().split('.')[0].replace('T', '--').replace(/:/g, '-') + `-oldnational-${account.username}-${year}-${month}`;
			fs.mkdirSync(`screenshots\\${scrshot_path}`, { recursive: true }, (err) => {
				if (err) {
					return console.error(err);
				}
			});
			console.log(`All screenshots for ${account.username} are saved into '${scrshot_path}' folder`);

			let total_count = 0;
			let pin_code = "";
			
			await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
			await new Promise(resolve => setTimeout(resolve, 10000));

			await page.screenshot({path: `./screenshots/${scrshot_path}/0.jpg`});
    	console.log(`0.jpg generated`);
			
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
			await page.screenshot({path: `./screenshots/${scrshot_path}/1.jpg`});
    	console.log(`1.jpg generated`);

			await setCookiesAndRun(page).catch(console.error); // COOKIES (again just in case??)

			await page.waitForSelector('input[name="loginName"]');
			await page.type('input[name="loginName"]', account.username, {delay: 10});
			await page.screenshot({path: `./screenshots/${scrshot_path}/2.jpg`});
    	console.log(`2.jpg generated`);
			
			const proceedButton1 = await page.$x("//button[contains(., 'Proceed')]");
			if (proceedButton1.length > 0) {
				await proceedButton1[0].click();
			}

			await page.waitForSelector('input[name="password"]');
			await page.type('input[name="password"]', account.password, {delay: 10});
			await customWait(page, 3000);
			await page.screenshot({path: `./screenshots/${scrshot_path}/3.jpg`});
    	console.log(`3.jpg generated`);

			const token = await generateBearerToken();
			const pin = await getSMS(token);
			await page.waitForSelector('input[name="otppin"]');
			await page.type('input[name="otppin"]', pin, {delay: 10});
			pin_code = pin;
			await page.screenshot({path: `./screenshots/${scrshot_path}/4.jpg`});
    	console.log(`4.jpg generated`);

			await customWait(page, 5000);
			
			const proceedButton2 = await page.$x("//button[contains(., 'Proceed')]");
			if (proceedButton2.length > 0) {
				await proceedButton2[0].click();
			}
			await page.screenshot({path: `./screenshots/${scrshot_path}/5.jpg`});
    	console.log(`5.jpg generated`);

			await customWait(page, 5000);

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
				await page.screenshot({path: `./screenshots/${scrshot_path}/6.jpg`});
    		console.log(`6.jpg generated`);
				
				if (!statementsMenuItemFound) {
					console.error(`Failed to click on the Statements menu item after multiple retries: ${account.username}`);
					break;
				}
				// done clicking Statements

				await customWait(page, 2000);

				// this is the GROUP selection
				for (const group of account.groupdropdown) {
					console.log("Group: " + group);
					const groupselector='.GGCLPSCPD'; 
					const companyselector=  '.GGCLPSCOD';

					// click GROUP radio button to view by group which shows all companies at once
					// turns out its different on dif pages.  await page.click('#gwt-uid-70'); // click the group button so we can get all company from a group in one page
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
					await page.screenshot({path: `./screenshots/${scrshot_path}/7.jpg`});
    			console.log(`7.jpg generated`);

					// click the go button, on the right
					await new Promise(resolve => setTimeout(resolve, 1000));
					await page.click('button.wmsButtonFlash');
					await page.screenshot({path: `./screenshots/${scrshot_path}/8.jpg`});
    			console.log(`8.jpg generated`);

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
						console.log("Trigger the download")
						
						// filenames are all identical.  change them.
						try {
							const downloadedFilePath = await waitForDownloadComplete(downloadsFolderPath);
							console.log(`New file downloaded at: ${downloadedFilePath}`);
							await page.screenshot({path: `./screenshots/${scrshot_path}/9_${total_count}.jpg`});
    					console.log(`9_${total_count}.jpg generated`);

							// Now that you have the path, you can rename the file as needed
							const filename = `oldnational_${link.startDate}-${link.endDate}_${link.accountInfo}.pdf`;
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
				await page.screenshot({path: `./screenshots/${scrshot_path}/10.jpg`});
				console.log(`10.jpg generated`);

				console.log(`\nDone downloading all reports for ${account.username}.`);
				console.log(`Total count for ${account.username}:`, total_count);

				let logtxt = `${currentDate.toISOString().split('T')[0]}, oldnational, download, ${account.username}, ${total_count}, (2fa code: ${pin_code})\n`;
				console.log(logtxt);
				fs.appendFile('log.txt', logtxt, function (err) {
					if (err) throw err;
				});

				// await send_team.sendMessageToTeamChannel(logtxt, 'crawler');
			}
		}
	} catch (error) {
		console.error('An error occurred:', error);
  } finally {
    await browser.close();
  }
}


old_national();
