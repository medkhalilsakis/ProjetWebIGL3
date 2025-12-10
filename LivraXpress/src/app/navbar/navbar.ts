// frontend/src/app/shared/components/navbar/navbar.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/authentification';
import { NotificationService } from '../services/notification';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.css'],
  imports:[CommonModule, RouterModule]
})
export class NavbarComponent implements OnInit, OnDestroy {
  currentUser: any = null;
  unreadCount = 0;
  showNotifications = false;
  showUserMenu = false;
  notifications: any[] = [];
  
  private subscriptions: Subscription[] = [];

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // S'abonner à l'utilisateur actuel
    this.subscriptions.push(
      this.authService.currentUser.subscribe(user => {
        this.currentUser = user;
        if (user) {
          this.loadNotifications();
        }
      })
    );

    // S'abonner au nombre de notifications non lues
    this.subscriptions.push(
      this.notificationService.unreadCount$.subscribe(count => {
        this.unreadCount = count;
      })
    );

    // S'abonner aux notifications
    this.subscriptions.push(
      this.notificationService.notifications$.subscribe(notifs => {
        this.notifications = notifs.slice(0, 5); // Afficher seulement les 5 dernières
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadNotifications(): void {
    this.notificationService.loadNotifications();
  }

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    this.showUserMenu = false;
  }

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
    this.showNotifications = false;
  }

  markAsRead(notificationId: string, event: Event): void {
    event.stopPropagation();
    this.notificationService.markAsRead(notificationId).subscribe(() => {
      this.loadNotifications();
    });
  }

  viewAllNotifications(): void {
    this.showNotifications = false;
    this.router.navigate([`/${this.currentUser.role}/notifications`]);
  }

  navigateToNotification(notification: any): void {
    if (notification.lien_action) {
      this.router.navigate([notification.lien_action]);
      this.markAsRead(notification.id, new Event('click'));
    }
    this.showNotifications = false;
  }

  logout(): void {
    this.authService.logout();
    this.showUserMenu = false;
  }

  getNotificationIcon(type: string): string {
  const icons: { [key: string]: string } = {
    commande: '🛒',
    paiement: '💳',
    avis: '⭐',
    systeme: '⚙️',
    promotion: '🎉',
    annulation: '❌'
  };

  return icons[type] || '📢';
}


  getTimeAgo(date: string): string {
    const now = new Date();
    const notifDate = new Date(date);
    const diffMs = now.getTime() - notifDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return notifDate.toLocaleDateString('fr-FR');
  }
}