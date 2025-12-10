import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LivreurDashboard } from './livreur-dashboard';

describe('LivreurDashboard', () => {
  let component: LivreurDashboard;
  let fixture: ComponentFixture<LivreurDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LivreurDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LivreurDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
