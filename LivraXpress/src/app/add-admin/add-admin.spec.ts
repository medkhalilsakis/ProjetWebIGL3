import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddAdmin } from './add-admin';

describe('AddAdmin', () => {
  let component: AddAdmin;
  let fixture: ComponentFixture<AddAdmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddAdmin]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddAdmin);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
