import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FournisseurCard } from './fournisseur-card';

describe('FournisseurCard', () => {
  let component: FournisseurCard;
  let fixture: ComponentFixture<FournisseurCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FournisseurCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FournisseurCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
