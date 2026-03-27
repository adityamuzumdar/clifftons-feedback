import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, Member, TeamOverview } from '../shared/services/api.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
})
export class AdminComponent implements OnInit {
  step: 'create' | 'manage' = 'create';
  teamName = '';
  creating = false;
  createError = '';

  adminToken = '';
  team: TeamOverview | null = null;
  loading = false;
  loadError = '';

  newMemberName = '';
  addingMember = false;
  addError = '';

  copiedKey: string | null = null;

  constructor(private api: ApiService, private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    const token = this.route.snapshot.paramMap.get('adminToken');
    if (token) {
      this.adminToken = token;
      this.step = 'manage';
      this.loadTeam();
    }
  }

  get baseUrl(): string {
    return window.location.origin;
  }

  get inviteLink(): string {
    return `${this.baseUrl}/join/${this.team?.inviteToken}`;
  }

  createTeam() {
    if (!this.teamName.trim()) return;
    this.creating = true;
    this.createError = '';
    this.api.createTeam(this.teamName.trim()).subscribe({
      next: (res) => {
        this.adminToken = res.adminToken;
        this.step = 'manage';
        this.router.navigate(['/admin', this.adminToken], { replaceUrl: true });
        this.loadTeam();
      },
      error: () => {
        this.createError = 'Failed to create team. Please try again.';
        this.creating = false;
      },
    });
  }

  loadTeam() {
    this.loading = true;
    this.loadError = '';
    this.api.getTeam(this.adminToken).subscribe({
      next: (team) => {
        this.team = team;
        this.loading = false;
      },
      error: () => {
        this.loadError = 'Could not load team. Check the URL.';
        this.loading = false;
      },
    });
  }

  // Manual add — fallback if someone can't access the invite link
  addMember() {
    if (!this.newMemberName.trim()) return;
    this.addingMember = true;
    this.addError = '';
    this.api.addMember(this.adminToken, this.newMemberName.trim()).subscribe({
      next: (member) => {
        this.team!.members.push(member);
        this.team!.completionStats.total += 1;
        this.newMemberName = '';
        this.addingMember = false;
      },
      error: (err) => {
        this.addError = err.error?.error || 'Failed to add member.';
        this.addingMember = false;
      },
    });
  }

  removeMember(member: Member) {
    if (!confirm(`Remove ${member.name}?`)) return;
    this.api.removeMember(this.adminToken, member.id).subscribe({
      next: () => {
        this.team!.members = this.team!.members.filter((m) => m.id !== member.id);
        this.team!.completionStats.total -= 1;
      },
      error: (err) => alert(err.error?.error || 'Could not remove member.'),
    });
  }

  copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.copiedKey = key;
      setTimeout(() => (this.copiedKey = null), 2000);
    });
  }

  openFeedback() {
    if (!confirm('Open feedback round? Members will be able to submit, and new registrations will be locked.')) return;
    this.api.openFeedback(this.adminToken).subscribe({
      next: () => { this.team!.feedbackOpen = true; },
      error: (err) => alert(err.error?.error || 'Failed to open feedback.'),
    });
  }

  submitLink(token: string): string {
    return `${this.baseUrl}/submit/${token}`;
  }
}
