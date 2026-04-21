/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const JOSH_EMAIL = "joshmercado@nolimitsboxingacademy.org";
const CHRISSY_EMAIL = "chrissycasiello@nolimitsboxingacademy.org";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(["Open", "In Progress", "Completed", "Blocked"]),
  priority: z.enum(["Low", "Medium", "High"]),
  due_date: z.string().optional(),
  assigned_to: z.string().optional(),
  focus_area_id: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type StaffTask = {
  id: string;
  title: string;
  description: string | null;
  status: "Open" | "In Progress" | "Completed" | "Blocked";
  priority: "Low" | "Medium" | "High";
  due_date: string | null;
  assigned_to: string | null;
  focus_area_id: string | null;
  created_by: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  editingTask?: StaffTask | null;
};

export default function StaffTaskModal({ open, onClose, editingTask }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      status: "Open",
      priority: "Medium",
      due_date: "",
      assigned_to: "",
      focus_area_id: "",
    },
  });

  useEffect(() => {
    if (editingTask) {
      form.reset({
        title: editingTask.title,
        description: editingTask.description ?? "",
        status: editingTask.status,
        priority: editingTask.priority,
        due_date: editingTask.due_date ?? "",
        assigned_to: editingTask.assigned_to ?? "",
        focus_area_id: editingTask.focus_area_id ?? "",
      });
    } else {
      form.reset({
        title: "",
        description: "",
        status: "Open",
        priority: "Medium",
        due_date: "",
        assigned_to: "",
        focus_area_id: "",
      });
    }
  }, [editingTask, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: focusAreas = [] } = useQuery({
    queryKey: ["focus-areas-all"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("focus_areas").select("id, title, manager_type") as any)
        .order("title", { ascending: true });
      if (error) throw error;
      return data as { id: string; title: string; manager_type: string }[];
    },
  });

  // Load Josh and Chrissy as assignable staff
  const { data: staffOptions = [] } = useQuery({
    queryKey: ["staff-assignees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_profiles")
        .select("user_id, full_name, email")
        .in("email", [JOSH_EMAIL, CHRISSY_EMAIL]);
      if (error) throw error;
      return data as { user_id: string; full_name: string; email: string }[];
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        title: values.title,
        description: values.description || null,
        status: values.status,
        priority: values.priority,
        due_date: values.due_date || null,
        assigned_to: values.assigned_to || null,
        focus_area_id: values.focus_area_id || null,
      };

      if (editingTask) {
        const { error } = await (supabase.from("staff_tasks") as any)
          .update(payload)
          .eq("id", editingTask.id);
        if (error) throw error;

        // Notify assignee if it changed
        if (values.assigned_to && values.assigned_to !== editingTask.assigned_to && values.assigned_to !== user?.id) {
          await (supabase.from("staff_task_notifications") as any).insert({
            user_id: values.assigned_to,
            task_id: editingTask.id,
            type: "assigned",
          });
        }
        // Notify if status changed
        if (values.status !== editingTask.status) {
          const notifyUserId =
            user?.id === editingTask.created_by
              ? editingTask.assigned_to
              : editingTask.created_by;
          if (notifyUserId && notifyUserId !== user?.id) {
            await (supabase.from("staff_task_notifications") as any).insert({
              user_id: notifyUserId,
              task_id: editingTask.id,
              type: "status_changed",
            });
          }
        }
      } else {
        const { data: newTask, error } = await (supabase.from("staff_tasks") as any)
          .insert({ ...payload, created_by: user?.id })
          .select("id")
          .single();
        if (error) throw error;

        // Notify assignee if different from creator
        if (values.assigned_to && values.assigned_to !== user?.id) {
          await (supabase.from("staff_task_notifications") as any).insert({
            user_id: values.assigned_to,
            task_id: newTask.id,
            type: "assigned",
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["staff-task-notifications"] });
      toast.success(editingTask ? "Task updated" : "Task created");
      onClose();
    },
    onError: () => {
      toast.error("Something went wrong. Please try again.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-neutral-900 border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">
            {editingTask ? "Edit Task" : "New Task"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-300">Title</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="What needs to be done?"
                      className="bg-neutral-800 border-white/10 text-white placeholder:text-zinc-500"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-300">Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Add more details (optional)"
                      className="bg-neutral-800 border-white/10 text-white placeholder:text-zinc-500 resize-none"
                      rows={3}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="bg-neutral-800 border-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-neutral-800 border-white/10">
                        {["Open", "In Progress", "Completed", "Blocked"].map((s) => (
                          <SelectItem key={s} value={s} className="text-white hover:bg-white/10">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">Priority</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="bg-neutral-800 border-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-neutral-800 border-white/10">
                        {["Low", "Medium", "High"].map((p) => (
                          <SelectItem key={p} value={p} className="text-white hover:bg-white/10">{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">Due Date</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="date"
                        className="bg-neutral-800 border-white/10 text-white"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assigned_to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">Assign To</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="bg-neutral-800 border-white/10 text-white">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-neutral-800 border-white/10">
                        <SelectItem value="" className="text-zinc-400 hover:bg-white/10">Unassigned</SelectItem>
                        {staffOptions.map((s) => (
                          <SelectItem key={s.user_id} value={s.user_id} className="text-white hover:bg-white/10">
                            {s.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="focus_area_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-300">Focus Area (optional)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="bg-neutral-800 border-white/10 text-white">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-neutral-800 border-white/10">
                      <SelectItem value="" className="text-zinc-400 hover:bg-white/10">None</SelectItem>
                      {focusAreas.map((fa) => (
                        <SelectItem key={fa.id} value={fa.id} className="text-white hover:bg-white/10">
                          {fa.title} ({fa.manager_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="text-zinc-400 hover:text-white hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="bg-[#bf0f3e] hover:bg-[#a00d34] text-white"
              >
                {mutation.isPending ? "Saving…" : editingTask ? "Save Changes" : "Create Task"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
