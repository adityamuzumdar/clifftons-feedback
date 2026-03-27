import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService, MemberToRate, SubmitFormData } from '../shared/services/api.service';
import { CryptoService } from '../shared/services/crypto.service';

const DOMAINS = [
  { key: 'executing', label: 'Executing' },
  { key: 'relationshipBuilding', label: 'Relationship Building' },
  { key: 'influencing', label: 'Influencing' },
  { key: 'strategicThinking', label: 'Strategic Thinking' },
] as const;

type DomainKey = (typeof DOMAINS)[number]['key'];

interface MemberForm {
  member: MemberToRate;
  executing: number;
  relationshipBuilding: number;
  influencing: number;
  strategicThinking: number;
  goodAt: string;
  badAt: string;
}

@Component({
  selector: 'app-submit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './submit.component.html',
})
export class SubmitComponent implements OnInit {
  submitToken = '';
  formData: SubmitFormData | null = null;
  forms: MemberForm[] = [];
  domains = DOMAINS;
  stars = [1, 2, 3, 4, 5];
  activeIndex = 0;

  state: 'loading' | 'form' | 'submitting' | 'done' | 'already_submitted' | 'feedback_not_open' | 'error' = 'loading';
  errorMsg = '';

  constructor(private api: ApiService, private crypto: CryptoService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.submitToken = this.route.snapshot.paramMap.get('submitToken') ?? '';
    this.api.getSubmitForm(this.submitToken).subscribe({
      next: (data) => {
        this.formData = data;
        this.forms = data.membersToRate.map((m) => ({
          member: m,
          executing: 0, relationshipBuilding: 0, influencing: 0, strategicThinking: 0,
          goodAt: '', badAt: '',
        }));
        this.state = 'form';
      },
      error: (err) => {
        if (err.status === 409) this.state = 'already_submitted';
        else if (err.status === 403) this.state = 'feedback_not_open';
        else { this.state = 'error'; this.errorMsg = err.error?.error || 'Invalid or expired link.'; }
      },
    });
  }

  setRating(form: MemberForm, domain: DomainKey, value: number) {
    form[domain] = value;
  }

  isMemberComplete(form: MemberForm): boolean {
    return form.executing > 0 && form.relationshipBuilding > 0 &&
      form.influencing > 0 && form.strategicThinking > 0 &&
      form.goodAt.trim().length > 0 && form.badAt.trim().length > 0;
  }

  get completedCount() { return this.forms.filter((f) => this.isMemberComplete(f)).length; }
  get allComplete() { return this.forms.length > 0 && this.completedCount === this.forms.length; }

  async submit() {
    if (!this.allComplete) return;
    this.state = 'submitting';
    this.errorMsg = '';

    try {
      // Encrypt each feedback entry in the browser using the target's public key
      const encryptedFeedbacks = await Promise.all(
        this.forms.map(async (f) => {
          if (!f.member.publicKeyJwk) throw new Error(`No public key for ${f.member.name}`);

          const plaintext = {
            executing: f.executing,
            relationshipBuilding: f.relationshipBuilding,
            influencing: f.influencing,
            strategicThinking: f.strategicThinking,
            goodAt: f.goodAt.trim(),
            badAt: f.badAt.trim(),
          };

          const encrypted = await this.crypto.encryptFeedback(plaintext, f.member.publicKeyJwk);
          return { memberId: f.member.id, ...encrypted };
        })
      );

      this.api.submitFeedback(this.submitToken, encryptedFeedbacks).subscribe({
        next: () => (this.state = 'done'),
        error: (err) => {
          this.state = 'form';
          this.errorMsg = err.error?.error || 'Submission failed. Please try again.';
        },
      });
    } catch (err) {
      this.state = 'form';
      this.errorMsg = 'Encryption failed. Please try again.';
    }
  }
}
