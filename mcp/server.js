#!/usr/bin/env node

/**
 * MCP Server for Obsidian Web Scraper
 *
 * This server provides tools to scrape web content and save it to Obsidian vaults.
 */
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError
} = require('@modelcontextprotocol/sdk/types.js');

const urlFinder = require('../bin/url-finder');
const scraper = require('../bin/scraper');
const scrapeSite = require('../bin/scrape-site').scrapeSite;
const fs = require('fs');
const path = require('path');

class ObsidianScraperServer {
  constructor() {
    this.server = new Server(
      {
        name: 'obsidian-web-scraper',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Set up the tools
    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'find_urls',
          description: 'Find all sub-URLs that share the same base path as the provided URL',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'Base URL to extract links from',
              },
              depth: {
                type: 'number',
                description: 'Crawl depth (number of levels to follow links)',
              },
              max_urls: {
                type: 'number',
                description: 'Maximum number of URLs to collect',
              },
              exclude: {
                type: 'string',
                description: 'Exclude URLs matching these patterns (comma-separated)',
              },
              include: {
                type: 'string',
                description: 'Only include URLs matching these patterns (comma-separated)',
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'scrape_url',
          description: 'Scrape a single URL and convert it to Markdown',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL to scrape',
              },
              output: {
                type: 'string',
                description: 'Output path for the scraped Markdown file',
              },
              template: {
                type: 'string',
                description: 'Template string to format the output',
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'scrape_site',
          description: 'Scrape an entire site and save all pages as Markdown',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'Base URL to scrape',
              },
              output: {
                type: 'string',
                description: 'Output directory for scraped Markdown files',
              },
              depth: {
                type: 'number',
                description: 'Crawl depth (number of levels to follow links)',
              },
              max_urls: {
                type: 'number',
                description: 'Maximum number of URLs to collect',
              },
              template: {
                type: 'string',
                description: 'Template file path or content for formatting',
              },
            },
            required: ['url', 'output'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'find_urls':
          return this.handleFindUrls(request.params.arguments);
        case 'scrape_url':
          return this.handleScrapeUrl(request.params.arguments);
        case 'scrape_site':
          return this.handleScrapeSite(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  async handleFindUrls(args) {
    try {
      const options = {
        depth: args.depth || 2,
        subUrlsOnly: true,
        maxUrls: args.max_urls || 1000,
        exclude: args.exclude,
        include: args.include,
      };

      const urls = await urlFinder.crawlUrls(args.url, options.depth, options);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(urls, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error finding URLs: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async handleScrapeUrl(args) {
    try {
      // Scrape the URL
      const result = await scraper.scrapeUrl(args.url);
      if (!result) {
        throw new Error('Failed to extract content from URL');
      }

      let output = '';

      // If output path is provided, save to file
      if (args.output) {
        const outputDir = path.dirname(args.output);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const formattedContent = scraper.applyTemplate(
          result.markdown,
          result.metadata,
          args.template
        );

        fs.writeFileSync(args.output, formattedContent);
        output = `Content saved to: ${args.output}\n\n`;
      }

      // Return content and metadata
      return {
        content: [
          {
            type: 'text',
            text: output + result.markdown,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error scraping URL: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async handleScrapeSite(args) {
    try {
      // Create a temporary directory for outputs
      const tempDir = path.join(process.cwd(), 'temp_scrape_output');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Create temp file for URLs
      const tempUrlFile = path.join(tempDir, 'temp-urls.txt');

      // First find all URLs
      const options = {
        depth: args.depth || 2,
        subUrlsOnly: true,
        maxUrls: args.max_urls || 100,
      };

      const urls = await urlFinder.crawlUrls(args.url, options.depth, options);
      fs.writeFileSync(tempUrlFile, urls.join('\n'));

      // Create output directory if it doesn't exist
      if (!fs.existsSync(args.output)) {
        fs.mkdirSync(args.output, { recursive: true });
      }

      // Process all URLs
      await scraper.processUrls(urls, '.', 'temp', args.template, args.output);

      // Clean up temp files
      fs.unlinkSync(tempUrlFile);
      fs.rmdirSync(tempDir, { recursive: true });

      return {
        content: [
          {
            type: 'text',
            text: `Successfully scraped ${urls.length} URLs from ${args.url}.\nContent saved to: ${args.output}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error scraping site: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Obsidian Scraper MCP server running on stdio');
  }
}

// Start the server when run directly
if (require.main === module) {
  const server = new ObsidianScraperServer();
  server.run().catch(console.error);
}

module.exports = ObsidianScraperServer;
