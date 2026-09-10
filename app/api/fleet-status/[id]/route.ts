import { NextResponse } from "next/server";

// Safely grab the URL whether running on the server or edge
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

const headers = {
  apikey: SUPABASE_KEY!,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    
    if (!SUPABASE_URL) {
      return NextResponse.json({ message: "Server Configuration Error" }, { status: 500 });
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/Truck?truckID=eq.${id}&select=*`, {
      method: "GET",
      headers,
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    if (Array.isArray(data) && data.length > 0) {
      return NextResponse.json(data[0], { status: 200 });
    } else {
      return NextResponse.json({ message: "Truck not found" }, { status: 404 });
    }
  } catch (error) {
    console.error("GET truck error:", error);
    return NextResponse.json({ message: "Failed to fetch truck details" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    // Auth entirely bypassed for testing
    const { id } = await params;
    const body = await request.json();
    
    const dbPayload = {
      truckCode: body.truckCode,
      plateNumber: body.plateNumber,
      truckType: body.truckType,
      model: body.truckModel,
      capacity: parseFloat(body.capacity),
      lastChecked: body.lastChecked, 
      truckStatus: body.status,
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/Truck?truckID=eq.${id}`, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify(dbPayload),
    });
    
    const data = await res.json();
      
      // 1. Check if the database returned an error object instead of an array
      if (!Array.isArray(data)) {
        return NextResponse.json(data, { status: res.ok ? 200 : 400 });
      }
      
      // 2. Prevent undefined crashes if the array is unexpectedly empty
      if (data.length === 0) {
        return NextResponse.json({ message: "Update executed, but no record returned." });
      }

      // 3. Normal successful array response
      return NextResponse.json(data[0]);

  } catch (error) {
    console.error("PUT truck error:", error);
    return NextResponse.json({ message: "Failed to update truck" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    // Auth entirely bypassed for testing
    const { id } = await params;
    
    await fetch(`${SUPABASE_URL}/rest/v1/Truck?truckID=eq.${id}`, {
      method: "DELETE",
      headers,
    });
    
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE truck error:", error);
    return NextResponse.json({ message: "Failed to delete truck" }, { status: 500 });
  }
}