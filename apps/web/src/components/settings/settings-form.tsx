"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTheme } from "next-themes";
import { FlaskConical } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { DangerZone } from "./danger-zone";
import {
  DEFAULT_THEME,
  THEME_OPTIONS,
  normalizeTheme,
} from "@/lib/theme-preference";
import {
  DEMO_PREFERENCES_DEFAULTS,
  loadDemoPreferences,
  saveDemoPreferences,
} from "@/lib/demo-preferences";

// This page is a SHOWCASE. Theme is the one preference the app genuinely
// honours (owned by next-themes, applied for real). Everything else — the
// Profile fields and the notification / quota / default-view preferences — is a
// deliberate DEMO: it shows what a settings page can look like when you adapt
// the kit, without pretending the kit ships the backend (account system,
// mailer, quota service, activity log) that would make them do anything. A
// banner says so, and the demo values persist to localStorage only. This used
// to mislead: the same fields toasted "Settings saved" with no hint they were
// inert. See docs/features/settings.md.
const settingsSchema = z.object({
  displayName: z
    .string()
    .min(2, "Display name must be at least 2 characters")
    .max(50),
  bio: z.string().max(160, "Bio must be 160 characters or fewer").optional(),
  theme: z.enum(THEME_OPTIONS),
  defaultView: z.enum(["tree", "list", "grid"]),
  emailOnUpload: z.boolean(),
  warnNearQuota: z.boolean(),
  quotaThreshold: z
    .string()
    .regex(/^\d+$/, "Must be a number")
    .refine((v) => {
      const n = Number(v);
      return n >= 50 && n <= 95;
    }, "Must be between 50 and 95"),
});

type SettingsValues = z.infer<typeof settingsSchema>;

const defaultValues: SettingsValues = {
  ...DEMO_PREFERENCES_DEFAULTS,
  theme: DEFAULT_THEME,
};

export function SettingsForm() {
  const [submitting, setSubmitting] = useState(false);
  // next-themes is the single owner of the theme (it persists it under its own
  // storage key); the radio group is a view onto it, which is why the header
  // toggle and this form always agree.
  const { setTheme, theme } = useTheme();
  const hydratedRef = useRef(false);
  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues,
  });

  // Hydrate once, after next-themes has resolved the active theme on the client
  // (it is undefined during the first paint). Theme comes from next-themes; the
  // demo fields come from their own localStorage blob.
  useEffect(() => {
    if (hydratedRef.current || theme === undefined) return;
    hydratedRef.current = true;
    form.reset({
      ...loadDemoPreferences(),
      theme: normalizeTheme(theme),
    });
  }, [form, theme]);

  const onSubmit = async (values: SettingsValues) => {
    setSubmitting(true);
    // Theme is real: applied immediately AND persisted (next-themes' own key).
    setTheme(values.theme);
    // The rest is the demo: persisted locally only, never sent anywhere.
    const { theme: _theme, ...demo } = values;
    const stored = saveDemoPreferences({ ...demo, bio: demo.bio ?? "" });
    setSubmitting(false);

    if (stored) {
      toast.success("Preferences saved in this browser", {
        description:
          "Theme is applied now. Profile and the other preferences are a demo — stored locally, not sent anywhere.",
      });
    } else {
      // Honest: don't claim a save that didn't happen.
      toast.warning("Theme applied; demo preferences not stored", {
        description:
          "Your browser blocked local storage, so the demo values won't persist. Theme still changed.",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* The one thing the old page was missing: say plainly what is real. */}
        <Alert>
          <FlaskConical />
          <AlertTitle>Most of this page is a demonstration</AlertTitle>
          <AlertDescription>
            <span>
              It shows what a settings page can look like when you build on this
              starter kit. Only <strong>Theme</strong> is wired up for real. The
              Profile fields and the notification, quota, and default-view
              preferences are illustrative placeholders — they save to this
              browser but drive no behaviour, because the kit ships no account
              system, mailer, quota service, or activity log. Point them at your
              own API when you add one. See{" "}
              <code>docs/features/settings.md</code>.
            </span>
          </AlertDescription>
        </Alert>

        {/* Profile (demo) */}
        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">Profile</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your name" {...field} />
                  </FormControl>
                  <FormDescription>
                    Demo field. In a real build this might appear in activity
                    logs or share links.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bio</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="A short description of this workspace"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Demo field. Max 160 characters.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">Preferences</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-6">
            <FormField
              control={form.control}
              name="theme"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Theme</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex gap-6"
                    >
                      {THEME_OPTIONS.map((t) => (
                        <label
                          key={t}
                          className="flex items-center gap-2 text-sm capitalize cursor-pointer"
                        >
                          <RadioGroupItem value={t} />
                          {t}
                        </label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormDescription>
                    Applied for real when you save. The header toggle changes it
                    too.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="defaultView"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default file view</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-60">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="tree">Tree</SelectItem>
                      <SelectItem value="list">List</SelectItem>
                      <SelectItem value="grid">Grid</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Demo field. Only the tree view ships today; List and Grid are
                    placeholders for you to build.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="emailOnUpload"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-md border border-border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Email me on every upload</FormLabel>
                    <FormDescription>
                      Demo field. A real build would send a receipt per upload.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="warnNearQuota"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="grid gap-1.5 leading-none">
                    <FormLabel>Warn me when approaching quota</FormLabel>
                    <FormDescription>
                      Demo field. Would show a banner once usage crosses your
                      threshold.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quotaThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quota warning threshold (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={50}
                      max={95}
                      className="w-32 font-mono tabular-nums"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Demo field. Between 50 and 95.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <DangerZone />

        {/* Action bar */}
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              form.reset({ ...DEMO_PREFERENCES_DEFAULTS, theme: DEFAULT_THEME })
            }
          >
            Reset
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
