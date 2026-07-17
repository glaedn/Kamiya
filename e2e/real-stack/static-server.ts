import express from "express";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root || "dist");
const port = Number(args.port || 3011);
const app = express();

app.use(express.static(root));
app.use((_request, response) => response.sendFile(path.join(root, "index.html")));
app.listen(port, "127.0.0.1", () => {
  console.log(`[static-server] serving ${root} at http://127.0.0.1:${port}`);
});

function parseArgs(argv: string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 2) {
    values[String(argv[index] || "").replace(/^--/, "")] = String(argv[index + 1] || "");
  }
  return values;
}
