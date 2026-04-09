import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

const CallOut = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const today = format(new Date(), "yyyy-MM-dd");
  const todayDisplay = format(new Date(), "EEEE, MMMM d, yyyy");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !reason.trim()) return;
    setSubmitting(true);

    try {
      // Check if youth is a Bald Eagle
      const { data: matches } = await supabase
        .from("youth_registrations" as any)
        .select("is_bald_eagle")
        .ilike("child_first_name", firstName.trim())
        .ilike("child_last_name", lastName.trim())
        .eq("is_bald_eagle", true)
        .limit(1);

      const isBaldEagle = (matches as any[] | null)?.length ? true : false;

      await supabase.from("callouts" as any).insert({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        date: today,
        reason: reason.trim(),
        is_bald_eagle: isBaldEagle,
      } as any);

      setSubmitted(true);
    } catch {
      // Silent fail — form still shows confirmation for UX
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col bg-black">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-3">Call-Out Recorded</h2>
              <p className="text-lg font-semibold text-white mb-2">
                100% Attendance is not Required,
              </p>
              <p className="text-lg font-semibold text-white mb-6">
                100% Communication is Required!
              </p>
              <Button
                onClick={() => {
                  setSubmitted(false);
                  setFirstName("");
                  setLastName("");
                  setReason("");
                }}
                className="text-white font-bold"
                style={{ backgroundColor: "#bf0f3e" }}
              >
                Submit Another
              </Button>
            </div>
          </div>
        </main>
        <Footer className="bg-neutral-950 border-neutral-800" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 md:p-8">
            <h1 className="text-2xl md:text-3xl font-black text-white text-center mb-2">
              CALL-OUT FORM
            </h1>
            <p className="text-center text-white font-semibold mb-1">
              100% Attendance is not Required,
            </p>
            <p className="text-center text-white font-semibold mb-6">
              100% Communication is Required!
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-white text-sm">First Name *</Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    required
                    className="bg-neutral-800 border-neutral-700 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-white text-sm">Last Name *</Label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    required
                    className="bg-neutral-800 border-neutral-700 text-white mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-white text-sm">Today's Date</Label>
                <Input
                  value={todayDisplay}
                  readOnly
                  className="bg-neutral-800/50 border-neutral-700 text-neutral-400 mt-1 cursor-not-allowed"
                />
              </div>

              <div>
                <Label className="text-white text-sm">Reason for Missing Practice *</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why will you miss practice today?"
                  required
                  className="bg-neutral-800 border-neutral-700 text-white mt-1 min-h-[100px]"
                />
                <div className="mt-3 space-y-2 text-xs">
                  <p className="text-green-400 font-medium">
                    ✅ Acceptable: School event, doctor appointment, family emergency, illness, religious obligation
                  </p>
                  <p className="text-red-400 font-medium">
                    ❌ Unacceptable: "I don't feel like it", no reason given, repeated vague excuses
                  </p>
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting || !firstName.trim() || !lastName.trim() || !reason.trim()}
                className="w-full text-white font-bold text-lg py-6"
                style={{ backgroundColor: "#bf0f3e" }}
              >
                {submitting ? "Submitting..." : "SUBMIT CALL-OUT"}
              </Button>
            </form>
          </div>
        </div>
      </main>
      <Footer className="bg-neutral-950 border-neutral-800" />
    </div>
  );
};

export default CallOut;
