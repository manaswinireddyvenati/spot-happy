import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calendar, Car, Clock, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/bookings")({
  head: () => ({ meta: [{ title: "My bookings — ParkFlow" }] }),
  component: MyBookings,
});

function MyBookings() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-bookings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, parking_slots(code, zone, slot_type, hourly_rate)")
        .eq("user_id", user!.id)
        .order("start_time", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Booking cancelled");
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const now = Date.now();
  const rows = data ?? [];
  const upcoming = rows.filter((b) => b.status === "active" && new Date(b.end_time).getTime() > now);
  const past = rows.filter((b) => !(b.status === "active" && new Date(b.end_time).getTime() > now));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight">My bookings</h1>
        <p className="mb-8 text-muted-foreground">Manage upcoming reservations and review past ones.</p>

        <Section title="Upcoming & active" empty="No active reservations yet.">
          {isLoading ? (
            <SkeletonList />
          ) : upcoming.length === 0 ? null : (
            upcoming.map((b) => (
              <BookingRow key={b.id} booking={b} canCancel onCancel={() => cancel.mutate(b.id)} />
            ))
          )}
        </Section>

        <Section title="History" empty="No past bookings." className="mt-10">
          {past.map((b) => (
            <BookingRow key={b.id} booking={b} />
          ))}
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children, empty, className }: { title: string; children: React.ReactNode; empty: string; className?: string }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <section className={className}>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="space-y-3">
        {hasChildren ? children : <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">{empty}</p>}
      </div>
    </section>
  );
}

function SkeletonList() {
  return <>{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}</>;
}

type BookingWithSlot = {
  id: string;
  status: "active" | "cancelled" | "completed";
  start_time: string;
  end_time: string;
  vehicle_plate: string | null;
  parking_slots: { code: string; zone: string; slot_type: string; hourly_rate: number } | null;
};

function BookingRow({ booking, canCancel, onCancel }: { booking: BookingWithSlot; canCancel?: boolean; onCancel?: () => void }) {
  const start = new Date(booking.start_time);
  const end = new Date(booking.end_time);
  const hours = (end.getTime() - start.getTime()) / 3600_000;
  const rate = booking.parking_slots?.hourly_rate ?? 0;
  return (
    <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary/10 text-primary">
          <Car className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">Slot {booking.parking_slots?.code ?? "—"}</span>
            <Badge variant={booking.status === "active" ? "default" : booking.status === "cancelled" ? "destructive" : "secondary"}>
              {booking.status}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{start.toLocaleString()}</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{hours}h</span>
            {booking.vehicle_plate && <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{booking.vehicle_plate}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={cn("text-lg font-semibold", booking.status === "cancelled" && "line-through opacity-60")}>
          ${(hours * Number(rate)).toFixed(2)}
        </span>
        {canCancel && (
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X className="mr-1 h-4 w-4" /> Cancel
          </Button>
        )}
      </div>
    </Card>
  );
}