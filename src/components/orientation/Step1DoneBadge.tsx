import { CheckCircle } from "lucide-react";

export function Step1DoneBadge() {
  return (
    <div className="mt-6 flex flex-1 items-center justify-center">
      <div className="inline-flex items-center gap-4 rounded-full border border-green-500/30 bg-green-500/10 px-8 py-4">
        <CheckCircle className="h-10 w-10 text-green-500" aria-hidden="true" />
        <span className="text-xl font-semibold text-green-400">Done</span>
      </div>
    </div>
  );
}
