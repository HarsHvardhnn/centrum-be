/**
 * Puppeteer config so Chrome is cached inside the project.
 * Required for Render (and similar): Chromium is installed during build and found at runtime.
 * After adding/changing this, run: npx puppeteer browsers install
 */
const { join } = require("path");

/** @type {import("puppeteer").Configuration} */
module.exports = {
  cacheDirectory: join(__dirname, ".cache", "puppeteer"),
  chrome: {
    skipDownload: false,
  },
};
