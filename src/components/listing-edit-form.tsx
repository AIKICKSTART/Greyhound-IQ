"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, Loader2, Save } from "lucide-react";

type ListingEditInitial = {
  id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  categoryId: string | null;
  state: string | null;
  region: string | null;
  suburb: string | null;
  postcode: string | null;
  condition: string | null;
  itemBrand: string | null;
  itemModel: string | null;
  negotiable: boolean;
  contactPreference: string;
  price: number | null;
  attributes: Array<{ key: string; value: string }>;
};

type ListingCategoryOption = {
  id: string;
  name: string;
};

type ListingEditStatus = "idle" | "saving" | "saved" | "error";

export function buildListingPatchPayload(formData: FormData) {
  const priceText = text(formData, "price");
  const price = priceText === "" ? null : Number(priceText);
  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    throw new Error("price.invalid");
  }

  const keys = formData.getAll("attributeKey");
  const values = formData.getAll("attributeValue");
  const attributes = keys
    .map((key, index) => ({
      key: typeof key === "string" ? key.trim() : "",
      value: typeof values[index] === "string" ? values[index].trim() : "",
    }))
    .filter(({ key, value }) => key.length > 0 && value.length > 0)
    .slice(0, 8);

  return {
    title: text(formData, "title"),
    description: text(formData, "description"),
    categoryId: optionalText(formData, "categoryId"),
    state: optionalText(formData, "state"),
    region: optionalText(formData, "region"),
    suburb: optionalText(formData, "suburb"),
    postcode: optionalText(formData, "postcode"),
    condition: optionalText(formData, "condition"),
    itemBrand: optionalText(formData, "itemBrand"),
    itemModel: optionalText(formData, "itemModel"),
    negotiable: formData.get("negotiable") === "true",
    contactPreference: text(formData, "contactPreference"),
    price,
    attributes,
  };
}

export function ListingEditForm({
  initial,
  categories,
}: {
  initial: ListingEditInitial;
  categories: ListingCategoryOption[];
}) {
  const router = useRouter();
  const requestInFlight = useRef(false);
  const [status, setStatus] = useState<ListingEditStatus>("idle");
  const [feedback, setFeedback] = useState<string | null>(null);
  const attributeRows = [
    ...initial.attributes.slice(0, 8),
    ...Array.from(
      { length: Math.max(0, 3 - initial.attributes.length) },
      () => ({ key: "", value: "" }),
    ),
  ];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setStatus("saving");
    setFeedback(null);

    try {
      const payload = buildListingPatchPayload(new FormData(event.currentTarget));
      const response = await fetch(
        `/api/listings/${encodeURIComponent(initial.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        setStatus("error");
        setFeedback(editFailureMessage(response.status));
        return;
      }

      setStatus("saved");
      setFeedback(
        initial.status === "active"
          ? "Changes saved. This listing has returned to moderator review."
          : "Changes saved.",
      );
      router.refresh();
    } catch (error) {
      setStatus("error");
      setFeedback(
        error instanceof Error && error.message === "price.invalid"
          ? "Enter a valid price of zero or more."
          : "Could not save the listing. Check your connection and try again.",
      );
    } finally {
      requestInFlight.current = false;
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="grid min-w-0 gap-5">
        <section className="giq-panel p-4 sm:p-6" aria-labelledby="listing-edit-core">
          <div className="mb-5 border-b border-white/[0.08] pb-4">
            <p className="program-label">{humanise(initial.type)}</p>
            <h2
              id="listing-edit-core"
              className="mt-2 text-xl font-semibold text-[hsl(var(--foreground))]"
            >
              Listing content
            </h2>
          </div>
          <div className="grid gap-4">
            <Field label="Title">
              <input
                name="title"
                required
                minLength={5}
                maxLength={100}
                defaultValue={initial.title}
                className="giq-form-control min-h-11 px-3 py-2"
              />
            </Field>
            <Field label="Description">
              <textarea
                name="description"
                required
                minLength={20}
                maxLength={5_000}
                rows={8}
                defaultValue={initial.description}
                className="giq-form-control px-3 py-2"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category">
                <select
                  name="categoryId"
                  defaultValue={initial.categoryId ?? ""}
                  className="giq-form-control min-h-11 px-3 py-2"
                >
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Price (AUD)">
                <input
                  name="price"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={initial.price ?? ""}
                  className="giq-form-control min-h-11 px-3 py-2"
                />
              </Field>
            </div>
            <label className="flex min-h-11 items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-[hsl(var(--muted-foreground))]">
              <input
                name="negotiable"
                type="checkbox"
                value="true"
                defaultChecked={initial.negotiable}
                className="size-4 accent-[hsl(var(--primary))]"
              />
              Price is negotiable
            </label>
          </div>
        </section>

        <section className="giq-panel p-4 sm:p-6" aria-labelledby="listing-edit-location">
          <h2
            id="listing-edit-location"
            className="text-xl font-semibold text-[hsl(var(--foreground))]"
          >
            Location and item details
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="State">
              <input
                name="state"
                maxLength={8}
                defaultValue={initial.state ?? ""}
                className="giq-form-control min-h-11 px-3 py-2"
              />
            </Field>
            <Field label="Region">
              <input
                name="region"
                maxLength={120}
                defaultValue={initial.region ?? ""}
                className="giq-form-control min-h-11 px-3 py-2"
              />
            </Field>
            <Field label="Suburb">
              <input
                name="suburb"
                maxLength={120}
                defaultValue={initial.suburb ?? ""}
                className="giq-form-control min-h-11 px-3 py-2"
              />
            </Field>
            <Field label="Postcode">
              <input
                name="postcode"
                maxLength={16}
                defaultValue={initial.postcode ?? ""}
                className="giq-form-control min-h-11 px-3 py-2"
              />
            </Field>
            <Field label="Condition">
              <input
                name="condition"
                maxLength={80}
                defaultValue={initial.condition ?? ""}
                className="giq-form-control min-h-11 px-3 py-2"
              />
            </Field>
            <Field label="Contact preference">
              <select
                name="contactPreference"
                defaultValue={initial.contactPreference}
                className="giq-form-control min-h-11 px-3 py-2"
              >
                <option value="message">Message</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
              </select>
            </Field>
            <Field label="Brand">
              <input
                name="itemBrand"
                maxLength={80}
                defaultValue={initial.itemBrand ?? ""}
                className="giq-form-control min-h-11 px-3 py-2"
              />
            </Field>
            <Field label="Model">
              <input
                name="itemModel"
                maxLength={80}
                defaultValue={initial.itemModel ?? ""}
                className="giq-form-control min-h-11 px-3 py-2"
              />
            </Field>
          </div>
        </section>

        <section className="giq-panel p-4 sm:p-6" aria-labelledby="listing-edit-attributes">
          <h2
            id="listing-edit-attributes"
            className="text-xl font-semibold text-[hsl(var(--foreground))]"
          >
            Searchable details
          </h2>
          <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">
            Keep each saved detail paired. Blank rows are ignored.
          </p>
          <div className="mt-5 grid gap-3">
            {attributeRows.map((attribute, index) => (
              <div key={index} className="grid gap-3 sm:grid-cols-2">
                <input
                  name="attributeKey"
                  aria-label={`Detail ${index + 1}`}
                  maxLength={40}
                  defaultValue={attribute.key}
                  placeholder="Detail"
                  className="giq-form-control min-h-11 px-3 py-2"
                />
                <input
                  name="attributeValue"
                  aria-label={`Value ${index + 1}`}
                  maxLength={120}
                  defaultValue={attribute.value}
                  placeholder="Value"
                  className="giq-form-control min-h-11 px-3 py-2"
                />
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="giq-panel h-fit p-4 sm:p-6 lg:sticky lg:top-24">
        <p className="program-label">Owner controls</p>
        <h2 className="mt-2 text-xl font-semibold text-[hsl(var(--foreground))]">
          Save changes
        </h2>
        <p className="mt-2 text-[12px] leading-5 text-[hsl(var(--muted-foreground))]">
          Active listings return to moderator review after an edit. Existing
          media and linked dog records remain unchanged on this screen.
        </p>
        <div className="mt-5 grid gap-3">
          <button
            type="submit"
            disabled={status === "saving"}
            className="giq-button giq-button-primary min-h-11 w-full px-4 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "saving" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            {status === "saving" ? "Saving…" : "Save changes"}
          </button>
          <Link
            href={`/marketplace/${encodeURIComponent(initial.id)}`}
            className="giq-button giq-button-glass min-h-11 w-full px-4 text-[13px] font-semibold"
          >
            Cancel
          </Link>
        </div>
        <div
          role="status"
          aria-live="polite"
          className={`mt-4 min-h-10 text-[12px] leading-5 ${
            status === "error"
              ? "text-red-200"
              : "text-[hsl(var(--muted-foreground))]"
          }`}
        >
          {status === "saved" ? (
            <CheckCircle2 className="mr-1.5 inline size-4 text-emerald-300" aria-hidden="true" />
          ) : null}
          {feedback}
        </div>
      </aside>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-[12px] font-semibold text-[hsl(var(--muted-foreground))]">
      {label}
      {children}
    </label>
  );
}

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(formData: FormData, name: string) {
  return text(formData, name) || null;
}

function humanise(value: string) {
  return value.replaceAll("_", " ");
}

function editFailureMessage(status: number) {
  if (status === 401) return "Your session expired. Sign in and try again.";
  if (status === 403) return "Your account cannot edit this listing.";
  if (status === 404) return "This listing is no longer available to edit.";
  if (status === 429) return "Too many edit attempts. Wait a moment and retry.";
  return "Could not save the listing. Review the fields and try again.";
}
