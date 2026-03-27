import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../shared/services/api.service';
import { CryptoService } from '../shared/services/crypto.service';

@Component({
  selector: 'app-join',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './join.component.html',
})
export class JoinComponent implements OnInit {
  inviteToken = '';
  teamName = '';
  name = '';

  state: 'loading' | 'ready' | 'joining' | 'save_link' | 'error' = 'loading';
  errorMsg = '';

  // Set after joining — shown once to the user
  viewSecret = '';
  submitToken = '';
  resultsCopied = false;

  constructor(
    private api: ApiService,
    private crypto: CryptoService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.inviteToken = this.route.snapshot.paramMap.get('inviteToken') ?? '';
    this.api.getJoinInfo(this.inviteToken).subscribe({
      next: (info) => { this.teamName = info.teamName; this.state = 'ready'; },
      error: () => { this.state = 'error'; this.errorMsg = 'Invalid invite link.'; },
    });
  }

  async join() {
    if (!this.name.trim()) return;
    this.state = 'joining';
    this.errorMsg = '';

    try {
      // All crypto happens in the browser — server never sees viewSecret
      const keys = await this.crypto.generateKeyMaterial();

      this.api.joinTeam(this.inviteToken, {
        name: this.name.trim(),
        publicKeyJwk: keys.publicKeyJwk,
        encryptedPrivateKey: keys.encryptedPrivateKey,
        privateKeyIv: keys.privateKeyIv,
        viewTokenHash: keys.viewTokenHash,
      }).subscribe({
        next: (res) => {
          this.viewSecret = keys.viewSecret;
          this.submitToken = res.submitToken;
          this.state = 'save_link';
        },
        error: (err) => {
          this.state = 'ready';
          this.errorMsg = err.error?.error === 'registration_closed'
            ? 'Registration is closed — the feedback round has already started.'
            : err.error?.error || 'Failed to join. Please try again.';
        },
      });
    } catch {
      this.state = 'ready';
      this.errorMsg = 'Crypto setup failed. Please use a modern browser.';
    }
  }

  get resultsLink(): string {
    return `${window.location.origin}/results/${this.viewSecret}`;
  }

  copyLink() {
    navigator.clipboard.writeText(this.resultsLink).then(() => {
      this.resultsCopied = true;
      setTimeout(() => (this.resultsCopied = false), 3000);
    });
  }

  goToSubmit() {
    this.router.navigate(['/submit', this.submitToken]);
  }
}
