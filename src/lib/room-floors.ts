const roomCollator = new Intl.Collator("th", { numeric: true });

export function groupRoomsByFloor<T extends { floor: string; name: string }>(
  rooms: T[],
) {
  const floors = new Map<string, T[]>();
  for (const room of rooms) {
    const floor = room.floor.trim();
    const group = floors.get(floor) ?? [];
    group.push(room);
    floors.set(floor, group);
  }

  return [...floors]
    .sort(([a], [b]) => {
      if (!a) return 1;
      if (!b) return -1;
      const aNumber = Number(a);
      const bNumber = Number(b);
      const aIsNumber = Number.isFinite(aNumber);
      const bIsNumber = Number.isFinite(bNumber);
      if (aIsNumber && bIsNumber) {
        return bNumber - aNumber;
      }
      if (aIsNumber !== bIsNumber) return aIsNumber ? -1 : 1;
      return roomCollator.compare(b, a);
    })
    .map(([floor, group]) => ({
      floor,
      rooms: group.sort((a, b) => roomCollator.compare(a.name, b.name)),
    }));
}
