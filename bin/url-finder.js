#!/usr/bin/env node

/**
 * URL Finder
 *
 * This script finds all sub-URLs that have the same root as the provided URL
 * and outputs them for use with the Obsidian web scraper.
 */

const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const URL = require('url').URL;
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('url', {
    alias: 'u',
    description: 'Base URL to extract links from',
    type: 'string',
    demandOption: true
  })
  .option('output', {
    alias: 'o',
    description: 'Output file path for URLs (defaults to stdout)',
    type: 'string'
  })
  .option('depth', {
    alias: 'd',
    description: 'Crawl depth (number of levels to follow links)',
    type: 'number',
    default: 2
  })
  .option('sub-urls-only', {
    alias: 's',
    description: 'Only include URLs that are sub-paths of the base URL',
    type: 'boolean',
    default: true
  })
  .option('exclude', {
    alias: 'e',
    description: 'Exclude URLs matching these patterns (comma-separated)',
    type: 'string'
  })
  .option('include', {
    alias: 'i',
    description: 'Only include URLs matching these patterns (comma-separated)',
    type: 'string'
  })
  .option('max-urls', {
    alias: 'm',
    description: 'Maximum number of URLs to collect',
    type: 'number',
    default: 10000
  })
  .help()
  .alias('help', 'h')
  .argv;

/**
 * Normalizes a URL relative to a base URL
 */
function normalizeUrl(url, baseUrl) {
  try {
    // Handle relative URLs
    return new URL(url, baseUrl).href;
  } catch (e) {
    return null;
  }
}

/**
 * Extracts links from HTML content
 */
function extractLinks(html, baseUrl) {
  const dom = new JSDOM(html, { url: baseUrl });
  const document = dom.window.document;
  const links = [];

  // Extract all links from anchor tags
  const anchors = document.querySelectorAll('a');
  anchors.forEach(anchor => {
    const href = anchor.getAttribute('href');
    if (href) {
      // Skip fragment-only links
      if (href.startsWith('#')) {
        return;
      }

      // Skip links to other domains if not already absolute
      const normalizedUrl = normalizeUrl(href, baseUrl);
      if (normalizedUrl) {
        links.push(normalizedUrl);
      }
    }
  });

  return links;
}

/**
 * Checks if a URL is a sub-URL of the base URL
 */
function isSubUrl(url, baseUrl) {
  try {
    const urlObj = new URL(url);
    const baseUrlObj = new URL(baseUrl);

    // Check for same hostname
    if (urlObj.hostname !== baseUrlObj.hostname) {
      return false;
    }

    // Special handling for Google Earth Engine API docs
    if (baseUrlObj.hostname === 'developers.google.com' &&
        baseUrlObj.pathname.includes('/earth-engine/apidocs')) {

      // Only include URLs that are in the Earth Engine API docs section
      if (urlObj.pathname.includes('/earth-engine/apidocs') ||
          urlObj.pathname.includes('/earth-engine/api_docs')) {

        // Skip URLs with query parameters or fragments
        if (urlObj.search === '' && urlObj.hash === '') {
          return true;
        }
      }
      return false;
    }

    // Then check if the URL path starts with the base URL path
    // This ensures we only get sub-paths of the provided URL
    return urlObj.pathname.startsWith(baseUrlObj.pathname) && urlObj.search === '';
  } catch (e) {
    return false;
  }
}

/**
 * Checks if a URL matches any of the patterns
 */
function matchesPatterns(url, patterns) {
  if (!patterns || patterns.length === 0) {
    return false;
  }

  return patterns.some(pattern => {
    const regex = new RegExp(pattern);
    return regex.test(url);
  });
}

/**
 * Fetches a URL and extracts links
 */
async function fetchAndExtractLinks(url) {
  try {
    console.error(`Fetching: ${url}`);
    // Add headers to avoid being blocked
    const headers = {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8' };
    const response = await fetch(url, { headers });
    const html = await response.text();
    return extractLinks(html, url);
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    return [];
  }
}

/**
 * Crawls URLs to the specified depth
 */
async function crawlUrls(baseUrl, depth, options) {
  const visitedUrls = new Set();
  const foundUrls = new Set(); // Track all found URLs separately
  const urlsToVisit = [baseUrl];
  const collectedUrls = [];

  console.error(`Max URLs to collect: ${options.maxUrls}`);
  console.error(`Crawl depth: ${depth}`);

  const excludePatterns = options.exclude ? options.exclude.split(',').map(p => p.trim()) : [];
  const includePatterns = options.include ? options.include.split(',').map(p => p.trim()) : [];

  // Process URLs level by level up to the specified depth
  for (let currentDepth = 0; currentDepth < depth; currentDepth++) {
    console.error(`Processing depth level ${currentDepth + 1}/${depth}`);
    const currentUrls = [...urlsToVisit];
    urlsToVisit.length = 0; // Clear the array

    for (const url of currentUrls) {
      if (visitedUrls.has(url)) {
        continue;
      }

      visitedUrls.add(url);

      if (collectedUrls.length >= options.maxUrls) {
        console.error(`Reached maximum URLs limit of ${options.maxUrls}`);
      }

      collectedUrls.push(url);

      if (currentDepth < depth - 1) {
        const links = await fetchAndExtractLinks(url);

        console.error(`Found ${links.length} links on ${url}`);

        for (const link of links) {
          foundUrls.add(link); // Track all valid links found
          // Skip already visited URLs or URLs already in the queue
          if (visitedUrls.has(link)) {
            continue;
          }

          // Apply sub-URL filter
          if (options.subUrlsOnly && !isSubUrl(link, baseUrl)) {
            continue;
          }

          // Apply exclude patterns
          if (matchesPatterns(link, excludePatterns)) {
            continue;
          }

          // Apply include patterns
          if (includePatterns.length > 0 && !matchesPatterns(link, includePatterns)) {
            continue;
          }

          urlsToVisit.push(link);
        }
      }
    }

    if (collectedUrls.length >= options.maxUrls) {
      break;
    }
  }

  console.error(`Found ${foundUrls.size} total unique URLs`);
  console.error(`Filtered to ${collectedUrls.length} relevant URLs`);

  return collectedUrls.slice(0, options.maxUrls);
}

/**
 * Main function
 */
async function main() {
  const baseUrl = argv.url;

  const options = {
    depth: argv.depth,
    sameDomain: true, // Always ensure we stay on the same domain
    subUrlsOnly: argv['sub-urls-only'],
    exclude: argv.exclude,
    include: argv.include,
    maxUrls: argv['max-urls']
  };

  console.error(`Finding URLs from: ${baseUrl}`);
  console.error(`Crawl depth: ${options.depth}`);
  console.error(`Sub-URLs only: ${options.subUrlsOnly}`);

  const urls = await crawlUrls(baseUrl, options.depth, options);

  console.error(`Found ${urls.length} URLs`);

  const outputContent = urls.join('\n');

  if (argv.output) {
    fs.writeFileSync(argv.output, outputContent);
    console.error(`URLs saved to: ${argv.output}`);
  } else {
    console.log(outputContent);
  }
}

// When used as a module
module.exports = {
  normalizeUrl,
  extractLinks,
  isSubUrl,
  matchesPatterns,
  fetchAndExtractLinks,
  crawlUrls
};

// When run directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
