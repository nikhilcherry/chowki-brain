import { describe, expect, it } from "vitest";
import { enforceByteLimit } from "../src/functions/compressForLora.js";
import type { TriagePacket } from "../src/types.js";

describe("enforceByteLimit", () => {
  it("leaves an already-small packet untouched", () => {
    const packet: TriagePacket = { k: "inj", u: "urg", p: 1, loc: "wtrfall+2km", b: "b2" };
    const { packet: result, bytes } = enforceByteLimit(packet);
    expect(result).toEqual(packet);
    expect(bytes).toBe(Buffer.byteLength(JSON.stringify(packet)));
    expect(bytes).toBeLessThanOrEqual(200);
  });

  it("hard-truncates an oversized loc field down to the byte limit", () => {
    const packet: TriagePacket = {
      k: "inj",
      u: "urg",
      p: 1,
      loc: "a".repeat(400),
      b: "b2"
    };
    const before = Buffer.byteLength(JSON.stringify(packet));
    expect(before).toBeGreaterThan(200);

    const { packet: result, bytes } = enforceByteLimit(packet, 200);
    expect(bytes).toBeLessThanOrEqual(200);
    expect(Buffer.byteLength(JSON.stringify(result))).toBe(bytes);
    expect(result.k).toBe("inj");
    expect(result.b).toBe("b2");
    expect(result.loc.length).toBeLessThan(packet.loc.length);
  });
});
