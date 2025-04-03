/**
 * Obsidian Web Scraper
 *
 * A set of tools to scrape web content and save it to Obsidian vaults as Markdown.
 */

const urlFinderFuncs = require('./bin/url-finder');
const scraperFuncs = require('./bin/scraper');
const scrapeSite = require('./bin/scrape-site').scrapeSite;

// Expose individual functions and grouped objects for clarity
module.exports = {
  // URL finding utilities
  findUrls: urlFinderFuncs.crawlUrls, // Main function for finding URLs
  urlFinder: { // Grouped URL finder functions
    crawlUrls: urlFinderFuncs.crawlUrls,
    normalizeUrl: urlFinderFuncs.normalizeUrl,
    extractLinks: urlFinderFuncs.extractLinks,
  },

  // Web scraping utilities
  scrapeUrl: scraperFuncs.scrapeUrl, // Main function for scraping single URL
  scraper: { // Grouped scraper functions
      scrapeUrl: scraperFuncs.scrapeUrl,
      saveToObsidian: scraperFuncs.saveToObsidian,
      processUrls: scraperFuncs.processUrls,
      extractMetadata: scraperFuncs.extractMetadata,
  },

  // Complete workflows
  scrapeSite: scrapeSite
};
