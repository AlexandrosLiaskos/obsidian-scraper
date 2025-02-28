#!/usr/bin/env node

/**
 * Obsidian Web Scraper
 *
 * This script fetches web pages and converts them to Markdown format
 * for saving in an Obsidian vault.
 */

const fetch = require('node-fetch');
const { Readability } = require('@mozilla/readability');
const TurndownService = require('turndown');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const dayjs = require('dayjs');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('url', {
    alias: 'u',
    description: 'URL to scrape (can be provided multiple times)',
    type: 'array',
  })
  .option('file', {
    alias: 'f',
    description: 'File containing URLs to scrape (one per line)',
    type: 'string',
  })
  .option('vault', {
    alias: 'v',
    description: 'Path to Obsidian vault',
    type: 'string',
    demandOption: true
  })
  .option('output', {
    alias: 'o',
    description: 'Custom output path for markdown files (overrides vault+folder)',
    type: 'string',
    default: null
  })
  .option('folder', {
    description: 'Folder within vault to save clippings',
    type: 'string',
    default: 'Clippings'
  })
  .option('template', {
    alias: 't',
    description: 'Template file path for formatting',
    type: 'string'
  })
  .help()
  .alias('help', 'h')
  .argv;

// Default template for clippings
const DEFAULT_TEMPLATE = `---
title: {{title}}
source: {{url}}
author: {{author}}
published: {{date}}
tags: [clippings]
---

# {{title}}

> [!info]
> Source: [{{title}}]({{url}})
> Author: {{author}}
> Date: {{date}}

{{content}}
`;

/**
 * Ensures a directory exists, creating it if necessary
 */
function ensureDirectoryExists(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
    console.log(`Created directory: ${directoryPath}`);
  }
}

/**
 * Creates a sanitized filename from a title
 */
function createFilename(title) {
  const sanitized = title
    .replace(/[/\\?%*:|"<>]/g, '-') // Replace invalid filename characters with hyphens
    .replace(/\s+/g, '-')           // Replace spaces with hyphens
    .replace(/-+/g, '-')            // Replace multiple hyphens with a single one
    .trim();

  return `${sanitized}.md`;
}

/**
 * Extracts metadata from the page
 */
function extractMetadata(document, url) {
  // Extract basic metadata
  const metadata = {
    url: url,
    title: document.title || 'Untitled Page',
    author: '',
    date: dayjs().format('YYYY-MM-DD'),
    description: '',
  };

  // Try to find author
  const authorMeta = document.querySelector('meta[name="author"], meta[property="article:author"]');
  if (authorMeta) {
    metadata.author = authorMeta.getAttribute('content');
  }

  // Try to find publication date
  const dateMeta = document.querySelector(
    'meta[name="date"], meta[property="article:published_time"], meta[property="og:published_time"]'
  );
  if (dateMeta) {
    const publishDate = dayjs(dateMeta.getAttribute('content'));
    if (publishDate.isValid()) {
      metadata.date = publishDate.format('YYYY-MM-DD');
    }
  }

  // Try to find description
  const descMeta = document.querySelector(
    'meta[name="description"], meta[property="og:description"]'
  );
  if (descMeta) {
    metadata.description = descMeta.getAttribute('content');
  }

  return metadata;
}

/**
 * Applies template to the content and metadata
 */
function applyTemplate(content, metadata, templateContent) {
  const template = templateContent || DEFAULT_TEMPLATE;

  return template
    .replace(/{{title}}/g, metadata.title)
    .replace(/{{url}}/g, metadata.url)
    .replace(/{{author}}/g, metadata.author || 'Unknown')
    .replace(/{{date}}/g, metadata.date)
    .replace(/{{description}}/g, metadata.description || '')
    .replace(/{{content}}/g, content);
}

/**
 * Fetches a web page and extracts its content
 */
async function scrapeUrl(url) {
  try {
    console.log(`Fetching: ${url}`);
    // Add headers to avoid being blocked
    const headers = {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    };
    const response = await fetch(url, { headers });
    const html = await response.text();

    // Parse HTML
    const dom = new JSDOM(html, { url });
    const document = dom.window.document;

    // Extract metadata
    const metadata = extractMetadata(document, url);

    // Extract content using Readability
    const reader = new Readability(document);
    const article = reader.parse();

    if (!article) {
      console.error(`Failed to extract content from ${url}`);
      return null;
    }

    // Convert to Markdown
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced'
    });

    // Add rules to preserve elements like tables
    turndownService.addRule('tables', {
      filter: ['table'],
      replacement: function(content, node) {
        // Simple table conversion
        return '\n\n' + content + '\n\n';
      }
    });

    const markdown = turndownService.turndown(article.content);

    // Update metadata with article information
    if (article.byline && !metadata.author) {
      metadata.author = article.byline;
    }

    if (article.title && !metadata.title) {
      metadata.title = article.title;
    }

    return { markdown, metadata };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return null;
  }
}

/**
 * Saves scraped content to the Obsidian vault
 */
async function saveToObsidian(markdown, metadata, vaultPath, folderName, templateContent, outputPath = null) {
  // Determine where to save the file
  let folderPath;
  if (outputPath) {
    folderPath = outputPath;
  } else {
    folderPath = path.join(vaultPath, folderName);
  }

  ensureDirectoryExists(folderPath);

  const filename = createFilename(metadata.title);
  const filePath = path.join(folderPath, filename);

  // Apply template
  const formattedContent = applyTemplate(markdown, metadata, templateContent);

  // Save to file
  fs.writeFileSync(filePath, formattedContent);
  console.log(`Saved to: ${filePath}`);

  return filePath;
}

/**
 * Main function to process URLs
 */
async function processUrls(urls, vaultPath, folderName, templateContent, outputPath = null) {
  let templateFile = templateContent;

  // Load template file if provided
  if (argv.template) {
    try {
      templateFile = fs.readFileSync(argv.template, 'utf8');
    } catch (error) {
      console.error(`Error loading template file: ${error.message}`);
      console.log('Using default template.');
    }
  }

  for (const url of urls) {
    const result = await scrapeUrl(url);
    if (result) {
      await saveToObsidian(
        result.markdown,
        result.metadata,
        vaultPath,
        folderName,
        templateFile,
        outputPath
      );
    }
  }
}

/**
 * Entry point
 */
async function main() {
  let urls = [];

  // Get URLs from command line arguments
  if (argv.url && argv.url.length > 0) {
    urls = [...argv.url];
  }

  // Get URLs from file
  if (argv.file) {
    try {
      const fileContent = fs.readFileSync(argv.file, 'utf8');
      const fileUrls = fileContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && line.startsWith('http'));

      urls = [...urls, ...fileUrls];
    } catch (error) {
      console.error(`Error reading URL file: ${error.message}`);
    }
  }

  // Validate we have URLs to process
  if (urls.length === 0) {
    console.error('No URLs provided. Use --url or --file to specify URLs.');
    process.exit(1);
  }

  // Determine output path
  const outputPath = argv.output ? argv.output : null;

  if (outputPath) {
    console.log(`Output will be saved to: ${outputPath}`);
  }

  console.log(`Processing ${urls.length} URLs...`);
  await processUrls(urls, argv.vault, argv.folder, null, outputPath);

  console.log('Done!');
}

// Export functions for module use
module.exports = {
  scrapeUrl,
  saveToObsidian,
  processUrls,
  applyTemplate,
  extractMetadata,
  createFilename,
  ensureDirectoryExists
};

// When run directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
