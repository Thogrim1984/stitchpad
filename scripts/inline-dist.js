import { promises as fs } from "fs";
import path from "path";

const distDir = path.resolve(process.cwd(), "dist");
const assetsDir = path.join(distDir, "assets");

async function inlineDist() {
  const indexPath = path.join(distDir, "index.html");
  const indexExists = await fs
    .access(indexPath)
    .then(() => true)
    .catch(() => false);

  if (!indexExists) {
    console.warn("dist/index.html not found - skipping inline step.");
    return;
  }

  const assetFiles = await fs.readdir(assetsDir);

  const jsBundle = assetFiles.find((file) => /^index-.*\.js$/i.test(file));
  const cssBundle = assetFiles.find((file) => /^index-.*\.css$/i.test(file));
  const workerBundle = assetFiles.find((file) =>
    /^pdf\.worker\.min.*\.mjs$/i.test(file),
  );

  if (!jsBundle) {
    throw new Error("Unable to locate JS bundle in dist/assets.");
  }
  if (!cssBundle) {
    throw new Error("Unable to locate CSS bundle in dist/assets.");
  }

  const [jsSource, cssSource] = await Promise.all([
    fs.readFile(path.join(assetsDir, jsBundle), "utf-8"),
    fs.readFile(path.join(assetsDir, cssBundle), "utf-8"),
  ]);

  const escapedJs = jsSource.replace(/<\/script>/gi, "<\\/script>");

  const workerAssignment = workerBundle
    ? `    <script>window.__pdfWorkerPath = "./assets/${workerBundle}";</script>\n`
    : "";

  const inlineHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="./vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>stitchpad</title>
${workerAssignment}    <style>
${cssSource}
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
${escapedJs}
    </script>
  </body>
</html>
`;

  await fs.writeFile(indexPath, inlineHtml, "utf-8");
}

inlineDist().catch((error) => {
  console.error("Failed to inline dist assets", error);
  process.exitCode = 1;
});
