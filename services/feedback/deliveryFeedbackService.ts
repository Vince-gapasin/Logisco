// Asking the client, and recording what they said.
//
// Two yes/no questions, put on the tracking page they are already looking at,
// once the delivery is done. No login, no separate email, no star rating.
//
// WHY SO LITTLE IS ASKED
//
// The system already knows when the truck arrived, how long it took and where
// it went. Asking a client to rate punctuality invites them to contradict a
// timestamp, and the timestamp is the better witness. What only the client can
// tell us is whether the goods arrived intact and whether the crew behaved
// well. So that is all that is asked, and the comment box - the part a
// supervisor actually reads - is left optional and last.
//
// A client who ignores it is not a complaint. Nothing is inferred from silence;
// see app/lib/performance.ts.

import { supabase } from "@/app/lib/supabase";
import { DELIVERY_STATUS } from "@/app/lib/enums";

/** Long enough for a real complaint, short enough not to be a document. */
const MAX_COMMENT = 1000;

export class FeedbackError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "FeedbackError";
  }
}

export interface FeedbackAnswers {
  goodCondition: boolean;
  courteous: boolean;
  comment?: string | null;
}

export interface FeedbackInvitation {
  /** Whether the page should ask. */
  invited: boolean;
  /** Whether this client has already answered. */
  answered: boolean;
  /** What they said, so the page can show it back rather than asking twice. */
  answers: FeedbackAnswers | null;
}

interface TrackedTrip {
  orderID: string;
  dispatchID: string;
  status: string;
}

/**
 * The trip behind a tracking token.
 *
 * The token is the capability: holding it is what proves the caller is this
 * client. Nothing else identifies them, and nothing else needs to.
 */
async function tripBehindToken(token: string): Promise<TrackedTrip | null> {
  const { data, error } = await supabase
    .from("Order")
    .select("orderID, isActive, DispatchOrder ( dispatchID, status, completedAt )")
    .eq("orderLinkToken", token)
    .maybeSingle();

  if (error) throw new FeedbackError(`Could not read the delivery: ${error.message}`, 500);
  if (!data || data.isActive === false) return null;

  const dispatches = (Array.isArray(data.DispatchOrder) ? data.DispatchOrder : [data.DispatchOrder]).filter(
    Boolean,
  ) as { dispatchID: string; status: string }[];

  // The most recent dispatch is the live one for this order, the same rule the
  // tracking page uses.
  const trip = dispatches[dispatches.length - 1];
  if (!trip?.dispatchID) return null;

  return { orderID: data.orderID as string, dispatchID: trip.dispatchID, status: trip.status };
}

async function existingAnswer(dispatchID: string): Promise<FeedbackAnswers | null> {
  const { data, error } = await supabase
    .from("DeliveryFeedback")
    .select("goodCondition, courteous, comment")
    .eq("dispatchID", dispatchID)
    .maybeSingle();

  if (error) throw new FeedbackError(`Could not read the feedback: ${error.message}`, 500);
  if (!data) return null;

  return {
    goodCondition: data.goodCondition as boolean,
    courteous: data.courteous as boolean,
    comment: (data.comment as string | null) ?? null,
  };
}

/**
 * Whether this tracking page should ask, and what it has already been told.
 *
 * Only once the delivery is finished. Asking a client how it went while the
 * truck is still on the road gets an answer about the wrong thing.
 */
export async function getFeedbackInvitation(
  dispatchID: string | null,
  status: string | null,
): Promise<FeedbackInvitation> {
  if (!dispatchID || status !== DELIVERY_STATUS.completed) {
    return { invited: false, answered: false, answers: null };
  }

  const answers = await existingAnswer(dispatchID);
  return { invited: true, answered: answers !== null, answers };
}

/**
 * Records what the client said.
 *
 * One answer per trip: answering again corrects the first rather than adding a
 * second vote. The link holder is the client, so there is nobody else to stop
 * from changing it.
 */
export async function recordClientFeedback(
  token: string,
  answers: FeedbackAnswers,
): Promise<FeedbackAnswers> {
  const trip = await tripBehindToken(token);
  if (!trip) throw new FeedbackError("Tracking link not found.", 404);

  if (trip.status !== DELIVERY_STATUS.completed) {
    throw new FeedbackError("This delivery is not finished yet.", 409);
  }

  if (typeof answers.goodCondition !== "boolean" || typeof answers.courteous !== "boolean") {
    throw new FeedbackError("Please answer both questions.");
  }

  const comment = (answers.comment ?? "").trim().slice(0, MAX_COMMENT) || null;

  const { data, error } = await supabase
    .from("DeliveryFeedback")
    .upsert(
      {
        dispatchID: trip.dispatchID,
        orderID: trip.orderID,
        goodCondition: answers.goodCondition,
        courteous: answers.courteous,
        comment,
        submittedAt: new Date().toISOString(),
        source: "tracking_link",
      },
      { onConflict: "dispatchID" },
    )
    .select("goodCondition, courteous, comment")
    .single();

  if (error) throw new FeedbackError(`Could not save your answer: ${error.message}`, 500);

  return {
    goodCondition: data.goodCondition as boolean,
    courteous: data.courteous as boolean,
    comment: (data.comment as string | null) ?? null,
  };
}
