import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — ParkFlow" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [plate, setPlate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setFullName(data.full_name ?? "");
        setPhone(data.phone ?? "");
        setPlate(data.vehicle_plate ?? "");
      }
    });
  }, [user]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: fullName,
      phone,
      vehicle_plate: plate.toUpperCase(),
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile saved");
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="mb-6 text-3xl font-semibold tracking-tight">Profile</h1>
        <Card>
          <CardHeader><CardTitle>Your details</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fn">Full name</Label>
                <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ph">Phone</Label>
                <Input id="ph" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pl">Vehicle plate</Label>
                <Input id="pl" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="ABC-1234" />
              </div>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}