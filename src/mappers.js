const toStr = value => (value == null ? "" : String(value).trim());

export function mapDriver(row) {
  const id = toStr(row["Driver ID"]);
  if (!id) return null;
  return {
    __id: id,
    name: toStr(row["Driver Name"]),
    idShift: toStr(row["IDShift"]),
    timeHolidayDate: row["TimeHolidayDate"] ?? null,
  };
}

export function mapPickup(row) {
  const id = toStr(row["Pickup Point ID"]);
  if (!id) return null;
  return {
    __id: id,
    groupName: toStr(row["Group Name"]),
    pickupPointName: toStr(row["Pickup Point Name"]),
    textAddress: toStr(row["Text Address"]),
  };
}

export function mapAssignment(row) {
  const driverId = toStr(row["Driver ID"]);
  const pickupId = toStr(row["Pickup Point ID"]);
  if (!driverId || !pickupId) return null;
  return {
    __id: `${driverId}__${pickupId}`,
    driverId,
    pickupPointId: pickupId,
  };
}

export { toStr };
