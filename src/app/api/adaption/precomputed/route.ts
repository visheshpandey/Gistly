import fs from "node:fs/promises";
import path from "node:path";

// The saved result of one real Adaption run on the sample dataset.
// Lets the demo show real quality numbers without calling Adaption again.
const FILE = path.join(process.cwd(), "data", "adaption-sample.json");

export async function GET() {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return Response.json(JSON.parse(raw));
  } catch {
    return Response.json({ error: "No precomputed Adaption result is saved yet." }, { status: 404 });
  }
}
