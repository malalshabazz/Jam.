import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  NominatimRateLimitError,
  NominatimUpstreamError,
  searchNominatimPlaces,
} from "@/lib/nominatim-server";

export const dynamic = "force-dynamic";

const MIN_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 80;

export async function GET(request: NextRequest) {
  const accessToken = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!accessToken) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return Response.json({ error: "Location search is not configured." }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser(accessToken);
  if (!user) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < MIN_QUERY_LENGTH) {
    return Response.json({ results: [] });
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return Response.json({ error: "Search is too long." }, { status: 400 });
  }

  try {
    const results = await searchNominatimPlaces(query);
    return Response.json({ results });
  } catch (error) {
    if (error instanceof NominatimRateLimitError) {
      return Response.json({ error: error.message, retry: true }, { status: 429 });
    }
    if (error instanceof NominatimUpstreamError) {
      return Response.json({ error: "Location search is unavailable." }, { status: 503 });
    }
    return Response.json({ error: "Location search failed." }, { status: 500 });
  }
}
