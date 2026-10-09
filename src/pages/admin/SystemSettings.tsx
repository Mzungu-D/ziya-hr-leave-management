import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertCircle,
  Bell,
  CalendarDays,
  Check,
  Clock3,
  Globe2,
  Loader2,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";

import {
  getSystemSettingDefinitions,
  getSystemSettings,
  getSystemSettingsErrorMessage,
  resetSystemSettings,
  updateSystemSettings,
  type SystemSetting,
  type SystemSettingDefinition,
  type SystemSettingValue,
} from "../../services/systemSettings.service";

type SettingsState = Record<
  string,
  SystemSettingValue
>;

interface SettingGroup {
  title: string;
  description: string;
  icon: typeof Settings2;
  keys: string[];
}

const SETTING_GROUPS: SettingGroup[] = [
  {
    title: "Organization",
    description:
      "Regional and calendar settings used across the organization.",
    icon: Globe2,
    keys: [
      "organization_timezone",
      "organization_locale",
      "leave_year_start_month",
      "leave_year_start_day",
    ],
  },
  {
    title: "Working Days",
    description:
      "Choose the days that count as working days when calculating leave.",
    icon: CalendarDays,
    keys: [
      "working_days_monday",
      "working_days_tuesday",
      "working_days_wednesday",
      "working_days_thursday",
      "working_days_friday",
      "working_days_saturday",
      "working_days_sunday",
    ],
  },
  {
    title: "Leave Workflow",
    description:
      "Control approval requirements and concurrent leave limits.",
    icon: Workflow,
    keys: [
      "max_department_concurrent_leave",
      "manager_approval_required",
      "hr_approval_required",
    ],
  },
  {
    title: "Employee Experience",
    description:
      "Control employee self-service and system notifications.",
    icon: Users,
    keys: [
      "employee_self_service_enabled",
      "email_notifications_enabled",
    ],
  },
  {
    title: "Security",
    description:
      "Configure authenticated session duration for users.",
    icon: ShieldCheck,
    keys: [
      "session_timeout_minutes",
    ],
  },
];

const FALLBACK_DEFINITIONS: SystemSettingDefinition[] =
  [
    {
      key: "organization_timezone",
      type: "STRING",
      label: "Organization timezone",
      description:
        "Timezone used for organization dates and times.",
      defaultValue: "Africa/Nairobi",
    },
    {
      key: "organization_locale",
      type: "STRING",
      label: "Organization locale",
      description:
        "Locale used for regional formatting.",
      defaultValue: "en-KE",
    },
    {
      key: "leave_year_start_month",
      type: "INTEGER",
      label: "Leave year start month",
      description:
        "Month in which the leave year begins.",
      defaultValue: 1,
    },
    {
      key: "leave_year_start_day",
      type: "INTEGER",
      label: "Leave year start day",
      description:
        "Day of the month on which the leave year begins.",
      defaultValue: 1,
    },
    {
      key: "working_days_monday",
      type: "BOOLEAN",
      label: "Monday",
      description: "Count Monday as a working day.",
      defaultValue: true,
    },
    {
      key: "working_days_tuesday",
      type: "BOOLEAN",
      label: "Tuesday",
      description: "Count Tuesday as a working day.",
      defaultValue: true,
    },
    {
      key: "working_days_wednesday",
      type: "BOOLEAN",
      label: "Wednesday",
      description: "Count Wednesday as a working day.",
      defaultValue: true,
    },
    {
      key: "working_days_thursday",
      type: "BOOLEAN",
      label: "Thursday",
      description: "Count Thursday as a working day.",
      defaultValue: true,
    },
    {
      key: "working_days_friday",
      type: "BOOLEAN",
      label: "Friday",
      description: "Count Friday as a working day.",
      defaultValue: true,
    },
    {
      key: "working_days_saturday",
      type: "BOOLEAN",
      label: "Saturday",
      description: "Count Saturday as a working day.",
      defaultValue: false,
    },
    {
      key: "working_days_sunday",
      type: "BOOLEAN",
      label: "Sunday",
      description: "Count Sunday as a working day.",
      defaultValue: false,
    },
    {
      key: "max_department_concurrent_leave",
      type: "INTEGER",
      label: "Maximum concurrent leave",
      description:
        "Maximum number of employees from the same department who can be on leave at once.",
      defaultValue: 3,
    },
    {
      key: "manager_approval_required",
      type: "BOOLEAN",
      label: "Manager approval",
      description:
        "Require manager approval before HR approval.",
      defaultValue: true,
    },
    {
      key: "hr_approval_required",
      type: "BOOLEAN",
      label: "HR approval",
      description:
        "Require HR approval before leave is finalized.",
      defaultValue: true,
    },
    {
      key: "employee_self_service_enabled",
      type: "BOOLEAN",
      label: "Employee self-service",
      description:
        "Allow employees to use self-service leave functionality.",
      defaultValue: true,
    },
    {
      key: "email_notifications_enabled",
      type: "BOOLEAN",
      label: "Email notifications",
      description:
        "Enable system email notifications.",
      defaultValue: true,
    },
    {
      key: "session_timeout_minutes",
      type: "INTEGER",
      label: "Session timeout",
      description:
        "Maximum authenticated session duration in minutes.",
      defaultValue: 480,
    },
  ];

function cloneValue(
  value: SystemSettingValue,
): SystemSettingValue {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return [...value];
  }

  return {
    ...value,
  };
}

function valuesEqual(
  left: SystemSettingValue,
  right: SystemSettingValue,
): boolean {
  if (
    typeof left !== "object" ||
    left === null ||
    typeof right !== "object" ||
    right === null
  ) {
    return left === right;
  }

  try {
    return (
      JSON.stringify(left) ===
      JSON.stringify(right)
    );
  } catch {
    return false;
  }
}

function buildSettingsState(
  settings: SystemSetting[],
  definitions: SystemSettingDefinition[],
): SettingsState {
  const state: SettingsState = {};

  for (const definition of definitions) {
    state[definition.key] =
      cloneValue(
        definition.defaultValue,
      );
  }

  for (const setting of settings) {
    state[setting.key] =
      cloneValue(setting.value);
  }

  return state;
}

function getDefinition(
  key: string,
  definitions: SystemSettingDefinition[],
): SystemSettingDefinition {
  return (
    definitions.find(
      (definition) =>
        definition.key === key,
    ) ??
    FALLBACK_DEFINITIONS.find(
      (definition) =>
        definition.key === key,
    ) ?? {
      key,
      type: "STRING",
      label: key,
      description: "",
      defaultValue: "",
    }
  );
}

function formatKey(key: string): string {
  return key
    .replace(/^organization_/, "")
    .replace(/^working_days_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function isBooleanValue(
  value: SystemSettingValue,
): value is boolean {
  return typeof value === "boolean";
}

function isNumberValue(
  value: SystemSettingValue,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function isStringValue(
  value: SystemSettingValue,
): value is string {
  return typeof value === "string";
}

function normalizeInputValue(
  definition: SystemSettingDefinition,
  value: string | number | boolean,
): SystemSettingValue {
  switch (definition.type) {
    case "INTEGER":
      return Number(value);

    case "BOOLEAN":
      return Boolean(value);

    case "JSON":
      if (typeof value !== "string") {
        return value;
      }

      try {
        return JSON.parse(value);
      } catch {
        return value;
      }

    case "STRING":
    default:
      return String(value);
  }
}

export default function SystemSettings() {
  const [definitions, setDefinitions] =
    useState<SystemSettingDefinition[]>(
      FALLBACK_DEFINITIONS,
    );

  const [settings, setSettings] =
    useState<SystemSetting[]>([]);

  const [values, setValues] =
    useState<SettingsState>({});

  const [initialValues, setInitialValues] =
    useState<SettingsState>({});

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [resetting, setResetting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [success, setSuccess] =
    useState<string | null>(null);

  const [expandedGroups, setExpandedGroups] =
    useState<Record<string, boolean>>(
      {},
    );

  const loadSettings =
    useCallback(async () => {
      setLoading(true);
      setError(null);

      try {
        const [
          loadedDefinitions,
          loadedSettings,
        ] = await Promise.all([
          getSystemSettingDefinitions(),
          getSystemSettings(),
        ]);

        const safeDefinitions =
          loadedDefinitions.length > 0
            ? loadedDefinitions
            : FALLBACK_DEFINITIONS;

        const nextValues =
          buildSettingsState(
            loadedSettings,
            safeDefinitions,
          );

        setDefinitions(
          safeDefinitions,
        );

        setSettings(
          loadedSettings,
        );

        setValues(nextValues);
        setInitialValues(
          nextValues,
        );
      } catch (requestError) {
        setError(
          getSystemSettingsErrorMessage(
            requestError,
          ),
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const initialExpanded: Record<
      string,
      boolean
    > = {};

    for (const group of SETTING_GROUPS) {
      initialExpanded[group.title] =
        true;
    }

    setExpandedGroups(
      initialExpanded,
    );
  }, []);

  const changedKeys = useMemo(() => {
    return definitions
      .filter((definition) => {
        const current =
          values[definition.key];

        const initial =
          initialValues[
            definition.key
          ];

        return !valuesEqual(
          current,
          initial,
        );
      })
      .map(
        (definition) =>
          definition.key,
      );
  }, [
    definitions,
    initialValues,
    values,
  ]);

  const hasChanges =
    changedKeys.length > 0;

  const settingsByKey = useMemo(() => {
    const map = new Map<
      string,
      SystemSetting
    >();

    for (const setting of settings) {
      map.set(setting.key, setting);
    }

    return map;
  }, [settings]);

  const setValue = (
    key: string,
    value: SystemSettingValue,
  ) => {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));

    setSuccess(null);
    setError(null);
  };

  const handleSave = async () => {
    if (!hasChanges || saving) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const changedSettings =
        changedKeys.map((key) => {
          const definition =
            getDefinition(
              key,
              definitions,
            );

          return {
            key,
            value:
              values[key],
            type: definition.type,
            description:
              definition.description,
          };
        });

      const updated =
        await updateSystemSettings({
          settings:
            changedSettings,
        });

      const nextValues =
        buildSettingsState(
          updated,
          definitions,
        );

      setSettings(updated);
      setValues(nextValues);
      setInitialValues(
        nextValues,
      );

      setSuccess(
        "System settings saved successfully.",
      );
    } catch (requestError) {
      setError(
        getSystemSettingsErrorMessage(
          requestError,
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (resetting) {
      return;
    }

    const confirmed =
      window.confirm(
        "Reset all system settings to their organization defaults? This will remove all custom setting values.",
      );

    if (!confirmed) {
      return;
    }

    setResetting(true);
    setError(null);
    setSuccess(null);

    try {
      const reset =
        await resetSystemSettings();

      const nextValues =
        buildSettingsState(
          reset,
          definitions,
        );

      setSettings(reset);
      setValues(nextValues);
      setInitialValues(
        nextValues,
      );

      setSuccess(
        "System settings were reset successfully.",
      );
    } catch (requestError) {
      setError(
        getSystemSettingsErrorMessage(
          requestError,
        ),
      );
    } finally {
      setResetting(false);
    }
  };

  const handleDiscard = () => {
    if (!hasChanges) {
      return;
    }

    setValues(
      Object.fromEntries(
        Object.entries(
          initialValues,
        ).map(
          ([key, value]) => [
            key,
            cloneValue(value),
          ],
        ),
      ),
    );

    setError(null);
    setSuccess(
      "Unsaved changes were discarded.",
    );
  };

  const toggleGroup = (
    groupTitle: string,
  ) => {
    setExpandedGroups(
      (current) => ({
        ...current,
        [groupTitle]:
          !current[groupTitle],
      }),
    );
  };

  const renderSetting = (
    definition: SystemSettingDefinition,
  ) => {
    const value =
      values[definition.key];

    const stored =
      settingsByKey.get(
        definition.key,
      );

    const changed =
      changedKeys.includes(
        definition.key,
      );

    if (
      definition.type === "BOOLEAN"
    ) {
      const checked =
        isBooleanValue(value)
          ? value
          : Boolean(
              definition.defaultValue,
            );

      return (
        <div
          key={definition.key}
          className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                {definition.label ||
                  formatKey(
                    definition.key,
                  )}
              </h3>

              {changed && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  Unsaved
                </span>
              )}
            </div>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              {definition.description}
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={
              definition.label
            }
            onClick={() =>
              setValue(
                definition.key,
                !checked,
              )
            }
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
              checked
                ? "bg-slate-900"
                : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition ${
                checked
                  ? "translate-x-6"
                  : "translate-x-1"
              }`}
            />
          </button>
        </div>
      );
    }

    const inputValue =
      definition.type ===
      "INTEGER"
        ? isNumberValue(value)
          ? value
          : Number(
              definition.defaultValue,
            )
        : isStringValue(value)
          ? value
          : String(
              definition.defaultValue ??
                "",
            );

    const isStored =
      Boolean(stored);

    return (
      <div
        key={definition.key}
        className="rounded-xl border border-slate-200 bg-white p-4"
      >
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                {definition.label ||
                  formatKey(
                    definition.key,
                  )}
              </h3>

              {changed && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  Unsaved
                </span>
              )}

              {isStored && !changed && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  Saved
                </span>
              )}
            </div>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              {definition.description}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {definition.key ===
            "organization_timezone" ? (
            <select
              value={
                String(
                  inputValue,
                )
              }
              onChange={(event) =>
                setValue(
                  definition.key,
                  normalizeInputValue(
                    definition,
                    event.target.value,
                  ),
                )
              }
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            >
              {[
                "Africa/Nairobi",
                "Africa/Cairo",
                "Africa/Johannesburg",
                "Africa/Lagos",
                "Africa/Accra",
                "Europe/London",
                "Europe/Paris",
                "Asia/Dubai",
                "Asia/Kolkata",
                "Asia/Singapore",
                "America/New_York",
                "America/Chicago",
                "America/Los_Angeles",
                "UTC",
              ].map(
                (timezone) => (
                  <option
                    key={timezone}
                    value={timezone}
                  >
                    {timezone}
                  </option>
                ),
              )}
            </select>
          ) : definition.key ===
            "organization_locale" ? (
            <select
              value={
                String(
                  inputValue,
                )
              }
              onChange={(event) =>
                setValue(
                  definition.key,
                  normalizeInputValue(
                    definition,
                    event.target.value,
                  ),
                )
              }
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            >
              {[
                "en-KE",
                "en-US",
                "en-GB",
                "en-ZA",
                "sw-KE",
              ].map(
                (locale) => (
                  <option
                    key={locale}
                    value={locale}
                  >
                    {locale}
                  </option>
                ),
              )}
            </select>
          ) : (
            <input
              type={
                definition.type ===
                "INTEGER"
                  ? "number"
                  : "text"
              }
              min={
                definition.type ===
                "INTEGER"
                  ? 1
                  : undefined
              }
              step={
                definition.type ===
                "INTEGER"
                  ? 1
                  : undefined
              }
              value={
                String(
                  inputValue,
                )
              }
              onChange={(event) =>
                setValue(
                  definition.key,
                  normalizeInputValue(
                    definition,
                    event.target.value,
                  ),
                )
              }
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-7 w-7 animate-spin" />
          <p className="text-sm">
            Loading system settings...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                <Settings2 className="h-5 w-5" />
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                System Settings
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">
                Configure organization-wide leave,
                workflow, employee experience, and
                security settings.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={
                  !hasChanges ||
                  saving ||
                  resetting
                }
                onClick={handleDiscard}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                Discard
              </button>

              <button
                type="button"
                disabled={
                  !hasChanges ||
                  saving ||
                  resetting
                }
                onClick={() =>
                  void handleSave()
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving
                  ? "Saving..."
                  : "Save changes"}
              </button>
            </div>
          </div>
        </div>

        {/* Status messages */}
        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

            <div className="min-w-0">
              <p className="text-sm font-semibold">
                Unable to update settings
              </p>
              <p className="mt-1 text-sm leading-6">
                {error}
              </p>
            </div>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800"
          >
            <Check className="mt-0.5 h-5 w-5 shrink-0" />

            <div>
              <p className="text-sm font-semibold">
                Settings updated
              </p>
              <p className="mt-1 text-sm">
                {success}
              </p>
            </div>
          </div>
        )}

        {/* Unsaved changes banner */}
        {hasChanges && (
          <div className="mb-5 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

              <div>
                <p className="text-sm font-semibold text-amber-900">
                  You have unsaved changes
                </p>

                <p className="mt-1 text-sm text-amber-800">
                  {changedKeys.length} setting
                  {changedKeys.length === 1
                    ? ""
                    : "s"}{" "}
                  {changedKeys.length === 1
                    ? "has"
                    : "have"}{" "}
                  been changed.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                void handleSave()
              }
              disabled={saving}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-700 px-3 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Save now
            </button>
          </div>
        )}

        {/* Settings */}
        <div className="space-y-5">
          {SETTING_GROUPS.map(
            (group) => {
              const GroupIcon =
                group.icon;

              const groupDefinitions =
                group.keys
                  .map((key) =>
                    definitions.find(
                      (definition) =>
                        definition.key ===
                        key,
                    ),
                  )
                  .filter(
                    (
                      definition,
                    ): definition is SystemSettingDefinition =>
                      Boolean(
                        definition,
                      ),
                  );

              if (
                groupDefinitions.length ===
                0
              ) {
                return null;
              }

              const isExpanded =
                expandedGroups[
                  group.title
                ] ?? true;

              return (
                <section
                  key={group.title}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() =>
                      toggleGroup(
                        group.title,
                      )
                    }
                    className="flex w-full items-start gap-4 p-5 text-left transition hover:bg-slate-50 sm:p-6"
                    aria-expanded={
                      isExpanded
                    }
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                      <GroupIcon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900">
                          {group.title}
                        </h2>

                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                          {
                            groupDefinitions.length
                          }{" "}
                          setting
                          {groupDefinitions.length ===
                          1
                            ? ""
                            : "s"}
                        </span>
                      </div>

                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        {
                          group.description
                        }
                      </p>
                    </div>

                    <span className="mt-1 text-xs font-semibold text-slate-400">
                      {isExpanded
                        ? "Hide"
                        : "Show"}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-100 p-4 sm:p-6">
                      <div className="space-y-3">
                        {groupDefinitions.map(
                          renderSetting,
                        )}
                      </div>
                    </div>
                  )}
                </section>
              );
            },
          )}
        </div>

        {/* Working days summary */}
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <CalendarDays className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900">
                Working-day summary
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                These settings determine which
                weekdays are treated as working days
                by the leave calculation workflow.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {[
              ["Mon", "working_days_monday"],
              ["Tue", "working_days_tuesday"],
              ["Wed", "working_days_wednesday"],
              ["Thu", "working_days_thursday"],
              ["Fri", "working_days_friday"],
              ["Sat", "working_days_saturday"],
              ["Sun", "working_days_sunday"],
            ].map(
              ([label, key]) => {
                const active =
                  values[key] === true;

                return (
                  <div
                    key={key}
                    className={`rounded-lg border p-3 text-center ${
                      active
                        ? "border-slate-300 bg-slate-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {label}
                    </p>

                    <div
                      className={`mx-auto mt-2 flex h-7 w-7 items-center justify-center rounded-full ${
                        active
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {active ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <span className="text-xs">
                          —
                        </span>
                      )}
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </section>

        {/* Security information */}
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Clock3 className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900">
                Session security
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Session timeout controls how long an
                authenticated session can remain valid.
                Changes apply through the backend
                authentication policy.
              </p>

              <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                <Bell className="h-4 w-4" />

                <span>
                  Current timeout:
                </span>

                <strong className="text-slate-900">
                  {String(
                    values[
                      "session_timeout_minutes"
                    ] ??
                      480,
                  )}{" "}
                  minutes
                </strong>
              </div>
            </div>
          </div>
        </section>

        {/* Reset */}
        <section className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-red-600 shadow-sm">
                <RotateCcw className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-base font-bold text-red-900">
                  Reset system settings
                </h2>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-red-800">
                  Remove organization-specific setting
                  overrides and restore the configured
                  default values.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={
                resetting ||
                saving
              }
              onClick={() =>
                void handleReset()
              }
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resetting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}

              {resetting
                ? "Resetting..."
                : "Reset settings"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}