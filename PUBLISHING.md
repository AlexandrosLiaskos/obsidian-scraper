# Publishing Guide for Obsidian Web Scraper

This guide explains how to publish the Obsidian Web Scraper to npm and GitHub.

## Publishing to GitHub

1. Create a new GitHub repository:

```bash
# Initialize git repository
cd obsidian-scraper
git init

# Add all files
git add .

# Commit the files
git commit -m "Initial commit"
```

2. Create a new repository on GitHub through the web interface at https://github.com/new

3. Connect your local repository to GitHub:

```bash
# Replace USERNAME with your GitHub username
git remote add origin https://github.com/USERNAME/obsidian-web-scraper.git
git branch -M main
git push -u origin main
```

## Publishing to npm

1. Make sure you have an npm account. If not, create one at https://www.npmjs.com/signup

2. Login to npm from the command line:

```bash
npm login
```

3. Verify the package.json file has all necessary information:
   - Ensure the name is unique (check on npmjs.com)
   - Verify version is set to "1.0.0" for first release
   - Check that all dependencies are listed
   - Make sure "bin" section is properly configured

4. Publish the package:

```bash
cd obsidian-scraper
npm publish
```

5. For future updates:
   - Update the version in package.json (follow semantic versioning)
   - Run `npm publish` again

## Publishing the MCP Server

To make the MCP server available:

1. Add an additional entry in package.json:

```json
"bin": {
  "obsidian-scraper": "./bin/scrape-site.js",
  "url-finder": "./bin/url-finder.js",
  "obsidian-scraper-mcp": "./mcp/server.js"
}
```

2. Ensure the MCP server dependencies are installed:

```bash
npm install @modelcontextprotocol/sdk
```

3. Publish to npm as described above

## GitHub Actions for Automated Publishing

You can set up GitHub Actions to automatically publish to npm when you create a new release:

1. Create a `.github/workflows` directory in your repository
2. Create a file named `npm-publish.yml` with the following content:

```yaml
name: Node.js Package

on:
  release:
    types: [created]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 16
          registry-url: https://registry.npmjs.org/
      - run: npm ci
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}
```

3. In GitHub, go to Settings > Secrets and add your NPM_TOKEN secret

## Verifying Installation

After publishing, verify the installation works:

```bash
# Install globally
npm install -g obsidian-web-scraper

# Test the commands
url-finder --help
obsidian-scraper --help
obsidian-scraper-mcp
