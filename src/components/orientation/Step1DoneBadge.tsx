import { CheckCircle } from "lucide-react";

export function Step1DoneBadge() {
  return (
    <div className="mt-6 flex justify-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2">
        <CheckCircle className="h-5 w-5 text-green-500" aria-hidden="true" />
        <span className="text-sm font-semibold text-green-400">Done</span>
      </div>
    </div>
  );
}
