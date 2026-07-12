import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import nlaLogo from "@/assets/nla-logo.png";
import { FormRenderer } from "@/components/forms/FormRenderer";
import { type FormRecord } from "@/lib/formKit";

const PublicForm = () => {
  const { slug } = useParams<{ slug: string }>();

  const { data: form, isLoading, isError } = useQuery({
    queryKey: ["public-form", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms" as never)
        .select("*")
        .eq("slug", slug as string)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data as unknown as FormRecord | null;
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#bf0f3e]" />
      </div>
    );
  }

  if (isError || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100 px-4">
        <div className="text-center max-w-md">
          <img src={nlaLogo} alt="No Limits Academy" className="w-16 h-16 mx-auto mb-4 object-contain" />
          <h1 className="text-xl font-bold text-neutral-900">Form not available</h1>
          <p className="text-neutral-500 mt-2">This form doesn’t exist or isn’t currently accepting responses. Please check the link or contact No Limits Academy.</p>
        </div>
      </div>
    );
  }

  const s = form.settings || {};
  return (
    <FormRenderer
      title={form.title}
      description={form.description}
      fields={form.fields || []}
      branding={{ accentColor: s.accentColor, headerColor: s.headerColor, showLogo: s.showLogo, theme: s.theme }}
      confirmation={{ title: s.confirmationTitle, message: s.confirmationMessage }}
      onSubmit={async (data) => {
        const { error } = await supabase
          .from("form_responses" as never)
          .insert({ form_id: form.id, data } as never);
        if (error) throw error;
      }}
    />
  );
};

export default PublicForm;
