import { NextResponse } from "next/server";
import { authorize, OFFICE_ROLES } from "@/app/lib/auth";
import { getClientProductSuggestions } from "@/services/booking/productSuggestions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Products this client has booked before, for the booking form to suggest as
// the office types. Nothing here is required: the form works without it.
export async function GET(request: Request, { params }: RouteContext) {
  const { response } = await authorize(request, OFFICE_ROLES);
  if (response) return response;

  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ message: "Invalid client ID" }, { status: 400 });
  }

  try {
    const products = await getClientProductSuggestions(id);
    return NextResponse.json({ products });
  } catch (error) {
    console.error("GET client products error:", error);
    return NextResponse.json({ message: "Could not load this client's products" }, { status: 500 });
  }
}
