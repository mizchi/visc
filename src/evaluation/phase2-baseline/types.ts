/**
 * Phase 2: Baseline Management Types
 */

import { BaselineLayout } from '../phase1-layout/types';

export interface BaselineVersion {
  id: string;
  version: string;
  createdAt: number;
  updatedAt: number;
  layout: BaselineLayout;
  metadata: {
    url: string;
    description?: string;
    tags?: string[];
    approvedBy?: string;
    approvalDate?: number;
  };
}

export interface BaselineCollection {
  id: string;
  name: string;
  url: string;
  versions: BaselineVersion[];
  activeVersion?: string;
  createdAt: number;
  updatedAt: number;
}

export interface BaselineUpdateRequest {
  collectionId: string;
  newLayout: BaselineLayout;
  reason: string;
  author?: string;
}