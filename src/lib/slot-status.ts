import type { Database } from "@/integrations/supabase/types";

export type Booking = Database["public"]["Tables"]["bookings"]["Row"];
export type Slot = Database["public"]["Tables"]["parking_slots"]["Row"];

export type SlotStatus = "available" | "occupied" | "reserved" | "inactive";

export function computeSlotStatus(slot: Slot, bookings: Booking[], now = new Date()): SlotStatus {
  if (!slot.is_active) return "inactive";
  const active = bookings.filter((b) => b.slot_id === slot.id && b.status === "active");
  const nowMs = now.getTime();
  for (const b of active) {
    const start = new Date(b.start_time).getTime();
    const end = new Date(b.end_time).getTime();
    if (start <= nowMs && end > nowMs) return "occupied";
  }
  const upcoming = active.some((b) => new Date(b.start_time).getTime() > nowMs);
  return upcoming ? "reserved" : "available";
}

export const STATUS_LABEL: Record<SlotStatus, string> = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  inactive: "Inactive",
};