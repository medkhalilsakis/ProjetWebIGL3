import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import * as L from 'leaflet';

interface City {
  id: string;
  name: string;
  coords: [number, number];
  population: string;
  active: boolean;
  color?: string;
}

interface CartItem {
  product: {
    id?: string;
    nom: string;
    prix: number;
    prix_promotion?: number;
  };
  quantity: number;
}

@Component({
  selector: 'app-accueil',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, RouterLink],
  templateUrl: './accueil.html',
  styleUrls: ['./accueil.css'],
})
export class Accueil implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef<HTMLDivElement>;
  private router = inject(Router);
  private map: L.Map | null = null;
  private markers: L.Marker[] = [];
  private polygons: L.Polygon[] = [];
  private cartKey = 'lx_cart';

  services = [
    { 
      id: 'restaurants', 
      icon: 'restaurant', 
      title: 'Restaurants', 
      description: 'Découvrez nos restaurants partenaires et commandez vos plats préférés' 
    },
    { 
      id: 'courses', 
      icon: 'local_grocery_store', 
      title: 'Courses', 
      description: 'Livraison de vos courses quotidiennes en moins de 30 minutes' 
    },
    { 
      id: 'pharmacies', 
      icon: 'local_pharmacy', 
      title: 'Pharmacies', 
      description: 'Produits de santé et médicaments livrés à domicile' 
    },
    { 
      id: 'fleurs', 
      icon: 'local_florist', 
      title: 'Fleurs & Cadeaux', 
      description: 'Bouquets et cadeaux pour toutes vos occasions spéciales' 
    }
  ];

  features = [
    { 
      icon: 'schedule', 
      title: 'Livraison Rapide', 
      description: 'Recevez vos commandes en moyenne sous 25 minutes' 
    },
    { 
      icon: 'verified_user', 
      title: 'Livreurs Vérifiés', 
      description: 'Tous nos livreurs sont vérifiés et professionnels' 
    },
    { 
      icon: 'payment', 
      title: 'Paiement Flexible', 
      description: 'Payez par carte bancaire, espèces ou mobile money' 
    },
    { 
      icon: 'support_agent', 
      title: 'Support 24/7', 
      description: 'Notre équipe est disponible pour vous assister à tout moment' 
    },
    { 
      icon: 'track_changes', 
      title: 'Suivi en Temps Réel', 
      description: 'Suivez votre commande en direct sur la carte' 
    },
    { 
      icon: 'star', 
      title: 'Satisfaction Garantie', 
      description: '98% de nos clients sont satisfaits de nos services' 
    }
  ];

  testimonials = [
    { 
      id: 1, 
      name: 'Ahmed Khalil', 
      role: 'Client régulier', 
      text: 'Service impeccable, livraison toujours à l\'heure. L\'application est très facile à utiliser et les livreurs sont professionnels. Je recommande vivement !', 
      rating: 5 
    },
    { 
      id: 2, 
      name: 'Sophie Martinez', 
      role: 'Restauratrice', 
      text: 'Depuis que j\'ai rejoint LivraXpress, mon chiffre d\'affaires a augmenté de 40%. La plateforme est intuitive et le support client est réactif.', 
      rating: 5 
    },
    { 
      id: 3, 
      name: 'Youssef Ben Ali', 
      role: 'Livreur partenaire', 
      text: 'Application facile à utiliser, planning flexible qui me permet de gérer mon temps et paiements toujours réguliers. Excellent pour gagner un revenu supplémentaire.', 
      rating: 5 
    }
  ];

  deliveryZones: City[] = [
    { 
      id: 'tunis', 
      name: 'Tunis', 
      coords: [36.8065, 10.1815], 
      population: '2.7M', 
      active: true,
      color: '#10b981'
    },
    { 
      id: 'ariana', 
      name: 'Ariana', 
      coords: [36.8611, 10.1917], 
      population: '580K', 
      active: true,
      color: '#10b981'
    },
    { 
      id: 'ben-arous', 
      name: 'Ben Arous', 
      coords: [36.7531, 10.2139], 
      population: '630K', 
      active: true,
      color: '#10b981'
    },
    { 
      id: 'nabeul', 
      name: 'Nabeul', 
      coords: [36.4594, 10.7269], 
      population: '85K', 
      active: true,
      color: '#10b981'
    },
    { 
      id: 'sousse', 
      name: 'Sousse', 
      coords: [35.8245, 10.6348], 
      population: '640K', 
      active: true,
      color: '#10b981'
    },
    { 
      id: 'sfax', 
      name: 'Sfax', 
      coords: [34.7406, 10.7603], 
      population: '955K', 
      active: true,
      color: '#10b981'
    }
  ];

  currentCity: City | null = null;
  hoveredCity: City | null = null;
  cart: CartItem[] = [];
  showCartPanel = false;

  ngOnInit(): void {
    this.loadCart();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initMap();
    }, 100);
  }

  ngOnDestroy(): void {
    this.cleanupMap();
    this.cleanupGlobalFunction();
  }

  private cleanupMap(): void {
    if (this.map) {
      this.markers.forEach(marker => marker.remove());
      this.polygons.forEach(polygon => polygon.remove());
      this.markers = [];
      this.polygons = [];
      this.map.remove();
      this.map = null;
    }
  }

  private cleanupGlobalFunction(): void {
    if (typeof window !== 'undefined' && (window as any).openCityDetails) {
      try { 
        delete (window as any).openCityDetails; 
      } catch { 
        (window as any).openCityDetails = undefined; 
      }
    }
  }

  // ---------- Cart (display only) ----------
  cartTotal(): number {
    return this.cart.reduce((sum, item) => {
      const price = item.product.prix_promotion || item.product.prix;
      return sum + price * item.quantity;
    }, 0);
  }

  get cartCount(): number {
    return this.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  checkoutCart(): void {
    this.router.navigate(['/login'], { queryParams: { redirectTo: '/client/dashboard' } });
  }

  toggleCartPanel(): void {
    this.showCartPanel = !this.showCartPanel;
  }

  private loadCart(): void {
    try {
      const raw = localStorage.getItem(this.cartKey);
      if (raw) this.cart = JSON.parse(raw);
    } catch {
      this.cart = [];
    }
  }

  initMap(): void {
    if (!this.mapContainer?.nativeElement || this.map) return;

    this.map = L.map(this.mapContainer.nativeElement, {
      center: [35.5, 10.0],
      zoom: 7.5,
      scrollWheelZoom: true,
      dragging: true,
      zoomControl: true,
      minZoom: 7,
      maxZoom: 10
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.map.zoomControl.setPosition('bottomright');

    this.addTunisiaOutline();
    this.addDeliveryZonesMarkers();
    this.addLegend();
    this.setupGlobalFunctions();
  }

  private addDeliveryZonesMarkers(): void {
    this.deliveryZones.forEach(city => {
      const marker = L.marker(city.coords, {
        icon: L.divIcon({
          className: 'custom-marker',
          html: this.getMarkerHtml(city),
          iconSize: [50, 50],
          iconAnchor: [25, 50],
          popupAnchor: [0, -50]
        })
      }).addTo(this.map!);

      marker.bindPopup(this.getPopupContent(city), {
        className: 'city-popup-container',
        closeButton: true,
        autoClose: true,
        maxWidth: 300
      });

      marker.on('click', () => {
        marker.openPopup();
      });

      this.markers.push(marker);
    });
  }

  private getMarkerHtml(city: City): string {
    return `
      <div class="marker-container ${city.active ? 'active' : 'inactive'}">
        <div class="marker-pulse"></div>
        <div class="marker-icon">
          <span class="marker-text">${city.name.charAt(0)}</span>
        </div>
        <div class="marker-label">${city.name}</div>
      </div>
    `;
  }

  private getPopupContent(city: City): string {
    return `
      <div class="city-popup">
        <div class="popup-header">
          <h3 class="popup-title">${city.name}</h3>
          <span class="popup-badge ${city.active ? 'active' : 'inactive'}">
            ${city.active ? '✓ Service Actif' : 'Bientôt'}
          </span>
        </div>
        <div class="popup-stats">
          <div class="stat-item">
            <div class="stat-icon">👥</div>
            <div class="stat-info">
              <span class="stat-value">${city.population}</span>
              <span class="stat-label">habitants</span>
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-icon">⚡</div>
            <div class="stat-info">
              <span class="stat-value">~25 min</span>
              <span class="stat-label">livraison</span>
            </div>
          </div>
        </div>
        <div class="popup-services">
          <div class="service-icon">🍔</div>
          <div class="service-icon">🛒</div>
          <div class="service-icon">💊</div>
          <div class="service-icon">💐</div>
        </div>
        <button class="popup-button" onclick="window.openCityDetails('${city.id}')">
          <span>Voir les détails</span>
          <span class="button-arrow">→</span>
        </button>
      </div>
    `;
  }

  private addTunisiaOutline(): void {
    const tunisiaCoords: L.LatLngExpression[] = [
      [37.3565, 9.4433], [37.2744, 9.8739], [37.0578, 10.1553], 
      [36.9515, 10.2211], [36.8876, 10.2760], [36.8611, 10.1917], 
      [36.8065, 10.1815], [36.7531, 10.2139], [36.4069, 10.1431], 
      [36.1029, 10.0552], [35.8380, 10.3205], [35.7767, 10.8272],
      [35.6327, 10.9591], [35.3625, 11.0250], [34.7406, 10.7603], 
      [34.3339, 10.5511], [33.8869, 10.0982], [33.7674, 10.0433], 
      [33.6256, 10.0872], [33.5245, 10.4380], [33.1363, 11.1505], 
      [33.0953, 11.4353], [33.2081, 11.6549], [33.3672, 11.5671],
      [33.8075, 10.8481], [34.1457, 10.2760], [34.7406, 9.9133], 
      [35.7767, 9.8739], [36.2543, 9.6066], [36.6894, 9.4433], 
      [37.0578, 9.3884], [37.3565, 9.4433]
    ];

    const polygon = L.polygon(tunisiaCoords, {
      color: '#3b82f6',
      weight: 3,
      fillOpacity: 0.05,
      fillColor: '#3b82f6',
      smoothFactor: 1
    }).addTo(this.map!);

    this.polygons.push(polygon);
  }

  private addLegend(): void {
    const legend = new L.Control({ position: 'bottomleft' });
    
    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'map-legend');
      div.innerHTML = `
        <div class="legend-title">🗺️ Zones de livraison</div>
        <div class="legend-content">
          <div class="legend-item">
            <div class="legend-marker active"></div>
            <span>Service actif (${this.deliveryZones.filter(c => c.active).length} villes)</span>
          </div>
          <div class="legend-item">
            <div class="legend-marker inactive"></div>
            <span>Bientôt disponible</span>
          </div>
        </div>
      `;
      return div;
    };
    
    legend.addTo(this.map!);
  }

  private setupGlobalFunctions(): void {
    if (typeof window !== 'undefined') {
      (window as any).openCityDetails = (cityId: string) => {
        const city = this.deliveryZones.find(c => c.id === cityId);
        if (city) {
          this.openCityDetails(city);
        }
      };
    }
  }

  openCityDetails(city: City): void {
    this.currentCity = city;
    document.body.style.overflow = 'hidden';
  }

  closeCityDetails(): void {
    this.currentCity = null;
    document.body.style.overflow = 'auto';
  }

  goToSignup(): void {
    this.router.navigate(['/register']);
  }

  goToSignin(): void {
    this.router.navigate(['/login']);
  }

  viewService(serviceId: string): void {
    this.router.navigate(['/services', serviceId]);
  }

  trackByService(index: number, item: any): any {
    return item?.id || index;
  }

  trackByFeature(index: number, item: any): any {
    return item?.title || index;
  }

  trackByTestimonial(index: number, item: any): any {
    return item?.id || index;
  }

  trackByCity(index: number, item: any): any {
    return item?.id || index;
  }
}