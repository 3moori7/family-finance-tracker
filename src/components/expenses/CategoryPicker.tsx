"use client";

import { useTranslations } from "next-intl";
import { CATEGORIES, type Category } from "@/lib/categories";

/** One-tap category chips (radio buttons, 44px+ targets). */
export function CategoryPicker({ defaultValue, name = "category" }: { defaultValue?: Category; name?: string }) {
  const t = useTranslations("categories");
  return (
    <div role="radiogroup" className="grid grid-cols-2 gap-2">
      {CATEGORIES.map((c, i) => (
        <label key={c} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={c}
            defaultChecked={defaultValue === c}
            required={i === 0}
            className="peer sr-only"
          />
          <span className="flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface px-3 text-sm font-medium peer-checked:border-primary peer-checked:bg-primary-soft peer-checked:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40">
            {t(c)}
          </span>
        </label>
      ))}
    </div>
  );
}
