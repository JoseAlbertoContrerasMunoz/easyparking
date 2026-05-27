"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
        });
      });

      caches.keys().then((keys) => {
        keys
          .filter((key) => key.startsWith("easy-parking-"))
          .forEach((key) => {
            caches.delete(key);
          });
      });

      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // La app sigue funcionando aunque el navegador rechace el service worker.
    });
  }, []);

  return null;
}
