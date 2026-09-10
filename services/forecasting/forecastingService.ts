import { supabase } from "@/app/lib/supabase";

interface MonthlyData {
  periodStart: string;
  actualVolume: number | null;
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

type RidgeModelName =
  | "ridge_history_seasonality"
  | "ridge_history_weather"
  | "ridge_history_fuel"
  | "ridge_all";

type ModelName =
  | "seasonal_naive"
  | "moving_average_3"
  | RidgeModelName;

type FeatureName =
  | "trend"
  | "monthSin"
  | "monthCos"
  | "lag1"
  | "lag3"
  | "lag12"
  | "rainfall"
  | "temperature"
  | "rainyDays"
  | "windSpeed"
  | "dieselPrice"
  | "fuelAdjustment";

interface Metrics {
  mae: number;
  rmse: number;
  rSquared: number | null;
}

interface CandidateResult extends Metrics {
  name: ModelName;
  label: string;
  ridgePenalty: number | null;
}

interface FactorDefaults {
  averageTemperature: number;
  totalRainfall: number;
  rainyDays: number;
  averageWindSpeed: number;
  averageDieselPrice: number;
  averageFuelAdjustment: number;
}

interface Scaler {
  means: number[];
  standardDeviations: number[];
}

interface TrainedRidgeModel {
  coefficients: number[];
  featureNames: FeatureName[];
  scaler: Scaler;
}

const HOLDOUT_MONTHS = 12;
const RIDGE_PENALTIES = [0.01, 0.1, 1, 10, 100];

const MODEL_LABELS: Record<ModelName, string> = {
  seasonal_naive: "Seasonal Naive",
  moving_average_3: "Three-Month Moving Average",
  ridge_history_seasonality: "Ridge Regression: History and Seasonality",
  ridge_history_weather: "Ridge Regression: History, Seasonality, and Weather",
  ridge_history_fuel: "Ridge Regression: History, Seasonality, and Fuel",
  ridge_all:
  "Multiple Linear Regression (MLR): History, Weather, and Fuel",
};

const RIDGE_FEATURES: Record<RidgeModelName, FeatureName[]> = {
  ridge_history_seasonality: [
    "trend",
    "monthSin",
    "monthCos",
    "lag1",
    "lag3",
    "lag12",
  ],
  ridge_history_weather: [
    "trend",
    "monthSin",
    "monthCos",
    "lag1",
    "lag3",
    "lag12",
    "rainfall",
    "temperature",
    "rainyDays",
    "windSpeed",
  ],
  ridge_history_fuel: [
    "trend",
    "monthSin",
    "monthCos",
    "lag1",
    "lag3",
    "lag12",
    "dieselPrice",
    "fuelAdjustment",
  ],
  ridge_all: [
    "trend",
    "monthSin",
    "monthCos",
    "lag1",
    "lag3",
    "lag12",
    "rainfall",
    "temperature",
    "rainyDays",
    "windSpeed",
    "dieselPrice",
    "fuelAdjustment",
  ],
};

function transpose(matrix: number[][]): number[][] {
  return matrix[0].map((_, columnIndex) =>
    matrix.map((row) => row[columnIndex])
  );
}

function multiply(a: number[][], b: number[][]): number[][] {
  return a.map((row) =>
    b[0].map((_, columnIndex) =>
      row.reduce(
        (sum, value, rowIndex) => sum + value * b[rowIndex][columnIndex],
        0
      )
    )
  );
}

function solveLinearSystem(matrix: number[][], values: number[]): number[] {
  const size = matrix.length;
  const augmented = matrix.map((row, index) => [...row, values[index]]);

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
    if (Math.abs(pivot) < 1e-10) continue;

    for (let item = column; item <= size; item++) {
      augmented[column][item] /= pivot;
    }

    for (let row = 0; row < size; row++) {
      if (row === column) continue;
      const factor = augmented[row][column];

      for (let item = column; item <= size; item++) {
        augmented[row][item] -= factor * augmented[column][item];
      }
    }
  }

  return augmented.map((row) => row[size] || 0);
}

function trainRegression(
  features: number[][],
  targets: number[],
  ridgePenalty: number
): number[] {
  const xTranspose = transpose(features);
  const xTx = multiply(xTranspose, features);
  const xTy = multiply(
    xTranspose,
    targets.map((value) => [value])
  ).map((row) => row[0]);

  // Do not penalize the intercept at index zero.
  for (let index = 1; index < xTx.length; index++) {
    xTx[index][index] += ridgePenalty;
  }

  return solveLinearSystem(xTx, xTy);
}

function predict(features: number[], coefficients: number[]): number {
  return features.reduce(
    (total, feature, index) => total + feature * coefficients[index],
    0
  );
}

function average(values: Array<number | null | undefined>): number {
  const available = values.filter(
    (value): value is number => value !== null && value !== undefined
  );

  if (available.length === 0) return 0;
  return available.reduce((sum, value) => sum + value, 0) / available.length;
}

function round(value: number, decimalPlaces = 2): number {
  const multiplier = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function roundNullable(value: number | null): number | null {
  return value === null ? null : round(value);
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

function shiftPeriod(periodStart: string, numberOfMonths: number): string {
  return toDateString(
    addMonths(new Date(`${periodStart}T00:00:00Z`), numberOfMonths)
  );
}

function monthDistance(start: string, end: string): number {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);

  return (
    (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
    endDate.getUTCMonth() -
    startDate.getUTCMonth()
  );
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

function makeActualHistory(rows: MonthlyData[]): Map<string, number> {
  return new Map(
    rows
      .filter((row): row is MonthlyData & { actualVolume: number } =>
        row.actualVolume !== null
      )
      .map((row) => [row.periodStart, row.actualVolume])
  );
}

function recentAverage(
  periodStart: string,
  months: number,
  history: Map<string, number>,
  fallback: number
): number {
  const values: number[] = [];

  for (let offset = 1; offset <= months; offset++) {
    const value = history.get(shiftPeriod(periodStart, -offset));
    if (value !== undefined) values.push(value);
  }

  return values.length > 0 ? average(values) : fallback;
}

function baselinePrediction(
  name: "seasonal_naive" | "moving_average_3",
  row: MonthlyData,
  history: Map<string, number>,
  fallback: number
): number {
  if (name === "seasonal_naive") {
    return (
      history.get(shiftPeriod(row.periodStart, -12)) ??
      recentAverage(row.periodStart, 3, history, fallback)
    );
  }

  return recentAverage(row.periodStart, 3, history, fallback);
}

function calculateDefaults(rows: MonthlyData[]): FactorDefaults {
  return {
    averageTemperature: average(rows.map((row) => row.averageTemperature)),
    totalRainfall: average(rows.map((row) => row.totalRainfall)),
    rainyDays: average(rows.map((row) => row.rainyDays)),
    averageWindSpeed: average(rows.map((row) => row.averageWindSpeed)),
    averageDieselPrice: average(rows.map((row) => row.averageDieselPrice)),
    averageFuelAdjustment: average(
      rows.map((row) => row.averageFuelAdjustment)
    ),
  };
}

function buildRawFeatures(
  row: MonthlyData,
  firstPeriod: string,
  featureNames: FeatureName[],
  history: Map<string, number>,
  historyFallback: number,
  defaults: FactorDefaults
): number[] {
  const month = getMonthNumber(row.periodStart);
  const angle = (2 * Math.PI * month) / 12;
  const values: Record<FeatureName, number> = {
    trend: monthDistance(firstPeriod, row.periodStart),
    monthSin: Math.sin(angle),
    monthCos: Math.cos(angle),
    lag1:
      history.get(shiftPeriod(row.periodStart, -1)) ?? historyFallback,
    lag3: recentAverage(row.periodStart, 3, history, historyFallback),
    lag12:
      history.get(shiftPeriod(row.periodStart, -12)) ?? historyFallback,
    rainfall: row.totalRainfall ?? defaults.totalRainfall,
    temperature: row.averageTemperature ?? defaults.averageTemperature,
    rainyDays: row.rainyDays ?? defaults.rainyDays,
    windSpeed: row.averageWindSpeed ?? defaults.averageWindSpeed,
    dieselPrice: row.averageDieselPrice ?? defaults.averageDieselPrice,
    fuelAdjustment:
      row.averageFuelAdjustment ?? defaults.averageFuelAdjustment,
  };

  return featureNames.map((name) => values[name]);
}

function fitScaler(rows: number[][]): Scaler {
  const columnCount = rows[0]?.length ?? 0;
  const means = Array.from({ length: columnCount }, (_, columnIndex) =>
    average(rows.map((row) => row[columnIndex]))
  );
  const standardDeviations = means.map((mean, columnIndex) => {
    const variance = average(
      rows.map((row) => (row[columnIndex] - mean) ** 2)
    );
    const deviation = Math.sqrt(variance);
    return deviation < 1e-10 ? 1 : deviation;
  });

  return { means, standardDeviations };
}

function scaleFeatures(values: number[], scaler: Scaler): number[] {
  return [
    1,
    ...values.map(
      (value, index) =>
        (value - scaler.means[index]) / scaler.standardDeviations[index]
    ),
  ];
}

function calculateMetrics(actual: number[], predicted: number[]): Metrics {
  const errors = actual.map((value, index) => value - predicted[index]);
  const mae = average(errors.map((error) => Math.abs(error)));
  const rmse = Math.sqrt(average(errors.map((error) => error ** 2)));
  const actualMean = average(actual);
  const residualSumOfSquares = errors.reduce(
    (sum, error) => sum + error ** 2,
    0
  );
  const totalSumOfSquares = actual.reduce(
    (sum, value) => sum + (value - actualMean) ** 2,
    0
  );

  return {
    mae: round(mae),
    rmse: round(rmse),
    rSquared:
      totalSumOfSquares === 0
        ? null
        : round(1 - residualSumOfSquares / totalSumOfSquares, 4),
  };
}

function trainRidgeModel(
  rows: MonthlyData[],
  featureNames: FeatureName[],
  ridgePenalty: number,
  firstPeriod: string,
  history: Map<string, number>,
  historyFallback: number,
  defaults: FactorDefaults
): TrainedRidgeModel {
  const rawFeatures = rows.map((row) =>
    buildRawFeatures(
      row,
      firstPeriod,
      featureNames,
      history,
      historyFallback,
      defaults
    )
  );
  const scaler = fitScaler(rawFeatures);
  const features = rawFeatures.map((values) => scaleFeatures(values, scaler));
  const targets = rows.map((row) => row.actualVolume ?? 0);

  return {
    coefficients: trainRegression(features, targets, ridgePenalty),
    featureNames,
    scaler,
  };
}

function ridgePrediction(
  model: TrainedRidgeModel,
  row: MonthlyData,
  firstPeriod: string,
  history: Map<string, number>,
  historyFallback: number,
  defaults: FactorDefaults
): number {
  const rawFeatures = buildRawFeatures(
    row,
    firstPeriod,
    model.featureNames,
    history,
    historyFallback,
    defaults
  );

  return predict(scaleFeatures(rawFeatures, model.scaler), model.coefficients);
}

function selectBestModel(trainingRows: MonthlyData[]): {
  selected: CandidateResult;
  candidates: CandidateResult[];
  fitMonths: number;
  validationMonths: number;
} {
  const fitRows = trainingRows.slice(0, -HOLDOUT_MONTHS);
  const validationRows = trainingRows.slice(-HOLDOUT_MONTHS);
  const firstPeriod = trainingRows[0].periodStart;
  const history = makeActualHistory(trainingRows);
  const historyFallback = average(fitRows.map((row) => row.actualVolume));
  const defaults = calculateDefaults(fitRows);
  const actual = validationRows.map((row) => row.actualVolume ?? 0);
  const candidates: CandidateResult[] = [];

  for (const name of ["seasonal_naive", "moving_average_3"] as const) {
    const predicted = validationRows.map((row) =>
      Math.max(0, baselinePrediction(name, row, history, historyFallback))
    );
    candidates.push({
      name,
      label: MODEL_LABELS[name],
      ridgePenalty: null,
      ...calculateMetrics(actual, predicted),
    });
  }

  const eligibleFitRows = fitRows.slice(12);

  for (const name of Object.keys(RIDGE_FEATURES) as RidgeModelName[]) {
    for (const ridgePenalty of RIDGE_PENALTIES) {
      const model = trainRidgeModel(
        eligibleFitRows,
        RIDGE_FEATURES[name],
        ridgePenalty,
        firstPeriod,
        history,
        historyFallback,
        defaults
      );
      const predicted = validationRows.map((row) =>
        Math.max(
          0,
          ridgePrediction(
            model,
            row,
            firstPeriod,
            history,
            historyFallback,
            defaults
          )
        )
      );

      candidates.push({
        name,
        label: MODEL_LABELS[name],
        ridgePenalty,
        ...calculateMetrics(actual, predicted),
      });
    }
  }

candidates.sort((a, b) => a.mae - b.mae || a.rmse - b.rmse);

const selectedMlr = candidates.find((candidate) =>
  candidate.name.startsWith("ridge_")
);

if (!selectedMlr) {
  throw new Error("No valid MLR model was produced.");
}


  return {
    selected: selectedMlr,
    candidates,
    fitMonths: fitRows.length,
    validationMonths: validationRows.length,
  };
}

function generateRemarks(
  records: ForecastRecord[],
  modelLabel: string,
  usesFuel: boolean
): string[] {
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
      largestVariance.variancePercentage >= 0 ? "above" : "below";
    remarks.push(
      `${largestVariance.period} recorded ${largestVariance.actualVolume} completed deliveries, ` +
        `${Math.abs(largestVariance.variancePercentage)}% ${direction} the forecast of ` +
        `${largestVariance.expectedVolume}.`
    );
  }

  const wettestMonth = [...completedRecords].sort(
    (a, b) =>
      (b.factors.totalRainfall ?? 0) - (a.factors.totalRainfall ?? 0)
  )[0];

  if ((wettestMonth.factors.totalRainfall ?? 0) > 0) {
    remarks.push(
      `${wettestMonth.period} had the highest recorded rainfall at ` +
        `${wettestMonth.factors.totalRainfall?.toFixed(1)} mm across ` +
        `${Math.round(wettestMonth.factors.rainyDays ?? 0)} rainy days. ` +
        `Delivery volume during this period was ${wettestMonth.actualVolume} ` +
        `compared with the forecast of ${wettestMonth.expectedVolume}.`
    );
  }

  const latestRecord = completedRecords.at(-1);
  const previousRecord = completedRecords.at(-2);

  if (latestRecord && previousRecord && latestRecord.actualVolume !== null) {
    const monthlyChange =
      latestRecord.actualVolume - (previousRecord.actualVolume ?? 0);
    const direction =
      monthlyChange > 0
        ? "increased"
        : monthlyChange < 0
          ? "decreased"
          : "remained unchanged";
    remarks.push(
      `Completed deliveries ${direction} from ${previousRecord.actualVolume} ` +
        `in ${previousRecord.period} to ${latestRecord.actualVolume} in ${latestRecord.period}.`
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
  const overallDirection = totalPercentage >= 0 ? "above" : "below";

  remarks.push(
    `Overall completed delivery volume is ${Math.abs(totalPercentage).toFixed(1)}% ` +
      `${overallDirection} the ${modelLabel} forecast for the completed months of the year.`
  );

  const fuelRecord = records.find(
    (record) => record.factors.averageDieselPrice !== null
  );

  if (fuelRecord) {
    remarks.push(
      `${fuelRecord.period} recorded an average NCR diesel price of ` +
        `₱${fuelRecord.factors.averageDieselPrice?.toFixed(2)} per liter, ` +
        `with an average adjustment of ${fuelRecord.factors.averageFuelAdjustment ?? 0}. ` +
        (usesFuel
          ? "Fuel variables are included in the selected forecasting model."
          : "Fuel variables were evaluated but did not improve holdout accuracy enough to be selected.")
    );
  }

  return remarks;
}

export async function generateForecast() {
  const { data, error } = await supabase
    .from("ForecastingMonthlyData")
    .select("*")
    .order("periodStart", { ascending: true });

  if (error) throw error;

  const allRows = ((data ?? []) as MonthlyData[]).sort((a, b) =>
    a.periodStart.localeCompare(b.periodStart)
  );
  const currentMonth = new Date();
  currentMonth.setUTCDate(1);
  currentMonth.setUTCHours(0, 0, 0, 0);

  const trainingRows = allRows.filter(
    (row): row is MonthlyData & { actualVolume: number } =>
      new Date(`${row.periodStart}T00:00:00Z`) < currentMonth &&
      row.actualVolume !== null
  );

  if (trainingRows.length < 36) {
    throw new Error(
      "At least 36 completed months are required for 12-month holdout validation."
    );
  }

  const selection = selectBestModel(trainingRows);
  const selected = selection.selected;
  const firstPeriod = trainingRows[0].periodStart;
  const history = makeActualHistory(trainingRows);
  const historyFallback = average(
    trainingRows.map((row) => row.actualVolume)
  );
  const defaults = calculateDefaults(trainingRows);
  const latestDieselPrice =
    [...allRows]
      .reverse()
      .find((row) => row.averageDieselPrice !== null)?.averageDieselPrice ??
    defaults.averageDieselPrice;

  let finalRidgeModel: TrainedRidgeModel | null = null;
  if (selected.name.startsWith("ridge_")) {
    finalRidgeModel = trainRidgeModel(
      trainingRows.slice(12),
      RIDGE_FEATURES[selected.name as RidgeModelName],
      selected.ridgePenalty ?? 1,
      firstPeriod,
      history,
      historyFallback,
      defaults
    );
  }

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
        totalRainfall: average(matchingRows.map((row) => row.totalRainfall)),
        rainyDays: average(matchingRows.map((row) => row.rainyDays)),
        averageWindSpeed: average(
          matchingRows.map((row) => row.averageWindSpeed)
        ),
      };
    }
  );

  const currentYear = currentMonth.getUTCFullYear();
  const outputRows: MonthlyData[] = [];

  for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
    const periodDate = new Date(Date.UTC(currentYear, monthIndex, 1));
    const periodStart = toDateString(periodDate);
    const existingRow = allRows.find(
      (row) => row.periodStart === periodStart
    );
    const factorAverage = monthlyFactorAverages[monthIndex];

    outputRows.push({
      periodStart,
      actualVolume:
        periodDate < currentMonth ? existingRow?.actualVolume ?? 0 : null,
      averageTemperature:
        existingRow?.averageTemperature ?? factorAverage.averageTemperature,
      totalRainfall:
        existingRow?.totalRainfall ?? factorAverage.totalRainfall,
      rainyDays: existingRow?.rainyDays ?? factorAverage.rainyDays,
      averageWindSpeed:
        existingRow?.averageWindSpeed ?? factorAverage.averageWindSpeed,
      averageDieselPrice:
        existingRow?.averageDieselPrice ?? latestDieselPrice,
      averageFuelAdjustment: existingRow?.averageFuelAdjustment ?? 0,
    });
  }

  const records: ForecastRecord[] = [];

  for (const row of outputRows) {
    let rawPrediction: number;

    if (selected.name === "seasonal_naive" || selected.name === "moving_average_3") {
      rawPrediction = baselinePrediction(
        selected.name,
        row,
        history,
        historyFallback
      );
    } else {
      if (!finalRidgeModel) {
        throw new Error("The selected ridge model was not trained.");
      }
      rawPrediction = ridgePrediction(
        finalRidgeModel,
        row,
        firstPeriod,
        history,
        historyFallback,
        defaults
      );
    }

    const predictedVolume = Math.max(0, Math.round(rawPrediction));
    const periodDate = new Date(`${row.periodStart}T00:00:00Z`);
    const actualVolume = periodDate < currentMonth ? row.actualVolume : null;
    const variance =
      actualVolume === null ? null : actualVolume - predictedVolume;
    const variancePercentage =
      variance === null || predictedVolume === 0
        ? null
        : round((variance / predictedVolume) * 100, 1);

    records.push({
      id: row.periodStart,
      periodStart: row.periodStart,
      period: formatPeriod(row.periodStart),
      expectedVolume: predictedVolume,
      actualVolume,
      variance,
      variancePercentage,
      trendStatus: getTrendStatus(predictedVolume, actualVolume),
      factors: {
        averageTemperature: roundNullable(row.averageTemperature),
        totalRainfall: roundNullable(row.totalRainfall),
        rainyDays: roundNullable(row.rainyDays),
        averageWindSpeed: roundNullable(row.averageWindSpeed),
        averageDieselPrice: roundNullable(row.averageDieselPrice),
        averageFuelAdjustment: roundNullable(row.averageFuelAdjustment),
      },
    });

    // Multi-step future forecasts use earlier predictions as their lag values.
    if (actualVolume === null) {
      history.set(row.periodStart, predictedVolume);
    }
  }

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
  const usesFuel =
    selected.name === "ridge_history_fuel" || selected.name === "ridge_all";

  return {
    model: selected.label,
    generatedAt: new Date().toISOString(),
    trainingMonths: trainingRows.length,
    summary: {
      expectedVolume: expectedTotal,
      actualVolume: actualTotal,
      totalVariance,
      variancePercentage:
        expectedTotal === 0
          ? 0
          : round((totalVariance / expectedTotal) * 100, 1),
      trendStatus: getTrendStatus(expectedTotal, actualTotal),
      accuracy: {
        method: "Latest 12 completed months held out chronologically",
        evaluatedMonths: selection.validationMonths,
        mae: selected.mae,
        rmse: selected.rmse,
        rSquared: selected.rSquared,
      },
    },
    modelSelection: {
      selectedModel: selected.name,
      selectedLabel: selected.label,
      ridgePenalty: selected.ridgePenalty,
      fitMonths: selection.fitMonths,
      validationMonths: selection.validationMonths,
      candidates: selection.candidates.map((candidate) => ({
        model: candidate.name,
        label: candidate.label,
        ridgePenalty: candidate.ridgePenalty,
        mae: candidate.mae,
        rmse: candidate.rmse,
        rSquared: candidate.rSquared,
      })),
    },
    records,
    remarks: generateRemarks(records, selected.label, usesFuel),
  };
}
