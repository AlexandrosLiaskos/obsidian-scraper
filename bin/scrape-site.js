#!/usr/bin/env node

/**
 * Obsidian Site Scraper
 *
 * A convenience script that combines url-finder.js and scraper.js
 * to scrape an entire site or documentation with a single command.
 */

const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Import necessary functions directly
const { crawlUrls } = require('./url-finder');
const { processUrls } = require('./scraper');
const { ensureDirectoryExists } = require('./scraper');

/**
 * Sleep function to add delays between requests
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main function
 */
/**
 * Core site scraping logic (programmatic use)
 * @param {object} options
 * @param {string} options.url - Base URL to start crawling from.
 * @param {string} options.output - Directory to save scraped markdown files.
 * @param {number} [options.depth=2] - Crawl depth.
 * @param {number} [options.maxUrls=10000] - Max URLs to find and scrape.
 * @param {string} [options.template] - Path to the template file.
 * @param {string} [options.exclude] - Comma-separated patterns to exclude.
 * @param {string} [options.include] - Comma-separated patterns to include.
 */
async function scrapeSite(options) {
  const {
    url,
    output,
    depth = 2,
    maxUrls = 10000,
    template,
    exclude,
    include
  } = options;

  try {
    console.log('Step 1: Finding sub-URLs...');

    const finderOptions = {
      subUrlsOnly: true, // Keep this default for site scraping
      exclude,
      include,
      maxUrls
    };

    const foundUrls = await crawlUrls(url, depth, finderOptions);

    // Check if we found any URLs
    if (!foundUrls || foundUrls.length === 0) {
      console.error('No URLs found to scrape. Exiting.');
      return; // Don't exit process in programmatic use
    }

    console.log(`\nStep 2: Scraping ${foundUrls.length} URLs...`);

    // Ensure output directory exists
    ensureDirectoryExists(output);

    // Process all found URLs
    // processUrls expects vaultPath and folderName OR outputPath
    // We use outputPath directly here. vaultPath and folderName are dummies.
    await processUrls(foundUrls, '.', '', template, output);

    console.log('\nScraping complete!');
    console.log(`Scraped content saved to: ${output}`);

  } catch (error) {
    console.error('Error during site scraping:', error.message);
    throw error; // Re-throw for programmatic handling
  }
}

/**
 * CLI entry point
 */
async function cliMain() {
    // Parse command line arguments
    const argv = yargs(hideBin(process.argv))
      .option('url', {
        alias: 'u',
        description: 'Base URL to extract links from and scrape',
        type: 'string',
        demandOption: true
      })
      .option('output', {
        alias: 'o',
        description: 'Output directory for the scraped markdown files',
        type: 'string',
        demandOption: true
      })
      .option('depth', {
        alias: 'd',
        description: 'Crawl depth (number of levels to follow links)',
        type: 'number',
        default: 2
      })
      .option('template', {
        alias: 't',
        description: 'Template file path for formatting',
        type: 'string'
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

    try {
        await scrapeSite({
            url: argv.url,
            output: argv.output,
            depth: argv.depth,
            maxUrls: argv['max-urls'],
            template: argv.template,
            exclude: argv.exclude,
            include: argv.include
        });
    } catch (error) {
        // Error already logged in scrapeSite
        process.exit(1);
    }
}


// Export functionality for module use
module.exports = {
  scrapeSite // Export the programmatic function
};

// When run directly as a script
if (require.main === module) {
  cliMain();
}
