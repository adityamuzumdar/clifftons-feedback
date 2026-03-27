import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../shared/services/api.service';
import { CryptoService } from '../shared/services/crypto.service';

interface DecryptedFeedback {
  executing: number;
  relationshipBuilding: number;
  influencing: number;
  strategicThinking: number;
  goodAt: string;
  badAt: string;
}

interface AverageScores {
  executing: number | null;
  relationshipBuilding: number | null;
  influencing: number | null;
  strategicThinking: number | null;
}

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './results.component.html',
})
export class ResultsComponent implements OnInit {
  memberName = '';
  teamName = '';
  feedbacks: DecryptedFeedback[] = [];
  averageScores: AverageScores = { executing: null, relationshipBuilding: null, influencing: null, strategicThinking: null };

  state: 'loading' | 'loaded' | 'error' = 'loading';
  errorMsg = '';

  domains = [
    { key: 'executing' as const, label: 'Executing' },
    { key: 'relationshipBuilding' as const, label: 'Relationship Building' },
    { key: 'influencing' as const, label: 'Influencing' },
    { key: 'strategicThinking' as const, label: 'Strategic Thinking' },
  ];

  constructor(private api: ApiService, private crypto: CryptoService, private route: ActivatedRoute) {}

  async ngOnInit() {
    const viewSecret = this.route.snapshot.paramMap.get('viewToken') ?? '';

    this.api.getEncryptedResults(viewSecret).subscribe({
      next: async (res) => {
        try {
          // Recover private key using viewSecret + server's encrypted copy
          const privateKey = await this.crypto.recoverPrivateKey(
            viewSecret, res.encryptedPrivateKey!, res.privateKeyIv!
          );

          // Decrypt all feedback blobs in the browser
          this.feedbacks = await Promise.all(
            res.encryptedFeedbacks.map((blob) => this.crypto.decryptFeedback(blob, privateKey))
          );

          this.memberName = res.memberName;
          this.teamName = res.teamName;
          this.computeAverages();
          this.state = 'loaded';
        } catch {
          this.state = 'error';
          this.errorMsg = 'Decryption failed. Make sure you are using the correct results link.';
        }
      },
      error: () => {
        this.state = 'error';
        this.errorMsg = 'Invalid results link.';
      },
    });
  }

  private computeAverages() {
    const count = this.feedbacks.length;
    if (count === 0) return;
    const avg = (key: keyof DecryptedFeedback) =>
      Math.round((this.feedbacks.reduce((sum, f) => sum + (f[key] as number), 0) / count) * 10) / 10;
    this.averageScores = {
      executing: avg('executing'),
      relationshipBuilding: avg('relationshipBuilding'),
      influencing: avg('influencing'),
      strategicThinking: avg('strategicThinking'),
    };
  }

  get goodAtList(): string[] { return this.feedbacks.map((f) => f.goodAt); }
  get badAtList(): string[] { return this.feedbacks.map((f) => f.badAt); }

  stars(score: number | null): string {
    if (score === null) return '—';
    const filled = Math.round(score);
    return '★'.repeat(filled) + '☆'.repeat(5 - filled);
  }
}
