"use client";

import { useMemo, useState } from "react";

type AccountProfile = {
  description: string;
  phone: string;
  email: string;
  address: string;
  websiteUrl: string;
  instagramUrl: string;
  whatsappUrl: string;
  telegramUrl: string;
  maxUrl: string;
  vkUrl: string;
  viberUrl: string;
  pinterestUrl: string;
};

type AccountInfo = {
  id: number;
  name: string;
  slug: string;
  timeZone: string;
  publicSlug: string | null;
};

type UserInfo = {
  id: number;
  email: string;
  roleId: number | null;
};

type BrandingInfo = {
  logoUrl: string | null;
  coverUrl: string | null;
  logoLinkId: number | null;
  coverLinkId: number | null;
};

type RoleInfo = {
  id: number;
  name: string;
  permissionKeys: string[];
};

type PermissionInfo = {
  key: string;
  description: string | null;
};

type AccountProfileClientProps = {
  account: AccountInfo;
  user: UserInfo;
  profile: AccountProfile;
  branding: BrandingInfo;
  roles: RoleInfo[];
  permissions: PermissionInfo[];
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Владелец",
  MANAGER: "Менеджер",
  SPECIALIST: "Специалист",
  READONLY: "Только просмотр",
};

const GROUP_LABELS: Record<string, string> = {
  all: "Полный доступ",
  locations: "Локации",
  services: "Услуги",
  specialists: "Специалисты",
  schedule: "График",
  calendar: "Журнал",
  appointments: "Записи",
  clients: "Клиенты",
  payments: "Оплаты",
  promos: "Промо",
  loyalty: "Лояльность",
  analytics: "Аналитика",
  settings: "Настройки",
  other: "Прочее",
};

export default function AccountProfileClient({
  account,
  user,
  profile: initialProfile,
  branding: initialBranding,
  roles,
  permissions,
}: AccountProfileClientProps) {
  const [activeTab, setActiveTab] = useState<
    "general" | "branding" | "profile" | "access"
  >("general");
  const [profile, setProfile] = useState<AccountProfile>(initialProfile);
  const [branding, setBranding] = useState<BrandingInfo>(initialBranding);
  const [accountName, setAccountName] = useState(account.name);
  const [timeZone, setTimeZone] = useState(account.timeZone);
  const [userEmail, setUserEmail] = useState(user.email);
  const [userRoleId] = useState<number | null>(user.roleId ?? null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeRoleId, setActiveRoleId] = useState<number | null>(
    roles[0]?.id ?? null
  );
  const [roleState, setRoleState] = useState<Record<number, string[]>>(() => {
    const map: Record<number, string[]> = {};
    roles.forEach((role) => {
      map[role.id] = [...role.permissionKeys];
    });
    return map;
  });

  const permissionsByGroup = useMemo(() => {
    const groups: Record<string, PermissionInfo[]> = {};
    permissions.forEach((permission) => {
      const segments = permission.key.split(".");
      const prefix = segments.length > 1 ? segments[1] : "other";
      const key = GROUP_LABELS[prefix] ? prefix : "other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(permission);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  const publicUrl = account.publicSlug ? `/${account.publicSlug}` : null;
  const bookingUrl = account.publicSlug
    ? `/${account.publicSlug}/booking`
    : null;

  const timeZones = useMemo(
    () => [
      "Europe/Moscow",
      "UTC",
      "Europe/Kaliningrad",
      "Europe/Samara",
      "Europe/Volgograd",
      "Asia/Yekaterinburg",
      "Asia/Novosibirsk",
      "Asia/Krasnoyarsk",
      "Asia/Irkutsk",
      "Asia/Yakutsk",
      "Asia/Vladivostok",
      "Asia/Magadan",
      "Asia/Kamchatka",
      "Asia/Yuzhno-Sakhalinsk",
      "Europe/Kiev",
      "Europe/Minsk",
      "Europe/Riga",
      "Europe/Vilnius",
      "Europe/Tallinn",
      "Europe/Warsaw",
      "Europe/Berlin",
      "Europe/Paris",
      "Europe/London",
      "Asia/Tbilisi",
      "Asia/Baku",
      "Asia/Almaty",
      "Asia/Bishkek",
      "Asia/Tashkent",
      "Asia/Dubai",
      "Asia/Seoul",
      "Asia/Tokyo",
    ],
    []
  );

  const saveProfile = async () => {
    setSaving("profile");
    setMessage(null);
    const response = await fetch("/api/v1/crm/settings/account-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    if (response.ok) {
      const data = await response.json();
      setProfile(data.data);
      setMessage("Профиль аккаунта сохранен.");
    } else {
      setMessage("Не удалось сохранить профиль.");
    }
    setSaving(null);
  };

  const saveAccount = async () => {
    setSaving("account");
    setMessage(null);
    const response = await fetch("/api/v1/crm/settings/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: accountName.trim(), timeZone }),
    });
    if (response.ok) {
      const data = await response.json();
      setAccountName(data.data.name);
      if (data.data.timeZone) {
        setTimeZone(data.data.timeZone);
      }
      setMessage("Данные аккаунта сохранены.");
    } else {
      setMessage("Не удалось сохранить данные аккаунта.");
    }
    setSaving(null);
  };

  const saveUserAccess = async () => {
    setSaving("user");
    setMessage(null);
    if (!userEmail.trim()) {
      setMessage("Укажите email для входа.");
      setSaving(null);
      return;
    }
    if (password && password.length < 6) {
      setMessage("Пароль должен быть не короче 6 символов.");
      setSaving(null);
      return;
    }
    if (password && password !== passwordConfirm) {
      setMessage("Пароли не совпадают.");
      setSaving(null);
      return;
    }
    if (!userRoleId) {
      setMessage("Не удалось определить роль пользователя.");
      setSaving(null);
      return;
    }

    const response = await fetch("/api/v1/crm/settings/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: userEmail.trim(),
        roleId: userRoleId,
        password: password || undefined,
      }),
    });
    if (response.ok) {
      const data = await response.json();
      setUserEmail(data.data.email ?? userEmail);
      setPassword("");
      setPasswordConfirm("");
      setMessage("Доступы пользователя обновлены.");
    } else {
      const body = await response.json().catch(() => null);
      setMessage(body?.error?.message ?? "Не удалось сохранить доступы.");
    }
    setSaving(null);
  };

  const uploadMedia = async (type: "logo" | "cover", file: File) => {
    setSaving(type);
    setMessage(null);
    const formData = new FormData();
    formData.append("type", type);
    formData.append("file", file);
    const response = await fetch("/api/v1/crm/account/media", {
      method: "POST",
      body: formData,
    });
    if (response.ok) {
      const data = await response.json();
      setBranding((prev) =>
        type === "logo"
          ? {
              ...prev,
              logoUrl: data.data.url,
              logoLinkId: data.data.id,
            }
          : {
              ...prev,
              coverUrl: data.data.url,
              coverLinkId: data.data.id,
            }
      );
      setMessage(type === "logo" ? "Логотип обновлен." : "Обложка обновлена.");
    } else {
      setMessage("Не удалось загрузить изображение.");
    }
    setSaving(null);
  };

  const removeMedia = async (type: "logo" | "cover") => {
    const linkId =
      type === "logo" ? branding.logoLinkId : branding.coverLinkId;
    if (!linkId) return;
    setSaving(`remove-${type}`);
    setMessage(null);
    const response = await fetch(`/api/v1/crm/account/media/${linkId}`, {
      method: "DELETE",
    });
    if (response.ok) {
      setBranding((prev) =>
        type === "logo"
          ? { ...prev, logoUrl: null, logoLinkId: null }
          : { ...prev, coverUrl: null, coverLinkId: null }
      );
      setMessage(type === "logo" ? "Логотип удален." : "Обложка удалена.");
    } else {
      setMessage("Не удалось удалить изображение.");
    }
    setSaving(null);
  };

  const togglePermission = (roleId: number, key: string) => {
    setRoleState((prev) => {
      const current = new Set(prev[roleId] ?? []);
      if (current.has(key)) {
        current.delete(key);
      } else {
        current.add(key);
      }
      return { ...prev, [roleId]: Array.from(current) };
    });
  };

  const saveRolePermissions = async (roleId: number) => {
    setSaving(`role-${roleId}`);
    setMessage(null);
    const response = await fetch("/api/v1/crm/settings/permissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roleId,
        permissionKeys: roleState[roleId] ?? [],
      }),
    });
    if (response.ok) {
      setMessage("Доступы обновлены.");
    } else {
      setMessage("Не удалось сохранить доступы.");
    }
    setSaving(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {message && (
        <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          { key: "general", label: "Общее" },
          { key: "branding", label: "Брендинг" },
          { key: "profile", label: "Профиль" },
          { key: "access", label: "Доступы" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${
              activeTab === tab.key
                ? "bg-[color:var(--bp-ink)] text-white"
                : "border border-[color:var(--bp-stroke)] bg-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "general" && (
        <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Данные аккаунта</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            Название
            <input
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Часовой пояс
            <select
              value={timeZone}
              onChange={(event) => setTimeZone(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
            >
              {timeZones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm md:col-span-2">
            Публичная ссылка
            <input
              value={publicUrl ?? "Публичная ссылка не задана"}
              readOnly
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] px-3 py-2 text-[color:var(--bp-muted)]"
            />
          </label>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            {publicUrl ? (
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-[color:var(--bp-stroke)] bg-white px-4 py-2 text-sm"
              >
                Открыть сайт
              </a>
            ) : (
              <div className="text-xs text-[color:var(--bp-muted)]">
                Публичная ссылка не настроена.
              </div>
            )}
            {bookingUrl ? (
              <a
                href={bookingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-[color:var(--bp-stroke)] bg-white px-4 py-2 text-sm"
              >
                Открыть онлайн‑запись
              </a>
            ) : null}
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={saveAccount}
            className="rounded-2xl bg-[color:var(--bp-accent)] px-5 py-2 text-sm font-semibold text-white"
            disabled={saving === "account"}
          >
            {saving === "account" ? "Сохранение..." : "Сохранить"}
          </button>
        </div>

        <div className="mt-8 border-t border-[color:var(--bp-stroke)] pt-6">
          <h3 className="text-base font-semibold">Доступ к аккаунту</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              Email для входа
              <input
                value={userEmail}
                onChange={(event) => setUserEmail(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </label>
            <div className="hidden md:block" />
            <label className="text-sm">
              Новый пароль
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Минимум 6 символов"
                className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Повторите пароль
              <input
                type="password"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </label>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={saveUserAccess}
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-5 py-2 text-sm font-semibold"
              disabled={saving === "user"}
            >
              {saving === "user" ? "Сохранение..." : "Сохранить доступ"}
            </button>
          </div>
        </div>
        </section>
      )}

      {activeTab === "branding" && (
        <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Брендинг</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--bp-stroke)] bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Логотип</div>
              {branding.logoUrl ? (
                <button
                  type="button"
                  onClick={() => removeMedia("logo")}
                  className="text-xs text-red-600"
                  disabled={saving === "remove-logo"}
                >
                  Удалить
                </button>
              ) : null}
            </div>
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt=""
                className="h-24 w-24 rounded-xl object-cover"
              />
            ) : (
              <div className="h-24 w-24 rounded-xl border border-dashed border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)]" />
            )}
            <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] px-3 py-2 text-xs">
              {saving === "logo" ? "Загрузка..." : "Загрузить"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadMedia("logo", file);
                }}
              />
            </label>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--bp-stroke)] bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Обложка</div>
              {branding.coverUrl ? (
                <button
                  type="button"
                  onClick={() => removeMedia("cover")}
                  className="text-xs text-red-600"
                  disabled={saving === "remove-cover"}
                >
                  Удалить
                </button>
              ) : null}
            </div>
            {branding.coverUrl ? (
              <img
                src={branding.coverUrl}
                alt=""
                className="h-24 w-full rounded-xl object-cover"
              />
            ) : (
              <div className="h-24 w-full rounded-xl border border-dashed border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)]" />
            )}
            <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] px-3 py-2 text-xs">
              {saving === "cover" ? "Загрузка..." : "Загрузить"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadMedia("cover", file);
                }}
              />
            </label>
          </div>
        </div>
        </section>
      )}

      {activeTab === "profile" && (
        <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Профиль аккаунта</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            Описание
            <textarea
              value={profile.description}
              onChange={(event) =>
                setProfile((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              placeholder="Например: Салон красоты полного цикла, работаем ежедневно с 10:00 до 20:00."
              rows={4}
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Телефон
            <input
              value={profile.phone}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, phone: event.target.value }))
              }
              placeholder="+7 999 000-00-00"
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Email
            <input
              value={profile.email}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, email: event.target.value }))
              }
              placeholder="contact@beauty.local"
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
            />
          </label>
          <label className="text-sm md:col-span-2">
            Адрес
            <input
              value={profile.address}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, address: event.target.value }))
              }
              placeholder="г. Москва, ул. Примерная, 12"
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Сайт
            <div className="mt-2 flex items-center gap-2">
              <img src="/assets/socials/website.png" alt="" className="h-6 w-6" />
              <input
                value={profile.websiteUrl}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    websiteUrl: event.target.value,
                  }))
                }
                placeholder="example.ru"
                className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </div>
          </label>
          <label className="text-sm">
            Instagram
            <div className="mt-2 flex items-center gap-2">
              <img src="/assets/socials/instagram.png" alt="" className="h-6 w-6" />
              <input
                value={profile.instagramUrl}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    instagramUrl: event.target.value,
                  }))
                }
                placeholder="username"
                className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </div>
          </label>
          <label className="text-sm">
            WhatsApp
            <div className="mt-2 flex items-center gap-2">
              <img src="/assets/socials/whatsapp.png" alt="" className="h-6 w-6" />
              <input
                value={profile.whatsappUrl}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    whatsappUrl: event.target.value,
                  }))
                }
                placeholder="79990001122"
                className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </div>
          </label>
          <label className="text-sm">
            Telegram
            <div className="mt-2 flex items-center gap-2">
              <img src="/assets/socials/telegram.png" alt="" className="h-6 w-6" />
              <input
                value={profile.telegramUrl}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    telegramUrl: event.target.value,
                  }))
                }
                placeholder="username"
                className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </div>
          </label>
          <label className="text-sm">
            MAX
            <div className="mt-2 flex items-center gap-2">
              <img src="/assets/socials/max.png" alt="" className="h-6 w-6" />
              <input
                value={profile.maxUrl}
                onChange={(event) =>
                  setProfile((prev) => ({ ...prev, maxUrl: event.target.value }))
                }
                placeholder="username"
                className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </div>
          </label>
          <label className="text-sm">
            VK
            <div className="mt-2 flex items-center gap-2">
              <img src="/assets/socials/vk.png" alt="" className="h-6 w-6" />
              <input
                value={profile.vkUrl}
                onChange={(event) =>
                  setProfile((prev) => ({ ...prev, vkUrl: event.target.value }))
                }
                placeholder="username"
                className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </div>
          </label>
          <label className="text-sm">
            Viber
            <div className="mt-2 flex items-center gap-2">
              <img src="/assets/socials/viber.png" alt="" className="h-6 w-6" />
              <input
                value={profile.viberUrl}
                onChange={(event) =>
                  setProfile((prev) => ({ ...prev, viberUrl: event.target.value }))
                }
                placeholder="79990001122"
                className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </div>
          </label>
          <label className="text-sm">
            Pinterest
            <div className="mt-2 flex items-center gap-2">
              <img src="/assets/socials/pinterest.png" alt="" className="h-6 w-6" />
              <input
                value={profile.pinterestUrl}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    pinterestUrl: event.target.value,
                  }))
                }
                placeholder="username"
                className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </div>
          </label>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={saveProfile}
            className="rounded-2xl bg-[color:var(--bp-accent)] px-5 py-2 text-sm font-semibold text-white"
            disabled={saving === "profile"}
          >
            {saving === "profile" ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
        </section>
      )}

      {activeTab === "access" && (
        <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Доступы</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => setActiveRoleId(role.id)}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${
                activeRoleId === role.id
                  ? "bg-[color:var(--bp-ink)] text-white"
                  : "border border-[color:var(--bp-stroke)] bg-white"
              }`}
            >
              {ROLE_LABELS[role.name] ?? role.name}
            </button>
          ))}
        </div>

        {roles.map((role) =>
          role.id === activeRoleId ? (
            <div
              key={role.id}
              className="mt-4 rounded-2xl border border-[color:var(--bp-stroke)] bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">
                  {ROLE_LABELS[role.name] ?? role.name}
                </div>
                <button
                  type="button"
                  onClick={() => saveRolePermissions(role.id)}
                  className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-1 text-xs"
                  disabled={saving === `role-${role.id}`}
                >
                  {saving === `role-${role.id}` ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {permissionsByGroup.map(([group, items]) => (
                  <div
                    key={group}
                    className="rounded-xl border border-[color:var(--bp-stroke)] p-3"
                  >
                    <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
                      {GROUP_LABELS[group] ?? group}
                    </div>
                    <div className="mt-3 flex flex-col gap-2 text-sm">
                      {items.map((permission) => {
                        const checked = (roleState[role.id] ?? []).includes(
                          permission.key
                        );
                        return (
                          <label
                            key={permission.key}
                            className="flex items-start gap-2"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                togglePermission(role.id, permission.key)
                              }
                            />
                            <span>
                              {permission.description ?? permission.key}
                              {permission.description ? null : (
                                <span className="block text-xs text-[color:var(--bp-muted)]">
                                  {permission.key}
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null
        )}
        </section>
      )}
    </div>
  );
}
