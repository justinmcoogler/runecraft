import { describe, expect, it } from "vitest";
import { Inventory, transferSlot } from "../inventory";

describe("Inventory", () => {
  it("stacks up to maxStack then overflows into a new slot", () => {
    const inv = new Inventory(3);
    expect(inv.add("item.log.basic", 60)).toBe(60); // maxStack 50
    expect(inv.slots[0]).toEqual({ itemId: "item.log.basic", qty: 50 });
    expect(inv.slots[1]).toEqual({ itemId: "item.log.basic", qty: 10 });
  });

  it("detects a full inventory precisely", () => {
    const inv = new Inventory(1);
    inv.add("item.log.basic", 50);
    expect(inv.canAdd("item.log.basic", 1)).toBe(false);
    expect(inv.isFullFor("item.log.basic")).toBe(true);
  });

  it("non-stackable items take one slot each", () => {
    const inv = new Inventory(2);
    expect(inv.add("tool.axe.basic", 2)).toBe(2);
    expect(inv.slots[0]?.qty).toBe(1);
    expect(inv.slots[1]?.qty).toBe(1);
  });

  it("transferSlot moves everything when it fits and conserves items", () => {
    const a = new Inventory(2);
    const b = new Inventory(2);
    a.add("item.log.basic", 30);
    const moved = transferSlot(a, 0, b);
    expect(moved).toBe(30);
    expect(a.count("item.log.basic")).toBe(0);
    expect(b.count("item.log.basic")).toBe(30);
  });

  it("transferSlot is partial-safe and never loses items when the target is nearly full", () => {
    const a = new Inventory(1);
    const b = new Inventory(1);
    a.add("item.log.basic", 30);
    b.add("item.log.basic", 45); // only 5 fit
    const before = a.count("item.log.basic") + b.count("item.log.basic");
    const moved = transferSlot(a, 0, b);
    expect(moved).toBe(5);
    expect(a.count("item.log.basic") + b.count("item.log.basic")).toBe(before);
    expect(b.count("item.log.basic")).toBe(50);
  });

  it("transferSlot is a no-op when nothing fits", () => {
    const a = new Inventory(1);
    const b = new Inventory(1);
    a.add("item.log.basic", 10);
    b.add("item.log.basic", 50);
    expect(transferSlot(a, 0, b)).toBe(0);
    expect(a.count("item.log.basic")).toBe(10);
    expect(b.count("item.log.basic")).toBe(50);
  });
});
