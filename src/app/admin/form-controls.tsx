import {
  createAdminDeletionJobAction,
  createAdminExportAction,
  createAdminInvitationAction,
  createAdminPriceAction,
  createAdminUserAction,
  updateAdminBugReportAction,
  updateAdminStatus,
  approveDogOwnershipAction,
  rejectDogOwnershipAction,
  updateAdminSupportTicketAction,
  updateAdminUserAccessAction,
  upsertAdminEntitlementAction,
  upsertAdminOrganizationAction,
  upsertAdminPlanAction,
  upsertAdminRetentionPolicyAction,
  upsertAdminSourceHealthAction,
} from "@/app/admin/mutations";
import type { AdminResource } from "@/lib/admin-service";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--surface-1))]";
const CONTROL = `giq-form-control w-full px-3 py-2 text-[14px] ${FOCUS_RING}`;
const SMALL_BUTTON = `giq-button giq-button-glass min-h-11 px-3 text-[13px] ${FOCUS_RING}`;
const FIELD_LABEL =
  "block text-[11px] font-semibold uppercase tracking-[0.07em] text-[hsl(var(--subtle-foreground))]";
const CHECKBOX_ROW = "flex flex-wrap gap-x-3 gap-y-1 pt-0.5";
const CHECKBOX_LABEL =
  "flex min-h-11 items-center gap-2 rounded-lg px-1 text-[13px] text-[hsl(var(--muted-foreground))] focus-within:text-[hsl(var(--foreground))]";
const CHECKBOX = `h-4 w-4 shrink-0 accent-[hsl(var(--primary-bright))] ${FOCUS_RING}`;

export function AdminStatusForm({
  resource,
  id,
  currentStatus,
  statuses,
  path,
}: {
  resource: AdminResource;
  id: string;
  currentStatus: string;
  statuses: string[];
  path: string;
}) {
  return (
    <form
      action={updateAdminStatus}
      className="w-full min-w-0 space-y-2 sm:w-[220px] sm:min-w-[220px]"
    >
      <HiddenAdminFields resource={resource} id={id} path={path} />
      <select name="status" defaultValue={currentStatus} className={CONTROL}>
        {statuses.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
      <ReasonField />
      <button className={SMALL_BUTTON}>Apply</button>
    </form>
  );
}

export function AdminEnabledForm({
  resource,
  id,
  enabled,
  path,
}: {
  resource: AdminResource;
  id: string;
  enabled: boolean;
  path: string;
}) {
  return (
    <form
      action={updateAdminStatus}
      className="w-full min-w-0 space-y-2 sm:w-[180px] sm:min-w-[180px]"
    >
      <HiddenAdminFields resource={resource} id={id} path={path} />
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
      <ReasonField placeholder={enabled ? "Reason to disable" : "Reason to enable"} />
      <button className={SMALL_BUTTON}>{enabled ? "Disable" : "Enable"}</button>
    </form>
  );
}

export function AdminSupportTicketForm({
  ticket,
  path,
}: {
  ticket: {
    id: string;
    status: string;
    priority: string;
    category: string;
  };
  path: string;
}) {
  return (
    <form
      action={updateAdminSupportTicketAction}
      className="w-full min-w-0 space-y-2 sm:w-[300px] sm:min-w-[300px]"
    >
      <input type="hidden" name="ticketId" value={ticket.id} />
      <input type="hidden" name="path" value={path} />
      <select name="status" defaultValue={ticket.status} className={CONTROL}>
        <option value="open">open</option>
        <option value="pending">pending</option>
        <option value="resolved">resolved</option>
        <option value="closed">closed</option>
      </select>
      <select name="priority" defaultValue={ticket.priority} className={CONTROL}>
        <option value="low">low</option>
        <option value="normal">normal</option>
        <option value="high">high</option>
        <option value="urgent">urgent</option>
      </select>
      <input
        name="category"
        defaultValue={ticket.category}
        required
        maxLength={40}
        className={CONTROL}
      />
      <textarea
        name="replyBody"
        maxLength={2000}
        rows={2}
        placeholder="Support reply optional"
        className={`${CONTROL} giq-textarea`}
      />
      <ReasonField />
      <button className={SMALL_BUTTON}>Update ticket</button>
    </form>
  );
}

export function AdminBugReportForm({
  bugReport,
  path,
}: {
  bugReport: {
    id: string;
    status: string;
    severity: string;
  };
  path: string;
}) {
  return (
    <form
      action={updateAdminBugReportAction}
      className="w-full min-w-0 space-y-2 sm:w-[240px] sm:min-w-[240px]"
    >
      <input type="hidden" name="bugReportId" value={bugReport.id} />
      <input type="hidden" name="path" value={path} />
      <select name="status" defaultValue={bugReport.status} className={CONTROL}>
        <option value="open">open</option>
        <option value="triaged">triaged</option>
        <option value="in_progress">in_progress</option>
        <option value="resolved">resolved</option>
        <option value="closed">closed</option>
      </select>
      <select name="severity" defaultValue={bugReport.severity} className={CONTROL}>
        <option value="low">low</option>
        <option value="normal">normal</option>
        <option value="high">high</option>
        <option value="critical">critical</option>
      </select>
      <ReasonField />
      <button className={SMALL_BUTTON}>Update report</button>
    </form>
  );
}

export function AdminCreateUserForm({ path }: { path: string }) {
  return (
    <form action={createAdminUserAction} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="path" value={path} />
      <input name="email" type="email" required placeholder="Email" className={CONTROL} />
      <input name="name" placeholder="Display name" className={CONTROL} />
      <select name="tier" defaultValue="pro_plus" className={CONTROL}>
        <option value="free">free</option>
        <option value="pro">pro</option>
        <option value="pro_plus">pro_plus</option>
      </select>
      <select name="role" defaultValue="member" className={CONTROL}>
        <RoleOptions />
      </select>
      <label className={CHECKBOX_LABEL}>
        <input type="checkbox" name="verified" className={CHECKBOX} /> Verified
      </label>
      <ReasonField placeholder="Reason for user create/update" />
      <button
        className={`giq-button giq-button-primary min-h-11 px-4 text-[13px] md:col-span-2 ${FOCUS_RING}`}
      >
        Create or update user
      </button>
    </form>
  );
}

export function AdminUserAccessForm({
  user,
  path,
}: {
  user: {
    id: string;
    subscriptionTier: string;
    isBanned: boolean;
    deletionRequestedAt: Date | null;
    profile: { role: string; verified: boolean } | null;
  };
  path: string;
}) {
  return (
    <form
      action={updateAdminUserAccessAction}
      className="w-full min-w-0 space-y-2 sm:w-[320px]"
    >
      <input type="hidden" name="userId" value={user.id} />
      <input type="hidden" name="path" value={path} />
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1">
          <span className={FIELD_LABEL}>Tier</span>
          <select name="tier" defaultValue={user.subscriptionTier} className={CONTROL}>
            <option value="free">free</option>
            <option value="pro">pro</option>
            <option value="pro_plus">pro_plus</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className={FIELD_LABEL}>Role</span>
          <select name="role" defaultValue={user.profile?.role ?? "member"} className={CONTROL}>
            <RoleOptions />
          </select>
        </label>
      </div>
      <div className={CHECKBOX_ROW}>
        <label className={CHECKBOX_LABEL}>
          <input
            type="checkbox"
            name="verified"
            defaultChecked={user.profile?.verified ?? false}
            className={CHECKBOX}
          />
          Verified
        </label>
        <label className={CHECKBOX_LABEL}>
          <input
            type="checkbox"
            name="banned"
            defaultChecked={user.isBanned}
            className={CHECKBOX}
          />
          Banned
        </label>
        {user.deletionRequestedAt ? (
          <label className={CHECKBOX_LABEL}>
            <input type="checkbox" name="cancelDeletion" className={CHECKBOX} />
            Cancel deletion
          </label>
        ) : null}
      </div>
      <ReasonField />
      <button className={SMALL_BUTTON}>Save access</button>
    </form>
  );
}

export function AdminPlanForms({
  plans,
  path,
}: {
  plans: { id: string; code: string }[];
  path: string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <form action={upsertAdminPlanAction} className="giq-subpanel space-y-3 p-4">
        <input type="hidden" name="path" value={path} />
        <h2 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">Plan</h2>
        <input name="code" required placeholder="code" className={CONTROL} />
        <input name="name" required placeholder="Name" className={CONTROL} />
        <select name="status" defaultValue="active" className={CONTROL}>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
          <option value="archived">archived</option>
        </select>
        <ReasonField />
        <button className={SMALL_BUTTON}>Save plan</button>
      </form>

      <form action={createAdminPriceAction} className="giq-subpanel space-y-3 p-4">
        <input type="hidden" name="path" value={path} />
        <h2 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">Price</h2>
        <PlanSelect plans={plans} />
        <input name="interval" required placeholder="monthly" className={CONTROL} />
        <input name="currency" required defaultValue="AUD" className={CONTROL} />
        <input name="amountCents" required type="number" min={0} placeholder="1200" className={CONTROL} />
        <select name="status" defaultValue="active" className={CONTROL}>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>
        <ReasonField />
        <button className={SMALL_BUTTON}>Create price</button>
      </form>

      <form action={upsertAdminEntitlementAction} className="giq-subpanel space-y-3 p-4">
        <input type="hidden" name="path" value={path} />
        <h2 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">Entitlement</h2>
        <PlanSelect plans={plans} />
        <input name="featureKey" required placeholder="feature key" className={CONTROL} />
        <input name="limitValue" type="number" min={0} placeholder="limit optional" className={CONTROL} />
        <input name="unit" placeholder="unit optional" className={CONTROL} />
        <label className={CHECKBOX_LABEL}>
          <input type="checkbox" name="enabled" defaultChecked className={CHECKBOX} />
          Enabled
        </label>
        <ReasonField />
        <button className={SMALL_BUTTON}>Save entitlement</button>
      </form>
    </div>
  );
}

export function AdminRetentionForms({ path }: { path: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form action={upsertAdminRetentionPolicyAction} className="giq-subpanel space-y-3 p-4">
        <input type="hidden" name="path" value={path} />
        <h2 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">Policy</h2>
        <input name="code" required placeholder="policy code" className={CONTROL} />
        <input name="targetType" required placeholder="target type" className={CONTROL} />
        <input name="retentionDays" required type="number" min={0} max={3650} placeholder="365" className={CONTROL} />
        <label className={CHECKBOX_LABEL}>
          <input type="checkbox" name="enabled" defaultChecked className={CHECKBOX} />
          Enabled
        </label>
        <ReasonField />
        <button className={SMALL_BUTTON}>Save policy</button>
      </form>

      <form action={createAdminDeletionJobAction} className="giq-subpanel space-y-3 p-4">
        <input type="hidden" name="path" value={path} />
        <h2 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">Deletion job</h2>
        <input name="policyId" placeholder="policy id optional" className={CONTROL} />
        <input name="targetType" required placeholder="target type" className={CONTROL} />
        <input name="targetUserId" placeholder="target user id optional" className={CONTROL} />
        <input name="storageBucket" placeholder="storage bucket optional" className={CONTROL} />
        <input name="storagePath" placeholder="storage path optional" className={CONTROL} />
        <input name="scheduledFor" required type="datetime-local" className={CONTROL} />
        <ReasonField />
        <button className={SMALL_BUTTON}>Schedule job</button>
      </form>
    </div>
  );
}

export function AdminOrganizationForms({ path }: { path: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form action={upsertAdminOrganizationAction} className="giq-subpanel space-y-3 p-4">
        <input type="hidden" name="path" value={path} />
        <h2 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">Organization</h2>
        <input name="name" required placeholder="Organization name" className={CONTROL} />
        <input name="workosOrganizationId" required placeholder="WorkOS organization id" className={CONTROL} />
        <input name="ownerId" placeholder="Owner user id optional" className={CONTROL} />
        <ReasonField />
        <button className={SMALL_BUTTON}>Save organization</button>
      </form>

      <form action={createAdminInvitationAction} className="giq-subpanel space-y-3 p-4">
        <input type="hidden" name="path" value={path} />
        <h2 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">Invitation</h2>
        <input name="organizationId" required placeholder="Organization id" className={CONTROL} />
        <input name="email" required type="email" placeholder="Invitee email" className={CONTROL} />
        <input name="role" required defaultValue="member" className={CONTROL} />
        <input name="expiresAt" required type="datetime-local" className={CONTROL} />
        <ReasonField />
        <button className={SMALL_BUTTON}>Create invitation</button>
      </form>
    </div>
  );
}

export function AdminExportForm({ path }: { path: string }) {
  return (
    <form action={createAdminExportAction} className="giq-subpanel grid gap-3 p-4 md:grid-cols-2">
      <input type="hidden" name="path" value={path} />
      <input name="exportType" required placeholder="export type" className={CONTROL} />
      <input name="targetUserId" placeholder="target user id optional" className={CONTROL} />
      <input name="organizationId" placeholder="organization id optional" className={CONTROL} />
      <input name="expiresAt" type="datetime-local" className={CONTROL} />
      <ReasonField />
      <button className={SMALL_BUTTON}>Create export artifact</button>
    </form>
  );
}

export function AdminSourceHealthForm({ path }: { path: string }) {
  return (
    <form action={upsertAdminSourceHealthAction} className="giq-subpanel grid gap-3 p-4 md:grid-cols-2">
      <input type="hidden" name="path" value={path} />
      <input name="sourceProvider" required placeholder="source provider" className={CONTROL} />
      <select name="status" defaultValue="ok" className={CONTROL}>
        <option value="ok">ok</option>
        <option value="degraded">degraded</option>
        <option value="error">error</option>
        <option value="unknown">unknown</option>
      </select>
      <input name="latencyMs" type="number" min={0} placeholder="latency ms optional" className={CONTROL} />
      <ReasonField />
      <button className={SMALL_BUTTON}>Save source health</button>
    </form>
  );
}

export function AdminDogOwnershipForm({
  ownershipId,
  path,
}: {
  ownershipId: string;
  path: string;
}) {
  return (
    <form className="w-full min-w-0 space-y-2 sm:w-[240px] sm:min-w-[240px]">
      <input type="hidden" name="ownershipId" value={ownershipId} />
      <input type="hidden" name="path" value={path} />
      <ReasonField placeholder="Reason (shown to claimant if rejected)" />
      <div className="flex gap-2">
        <button formAction={approveDogOwnershipAction} className={SMALL_BUTTON}>
          Approve
        </button>
        <button formAction={rejectDogOwnershipAction} className={SMALL_BUTTON}>
          Reject
        </button>
      </div>
    </form>
  );
}

function HiddenAdminFields({
  resource,
  id,
  path,
}: {
  resource: AdminResource;
  id: string;
  path: string;
}) {
  return (
    <>
      <input type="hidden" name="resource" value={resource} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="path" value={path} />
    </>
  );
}

function ReasonField({ placeholder = "Reason required" }: { placeholder?: string }) {
  return (
    <input
      name="reason"
      required
      minLength={3}
      maxLength={500}
      placeholder={placeholder}
      className={CONTROL}
    />
  );
}

function RoleOptions() {
  return (
    <>
      <option value="member">member</option>
      <option value="breeder">breeder</option>
      <option value="trainer">trainer</option>
      <option value="moderator">moderator</option>
      <option value="admin">admin</option>
    </>
  );
}

function PlanSelect({ plans }: { plans: { id: string; code: string }[] }) {
  return (
    <select name="planId" required className={CONTROL}>
      <option value="">Select plan</option>
      {plans.map((plan) => (
        <option key={plan.id} value={plan.id}>
          {plan.code}
        </option>
      ))}
    </select>
  );
}
