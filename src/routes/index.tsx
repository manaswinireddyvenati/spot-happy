import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Car, CircleCheck, CircleDot, Clock, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/navbar";
import { BookingDialog } from "@/components/booking-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { computeSlotStatus, STATUS_LABEL, type Slot, type SlotStatus } from "@/lib/slot-status";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ParkFlow — Live parking availability" },
      { name: "description", content: "See real-time parking slot availability. Reserve a spot in seconds." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [zone, setZone] = useState<string>("all");
  const [tick, setTick] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // re-render every minute so live status stays fresh
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const slotsQuery = useQuery({
    queryKey: ["parking_slots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parking_slots")
        .select("*")
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  const bookingsQuery = useQuery({
    queryKey: ["bookings", "active"],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const in24h = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("status", "active")
        .lte("start_time", in24h)
        .gte("end_time", nowIso);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });

  // Realtime — invalidate on any booking or slot change
  useEffect(() => {
    const channel = supabase
      .channel("parking-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        qc.invalidateQueries({ queryKey: ["bookings"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "parking_slots" }, () => {
        qc.invalidateQueries({ queryKey: ["parking_slots"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const slots = slotsQuery.data ?? [];
  const bookings = bookingsQuery.data ?? [];
  const zones = useMemo(() => Array.from(new Set(slots.map((s) => s.zone))).sort(), [slots]);
  const filtered = zone === "all" ? slots : slots.filter((s) => s.zone === zone);

  const statusMap = useMemo(() => {
    const now = new Date();
    const m = new Map<string, SlotStatus>();
    for (const s of slots) m.set(s.id, computeSlotStatus(s, bookings, now));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, bookings, tick]);

  const counts = useMemo(() => {
    const c = { available: 0, occupied: 0, reserved: 0, inactive: 0 };
    for (const s of filtered) c[statusMap.get(s.id) ?? "available"]++;
    return c;
  }, [filtered, statusMap]);

  function handleSlotClick(slot: Slot) {
    const status = statusMap.get(slot.id) ?? "available";
    if (status === "inactive") return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    setSelectedSlot(slot);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-10">
        <section className="mb-8">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Live parking availability
              </h1>
              <p className="mt-2 max-w-xl text-muted-foreground">
                Green means the slot is free right now. Tap any open slot to reserve it in seconds.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <StatBadge tone="available" count={counts.available} label="Available" />
              <StatBadge tone="reserved" count={counts.reserved} label="Reserved" />
              <StatBadge tone="occupied" count={counts.occupied} label="Occupied" />
            </div>
          </div>
        </section>

        <div className="mb-6 flex items-center justify-between">
          <Tabs value={zone} onValueChange={setZone}>
            <TabsList>
              <TabsTrigger value="all">All zones</TabsTrigger>
              {zones.map((z) => (
                <TabsTrigger key={z} value={z}>Zone {z}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Legend />
        </div>

        {slotsQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {filtered.map((slot) => {
              const status = statusMap.get(slot.id) ?? "available";
              return <SlotCard key={slot.id} slot={slot} status={status} onClick={() => handleSlotClick(slot)} />;
            })}
          </div>
        )}
      </main>

      {selectedSlot && (
        <BookingDialog
          slot={selectedSlot}
          open={!!selectedSlot}
          onOpenChange={(o) => !o && setSelectedSlot(null)}
        />
      )}
    </div>
  );
}

function StatBadge({ tone, count, label }: { tone: SlotStatus; count: number; label: string }) {
  const bg =
    tone === "available" ? "bg-slot-available/15 text-slot-available"
    : tone === "reserved" ? "bg-slot-reserved/20 text-slot-reserved"
    : tone === "occupied" ? "bg-slot-occupied/15 text-slot-occupied"
    : "bg-muted text-muted-foreground";
  return (
    <div className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 font-medium", bg)}>
      <CircleDot className="h-3.5 w-3.5" />
      <span>{count}</span>
      <span className="text-muted-foreground/80">{label}</span>
    </div>
  );
}

function Legend() {
  return (
    <div className="hidden gap-3 text-xs text-muted-foreground md:flex">
      <LegendDot color="bg-slot-available" label="Available" />
      <LegendDot color="bg-slot-reserved" label="Reserved" />
      <LegendDot color="bg-slot-occupied" label="Occupied" />
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", color)} />
      <span>{label}</span>
    </div>
  );
}

function SlotCard({ slot, status, onClick }: { slot: Slot; status: SlotStatus; onClick: () => void }) {
  const styles: Record<SlotStatus, string> = {
    available: "border-slot-available/40 bg-slot-available/10 hover:bg-slot-available/20 hover:border-slot-available",
    reserved: "border-slot-reserved/50 bg-slot-reserved/15 hover:bg-slot-reserved/25",
    occupied: "border-slot-occupied/40 bg-slot-occupied/10 opacity-90",
    inactive: "border-border bg-muted/40 opacity-60",
  };
  const disabled = status === "inactive";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative flex h-28 flex-col items-start justify-between rounded-xl border-2 p-3 text-left transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        styles[status],
        disabled ? "cursor-not-allowed" : "cursor-pointer active:scale-[0.98]",
      )}
    >
      <div className="flex w-full items-start justify-between">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <Car className="h-4 w-4" />
          {slot.code}
        </div>
        <Badge variant="outline" className="border-current/30 text-[10px] uppercase tracking-wide">
          {slot.slot_type}
        </Badge>
      </div>
      <div className="flex w-full items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <MapPin className="h-3 w-3" /> Zone {slot.zone}
        </span>
        <span className="font-medium">${Number(slot.hourly_rate).toFixed(2)}/hr</span>
      </div>
      <span className="absolute right-2 top-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider opacity-80">
        {status === "available" && <CircleCheck className="h-3 w-3" />}
        {status === "reserved" && <Clock className="h-3 w-3" />}
        {STATUS_LABEL[status]}
      </span>
    </button>
  );
}