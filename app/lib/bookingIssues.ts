// What the server refused about a new booking, put back on the fields it was
// about.
//
// A refusal the form had not caught - a first stop whose time passed while the
// form was open, a rule changed on the server before the screen was reloaded -
// came back as "Validation failed" and nothing else. The form stayed open, but
// nothing said which field or why. The server now sends each issue with its
// path in the request, and this turns that path into the cell the coordinator
// typed it in.

export interface BookingIssue {
  path: (string | number)[];
  message: string;
}

// The request's field names, as the form's own cells are keyed.
const PICKUP_FIELDS: Record<string, string> = {
  warehouseName: "warehouseName",
  pickupAddress: "warehouseAddress",
  contactPerson: "contactPerson",
  contactNum: "contactNumber",
  expectedTime: "pickupTime",
  expectedDate: "date",
  quantity: "quantity",
};
const STOP_FIELDS: Record<string, string> = {
  branchName: "branchName",
  deliveryAddress: "deliveryAddress",
  contactPerson: "contactPerson",
  contactNum: "contactNumber",
  expectedTime: "deliveryTime",
  expectedDate: "date",
  quantity: "quantity",
};

/** The form's key for the cell an issue is about, or null when it has none. */
export function formKeyForIssue(path: (string | number)[]): string | null {
  const [section, index, field] = path;
  if (section === "deliverySchedule") return "deliverySchedule";
  if (section === "items") return "product";
  if (typeof index !== "number" || typeof field !== "string") return null;
  if (section === "pickups" && PICKUP_FIELDS[field]) return `pickup_${index}_${PICKUP_FIELDS[field]}`;
  if (section === "stops" && STOP_FIELDS[field]) return `delivery_${index}_${STOP_FIELDS[field]}`;
  return null;
}

/** Where each issue is in words, for the line at the top of the form. */
function placeOf(path: (string | number)[]): string | null {
  const [section, index] = path;
  if (typeof index !== "number") return null;
  if (section === "pickups") return `Pickup ${index + 1}`;
  if (section === "stops") return `Delivery ${index + 1}`;
  return null;
}

/**
 * The cell errors to show, and one line saying what was refused. Each cell
 * keeps the first thing said about it; the line names every issue once.
 */
export function formErrorsFromIssues(issues: BookingIssue[]): { errors: Record<string, string>; summary: string } {
  const errors: Record<string, string> = {};
  const lines: string[] = [];

  for (const issue of issues) {
    const key = formKeyForIssue(issue.path);
    if (key && !errors[key]) errors[key] = issue.message;
    const place = placeOf(issue.path);
    const line = place ? `${place}: ${issue.message}` : issue.message;
    if (!lines.includes(line)) lines.push(line);
  }

  const summary =
    lines.length === 0
      ? "The booking was refused."
      : `The booking was refused - ${lines.join(" · ")}`;
  return { errors, summary };
}
