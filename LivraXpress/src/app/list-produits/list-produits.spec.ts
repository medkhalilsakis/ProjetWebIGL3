import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListProduits } from './list-produits';

describe('ListProduits', () => {
  let component: ListProduits;
  let fixture: ComponentFixture<ListProduits>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListProduits]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListProduits);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
