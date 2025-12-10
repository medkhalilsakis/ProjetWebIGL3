import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ToastService {

  showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">${this.getToastIcon(type)}</span>
        <span class="toast-message">${message}</span>
      </div>
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 4000);
  }

  private getToastIcon(type: string): string {
    return {
      success: '✓',
      error: '✕',
      info: 'ℹ',
      warning: '⚠'
    }[type] ?? '';
  }
}
