"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@apollo/client/react";
import { useTranslations } from "next-intl";
import { sileo } from "sileo";
import { Hand, NotebookPen } from "lucide-react";

import { Label } from "@repo/ui/components/label";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import { parseSettingsPath } from "@/features/settings";
import { useLeaveGuard } from "@/shared/hooks/use-leave-guard";
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar";

import { GET_MY_SHOP_INSTAGRAM_ACCOUNT, UPDATE_SHOP_INSTAGRAM_SETTINGS } from "../api";
import type {
  ShopInstagramAccount,
  UpdateShopInstagramSettingsInput,
  UpdateShopInstagramSettingsResult,
} from "../types";

/** The server's own limit (`UpdateShopInstagramSettingsInput.ai_instructions`). */
const MAX_INSTRUCTIONS = 1000;

interface InstagramAssistantCardProps {
  account: ShopInstagramAccount | null;
}

/**
 * How the assistant behaves on Instagram: the merchant's own instructions, and
 * whether a reply typed in the Instagram app hands the thread to a person.
 *
 * Unlike the switches above it, this card follows the dashboard's save-bar
 * rule: a paragraph of instructions saved on every keystroke would be a
 * mutation per letter. Edits are held here, compared by value with the
 * server's, and saved once from the global bar; leaving the screen with an
 * edit pending asks first.
 */
export function InstagramAssistantCard({ account }: InstagramAssistantCardProps) {
  const t = useTranslations("settings.instagram.assistant");

  const serverInstructions = account?.ai_instructions ?? "";
  const serverTakeover = account?.human_takeover_on_reply ?? true;
  const seedKey = `${serverTakeover}|${serverInstructions}`;

  const [instructions, setInstructions] = useState(serverInstructions);
  const [takeover, setTakeover] = useState(serverTakeover);
  const [seededFrom, setSeededFrom] = useState<string | null>(null);

  // Re-seed when the server's values change (after a save, or a refetch),
  // during render rather than in an effect — no frame with stale inputs.
  if (seededFrom !== seedKey) {
    setSeededFrom(seedKey);
    setInstructions(serverInstructions);
    setTakeover(serverTakeover);
  }

  const instructionsDirty = instructions.trim() !== serverInstructions.trim();
  const takeoverDirty = takeover !== serverTakeover;
  const dirty = instructionsDirty || takeoverDirty;
  const tooLong = instructions.length > MAX_INSTRUCTIONS;

  const showBar = useUnsavedBarStore((s) => s.show);
  const hideBar = useUnsavedBarStore((s) => s.hide);
  const setBarError = useUnsavedBarStore((s) => s.setError);

  const [update, { loading: saving }] =
    useMutation<UpdateShopInstagramSettingsResult>(UPDATE_SHOP_INSTAGRAM_SETTINGS, {
      refetchQueries: [GET_MY_SHOP_INSTAGRAM_ACCOUNT],
      awaitRefetchQueries: true,
      onCompleted: () => {
        sileo.success({ title: t("saved") });
      },
      onError: () => {
        sileo.error({ title: t("saveFailed") });
        setBarError(t("saveFailed"));
      },
    });

  const onSave = () => {
    if (tooLong) {
      setBarError(t("instructions.tooLong", { max: MAX_INSTRUCTIONS }));
      return;
    }
    setBarError(null);
    // Only the keys that moved.
    const input: UpdateShopInstagramSettingsInput = {};
    if (instructionsDirty) input.ai_instructions = instructions.trim() || null;
    if (takeoverDirty) input.human_takeover_on_reply = takeover;
    void update({ variables: { input } });
  };

  const onDiscard = () => {
    setInstructions(serverInstructions);
    setTakeover(serverTakeover);
    setBarError(null);
  };

  useEffect(() => {
    if (!dirty) {
      hideBar();
      return;
    }
    showBar({ label: t("unsavedChanges"), saving, onSave, onDiscard });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, saving, instructions, takeover]);
  useEffect(() => () => hideBar(), [hideBar]);

  useLeaveGuard({
    when: dirty,
    allow: (path) => parseSettingsPath(path).section === "instagram",
    onLeave: () => {
      onDiscard();
      hideBar();
    },
  });

  return (
    <div className="rounded-2xl border bg-card text-card-foreground shadow-xs p-6 space-y-6">
      <div className="space-y-1 border-b pb-4">
        <h3 className="font-heading text-lg font-bold">{t("title")}</h3>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-primary shrink-0" />
          <Label htmlFor="instagram-ai-instructions" className="text-sm font-bold">
            {t("instructions.label")}
          </Label>
        </div>
        <Textarea
          id="instagram-ai-instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={t("instructions.placeholder")}
          rows={4}
          aria-invalid={tooLong || undefined}
          className="text-sm rounded-xl"
        />
        <div className="flex items-start justify-between gap-4 text-xs">
          <p className="text-muted-foreground leading-relaxed">
            {t("instructions.hint")}
          </p>
          <span
            className={
              tooLong ? "text-destructive shrink-0" : "text-muted-foreground shrink-0"
            }
          >
            {t("instructions.counter", {
              count: instructions.length,
              max: MAX_INSTRUCTIONS,
            })}
          </span>
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 p-4 rounded-xl border bg-muted/15">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <Hand className="h-4 w-4 text-amber-500 shrink-0" />
            <Label htmlFor="instagram-human-takeover" className="text-sm font-bold">
              {t("takeover.label")}
            </Label>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("takeover.description")}
          </p>
        </div>
        <Switch
          id="instagram-human-takeover"
          checked={takeover}
          onCheckedChange={setTakeover}
          className="shrink-0 mt-1"
        />
      </div>
    </div>
  );
}
