/* Logística & Eventos · notificaciones web v3.14.0 */
importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js");

firebase.initializeApp({
  apiKey: "AIzaSyAD_FPhpmmbuvnXUxKVlNpENdViPTIBaYU",
  authDomain: "sentinels-web.firebaseapp.com",
  projectId: "sentinels-web",
  storageBucket: "sentinels-web.firebasestorage.app",
  messagingSenderId: "565758042156",
  appId: "1:565758042156:web:2f63fe53f974acc43af189"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const datos = payload && payload.data ? payload.data : {};
  const titulo = String(datos.title || "Nuevo comunicado").slice(0, 120);
  const cuerpo = String(datos.body || "Entra a la página para ver la información.").slice(0, 300);
  const url = String(datos.url || new URL("./", self.registration.scope).href);
  const tag = String(datos.tag || datos.comunicadoId || "logistica-eventos-comunicado");

  return self.registration.showNotification(titulo, {
    body: cuerpo,
    icon: "./assets/notificacion-192.png",
    badge: "./assets/notificacion-96.png",
    tag,
    renotify: true,
    data: { url },
    actions: [{ action:"ver", title:"Ver comunicado" }]
  });
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const destino = event.notification && event.notification.data
    ? event.notification.data.url
    : new URL("./", self.registration.scope).href;

  event.waitUntil((async () => {
    const ventanas = await clients.matchAll({ type:"window", includeUncontrolled:true });
    for(const ventana of ventanas) {
      if("navigate" in ventana) await ventana.navigate(destino);
      if("focus" in ventana) return ventana.focus();
    }
    return clients.openWindow ? clients.openWindow(destino) : undefined;
  })());
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
