import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'admin', pathMatch: 'full' },
  {
    path: 'admin',
    loadComponent: () => import('./admin/admin.component').then((m) => m.AdminComponent),
  },
  {
    path: 'admin/:adminToken',
    loadComponent: () => import('./admin/admin.component').then((m) => m.AdminComponent),
  },
  {
    path: 'join/:inviteToken',
    loadComponent: () => import('./join/join.component').then((m) => m.JoinComponent),
  },
  {
    path: 'submit/:submitToken',
    loadComponent: () => import('./submit/submit.component').then((m) => m.SubmitComponent),
  },
  {
    path: 'results/:viewToken',
    loadComponent: () => import('./results/results.component').then((m) => m.ResultsComponent),
  },
  { path: '**', redirectTo: 'admin' },
];
