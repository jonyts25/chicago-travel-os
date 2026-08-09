"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  getPushSubscriptionStatusAction,
  savePushSubscriptionAction,
} from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorMessage } from "@/components/ui/error-message";
import { useToast } from "@/components/ui/toast-provider";
import {
  getServiceWorkerRegistration,
  isPushSupported,
  serializePushSubscription,
  urlBase64ToUint8Array,
} from "@/lib/push/client";
import { typography } from "@/lib/ui/styles";

type PushNotificationsPanelProps = {
  vapidPublicKey: string | null;
};

export function PushNotificationsPanel({ vapidPublicKey }: PushNotificationsPanelProps) {
  const { showToast } = useToast();
  const [supported] = useState(() => isPushSupported());
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [technicalError, setTechnicalError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const autoSubscribeAttempted = useRef(false);

  const subscribeToPush = useCallback(async () => {
    if (!supported) {
      return;
    }

    if (!vapidPublicKey?.trim()) {
      setTechnicalError("NEXT_PUBLIC_VAPID_PUBLIC_KEY no está configurada.");
      return;
    }

    setTechnicalError(null);

    const nextPermission =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;

    setPermission(nextPermission);

    if (nextPermission !== "granted") {
      setTechnicalError("Permiso de notificaciones denegado.");
      return;
    }

    const registration = await getServiceWorkerRegistration();
    if (!registration) {
      setTechnicalError("No se pudo registrar el service worker.");
      return;
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
    }

    const serialized = serializePushSubscription(subscription);
    if (!serialized) {
      setTechnicalError("No se pudo serializar la suscripción push.");
      return;
    }

    const saveResult = await savePushSubscriptionAction(serialized);
    if (!saveResult.ok) {
      setTechnicalError(saveResult.error);
      return;
    }

    setHasSubscription(true);
    showToast("Notificaciones push activadas");
  }, [showToast, supported, vapidPublicKey]);

  useEffect(() => {
    if (!supported) {
      return;
    }

    setPermission(Notification.permission);

    startTransition(async () => {
      const result = await getPushSubscriptionStatusAction();
      if (!result.ok) {
        setTechnicalError(result.error);
        return;
      }

      setHasSubscription(result.hasSubscription);

      if (
        !autoSubscribeAttempted.current &&
        !result.hasSubscription &&
        Notification.permission === "default"
      ) {
        autoSubscribeAttempted.current = true;
        await subscribeToPush();
      }
    });
  }, [subscribeToPush, supported]);

  if (!supported) {
    return (
      <Card className="mt-6" title="Notificaciones push">
        <p className={typography.secondary}>
          Este navegador no soporta notificaciones push o service workers.
        </p>
      </Card>
    );
  }

  return (
    <Card
      className="mt-6"
      title="Notificaciones push"
      subtitle="Te recordaremos confirmar el late check-in del hotel hasta que lo marques en el toggle de arriba."
    >
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <dt className={typography.secondary}>Permiso del navegador</dt>
          <dd className={`${typography.body} font-medium text-white`}>
            {permission ?? "—"}
          </dd>
        </div>
        <div>
          <dt className={typography.secondary}>Suscripción guardada</dt>
          <dd className={`${typography.body} font-medium text-white`}>
            {hasSubscription == null ? "Verificando…" : hasSubscription ? "Sí" : "No"}
          </dd>
        </div>
      </dl>

      {!hasSubscription ? (
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            loading={isPending}
            onClick={() => startTransition(subscribeToPush)}
          >
            Activar notificaciones
          </Button>
        </div>
      ) : null}

      {technicalError ? (
        <ErrorMessage
          className="mt-4"
          message="No se pudieron activar las notificaciones."
          technicalDetails={technicalError}
        />
      ) : null}
    </Card>
  );
}
