/**
 * TrustMesh — Compiler Setup Helper
 * ====================================
 * Downloads and caches the Solidity 0.8.26 native compiler for Windows
 * using the solc-bin CDN, then places it where Hardhat expects it.
 *
 * Run this ONCE if `npx hardhat compile` fails with HH501:
 *   node scripts/setup-compiler.js
 */

const https = require("https");
const fs    = require("fs");
const path  = require("path");
const os    = require("os");
const crypto = require("crypto");

// Hardhat compiler cache location on Windows
const CACHE_DIR = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
  "hardhat-nodejs",
  "Cache",
  "compilers-v2",
  "windows-amd64"
);

// Compiler to download
const COMPILER_VERSION = "0.8.26+commit.8a97fa7a";
const COMPILER_FILENAME = `solc-windows-amd64-v${COMPILER_VERSION}.exe`;
const COMPILER_DEST = path.join(CACHE_DIR, COMPILER_FILENAME);

// Try multiple CDN mirrors
const DOWNLOAD_URLS = [
  `https://binaries.soliditylang.org/windows-amd64/${COMPILER_FILENAME}`,
  `https://github.com/ethereum/solc-bin/raw/gh-pages/windows-amd64/${COMPILER_FILENAME}`,
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`[INFO] Trying: ${url}`);
    const file = fs.createWriteStream(dest + ".tmp");
    let totalBytes = 0;

    const req = https.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest + ".tmp");
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest + ".tmp");
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }

      const total = parseInt(res.headers["content-length"] || "0", 10);
      let downloaded = 0;
      res.on("data", (chunk) => {
        downloaded += chunk.length;
        totalBytes += chunk.length;
        if (total > 0) {
          const pct = ((downloaded / total) * 100).toFixed(1);
          process.stdout.write(`\r  Progress: ${pct}% (${(downloaded/1024/1024).toFixed(1)} MB)`);
        }
      });

      res.pipe(file);
      file.on("finish", () => {
        process.stdout.write("\n");
        file.close(() => {
          fs.renameSync(dest + ".tmp", dest);
          resolve(totalBytes);
        });
      });
    });

    req.on("timeout", () => {
      req.destroy();
      file.close();
      if (fs.existsSync(dest + ".tmp")) fs.unlinkSync(dest + ".tmp");
      reject(new Error("Download timed out"));
    });

    req.on("error", (err) => {
      file.close();
      if (fs.existsSync(dest + ".tmp")) fs.unlinkSync(dest + ".tmp");
      reject(err);
    });
  });
}

async function main() {
  console.log("TrustMesh — Solidity Compiler Setup");
  console.log("=====================================");
  console.log(`Target:  ${COMPILER_DEST}`);
  console.log(`Version: ${COMPILER_VERSION}`);

  // Already downloaded?
  if (fs.existsSync(COMPILER_DEST)) {
    console.log("[OK] Compiler already cached. Nothing to do.");
    console.log("     Run: npx hardhat compile");
    return;
  }

  // Ensure cache dir exists
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  // Try each mirror
  let success = false;
  for (const url of DOWNLOAD_URLS) {
    try {
      const bytes = await download(url, COMPILER_DEST);
      console.log(`[OK] Downloaded ${(bytes/1024/1024).toFixed(1)} MB`);
      success = true;
      break;
    } catch (e) {
      console.log(`[FAIL] ${e.message}`);
    }
  }

  if (!success) {
    console.log("\n[ERROR] All download attempts failed.");
    console.log("        Manual download instructions:");
    console.log(`        1. Download: https://binaries.soliditylang.org/windows-amd64/${COMPILER_FILENAME}`);
    console.log(`        2. Place at:  ${COMPILER_DEST}`);
    console.log("        3. Run: npx hardhat compile");
    process.exit(1);
  }

  // Make executable
  try {
    fs.chmodSync(COMPILER_DEST, 0o755);
  } catch (_) {}

  console.log("[OK] Compiler ready. Run: npx hardhat compile");
}

main().catch(console.error);
