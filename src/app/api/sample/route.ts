import { loadSample } from "@/lib/feedback";

// Returns the built-in sample dataset as JSON, already grouped into unique reviews,
// together with the instant import stats.
export async function GET() {
  const { rows, stats, error } = await loadSample();
  if (error) {
    return Response.json({ error }, { status: 500 });
  }
  return Response.json({ rows, stats });
}
