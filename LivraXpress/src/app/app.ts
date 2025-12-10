import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor } from './core/auth.interceptor';
import { AuthService } from './services/authentification';
import { interval, Subscription } from 'rxjs';
import { FaIconLibrary, FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons'; // pack complet

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FontAwesomeModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ]
})

export class App implements OnInit, OnDestroy {
  protected readonly title = signal('LivraXpress');
  private keepAliveSub: Subscription | null = null;

  constructor(private authService: AuthService, library: FaIconLibrary) {
    library.addIconPacks(fas);
  }

  ngOnInit(): void {
    // On app start we try to verify the stored session (if any)
    try {
      this.authService.verifySession().subscribe();
    } catch (e) {}

    // Periodically extend session every 15 minutes while app is open
    this.keepAliveSub = interval(15 * 60 * 1000).subscribe(() => {
      try { this.authService.extendSession().subscribe(); } catch (e) {}
    });
  }

  ngOnDestroy(): void {
    if (this.keepAliveSub) this.keepAliveSub.unsubscribe();
  }
}
