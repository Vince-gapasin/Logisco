import { supabase } from "@/app/lib/supabase";
import { generateForecast } from "@/services/forecasting/forecastingService";

export async function createMonthlyForecastSnapshot() {
  const forecast = await generateForecast();
  const generatedAt = new Date(forecast.generatedAt);
  const snapshotMonth = new Date(
    Date.UTC(generatedAt.getUTCFullYear(), generatedAt.getUTCMonth(), 1),
  )
    .toISOString()
    .slice(0, 10);

  // Snapshot only periods whose actual result was unknown when forecasted.
  const pendingRecords = forecast.records.filter(
    (record) => record.actualVolume === null,
  );

  if (pendingRecords.length === 0) {
    return {
      snapshotMonth,
      recordsSaved: 0,
      records: [],
    };
  }

  const rows = pendingRecords.map((record) => ({
    snapshotMonth,
    targetPeriod: record.periodStart,
    expectedVolume: record.expectedVolume,
    model: forecast.model,
    trainingMonths: forecast.trainingMonths,
    validationMAE: forecast.summary.accuracy.mae,
    validationRMSE: forecast.summary.accuracy.rmse,
    validationRSquared: forecast.summary.accuracy.rSquared,
    generatedAt: forecast.generatedAt,
  }));

  const { data, error } = await supabase
    .from("ForecastSnapshot")
    .upsert(rows, {
      onConflict: "snapshotMonth,targetPeriod",
      ignoreDuplicates: true,
    })
    .select("*");

  if (error) throw error;

  return {
    snapshotMonth,
    recordsSaved: data?.length ?? 0,
    records: data ?? [],
  };
}

export async function getForecastSnapshots() {
  const { data, error } = await supabase
    .from("ForecastSnapshot")
    .select("*")
    .order("snapshotMonth", { ascending: false })
    .order("targetPeriod", { ascending: true });

  if (error) throw error;

  return data ?? [];
}

export async function evaluateCompletedForecastSnapshots() {
  const currentMonth = new Date();
  currentMonth.setUTCDate(1);
  currentMonth.setUTCHours(0, 0, 0, 0);
  const currentMonthString = currentMonth.toISOString().slice(0, 10);

  const { data: snapshots, error: snapshotsError } = await supabase
    .from("ForecastSnapshot")
    .select("forecastSnapshotID,targetPeriod,expectedVolume")
    .is("evaluatedAt", null)
    .lt("targetPeriod", currentMonthString)
    .order("targetPeriod", { ascending: true });

  if (snapshotsError) throw snapshotsError;
  if (!snapshots?.length) {
    return { recordsEvaluated: 0, records: [] };
  }

  const targetPeriods = [
    ...new Set(snapshots.map((snapshot) => snapshot.targetPeriod)),
  ];
  const { data: actualRows, error: actualRowsError } = await supabase
    .from("ForecastingMonthlyData")
    .select("periodStart,actualVolume")
    .in("periodStart", targetPeriods)
    .not("actualVolume", "is", null);

  if (actualRowsError) throw actualRowsError;

  const actualByPeriod = new Map(
    (actualRows ?? []).map((row) => [
      row.periodStart,
      Number(row.actualVolume),
    ]),
  );
  const evaluatedAt = new Date().toISOString();

  const evaluatedRecords = await Promise.all(
    snapshots.map(async (snapshot) => {
      const actualVolume = actualByPeriod.get(snapshot.targetPeriod);
      if (actualVolume === undefined) return null;

      const expectedVolume = Number(snapshot.expectedVolume);
      const variance = actualVolume - expectedVolume;
      const variancePercentage =
        expectedVolume === 0
          ? null
          : Number(((variance / expectedVolume) * 100).toFixed(1));
      const absoluteError = Math.abs(variance);

      const { data, error } = await supabase
        .from("ForecastSnapshot")
        .update({
          actualVolume,
          variance,
          variancePercentage,
          absoluteError,
          evaluatedAt,
        })
        .eq("forecastSnapshotID", snapshot.forecastSnapshotID)
        .is("evaluatedAt", null)
        .select("*")
        .maybeSingle();

      if (error) throw error;
      return data;
    }),
  );

  const savedRecords = evaluatedRecords.filter(
    (record): record is NonNullable<typeof record> => record !== null,
  );

  return {
    recordsEvaluated: savedRecords.length,
    records: savedRecords,
  };
}

export async function getForecastSnapshotAccuracy() {
  const { data, error } = await supabase
    .from("ForecastSnapshot")
    .select("expectedVolume,actualVolume,absoluteError")
    .not("evaluatedAt", "is", null)
    .not("actualVolume", "is", null);

  if (error) throw error;
  if (!data?.length) {
    return { evaluatedSnapshots: 0, mae: null, rmse: null, rSquared: null };
  }

  const actualValues = data.map((row) => Number(row.actualVolume));
  const errors = data.map(
    (row) => Number(row.actualVolume) - Number(row.expectedVolume),
  );
  const mae =
    data.reduce((sum, row) => sum + Number(row.absoluteError), 0) /
    data.length;
  const rmse = Math.sqrt(
    errors.reduce((sum, errorValue) => sum + errorValue ** 2, 0) /
      errors.length,
  );
  const actualMean =
    actualValues.reduce((sum, value) => sum + value, 0) /
    actualValues.length;
  const residualSum = errors.reduce(
    (sum, errorValue) => sum + errorValue ** 2,
    0,
  );
  const totalSum = actualValues.reduce(
    (sum, value) => sum + (value - actualMean) ** 2,
    0,
  );

  return {
    evaluatedSnapshots: data.length,
    mae: Number(mae.toFixed(2)),
    rmse: Number(rmse.toFixed(2)),
    rSquared:
      data.length < 2 || totalSum === 0
        ? null
        : Number((1 - residualSum / totalSum).toFixed(4)),
  };
}
