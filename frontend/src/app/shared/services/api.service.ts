import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Member {
  id: string;
  name: string;
  hasSubmitted?: boolean;
  submitToken?: string;
}

export interface TeamOverview {
  teamName: string;
  inviteToken: string;
  feedbackOpen: boolean;
  members: Member[];
  completionStats: { submitted: number; total: number; percent: number };
}

export interface JoinInfo {
  teamName: string;
}

export interface JoinPayload {
  name: string;
  publicKeyJwk: JsonWebKey;
  encryptedPrivateKey: string;
  privateKeyIv: string;
  viewTokenHash: string;
}

export interface JoinResult {
  submitToken: string;
  memberName: string;
  teamName: string;
}

export interface MemberToRate {
  id: string;
  name: string;
  publicKeyJwk: JsonWebKey | null;
}

export interface SubmitFormData {
  submitterName: string;
  teamName: string;
  membersToRate: MemberToRate[];
}

export interface EncryptedFeedbackPayload {
  memberId: string;
  ephemeralPubKey: string;
  encryptedData: string;
  iv: string;
}

export interface EncryptedFeedbackBlob {
  ephemeralPubKey: string;
  encryptedData: string;
  iv: string;
}

export interface EncryptedResultsResponse {
  memberName: string;
  teamName: string;
  encryptedPrivateKey: string;
  privateKeyIv: string;
  encryptedFeedbacks: EncryptedFeedbackBlob[];
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  createTeam(teamName: string): Observable<{ adminToken: string; teamId: string; teamName: string }> {
    return this.http.post<{ adminToken: string; teamId: string; teamName: string }>('/api/admin/teams', { teamName });
  }

  getTeam(adminToken: string): Observable<TeamOverview> {
    return this.http.get<TeamOverview>(`/api/admin/${adminToken}`);
  }

  addMember(adminToken: string, name: string): Observable<Member> {
    return this.http.post<Member>(`/api/admin/${adminToken}/members`, { name });
  }

  removeMember(adminToken: string, memberId: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/${adminToken}/members/${memberId}`);
  }

  openFeedback(adminToken: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`/api/admin/${adminToken}/open`, {});
  }

  getJoinInfo(inviteToken: string): Observable<JoinInfo> {
    return this.http.get<JoinInfo>(`/api/join/${inviteToken}`);
  }

  joinTeam(inviteToken: string, payload: JoinPayload): Observable<JoinResult> {
    return this.http.post<JoinResult>(`/api/join/${inviteToken}`, payload);
  }

  getSubmitForm(submitToken: string): Observable<SubmitFormData> {
    return this.http.get<SubmitFormData>(`/api/submit/${submitToken}`);
  }

  submitFeedback(submitToken: string, feedbacks: EncryptedFeedbackPayload[]): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`/api/submit/${submitToken}`, { feedbacks });
  }

  getEncryptedResults(viewSecret: string): Observable<EncryptedResultsResponse> {
    return this.http.get<EncryptedResultsResponse>(`/api/results/${encodeURIComponent(viewSecret)}`);
  }
}
