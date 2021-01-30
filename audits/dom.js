const puppeteer = require('puppeteer');

const main = '.w-post-content';

// Run PSI on any Glitches / Codepens
// section headings
// 404 links

const gather = {
  links: async page => {
    return await page.$$eval(`${main} a`, links => {
      const authors = document.querySelector('.w-authors');
      const breadcrumbs = document.querySelector('.w-post-breadcrumbs');
      const github = document.querySelector('.w-post-github-link');
      const urls = links.filter(link => {
        return !authors.contains(link) &&
            !breadcrumbs.contains(link) &&
            !github.contains(link) &&
            !link.classList.contains('w-headline-link');
      }).map(target => new URL(target.href));
      const output = [];
      urls.forEach(url => {
        const {origin, pathname, hash} = url;
        output.push({
          page: `${origin}${pathname}`,
          section: hash
        });
      });
      return output;
      // return urls.map(url => url.href);
      // const data = {};
      // urls.forEach(url => {
      //   const id = `${url.origin}${url.pathname}`;
      //   if (!data[id]) data[id] = {
      //     hashes: []
      //   };
      //   if (url.hash && !data[id].hashes.includes(url.hash)) data[id].hashes.push(url.hash);
      // });
      // return data;
    });
  }
}

const audits = {
  // We should run the section links along with the general link checking
  // because they're so tightly coupled. I.e. to determine if a section link
  // is relevant, you need to visit the page anyways; if a link 404s then
  // obviously all of the section links are also not valid.
  links: async (page, data, browser) => {
    const output = {};
    // Convert the data to a format that's easier to process.
    data.links.forEach(link => {
      const {page, section} = link;
      if (!output[page]) output[page] = {
        ok: null
      };
      if (section !== '' && !output[page].sections) output[page].sections = {};
      if (section !== '') {
        output[page].sections[section] = {
          ok: null
        };
      }
    });
    const page2 = await browser.newPage();
    for (const url in output) {
      try {
        // TODO(kaycebasques): Check the URL. If it's the same as what's loaded in page, use that
        // instead of loading the page again with page2.
        await page2.goto(url);
        output[url].ok = true;
        if (!output[url].sections) continue;
        for (const section in output[url].sections) {
          const node = await page2.$(section);
          output[url].sections[section].ok = node ? true : false;
        }
        // output.hashes = {};
        // url.hashes.forEach(async hash => {
        //   const node = await page2.$(hash);
        //   output.hashes[node] = node ? true : false;
        // });
      } catch (error) {
        output[url].ok = false;
        if (!output[url].sections) continue;
        for (const section in output[url].sections) {
          output[url].sections[section].ok = false;
        }
        continue; // TODO(kaycebasques): Not sure if this is necessary.
      }
    }
    page2.close();
    return output;
  }
};

const audit = async url => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  try {
    await page.goto(url, {
      timeout: 0
    });
    let data = {};
    for (const item in gather) {
      data[item] = await gather[item](page);
    }
    let output = {};
    for (const audit in audits) {
      output[audit] = await audits[audit](page, data, browser);
    }
    await page.close();
    return output;
  } catch (error) {
    console.error(error);
    await page.close();
  }
};

module.exports = {
  audit
};