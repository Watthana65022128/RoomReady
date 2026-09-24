import { test } from "node:test";
import assert from "node:assert/strict";
import { groupRoomsByFloor } from "../src/lib/room-floors.ts";

test("rooms are grouped from highest floor to lowest and sorted within floors", () => {
  const rooms = [
    { floor: "2", name: "202" },
    { floor: "10", name: "1002" },
    { floor: "2", name: "201" },
    { floor: "", name: "A" },
    { floor: "1", name: "101" },
    { floor: "10", name: "1001" },
  ];
  const groups = groupRoomsByFloor(rooms);
  assert.deepEqual(groups.map(({ floor }) => floor), ["10", "2", "1", ""]);
  assert.deepEqual(groups[0].rooms.map(({ name }) => name), ["1001", "1002"]);
  assert.deepEqual(groups[1].rooms.map(({ name }) => name), ["201", "202"]);
  assert.equal(rooms[0].name, "202");
});

test("unnumbered floors follow numbered floors", () => {
  const groups = groupRoomsByFloor([
    { floor: "G", name: "G01" },
    { floor: " 3 ", name: "301" },
    { floor: "", name: "A" },
  ]);
  assert.deepEqual(groups.map(({ floor }) => floor), ["3", "G", ""]);
});
