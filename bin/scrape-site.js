#!/usr/bin/env node

/**
 * Obsidian Site Scraper
 *
 * A convenience script that combines url-finder.js and scraper.js
 * to scrape an entire site or documentation with a single command.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

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
  .option('vault', {
    alias: 'v',
    description: 'Path to Obsidian vault (defaults to current directory)',
    type: 'string',
    default: '.'
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

/**
 * Sleep function to add delays between requests
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main function
 */
async function main() {
  try {
    // Create temp file for URLs
    const tempUrlFile = path.join(process.cwd(), 'temp-urls.txt');

    console.log('Step 1: Finding sub-URLs...');

    // Build the url-finder command
    let finderCmd = `node "${path.join(__dirname, 'url-finder.js')}" --url "${argv.url}" --output "${tempUrlFile}" --depth ${argv.depth} --max-urls ${argv['max-urls']}`;

    if (argv.exclude) {
      finderCmd += ` --exclude "${argv.exclude}"`;
    }

    if (argv.include) {
      finderCmd += ` --include "${argv.include}"`;
    }

    // Run the URL finder
    console.log(`Running: ${finderCmd}`);
    execSync(finderCmd, { stdio: 'inherit' });

    // Check if we found any URLs
    if (!fs.existsSync(tempUrlFile) || fs.readFileSync(tempUrlFile, 'utf8').trim().length === 0) {
      console.error('No URLs found to scrape. Exiting.');
      process.exit(1);
    }

    console.log('\nStep 2: Scraping URLs...');

    // For very large sets of URLs, using the command line might not work well
    // We'll process them in batches directly here

    // Read URLs from file
    const urlsContent = fs.readFileSync(tempUrlFile, 'utf8');
    const allUrls = urlsContent.split('\n').filter(url => url.trim().length > 0);
    console.log(`Found ${allUrls.length} URLs to scrape.`);

    console.log(`Processing ${allUrls.length} URLs...`);

    // Create batches of 100 URLs
    const batchSize = 100;
    const batches = [];
    for (let i = 0; i < allUrls.length; i += batchSize) {
      batches.push(allUrls.slice(i, i + batchSize));
    }

    console.log(`Split into ${batches.length} batches of up to ${batchSize} URLs each.`);

    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchFile = path.join(process.cwd(), `temp-batch-${i+1}.txt`);

      // Write batch to temporary file
      fs.writeFileSync(batchFile, batch.join('\n'));

      console.log(`Processing batch ${i+1}/${batches.length} (${batch.length} URLs)...`);

      // Build the scraper command for this batch
      let scraperCmd = `node "${path.join(__dirname, 'scraper.js')}" --file "${batchFile}" --vault "${argv.vault}" --output "${argv.output}"`;

      if (argv.template) {
        scraperCmd += ` --template "${argv.template}"`;
      }

      // Run the scraper for this batch
      try {
        console.log(`Running: ${scraperCmd}`);
        execSync(scraperCmd, { stdio: 'inherit' });

        // Clean up the batch file
        fs.unlinkSync(batchFile);

        // Add a small delay between batches to avoid overwhelming the server
        if (i < batches.length - 1) {
          console.log('Pausing briefly before next batch...');
          await sleep(3000); // 3-second pause
        }
      } catch (error) {
        console.error(`Error processing batch ${i+1}:`, error.message);
        // Continue with next batch even if this one fails
      }
    }

    console.log('\nScraping complete!');
    console.log(`Scraped content saved to: ${argv.output}`);

    // Clean up the temporary URL file
    fs.unlinkSync(tempUrlFile);

  } catch (error) {
    console.error('Error during execution:', error.message);
    process.exit(1);
  }
}

// Export functionality for module use
module.exports = {
  scrapeSite: main
};

// When run directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
