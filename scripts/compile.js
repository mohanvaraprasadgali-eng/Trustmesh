/**
 * TrustMesh — Direct Solc Compiler (no native binary required)
 * =============================================================
 * Compiles all contracts in ./contracts using the locally-installed
 * 'solc' npm package (pure JavaScript, no download needed).
 *
 * Generates:
 *   artifacts/contracts/<Name>.sol/<Name>.json  (Hardhat-compatible format)
 *   backend/blockchain/abis/<Name>.json         (ABI for Python web3 client)
 *
 * Usage:
 *   node scripts/compile.js
 *
 * Then run tests / deployment as usual with Hardhat.
 * Hardhat will reuse the artifacts/ output from this script.
 */

const solc   = require("solc");
const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");

const ROOT_DIR      = path.join(__dirname, "..");
const CONTRACTS_DIR = path.join(ROOT_DIR, "contracts");
const ARTIFACTS_DIR = path.join(ROOT_DIR, "artifacts", "contracts");
const BACKEND_ABIS  = path.join(ROOT_DIR, "backend", "blockchain", "abis");

// ─── Collect all .sol files ───────────────────────────────────────────────────

function collectSolFiles(dir) {
    const files = {};
    for (const f of fs.readdirSync(dir)) {
        if (f.endsWith(".sol") && f !== ".gitkeep") {
            const full = path.join(dir, f);
            files[f] = { content: fs.readFileSync(full, "utf8") };
            console.log(`  [+] ${f}`);
        }
    }
    return files;
}

// ─── Build solc Standard-JSON input ──────────────────────────────────────────

function buildInput(sources) {
    return {
        language: "Solidity",
        sources,
        settings: {
            optimizer: { enabled: true, runs: 200 },
            outputSelection: {
                "*": {
                    "*": [
                        "abi",
                        "evm.bytecode",
                        "evm.deployedBytecode",
                        "evm.bytecode.sourceMap",
                        "evm.deployedBytecode.sourceMap",
                        "metadata",
                    ],
                },
            },
        },
    };
}

// ─── Write Hardhat-compatible artifact ───────────────────────────────────────

function writeArtifact(contractFile, contractName, abi, bytecode, deployedBytecode) {
    const outDir = path.join(ARTIFACTS_DIR, contractFile);
    fs.mkdirSync(outDir, { recursive: true });

    const artifact = {
        _format: "hh-sol-artifact-1",
        contractName,
        sourceName: contractFile,
        abi,
        bytecode: "0x" + bytecode,
        deployedBytecode: "0x" + deployedBytecode,
        linkReferences: {},
        deployedLinkReferences: {},
    };

    const outPath = path.join(outDir, `${contractName}.json`);
    fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2));
    return outPath;
}

// ─── Write ABI for Python backend ────────────────────────────────────────────

function writeBackendAbi(contractName, abi) {
    fs.mkdirSync(BACKEND_ABIS, { recursive: true });
    const outPath = path.join(BACKEND_ABIS, `${contractName}.json`);
    fs.writeFileSync(outPath, JSON.stringify(abi, null, 2));
    return outPath;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
    console.log("\n============================================================");
    console.log("  TrustMesh — Solidity Compilation");
    console.log(`  Using: solc ${solc.version()}`);
    console.log("============================================================\n");

    console.log("Collecting contracts:");
    const sources = collectSolFiles(CONTRACTS_DIR);

    if (Object.keys(sources).length === 0) {
        console.log("[WARN] No .sol files found in ./contracts/");
        process.exit(0);
    }

    console.log("\nCompiling...");
    const input  = buildInput(sources);
    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    // ── Print errors / warnings ───────────────────────────────────────────────
    let hasError = false;
    if (output.errors) {
        for (const err of output.errors) {
            if (err.severity === "error") {
                console.error(`[ERROR] ${err.formattedMessage}`);
                hasError = true;
            } else {
                // Print warnings only if they're not trivial metadata ones
                if (!err.message.includes("SPDX") && !err.message.includes("metadata")) {
                    console.warn(`[WARN]  ${err.message}`);
                }
            }
        }
    }

    if (hasError) {
        console.error("\n[FAIL] Compilation failed with errors above.");
        process.exit(1);
    }

    // ── Write artifacts ───────────────────────────────────────────────────────
    console.log("\nWriting artifacts:");
    let total = 0;

    for (const [file, contracts] of Object.entries(output.contracts || {})) {
        for (const [name, data] of Object.entries(contracts)) {
            const bytecode         = data.evm?.bytecode?.object         || "";
            const deployedBytecode = data.evm?.deployedBytecode?.object || "";
            const abi              = data.abi || [];

            const artifactPath = writeArtifact(file, name, abi, bytecode, deployedBytecode);
            const abiPath      = writeBackendAbi(name, abi);

            console.log(`  [OK] ${name}`);
            console.log(`       Artifact: artifacts/contracts/${file}/${name}.json`);
            console.log(`       ABI:      backend/blockchain/abis/${name}.json`);
            console.log(`       Functions: ${abi.filter(x => x.type === "function").length}, Events: ${abi.filter(x => x.type === "event").length}`);
            total++;
        }
    }

    console.log(`\n[OK] Compiled ${total} contract(s) successfully.`);
    console.log("\nNext steps:");
    console.log("  1. Run tests:       npx hardhat test");
    console.log("  2. Deploy locally:  npm run deploy:local");
    console.log("  3. Deploy testnet:  npm run deploy:testnet");
    console.log("============================================================\n");
}

main();
