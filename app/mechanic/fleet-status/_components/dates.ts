import { formatDate } from "@/app/lib/datetime";

export const formatDisplayDate = (dateString: string) => {
  if (!dateString) return "Not recorded";
  return formatDate(dateString);
};

//  To format dates correctly for <input type="date"> in local time
export const formatInputDate = (dateString: string) => {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString.split("T")[0];
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } catch (error) {
    return dateString.split("T")[0];
  }
};
