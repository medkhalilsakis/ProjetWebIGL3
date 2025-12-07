import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FournisseurDashboard } from './fournisseur-dashboard';

describe('FournisseurDashboard', () => {
  let component: FournisseurDashboard;
  let fixture: ComponentFixture<FournisseurDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FournisseurDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FournisseurDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
