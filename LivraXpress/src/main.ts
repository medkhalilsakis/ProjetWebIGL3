import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
if (typeof window !== 'undefined') {
  // Fix pour les icônes Leaflet dans Angular
  const L = (window as any).L;
  if (L && L.Icon) {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: '/assets/leaflet/marker-icon-2x.png',
      iconUrl: '/assets/leaflet/marker-icon.png',
      shadowUrl: '/assets/leaflet/marker-shadow.png',
    });
  }
}
bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
