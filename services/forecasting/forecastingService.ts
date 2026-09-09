import { supabase } from "@/app/lib/supabase";

interface MonthlyData {
  periodStart: string;
  actualVolume: number;
  averageTemperature: number | null;
  totalRainfall: number | null;
  rainyDays: number | null;
  averageWindSpeed: number | null;
  averageDieselPrice: number | null;
  averageFuelAdjustment: number | null;
}

export interface ForecastRecord {
  id: string;
  periodStart: string;
  period: string;
  expectedVolume: number;
  actualVolume: number | null;
  variance: number | null;
  variancePercentage: number | null;
  trendStatus: "Above Normal" | "Below Normal" | "Normal" | "In Progress";
  factors: {
    averageTemperature: number | null;
    totalRainfall: number | null;
    rainyDays: number | null;
    averageWindSpeed: number | null;
    averageDieselPrice: number | null;
    averageFuelAdjustment: number | null;
  };
}

function transpose(matrix: number[][]): number[][] {
  return matrix[0].map((_, columnIndex) =>
    matrix.map((row) => row[columnIndex])
  );
}

function multiply(a: number[][], b: number[][]): number[][] {
  return a.map((row) =>
    b[0].map((_, columnIndex) =>
      row.reduce(
        (sum, value, rowIndex) =>
          sum + value * b[rowIndex][columnIndex],
        0
      )
    )
  );
}

function solveLinearSystem(
  matrix: number[][],
  values: number[]
): number[] {
  const size = matrix.length;
  const augmented = matrix.map((row, index) => [
    ...row,
    values[index],
  ]);

  for (let column = 0; column < size; column++) {
    let pivotRow = column;

    for (let row = column + 1; row < size; row++) {
      if (
        Math.abs(augmented[row][column]) >
        Math.abs(augmented[pivotRow][column])
      ) {
        pivotRow = row;
      }
    }

    [augmented[column], augmented[pivotRow]] = [
      augmented[pivotRow],
      augmented[column],
    ];

    const pivot = augmented[column][column];

    if (Math.abs(pivot) < 1e-10) {
      continue;
    }

    for (let item = column; item <= size; item++) {
      augmented[column][item] /= pivot;
    }

    for (let row = 0; row < size; row++) {
      if (row === column) continue;

      const factor = augmented[row][column];

      for (let item = column; item <= size; item++) {
        augmented[row][item] -=
          factor * augmented[column][item];
      }
    }
  }

  return augmented.map((row) => row[size] || 0);
}

function trainRegression(
  features: number[][],
  targets: number[]
): number[] {
  const xTranspose = transpose(features);
  const xTx = multiply(xTranspose, features);
  const xTy = multiply(
    xTranspose,
    targets.map((value) => [value])
  ).map((row) => row[0]);

  // Small ridge penalty to stabilize the model.
  for (let index = 1; index < xTx.length; index++) {
    xTx[index][index] += 0.1;
  }

  return solveLinearSystem(xTx, xTy);
}

function predict(features: number[], coefficients: number[]): number {
  return features.reduce(
    (total, feature, index) =>
      total + feature * coefficients[index],
    0
  );
}

function average(values: Array<number | null>): number {
  const available = values.filter(
    (value): value is number => value !== null
  );

  if (available.length === 0) return 0;

  return (
    available.reduce((sum, value) => sum + value, 0) /
    available.length
  );
}

function getMonthNumber(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCMonth() + 1;
}

function formatPeriod(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function getTrendStatus(
  expected: number,
  actual: number | null
): ForecastRecord["trendStatus"] {
  if (actual === null) return "In Progress";
  if (expected === 0) return "Normal";

  const differencePercentage = (actual - expected) / expected;

  if (differencePercentage > 0.05) return "Above Normal";
  if (differencePercentage < -0.05) return "Below Normal";

  return "Normal";
}

function addMonths(date: Date, numberOfMonths: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + numberOfMonths,
      1
    )
  );
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function generateRemarks(records: ForecastRecord[]): string[] {
  const completedRecords = records.filter(
    (record) => record.actualVolume !== null
  );

  if (completedRecords.length === 0) {
    return ["No completed delivery records are available for analysis."];
  }

  const remarks: string[] = [];

  const largestVariance = [...completedRecords].sort(
    (a, b) =>
      Math.abs(b.variancePercentage ?? 0) -
      Math.abs(a.variancePercentage ?? 0)
  )[0];

  if (largestVariance.variancePercentage !== null) {
    const direction =
      largestVariance.variancePercentage >= 0
        ? "above"
        : "below";

    remarks.push(
      `${largestVariance.period} recorded ${largestVariance.actualVolume} completed deliveries, ` +
        `${Math.abs(largestVariance.variancePercentage)}% ${direction} the forecast of ` +
        `${largestVariance.expectedVolume}.`
    );
  }

  const wettestMonth = [...completedRecords].sort(
    (a, b) =>
      (b.factors.totalRainfall ?? 0) -
      (a.factors.totalRainfall ?? 0)
  )[0];

  if ((wettestMonth.factors.totalRainfall ?? 0) > 0) {
    remarks.push(
      `${wettestMonth.period} had the highest recorded rainfall at ` +
        `${wettestMonth.factors.totalRainfall?.toFixed(1)} mm across ` +
        `${Math.round(wettestMonth.factors.rainyDays ?? 0)} rainy days. ` +
        `Delivery volume during this period was ` +
        `${wettestMonth.actualVolume} compared with the forecast of ` +
        `${wettestMonth.expectedVolume}.`
    );
  }

  const latestRecord =
    completedRecords[completedRecords.length - 1];

  const previousRecord =
    completedRecords.length > 1
      ? completedRecords[completedRecords.length - 2]
      : null;

  if (previousRecord && latestRecord.actualVolume !== null) {
    const monthlyChange =
      latestRecord.actualVolume -
      (previousRecord.actualVolume ?? 0);

    const direction =
      monthlyChange > 0
        ? "increased"
        : monthlyChange < 0
          ? "decreased"
          : "remained unchanged";

    remarks.push(
      `Completed deliveries ${direction} from ` +
        `${previousRecord.actualVolume} in ${previousRecord.period} to ` +
        `${latestRecord.actualVolume} in ${latestRecord.period}.`
    );
  }

  const totalActual = completedRecords.reduce(
    (sum, record) => sum + (record.actualVolume ?? 0),
    0
  );

  const totalExpected = completedRecords.reduce(
    (sum, record) => sum + record.expectedVolume,
    0
  );

  const totalPercentage =
    totalExpected === 0
      ? 0
      : ((totalActual - totalExpected) / totalExpected) * 100;

  const overallDirection =
    totalPercentage >= 0 ? "above" : "below";

  remarks.push(
    `Overall completed delivery volume is ` +
      `${Math.abs(totalPercentage).toFixed(1)}% ${overallDirection} ` +
      `the MLR forecast for the completed months of the year.`
  );

  const fuelRecord = records.find(
    (record) => record.factors.averageDieselPrice !== null
  );

  if (fuelRecord) {
    remarks.push(
      `${fuelRecord.period} recorded an average NCR diesel price of ` +
        `₱${fuelRecord.factors.averageDieselPrice?.toFixed(2)} per liter, ` +
        `with a weekly adjustment of ` +
        `${fuelRecord.factors.averageFuelAdjustment ?? 0}. ` +
        `Fuel data will be included as a model variable once sufficient monthly history is available.`
    );
  }

  return remarks;
}

export async function generateForecast() {
  const { data, error } = await supabase
    .from("ForecastingMonthlyData")
    .select("*")
    .order("periodStart", { ascending: true });

  if (error) {
    throw error;
  }

  const allRows = (data ?? []) as MonthlyData[];

  const currentMonth = new Date();
  currentMonth.setUTCDate(1);
  currentMonth.setUTCHours(0, 0, 0, 0);

  const trainingRows = allRows.filter(
    (row) =>
      new Date(`${row.periodStart}T00:00:00Z`) < currentMonth &&
      row.actualVolume !== null
  );

  if (trainingRows.length < 12) {
    throw new Error(
      "At least 12 completed months are required for forecasting."
    );
  }

  const firstTrainingDate = new Date(
    `${trainingRows[0].periodStart}T00:00:00Z`
  );

  const rainfallMean = average(
    trainingRows.map((row) => row.totalRainfall)
  );
  const temperatureMean = average(
    trainingRows.map((row) => row.averageTemperature)
  );
  const windMean = average(
    trainingRows.map((row) => row.averageWindSpeed)
  );

  function buildFeatures(row: MonthlyData, trend: number): number[] {
    const month = getMonthNumber(row.periodStart);
    const angle = (2 * Math.PI * month) / 12;

    return [
      1,
      trend,
      Math.sin(angle),
      Math.cos(angle),
      (row.totalRainfall ?? rainfallMean) / 100,
      row.averageTemperature ?? temperatureMean,
      row.averageWindSpeed ?? windMean,
    ];
  }

  const trainingFeatures = trainingRows.map((row, index) =>
    buildFeatures(row, index)
  );

  const targets = trainingRows.map((row) => row.actualVolume);
  const coefficients = trainRegression(trainingFeatures, targets);

  // Calculate typical weather for each calendar month.
  const monthlyFactorAverages = Array.from(
    { length: 12 },
    (_, monthIndex) => {
      const matchingRows = trainingRows.filter(
        (row) => getMonthNumber(row.periodStart) === monthIndex + 1
      );

      return {
        averageTemperature: average(
          matchingRows.map((row) => row.averageTemperature)
        ),
        totalRainfall: average(
          matchingRows.map((row) => row.totalRainfall)
        ),
        rainyDays: average(
          matchingRows.map((row) => row.rainyDays)
        ),
        averageWindSpeed: average(
          matchingRows.map((row) => row.averageWindSpeed)
        ),
      };
    }
  );

  const currentYear = currentMonth.getUTCFullYear();

  const outputRows: MonthlyData[] = [];

  for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
    const periodDate = new Date(
      Date.UTC(currentYear, monthIndex, 1)
    );

    const periodStart = toDateString(periodDate);
    const existingRow = allRows.find(
      (row) => row.periodStart === periodStart
    );

    const factorAverage = monthlyFactorAverages[monthIndex];

    outputRows.push({
      periodStart,
      actualVolume:
        periodDate < currentMonth
          ? existingRow?.actualVolume ?? 0
          : 0,
      averageTemperature:
        existingRow?.averageTemperature ??
        factorAverage.averageTemperature,
      totalRainfall:
        existingRow?.totalRainfall ??
        factorAverage.totalRainfall,
      rainyDays:
        existingRow?.rainyDays ??
        factorAverage.rainyDays,
      averageWindSpeed:
        existingRow?.averageWindSpeed ??
        factorAverage.averageWindSpeed,
      averageDieselPrice:
        existingRow?.averageDieselPrice ?? null,
      averageFuelAdjustment:
        existingRow?.averageFuelAdjustment ?? null,
    });
  }

  const records: ForecastRecord[] = outputRows.map((row) => {
    const periodDate = new Date(`${row.periodStart}T00:00:00Z`);

    const trend =
      (periodDate.getUTCFullYear() - firstTrainingDate.getUTCFullYear()) *
        12 +
      periodDate.getUTCMonth() -
      firstTrainingDate.getUTCMonth();

    const predictedVolume = Math.max(
      0,
      Math.round(predict(buildFeatures(row, trend), coefficients))
    );

    const actualVolume =
      periodDate < currentMonth ? row.actualVolume : null;

    const variance =
      actualVolume === null ? null : actualVolume - predictedVolume;

    const variancePercentage =
      variance === null || predictedVolume === 0
        ? null
        : Number(((variance / predictedVolume) * 100).toFixed(1));

    return {
      id: row.periodStart,
      periodStart: row.periodStart,
      period: formatPeriod(row.periodStart),
      expectedVolume: predictedVolume,
      actualVolume,
      variance,
      variancePercentage,
      trendStatus: getTrendStatus(
        predictedVolume,
        actualVolume
      ),
      factors: {
        averageTemperature: row.averageTemperature,
        totalRainfall: row.totalRainfall,
        rainyDays: row.rainyDays,
        averageWindSpeed: row.averageWindSpeed,
        averageDieselPrice: row.averageDieselPrice,
        averageFuelAdjustment: row.averageFuelAdjustment,
      },
    };
  });

  const completedRecords = records.filter(
    (record) => record.actualVolume !== null
  );

  const expectedTotal = completedRecords.reduce(
    (sum, record) => sum + record.expectedVolume,
    0
  );

  const actualTotal = completedRecords.reduce(
    (sum, record) => sum + (record.actualVolume ?? 0),
    0
  );

  const totalVariance = actualTotal - expectedTotal;

  const trendStatus = getTrendStatus(
    expectedTotal,
    actualTotal
  );

  return {
  model: "Multiple Linear Regression",
  generatedAt: new Date().toISOString(),
  trainingMonths: trainingRows.length,
  summary: {
    expectedVolume: expectedTotal,
    actualVolume: actualTotal,
    totalVariance,
    variancePercentage:
      expectedTotal === 0
        ? 0
        : Number(
            ((totalVariance / expectedTotal) * 100).toFixed(1)
          ),
    trendStatus,
  },
  records,
  remarks: generateRemarks(records),
};

}