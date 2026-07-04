import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, PowerOff, Power } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — ParkFlow" }] }),
  beforeLoad: async ({ context }) => {
    const user = (context as { user?: { id: string } }).user;
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!data) throw redirect({ to: "/" });
  },
  component: AdminPage,
});

function AdminPage() {
  const qc = useQueryClient();
  const slots = useQuery({
    queryKey: ["admin-slots"],
    queryFn: async () => {
      const { data, error } = await supabase.from("parking_slots").select("*").order("code");
      if (error) throw error;
      return data;
    },
  });
  const bookings = useQuery({
    queryKey: ["admin-recent-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, parking_slots(code)")
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data;
    },
  });

  const [code, setCode] = useState("");
  const [zone, setZone] = useState("A");
  const [slotType, setSlotType] = useState("standard");
  const [rate, setRate] = useState("2.00");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("parking_slots").insert({
        code: code.trim(),
        zone: zone.trim() || "A",
        slot_type: slotType,
        hourly_rate: Number(rate) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Slot added");
      setCode("");
      qc.invalidateQueries({ queryKey: ["admin-slots"] });
      qc.invalidateQueries({ queryKey: ["parking_slots"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("parking_slots").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-slots"] });
      qc.invalidateQueries({ queryKey: ["parking_slots"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("parking_slots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Slot removed");
      qc.invalidateQueries({ queryKey: ["admin-slots"] });
      qc.invalidateQueries({ queryKey: ["parking_slots"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Admin panel</h1>
          <p className="text-muted-foreground">Manage parking slots and view recent bookings.</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Add slot</CardTitle></CardHeader>
          <CardContent>
            <form
              className="grid grid-cols-1 gap-3 md:grid-cols-5"
              onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
            >
              <div className="space-y-1"><Label>Code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="D-01" required /></div>
              <div className="space-y-1"><Label>Zone</Label><Input value={zone} onChange={(e) => setZone(e.target.value)} /></div>
              <div className="space-y-1"><Label>Type</Label><Input value={slotType} onChange={(e) => setSlotType(e.target.value)} /></div>
              <div className="space-y-1"><Label>Rate/hr</Label><Input type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
              <div className="flex items-end"><Button type="submit" className="w-full" disabled={create.isPending}>Add</Button></div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>All slots ({slots.data?.length ?? 0})</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead><TableHead>Zone</TableHead><TableHead>Type</TableHead>
                  <TableHead>Rate</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slots.data?.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono font-semibold">{s.code}</TableCell>
                    <TableCell>{s.zone}</TableCell>
                    <TableCell>{s.slot_type}</TableCell>
                    <TableCell>${Number(s.hourly_rate).toFixed(2)}</TableCell>
                    <TableCell>{s.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => toggle.mutate({ id: s.id, is_active: !s.is_active })}>
                          {s.is_active ? <><PowerOff className="mr-1 h-4 w-4" />Disable</> : <><Power className="mr-1 h-4 w-4" />Enable</>}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => confirm(`Delete slot ${s.code}?`) && remove.mutate(s.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent bookings</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slot</TableHead><TableHead>User</TableHead><TableHead>Start</TableHead>
                  <TableHead>End</TableHead><TableHead>Plate</TableHead><TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.data?.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono">{b.parking_slots?.code ?? "—"}</TableCell>
                    <TableCell className="max-w-[160px] truncate font-mono text-xs">{b.user_id.slice(0, 8)}…</TableCell>
                    <TableCell>{new Date(b.start_time).toLocaleString()}</TableCell>
                    <TableCell>{new Date(b.end_time).toLocaleString()}</TableCell>
                    <TableCell>{b.vehicle_plate ?? "—"}</TableCell>
                    <TableCell><Badge variant={b.status === "active" ? "default" : "secondary"}>{b.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}