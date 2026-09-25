// Generated from the live database. Do not edit by hand.
//
// npx tsx --env-file=.env scripts/generateDatabaseTypes.ts
//
// One interface per table, describing a row as a select returns it. A
// column is optional here when the database gives it a default or allows
// null, so reading one means handling the absence - which is the honest
// shape for anything that came out of a join.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface AuditTrailRow {
  /** This is a Primary Key.<pk/> */
  auditID: string;
  tableName: string;
  recordID: string;
  action: string;
  oldData: Json | null;
  newData: Json | null;
  changedBy: string | null;
  timestamp: string | null;
}

export interface BranchRow {
  /** This is a Primary Key.<pk/> */
  branchID: string;
  /** This is a Foreign Key to `Client.clientID`.<fk table='Client' column='clientID'/> */
  clientID: string;
  branchName: string;
  deliveryAddress: string;
  contactPerson: string;
  contactNumber: string;
}

export interface BranchStopsRow {
  /** This is a Primary Key.<pk/> */
  branchID: number;
  /** This is a Foreign Key to `Order.orderID`.<fk table='Order' column='orderID'/> */
  orderID: string | null;
  branchName: string;
  contactPerson: string | null;
  contactNum: string | null;
  notes: string | null;
  deliveryLat: number;
  deliverLong: number;
  expectedTime: string;
  stopStatus: string;
  /** This is a Foreign Key to `DispatchOrder.dispatchID`.<fk table='DispatchOrder' column='dispatchID'/> */
  dispatchID: string | null;
  deliveryAddress: string | null;
  sequence: number | null;
  arrivedAt: string | null;
  completedAt: string | null;
  quantity: number | null;
}

export interface ClientRow {
  /** This is a Primary Key.<pk/> */
  clientID: string;
  clientCode: string | null;
  company: string;
  contractType: string;
  status: string;
  contactName: string;
  contact: string;
  businessAdd: string | null;
  emailAdd: string | null;
  contractStart: string;
  contractEnd: string;
  auth_id: string | null;
  isActive: boolean | null;
}

export interface DeliveryTrackingRow {
  /** This is a Primary Key.<pk/> */
  trackingID: string;
  /** This is a Foreign Key to `DispatchOrder.dispatchID`.<fk table='DispatchOrder' column='dispatchID'/> */
  dispatchID: string | null;
  pickupTime: string;
  dropOffTime: string | null;
  isEmergency: boolean | null;
  currentLat: number;
  currentLong: number;
  remarks: string | null;
  timestamp: string | null;
}

export interface DeviceTokenRow {
  /** This is a Primary Key.<pk/> */
  tokenID: string;
  /** This is a Foreign Key to `Employee.employeeID`.<fk table='Employee' column='employeeID'/> */
  employeeID: string;
  token: string;
  platform: string;
  createdAt: string;
  lastSeenAt: string;
  failedAt: string | null;
}

export interface DispatchHelperRow {
  /** This is a Primary Key.<pk/> */
  dhID: string;
  /** This is a Foreign Key to `Employee.employeeID`.<fk table='Employee' column='employeeID'/> */
  helperID: string | null;
  /** This is a Foreign Key to `DispatchOrder.dispatchID`.<fk table='DispatchOrder' column='dispatchID'/> */
  dispatchID: string | null;
  status: string | null;
  declinereason: string | null;
}

export interface DispatchInterventionLogRow {
  /** This is a Primary Key.<pk/> */
  logID: string;
  /** This is a Foreign Key to `DispatchOrder.dispatchID`.<fk table='DispatchOrder' column='dispatchID'/> */
  dispatchID: string | null;
  /** This is a Foreign Key to `Employee.employeeID`.<fk table='Employee' column='employeeID'/> */
  actionTakenBy: string | null;
  interventionType: string;
  reason: string;
  recoveryRemarks: string | null;
  timeStamp: string | null;
}

export interface DispatchOrderRow {
  /** This is a Primary Key.<pk/> */
  dispatchID: string;
  /** This is a Foreign Key to `Order.orderID`.<fk table='Order' column='orderID'/> */
  orderID: string | null;
  /** This is a Foreign Key to `Employee.employeeID`.<fk table='Employee' column='employeeID'/> */
  driverID: string | null;
  /** This is a Foreign Key to `Truck.truckID`.<fk table='Truck' column='truckID'/> */
  truckID: string | null;
  /** This is a Foreign Key to `Employee.employeeID`.<fk table='Employee' column='employeeID'/> */
  coorID: string | null;
  dispatchCode: string | null;
  dispatchNote: string | null;
  status: string;
  rejectionreason: string | null;
  pod_url: string | null;
  completedAt: string | null;
  current_step: number | null;
  pickupCompletedAt: string | null;
  /** This is a Foreign Key to `SubContractor.subConID`.<fk table='SubContractor' column='subConID'/> */
  subConID: string | null;
  partnerDriver: string | null;
  partnerPlate: string | null;
  partnerContact: string | null;
}

export interface EmployeeRow {
  /** This is a Primary Key.<pk/> */
  employeeID: string;
  employeeCode: string | null;
  employeeName: string;
  role: string;
  /** What an admin set: Available, On Leave or Unavailable. Booked and In Transit are calculated from live dispatches, never stored. */
  availability: string;
  healthStatus: string;
  address: string;
  contact: string;
  auth_id: string | null;
  isActive: boolean | null;
  birthdate: string | null;
  middleName: string | null;
  suffix: string | null;
  gender: string | null;
  emailAddress: string | null;
  bloodType: string | null;
  nationality: string | null;
  religion: string | null;
  dateEmployed: string | null;
  driverLicenseType: string | null;
  licenseNumber: string | null;
  licenseExpirationDate: string | null;
  drivingExperience: number | null;
  drugTestStatus: string | null;
  lastMedicalCheckup: string | null;
  emergencyContactPerson: string | null;
  emergencyContactNumber: string | null;
  relationship: string | null;
  skills: string | null;
  remarks: string | null;
  activation_sent_at: string | null;
  activation_completed_at: string | null;
}

export interface FleetLocationHistoryRow {
  /** This is a Primary Key.<pk/> */
  historyID: string;
  /** This is a Foreign Key to `DispatchOrder.dispatchID`.<fk table='DispatchOrder' column='dispatchID'/> */
  dispatch_id: string;
  /** This is a Foreign Key to `Employee.employeeID`.<fk table='Employee' column='employeeID'/> */
  driver_id: string | null;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  recorded_at: string;
}

export interface FleetLocationsRow {
  /** This is a Primary Key.<pk/> */
  dispatch_id: string;
  driver_id: string | null;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  updated_at: string | null;
}

export interface ForecastSnapshotRow {
  /** This is a Primary Key.<pk/> */
  forecastSnapshotID: string;
  snapshotMonth: string;
  targetPeriod: string;
  expectedVolume: number;
  model: string;
  trainingMonths: number;
  validationMAE: number | null;
  validationRMSE: number | null;
  validationRSquared: number | null;
  generatedAt: string;
  createdAt: string;
  actualVolume: number | null;
  variance: number | null;
  variancePercentage: number | null;
  absoluteError: number | null;
  evaluatedAt: string | null;
}

export interface ForecastingMonthlyDataRow {
  periodStart: string | null;
  actualVolume: number | null;
  averageTemperature: number | null;
  totalRainfall: number | null;
  rainyDays: number | null;
  averageWindSpeed: number | null;
  averageDieselPrice: number | null;
  averageFuelAdjustment: number | null;
}

export interface FoulTripIncidentRow {
  /** This is a Primary Key.<pk/> */
  incidentID: string;
  /** This is a Foreign Key to `DispatchOrder.dispatchID`.<fk table='DispatchOrder' column='dispatchID'/> */
  dispatchID: string;
  /** This is a Foreign Key to `Order.orderID`.<fk table='Order' column='orderID'/> */
  orderID: string;
  /** This is a Foreign Key to `Truck.truckID`.<fk table='Truck' column='truckID'/> */
  truckID: string | null;
  /** This is a Foreign Key to `Employee.employeeID`.<fk table='Employee' column='employeeID'/> */
  reportedBy: string | null;
  reportedAt: string;
  issueType: string;
  details: string | null;
  photoPath: string | null;
  latitude: number | null;
  longitude: number | null;
  dispatchStatusBefore: string | null;
  cargoLoaded: boolean;
  status: string;
  severity: string | null;
  /** This is a Foreign Key to `Employee.employeeID`.<fk table='Employee' column='employeeID'/> */
  mechanicID: string | null;
  mechanicAssignedAt: string | null;
  mechanicOutcome: string | null;
  mechanicNotes: string | null;
  mechanicRespondedAt: string | null;
  resolution: string | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  /** This is a Foreign Key to `Employee.employeeID`.<fk table='Employee' column='employeeID'/> */
  resolvedBy: string | null;
  /** This is a Foreign Key to `DispatchOrder.dispatchID`.<fk table='DispatchOrder' column='dispatchID'/> */
  newDispatchID: string | null;
  /** True when the trip could not continue (a foul trip). False for an issue reported while the delivery carried on. */
  blocking: boolean;
}

export interface FuelPriceHistoryRow {
  /** This is a Primary Key.<pk/> */
  fuelPriceID: string;
  effectiveDate: string;
  fuelType: string;
  region: string;
  pricePerLiter: number | null;
  source: string;
  sourceUrl: string | null;
  retrievedAt: string;
  weeklyAdjustment: number | null;
}

export interface HistoryLogsMRow {
  /** This is a Primary Key.<pk/> */
  id: string;
  /** This is a Foreign Key to `Truck.truckID`.<fk table='Truck' column='truckID'/> */
  truckID: string | null;
  date: string;
  created_at: string | null;
  statusBefore: string | null;
  statusAfter: string | null;
}

export interface LogMechanicsRow {
  /** This is a Primary Key.<pk/> */
  id: string;
  /** This is a Foreign Key to `HistoryLogsM.id`.<fk table='HistoryLogsM' column='id'/> */
  logID: string | null;
  /** This is a Foreign Key to `Employee.employeeID`.<fk table='Employee' column='employeeID'/> */
  employeeID: string | null;
  role: string;
}

export interface LogNotesRow {
  /** This is a Primary Key.<pk/> */
  id: string;
  /** This is a Foreign Key to `HistoryLogsM.id`.<fk table='HistoryLogsM' column='id'/> */
  logID: string | null;
  phase: string;
  issue: string | null;
  remarks: string | null;
  created_at: string | null;
}

export interface LogPhotosRow {
  /** This is a Primary Key.<pk/> */
  id: string;
  /** This is a Foreign Key to `HistoryLogsM.id`.<fk table='HistoryLogsM' column='id'/> */
  logID: string | null;
  phase: string;
  photoUrl: string;
  created_at: string | null;
}

export interface MaintenanceRow {
  /** This is a Primary Key.<pk/> */
  maintenanceID: string;
  /** This is a Foreign Key to `Truck.truckID`.<fk table='Truck' column='truckID'/> */
  truckID: string | null;
  /** This is a Foreign Key to `Employee.employeeID`.<fk table='Employee' column='employeeID'/> */
  mechID: string | null;
  remark: string | null;
  maintenanceDate: string | null;
}

export interface NotificationRow {
  /** This is a Primary Key.<pk/> */
  notificationID: string;
  event: string;
  title: string;
  body: string;
  severity: string;
  entityTable: string | null;
  entityID: string | null;
  link: string | null;
  /** This is a Foreign Key to `Employee.employeeID`.<fk table='Employee' column='employeeID'/> */
  actorID: string | null;
  actorName: string | null;
  dedupeKey: string | null;
  createdAt: string;
}

export interface NotificationRecipientRow {
  /** This is a Primary Key.<pk/> */
  recipientID: string;
  /** This is a Foreign Key to `Notification.notificationID`.<fk table='Notification' column='notificationID'/> */
  notificationID: string;
  /** This is a Foreign Key to `Employee.employeeID`.<fk table='Employee' column='employeeID'/> */
  employeeID: string;
  readAt: string | null;
}

export interface OperationalForecastRow {
  /** This is a Primary Key.<pk/> */
  forecastID: string;
  /** This is a Foreign Key to `Employee.employeeID`.<fk table='Employee' column='employeeID'/> */
  encodedBy: string | null;
  forecastPeriod: string;
  baselineVolume: number | null;
  actualVolume: number;
  reasonCategory: string;
  reasonDetails: string | null;
}

export interface OrderRow {
  /** This is a Primary Key.<pk/> */
  orderID: string;
  /** This is a Foreign Key to `Client.clientID`.<fk table='Client' column='clientID'/> */
  clientID: string | null;
  orderCode: string | null;
  orderLinkToken: string;
  notes: string | null;
  createdAt: string | null;
  isActive: boolean | null;
}

export interface OrderDetailsRow {
  /** This is a Primary Key.<pk/> */
  itemID: string;
  /** This is a Foreign Key to `Order.orderID`.<fk table='Order' column='orderID'/> */
  orderID: string | null;
  productName: string;
  productType: string | null;
  quantity: number;
  weightPerItem: number;
}

export interface PODRow {
  /** This is a Primary Key.<pk/> */
  podID: string;
  /** This is a Foreign Key to `BranchStops.branchID`.<fk table='BranchStops' column='branchID'/> */
  branchID: number | null;
  proof: string | null;
  receiverName: string;
  remarks: string | null;
  /** This is a Foreign Key to `DispatchOrder.dispatchID`.<fk table='DispatchOrder' column='dispatchID'/> */
  dispatchID: string | null;
  deliveredAt: string | null;
  /** This is a Foreign Key to `Employee.employeeID`.<fk table='Employee' column='employeeID'/> */
  recordedBy: string | null;
  source: string;
  missingReason: string | null;
  fileType: string | null;
}

export interface PickupStopsRow {
  /** This is a Primary Key.<pk/> */
  pickupID: number;
  /** This is a Foreign Key to `Order.orderID`.<fk table='Order' column='orderID'/> */
  orderID: string;
  /** This is a Foreign Key to `DispatchOrder.dispatchID`.<fk table='DispatchOrder' column='dispatchID'/> */
  dispatchID: string | null;
  /** This is a Foreign Key to `Warehouse.warehouseID`.<fk table='Warehouse' column='warehouseID'/> */
  warehouseID: string | null;
  warehouseName: string;
  pickupAddress: string | null;
  contactPerson: string | null;
  contactNum: string | null;
  expectedTime: string | null;
  pickupLat: number | null;
  pickupLong: number | null;
  sequence: number;
  stopStatus: string;
  arrivedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  quantity: number | null;
}

export interface ReportsRow {
  /** This is a Primary Key.<pk/> */
  reportID: string;
  /** This is a Foreign Key to `DispatchOrder.dispatchID`.<fk table='DispatchOrder' column='dispatchID'/> */
  dispatchID: string | null;
  status: string;
  finalRemarks: string | null;
  generatedAt: string | null;
}

export interface SubContractorRow {
  /** This is a Primary Key.<pk/> */
  subConID: string;
  companyName: string;
  contactName: string;
  contactNumber: string;
  contractType: string | null;
  emailAddress: string | null;
  businessAddress: string | null;
  isActive: boolean | null;
}

export interface TruckRow {
  /** This is a Primary Key.<pk/> */
  truckID: string;
  /** This is a Foreign Key to `SubContractor.subConID`.<fk table='SubContractor' column='subConID'/> */
  subconID: string | null;
  truckCode: string | null;
  plateNumber: string;
  model: string | null;
  capacity: number;
  truckType: string;
  truckStatus: string;
  lastChecked: string | null;
  isActive: boolean | null;
}

export interface WarehouseRow {
  /** This is a Primary Key.<pk/> */
  warehouseID: string;
  /** This is a Foreign Key to `Client.clientID`.<fk table='Client' column='clientID'/> */
  clientID: string | null;
  whName: string;
  warehouseLoc: string;
  contactPerson: string;
  contactNum: string;
}

export interface WeatherHistoryRow {
  /** This is a Primary Key.<pk/> */
  weatherID: string;
  recordDate: string;
  locationCode: string;
  latitude: number;
  longitude: number;
  temperatureC: number | null;
  rainfallMm: number | null;
  windSpeedKmh: number | null;
  weatherCode: number | null;
  source: string;
  retrievedAt: string;
}

export interface Database {
  AuditTrail: AuditTrailRow;
  Branch: BranchRow;
  BranchStops: BranchStopsRow;
  Client: ClientRow;
  DeliveryTracking: DeliveryTrackingRow;
  DeviceToken: DeviceTokenRow;
  DispatchHelper: DispatchHelperRow;
  DispatchInterventionLog: DispatchInterventionLogRow;
  DispatchOrder: DispatchOrderRow;
  Employee: EmployeeRow;
  FleetLocationHistory: FleetLocationHistoryRow;
  FleetLocations: FleetLocationsRow;
  ForecastSnapshot: ForecastSnapshotRow;
  ForecastingMonthlyData: ForecastingMonthlyDataRow;
  FoulTripIncident: FoulTripIncidentRow;
  FuelPriceHistory: FuelPriceHistoryRow;
  HistoryLogsM: HistoryLogsMRow;
  LogMechanics: LogMechanicsRow;
  LogNotes: LogNotesRow;
  LogPhotos: LogPhotosRow;
  Maintenance: MaintenanceRow;
  Notification: NotificationRow;
  NotificationRecipient: NotificationRecipientRow;
  OperationalForecast: OperationalForecastRow;
  Order: OrderRow;
  OrderDetails: OrderDetailsRow;
  POD: PODRow;
  PickupStops: PickupStopsRow;
  Reports: ReportsRow;
  SubContractor: SubContractorRow;
  Truck: TruckRow;
  Warehouse: WarehouseRow;
  WeatherHistory: WeatherHistoryRow;
}
