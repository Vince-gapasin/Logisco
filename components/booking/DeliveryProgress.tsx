"use client";

import { CheckCircle2 } from "lucide-react";

// Where a booking has got to, as a row of stages.
//
// Every screen that opens a booking drew this, and each held its own copy -
// five of them, which had already begun to drift apart. The stages are the
// ones toProgressStage() maps a dispatch status onto, so a booking reads the
// same here as it does on the client's tracking page.

export const PROGRESS_STAGES = ["Created", "Assigned", "In Transit", "Complete", "Returned"];

interface DeliveryProgressProps {
  currentStatus: string;
  /**
   * A delivery that is over has nothing in progress: the stage it reached is
   * finished, not pending. Live screens leave this off, so the stage a truck
   * is in the middle of shows as active.
   */
  finished?: boolean;
}

export default function DeliveryProgress({ currentStatus, finished = false }: DeliveryProgressProps) {
  const currentIndex = PROGRESS_STAGES.indexOf(currentStatus);

  return (
    <div className="w-full px-2">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.75 bg-slate-200 rounded-full z-0"></div>
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-0.75 bg-blue-500 rounded-full z-0 transition-all duration-500"
          style={{
            width: `${Math.max(0, (currentIndex / (PROGRESS_STAGES.length - 1)) * 100)}%`,
          }}
        ></div>

        {PROGRESS_STAGES.map((stage, index) => {
          const isCompleted = finished ? index <= currentIndex : index < currentIndex;
          const isActive = !finished && index === currentIndex;

          let iconBg = "bg-slate-200 text-slate-400 border-slate-200";
          if (isCompleted) iconBg = "bg-blue-500 text-white border-blue-500";
          if (isActive)
            iconBg =
              "bg-white text-blue-600 border-[1.5px] border-blue-500 shadow-sm ring-2 ring-blue-50";

          return (
            <div
              key={stage}
              className="relative z-10 flex flex-col items-center gap-1 w-10"
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${iconBg}`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-blue-600 animate-pulse" : "bg-slate-300"}`}
                  ></div>
                )}
              </div>
              <span
                className={`text-[8px] sm:text-[9px] font-bold text-center whitespace-nowrap tracking-wide ${isActive ? "text-blue-700" : isCompleted ? "text-slate-700" : "text-slate-400"}`}
              >
                {stage}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
