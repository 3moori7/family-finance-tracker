import { getTranslations } from "next-intl/server";
import { getDb } from "@/db/client";
import { FatherAccessForm } from "@/components/father/FatherAccessForm";
import { fatherAccessStatus } from "@/server/father";
import { changePinAction, enableAccessAction, rotateLinkAction } from "./actions";
import { requireOwner } from "@/server/session";

export default async function FatherAccessPage() {
  await requireOwner(); // pages render alongside their layout, so they check the session themselves
  const t = await getTranslations("father");
  const { configured } = await fatherAccessStatus(await getDb());
  return (
    <>
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <FatherAccessForm
        configured={configured}
        enableAction={enableAccessAction}
        rotateAction={rotateLinkAction}
        pinAction={changePinAction}
      />
    </>
  );
}
