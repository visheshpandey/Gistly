import fs from "node:fs/promises";
import path from "node:path";

// The saved result of one real AI analysis of the sample dataset.
// Lets the demo show real results without calling the AI again.
const FILE = path.join(process.cwd(), "data", "analysis-sample.json");

export async function GET() {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return Response.json(JSON.parse(raw));
  } catch {
    return Response.json({ error: "No saved analysis yet." }, { status: 404 });
  }
}
