"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/** Registers the service worker and warns when the connection drops (so nothing seems saved when it isn't). */
export function PwaRegister() {
  const t = useTranslations("offline");
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial value comes from the browser
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;
  return (
    <div role="status" className="no-print sticky top-0 z-50 bg-danger px-4 py-2 text-center text-sm font-medium text-white">
      {t("banner")}
    </div>
  );
}
