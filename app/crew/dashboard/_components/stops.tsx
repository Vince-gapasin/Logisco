import type {
  DeliveryDestinationRecord,
  DeliveryRecord,
  PickupRecord,
  RouteStop,
} from "./types";

// A step's own name, whichever kind of stop it is.
export function stopName(stop?: PickupRecord | DeliveryDestinationRecord): string {
  if (!stop) return "";
  return "warehouse" in stop ? stop.warehouse : stop.branch;
}

export const generateDynamicStops = (delivery: DeliveryRecord): RouteStop[] => {
  const stops: RouteStop[] = [];
  stops.push({ title: "Start Delivery", type: "base", reqPod: false });

  if (delivery.multiplePickups && delivery.multiplePickups.length > 0) {
    delivery.multiplePickups.forEach((p) => {
      stops.push({ title: `Pickup: ${p.warehouse}`, type: "pickup", reqPod: true, data: p });
    });
  } else {
    stops.push({ title: `Pickup: ${delivery.pickupAddress?.split(',')[0] || 'Pickup point'}`, type: "pickup", reqPod: true });
  }

  if (delivery.multipleDeliveries && delivery.multipleDeliveries.length > 0) {
    delivery.multipleDeliveries.forEach((d) => {
      stops.push({ title: `Dropoff: ${d.branch}`, type: "delivery", reqPod: true, data: d });
    });
  } else {
    stops.push({ title: `Dropoff: ${delivery.clientName}`, type: "delivery", reqPod: true });
  }

  stops.push({ title: "Returned", type: "base", reqPod: false });
  return stops;
};

// Smart filter that strips out the redundant system-generated text
export const formatDispatchNote = (note?: string, delivery?: DeliveryRecord) => {
  if (!note) return "No final remarks logged.";
  
  const formatted = note
    .replace(/\[DELIVERY DETAILS\]/gi, '\n[DELIVERY DETAILS]\n')
    .replace(/\[ASSIGNED CREW\]/gi, '\n[ASSIGNED CREW]\n')
    .replace(/(Priority:|Request Date:|Delivery Schedule:|Pickup:|Truck:|Driver:|Helper 1:|Helper 2:)/gi, '\n$1');

  return (
    <div className="space-y-1.5">
      {formatted.split('\n').map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          return (
            <div key={idx} className="font-bold text-emerald-800 text-xs tracking-wider uppercase mt-4 mb-2 border-b border-emerald-200/50 pb-1 first:mt-0">
              {trimmed.replace(/\[|\]/g, '')}
            </div>
          );
        }

        const colonIdx = trimmed.indexOf(':');
        if (colonIdx > -1) {
          const label = trimmed.substring(0, colonIdx + 1);
          let value = trimmed.substring(colonIdx + 1).trim();

          if (delivery) {
            if (label === 'Truck:' && delivery.assignedVehicle) value = delivery.assignedVehicle;
            if (label === 'Driver:' && delivery.driver) value = delivery.driver;
            if (label === 'Helper 1:' && delivery.helper) value = delivery.helper;
            if (label === 'Helper 2:' && delivery.helper2) value = delivery.helper2;
          }

          return (
            <div key={idx} className="text-xs text-slate-700 pl-2 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
              <span className="font-semibold text-slate-900 shrink-0 sm:w-32">{label}</span>
              <span className="break-words text-slate-600">{value}</span>
            </div>
          );
        }

        return <div key={idx} className="text-xs text-slate-700 pl-2">{trimmed}</div>;
      })}
    </div>
  );
};
