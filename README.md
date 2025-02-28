# Obsidian Web Scraper

A set of tools to scrape web content and save it to Obsidian vaults as Markdown.

## Features

- **URL Finding**: Discover all sub-URLs from a base URL
- **Web Scraping**: Convert web pages to clean Markdown using Readability and Turndown
- **Batch Processing**: Scrape entire sites or documentation with a single command
- **Obsidian Integration**: Save content directly to Obsidian vaults with proper formatting
- **Customizable Templates**: Format output with custom templates
- **MCP Server**: Use as a Model Context Protocol server for AI assistants

## Installation

```bash
# Install globally
npm install -g obsidian-web-scraper

# Or install locally
npm install obsidian-web-scraper
```

## Command Line Usage

### Find URLs

Find all sub-URLs of a base URL:

```bash
url-finder --url https://example.com/docs --output urls.txt --depth 2
```

Options:
- `--url, -u`: Base URL to extract links from (required)
- `--output, -o`: Output file path for URLs (defaults to stdout)
- `--depth, -d`: Crawl depth (number of levels to follow links) (default: 2)
- `--sub-urls-only, -s`: Only include URLs that are sub-paths of the base URL (default: true)
- `--exclude, -e`: Exclude URLs matching these patterns (comma-separated)
- `--include, -i`: Only include URLs matching these patterns (comma-separated)
- `--max-urls, -m`: Maximum number of URLs to collect (default: 10000)

### Scrape URLs

Scrape one or more URLs and save them as Markdown:

```bash
scraper --url https://example.com/page --vault ~/ObsidianVault --output ~/ObsidianVault/Docs
```

Options:
- `--url, -u`: URL to scrape (can be provided multiple times)
- `--file, -f`: File containing URLs to scrape (one per line)
- `--vault, -v`: Path to Obsidian vault (required)
- `--output, -o`: Custom output path for markdown files (overrides vault+folder)
- `--folder`: Folder within vault to save clippings (default: "Clippings")
- `--template, -t`: Template file path for formatting

### Scrape Entire Site

Scrape an entire site or documentation with a single command:

```bash
scrape-site --url https://example.com/docs --output ~/ObsidianVault/Docs
```

Options:
- `--url, -u`: Base URL to extract links from and scrape (required)
- `--output, -o`: Output directory for the scraped markdown files (required)
- `--vault, -v`: Path to Obsidian vault (defaults to current directory)
- `--depth, -d`: Crawl depth (number of levels to follow links) (default: 2)
- `--template, -t`: Template file path for formatting
- `--exclude, -e`: Exclude URLs matching these patterns (comma-separated)
- `--include, -i`: Only include URLs matching these patterns (comma-separated)
- `--max-urls, -m`: Maximum number of URLs to collect (default: 10000)

## Programmatic Usage

```javascript
const { findUrls, scrapeUrl, scrapeSite } = require('obsidian-web-scraper');

// Find URLs
const urls = await findUrls('https://example.com/docs', 2, { maxUrls: 100 });

// Scrape a single URL
const result = await scrapeUrl('https://example.com/page');
console.log(result.markdown);

// Scrape an entire site
await scrapeSite({
  url: 'https://example.com/docs',
  output: './output',
  depth: 2,
  maxUrls: 100
});
```

## MCP Server

This package can also be used as a Model Context Protocol server, allowing AI assistants to scrape web content.

```bash
# Start the MCP server
npx obsidian-web-scraper-mcp
```

### Available MCP Tools

- `find_urls`: Find all sub-URLs that share the same base path as the provided URL
- `scrape_url`: Scrape a single URL and convert it to Markdown
- `scrape_site`: Scrape an entire site and save all pages as Markdown

## Templates

You can customize the output format using templates. Templates support the following variables:

- `{{title}}`: Page title
- `{{url}}`: Page URL
- `{{author}}`: Page author (if available)
- `{{date}}`: Publication date (if available)
- `{{description}}`: Page description (if available)
- `{{content}}`: The main content in Markdown format

Example template:

```markdown
---
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
```

## License

MIT
