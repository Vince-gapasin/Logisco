import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY; 

const headers = {
  apikey: SUPABASE_KEY!,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

export async function GET() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/Truck?select=*&order=lastChecked.desc`, { headers });
  const data = await res.json();
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const body = await request.json();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/Truck`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data[0]);
}