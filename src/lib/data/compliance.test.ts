import assert from "node:assert/strict";
import test from "node:test";
import { assertDataSourceCompliance } from "./compliance";

test("data-source compliance gate does not block development", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAck = process.env.DATA_SOURCE_COMPLIANCE_ACK;
  Object.assign(process.env, { NODE_ENV: "development" });
  delete process.env.DATA_SOURCE_COMPLIANCE_ACK;
  try {
    assert.doesNotThrow(() => assertDataSourceCompliance());
  } finally {
    if (previousNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Object.assign(process.env, { NODE_ENV: previousNodeEnv });
    if (previousAck === undefined) delete process.env.DATA_SOURCE_COMPLIANCE_ACK;
    else process.env.DATA_SOURCE_COMPLIANCE_ACK = previousAck;
  }
});
