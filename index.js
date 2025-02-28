/**
 * Obsidian Web Scraper
 *
 * A set of tools to scrape web content and save it to Obsidian vaults as Markdown.
 */

const urlFinder = require('./bin/url-finder');
const scraper = require('./bin/scraper');
const scrapeSite = require('./bin/scrape-site').scrapeSite;

module.exports = {
  // URL finding utilities
  findUrls: urlFinder.crawlUrls,
  normalizeUrl: urlFinder.normalizeUrl,
  extractLinks: urlFinder.extractLinks,

  // Web scraping utilities
  scrapeUrl: scraper.scrapeUrl,
  saveToObsidian: scraper.saveToObsidian,
  processUrls: scraper.processUrls,
  extractMetadata: scraper.extractMetadata,

  // Complete workflows
  scrapeSite: scrapeSite
};
