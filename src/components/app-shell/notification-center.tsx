"use client";

import Link from "next/link";
import { Archive, Bell, CheckCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type NotificationDto = {
  id: string;
  type: string;
  severity: "INFO" | "WARNING" | "ERROR" | "SUCCESS";
  title: string;
  message: string;
  href?: string | null;
  occurredAt: string;
  readAt?: string | null;
};

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/notifications", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Notifications could not be loaded.");
        return body;
      })
      .then((body) => {
        if (!active) return;
        setNotifications(body.notifications);
        setUnreadCount(body.unreadCount);
      })
      .catch(() => {
        if (active) setError("Notifications could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  async function update(id: string, action: "READ" | "UNREAD" | "ARCHIVE") {
    const target = notifications.find((notification) => notification.id === id);
    const response = await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!response.ok) {
      setError("Notification could not be updated.");
      return;
    }
    if (action === "ARCHIVE") {
      setNotifications((current) => current.filter((notification) => notification.id !== id));
    } else {
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id
            ? { ...notification, readAt: action === "READ" ? new Date().toISOString() : null }
            : notification,
        ),
      );
    }
    const delta =
      action === "UNREAD" ? (target?.readAt ? 1 : 0) : target && !target.readAt ? -1 : 0;
    setUnreadCount((current) => Math.max(0, current + delta));
  }

  async function markAllRead() {
    const response = await fetch("/api/notifications", { method: "PATCH" });
    if (!response.ok) {
      setError("Notifications could not be marked read.");
      return;
    }
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((notification) => ({ ...notification, readAt })));
    setUnreadCount(0);
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        className="relative grid h-9 w-9 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface)]"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[var(--amber)] px-1 text-[10px] font-bold leading-4 text-slate-950">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <section
          aria-label="Notification center"
          className="fixed inset-x-3 top-[68px] z-50 max-h-[75vh] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl sm:absolute sm:-right-12 sm:left-auto sm:top-11 sm:w-[420px]"
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div>
              <h2 className="font-semibold">Notifications</h2>
              <p className="text-xs text-[var(--muted)]">Important local workspace events</p>
            </div>
            <div className="flex gap-1">
              {unreadCount ? (
                <button
                  className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)]"
                  aria-label="Mark all notifications read"
                  onClick={markAllRead}
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
              ) : null}
              <button
                className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)]"
                aria-label="Close notifications"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {error ? <p className="px-4 py-3 text-sm text-red-700">{error}</p> : null}
            {!error && notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">You’re caught up.</p>
            ) : null}
            {notifications.map((notification) => (
              <article
                key={notification.id}
                className={cn(
                  "border-b border-[var(--border)] px-4 py-3 last:border-0",
                  !notification.readAt && "bg-[var(--surface-muted)]",
                )}
              >
                <div className="flex gap-3">
                  <span
                    className={cn(
                      "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                      notification.severity === "ERROR" && "bg-red-500",
                      notification.severity === "WARNING" && "bg-amber-500",
                      notification.severity === "SUCCESS" && "bg-emerald-500",
                      notification.severity === "INFO" && "bg-sky-500",
                    )}
                    title={notification.severity.toLowerCase()}
                  />
                  <div className="min-w-0 flex-1">
                    {notification.href ? (
                      <Link
                        href={notification.href}
                        className="font-semibold hover:underline"
                        onClick={() => {
                          if (!notification.readAt) void update(notification.id, "READ");
                          setOpen(false);
                        }}
                      >
                        {notification.title}
                      </Link>
                    ) : (
                      <p className="font-semibold">{notification.title}</p>
                    )}
                    <p className="mt-1 text-sm text-[var(--muted)]">{notification.message}</p>
                    <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
                      <time dateTime={notification.occurredAt}>
                        {new Date(notification.occurredAt).toLocaleString()}
                      </time>
                      <div className="flex gap-1">
                        <button
                          className="rounded px-2 py-1 hover:bg-[var(--surface)]"
                          onClick={() =>
                            update(notification.id, notification.readAt ? "UNREAD" : "READ")
                          }
                        >
                          Mark {notification.readAt ? "unread" : "read"}
                        </button>
                        <button
                          className="rounded p-1 hover:bg-[var(--surface)]"
                          aria-label={`Archive ${notification.title}`}
                          onClick={() => update(notification.id, "ARCHIVE")}
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
