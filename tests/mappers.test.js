import test from "node:test";
import assert from "node:assert/strict";

import { getEnvOrThrow, MissingEnvVarError } from "../src/env.js";
import { mapAssignment, mapDriver, mapPickup, toStr } from "../src/mappers.js";

test("toStr converts nullish to empty string", () => {
  assert.equal(toStr(null), "");
  assert.equal(toStr(undefined), "");
  assert.equal(toStr(" abc "), "abc");
});

test("mapDriver returns null when driver id missing", () => {
  const row = { "Driver Name": "Alice" };
  assert.equal(mapDriver(row), null);
});

test("mapDriver trims values and keeps nullable date", () => {
  const row = {
    "Driver ID": " 123 ",
    "Driver Name": " Alice ",
    IDShift: " M1 ",
    TimeHolidayDate: "2024-01-01",
  };
  assert.deepEqual(mapDriver(row), {
    __id: "123",
    name: "Alice",
    idShift: "M1",
    timeHolidayDate: "2024-01-01",
  });
});

test("mapPickup handles minimal fields", () => {
  const row = {
    "Pickup Point ID": 321,
    "Group Name": " Group ",
    "Pickup Point Name": " Point ",
    "Text Address": " Address ",
  };
  assert.deepEqual(mapPickup(row), {
    __id: "321",
    groupName: "Group",
    pickupPointName: "Point",
    textAddress: "Address",
  });
});

test("mapAssignment builds composite id", () => {
  const row = { "Driver ID": "D1", "Pickup Point ID": "P1" };
  assert.deepEqual(mapAssignment(row), {
    __id: "D1__P1",
    driverId: "D1",
    pickupPointId: "P1",
  });
});

test("mapAssignment returns null when any id missing", () => {
  assert.equal(mapAssignment({ "Pickup Point ID": "P1" }), null);
  assert.equal(mapAssignment({ "Driver ID": "D1" }), null);
});

test("getEnvOrThrow returns parsed value", () => {
  process.env.TEST_ENV = "42";
  const result = getEnvOrThrow("TEST_ENV", { parser: Number });
  assert.equal(result, 42);
  delete process.env.TEST_ENV;
});

test("getEnvOrThrow throws MissingEnvVarError", () => {
  const name = "TEST_MISSING";
  assert.throws(
    () => getEnvOrThrow(name),
    error => error instanceof MissingEnvVarError && error.envName === name
  );
});

test("getEnvOrThrow wraps parser errors", () => {
  process.env.TEST_INVALID = "abc";
  assert.throws(
    () => getEnvOrThrow("TEST_INVALID", { parser: value => {
      const parsed = Number(value);
      if (Number.isNaN(parsed)) throw new Error("not a number");
      return parsed;
    } }),
    /Invalid value for environment variable 'TEST_INVALID': not a number/
  );
  delete process.env.TEST_INVALID;
});
