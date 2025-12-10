import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged, switchMap, catchError, of } from 'rxjs';
import { AuthService } from '../services/authentification';

interface Product {
  id: string;
  nom: string;
  description?: string;
  prix: number;
  prix_promotion?: number;
  promotionPercent?: number;
  quantite: number;
  status: string;
  categorie_id: string | null;
  image: string | null;
  fournisseur_id: string;
  fournisseur_nom?: string;
  created_at?: string;
}

interface Category {
  id: string;
  name: string;
  slug?: string;
  image?: string;
  featured?: boolean;
}

interface FilterState {
  search: string;
  categorie_id: string | null;
  prixMin: number | null;
  prixMax: number | null;
  sortBy: 'recent' | 'price_asc' | 'price_desc' | 'popular' | 'promotion';
  showPromotionsOnly: boolean;
}

interface CartItem {
  product: Product;
  quantity: number;
}

@Component({
  selector: 'app-list-produits',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatButtonModule, MatIconModule],
  templateUrl: './list-produits.html',
  styleUrls: ['./list-produits.css']
})
export class ListProduits implements OnInit, OnDestroy {
  private apiUrl = 'http://localhost:3000/api';
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();
  private cartKey = 'lx_cart';

  // Products data
  allProducts: Product[] = [];
  displayedProducts: Product[] = [];
  recommendedProducts: Product[] = [];
  loading = false;
  error: string | null = null;

  // Categories
  categories: Category[] = [];
  selectedCategory: string | null = null;

  // Search & Filters
  searchQuery = '';
  filters: FilterState = {
    search: '',
    categorie_id: null,
    prixMin: null,
    prixMax: null,
    sortBy: 'recent',
    showPromotionsOnly: false
  };

  // Pagination
  currentPage = 1;
  itemsPerPage = 12;
  totalPages = 1;

  get pagesArray(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  // UI State
  showFilters = false;
  viewMode: 'grid' | 'list' = 'grid';

  // Cart
  cart: CartItem[] = [];

  ngOnInit(): void {
    this.loadCart();
    this.loadCategories();
    this.loadProducts();
    this.setupSearchDebounce();
    
    // Check for category filter from route
    this.route.queryParams.subscribe(params => {
      if (params['categorie']) {
        this.filters.categorie_id = params['categorie'];
        this.selectedCategory = params['categorie'];
        this.loadProducts();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchSubject.complete();
  }

  // ---------- Setup Search Debounce ----------
  setupSearchDebounce(): void {
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap((query: string) => {
        this.filters.search = query;
        return this.fetchProducts();
      }),
      catchError(err => {
        console.error('Search error:', err);
        return of({ success: false, data: [] });
      })
    ).subscribe();
  }

  // ---------- Load Categories ----------
  loadCategories(): void {
    this.http.get<{ success: boolean; data: Category[] }>(`${this.apiUrl}/categories`)
      .pipe(
        catchError(err => {
          console.error('Error loading categories:', err);
          return of({ success: false, data: [] });
        })
      )
      .subscribe(res => {
        if (res?.success) {
          this.categories = res.data;
          this.cdr.markForCheck();
        }
      });
  }

  // ---------- Load Products ----------
  loadProducts(): void {
    this.loading = true;
    this.error = null;
    this.fetchProducts().subscribe({
      next: (res) => {
        if (res?.success) {
          this.allProducts = (res.data || []).map((p: any) => ({
            ...p,
            image: this.resolveImage(p.image)
          }));
          this.applyFiltersAndSort();
          this.loadRecommendedProducts();
        } else {
          this.error = 'Impossible de charger les produits';
          this.allProducts = [];
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading products:', err);
        this.error = 'Erreur lors du chargement des produits';
        this.allProducts = [];
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  fetchProducts() {
    const params: any = {
      limit: 200,
      offset: 0
    };

    if (this.filters.categorie_id) {
      params.categorie_id = this.filters.categorie_id;
    }

    if (this.filters.search) {
      params.search = this.filters.search;
    }

    const authOptions = this.auth.getAuthHeaders();
    return this.http.get<{ success: boolean; data: Product[] }>(
      `${this.apiUrl}/produits`,
      { params, ...authOptions }
    );
  }

  // ---------- Recommended Products ----------
  loadRecommendedProducts(): void {
    // Get products with promotions
    const promoted = this.allProducts
      .filter(p => p.promotionPercent && p.promotionPercent > 0)
      .slice(0, 6);

    // Get recent products (by id, assuming higher id = more recent)
    const recent = [...this.allProducts]
      .sort((a, b) => {
        // Sort by id (assuming UUIDs or sequential IDs)
        return b.id.localeCompare(a.id);
      })
      .slice(0, 6);

    // Combine and deduplicate
    const combined = [...promoted, ...recent];
    const unique = combined.filter((p, index, self) => 
      index === self.findIndex(pr => pr.id === p.id)
    );

    this.recommendedProducts = unique.slice(0, 8);
  }

  // ---------- Search ----------
  onSearchChange(query: string): void {
    this.searchQuery = query;
    this.searchSubject.next(query);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.filters.search = '';
    this.loadProducts();
  }

  // ---------- Filters ----------
  onCategoryChange(categoryId: string | null): void {
    this.filters.categorie_id = categoryId;
    this.selectedCategory = categoryId;
    this.currentPage = 1;
    this.loadProducts();
  }

  onPriceRangeChange(): void {
    this.currentPage = 1;
    this.applyFiltersAndSort();
  }

  onSortChange(sortBy: FilterState['sortBy']): void {
    this.filters.sortBy = sortBy;
    this.applyFiltersAndSort();
  }

  togglePromotionsOnly(): void {
    this.filters.showPromotionsOnly = !this.filters.showPromotionsOnly;
    this.currentPage = 1;
    this.applyFiltersAndSort();
  }

  // ---------- Cart ----------
  addToCart(product: Product): void {
    const existing = this.cart.find(item => item.product.id === product.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      this.cart.push({ product, quantity: 1 });
    }
    this.persistCart();
  }

  removeFromCart(productId: string): void {
    this.cart = this.cart.filter(item => item.product.id !== productId);
    this.persistCart();
  }

  cartTotal(): number {
    return this.cart.reduce((sum, item) => {
      const price = item.product.prix_promotion || item.product.prix;
      return sum + price * item.quantity;
    }, 0);
  }

  checkoutCart(): void {
    if (!this.auth.isAuthenticated) {
      this.router.navigate(['/login'], { queryParams: { redirectTo: '/client/dashboard' } });
      return;
    }
    this.router.navigate(['/client/dashboard'], { queryParams: { startCheckout: '1' } });
  }

  private loadCart(): void {
    try {
      const raw = localStorage.getItem(this.cartKey);
      if (raw) this.cart = JSON.parse(raw);
    } catch {
      this.cart = [];
    }
  }

  private persistCart(): void {
    try {
      localStorage.setItem(this.cartKey, JSON.stringify(this.cart));
    } catch {
      // ignore storage errors
    }
  }

  resetFilters(): void {
    this.filters = {
      search: '',
      categorie_id: null,
      prixMin: null,
      prixMax: null,
      sortBy: 'recent',
      showPromotionsOnly: false
    };
    this.searchQuery = '';
    this.selectedCategory = null;
    this.currentPage = 1;
    this.loadProducts();
  }

  // ---------- Apply Filters & Sort ----------
  applyFiltersAndSort(): void {
    let filtered = [...this.allProducts];

    // Filter by price range
    if (this.filters.prixMin !== null) {
      filtered = filtered.filter(p => {
        const price = p.prix_promotion || p.prix;
        return price >= this.filters.prixMin!;
      });
    }

    if (this.filters.prixMax !== null) {
      filtered = filtered.filter(p => {
        const price = p.prix_promotion || p.prix;
        return price <= this.filters.prixMax!;
      });
    }

    // Filter promotions only
    if (this.filters.showPromotionsOnly) {
      filtered = filtered.filter(p => p.promotionPercent && p.promotionPercent > 0);
    }

    // Sort
    filtered = this.sortProducts(filtered, this.filters.sortBy);

    // Update pagination
    this.totalPages = Math.ceil(filtered.length / this.itemsPerPage);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }

    // Apply pagination
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.displayedProducts = filtered.slice(start, end);
  }

  sortProducts(products: Product[], sortBy: FilterState['sortBy']): Product[] {
    const sorted = [...products];
    
    switch (sortBy) {
      case 'price_asc':
        return sorted.sort((a, b) => {
          const priceA = a.prix_promotion || a.prix;
          const priceB = b.prix_promotion || b.prix;
          return priceA - priceB;
        });
      
      case 'price_desc':
        return sorted.sort((a, b) => {
          const priceA = a.prix_promotion || a.prix;
          const priceB = b.prix_promotion || b.prix;
          return priceB - priceA;
        });
      
      case 'popular':
        // Sort by promotion percentage (higher = more popular)
        return sorted.sort((a, b) => {
          const promoA = a.promotionPercent || 0;
          const promoB = b.promotionPercent || 0;
          return promoB - promoA;
        });
      
      case 'promotion':
        return sorted.sort((a, b) => {
          const promoA = a.promotionPercent || 0;
          const promoB = b.promotionPercent || 0;
          if (promoB !== promoA) return promoB - promoA;
          const priceA = a.prix_promotion || a.prix;
          const priceB = b.prix_promotion || b.prix;
          return priceA - priceB;
        });
      
      case 'recent':
      default:
        // Sort by id (assuming higher id = more recent)
        return sorted.sort((a, b) => b.id.localeCompare(a.id));
    }
  }

  // ---------- Pagination ----------
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.applyFiltersAndSort();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.applyFiltersAndSort();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.applyFiltersAndSort();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // ---------- UI Helpers ----------
  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
  }

  resolveImage(path: string | null | undefined): string | null {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `http://localhost:3000${path}`;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2
    }).format(amount);
  }

  getPrice(product: Product): number {
    return product.prix_promotion || product.prix;
  }

  hasPromotion(product: Product): boolean {
    return !!(product.promotionPercent && product.promotionPercent > 0);
  }

  get selectedCategoryName(): string {
    const category = this.categories?.find(c => c.id === this.filters.categorie_id);
    return category?.name ?? 'Produits';
  }

  // ---------- Navigation ----------
  goToProduct(productId: string): void {
    // Navigate to product details page (if exists) or add to cart
    console.log('Navigate to product:', productId);
    // this.router.navigate(['/produit', productId]);
  }
}
