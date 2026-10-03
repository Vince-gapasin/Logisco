
// ==========================================
// STATUS BADGE HELPERS
// ==========================================
export const getStatusBadgeClass = (status: string) => {
  if (status === "Crew to Start Delivery") {
    return "bg-emerald-100 text-emerald-800 border border-emerald-200";
  }
  if (status === "Declined") {
    return "bg-red-100 text-red-700 border border-red-200";
  }
  if (status === "Assign Crew" || status === "Unassigned") {
    return "bg-blue-100 text-blue-800 border border-blue-200";
  }
  return "bg-amber-100 text-amber-800 border border-amber-200";
};

export const getCrewStatusBadge = (status: string) => {
  switch (status) {
    case "Accepted":
      return "bg-emerald-100 text-emerald-700";
    case "Declined":
      return "bg-red-100 text-red-700";
    case "Pending":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
};
