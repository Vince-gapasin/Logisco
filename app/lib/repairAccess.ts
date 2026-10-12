// Who may work on a truck under repair, and on a repair's logs - the rule the
// mechanic's screens show, kept here so the server applies it too. Before
// this the screens only hid the buttons: any mechanic could still change a
// truck, or edit or delete a log, on another mechanic's repair.
//
// A repair belongs to the mechanics on its newest log. A repair nobody is on
// yet - opened by the office or by a breakdown - is anyone's. The office is
// never locked out; that is for the caller to decide, by role.

export interface RepairLog {
  id: string;
  statusBefore?: string | null;
  statusAfter?: string | null;
  primaryMechanicID?: string | null;
  additionalMechanicID?: string | null;
}

const isGrounded = (status?: string | null) => status === "On Maintenance" || status === "Out of Service";

const isOn = (log: RepairLog, employeeID: string) =>
  !log.primaryMechanicID || log.primaryMechanicID === employeeID || log.additionalMechanicID === employeeID;

/**
 * Whether this mechanic may change the truck: its status, its details, or
 * retiring it. Only a truck still grounded by a repair in progress - its
 * newest log left it grounded - is held by anyone.
 *
 * @param newestLog the truck's newest maintenance log, if it has one
 */
export function mayWorkOnTruck(truckStatus: string | null | undefined, newestLog: RepairLog | null, employeeID: string) {
  if (!isGrounded(truckStatus) || !newestLog || !isGrounded(newestLog.statusAfter)) return true;
  return isOn(newestLog, employeeID);
}

/**
 * Whether this mechanic may edit or delete a log: it is decided by the newest
 * log of the repair it belongs to. A repair runs from the log that grounded
 * the truck to the one that put it back in service.
 *
 * @param truckLogs the truck's logs, oldest first
 */
export function mayWorkOnLog(truckLogs: RepairLog[], logID: string, employeeID: string) {
  const at = truckLogs.findIndex((log) => log.id === logID);
  if (at === -1) return false;

  let end = at;
  while (end < truckLogs.length - 1 && isGrounded(truckLogs[end].statusAfter)) end++;

  return isOn(truckLogs[end], employeeID);
}
