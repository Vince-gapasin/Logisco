// What each truck status looks like, in one place.
//
// This was written twice - fully in the mechanic's fleet status and as a
// cut-down copy in the maintenance history - and the admin's fleet status had
// no version at all, which is why every truck there rendered green whether it
// was available, broken down or out of service.
//
// The variants exist because the same status is drawn at several sizes: a soft
// tint for a filter pill at rest, a solid fill for the one selected, a bordered
// chip for the table, and a pair for the detail modal.

export interface TruckStatusStyle {
  /** Soft tint. Filter pills at rest, and small inline badges. */
  bgLight: string;
  /** Solid fill. The filter pill that is currently selected. */
  tabActive: string;
  /** The bordered chip in a table row. */
  btn: string;
  modalIcon: string;
  modalBtn: string;
  badgeBg: string;
  pill: string;
}

export function getStatusStyles(status: string): TruckStatusStyle {
  switch (status) {
    case "Available":
      return {
        bgLight: "bg-emerald-50 text-emerald-700 border-emerald-200/50",
        tabActive: "bg-emerald-600 text-white shadow-md shadow-emerald-600/10",
        btn: "bg-emerald-300 text-emerald-900 border-emerald-900/80",
        modalIcon: "bg-emerald-100 text-emerald-600",
        modalBtn: "bg-emerald-600 hover:bg-emerald-700",
        badgeBg: "bg-blue-500",
        pill: "bg-blue-600 hover:bg-blue-700 text-white border-blue-600",
      };
    // Nothing in the system writes this one today - the service validates
    // against the four in TRUCK_STATUS - but both mechanic screens already
    // colour it, so it is kept rather than quietly dropped.
    case "Already Booked":
      return {
        bgLight: "bg-indigo-50 text-indigo-700 border-indigo-200/50",
        tabActive: "bg-indigo-600 text-white shadow-md shadow-indigo-600/10",
        btn: "bg-indigo-300 text-indigo-900 border-indigo-900/80",
        modalIcon: "bg-indigo-100 text-indigo-600",
        modalBtn: "bg-indigo-600 hover:bg-indigo-700",
        badgeBg: "bg-indigo-500",
        pill: "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600",
      };
    case "On Delivery":
      return {
        bgLight: "bg-blue-50 text-blue-700 border-blue-200/50",
        tabActive: "bg-blue-600 text-white shadow-md shadow-blue-600/10",
        btn: "bg-blue-300 text-blue-900 border-blue-900/80",
        modalIcon: "bg-blue-100 text-blue-600",
        modalBtn: "bg-blue-600 hover:bg-blue-700",
        badgeBg: "bg-blue-500",
        pill: "bg-blue-600 hover:bg-blue-700 text-white border-blue-600",
      };
    case "On Maintenance":
      return {
        bgLight: "bg-amber-50 text-amber-700 border-amber-200/50",
        tabActive: "bg-amber-600 text-white shadow-md shadow-amber-600/10",
        btn: "bg-amber-300 text-amber-900 border-amber-900/80",
        modalIcon: "bg-amber-100 text-amber-600",
        modalBtn: "bg-amber-600 hover:bg-amber-700",
        badgeBg: "bg-amber-500",
        pill: "bg-amber-600 hover:bg-amber-700 text-white border-amber-600",
      };
    case "Out of Service":
      return {
        bgLight: "bg-rose-50 text-rose-700 border-rose-200/50",
        tabActive: "bg-rose-600 text-white shadow-md shadow-rose-600/10",
        btn: "bg-rose-300 text-rose-900 border-rose-900/80",
        modalIcon: "bg-rose-100 text-rose-600",
        modalBtn: "bg-rose-600 hover:bg-rose-700",
        badgeBg: "bg-rose-500",
        pill: "bg-rose-600 hover:bg-rose-700 text-white border-rose-600",
      };
    // Also unwritten today. The mechanic's archive toggle looks for it.
    case "Disabled":
      return {
        bgLight: "bg-slate-100 text-slate-500 border-slate-200",
        tabActive: "bg-slate-800 text-white shadow-md",
        btn: "bg-slate-200 text-slate-500 border-slate-300",
        modalIcon: "bg-slate-100 text-slate-600",
        modalBtn: "bg-slate-600 hover:bg-slate-700",
        badgeBg: "bg-slate-400",
        pill: "bg-slate-500 hover:bg-slate-600 text-white border-slate-500",
      };
    default:
      return {
        bgLight: "bg-slate-50 text-slate-700 border-slate-200/50",
        tabActive: "bg-slate-900 text-white shadow-md",
        btn: "bg-slate-300 text-slate-900 border-slate-900/80",
        modalIcon: "bg-slate-100 text-slate-600",
        modalBtn: "bg-slate-600 hover:bg-slate-700",
        badgeBg: "bg-slate-500",
        pill: "bg-slate-600 hover:bg-slate-700 text-white border-slate-600",
      };
  }
}
