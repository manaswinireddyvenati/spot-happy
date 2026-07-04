import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Car, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Slot } from "@/lib/slot-status";

const DURATIONS = [
  { value: "1", label: "1 hour" },
  { value: "2", label: "2 hours" },
  { value: "4", label: "4 hours" },
  { value: "8", label: "8 hours" },
];

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BookingDialog({
  slot,
  open,
  onOpenChange,
}: {
  slot: Slot;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [startAt, setStartAt] = useState(toLocalInputValue(new Date(Date.now() + 5 * 60_000)));
  const [hours, setHours] = useState("2");
  const [plate, setPlate] = useState("");

  const startDate = new Date(startAt);
  const endDate = new Date(startDate.getTime() + Number(hours) * 3600_000);
  const cost = (Number(hours) * Number(slot.hourly_rate)).toFixed(2);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("bookings").insert({
        slot_id: slot.id,
        user_id: user.id,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        vehicle_plate: plate.trim().toUpperCase() || null,
        status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Slot ${slot.code} reserved`, {
        description: `${startDate.toLocaleString()} → ${endDate.toLocaleTimeString()}`,
      });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast.error("Booking failed", { description: e.message });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" /> Reserve slot {slot.code}
          </DialogTitle>
          <DialogDescription>
            Zone {slot.zone} · {slot.slot_type} · ${Number(slot.hourly_rate).toFixed(2)}/hr
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (endDate <= startDate) {
              toast.error("End time must be after start time");
              return;
            }
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="start">Start time</Label>
            <Input
              id="start"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Duration</Label>
            <RadioGroup value={hours} onValueChange={setHours} className="grid grid-cols-4 gap-2">
              {DURATIONS.map((d) => (
                <Label
                  key={d.value}
                  htmlFor={`dur-${d.value}`}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/10"
                >
                  <RadioGroupItem id={`dur-${d.value}`} value={d.value} className="sr-only" />
                  {d.label}
                </Label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="plate">Vehicle plate (optional)</Label>
            <Input
              id="plate"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="ABC-1234"
              maxLength={20}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted/60 px-4 py-3 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Ends {endDate.toLocaleString()}</span>
            </div>
            <Badge variant="secondary" className="text-base">${cost}</Badge>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Reserving…" : "Confirm reservation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}