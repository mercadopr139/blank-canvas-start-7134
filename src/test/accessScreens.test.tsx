// The access system, exercised through the real screens: the real sidebar,
// the real door on the routes, the real permission hook. Only two things are
// stood in for: who is signed in, and what the database returns for their
// boxes. Each test signs in as one of the people Josh described and checks
// what they can and cannot open.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── who is signed in ──
const session = vi.hoisted(() => ({
  user: null as null | { id: string; email: string },
  isAdmin: true,
  boxes: {} as Record<string, Record<string, boolean>>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: session.user, session: null, loading: false, isAdmin: session.isAdmin, signIn: vi.fn(), signOut: vi.fn() }),
}));

// ── what the database says their boxes are ──
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: async (_col: string, userId: string) => ({
          data: Object.entries(session.boxes[userId] ?? {}).map(([permission_key, granted]) => ({ permission_key, granted })),
          error: null,
        }),
      }),
    }),
  },
}));

import ProtectedRoute from "@/components/admin/ProtectedRoute";
import AdminOperations from "@/pages/admin/AdminOperations";
import AdminFinance from "@/pages/admin/AdminFinance";
import { setViewAs } from "@/lib/viewAs";

const JOSH = { id: "josh", email: "joshmercado@nolimitsboxingacademy.org" };
const CHRISSY = { id: "chrissy", email: "chrissycasiello@nolimitsboxingacademy.org" };
const JAIME = { id: "jaime", email: "jaime@nolimitsboxingacademy.org" };

const BOXES = {
  // After step 3: an Admin, with her own Task Manager and the reviewer duty.
  chrissy: { access_admin: true, manage_website_photos: true, operations_scripture_coach_reviewer: true, task_manager_PC: true, task_manager_PD: false },
  // Invited, everything off, then one box checked.
  jaime: { app_message_board: false, app_agenda: false, app_juniors_aftercare: true },
};

const Page = ({ name }: { name: string }) => <div>PAGE:{name}</div>;

const open = (path: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/dashboard" element={<ProtectedRoute requireAdmin><Page name="dashboard" /></ProtectedRoute>} />
          <Route path="/admin/staff" element={<ProtectedRoute requireAdmin><Page name="staff" /></ProtectedRoute>} />
          <Route path="/admin/corner-coach" element={<ProtectedRoute requireAdmin><Page name="corner-coach" /></ProtectedRoute>} />
          <Route path="/admin/message-board" element={<ProtectedRoute requireAdmin><Page name="message-board" /></ProtectedRoute>} />
          <Route path="/admin/task-manager/:managerType" element={<ProtectedRoute requireAdmin><Page name="workbench" /></ProtectedRoute>} />
          <Route path="/admin/operations" element={<ProtectedRoute requireAdmin><AdminOperations /></ProtectedRoute>}>
            <Route path="smile-lab-attendance" element={<Page name="juniors" />} />
            <Route path="attendance" element={<Page name="attendance" />} />
            <Route path="registrations" element={<Page name="registrations" />} />
          </Route>
          <Route path="/admin/finance" element={<ProtectedRoute requireAdmin><AdminFinance /></ProtectedRoute>}>
            <Route path="billing" element={<Page name="billing" />} />
            <Route path="deposits/:id" element={<Page name="deposit" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

/** The page rendered, or the locked screen. Waits for the boxes to load. */
const lands = async (path: string) => {
  const view = open(path);
  const hit = await screen.findByText(/^PAGE:|is locked$|Access Denied/);
  const text = hit.textContent ?? "";
  view.unmount();
  return text;
};

const isLockedLine = (label: string) => !!screen.getByText(label).closest('[aria-disabled="true"]');
const isOpenLine = (label: string) => !!screen.getByText(label).closest("button");

beforeEach(() => {
  session.user = null;
  session.isAdmin = true;
  session.boxes = { ...BOXES };
  setViewAs(null);
});

describe("Jaime: one box checked, Juniors Aftercare", () => {
  beforeEach(() => { session.user = JAIME; });

  it("opens Juniors Aftercare", async () => {
    expect(await lands("/admin/operations/smile-lab-attendance")).toBe("PAGE:juniors");
  });

  it("sees all eight Youth Programs lines, with only hers in white", async () => {
    open("/admin/operations/smile-lab-attendance");
    await screen.findByText("PAGE:juniors");
    expect(isOpenLine("Juniors Aftercare Intelligence")).toBe(true);
    ["Attendance Intelligence", "Youth Served (all programs)", "Program Highlights", "Excursion Intelligence",
     "Events Intelligence", "Attendance Reports", "Call-Outs"].forEach((label) =>
      expect(isLockedLine(label), label).toBe(true));
    // Sections she has nothing in still show, shaded.
    expect(isLockedLine("Forms & Waivers")).toBe(true);
  });

  it("is stopped at every other door, even with the address typed", async () => {
    expect(await lands("/admin/operations/attendance")).toBe("Attendance Intelligence is locked");
    expect(await lands("/admin/operations/registrations")).toBe("Registrations is locked");
    expect(await lands("/admin/finance/billing")).toBe("Billing is locked");
    expect(await lands("/admin/finance/deposits/123")).toBe("Billing is locked");
    expect(await lands("/admin/corner-coach")).toBe("Corner Coach is locked");
    expect(await lands("/admin/message-board")).toBe("Message Board is locked");
    expect(await lands("/admin/task-manager/PD")).toBe("This Task Manager is locked");
    expect(await lands("/admin/staff")).toBe("Staff Management is locked");
  });

  it("still reaches the Command Center", async () => {
    expect(await lands("/admin/dashboard")).toBe("PAGE:dashboard");
  });
});

describe("Chrissy: an Admin, no longer a Super Admin", () => {
  beforeEach(() => { session.user = CHRISSY; });

  it("opens every app", async () => {
    expect(await lands("/admin/operations/attendance")).toBe("PAGE:attendance");
    expect(await lands("/admin/operations/registrations")).toBe("PAGE:registrations");
    expect(await lands("/admin/finance/billing")).toBe("PAGE:billing");
    expect(await lands("/admin/corner-coach")).toBe("PAGE:corner-coach");
    expect(await lands("/admin/message-board")).toBe("PAGE:message-board");
  });

  it("opens her own Task Manager and not Josh's", async () => {
    expect(await lands("/admin/task-manager/PC")).toBe("PAGE:workbench");
    expect(await lands("/admin/task-manager/PD")).toBe("This Task Manager is locked");
  });

  it("cannot open Staff Management", async () => {
    expect(await lands("/admin/staff")).toBe("Staff Management is locked");
  });

  it("becomes Staff when her Admin switch is turned off: only Staff-ready boxes open", async () => {
    session.boxes = { chrissy: { access_admin: false, app_billing: true, app_juniors_aftercare: true, task_manager_PC: true } };
    expect(await lands("/admin/operations/smile-lab-attendance")).toBe("PAGE:juniors");
    expect(await lands("/admin/finance/billing")).toBe("Billing is locked");
    expect(await lands("/admin/operations/attendance")).toBe("Attendance Intelligence is locked");
    expect(await lands("/admin/task-manager/PC")).toBe("This Task Manager is locked");
  });
});

describe("Josh: the Super Admin", () => {
  beforeEach(() => { session.user = JOSH; });

  it("opens everything, every Task Manager and Staff Management", async () => {
    expect(await lands("/admin/staff")).toBe("PAGE:staff");
    expect(await lands("/admin/task-manager/PD")).toBe("PAGE:workbench");
    expect(await lands("/admin/task-manager/PC")).toBe("PAGE:workbench");
    expect(await lands("/admin/finance/deposits/9")).toBe("PAGE:deposit");
    expect(await lands("/admin/corner-coach")).toBe("PAGE:corner-coach");
  });

  it("previews the back end as Jaime with View as, then gets it all back", async () => {
    setViewAs({ user_id: "jaime", name: "Jaime", email: JAIME.email });
    expect(await lands("/admin/operations/attendance")).toBe("Attendance Intelligence is locked");
    expect(await lands("/admin/operations/smile-lab-attendance")).toBe("PAGE:juniors");
    expect(await lands("/admin/staff")).toBe("Staff Management is locked");
    setViewAs(null);
    expect(await lands("/admin/staff")).toBe("PAGE:staff");
    expect(await lands("/admin/operations/attendance")).toBe("PAGE:attendance");
  });
});

describe("View as cannot be used by anyone else", () => {
  it("is ignored for a signed-in person who is not the access manager", async () => {
    session.user = JAIME;
    // Even if she plants a preview of Josh in her own browser, nothing opens.
    setViewAs({ user_id: "josh", name: "Josh", email: JOSH.email });
    expect(await lands("/admin/finance/billing")).toBe("Billing is locked");
    expect(await lands("/admin/staff")).toBe("Staff Management is locked");
  });
});

describe("a deactivated or removed person", () => {
  it("is turned away at the first door", async () => {
    session.user = CHRISSY;
    session.isAdmin = false; // what has_role() answers once she is deactivated
    expect(await lands("/admin/dashboard")).toBe("Access Denied");
    expect(await lands("/admin/operations/attendance")).toBe("Access Denied");
  });
});
