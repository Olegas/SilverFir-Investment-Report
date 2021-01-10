const puppeteer = require('puppeteer');
const fs = require('fs').promises;

(async () => {
    let bondsLinks = [];
    const ratings = {};
    const browser = await puppeteer.launch({
        userDataDir: './.data'
    });
    const page = await browser.newPage();
    await page.setViewport({
        width: 1024,
        height: 768,
        deviceScaleFactor: 1,
    });
    await page.goto('https://www.raexpert.ru/ratings/debt_inst/', {waitUntil: 'networkidle2'});

    try {
        await scrapePage(bondsLinks, page);
    } catch (e) {
        // ignore
    }

    for(let i = 0; i < bondsLinks.length; i++) {
        const link = bondsLinks[i];
        await scrapeBond(ratings, page, link);
    }
    await fs.writeFile('./ratings.json', JSON.stringify(ratings));
    await browser.close();
})();

async function scrapePage(bondsLinks, page) {
    console.log('Scraping page...');
    const links = await page.$$('a');
    const hrefHandles = await Promise.all(
        links.map((item) => item.getProperty('href')));
    const hrefs = await Promise.all(
        hrefHandles.map((item) => item.jsonValue())
    )
    bondsLinks.push(...hrefs.filter((i) => i.startsWith('https://www.raexpert.ru/database/securities/bonds/')));
    const currentPage = await page.$('.b-paginator__link.-active');
    if (currentPage) {
        const next = await currentPage.evaluateHandle((e) => e.nextSibling);
        if (next && next.click) {
            await Promise.all([
                page.waitForNavigation({waitUntil: 'networkidle2'}),
                next.click()
            ]);
            await scrapePage(bondsLinks, page);
        }
    }
}

async function scrapeBond(ratings, page, link) {
    await page.goto(link, {waitUntil: 'networkidle2'});
    const isin = await page.evaluate(() => {
        const titles = [...document.body.querySelectorAll('.b-table__title')];
        const isinTitle = titles
            .map((i) => [i, i.textContent.trim()])
            .filter(([elt, text]) => text === 'ISIN')
            .pop();
        return isinTitle[0].nextElementSibling.textContent.trim();
    })
    const [rating, date] = await page.evaluate(() => {
        const items = [...document.body.querySelectorAll('td>span>span')];
        const latest = items[0];
        const rating = latest.textContent.trim();
        const date = latest.parentElement.parentElement.nextElementSibling.textContent.trim();
        return [rating, date];
    });
    console.log(`${isin}: ${rating}, ${date}`);
    ratings[isin] = {
        link,
        rating,
        date
    };
}