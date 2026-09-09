import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

const headers = {
  apikey: SUPABASE_KEY || "",
  Authorization: `Bearer ${SUPABASE_KEY || ""}`,
  "Content-Type": "application/json",
};

export async function GET() {
  if (!SUPABASE_URL) {
    return NextResponse.json({ message: "Server Configuration Error: Missing SUPABASE_URL" }, { status: 500 });
  }

  try {
    // Auth entirely bypassed for testing
    const res = await fetch(`${SUPABASE_URL}/rest/v1/Truck?select=*&order=lastChecked.desc`, { headers });
    const data = await res.json();
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET trucks error:", error);
    return NextResponse.json({ message: "Failed to fetch trucks" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!SUPABASE_URL) {
    return NextResponse.json({ message: "Server Configuration Error: Missing SUPABASE_URL" }, { status: 500 });
  }

  try {
    // Auth entirely bypassed for testing
    const body = await request.json();
    
    const dbPayload = {
      truckCode: body.truckCode,
      plateNumber: body.plateNumber,
      truckType: body.truckType,
      model: body.truckModel, 
      capacity: parseFloat(body.capacity),
      lastChecked: body.lastChecked,
      truckStatus: body.status || 'Available',
      isActive: true
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/Truck`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify(dbPayload),
    });
    
    const data = await res.json();
    return NextResponse.json(data[0], { status: 201 });
  } catch (error) {
    console.error("POST truck error:", error);
    return NextResponse.json({ message: "Failed to create truck" }, { status: 500 });
  }
}