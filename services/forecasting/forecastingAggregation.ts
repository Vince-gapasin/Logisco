import {
  ForecastRecord,
  YearlyForecastData,
  MonthlyForecastData,
  WeeklyForecastData,
  DailyForecastRecord,
} from "./forecastingService";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function calculateVariance(expected: number, actual: number | null) {
  const variance = actual === null ? null : roundTo(actual - expected, 1);
  const variancePercentage =
    variance === null || expected === 0
      ? null
      : Number(((variance / expected) * 100).toFixed(1));
  return { variance, variancePercentage };
}

// Splits a whole-number total across parts in proportion to their weights,
// keeping whole numbers that still add up to the original total.
function splitWholeNumber(total: number, weights: number[]) {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const raw = weights.map((weight) => (total * weight) / weightSum);
  const result = raw.map(Math.floor);
  let remaining = total - result.reduce((sum, value) => sum + value, 0);

  raw
    .map((value, index) => ({ index, fraction: value - result[index] }))
    .sort((a, b) => b.fraction - a.fraction)
    .forEach(({ index }) => {
      if (remaining > 0) {
        result[index] += 1;
        remaining -= 1;
      }
    });

  return result;
}

// Weeks are counted inside each month (days 1-7, 8-14, 15-21, 22-28, 29-end)
// so every week belongs to exactly one month and weekly totals add up to the
// monthly totals. The monthly forecast is spread across its days evenly.
function buildWeeklyAndDaily(
  records: ForecastRecord[],
  dailyActuals: { periodStart: string; actualVolume: number }[],
  today: Date,
) {
  const actualByDate = new Map(
    dailyActuals.map((day) => [day.periodStart, day.actualVolume]),
  );
  const todayString = today.toISOString().slice(0, 10);

  const weekly: WeeklyForecastData[] = [];
  const daily: DailyForecastRecord[] = [];

  for (const record of records) {
    const year = Number(record.periodStart.slice(0, 4));
    const month = Number(record.periodStart.slice(5, 7));
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const dateFor = (day: number) => `${year}-${pad(month)}-${pad(day)}`;
    const dailyExpected = record.expectedVolume / daysInMonth;

    const weeks: { startDay: number; endDay: number }[] = [];
    for (let startDay = 1; startDay <= daysInMonth; startDay += 7) {
      weeks.push({ startDay, endDay: Math.min(startDay + 6, daysInMonth) });
    }

    const weeklyExpected = splitWholeNumber(
      record.expectedVolume,
      weeks.map((week) => week.endDay - week.startDay + 1),
    );

    weeks.forEach((week, index) => {
      const periodStart = dateFor(week.startDay);
      const periodEnd = dateFor(week.endDay);
      const isComplete = periodEnd < todayString;

      let actualVolume: number | null = null;
      if (isComplete) {
        actualVolume = 0;
        for (let day = week.startDay; day <= week.endDay; day++) {
          actualVolume += actualByDate.get(dateFor(day)) ?? 0;
        }
      }

      const expectedVolume = weeklyExpected[index];

      weekly.push({
        periodStart,
        periodEnd,
        weekOfMonth: index + 1,
        expectedVolume,
        actualVolume,
        ...calculateVariance(expectedVolume, actualVolume),
      });

      for (let day = week.startDay; day <= week.endDay; day++) {
        const date = dateFor(day);
        const dayActual = date < todayString ? actualByDate.get(date) ?? 0 : null;
        const dayExpected = roundTo(dailyExpected, 1);

        daily.push({
          periodStart: date,
          weekStart: periodStart,
          expectedVolume: dayExpected,
          actualVolume: dayActual,
          ...calculateVariance(dayExpected, dayActual),
        });
      }
    });
  }

  return { weekly, daily };
}

export function buildForecastFilters(
  records: ForecastRecord[],
  dailyActuals: { periodStart: string; actualVolume: number }[] = [],
  today: Date = new Date(),
) {

  const yearlyMap = new Map<
    number,
    YearlyForecastData
  >();

  const monthlyMap = new Map<
    string,
    MonthlyForecastData
  >();

  for (const record of records) {

    const date = new Date(
      `${record.periodStart}T00:00:00Z`
    );

    const year =
      date.getUTCFullYear();

    const month =
      date.getUTCMonth() + 1;

    const monthKey =
      `${year}-${String(month).padStart(2,"0")}`;

    const monthName =
      date.toLocaleString(
        "en-US",
        {
          month:"long"
        }
      );

    //
    // YEARLY
    //

    // Only completed months count toward the yearly totals, so the current
    // year compares its finished months with the forecast for those same
    // months (not a full-year forecast against a partial year).
    const isCompleted = record.actualVolume !== null;

    const existingYear =
      yearlyMap.get(year);

    if(existingYear){

      if (isCompleted) {
        existingYear.expectedVolume +=
          record.expectedVolume;

        existingYear.actualVolume +=
          record.actualVolume ?? 0;
      }

    }
    else {

      yearlyMap.set(
        year,
        {
          year,
          expectedVolume:
            isCompleted ? record.expectedVolume : 0,
          actualVolume:
            record.actualVolume ?? 0,
          variance:0,
          variancePercentage:null
        }
      );

    }

    //
    // MONTHLY
    //

    const existingMonth =
      monthlyMap.get(monthKey);

    if(existingMonth){

      existingMonth.expectedVolume +=
        record.expectedVolume;

      existingMonth.actualVolume +=
        record.actualVolume ?? 0;

    }
    else {

      monthlyMap.set(
        monthKey,
        {
          periodStart:
            record.periodStart,

          year,

          month,

          monthName,

          expectedVolume:
            record.expectedVolume,

          actualVolume:
            record.actualVolume ?? 0,

          variance:0,

          variancePercentage:null
        }
      );

    }


  }

  const { weekly, daily } = buildWeeklyAndDaily(
    records,
    dailyActuals,
    today,
  );

  const yearly =
    Array.from(
      yearlyMap.values()
    );


  yearly.forEach(item=>{

    item.variance =
      item.actualVolume -
      item.expectedVolume;


    item.variancePercentage =
      item.expectedVolume === 0
      ? null
      :
      Number(
        (
          item.variance /
          item.expectedVolume *
          100
        ).toFixed(1)
      );

  });

  const monthly =
    Array.from(
      monthlyMap.values()
    );

  monthly.forEach(item=>{

    item.variance =
      item.actualVolume -
      item.expectedVolume;

    item.variancePercentage =
      item.expectedVolume === 0
      ? null
      :
      Number(
        (
          item.variance /
          item.expectedVolume *
          100
        ).toFixed(1)
      );

  });

  return {

    yearly:
      yearly.sort(
        (a,b)=>
        a.year-b.year
      ),

    monthly:
      monthly.sort(
        (a,b)=>
        a.periodStart.localeCompare(
          b.periodStart
        )
      ),

    weekly:
      weekly.sort(
        (a,b)=>
        a.periodStart.localeCompare(
          b.periodStart
        )
      ),

    daily

  };

}