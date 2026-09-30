import { NextResponse } from "next/server";
import { authorize, CREW_ROLES } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";
import { getCrewAssignment, isUuid } from "@/services/dispatch/dispatchService";
import { CHECK_IN_LABELS, isCheckInState, isCallForHelp } from "@/app/lib/stallRules";
import { announceCheckIn } from "@/services/dispatch/crewUpdateService";

// The crew answering why their truck has gone quiet.
//
// The thirty-minute alert has always told the office that "the crew have been
// asked to get in touch". This is the first time they can actually answer.
//
// Only the driver or a helper on this trip may answer for it, and only about
// their own trip - the same rule the location ping uses, for the same reason.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { auth, response } = await authorize(request, CREW_ROLES);
  if (response) return response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const dispatchID = body.dispatch_id;
  const state = body.state;

  if (!isUuid(dispatchID)) {
    return NextResponse.json({ message: "Which delivery is not clear." }, { status: 400 });
  }
  if (!isCheckInState(state)) {
    return NextResponse.json({ message: "Choose what is happening." }, { status: 400 });
  }

  try {
    const assignment = await getCrewAssignment(dispatchID, auth!.employee.employeeID);
    if (!assignment) {
      return NextResponse.json(
        { message: "Only the crew on this delivery can answer for it." },
        { status: 403 },
      );
    }

    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;

    // Appended, never replaced: the sequence is the story of the trip, and one
    // reading "traffic, traffic, truck problem" says more than the last entry
    // alone. The stall check only ever reads the newest.
    const { data, error } = await supabase
      .from("StallCheckIn")
      .insert({
        dispatchID,
        employeeID: auth!.employee.employeeID,
        state,
        note,
      })
      .select("checkInID, state, createdAt")
      .single();

    if (error) throw new Error(error.message);

    // "Your coordinator has been told" was answered to the crew below without
    // anybody being told. It reached the fleet board and stopped there.
    await announceCheckIn(
      dispatchID,
      state,
      note,
      (data.createdAt as string) ?? new Date().toISOString(),
      { employeeID: auth!.employee.employeeID, employeeName: auth!.employee.employeeName },
    );

    return NextResponse.json({
      message: isCallForHelp(state)
        ? "Your coordinator has been told. Someone will call you."
        : `Thank you - we have logged "${CHECK_IN_LABELS[state]}" and will stop chasing this for now.`,
      data,
    });
  } catch (error) {
    console.error("[Crew check-in error]:", error);
    return NextResponse.json({ message: "Could not send your answer" }, { status: 500 });
  }
}
